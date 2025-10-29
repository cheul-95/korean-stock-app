"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Search } from "lucide-react";
import { PopularStock, GoldPrice } from "@/types/stock";

interface PopularStockData {
    name: string;
    code: string;
    price: string | null;
    change?: string;
    changeRate?: string;
    priceSign?: string;
}

export default function HomePage() {
    const [popularStocks, setPopularStocks] = useState<PopularStockData[]>([]); // 인기 종목 (고정 8개)
    const [volumeStocks, setVolumeStocks] = useState<PopularStock[]>([]); // 거래량 상위 (실시간 10개)
    const [goldPrice, setGoldPrice] = useState<GoldPrice | null>(null);
    const [volumeLoading, setVolumeLoading] = useState(true);
    const [popularLoading, setPopularLoading] = useState(true);
    const [goldLoading, setGoldLoading] = useState(true);
    const [quickSearchCode, setQuickSearchCode] = useState("");
    const router = useRouter();

    useEffect(() => {
        //fetchPopularStocks();
        fetchVolumeStocks();
        fetchGoldPrice();
    }, []);

    // 인기 종목 조회 (고정된 8개 종목의 현재가)
    const fetchPopularStocks = async () => {
        const favoriteCodes = [
            { name: "삼성전자", code: "005930" },
            { name: "SK하이닉스", code: "000660" },
            { name: "NAVER", code: "035420" },
            { name: "카카오", code: "035720" },
            { name: "현대차", code: "005380" },
            { name: "LG에너지솔루션", code: "373220" },
            { name: "삼성바이오로직스", code: "207940" },
            { name: "기아", code: "000270" },
        ];

        try {
            const results = await Promise.all(
                favoriteCodes.map(async (item) => {
                    try {
                        const { data } = await axios.get(`/api/stocks/${item.code}?type=price`);
                        return {
                            name: item.name,
                            code: item.code,
                            price: data.output?.stck_prpr,
                            change: data.output?.prdy_vrss,
                            changeRate: data.output?.prdy_ctrt,
                            priceSign: data.output?.prdy_vrss_sign,
                        };
                    } catch (error) {
                        console.error(`${item.name} 조회 실패:`, error);
                        return {
                            name: item.name,
                            code: item.code,
                            price: null,
                        };
                    }
                })
            );
            setPopularStocks(results);
        } catch (error) {
            console.error("인기 종목 가격 조회 실패:", error);
        } finally {
            setPopularLoading(false);
        }
    };

    // 거래량 상위 종목 조회
    const fetchVolumeStocks = async () => {
        try {
            const { data } = await axios.get("/api/stocks/volumeRank");
            if (data.output && Array.isArray(data.output)) {
                setVolumeStocks(data.output.slice(0, 10));
            } else {
                setVolumeStocks([]);
            }
        } catch (error) {
            console.error("거래량 상위 종목 조회 실패:", error);
            setVolumeStocks([]);
        } finally {
            setVolumeLoading(false);
        }
    };

    const fetchGoldPrice = async () => {
        try {
            const { data } = await axios.get("/api/gold");
            setGoldPrice(data);
        } catch (error) {
            console.error("금시세 조회 실패:", error);
            setGoldPrice(null);
        } finally {
            setGoldLoading(false);
        }
    };

    const handleStockClick = (code: string) => {
        router.push(`/stocks/${code}`);
    };

    const handleQuickSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (quickSearchCode.trim()) {
            router.push(`/stocks/${quickSearchCode.trim()}`);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100">
            {/* 헤더 */}
            <header className="bg-green-600 shadow-lg">
                <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
                                <svg
                                    className="w-8 h-8 text-white"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                                    />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-white tracking-tight">다모아 금융</h1>
                                <p className="text-green-100 text-sm mt-0.5">실시간 주식 정보</p>
                            </div>
                        </div>
                        <form onSubmit={handleQuickSearch} className="w-full md:w-auto md:min-w-[320px]">
                            <h2 className="sr-only">종목 검색</h2>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={quickSearchCode}
                                    onChange={(e) => setQuickSearchCode(e.target.value)}
                                    placeholder="종목코드 입력 (예: 005930)"
                                    className="w-full px-4 py-3 pr-12 bg-white/95 backdrop-blur-sm border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-300 shadow-lg placeholder:text-gray-400"
                                />
                                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-green-600 w-5 h-5 pointer-events-none" />
                            </div>
                        </form>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                {/* 인기 종목 */}
                {/* <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
                    <div>
                        <h3 className="text-lg font-semibold mb-3">인기 종목</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {popularStocks.map((stock) => {
                                const isPriceUp = stock.priceSign === "2" || stock.priceSign === "1";
                                const isPriceDown = stock.priceSign === "5" || stock.priceSign === "4";
                                const priceColor = isPriceUp
                                    ? "text-red-500"
                                    : isPriceDown
                                    ? "text-blue-500"
                                    : "text-gray-900";

                                return (
                                    <button
                                        key={stock.code}
                                        onClick={() => handleStockClick(stock.code)}
                                        className="p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
                                    >
                                        <div className="flex flex-col gap-1">
                                            <div className="font-semibold text-gray-900">{stock.name}</div>
                                            <div className="text-xs text-gray-500">{stock.code}</div>
                                            {stock.price ? (
                                                <>
                                                    <div className={`text-lg font-bold ${priceColor} mt-1`}>
                                                        {parseInt(stock.price).toLocaleString()}원
                                                    </div>
                                                    <div className={`text-xs font-medium ${priceColor}`}>
                                                        {isPriceUp ? "▲" : isPriceDown ? "▼" : "-"}{" "}
                                                        {Math.abs(parseInt(stock.change || "0")).toLocaleString()}{" "}
                                                        {isPriceUp ? "+" : isPriceDown ? "" : ""}
                                                        {parseFloat(stock.changeRate || "0").toFixed(2)}%
                                                    </div>
                                                </>
                                            ) : popularLoading ? (
                                                <div className="text-xs text-gray-400 mt-1">로딩 중...</div>
                                            ) : (
                                                <div className="text-xs text-gray-400 mt-1">-</div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div> */}

                {/* 거래량 상위 종목 */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold">거래량 상위 종목</h2>
                        <button
                            onClick={fetchVolumeStocks}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                            새로고침
                        </button>
                    </div>

                    {volumeLoading ? (
                        <div className="text-center py-12">
                            <div className="text-lg text-gray-600">로딩 중...</div>
                        </div>
                    ) : volumeStocks.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b">
                                        <th className="p-3 text-left font-semibold">종목명</th>
                                        <th className="p-3 text-right font-semibold">현재가</th>
                                        <th className="p-3 text-right font-semibold">전일대비</th>
                                        <th className="p-3 text-right font-semibold">등락률</th>
                                        <th className="p-3 text-right font-semibold">거래량</th>
                                        <th className="p-3 text-right font-semibold">거래대금</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {volumeStocks.map((stock, index) => {
                                        const isPriceUp = stock.prdy_vrss_sign === "2" || stock.prdy_vrss_sign === "1";
                                        const isPriceDown =
                                            stock.prdy_vrss_sign === "5" || stock.prdy_vrss_sign === "4";
                                        const priceColor = isPriceUp
                                            ? "text-red-500"
                                            : isPriceDown
                                            ? "text-blue-500"
                                            : "text-gray-900";

                                        return (
                                            <tr
                                                key={index}
                                                onClick={() => handleStockClick(stock.mksc_shrn_iscd)}
                                                className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                                            >
                                                <td className="p-3">
                                                    <div>
                                                        <div className="font-semibold">{stock.hts_kor_isnm}</div>
                                                        <div className="text-sm text-gray-500">
                                                            {stock.mksc_shrn_iscd}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className={`p-3 text-right font-semibold ${priceColor}`}>
                                                    {parseInt(stock.stck_prpr).toLocaleString()}
                                                </td>
                                                <td className={`p-3 text-right font-semibold ${priceColor}`}>
                                                    {isPriceUp ? "+" : isPriceDown ? "" : ""}
                                                    {Math.abs(parseInt(stock.prdy_vrss)).toLocaleString()}
                                                </td>
                                                <td className={`p-3 text-right font-semibold ${priceColor}`}>
                                                    {isPriceUp ? "+" : isPriceDown ? "" : ""}
                                                    {parseFloat(stock.prdy_ctrt).toFixed(2)}%
                                                </td>
                                                <td className="p-3 text-right">
                                                    {parseInt(stock.acml_vol).toLocaleString()}
                                                </td>
                                                <td className="p-3 text-right">
                                                    {(parseInt(stock.acml_tr_pbmn) / 100000000).toFixed(0)}억
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <div className="text-lg text-gray-600">데이터를 불러올 수 없습니다</div>
                        </div>
                    )}
                </div>

                {/* 금시세 */}
                <div className="mt-8 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg shadow-lg p-6 border border-yellow-200">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <div className="bg-yellow-500 p-2 rounded-lg">
                                <svg
                                    className="w-6 h-6 text-white"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900">국제 금시세</h2>
                        </div>
                        <button
                            onClick={fetchGoldPrice}
                            className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors shadow-md"
                        >
                            새로고침
                        </button>
                    </div>

                    {goldLoading ? (
                        <div className="text-center py-12">
                            <div className="text-lg text-gray-600">로딩 중...</div>
                        </div>
                    ) : goldPrice?.success && goldPrice?.data ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white rounded-xl p-6 shadow-md border border-yellow-100">
                                    <div className="text-sm text-gray-600 mb-2">그램당 가격 (1g)</div>
                                    <div className="flex items-end gap-2">
                                        <span className="text-3xl font-bold text-yellow-600">
                                            {goldPrice.data.goldPricePerGram.toLocaleString()}
                                        </span>
                                        <span className="text-lg text-gray-600 mb-1">원</span>
                                    </div>
                                </div>

                                <div className="bg-white rounded-xl p-6 shadow-md border border-yellow-100">
                                    <div className="text-sm text-gray-600 mb-2">돈 가격 (3.75g)</div>
                                    <div className="flex items-end gap-2">
                                        <span className="text-3xl font-bold text-orange-600">
                                            {goldPrice.data.goldPricePerDon.toLocaleString()}
                                        </span>
                                        <span className="text-lg text-gray-600 mb-1">원</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-white/70 rounded-lg p-4">
                                    <div className="text-xs text-gray-600 mb-1">온스당 (원)</div>
                                    <div className="text-lg font-semibold text-gray-900">
                                        {goldPrice.data.pricePerOunce.toLocaleString()}
                                    </div>
                                </div>

                                <div className="bg-white/70 rounded-lg p-4">
                                    <div className="text-xs text-gray-600 mb-1">국제 시세</div>
                                    <div className="text-lg font-semibold text-gray-900">
                                        ${goldPrice.data.goldPriceUSD.toLocaleString()}
                                    </div>
                                </div>

                                <div className="bg-white/70 rounded-lg p-4">
                                    <div className="text-xs text-gray-600 mb-1">환율</div>
                                    <div className="text-lg font-semibold text-gray-900">
                                        {goldPrice.data.exchangeRate.toLocaleString()}원
                                    </div>
                                </div>

                                <div className="bg-white/70 rounded-lg p-4">
                                    <div className="text-xs text-gray-600 mb-1">출처</div>
                                    <div className="text-sm font-medium text-gray-900">{goldPrice.data.source}</div>
                                </div>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <p className="text-sm text-amber-800">
                                    💡 국제 금 시세 기준으로 실시간 환율을 적용한 가격입니다. 실제 구매/판매 시 수수료가
                                    추가될 수 있습니다.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <div className="text-lg text-gray-600">금시세 정보를 불러올 수 없습니다</div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
