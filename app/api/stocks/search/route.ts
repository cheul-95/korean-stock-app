import { NextRequest, NextResponse } from "next/server";
import { searchStockByName } from "@/lib/api/kisApi";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");

    if (!query) {
        return NextResponse.json({ error: "검색어를 입력해주세요" }, { status: 400 });
    }
    try {
        const result = await searchStockByName(query.trim());

        if (result && result.code) {
            return NextResponse.json({
                code: result.code,
                name: result.name,
                market: result.market,
            });
        }

        return NextResponse.json(
            {
                error: `"${query}" 종목을 찾을 수 없습니다.`,
                message: "정확한 종목코드 또는 종목명을 입력해주세요.",
            },
            { status: 404 }
        );
    } catch (error) {
        const err = error as Error;
        console.error(err.message);

        return NextResponse.json(
            {
                error: err.message || "종목 검색 중 오류가 발생했습니다",
            },
            { status: 500 }
        );
    }
}
