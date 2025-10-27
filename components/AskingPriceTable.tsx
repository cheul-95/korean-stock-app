"use client";

import { AskingPrice } from "@/types/stock";

interface AskingPriceTableProps {
    data: AskingPrice;
}

export default function AskingPriceTable({ data }: AskingPriceTableProps) {
    const { output1, output2 } = data;

    const askPrices = [
        { price: output1.askp10, qty: output1.askp_rsqn10 },
        { price: output1.askp9, qty: output1.askp_rsqn9 },
        { price: output1.askp8, qty: output1.askp_rsqn8 },
        { price: output1.askp7, qty: output1.askp_rsqn7 },
        { price: output1.askp6, qty: output1.askp_rsqn6 },
        { price: output1.askp5, qty: output1.askp_rsqn5 },
        { price: output1.askp4, qty: output1.askp_rsqn4 },
        { price: output1.askp3, qty: output1.askp_rsqn3 },
        { price: output1.askp2, qty: output1.askp_rsqn2 },
        { price: output1.askp1, qty: output1.askp_rsqn1 },
    ];

    const bidPrices = [
        { price: output1.bidp1, qty: output1.bidp_rsqn1 },
        { price: output1.bidp2, qty: output1.bidp_rsqn2 },
        { price: output1.bidp3, qty: output1.bidp_rsqn3 },
        { price: output1.bidp4, qty: output1.bidp_rsqn4 },
        { price: output1.bidp5, qty: output1.bidp_rsqn5 },
        { price: output1.bidp6, qty: output1.bidp_rsqn6 },
        { price: output1.bidp7, qty: output1.bidp_rsqn7 },
        { price: output1.bidp8, qty: output1.bidp_rsqn8 },
        { price: output1.bidp9, qty: output1.bidp_rsqn9 },
        { price: output1.bidp10, qty: output1.bidp_rsqn10 },
    ];

    const totalAskQty = parseInt(output1.total_askp_rsqn);
    const totalBidQty = parseInt(output1.total_bidp_rsqn);
    const maxQty = Math.max(totalAskQty, totalBidQty);

    return (
        <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">호가</h2>

            <div className="mb-4 flex justify-between text-sm">
                <div className="text-red-500">
                    <span className="font-semibold">총 매도잔량: </span>
                    {totalAskQty.toLocaleString()}
                </div>
                <div className="text-blue-500">
                    <span className="font-semibold">총 매수잔량: </span>
                    {totalBidQty.toLocaleString()}
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b-2 border-gray-300">
                            <th className="text-left p-2 text-red-500">매도잔량</th>
                            <th className="text-center p-2">호가</th>
                            <th className="text-right p-2 text-blue-500">매수잔량</th>
                        </tr>
                    </thead>
                    <tbody>
                        {askPrices.map((ask, index) => {
                            const bid = bidPrices[index];
                            const askQtyNum = parseInt(ask.qty);
                            const bidQtyNum = parseInt(bid.qty);
                            const askWidth = (askQtyNum / maxQty) * 100;
                            const bidWidth = (bidQtyNum / maxQty) * 100;
                            return (
                                <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                                    <td className="p-2 relative">
                                        <div
                                            className="absolute right-0 top-0 h-full bg-red-100"
                                            style={{ width: `${askWidth}%` }}
                                        />
                                        <span className="relative z-10 text-red-600 font-semibold">
                                            {askQtyNum > 0 ? askQtyNum.toLocaleString() : "-"}
                                        </span>
                                    </td>
                                    <td className="text-center p-2 font-bold">
                                        {parseInt(ask.price).toLocaleString()}
                                    </td>
                                    <td className="p-2 text-right relative">
                                        <div
                                            className="absolute left-0 top-0 h-full bg-blue-100"
                                            style={{ width: `${bidWidth}%` }}
                                        />
                                        <span className="relative z-10 text-blue-600 font-semibold">
                                            {bidQtyNum > 0 ? bidQtyNum.toLocaleString() : "-"}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 p-4 bg-gray-50 rounded">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-gray-600">현재가: </span>
                        <span className="font-bold">{parseInt(output2.stck_prpr).toLocaleString()}원</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
