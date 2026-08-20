import type { Metadata, Viewport } from "next";
import KakaoSdkInit from "@/components/KakaoSdkInit";
import "./globals.css";

export const metadata: Metadata = {
  title: "전국 축제 지도",
  description:
    "한국관광공사 TourAPI 데이터를 기반으로 전국의 진행 중/예정 축제를 카카오맵에서 한눈에 확인하세요.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {children}
        <KakaoSdkInit />
      </body>
    </html>
  );
}
