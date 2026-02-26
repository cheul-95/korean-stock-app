import { NextRequest, NextResponse } from "next/server";
import { getStockPrice, getStockAskingPrice, getStockDailyPrice, getStockInfo } from "@/lib/api/kisApi";

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
    const resolvedParams = await params;
    const { code } = resolvedParams;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "price";

    try {
        let data;

        switch (type) {
            case "price":
                data = await getStockPrice(code);
                break;
            case "asking":
                data = await getStockAskingPrice(code);
                break;
            case "daily":
                data = await getStockDailyPrice(code);
                break;
            case "info":
                data = await getStockInfo(code);
                break;
            default:
                return NextResponse.json({ error: "잘못된 타입입니다" }, { status: 400 });
        }

        return NextResponse.json(data);
    } catch (error) {
        const axiosError = error as import("axios").AxiosError;
        const kisResponse = axiosError.response?.data;
        console.error("API 오류:", {
            status: axiosError.response?.status,
            kisError: kisResponse, // KIS API 실제 에러 응답 (Vercel 로그에서 확인)
            message: (error as Error).message,
        });
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "주식 데이터를 가져오는데 실패했습니다",
                kisError: kisResponse,
            },
            { status: 500 }
        );
    }
}
