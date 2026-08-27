'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import './workspaces.css';

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

const requiredMetricFields = ['gmv', 'payment_conversion_rate', 'repeat_purchase_rate', 'delivery_rating'];

type MetricRecord = Record<string, string>;

function readWeeklyMetrics(csv: string): MetricRecord {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error('文件中需要包含表头和至少一行数据');

  const headers = lines[0].split(',').map((item) => item.trim());
  const values = lines[1].split(',').map((item) => item.trim());
  const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  const missing = requiredMetricFields.filter((field) => !record[field]);

  if (missing.length) throw new Error('缺少必填字段：' + missing.join('、'));
  if (requiredMetricFields.some((field) => Number.isNaN(Number(record[field])))) {
    throw new Error('4 个核心指标必须是数字');
  }
  return record;
}

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

function buildActionPlan(conversionRate: number, repeatPurchaseRate: number, deliveryRating: number) {
  if (conversionRate < 0.08) {
    return {
      title: '先改善支付转化，再放大流量',
      basis: `支付转化率 ${(conversionRate * 100).toFixed(1)}%，低于 8.0% 健康线。`,
      actions: [
        '午高峰推出 1 组“主推饮品 + 轻食”套餐，减少顾客决策成本。',
        '检查销量前 5 商品的价格、图片和库存状态，优先修复下单阻力。',
        '连续观察 7 天转化率，达到 8.0% 后再考虑加大引流活动。',
      ],
    };
  }
  if (repeatPurchaseRate < 0.25) {
    return {
      title: '把新客转成第二次购买',
      basis: `支付转化健康，但复购率 ${(repeatPurchaseRate * 100).toFixed(1)}% 仍有提升空间。`,
      actions: [
        '给本周首次购买的顾客发放 7 天内可用的复购券。',
        '围绕高复购饮品设计加购组合，提高下一单的选择效率。',
        '按新客和老客分别追踪复购率，验证优惠是否真的有效。',
      ],
    };
  }
  if (deliveryRating < 4.7) {
    return {
      title: '优先修复外卖体验，守住口碑',
      basis: `外卖好评率 ${deliveryRating.toFixed(2)}，需要尽快排查低分原因。`,
      actions: [
        '筛选近 7 天低分订单，按等待、漏品和包装问题分类。',
        '午高峰提前备料，并为易洒商品增加封口检查。',
        '对符合条件的低分订单做一次定向回访，记录修复结果。',
      ],
    };
  }
  return {
    title: '经营指标稳定，尝试放大高价值商品',
    basis: '支付转化、复购与外卖体验目前都处于健康范围。',
    actions: [
      '选择 1 个高复购商品做套餐测试，观察客单价变化。',
      '复盘午高峰的商品结构，保留出餐快、毛利稳定的组合。',
      '下周继续跟踪 4 个核心指标，防止增长带来体验波动。',
    ],
  };
}

function answerBusinessQuestion(question: string, metrics: typeof initialMetrics, actionPlan: ReturnType<typeof buildActionPlan>) {
  const normalized = question.toLowerCase();
  if (normalized.includes('gmv') || normalized.includes('增长') || normalized.includes('转化')) {
    return `当前 GMV 为 ${metrics.gmv}，支付转化率为 ${metrics.conversionRate}。这份 CSV 只有一周汇总数据，因此不能严谨地证明 GMV 变化的单一原因；下一步应补充按天的访客数、下单数和支付金额，再判断是流量结构还是下单环节导致变化。当前优先动作仍是：${actionPlan.actions[0]}`;
  }
  if (normalized.includes('复购') || normalized.includes('新客')) {
    return `当前复购率为 ${metrics.repeatPurchaseRate}，低于本项目设定的 25% 关注线。建议先区分新客和老客，再对首次购买的顾客测试 7 天复购券，并用下周复购率验证效果。`;
  }
  if (normalized.includes('外卖') || normalized.includes('评分') || normalized.includes('好评')) {
    return `当前外卖好评率为 ${metrics.deliveryRating}，高于 4.70 的基础健康线，暂不是最高优先级。但仍建议持续记录低分订单的等待、漏品和包装原因，避免增长时体验下滑。`;
  }
  return `根据当前上传的数据：GMV ${metrics.gmv}、支付转化率 ${metrics.conversionRate}、复购率 ${metrics.repeatPurchaseRate}、外卖好评率 ${metrics.deliveryRating}。当前最优先的经营主题是“${actionPlan.title}”，判断依据是：${actionPlan.basis}`;
}

