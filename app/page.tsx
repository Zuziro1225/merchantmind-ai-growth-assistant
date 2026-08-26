'use client';

import { useState } from 'react';

const insights = [
  { level: '重点关注', title: '午高峰的支付转化下降', detail: '12:00–14:00 的访客增长 18%，但下单率从 9.4% 降至 6.8%。', tone: 'alert' },
  { level: '增长机会', title: '“燕麦拿铁”有复购潜力', detail: '近 30 天复购率 31%，高出门店平均值 9 个百分点。', tone: 'good' },
  { level: '需要验证', title: '外卖评分出现波动', detail: '周三晚高峰的低分评价集中在出餐等待时间。', tone: 'neutral' },
];

export default function Home() {
  const [tab, setTab] = useState('总览');
  const [report, setReport] = useState(false);
  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">M</span><span>MerchantMind</span></div>
      <p className="workspace">好日子咖啡 · 经营驾驶舱</p>
      <nav aria-label="主导航">{['总览', '经营数据', 'AI 诊断', '商品分析'].map((item) => <button key={item} onClick={() => setTab(item)} className={tab === item ? 'nav-item active' : 'nav-item'}><span>{item === '总览' ? '◈' : item === '经营数据' ? '⌁' : item === 'AI 诊断' ? '✦' : '◌'}</span>{item}</button>)}</nav>
      <div className="sidebar-footer"><span className="avatar">张</span><div><strong>子月的作品集</strong><small>演示模式</small></div></div>
    </aside>
    <section className="content">
      <header className="topbar"><div><p className="eyebrow">经营总览 · 2026/08/18 — 08/24</p><h1>早上好，今天我们先看增长机会。</h1></div><button className="upload">＋ 上传经营数据</button></header>
      <section className="hero-card"><div><p className="eyebrow light">本周经营健康度</p><div className="score-row"><strong>82</strong><span>/ 100</span><b>↑ 6 分</b></div><p>整体稳定，午高峰转化和外卖体验值得优先处理。</p></div><div className="hero-action"><span>✦ AI 本周结论</span><strong>先优化午高峰的<br/>商品组合与出餐效率</strong><button onClick={() => setReport(!report)}>{report ? '已生成行动方案' : '生成行动方案 →'}</button></div></section>
      {report && <section className="report"><strong>已为你生成 3 项优先动作：</strong> ① 午高峰推出「拿铁 + 可颂」套餐；② 预制高频原料，缩短出餐；③ 回访本周低分外卖订单。</section>}
      <section className="metrics" aria-label="核心指标"><Metric label="GMV" value="¥48,620" change="↑ 12.4%"/><Metric label="支付转化率" value="7.8%" change="↓ 1.6%" down/><Metric label="复购率" value="22.6%" change="↑ 3.1%"/><Metric label="外卖好评率" value="4.76" change="↓ 0.08" down/></section>
      <section className="grid-section">
        <article className="panel trend"><div className="panel-head"><div><p className="eyebrow">GMV 趋势</p><h2>收入在增长，但转化在变慢</h2></div><span className="period">近 7 天⌄</span></div><div className="chart"><div className="axis"><span>¥9k</span><span>¥6k</span><span>¥3k</span></div><div className="chart-area"><div className="line line-main"/><div className="line line-dash"/><div className="days"><span>周一</span><span>周二</span><span>周三</span><span>周四</span><span>周五</span><span>周六</span><span>周日</span></div></div></div><div className="legend"><span><i className="dot purple"/>GMV</span><span><i className="dot mint"/>访客数</span></div></article>
        <article className="panel diagnosis"><div className="panel-head"><div><p className="eyebrow">AI 经营诊断</p><h2>今天最值得处理的事</h2></div><span className="spark">✦</span></div>{insights.map((x) => <div className={`insight ${x.tone}`} key={x.title}><span>{x.level}</span><div><strong>{x.title}</strong><p>{x.detail}</p></div><button aria-label={`查看${x.title}`}>›</button></div>)}</article>
      </section>
      <section className="panel ask"><div><p className="eyebrow">问问你的 AI 运营助手</p><h2>“为什么这周 GMV 增长了，转化率却下降？”</h2></div><button>开始分析 <span>→</span></button></section>
    </section>
  </main>;
}
function Metric({ label, value, change, down = false }: { label: string; value: string; change: string; down?: boolean }) { return <article className="metric"><p>{label}</p><strong>{value}</strong><span className={down ? 'down' : ''}>{change}</span></article>; }
