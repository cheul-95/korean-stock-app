import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/api/kisApi";

// 토큰 워밍업 API - 페이지 로드 전에 토큰을 미리 준비
export async function GET() {
    try {
        // Redis에 토큰이 없으면 발급, 있으면 재사용
        const token = await getAccessToken();

        return NextResponse.json({
            success: true,
            message: "토큰 준비 완료",
            hasToken: !!token,
        });
    } catch (error) {
        const axiosError = error as import("axios").AxiosError;
        const status = axiosError.response?.status;
        console.error("❌ 토큰 워밍업 실패:", error);
        const is403 = status === 403;
        const errorMessage = is403
            ? "KIS API 권한 없음(403). APP_KEY·APP_SECRET·IP 허용 목록을 확인하세요."
            : error instanceof Error
              ? error.message
              : "토큰 준비 실패";
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: is403 ? 403 : 500 }
        );
    }
}

export const dynamic = "force-dynamic";
