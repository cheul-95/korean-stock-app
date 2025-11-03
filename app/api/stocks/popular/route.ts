import { NextResponse } from "next/server";
import { getStockPrice } from "@/lib/api/kisApi";

// 인기 종목 데이터 타입
interface PopularStock {
    name: string;
    code: string;
    price: string | null;
    change?: string;
    changeRate?: string;
    priceSign?: string;
}

// 인기 종목 캐시
interface CachedPopularStocks {
    data: PopularStock[];
    timestamp: number;
}

let popularStocksCache: CachedPopularStocks | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5분 캐싱

const favoriteCodes = [
    { name: "삼성전자", code: "005930" },
    { name: "SK하이닉스", code: "000660" },
    { name: "NAVER", code: "035420" },
    { name: "카카오", code: "035720" },
    { name: "현대차", code: "005380" },
    { name: "LG에너지솔루션", code: "373220" },
    { name: "삼성바이오로직스", code: "207940" },
    { name: "기아", code: "000270" },
];

export async function GET() {
    try {
        // 캐시 확인
        const now = Date.now();
        if (popularStocksCache && now - popularStocksCache.timestamp < CACHE_DURATION) {
            console.log("✅ 인기종목 캐시 사용");
            return NextResponse.json({
                success: true,
                data: popularStocksCache.data,
                cached: true,
            });
        }

        console.log("🔄 인기종목 새로 조회");

        // 순차적으로 조회 (rate limit 방지)
        const results = [];
        for (const item of favoriteCodes) {
            try {
                const data = await getStockPrice(item.code);
                results.push({
                    name: item.name,
                    code: item.code,
                    price: data.output?.stck_prpr,
                    change: data.output?.prdy_vrss,
                    changeRate: data.output?.prdy_ctrt,
                    priceSign: data.output?.prdy_vrss_sign,
                });
            } catch (error) {
                console.error(`${item.name} 조회 실패:`, error);
                results.push({
                    name: item.name,
                    code: item.code,
                    price: null,
                });
            }
        }

        // 캐시 저장
        popularStocksCache = {
            data: results,
            timestamp: now,
        };

        return NextResponse.json({
            success: true,
            data: results,
            cached: false,
        });
    } catch (error) {
        console.error("인기 종목 조회 실패:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "인기 종목 데이터를 가져오는데 실패했습니다",
            },
            { status: 500 }
        );
    }
}
