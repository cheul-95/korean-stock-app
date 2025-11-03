import axios, { AxiosError } from "axios";
import { kv } from "@vercel/kv"; // 🔥 추가

const KIS_BASE_URL = "https://openapi.koreainvestment.com:9443";

// KIS API 에러 응답 타입
interface KISErrorResponse {
    error_description?: string;
    error_code?: string;
}

// Redis 키
const TOKEN_CACHE_KEY = "kis_access_token";
const TOKEN_EXPIRY_KEY = "kis_token_expiry";
const TOKEN_LOCK_KEY = "kis_token_lock";

// API 호출 제한 설정
const API_CALL_DELAY = 200;
let lastApiCallTime = 0;

// API 호출 전 대기 (Rate Limiting)
const waitForRateLimit = async () => {
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCallTime;

    if (timeSinceLastCall < API_CALL_DELAY) {
        const waitTime = API_CALL_DELAY - timeSinceLastCall;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    lastApiCallTime = Date.now();
};

// 제한된 동시 호출 유틸리티
const promiseAllWithLimit = async <T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> => {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += limit) {
        const batch = items.slice(i, i + limit);
        const batchResults = await Promise.all(batch.map(fn));
        results.push(...batchResults);

        if (i + limit < items.length) {
            await new Promise((resolve) => setTimeout(resolve, 300));
        }
    }

    return results;
};

// Retry 로직이 포함된 API 호출 유틸리티
const apiCallWithRetry = async <T>(fn: () => Promise<T>, maxRetries = 3, delayMs = 2000): Promise<T> => {
    let lastError: Error | undefined;

    for (let i = 0; i < maxRetries; i++) {
        try {
            await waitForRateLimit();
            return await fn();
        } catch (error) {
            lastError = error as Error;
            const axiosError = error as AxiosError<KISErrorResponse>;

            // 🔥 토큰 에러 특별 처리
            if (axiosError.response?.data?.error_code === "EGW00133") {
                console.log(`⚠️ 토큰 발급 제한. 65초 대기 후 재시도 (${i + 1}/${maxRetries})`);
                // 🔥 Redis 캐시 초기화
                await kv.del(TOKEN_CACHE_KEY);
                await kv.del(TOKEN_EXPIRY_KEY);
                await kv.del(TOKEN_LOCK_KEY);

                await new Promise((resolve) => setTimeout(resolve, 65000));
                continue;
            }

            // Rate limit 에러인 경우
            if (axiosError.response?.status === 429) {
                const retryAfter = axiosError.response?.headers?.["retry-after"];
                const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delayMs * (i + 1);
                console.log(`⏳ Rate limit 도달. ${waitTime}ms 대기 후 재시도 (${i + 1}/${maxRetries})`);
                await new Promise((resolve) => setTimeout(resolve, waitTime));
            } else if (i < maxRetries - 1) {
                const waitTime = delayMs * Math.pow(2, i);
                console.log(`⚠️ API 호출 실패. ${waitTime}ms 대기 후 재시도 (${i + 1}/${maxRetries})`);
                await new Promise((resolve) => setTimeout(resolve, waitTime));
            }
        }
    }

    throw lastError;
};

