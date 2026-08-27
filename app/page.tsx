'use client';

import { useEffect, useState } from 'react';

const initialMetrics = {
  gmv: '¥48,620',
  conversionRate: '7.8%',
  repeatPurchaseRate: '22.6%',
  deliveryRating: '4.76',
};

const insights = [
  { level: '增长机会', title: '“燕麦拿铁”有复购潜力', detail: '近 30 天复购率 31%，高出门店平均值 9 个百分点。', tone: 'good' },
  { level: '需要验证', title: '外卖评分出现波动', detail: '周三晚高峰的低分评价集中在出餐等待时间。', tone: 'neutral' },
];

function getConversionInsight(conversionRate: number) {
  if (conversionRate < 0.08) {
    return {
      level: '重点关注',
      title: '支付转化率低于健康线',
      detail: `当前为 ${(conversionRate * 100).toFixed(1)}%，低于 8.0% 健康线。建议优先排查商品组合、价格与高峰期出餐体验。`,
      tone: 'alert',
    };
  }
  return {
    level: '状态良好',
    title: '支付转化率处于健康范围',
    detail: `当前为 ${(conversionRate * 100).toFixed(1)}%，可以继续关注复购和客单价提升。`,
    tone: 'good',
  };
}

function getPeakHourInsight(waitMinutes: number, conversionRate: number) {
  if (waitMinutes >= 8 && conversionRate < 0.08) {
    return {
      level: '重点关注',
      title: '午高峰出餐可能拖慢转化',
      detail: `最高峰等待 ${waitMinutes.toFixed(1)} 分钟、转化率 ${(conversionRate * 100).toFixed(1)}%。建议增加备料或推出更快出品的套餐。`,
      tone: 'alert',
    };
  }
  return {
    level: '状态良好',
    title: '午高峰出餐体验稳定',
    detail: `最高峰等待 ${waitMinutes.toFixed(1)} 分钟，当前未发现等待时间与转化同时恶化的信号。`,
    tone: 'good',
  };
}

