import { NextResponse } from "next/server";
import { getVolumeRankStocks } from "@/lib/api/kisApi";

export async function GET() {
    try {
        const data = await getVolumeRankStocks();

        return NextResponse.json(data);
    } catch (error) {
        console.error("=== API 에러 ===");
        console.error("에러:", error instanceof Error ? error.message : "Unknown error");
        console.error("상세:", error);

        return NextResponse.json(
            {
                error: "API 호출 실패",
                message: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

export const dynamic = "force-dynamic";