// 🔥 Redis 기반 토큰 관리
export const getAccessToken = async (): Promise<string> => {
    try {
        // 1. Redis에서 캐시된 토큰 확인
        const cachedToken = await kv.get<string>(TOKEN_CACHE_KEY);
        const tokenExpiry = await kv.get<number>(TOKEN_EXPIRY_KEY);

        if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
            console.log("✅ Redis 캐시된 토큰 재사용");
            return cachedToken;
        }

        // 2. 분산 락으로 중복 토큰 발급 방지
        const lockAcquired = await kv.set(TOKEN_LOCK_KEY, "locked", {
            nx: true, // 키가 없을 때만 설정
            ex: 10, // 10초 후 자동 삭제
        });

        if (!lockAcquired) {
            // 다른 인스턴스가 토큰 발급 중
            console.log("⏳ 다른 인스턴스가 토큰 발급 중... 2초 대기");
            await new Promise((resolve) => setTimeout(resolve, 2000));
            // 재귀 호출로 다시 확인
            return getAccessToken();
        }

        try {
            // 3. 토큰 발급
            console.log("🔄 새로운 토큰 발급 요청...");

            if (!process.env.KIS_APP_KEY || !process.env.KIS_APP_SECRET) {
                throw new Error("KIS_APP_KEY 또는 KIS_APP_SECRET이 설정되지 않았습니다.");
            }

            const response = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
                grant_type: "client_credentials",
                appkey: process.env.KIS_APP_KEY,
                appsecret: process.env.KIS_APP_SECRET,
            });

            const token = response.data.access_token;
            if (!token) {
                throw new Error("토큰을 받아오지 못했습니다.");
            }

            // 4. Redis에 토큰 저장 (55초 유효)
            const expiry = Date.now() + 55 * 1000;
            await kv.set(TOKEN_CACHE_KEY, token);
            await kv.set(TOKEN_EXPIRY_KEY, expiry);

            console.log("✅ 토큰 발급 성공 및 Redis 저장 (55초 유효)");

            return token;
        } finally {
            // 5. 락 해제
            await kv.del(TOKEN_LOCK_KEY);
        }
    } catch (error) {
        const axiosError = error as AxiosError<KISErrorResponse>;
        console.error("❌ 토큰 발급 실패:", axiosError.response?.data || (error as Error).message);
        throw error;
    }
};

const getHeaders = async (trId: string) => {
    const token = await getAccessToken();

    if (!process.env.KIS_APP_KEY || !process.env.KIS_APP_SECRET) {
        throw new Error("KIS_APP_KEY 또는 KIS_APP_SECRET이 설정되지 않았습니다.");
    }

    return {
        "Content-Type": "application/json",
        authorization: `Bearer ${token}`,
        appkey: process.env.KIS_APP_KEY,
        appsecret: process.env.KIS_APP_SECRET,
        tr_id: trId,
    };
};

// 주식 현재가 조회
export const getStockPrice = async (stockCode: string) => {
    return apiCallWithRetry(async () => {
        try {
            const headers = await getHeaders("FHKST01010100");

            const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price-2`, {
                headers,
                params: {
                    FID_COND_MRKT_DIV_CODE: "J",
                    FID_INPUT_ISCD: stockCode,
                },
            });

            return response.data;
        } catch (error) {
            const axiosError = error as AxiosError;
            console.error("주식 정보 조회 실패:", axiosError.message);
            console.error("에러 응답:", axiosError.response?.data);
            throw error;
        }
    });
};

// 종목 기본정보 조회 (종목명, 업종명 등)
export const getStockInfo = async (stockCode: string) => {
    return apiCallWithRetry(async () => {
        try {
            const headers = await getHeaders("CTPF1604R");

            const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/search-info`, {
                headers,
                params: {
                    PRDT_TYPE_CD: "300",
                    PDNO: stockCode,
                },
            });

            if (response.data.rt_cd === "0" && response.data.output) {
                const output = response.data.output;

                return {
                    rt_cd: "0",
                    msg_cd: "SUCCESS",
                    msg1: "정상처리",
                    stockCode: stockCode,
                    stockName: output.prdt_abrv_name || stockCode,
                    stockNameEng: output.prdt_eng_name || "",
                    marketType: output.std_pdno?.startsWith("0") ? "KOSDAQ" : "KOSPI",
                    sectorCode: output.한국_업종_코드 || "",
                    sectorName: output.한국_업종_명 || "",
                    listedShares: output.lstg_stqt || "0",
                    capital: output.cpfn || "0",
                    faceValue: output.stck_prpr || "0",
                    companyNameKor: output.prdt_name || "",
                    companyNameEng: output.prdt_eng_name || "",
                };
            }

            return response.data;
        } catch (error) {
            const axiosError = error as AxiosError;
            console.error("종목 기본정보 조회 실패:", axiosError.message);
            console.error("에러 응답:", axiosError.response?.data);
            throw error;
        }
    });
};

