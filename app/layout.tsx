import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MerchantMind｜AI 商家增长助手',
  description: '用经营数据和 AI 洞察，帮助商家找到下一步增长机会。',
  openGraph: {
    title: 'MerchantMind｜AI 商家增长助手',
    description: '用经营数据和 AI 洞察，帮助商家找到下一步增长机会。',
    url: 'https://merchantmind-ai-growth-zhangzi.nk9wq6b642.chatgpt.site',
    siteName: 'MerchantMind',
    locale: 'zh_CN',
    type: 'website',
    images: [{ url: 'https://merchantmind-ai-growth-zhangzi.nk9wq6b642.chatgpt.site/og.png', width: 1795, height: 941, alt: 'MerchantMind｜AI 商家增长助手' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MerchantMind｜AI 商家增长助手',
    description: '用经营数据和 AI 洞察，帮助商家找到下一步增长机会。',
    images: ['https://merchantmind-ai-growth-zhangzi.nk9wq6b642.chatgpt.site/og.png'],
  },
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
