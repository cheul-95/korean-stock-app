"use client";

import { DailyPrice } from "@/types/stock";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    BarChart,
    Bar,
} from "recharts";

interface StockChartProps {
    data: DailyPrice;
}

export default function StockChart({ data }: StockChartProps) {
    const chartData = data.output
        .slice(0, 30)
        .reverse()
        .map((item) => ({
            date: `${item.stck_bsop_date.slice(4, 6)}/${item.stck_bsop_date.slice(6, 8)}`,
            close: parseInt(item.stck_clpr),
            open: parseInt(item.stck_oprc),
            high: parseInt(item.stck_hgpr),
            low: parseInt(item.stck_lwpr),
            volume: parseInt(item.acml_vol),
        }));

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white p-4 border border-gray-300 rounded shadow-lg">
                    <p className="font-bold mb-2">{data.date}</p>
                    <p className="text-sm">시가: {data.open.toLocaleString()}원</p>
                    <p className="text-sm">고가: {data.high.toLocaleString()}원</p>
                    <p className="text-sm">저가: {data.low.toLocaleString()}원</p>
                    <p className="text-sm">종가: {data.close.toLocaleString()}원</p>
                    <p className="text-sm">거래량: {data.volume.toLocaleString()}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">일별 차트 (최근 30일)</h2>

            {/* 가격 차트 */}
            <div className="mb-8">
                <h3 className="text-lg font-semibold mb-2">가격 추이</h3>
                <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis domain={["auto", "auto"]} tickFormatter={(value) => value.toLocaleString()} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Line
                            type="monotone"
                            dataKey="close"
                            stroke="#8884d8"
                            name="종가"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                        />
                        <Line
                            type="monotone"
                            dataKey="high"
                            stroke="#ef4444"
                            name="고가"
                            strokeWidth={1}
                            strokeDasharray="5 5"
                        />
                        <Line
                            type="monotone"
                            dataKey="low"
                            stroke="#3b82f6"
                            name="저가"
                            strokeWidth={1}
                            strokeDasharray="5 5"
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* 거래량 차트 */}
            <div>
                <h3 className="text-lg font-semibold mb-2">거래량</h3>
                <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis tickFormatter={(value) => (value / 10000).toFixed(0) + "만"} />
                        <Tooltip formatter={(value: any) => [value.toLocaleString(), "거래량"]} />
                        <Bar dataKey="volume" fill="#82ca9d" name="거래량" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* 통계 정보 */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-gray-50 rounded">
                    <p className="text-sm text-gray-600 mb-1">30일 최고가</p>
                    <p className="text-lg font-bold text-red-500">
                        {Math.max(...chartData.map((d) => d.high)).toLocaleString()}원
                    </p>
                </div>
                <div className="p-4 bg-gray-50 rounded">
                    <p className="text-sm text-gray-600 mb-1">30일 최저가</p>
                    <p className="text-lg font-bold text-blue-500">
                        {Math.min(...chartData.map((d) => d.low)).toLocaleString()}원
                    </p>
                </div>
                <div className="p-4 bg-gray-50 rounded">
                    <p className="text-sm text-gray-600 mb-1">평균 거래량</p>
                    <p className="text-lg font-bold">
                        {Math.floor(
                            chartData.reduce((acc, d) => acc + d.volume, 0) / chartData.length
                        ).toLocaleString()}
                    </p>
                </div>
                <div className="p-4 bg-gray-50 rounded">
                    <p className="text-sm text-gray-600 mb-1">30일 변동률</p>
                    <p className="text-lg font-bold">
                        {(
                            ((chartData[chartData.length - 1].close - chartData[0].close) / chartData[0].close) *
                            100
                        ).toFixed(2)}
                        %
                    </p>
                </div>
            </div>
        </div>
    );
}