// 거래량 상위 종목 타입 정의
interface VolumeRankStock {
    hts_kor_isnm: string;
    mksc_shrn_iscd: string;
    data_rank: string;
    stck_prpr: string;
    prdy_vrss: string;
    prdy_vrss_sign: string;
    prdy_ctrt: string;
    acml_vol: string;
    [key: string]: string;
}

// 거래량 상위 종목 조회 (종목명 포함)
export const getVolumeRankStocks = async () => {
    return apiCallWithRetry(async () => {
        try {
            const headers = await getHeaders("FHPST01710000");

            const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/volume-rank`, {
                headers,
                params: {
                    FID_COND_MRKT_DIV_CODE: "J",
                    FID_COND_SCR_DIV_CODE: "20171",
                    FID_INPUT_ISCD: "0000",
                    FID_DIV_CLS_CODE: "0",
                    FID_BLNG_CLS_CODE: "0",
                    FID_TRGT_CLS_CODE: "111111111",
                    FID_TRGT_EXLS_CLS_CODE: "0000000000",
                    FID_INPUT_PRICE_1: "",
                    FID_INPUT_PRICE_2: "",
                    FID_VOL_CNT: "",
                    FID_INPUT_DATE_1: "",
                },
            });

            if (response.data.rt_cd === "0" && response.data.output) {
                const filteredOutput = response.data.output
                    .filter((stock: VolumeRankStock) => {
                        const name = stock.hts_kor_isnm || "";
                        const code = stock.mksc_shrn_iscd || "";

                        const isValidCode = /^\d{6}$/.test(code);

                        return (
                            isValidCode &&
                            !name.includes("KODEX") &&
                            !name.includes("TIGER") &&
                            !name.includes("ACE") &&
                            !name.includes("ARIRANG") &&
                            !name.includes("KBSTAR") &&
                            !name.includes("HANARO") &&
                            !name.includes("SOL") &&
                            !name.includes("ETF") &&
                            !name.includes("ETN") &&
                            !name.includes("KOSPI") &&
                            !name.includes("KOSDAQ") &&
                            !name.includes("KRX") &&
                            !name.includes("리츠") &&
                            !name.includes("스팩") &&
                            !name.includes("SPAC") &&
                            !name.includes("선물") &&
                            name.length > 0
                        );
                    })
                    .slice(0, 15);

                // 🔥 동시 호출 수를 3개로 줄임
                const detailedStocks = await promiseAllWithLimit(filteredOutput, 3, async (stock: VolumeRankStock) => {
                    try {
                        const detailData = await apiCallWithRetry(() => getStockPrice(stock.mksc_shrn_iscd));

                        return {
                            ...stock,
                            hts_kor_isnm: detailData.output?.prdt_name || stock.hts_kor_isnm || stock.mksc_shrn_iscd,
                        };
                    } catch (error) {
                        console.error(`${stock.mksc_shrn_iscd} 상세 조회 실패:`, error);
                        return stock;
                    }
                });

                const finalStocks = detailedStocks.slice(0, 10);

                return {
                    rt_cd: "0",
                    msg_cd: "SUCCESS",
                    msg1: "정상처리",
                    output: finalStocks,
                };
            }

            return response.data;
        } catch (error) {
            const axiosError = error as AxiosError;
            console.error("❌ 거래량 상위 종목 조회 실패:", axiosError);
            console.error("에러 응답:", axiosError.response?.data);
            throw error;
        }
    });
};

export const getStockAskingPrice = async (stockCode: string) => {
    return apiCallWithRetry(async () => {
        try {
            const headers = await getHeaders("FHKST01010200");

            const response = await axios.get(
                `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-asking-price-exp-ccn`,
                {
                    headers,
                    params: {
                        FID_COND_MRKT_DIV_CODE: "J",
                        FID_INPUT_ISCD: stockCode,
                    },
                }
            );

            return response.data;
        } catch (error) {
            console.error("호가 정보 조회 실패:", error);
            throw error;
        }
    });
};

export const getStockDailyPrice = async (stockCode: string) => {
    return apiCallWithRetry(async () => {
        try {
            const headers = await getHeaders("FHKST01010400");

            const endDate = new Date().toISOString().split("T")[0].replace(/-/g, "");

            const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-price`, {
                headers,
                params: {
                    FID_COND_MRKT_DIV_CODE: "J",
                    FID_INPUT_ISCD: stockCode,
                    FID_PERIOD_DIV_CODE: "D",
                    FID_ORG_ADJ_PRC: "0",
                    FID_INPUT_DATE_1: endDate,
                },
            });

            return response.data;
        } catch (error) {
            console.error("일별 시세 조회 실패:", error);
            throw error;
        }
    });
};

