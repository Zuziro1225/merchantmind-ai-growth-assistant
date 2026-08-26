import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MerchantMind｜AI 商家增长助手',
  description: '用经营数据和 AI 洞察，帮助商家找到下一步增长机会。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
