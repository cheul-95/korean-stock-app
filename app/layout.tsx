import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "한국 주식 정보 - 실시간 시세 조회",
    description: "한국투자증권 Open API를 활용한 실시간 주식 정보 조회 시스템",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ko">
            <body>{children}</body>
        </html>
    );
}
