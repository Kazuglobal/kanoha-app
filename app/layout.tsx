import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import "./globals.css";

export const metadata: Metadata = {
  title: "さゆき | いっしょに べんきょう",
  description: "小学校4年生のための、やさしい個別学習アプリ(算数・国語・外国語活動)",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#ff7a59",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800;900&family=Zen+Maru+Gothic:wght@500;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}<ServiceWorkerRegistration /></body>
    </html>
  );
}