// ✅ KRX API 타입 정의
interface KRXStockItem {
    ISU_CD: string;
    ISU_SRT_CD: string;
    ISU_NM: string;
    ISU_ABBRV: string;
    ISU_ENG_NM: string;
    LIST_DD: string;
    MKT_TP_NM: string;
}

interface KRXResponse {
    OutBlock_1?: KRXStockItem[];
}

// ✅ KRX API를 사용한 종목명 검색
export const searchStockByName = async (keyword: string) => {
    try {
        const response = await fetch("http://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd", {
            method: "POST",
            headers: {
                Accept: "application/json, text/javascript, */*; q=0.01",
                "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                Origin: "http://data.krx.co.kr",
                Referer: "http://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201",
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "X-Requested-With": "XMLHttpRequest",
            },
            body: new URLSearchParams({
                bld: "dbms/MDC/STAT/standard/MDCSTAT01901",
                locale: "ko_KR",
                mktId: "ALL",
            }),
        });

        if (!response.ok) {
            throw new Error(`KRX API responded with status: ${response.status}`);
        }

        const data: KRXResponse = await response.json();
        const list = data?.OutBlock_1 || [];

        const searchKeyword = keyword.replace(/\s+/g, "").toLowerCase();

        const matches = list.filter((item) => {
            const abbrev = item.ISU_ABBRV?.replace(/\s+/g, "").toLowerCase() || "";
            const fullName = item.ISU_NM?.replace(/\s+/g, "").toLowerCase() || "";
            return abbrev.includes(searchKeyword) || fullName.includes(searchKeyword);
        });

        if (matches.length === 0) {
            return null;
        }

        const exactMatch = matches.find((item) => {
            const abbrev = item.ISU_ABBRV?.replace(/\s+/g, "").toLowerCase() || "";
            const fullName = item.ISU_NM?.replace(/\s+/g, "").toLowerCase() || "";
            return abbrev === searchKeyword || fullName === searchKeyword;
        });

        if (exactMatch) {
            const isPreferredStock =
                !exactMatch.ISU_ABBRV.includes("우") &&
                !exactMatch.ISU_ABBRV.includes("1우") &&
                !exactMatch.ISU_ABBRV.includes("2우") &&
                !exactMatch.ISU_ABBRV.includes("신주") &&
                !exactMatch.ISU_ABBRV.includes("스팩");

            if (isPreferredStock) {
                return {
                    code: exactMatch.ISU_SRT_CD,
                    name: exactMatch.ISU_ABBRV,
                    market: exactMatch.MKT_TP_NM,
                    fullName: exactMatch.ISU_NM,
                    listDate: exactMatch.LIST_DD,
                };
            }
        }

        const found =
            matches.find((item) => {
                const stockName = item.ISU_ABBRV || item.ISU_NM;
                return (
                    !stockName.includes("우") &&
                    !stockName.includes("1우") &&
                    !stockName.includes("2우") &&
                    !stockName.includes("신주") &&
                    !stockName.includes("스팩")
                );
            }) || matches[0];

        return {
            code: found.ISU_SRT_CD,
            name: found.ISU_ABBRV,
            market: found.MKT_TP_NM,
            fullName: found.ISU_NM,
            listDate: found.LIST_DD,
        };
    } catch (error) {
        const err = error as Error;
        console.error("❌ KRX API 종목명 검색 실패:", err.message);
        throw error;
    }
};
