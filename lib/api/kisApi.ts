import axios, { AxiosError } from "axios";
import Redis from "ioredis";

const KIS_BASE_URL = "https://openapi.koreainvestment.com:9443";

// KIS API 에러 응답 타입
interface KISErrorResponse {
    error_description?: string;
    error_code?: string;
}

// Redis 클라이언트 초기화
let redis: Redis | null = null;

const getRedisClient = () => {
    if (!redis && process.env.REDIS_URL) {
        redis = new Redis(process.env.REDIS_URL, {
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => {
                if (times > 3) return null;
                return Math.min(times * 200, 1000);
            },
        });

        redis.on("error", (err) => {
            console.error("Redis 연결 에러:", err);
        });
    }
    return redis;
};

// Redis 키
const TOKEN_CACHE_KEY = "kis_access_token";
const TOKEN_EXPIRY_KEY = "kis_token_expiry";
const TOKEN_LOCK_KEY = "kis_token_lock";

// API 호출 제한 설정
const API_CALL_DELAY = 300;
let lastApiCallTime = 0;

const waitForRateLimit = async () => {
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCallTime;

    if (timeSinceLastCall < API_CALL_DELAY) {
        const waitTime = API_CALL_DELAY - timeSinceLastCall;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    lastApiCallTime = Date.now();
};

const promiseAllWithLimit = async <T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> => {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += limit) {
        const batch = items.slice(i, i + limit);
        const batchResults = await Promise.all(batch.map(fn));
        results.push(...batchResults);

        if (i + limit < items.length) {
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }

    return results;
};

const apiCallWithRetry = async <T>(fn: () => Promise<T>, maxRetries = 2, delayMs = 3000): Promise<T> => {
    let lastError: Error | undefined;

    for (let i = 0; i < maxRetries; i++) {
        try {
            await waitForRateLimit();
            return await fn();
        } catch (error) {
            lastError = error as Error;
            const axiosError = error as AxiosError<KISErrorResponse>;

            if (axiosError.response?.data?.error_code === "EGW00133") {
                const redisClient = getRedisClient();
                if (redisClient) {
                    await redisClient.del(TOKEN_CACHE_KEY);
                    await redisClient.del(TOKEN_EXPIRY_KEY);
                    await redisClient.del(TOKEN_LOCK_KEY);
                }

                if (i < maxRetries - 1) {
                    await new Promise((resolve) => setTimeout(resolve, 70000));
                }
                continue;
            }

            if (axiosError.response?.status === 429) {
                const waitTime = delayMs * (i + 1);
                await new Promise((resolve) => setTimeout(resolve, waitTime));
            } else if (i < maxRetries - 1) {
                const waitTime = delayMs * Math.pow(2, i);
                await new Promise((resolve) => setTimeout(resolve, waitTime));
            }
        }
    }

    throw lastError;
};

// Redis 기반 토큰 관리
export const getAccessToken = async (): Promise<string> => {
    const redisClient = getRedisClient();

    try {
        if (redisClient) {
            // 1. Redis에서 캐시된 토큰 확인
            const cachedToken = await redisClient.get(TOKEN_CACHE_KEY);
            const tokenExpiry = await redisClient.get(TOKEN_EXPIRY_KEY);

            if (cachedToken && tokenExpiry && Date.now() < parseInt(tokenExpiry)) {
                return cachedToken;
            }

            // 2. 분산 락으로 중복 토큰 발급 방지
            const lockAcquired = await redisClient.set(TOKEN_LOCK_KEY, "locked", "EX", 10, "NX");

            if (!lockAcquired) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                return getAccessToken();
            }

            try {
                // 3. 토큰 발급

                if (!process.env.KIS_APP_KEY || !process.env.KIS_APP_SECRET) {
                    throw new Error("환경변수 미설정: KIS_APP_KEY, KIS_APP_SECRET");
                }

                const response = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
                    grant_type: "client_credentials",
                    appkey: process.env.KIS_APP_KEY,
                    appsecret: process.env.KIS_APP_SECRET,
                });

                const token = response.data.access_token;
                if (!token) {
                    throw new Error("토큰 없음");
                }

                // 4. Redis에 토큰 저장 (5분 유효)
                const expiry = Date.now() + 5 * 60 * 1000;
                await redisClient.set(TOKEN_CACHE_KEY, token, "EX", 300);
                await redisClient.set(TOKEN_EXPIRY_KEY, expiry.toString(), "EX", 300);

                return token;
            } finally {
                await redisClient.del(TOKEN_LOCK_KEY);
            }
        } else {
            // Redis 없으면 매번 새로 발급 (fallback)
            if (!process.env.KIS_APP_KEY || !process.env.KIS_APP_SECRET) {
                throw new Error("환경변수 미설정");
            }

            const response = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
                grant_type: "client_credentials",
                appkey: process.env.KIS_APP_KEY,
                appsecret: process.env.KIS_APP_SECRET,
            });

            const token = response.data.access_token;
            if (!token) {
                throw new Error("토큰 없음");
            }

            return token;
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
        throw new Error("환경변수 미설정");
    }

    return {
        "Content-Type": "application/json",
        authorization: `Bearer ${token}`,
        appkey: process.env.KIS_APP_KEY,
        appsecret: process.env.KIS_APP_SECRET,
        tr_id: trId,
    };
};

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
            throw error;
        }
    });
};

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
            throw error;
        }
    });
};

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
                    .slice(0, 10);

                const detailedStocks = await promiseAllWithLimit(
                    filteredOutput,
                    10, // 2개씩만 동시 호출
                    async (stock: VolumeRankStock) => {
                        try {
                            const detailData = await apiCallWithRetry(() => getStockPrice(stock.mksc_shrn_iscd));
                            return {
                                ...stock,
                                hts_kor_isnm:
                                    detailData.output?.prdt_name || stock.hts_kor_isnm || stock.mksc_shrn_iscd,
                            };
                        } catch (error) {
                            console.error(`${stock.mksc_shrn_iscd} 실패:`, error);
                            return stock;
                        }
                    }
                );

                return {
                    rt_cd: "0",
                    msg_cd: "SUCCESS",
                    msg1: "정상처리",
                    output: detailedStocks.slice(0, 10),
                };
            }

            return response.data;
        } catch (error) {
            console.error("❌ 거래량 조회 실패:", error);
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
            console.error("호가 정보 실패:", error);
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
            console.error("일별 시세 실패:", error);
            throw error;
        }
    });
};

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
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "X-Requested-With": "XMLHttpRequest",
            },
            body: new URLSearchParams({
                bld: "dbms/MDC/STAT/standard/MDCSTAT01901",
                locale: "ko_KR",
                mktId: "ALL",
            }),
        });

        if (!response.ok) {
            throw new Error(`KRX API status: ${response.status}`);
        }

        const data: KRXResponse = await response.json();
        const list = data?.OutBlock_1 || [];
        const searchKeyword = keyword.replace(/\s+/g, "").toLowerCase();

        const matches = list.filter((item) => {
            const abbrev = item.ISU_ABBRV?.replace(/\s+/g, "").toLowerCase() || "";
            const fullName = item.ISU_NM?.replace(/\s+/g, "").toLowerCase() || "";
            return abbrev.includes(searchKeyword) || fullName.includes(searchKeyword);
        });

        if (matches.length === 0) return null;

        const exactMatch = matches.find((item) => {
            const abbrev = item.ISU_ABBRV?.replace(/\s+/g, "").toLowerCase() || "";
            const fullName = item.ISU_NM?.replace(/\s+/g, "").toLowerCase() || "";
            return abbrev === searchKeyword || fullName === searchKeyword;
        });

        if (exactMatch && !exactMatch.ISU_ABBRV.includes("우") && !exactMatch.ISU_ABBRV.includes("스팩")) {
            return {
                code: exactMatch.ISU_SRT_CD,
                name: exactMatch.ISU_ABBRV,
                market: exactMatch.MKT_TP_NM,
                fullName: exactMatch.ISU_NM,
                listDate: exactMatch.LIST_DD,
            };
        }

        const found =
            matches.find((item) => {
                const stockName = item.ISU_ABBRV || item.ISU_NM;
                return !stockName.includes("우") && !stockName.includes("스팩");
            }) || matches[0];

        return {
            code: found.ISU_SRT_CD,
            name: found.ISU_ABBRV,
            market: found.MKT_TP_NM,
            fullName: found.ISU_NM,
            listDate: found.LIST_DD,
        };
    } catch (error) {
        console.error("❌ KRX 검색 실패:", (error as Error).message);
        throw error;
    }
};
