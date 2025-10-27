"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Search } from "lucide-react";
import { StockPrice, AskingPrice, DailyPrice, StockInfo } from "@/types/stock";
import StockChart from "@/components/StockChart";
import AskingPriceTable from "@/components/AskingPriceTable";

export default function StockDetailPage({ params }: { params: Promise<{ code: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const [stockData, setStockData] = useState<StockPrice | null>(null);
    const [infoRes, setInfoData] = useState<StockInfo | null>(null);
    const [askingData, setAskingData] = useState<AskingPrice | null>(null);
    const [dailyData, setDailyData] = useState<DailyPrice | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [quickSearchCode, setQuickSearchCode] = useState("");
    const [isSearching, setIsSearching] = useState(false);

    const handleQuickSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (quickSearchCode.trim()) {
            router.push(`/stocks/${quickSearchCode.trim()}`);
        }
    };

    // 종목명으로 코드 검색하는 함수
    const searchStockCode = useCallback(
        async (searchTerm: string) => {
            try {
                setIsSearching(true);
                setLoading(true);

                // API로 종목명 검색
                const response = await axios.get(`/api/stocks/search?q=${encodeURIComponent(searchTerm)}`);

                if (response.data && response.data.code) {
                    // 찾은 종목코드로 리다이렉트
                    router.replace(`/stocks/${response.data.code}`);
                } else {
                    setError(`"${searchTerm}" 종목을 찾을 수 없습니다. 정확한 종목코드 또는 종목명을 입력해주세요.`);
                    setLoading(false);
                    setIsSearching(false);
                }
            } catch (err: any) {
                console.error("종목 검색 실패:", err);
                setError(
                    err.response?.data?.error ||
                        `"${searchTerm}" 종목을 찾을 수 없습니다. 정확한 종목코드 또는 종목명을 입력해주세요.`
                );
                setMessage(err.response?.data?.message || null);
                setLoading(false);
                setIsSearching(false);
            }
        },
        [router]
    );

    // 코드 유효성 검사 및 처리
    useEffect(() => {
        if (resolvedParams.code === undefined) {
            router.push(`/`);
            return;
        }

        if (typeof resolvedParams.code === "string") {
            // URL 디코딩 먼저 수행
            const decodedCode = decodeURIComponent(resolvedParams.code);
            const isNumericCode = /^\d{6}$/.test(decodedCode);

            if (!isNumericCode) {
                // 숫자가 아니면 종목명으로 간주하고 검색
                searchStockCode(decodedCode);
                return;
            }
        }
    }, [resolvedParams.code, router, searchStockCode]);

    const fetchStockData = useCallback(async () => {
        // URL 디코딩
        const decodedCode = decodeURIComponent(resolvedParams.code);

        // 숫자 코드가 아니면 데이터 fetch 하지 않음
        if (!/^\d{6}$/.test(decodedCode)) {
            return;
        }

        try {
            const [priceRes, askingRes, dailyRes, infoRes] = await Promise.all([
                axios.get(`/api/stocks/${decodedCode}?type=price`),
                axios.get(`/api/stocks/${decodedCode}?type=asking`),
                axios.get(`/api/stocks/${decodedCode}?type=daily`),
                axios.get(`/api/stocks/${decodedCode}?type=info`),
            ]);

            setStockData(priceRes.data);
            setAskingData(askingRes.data);
            setDailyData(dailyRes.data);
            setInfoData(infoRes.data);
            setError(null);
        } catch (err: any) {
            setMessage(err.response?.data?.message || null);
            setError(err.response?.data?.error || "데이터를 불러오는데 실패했습니다");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [resolvedParams.code]);

    useEffect(() => {
        const decodedCode = decodeURIComponent(resolvedParams.code);

        // 숫자 코드일 때만 데이터 fetch
        if (/^\d{6}$/.test(decodedCode) && !isSearching) {
            fetchStockData();
        }
    }, [fetchStockData, resolvedParams.code, isSearching]);

    // 자동 새로고침 (5초마다)
    useEffect(() => {
        const decodedCode = decodeURIComponent(resolvedParams.code);

        if (!autoRefresh || !/^\d{6}$/.test(decodedCode) || isSearching) return;

        const interval = setInterval(() => {
            fetchStockData();
        }, 5000);

        return () => clearInterval(interval);
    }, [autoRefresh, fetchStockData, resolvedParams.code, isSearching]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-xl">{isSearching ? "종목 검색 중..." : "로딩 중..."}</div>
            </div>
        );
    }

    if (error || !stockData) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4">
                <div className="text-xl text-red-500">{error || "데이터를 불러올 수 없습니다"}</div>
                <div className="text-xl text-red-500">{message}</div>
                <button
                    onClick={() => router.push("/")}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                    홈으로 돌아가기
                </button>
            </div>
        );
    }

    const { output } = stockData;
    const isPriceUp = output.prdy_vrss_sign === "2" || output.prdy_vrss_sign === "1";
    const isPriceDown = output.prdy_vrss_sign === "5" || output.prdy_vrss_sign === "4";

    const priceColor = isPriceUp ? "text-red-500" : isPriceDown ? "text-blue-500" : "text-gray-900";
    const bgColor = isPriceUp ? "bg-red-50" : isPriceDown ? "bg-blue-50" : "bg-gray-50";

    return (
        <div className="min-h-screen bg-gray-100">
            {/* 헤더 */}
            <header className="bg-green-600 shadow-lg ">
                <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 mx-auto">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <a href="/" className="flex items-center gap-3 w-full md:w-auto">
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
                        </a>
                        <form onSubmit={handleQuickSearch} className="w-full md:w-auto md:min-w-[320px]">
                            <h2 className="sr-only">종목 검색</h2>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={quickSearchCode}
                                    onChange={(e) => setQuickSearchCode(e.target.value)}
                                    placeholder="종목코드 또는 종목명 (예: 005930 또는 삼성전자)"
                                    className="w-full px-4 py-3 pr-12 bg-white/95 backdrop-blur-sm border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-300 shadow-lg placeholder:text-gray-400"
                                />
                                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-green-600 w-5 h-5 pointer-events-none" />
                            </div>
                        </form>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
                {/* 헤더 */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h1 className="text-3xl font-bold mb-2">{infoRes?.stockName || "로딩중..."}</h1>
                            <p className="text-gray-600">
                                {decodeURIComponent(resolvedParams.code)}
                                {infoRes?.marketType && ` | ${infoRes.marketType}`}
                                {infoRes?.sectorName && ` | ${infoRes.sectorName}`}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setAutoRefresh(!autoRefresh)}
                                className={`px-4 py-2 rounded-lg transition-colors ${
                                    autoRefresh ? "bg-green-500 text-white" : "bg-gray-300 text-gray-700"
                                }`}
                            >
                                {autoRefresh ? "자동새로고침 ON" : "자동새로고침 OFF"}
                            </button>
                            <button
                                onClick={fetchStockData}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                                새로고침
                            </button>
                        </div>
                    </div>

                    {/* 현재가 정보 */}
                    <div className={`${bgColor} rounded-lg p-6`}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <p className="text-gray-600 mb-1">현재가</p>
                                <p className={`text-4xl font-bold ${priceColor}`}>
                                    {parseInt(output.stck_prpr).toLocaleString()}원
                                </p>
                            </div>
                            <div>
                                <p className="text-gray-600 mb-1">전일 대비</p>
                                <p className={`text-3xl font-bold ${priceColor}`}>
                                    {isPriceUp ? "+" : isPriceDown ? "-" : ""}
                                    {Math.abs(parseInt(output.prdy_vrss)).toLocaleString()}원
                                </p>
                            </div>
                            <div>
                                <p className="text-gray-600 mb-1">등락률</p>
                                <p className={`text-3xl font-bold ${priceColor}`}>
                                    {isPriceUp ? "+" : isPriceDown ? "" : ""}
                                    {parseFloat(output.prdy_ctrt).toFixed(2)}%
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 가격 정보 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg shadow p-4">
                        <p className="text-gray-600 text-sm mb-1">시가</p>
                        <p className="text-xl font-bold">{parseInt(output.stck_oprc).toLocaleString()}원</p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <p className="text-gray-600 text-sm mb-1">고가</p>
                        <p className="text-xl font-bold text-red-500">
                            {parseInt(output.stck_hgpr).toLocaleString()}원
                        </p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <p className="text-gray-600 text-sm mb-1">저가</p>
                        <p className="text-xl font-bold text-blue-500">
                            {parseInt(output.stck_lwpr).toLocaleString()}원
                        </p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <p className="text-gray-600 text-sm mb-1">거래량</p>
                        <p className="text-xl font-bold">{parseInt(output.acml_vol).toLocaleString()}</p>
                    </div>
                </div>

                {/* 추가 정보 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg shadow p-4">
                        <p className="text-gray-600 text-sm mb-1">거래대금</p>
                        <p className="text-lg font-semibold">
                            {(parseInt(output.acml_tr_pbmn) / 100000000).toFixed(0)}억원
                        </p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <p className="text-gray-600 text-sm mb-1">외국인 소진율</p>
                        <p className="text-lg font-semibold">{parseInt(output.hts_frgn_ehrt).toLocaleString()}%</p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <p className="text-gray-600 text-sm mb-1">52주 최고</p>
                        <p className="text-lg font-semibold text-red-500">
                            {parseInt(output.w52_hgpr).toLocaleString()}원
                        </p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <p className="text-gray-600 text-sm mb-1">52주 최저</p>
                        <p className="text-lg font-semibold text-blue-500">
                            {parseInt(output.w52_lwpr).toLocaleString()}원
                        </p>
                    </div>
                </div>

                {/* 호가 정보 */}
                {askingData && <AskingPriceTable data={askingData} />}

                {/* 차트 */}
                {dailyData && <StockChart data={dailyData} />}
            </div>
        </div>
    );
}
