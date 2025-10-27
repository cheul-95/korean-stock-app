import { NextResponse } from "next/server";
import { getVolumeRankStocks } from "@/lib/api/kisApi";

export async function GET() {
    try {
        const data = await getVolumeRankStocks();

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("=== API 에러 ===");
        console.error("에러:", error.message);
        console.error("상세:", error.response?.data);

        return NextResponse.json(
            {
                error: "API 호출 실패",
                message: error.message,
                details: error.response?.data,
            },
            { status: 500 }
        );
    }
}

export const dynamic = "force-dynamic";
