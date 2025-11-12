import { Metadata } from "next";
// Google Fontsからフォントを読み込む
import { Playfair_Display, PT_Sans } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils"; // ステップ14で作成したutils.tsを参照

// 見出しフォントの設定
const fontDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display", // CSS変として登録
});

// 本文フォントの設定
const fontBody = PT_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-body", // CSS変数として登録
});

export const metadata: Metadata = {
  title: "Kanagawa Subsidy Navigator",
  description: "神奈川県の補助金・助成金情報をAIがナビゲート",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head />
      {/* cn関数を使ってフォント変数を適用
        font-display: 見出しフォント
        font-body: 本文フォント
      */}
      <body
        className={cn(
          "min-h-screen bg-background font-body antialiased",
          fontDisplay.variable,
          fontBody.variable
        )}
      >
        {children}
      </body>
    </html>
  );
}