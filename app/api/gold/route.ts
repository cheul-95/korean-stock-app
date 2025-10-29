import { NextResponse } from "next/server";

// 금 시세 조회 (국제 금 시세만 사용)
export async function GET() {
    try {
        // 국제 금 시세 (USD/온스)
        const goldResponse = await fetch("https://data-asg.goldprice.org/dbXRates/USD", {
            next: { revalidate: 60 },
        });

        if (!goldResponse.ok) {
            throw new Error(`금 시세 API 응답 오류: ${goldResponse.status}`);
        }

        const goldData = await goldResponse.json();
        const goldPriceUSD = goldData.items?.[0]?.xauPrice;

        if (!goldPriceUSD) {
            throw new Error("금 시세 데이터 없음");
        }

        // 환율 조회
        let usdToKrw: number | null = null;

        try {
            const exchangeResponse = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
            const exchangeData = await exchangeResponse.json();
            usdToKrw = exchangeData.rates?.KRW;
        } catch {
            usdToKrw = 1380;
        }

        if (!usdToKrw) {
            usdToKrw = 1380;
        }

        // 계산: USD/온스 -> 원/그램
        // 1 온스 = 31.1035 그램
        const pricePerGram = (goldPriceUSD / 31.1035) * usdToKrw;
        const pricePerOunce = goldPriceUSD * usdToKrw;
        const pricePerDon = pricePerGram * 3.75; // 1돈 = 3.75g

        return NextResponse.json({
            success: true,
            data: {
                goldPricePerGram: Math.round(pricePerGram),
                goldPricePerDon: Math.round(pricePerDon),
                pricePerOunce: Math.round(pricePerOunce),
                goldPriceUSD: Math.round(goldPriceUSD),
                exchangeRate: Math.round(usdToKrw),
                unit: "원/g",
                source: "국제 금 시세 (GoldPrice.org)",
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error("=== 금 시세 조회 오류 ===", error);

        return NextResponse.json(
            {
                error: "금 시세 조회 실패",
                message: error instanceof Error ? error.message : "알 수 없는 오류",
            },
            { status: 500 }
        );
    }
}
