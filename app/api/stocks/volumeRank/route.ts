import { NextResponse } from "next/server";
import { getVolumeRankStocks } from "@/lib/api/kisApi";

export async function GET() {
    try {
        const data = await getVolumeRankStocks();

        return NextResponse.json(data);
    } catch (error) {
        const axiosError = error as import("axios").AxiosError;
        const status = axiosError.response?.status;
        console.error("=== API 에러 ===", { status, message: (error as Error).message });

        const is403 = status === 403;
        const message = is403
            ? "KIS API 권한 없음(403). APP_KEY·APP_SECRET·IP 허용 목록을 확인하세요."
            : error instanceof Error
              ? error.message
              : "Unknown error";

        return NextResponse.json({ error: "API 호출 실패", message }, { status: is403 ? 403 : 500 });
    }
}

export const dynamic = "force-dynamic";
