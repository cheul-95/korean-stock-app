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
        const status = axiosError.response?.status;
        const kisResponse = axiosError.response?.data;
        console.error("API 오류:", { status, kisError: kisResponse, message: (error as Error).message });

        const is403 = status === 403;
        const errorMessage = is403
            ? "KIS API 권한 없음(403). APP_KEY·APP_SECRET·IP 허용 목록을 확인하세요."
            : error instanceof Error
              ? error.message
              : "주식 데이터를 가져오는데 실패했습니다";

        return NextResponse.json(
            { error: errorMessage, kisError: kisResponse },
            { status: is403 ? 403 : 500 }
        );
    }
}
