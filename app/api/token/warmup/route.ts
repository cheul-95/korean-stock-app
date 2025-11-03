import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/api/kisApi";

// 토큰 워밍업 API - 페이지 로드 전에 토큰을 미리 준비
export async function GET() {
    try {
        console.log("🔥 토큰 워밍업 시작");

        // Redis에 토큰이 없으면 발급, 있으면 재사용
        const token = await getAccessToken();

        return NextResponse.json({
            success: true,
            message: "토큰 준비 완료",
            hasToken: !!token,
        });
    } catch (error) {
        console.error("❌ 토큰 워밍업 실패:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "토큰 준비 실패",
            },
            { status: 500 }
        );
    }
}

export const dynamic = "force-dynamic";
