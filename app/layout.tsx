import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EngLearner — 智能背单词",
  description:
    "根据你的水平与兴趣智能推荐的英语单词记忆应用，采用 FSRS 间隔重复算法。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
