import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import "./globals.css";

export const metadata: Metadata = {
  title: "かのは | いっしょに算数",
  description: "小学校2年生のための、やさしい個別算数学習アプリ",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#ff7a59",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}<ServiceWorkerRegistration /></body>
    </html>
  );
}
