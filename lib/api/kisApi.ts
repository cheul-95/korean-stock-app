import axios, { AxiosError } from "axios";
import fs from "fs";
import path from "path";

const KIS_BASE_URL = "https://openapi.koreainvestment.com:9443";

// 토큰 캐시 파일 경로
const TOKEN_CACHE_PATH = path.join(process.cwd(), ".token-cache.json");

// API 호출 제한 설정
const API_CALL_DELAY = 100; // 각 API 호출 사이의 최소 지연 시간 (ms) - 병렬 처리로 인해 감소
let lastApiCallTime = 0;

// API 호출 전 대기 (Rate Limiting)
const waitForRateLimit = async () => {
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCallTime;

    if (timeSinceLastCall < API_CALL_DELAY) {
        const waitTime = API_CALL_DELAY - timeSinceLastCall;
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    lastApiCallTime = Date.now();
};

// 제한된 동시 호출 유틸리티
const promiseAllWithLimit = async <T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>
): Promise<R[]> => {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += limit) {
        const batch = items.slice(i, i + limit);
        const batchResults = await Promise.all(batch.map(fn));
        results.push(...batchResults);

        // 배치 사이에 추가 딜레이 (마지막 배치가 아닌 경우)
        if (i + limit < items.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    return results;
};

// Retry 로직이 포함된 API 호출 유틸리티
const apiCallWithRetry = async <T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    delayMs = 1000
): Promise<T> => {
    let lastError: Error | undefined;

    for (let i = 0; i < maxRetries; i++) {
        try {
            await waitForRateLimit();
            return await fn();
        } catch (error) {
            lastError = error as Error;
            const axiosError = error as AxiosError;

            // Rate limit 에러인 경우 더 긴 대기
            if (axiosError.response?.status === 429) {
                const retryAfter = axiosError.response?.headers?.['retry-after'];
                const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delayMs * (i + 1);
                console.log(`⏳ Rate limit 도달. ${waitTime}ms 대기 후 재시도 (${i + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            } else if (i < maxRetries - 1) {
                // 일반 에러인 경우 지수 백오프
                const waitTime = delayMs * Math.pow(2, i);
                console.log(`⚠️ API 호출 실패. ${waitTime}ms 대기 후 재시도 (${i + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    throw lastError;
};

// 토큰 관련 변수들
let cachedToken: string | null = null;
let tokenExpiry: number | null = null;
let tokenPromise: Promise<string> | null = null;
let lastTokenFailureTime: number | null = null; // 마지막 토큰 발급 실패 시간

// 파일에서 토큰 로드
const loadTokenFromFile = (): { token: string; expiry: number } | null => {
    try {
        if (fs.existsSync(TOKEN_CACHE_PATH)) {
            const data = JSON.parse(fs.readFileSync(TOKEN_CACHE_PATH, "utf-8"));
            if (data.token && data.expiry && Date.now() < data.expiry) {
                return data;
            }
        }
    } catch (error) {
        console.error("파일에서 토큰 로드 실패:", error);
    }
    return null;
};

// 파일에 토큰 저장
const saveTokenToFile = (token: string, expiry: number) => {
    try {
        fs.writeFileSync(TOKEN_CACHE_PATH, JSON.stringify({ token, expiry }));
    } catch (error) {
        console.error("토큰 파일 저장 실패:", error);
    }
};

export const getAccessToken = async (): Promise<string> => {
    // 메모리 캐시 확인
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
        console.log("✅ 메모리 캐시에서 토큰 사용");
        return cachedToken;
    }

    // 파일 캐시 확인
    const fileToken = loadTokenFromFile();
    if (fileToken) {
        console.log("✅ 파일 캐시에서 토큰 로드");
        cachedToken = fileToken.token;
        tokenExpiry = fileToken.expiry;
        return fileToken.token;
    }

    // 마지막 토큰 발급 실패로부터 30초가 지나지 않았다면 재시도 방지
    // (KIS API는 1분당 1회 제한이지만, 30초 후 재시도로 완화)
    if (lastTokenFailureTime) {
        const timeSinceFailure = Date.now() - lastTokenFailureTime;
        const waitTime = 30000; // 30초로 단축

        if (timeSinceFailure < waitTime) {
            const remainingTime = Math.ceil((waitTime - timeSinceFailure) / 1000);
            throw new Error(
                `토큰 발급이 최근에 실패했습니다. ${remainingTime}초 후에 다시 시도해주세요. (1분당 1회 제한)`
            );
        } else {
            // 대기 시간이 지났으면 실패 기록 리셋
            lastTokenFailureTime = null;
        }
    }

    if (tokenPromise) {
        return tokenPromise;
    }

    if (!process.env.KIS_APP_KEY || !process.env.KIS_APP_SECRET) {
        const missingVars = [];
        if (!process.env.KIS_APP_KEY) missingVars.push("KIS_APP_KEY");
        if (!process.env.KIS_APP_SECRET) missingVars.push("KIS_APP_SECRET");
        throw new Error(`환경변수가 설정되지 않았습니다: ${missingVars.join(", ")}. .env.local 파일을 확인해주세요.`);
    }

    tokenPromise = (async () => {
        try {
            console.log("🔑 새로운 액세스 토큰 발급 시도...");
            const response = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
                grant_type: "client_credentials",
                appkey: process.env.KIS_APP_KEY,
                appsecret: process.env.KIS_APP_SECRET,
            });

            const token = response.data.access_token;
            if (!token) {
                throw new Error("토큰을 받아오지 못했습니다.");
            }

            cachedToken = token;
            // 토큰 유효기간을 22시간으로 설정 (보수적으로 설정하여 만료 전 갱신)
            tokenExpiry = Date.now() + 22 * 60 * 60 * 1000;

            // 토큰 발급 성공 시 실패 기록 리셋
            lastTokenFailureTime = null;

            // 파일에 저장
            saveTokenToFile(token, tokenExpiry);

            console.log("✅ 액세스 토큰 발급 성공 (유효기간: 22시간)");
            return token;
        } catch (error) {
            const axiosError = error as AxiosError;
            console.error("❌ 토큰 발급 실패:", axiosError.response?.data || axiosError.message);

            // 403 에러 (Rate Limit)인 경우 실패 시간 기록
            if (axiosError.response?.status === 403) {
                lastTokenFailureTime = Date.now();
                console.error("⚠️ 토큰 발급 Rate Limit 도달. 61초 후 재시도 가능.");
            }

            cachedToken = null;
            tokenExpiry = null;
            throw error;
        } finally {
            tokenPromise = null;
        }
    })();

    return tokenPromise;
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
            // 실전투자: FHKST01010100, 모의투자: FHPST01710000
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
            // 실전투자: FHKST01010100
            const headers = await getHeaders("CTPF1604R");

            const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/search-info`, {
                headers,
                params: {
                    PRDT_TYPE_CD: "300", // 300: 국내주식
                    PDNO: stockCode, // 종목코드
                },
            });

            // 필요한 정보만 추출하여 반환
            if (response.data.rt_cd === "0" && response.data.output) {
                const output = response.data.output;

                // output 래핑 제거하고 바로 반환
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
            // ETF, 지수 등 필터링
            const filteredOutput = response.data.output
                .filter((stock: VolumeRankStock) => {
                    const name = stock.hts_kor_isnm || "";
                    const code = stock.mksc_shrn_iscd || "";

                    // 종목코드가 6자리 숫자인지 확인
                    const isValidCode = /^\d{6}$/.test(code);

                    // ETF, 지수, 스팩 등 제외
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
                .slice(0, 15); // 상위 15개 (일부 실패 고려)

            // 각 종목의 상세 정보 조회 (종목명 포함) - 5개씩 배치로 처리
            const detailedStocks = await promiseAllWithLimit(
                filteredOutput,
                5, // 한 번에 5개씩 동시 호출
                async (stock: VolumeRankStock) => {
                    try {
                        const detailData = await apiCallWithRetry(() => getStockPrice(stock.mksc_shrn_iscd));

                        // 종목명을 상세 조회에서 가져옴 (prdt_name 필드)
                        return {
                            ...stock,
                            hts_kor_isnm: detailData.output?.prdt_name || stock.hts_kor_isnm || stock.mksc_shrn_iscd,
                        };
                    } catch (error) {
                        console.error(`${stock.mksc_shrn_iscd} 상세 조회 실패:`, error);
                        return stock; // 실패해도 기본 데이터 유지
                    }
                }
            );

            const finalStocks = detailedStocks.slice(0, 10); // 최종 10개만

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

        // 모든 매칭 결과 찾기
        const matches = list.filter((item) => {
            const abbrev = item.ISU_ABBRV?.replace(/\s+/g, "").toLowerCase() || "";
            const fullName = item.ISU_NM?.replace(/\s+/g, "").toLowerCase() || "";
            return abbrev.includes(searchKeyword) || fullName.includes(searchKeyword);
        });

        if (matches.length === 0) {
            return null;
        }

        // 1️⃣ 검색어와 정확히 일치하는 종목 찾기 (최우선)
        const exactMatch = matches.find((item) => {
            const abbrev = item.ISU_ABBRV?.replace(/\s+/g, "").toLowerCase() || "";
            const fullName = item.ISU_NM?.replace(/\s+/g, "").toLowerCase() || "";
            return abbrev === searchKeyword || fullName === searchKeyword;
        });

        if (exactMatch) {
            // 정확히 일치해도 보통주 우선
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

        // 2️⃣ 보통주 우선 선택 (우선주, 신주인수권 등 제외)
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
