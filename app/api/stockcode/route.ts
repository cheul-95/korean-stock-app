// app/api/stockcode/route.ts
import { NextResponse } from "next/server";

interface KRXStockItem {
    ISU_CD: string;
    ISU_SRT_CD: string;
    ISU_NM: string;
    ISU_ABBRV: string;
    ISU_ENG_NM: string;
    LIST_DD: string;
    MKT_TP_NM: string;
}

interface KRXResponse {
    OutBlock_1?: KRXStockItem[];
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name")?.trim();

    if (!name) {
        return NextResponse.json({ error: "종목명을 입력해주세요." }, { status: 400 });
    }

    try {
        const response = await fetch("http://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd", {
            method: "POST",
            headers: {
                Accept: "application/json, text/javascript, */*; q=0.01",
                "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                Origin: "http://data.krx.co.kr",
                Referer: "http://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201",
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "X-Requested-With": "XMLHttpRequest",
            },
            body: new URLSearchParams({
                bld: "dbms/MDC/STAT/standard/MDCSTAT01901",
                locale: "ko_KR",
                mktId: "ALL",
            }),
        });

        if (!response.ok) {
            throw new Error(`KRX API responded with status: ${response.status}`);
        }

        const data: KRXResponse = await response.json();
        const list = data?.OutBlock_1 || [];

        const keyword = name.replace(/\s+/g, "").toLowerCase();

        // ✅ 모든 매칭 결과 찾기
        const matches = list.filter((item) => {
            const abbrev = item.ISU_ABBRV?.replace(/\s+/g, "").toLowerCase() || "";
            const fullName = item.ISU_NM?.replace(/\s+/g, "").toLowerCase() || "";
            return abbrev.includes(keyword) || fullName.includes(keyword);
        });

        if (matches.length === 0) {
            return NextResponse.json(
                {
                    error: "해당 종목을 찾을 수 없습니다. 정확한 종목코드 또는 종목명을 입력해주세요.",
                    searchTerm: name,
                },
                { status: 404 }
            );
        }

        // ✅ 보통주 우선 선택 (우선주, 신주인수권 등 제외)
        const found =
            matches.find((item) => {
                const name = item.ISU_ABBRV || item.ISU_NM;
                return (
                    !name.includes("우") &&
                    !name.includes("1우") &&
                    !name.includes("2우") &&
                    !name.includes("신주") &&
                    !name.includes("스팩")
                );
            }) || matches[0]; // 보통주가 없으면 첫 번째 결과 반환

        return NextResponse.json({
            name: found.ISU_ABBRV,
            code: found.ISU_SRT_CD,
            fullName: found.ISU_NM,
            market: found.MKT_TP_NM,
            listDate: found.LIST_DD,
        });
    } catch (e) {
        console.error("KRX API Error:", e);
        return NextResponse.json(
            {
                error: "KRX API 요청 실패",
                details: e instanceof Error ? e.message : String(e),
            },
            { status: 500 }
        );
    }
}