export default function Home() {
  const [tab, setTab] = useState('总览');
  const [report, setReport] = useState(false);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [dataSource, setDataSource] = useState('正在读取 CSV 数据…');
  const [peakHourInsight, setPeakHourInsight] = useState({ level: '分析中', title: '正在读取午高峰数据', detail: '稍后将根据等待时间与转化率完成诊断。', tone: 'neutral' });
  const conversionRate = Number(metrics.conversionRate.replace('%', '')) / 100;
  const diagnosisInsights = [getConversionInsight(conversionRate), peakHourInsight, ...insights];

  useEffect(() => {
    fetch('/data/weekly_metrics.csv')
      .then((response) => response.text())
      .then((csv) => {
        const [headerLine, valueLine] = csv.trim().split('\n');
        const headers = headerLine.split(',');
        const values = valueLine.split(',');
        const record = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
        setMetrics({
          gmv: `¥${Number(record.gmv).toLocaleString('zh-CN')}`,
          conversionRate: `${(Number(record.payment_conversion_rate) * 100).toFixed(1)}%`,
          repeatPurchaseRate: `${(Number(record.repeat_purchase_rate) * 100).toFixed(1)}%`,
          deliveryRating: Number(record.delivery_rating).toFixed(2),
        });
        setDataSource('已读取 weekly_metrics.csv');
      })
      .catch(() => setDataSource('暂时使用演示数据'));
  }, []);

  useEffect(() => {
    fetch('/data/hourly_funnel.csv')
      .then((response) => response.text())
      .then((csv) => {
        const [headerLine, ...valueLines] = csv.trim().split('\n');
        const headers = headerLine.split(',');
        const rows = valueLines.map((line) => Object.fromEntries(headers.map((header, index) => [header, line.split(',')[index]])));
        const peakHour = rows.sort((a, b) => Number(b.visitors) - Number(a.visitors))[0];
        setPeakHourInsight(getPeakHourInsight(Number(peakHour.avg_wait_minutes), Number(peakHour.payment_conversion_rate)));
      });
  }, []);
  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">M</span><span>MerchantMind</span></div>
      <p className="workspace">好日子咖啡 · 经营驾驶舱</p>
      <nav aria-label="主导航">{['总览', '经营数据', 'AI 诊断', '商品分析'].map((item) => <button key={item} onClick={() => setTab(item)} className={tab === item ? 'nav-item active' : 'nav-item'}><span>{item === '总览' ? '◈' : item === '经营数据' ? '⌁' : item === 'AI 诊断' ? '✦' : '◌'}</span>{item}</button>)}</nav>
      <div className="sidebar-footer"><span className="avatar">张</span><div><strong>子月的作品集</strong><small>演示模式</small></div></div>
    </aside>
    <section className="content">
      <header className="topbar"><div><p className="eyebrow">经营总览 · 2026/08/18 — 08/24 · {dataSource}</p><h1>我是子月，我正在用 AI 帮商家找到增长机会。</h1></div><button className="upload">＋ 上传经营数据</button></header>
      <section className="hero-card"><div><p className="eyebrow light">本周经营健康度</p><div className="score-row"><strong>82</strong><span>/ 100</span><b>↑ 6 分</b></div><p>整体稳定，午高峰转化和外卖体验值得优先处理。</p></div><div className="hero-action"><span>✦ AI 本周结论</span><strong>先优化午高峰的<br/>商品组合与出餐效率</strong><button onClick={() => setReport(!report)}>{report ? '已生成行动方案' : '生成行动方案 →'}</button></div></section>
      {report && <section className="report"><strong>已为你生成 3 项优先动作：</strong> ① 午高峰推出「拿铁 + 可颂」套餐；② 预制高频原料，缩短出餐；③ 回访本周低分外卖订单。</section>}
      <section className="metrics" aria-label="核心指标"><Metric label="GMV" value={metrics.gmv} change="↑ 12.4%" /><Metric label="支付转化率" value={metrics.conversionRate} change="↓ 1.6%" down/><Metric label="复购率" value={metrics.repeatPurchaseRate} change="↑ 3.1%"/><Metric label="外卖好评率" value={metrics.deliveryRating} change="↓ 0.08" down/></section>
      <section className="grid-section">
        <article className="panel trend"><div className="panel-head"><div><p className="eyebrow">GMV 趋势</p><h2>收入在增长，但转化在变慢</h2></div><span className="period">近 7 天⌄</span></div><div className="chart"><div className="axis"><span>¥9k</span><span>¥6k</span><span>¥3k</span></div><div className="chart-area"><div className="line line-main"/><div className="line line-dash"/><div className="days"><span>周一</span><span>周二</span><span>周三</span><span>周四</span><span>周五</span><span>周六</span><span>周日</span></div></div></div><div className="legend"><span><i className="dot purple"/>GMV</span><span><i className="dot mint"/>访客数</span></div></article>
        <article className="panel diagnosis"><div className="panel-head"><div><p className="eyebrow">AI 经营诊断</p><h2>今天最值得处理的事</h2></div><span className="spark">✦</span></div>{diagnosisInsights.map((x) => <div className={`insight ${x.tone}`} key={x.title}><span>{x.level}</span><div><strong>{x.title}</strong><p>{x.detail}</p></div><button aria-label={`查看${x.title}`}>›</button></div>)}</article>
      </section>
      <section className="panel ask"><div><p className="eyebrow">问问你的 AI 运营助手</p><h2>“为什么这周 GMV 增长了，转化率却下降？”</h2></div><button>开始分析 <span>→</span></button></section>
    </section>
  </main>;
}
function Metric({ label, value, change, down = false }: { label: string; value: string; change: string; down?: boolean }) { return <article className="metric"><p>{label}</p><strong>{value}</strong><span className={down ? 'down' : ''}>{change}</span></article>; }