export default function Home() {
  const [tab, setTab] = useState('总览');
  const [report, setReport] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [question, setQuestion] = useState('为什么这周 GMV 增长了，转化率却下降？');
  const [answer, setAnswer] = useState('');
  const [useModel, setUseModel] = useState(false);
  const [answerSource, setAnswerSource] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [dataSource, setDataSource] = useState('正在读取 CSV 数据…');
  const [uploadMessage, setUploadMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [peakHourInsight, setPeakHourInsight] = useState({ level: '分析中', title: '正在读取午高峰数据', detail: '稍后将根据等待时间与转化率完成诊断。', tone: 'neutral' });
  const conversionRate = Number(metrics.conversionRate.replace('%', '')) / 100;
  const repeatPurchaseRate = Number(metrics.repeatPurchaseRate.replace('%', '')) / 100;
  const deliveryRating = Number(metrics.deliveryRating);
  const actionPlan = buildActionPlan(conversionRate, repeatPurchaseRate, deliveryRating);
  const diagnosisInsights = [getConversionInsight(conversionRate), peakHourInsight, ...insights];
  const pageTitle = tab === '总览'
    ? '我是子月，我正在用 AI 帮商家找到增长机会。'
    : tab === '经营数据'
      ? '让每一条经营数据都能支持一个判断。'
      : tab === 'AI 诊断'
        ? '把指标变化，转成清晰的下一步行动。'
        : '找到值得持续投入的商品机会。';

  function applyMetricRecord(record: MetricRecord, source: string) {
    setMetrics({
      gmv: `¥${Number(record.gmv).toLocaleString('zh-CN')}`,
      conversionRate: `${(Number(record.payment_conversion_rate) * 100).toFixed(1)}%`,
      repeatPurchaseRate: `${(Number(record.repeat_purchase_rate) * 100).toFixed(1)}%`,
      deliveryRating: Number(record.delivery_rating).toFixed(2),
    });
    setDataSource(source);
  }

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadMessage('请选择 CSV 格式的经营数据文件');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const record = readWeeklyMetrics(String(reader.result));
        applyMetricRecord(record, `已上传 ${file.name}`);
        setUploadMessage('上传成功：看板和诊断已按新数据刷新');
      } catch (error) {
        setUploadMessage(error instanceof Error ? `上传失败：${error.message}` : '上传失败，请检查文件格式');
      }
    };
    reader.readAsText(file, 'utf-8');
    event.target.value = '';
  }

  async function submitQuestion(nextQuestion = question) {
    const cleanedQuestion = nextQuestion.trim();
    if (!cleanedQuestion) return;
    setQuestion(cleanedQuestion);
    setIsAnalyzing(true);
    if (!useModel) {
      setAnswer(answerBusinessQuestion(cleanedQuestion, metrics, actionPlan));
      setAnswerSource('规则版 · 基于已知指标');
      setIsAnalyzing(false);
      return;
    }
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: cleanedQuestion, metrics }),
      });
      const result = await response.json() as { answer?: string; error?: string };
      if (!response.ok || !result.answer) throw new Error(result.error || '大模型暂时不可用');
      setAnswer(result.answer);
      setAnswerSource('OpenAI 大模型 · 仅使用当前上传数据');
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      const unavailableReason = message.includes('quota') || message.includes('billing')
        ? '当前尚未开通 API 可用额度，已自动切换为规则版分析。'
        : '大模型服务暂不可用，已自动切换为规则版分析。';
      setAnswer(`${unavailableReason}\n\n以下为规则版分析：${answerBusinessQuestion(cleanedQuestion, metrics, actionPlan)}`);
      setAnswerSource('规则版兜底 · 保持服务可用');
    } finally {
      setIsAnalyzing(false);
    }
  }

  useEffect(() => {
    fetch('/data/weekly_metrics.csv')
      .then((response) => response.text())
      .then((csv) => {
        applyMetricRecord(readWeeklyMetrics(csv), '已读取 weekly_metrics.csv');
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
      <header className="topbar"><div><p className="eyebrow">{tab} · 2026/08/18 — 08/24 · {dataSource}</p><h1>{pageTitle}</h1>{uploadMessage && <p className={`upload-message ${uploadMessage.startsWith('上传成功') ? 'success' : 'error'}`}>{uploadMessage}</p>}</div><div><input ref={fileInputRef} className="file-input" type="file" accept=".csv,text/csv" onChange={handleUpload}/><button className="upload" onClick={() => fileInputRef.current?.click()}>＋ 上传经营数据</button><p className="upload-hint">支持 weekly_metrics.csv 格式</p></div></header>
      {tab === '总览' ? <><section className="hero-card"><div><p className="eyebrow light">本周经营健康度</p><div className="score-row"><strong>82</strong><span>/ 100</span><b>↑ 6 分</b></div><p>整体稳定，午高峰转化和外卖体验值得优先处理。</p></div><div className="hero-action"><span>✦ AI 本周结论</span><strong>{actionPlan.title}</strong><button onClick={() => setReport(!report)}>{report ? '收起行动方案' : '生成行动方案 →'}</button></div></section>
      {report && <section className="report"><strong>已根据当前数据生成 3 项优先动作</strong><p className="decision-basis">判断依据：{actionPlan.basis}</p><ol className="report-list">{actionPlan.actions.map((action) => <li key={action}>{action}</li>)}</ol></section>}
      <section className="metrics" aria-label="核心指标"><Metric label="GMV" value={metrics.gmv} change="↑ 12.4%" /><Metric label="支付转化率" value={metrics.conversionRate} change="↓ 1.6%" down/><Metric label="复购率" value={metrics.repeatPurchaseRate} change="↑ 3.1%"/><Metric label="外卖好评率" value={metrics.deliveryRating} change="↓ 0.08" down/></section>
      <section className="grid-section">
        <article className="panel trend"><div className="panel-head"><div><p className="eyebrow">GMV 趋势</p><h2>收入在增长，但转化在变慢</h2></div><span className="period">近 7 天⌄</span></div><div className="chart"><div className="axis"><span>¥9k</span><span>¥6k</span><span>¥3k</span></div><div className="chart-area"><div className="line line-main"/><div className="line line-dash"/><div className="days"><span>周一</span><span>周二</span><span>周三</span><span>周四</span><span>周五</span><span>周六</span><span>周日</span></div></div></div><div className="legend"><span><i className="dot purple"/>GMV</span><span><i className="dot mint"/>访客数</span></div></article>
        <article className="panel diagnosis"><div className="panel-head"><div><p className="eyebrow">AI 经营诊断</p><h2>今天最值得处理的事</h2></div><span className="spark">✦</span></div>{diagnosisInsights.map((x) => <div className={`insight ${x.tone}`} key={x.title}><span>{x.level}</span><div><strong>{x.title}</strong><p>{x.detail}</p></div><button aria-label={`查看${x.title}`}>›</button></div>)}</article>
      </section>
      <section className="panel ask"><div><p className="eyebrow">问问你的 AI 运营助手</p><h2>“为什么这周 GMV 增长了，转化率却下降？”</h2></div><button onClick={() => setAskOpen(!askOpen)}>{askOpen ? '收起问答' : '开始分析'} <span>→</span></button></section>
      {askOpen && <section className="ask-workspace" aria-label="运营问答"><div className="ask-intro"><div><p className="eyebrow">数据问答</p><h2>基于当前上传的经营数据提问</h2></div><span>{useModel ? '大模型优先' : '规则版回答'}</span></div><label className="model-switch"><input type="checkbox" checked={useModel} onChange={(event) => setUseModel(event.target.checked)}/><span>优先使用 OpenAI 大模型生成回答</span><small>未开通额度时自动使用规则版</small></label><div className="question-chips"><button onClick={() => submitQuestion('为什么这周 GMV 增长了，转化率却下降？')}>GMV 与转化</button><button onClick={() => submitQuestion('如何提高复购？')}>如何提高复购？</button><button onClick={() => submitQuestion('外卖评分需要处理吗？')}>外卖评分需要处理吗？</button></div><div className="question-form"><input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submitQuestion(); }} aria-label="输入经营问题" placeholder="例如：应该先做引流还是复购？"/><button disabled={isAnalyzing} onClick={() => submitQuestion()}>{isAnalyzing ? '分析中…' : '分析'}</button></div>{answer && <div className="answer-card"><span>✦ {answerSource || '分析结果'}</span><p>{answer}</p></div>}</section>}
      </> : tab === '经营数据' ? <DataWorkspace metrics={metrics} dataSource={dataSource} /> : tab === 'AI 诊断' ? <DiagnosisWorkspace insights={diagnosisInsights} actionPlan={actionPlan} /> : <ProductWorkspace />}
    </section>
  </main>;
}
function Metric({ label, value, change, down = false }: { label: string; value: string; change: string; down?: boolean }) { return <article className="metric"><p>{label}</p><strong>{value}</strong><span className={down ? 'down' : ''}>{change}</span></article>; }

function DataWorkspace({ metrics, dataSource }: { metrics: typeof initialMetrics; dataSource: string }) {
  const fields = [
    { label: 'GMV', value: metrics.gmv, description: '本周成交金额，用于观察收入规模。' },
    { label: '支付转化率', value: metrics.conversionRate, description: '从访问到支付的效率，用于发现下单阻力。' },
    { label: '复购率', value: metrics.repeatPurchaseRate, description: '顾客再次购买比例，用于衡量留存质量。' },
    { label: '外卖好评率', value: metrics.deliveryRating, description: '配送体验反馈，用于守住口碑。' },
  ];
  return <section className="workspace-page">
    <section className="workspace-hero"><div><p className="eyebrow">数据接入</p><h2>当前数据快照已准备好</h2><p>先确保数据正确，再让 AI 基于同一份事实给出建议。</p></div><span className="status-pill">● 数据已就绪</span></section>
    <section className="data-summary-grid"><article className="panel source-panel"><p className="eyebrow">数据来源</p><h2>{dataSource}</h2><p>支持上传 weekly_metrics.csv。上传后，看板、诊断和问答会同步刷新。</p><div className="source-status"><span>核心字段</span><strong>4 / 4 已完整</strong></div></article><article className="panel quality-panel"><p className="eyebrow">数据质量检查</p><h2>可以开始分析</h2><ul><li><span>✓</span> 四个核心指标均为数值</li><li><span>✓</span> 已用于经营看板和规则诊断</li><li><span>!</span> 当前为周汇总，趋势判断需补充按天数据</li></ul></article></section>
    <section className="panel field-panel"><div className="panel-head"><div><p className="eyebrow">字段字典</p><h2>每个数字具体代表什么？</h2></div><span className="period">经营周报</span></div><div className="field-table"><div className="field-row field-head"><span>字段</span><span>当前值</span><span>业务意义</span></div>{fields.map((field) => <div className="field-row" key={field.label}><strong>{field.label}</strong><b>{field.value}</b><p>{field.description}</p></div>)}</div></section>
  </section>;
}

function DiagnosisWorkspace({ insights, actionPlan }: { insights: Array<{ level: string; title: string; detail: string; tone: string }>; actionPlan: { title: string; basis: string; actions: string[] } }) {
  return <section className="workspace-page"><section className="workspace-hero"><div><p className="eyebrow">诊断中心</p><h2>先做最值得做的一件事</h2><p>诊断不只告诉商家“哪里有问题”，还会给出判断依据和可验证的行动。</p></div><span className="status-pill">✦ 已生成优先级</span></section><section className="priority-card"><span className="priority-index">P1</span><div><p className="eyebrow light">本周最高优先级</p><h2>{actionPlan.title}</h2><p>{actionPlan.basis}</p></div><div className="priority-action"><span>建议先做</span><strong>{actionPlan.actions[0]}</strong></div></section><section className="diagnosis-board">{insights.map((insight, index) => <article className={`diagnosis-detail ${insight.tone}`} key={insight.title}><div className="diagnosis-number">0{index + 1}</div><div><span>{insight.level}</span><h3>{insight.title}</h3><p>{insight.detail}</p></div><div className="diagnosis-next"><small>下一步</small><strong>{actionPlan.actions[index] || '持续观察相关指标，并在下周复盘。'}</strong></div></article>)}</section></section>;
}

function ProductWorkspace() {
  const products = [
    { name: '燕麦拿铁', metric: '复购率 31%', level: '增长机会', detail: '高出门店平均水平，适合成为复购活动的主推商品。', action: '搭配可颂测试“第二杯 / 加购”组合。', tone: 'good' },
    { name: '午高峰套餐', metric: '等待 4.2 分钟', level: '状态良好', detail: '当前出餐体验稳定，可以保留并观察销量结构。', action: '保留高峰期出餐快、毛利稳定的组合。', tone: 'good' },
    { name: '外卖订单', metric: '好评率 4.76', level: '需要验证', detail: '总体健康，但仍应跟踪低分评价是否集中在某个时段。', action: '每周归类等待、漏品和包装相关反馈。', tone: 'neutral' },
  ];
  return <section className="workspace-page"><section className="workspace-hero"><div><p className="eyebrow">商品机会</p><h2>把经营动作落到具体商品上</h2><p>这是基于当前演示数据生成的商品机会卡；后续会接入商品明细和真实排序。</p></div><span className="status-pill">3 个机会待跟进</span></section><section className="product-grid">{products.map((product) => <article className="product-card" key={product.name}><div className="product-top"><span className={`tag ${product.tone}`}>{product.level}</span><b>{product.metric}</b></div><h3>{product.name}</h3><p>{product.detail}</p><div className="product-action"><small>建议动作</small><strong>{product.action}</strong></div></article>)}</section><section className="panel product-note"><p className="eyebrow">下一阶段</p><h2>接入商品明细后，会增加什么？</h2><p>销量、毛利、复购、评分和缺货率会共同决定商品优先级。这样可以让“商品分析”从演示卡片升级为真正的运营决策台。</p></section></section>;
}
