'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import './workspaces.css';
import './upload.css';
import './product-analysis.css';
import './product-upload.css';
import './daily-trend.css';
import './data-evidence.css';
import './sample-data.css';
import './action-tracker.css';
import './review-samples.css';
import './review-checkpoint.css';

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
const requiredProductFields = ['product_name', 'category', 'units_sold', 'revenue', 'gross_margin', 'repeat_purchase_rate', 'rating', 'out_of_stock_count'];

type MetricRecord = Record<string, string>;
type ProductRecord = {
  productName: string;
  category: string;
  unitsSold: number;
  revenue: number;
  grossMargin: number;
  repeatPurchaseRate: number;
  rating: number;
  outOfStockCount: number;
};
type DailyRecord = { date: string; visitors: number; orders: number; paidOrders: number; gmv: number; avgWaitMinutes: number; deliveryRating: number };
type ReviewRecord = { date: string; channel: string; productName: string; rating: number; issueTag: string; comment: string };
type ReviewNote = { outcome: string; note: string; savedAt: string };

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

function readProductMetrics(csv: string): ProductRecord[] {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error('文件中需要包含表头和至少一条商品数据');
  const headers = lines[0].split(',').map((item) => item.trim());
  const missing = requiredProductFields.filter((field) => !headers.includes(field));
  if (missing.length) throw new Error('缺少必填字段：' + missing.join('、'));
  const rows = lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, line.split(',')[index]?.trim() ?? ''])));
  const records = rows.map((row) => ({
    productName: row.product_name,
    category: row.category,
    unitsSold: Number(row.units_sold),
    revenue: Number(row.revenue),
    grossMargin: Number(row.gross_margin),
    repeatPurchaseRate: Number(row.repeat_purchase_rate),
    rating: Number(row.rating),
    outOfStockCount: Number(row.out_of_stock_count),
  }));
  if (records.some((record) => !record.productName || !record.category || Object.values(record).some((value) => typeof value === 'number' && Number.isNaN(value)))) {
    throw new Error('请检查商品名称、品类及所有数值字段');
  }
  return records;
}

function readDailyMetrics(csv: string): DailyRecord[] {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error('文件中需要包含表头和至少一天数据');
  const headers = lines[0].split(',').map((item) => item.trim());
  const required = ['date', 'visitors', 'orders', 'paid_orders', 'gmv'];
  const missing = required.filter((field) => !headers.includes(field));
  if (missing.length) throw new Error('缺少必填字段：' + missing.join('、'));
  const records = lines.slice(1).map((line) => {
    const row = Object.fromEntries(headers.map((header, index) => [header, line.split(',')[index]?.trim() ?? '']));
    return { date: row.date, visitors: Number(row.visitors), orders: Number(row.orders), paidOrders: Number(row.paid_orders), gmv: Number(row.gmv), avgWaitMinutes: Number(row.avg_wait_minutes), deliveryRating: Number(row.delivery_rating) };
  });
  if (records.some((record) => !record.date || Object.values(record).some((value) => typeof value === 'number' && Number.isNaN(value)))) throw new Error('请检查日期及数值字段');
  return records;
}

function readReviews(csv: string): ReviewRecord[] {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(',').map((item) => item.trim());
  const required = ['date', 'channel', 'product_name', 'rating', 'issue_tag', 'comment'];
  if (required.some((field) => !headers.includes(field))) throw new Error('评价数据缺少必要字段');
  return lines.slice(1).map((line) => {
    const row = Object.fromEntries(headers.map((header, index) => [header, line.split(',')[index]?.trim() ?? '']));
    return { date: row.date, channel: row.channel, productName: row.product_name, rating: Number(row.rating), issueTag: row.issue_tag, comment: row.comment };
  }).filter((review) => review.date && review.productName && !Number.isNaN(review.rating));
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

function getDailyTrendInsight(dailyMetrics: DailyRecord[]) {
  const recentWeek = dailyMetrics.slice(-7);
  if (recentWeek.length < 6) return { level: '数据不足', title: '正在等待按天经营数据', detail: '补充至少 6 天数据后，可以判断收入和转化是否出现背离。', tone: 'neutral' };
  const firstPart = recentWeek.slice(0, 3);
  const lastPart = recentWeek.slice(-3);
  const firstGmv = firstPart.reduce((sum, item) => sum + item.gmv, 0) / firstPart.length;
  const lastGmv = lastPart.reduce((sum, item) => sum + item.gmv, 0) / lastPart.length;
  const firstConversion = firstPart.reduce((sum, item) => sum + item.paidOrders, 0) / firstPart.reduce((sum, item) => sum + item.visitors, 0);
  const lastConversion = lastPart.reduce((sum, item) => sum + item.paidOrders, 0) / lastPart.reduce((sum, item) => sum + item.visitors, 0);
  const gmvChange = (lastGmv / firstGmv - 1) * 100;
  const conversionChange = (lastConversion - firstConversion) * 100;
  if (gmvChange > 5 && conversionChange < 0) return { level: '重点关注', title: '收入增长，但支付效率在下降', detail: `最近 3 天日均 GMV 较周初提升 ${gmvChange.toFixed(1)}%，支付转化却下降 ${Math.abs(conversionChange).toFixed(1)} 个百分点。建议先排查高峰期商品组合和出餐效率。`, tone: 'alert' };
  return { level: '趋势向好', title: '收入与支付效率保持同步', detail: `最近 3 天日均 GMV 较周初变化 ${gmvChange.toFixed(1)}%，支付转化变化 ${conversionChange.toFixed(1)} 个百分点，暂未发现明显背离。`, tone: 'good' };
}

function getReviewInsight(reviews: ReviewRecord[]) {
  const lowScore = reviews.filter((review) => review.rating <= 3);
  const issue = ['等待过长', '漏品', '缺货', '包装漏液'].map((tag) => ({ tag, count: lowScore.filter((review) => review.issueTag === tag).length })).sort((a, b) => b.count - a.count)[0];
  if (!lowScore.length || !issue?.count) return { level: '状态良好', title: '评价反馈暂无集中风险', detail: '当前没有识别到需要优先处理的低分评价模式。', tone: 'good' };
  return { level: '需要处理', title: `低分评价集中在“${issue.tag}”`, detail: `${lowScore.length} 条低分评价中，有 ${issue.count} 条涉及${issue.tag}。建议将这类订单作为下周复盘的重点样本。`, tone: 'alert' };
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

function answerBusinessQuestion(question: string, metrics: typeof initialMetrics, actionPlan: ReturnType<typeof buildActionPlan>, dailyMetrics: DailyRecord[]) {
  const normalized = question.toLowerCase();
  if (normalized.includes('gmv') || normalized.includes('增长') || normalized.includes('转化')) {
    const recentWeek = dailyMetrics.slice(-7);
    const peak = recentWeek.reduce((current, item) => !current || item.gmv > current.gmv ? item : current, recentWeek[0]);
    return `当前 GMV 为 ${metrics.gmv}，支付转化率为 ${metrics.conversionRate}。最近 7 天中，${peak ? `${peak.date.slice(5).replace('-', '/')} 的 GMV 最高，为 ¥${peak.gmv.toLocaleString('zh-CN')}` : '按天数据正在读取'}。收入变化不能只归因于单一指标，需要同时看访客、支付、等待时长和优惠；当前优先动作仍是：${actionPlan.actions[0]}`;
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
  const [completedActions, setCompletedActions] = useState<string[]>([]);
  const [actionProgressReady, setActionProgressReady] = useState(false);
  const [reviewNote, setReviewNote] = useState<ReviewNote>({ outcome: '观察中', note: '', savedAt: '' });
  const [reviewNoteReady, setReviewNoteReady] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [question, setQuestion] = useState('为什么这周 GMV 增长了，转化率却下降？');
  const [answer, setAnswer] = useState('');
  const [useModel, setUseModel] = useState(false);
  const [answerSource, setAnswerSource] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [dataSource, setDataSource] = useState('正在读取 CSV 数据…');
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [productSource, setProductSource] = useState('正在读取 product_metrics.csv');
  const [productUploadMessage, setProductUploadMessage] = useState('');
  const [dailyMetrics, setDailyMetrics] = useState<DailyRecord[]>([]);
  const [dailySource, setDailySource] = useState('正在读取 daily_metrics.csv');
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [reviewSource, setReviewSource] = useState('正在读取 reviews.csv');
  const [uploadMessage, setUploadMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [peakHourInsight, setPeakHourInsight] = useState({ level: '分析中', title: '正在读取午高峰数据', detail: '稍后将根据等待时间与转化率完成诊断。', tone: 'neutral' });
  const conversionRate = Number(metrics.conversionRate.replace('%', '')) / 100;
  const repeatPurchaseRate = Number(metrics.repeatPurchaseRate.replace('%', '')) / 100;
  const deliveryRating = Number(metrics.deliveryRating);
  const actionPlan = buildActionPlan(conversionRate, repeatPurchaseRate, deliveryRating);
  const diagnosisInsights = [getConversionInsight(conversionRate), getDailyTrendInsight(dailyMetrics), getReviewInsight(reviews)];
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

  function toggleAction(action: string) {
    setCompletedActions((current) => current.includes(action) ? current.filter((item) => item !== action) : [...current, action]);
  }

  function clearActions() {
    setCompletedActions([]);
  }

  function saveReviewNote(outcome: string, note: string) {
    setReviewNote({ outcome, note: note.trim(), savedAt: new Date().toLocaleDateString('zh-CN') });
  }

  function clearReviewNote() {
    setReviewNote({ outcome: '观察中', note: '', savedAt: '' });
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
        setCompletedActions([]);
        clearReviewNote();
        setUploadMessage('上传成功：看板和诊断已按新数据刷新');
      } catch (error) {
        setUploadMessage(error instanceof Error ? `上传失败：${error.message}` : '上传失败，请检查文件格式');
      }
    };
    reader.readAsText(file, 'utf-8');
    event.target.value = '';
  }

  function handleProductUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setProductUploadMessage('请选择 CSV 格式的商品明细文件');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setProducts(readProductMetrics(String(reader.result)));
        setProductSource(`已上传 ${file.name}`);
        setProductUploadMessage('上传成功：商品机会已按新数据重新排序');
      } catch (error) {
        setProductUploadMessage(error instanceof Error ? `上传失败：${error.message}` : '上传失败，请检查文件格式');
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
      setAnswer(answerBusinessQuestion(cleanedQuestion, metrics, actionPlan, dailyMetrics));
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
      setAnswer(`${unavailableReason}\n\n以下为规则版分析：${answerBusinessQuestion(cleanedQuestion, metrics, actionPlan, dailyMetrics)}`);
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
    try {
      const saved = window.localStorage.getItem('merchantmind-action-progress');
      if (saved) setCompletedActions(JSON.parse(saved) as string[]);
    } catch {
      window.localStorage.removeItem('merchantmind-action-progress');
    } finally {
      setActionProgressReady(true);
    }
  }, []);

  useEffect(() => {
    if (actionProgressReady) window.localStorage.setItem('merchantmind-action-progress', JSON.stringify(completedActions));
  }, [actionProgressReady, completedActions]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('merchantmind-review-note');
      if (saved) setReviewNote(JSON.parse(saved) as ReviewNote);
    } catch {
      window.localStorage.removeItem('merchantmind-review-note');
    } finally {
      setReviewNoteReady(true);
    }
  }, []);

  useEffect(() => {
    if (reviewNoteReady) window.localStorage.setItem('merchantmind-review-note', JSON.stringify(reviewNote));
  }, [reviewNoteReady, reviewNote]);

  useEffect(() => {
    fetch('/data/reviews.csv')
      .then((response) => response.text())
      .then((csv) => { setReviews(readReviews(csv)); setReviewSource('已读取 reviews.csv'); })
      .catch(() => { setReviews([]); setReviewSource('暂时没有可读取的评价数据'); });
  }, []);

  useEffect(() => {
    fetch('/data/daily_metrics.csv')
      .then((response) => response.text())
      .then((csv) => { setDailyMetrics(readDailyMetrics(csv)); setDailySource('已读取 daily_metrics.csv'); })
      .catch(() => { setDailyMetrics([]); setDailySource('暂时没有可读取的按天数据'); });
  }, []);

  useEffect(() => {
    fetch('/data/product_metrics.csv')
      .then((response) => response.text())
      .then((csv) => {
        setProducts(readProductMetrics(csv));
        setProductSource('已读取 product_metrics.csv');
      })
      .catch(() => { setProducts([]); setProductSource('暂时没有可读取的商品数据'); });
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
      <header className="topbar"><div><p className="eyebrow">{tab} · 2026/08/18 — 08/24 · {dataSource}</p><h1>{pageTitle}</h1>{uploadMessage && <p className={`upload-message ${uploadMessage.startsWith('上传成功') ? 'success' : 'error'}`}>{uploadMessage}</p>}</div><div><input ref={fileInputRef} className="file-input" type="file" accept=".csv,text/csv" onChange={handleUpload}/><button className="upload" onClick={() => fileInputRef.current?.click()}>＋ 上传经营数据</button><p className="upload-hint">支持核心指标 CSV 上传</p></div></header>
      {tab === '总览' ? <><section className="hero-card"><div><p className="eyebrow light">本周经营健康度</p><div className="score-row"><strong>82</strong><span>/ 100</span><b>↑ 6 分</b></div><p>整体稳定，午高峰转化和外卖体验值得优先处理。</p></div><div className="hero-action"><span>✦ AI 本周结论</span><strong>{actionPlan.title}</strong><button onClick={() => setReport(!report)}>{report ? '收起行动方案' : '生成行动方案 →'}</button></div></section>
      {report && <section className="report"><strong>已根据当前数据生成 3 项优先动作</strong><p className="decision-basis">判断依据：{actionPlan.basis}</p><ol className="report-list">{actionPlan.actions.map((action) => <li key={action}>{action}</li>)}</ol></section>}
      <section className="metrics" aria-label="核心指标"><Metric label="GMV" value={metrics.gmv} change="↑ 12.4%" /><Metric label="支付转化率" value={metrics.conversionRate} change="↓ 1.6%" down/><Metric label="复购率" value={metrics.repeatPurchaseRate} change="↑ 3.1%"/><Metric label="外卖好评率" value={metrics.deliveryRating} change="↓ 0.08" down/></section>
      <section className="grid-section">
        <DailyTrend dailyMetrics={dailyMetrics} />
        <article className="panel diagnosis"><div className="panel-head"><div><p className="eyebrow">AI 经营诊断</p><h2>今天最值得处理的事</h2></div><span className="spark">✦</span></div>{diagnosisInsights.map((x) => <div className={`insight ${x.tone}`} key={x.title}><span>{x.level}</span><div><strong>{x.title}</strong><p>{x.detail}</p></div><button aria-label={`查看${x.title}`}>›</button></div>)}</article>
      </section>
      <section className="panel ask"><div><p className="eyebrow">问问你的 AI 运营助手</p><h2>“为什么这周 GMV 增长了，转化率却下降？”</h2></div><button onClick={() => setAskOpen(!askOpen)}>{askOpen ? '收起问答' : '开始分析'} <span>→</span></button></section>
      {askOpen && <section className="ask-workspace" aria-label="运营问答"><div className="ask-intro"><div><p className="eyebrow">数据问答</p><h2>基于当前上传的经营数据提问</h2></div><span>{useModel ? '大模型优先' : '规则版回答'}</span></div><label className="model-switch"><input type="checkbox" checked={useModel} onChange={(event) => setUseModel(event.target.checked)}/><span>优先使用 OpenAI 大模型生成回答</span><small>未开通额度时自动使用规则版</small></label><div className="question-chips"><button onClick={() => submitQuestion('为什么这周 GMV 增长了，转化率却下降？')}>GMV 与转化</button><button onClick={() => submitQuestion('如何提高复购？')}>如何提高复购？</button><button onClick={() => submitQuestion('外卖评分需要处理吗？')}>外卖评分需要处理吗？</button></div><div className="question-form"><input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submitQuestion(); }} aria-label="输入经营问题" placeholder="例如：应该先做引流还是复购？"/><button disabled={isAnalyzing} onClick={() => submitQuestion()}>{isAnalyzing ? '分析中…' : '分析'}</button></div>{answer && <div className="answer-card"><span>✦ {answerSource || '分析结果'}</span><p>{answer}</p></div>}</section>}
      </> : tab === '经营数据' ? <DataWorkspace metrics={metrics} dataSource={dataSource} dailyMetrics={dailyMetrics} dailySource={dailySource} products={products} reviews={reviews} reviewSource={reviewSource} /> : tab === 'AI 诊断' ? <DiagnosisWorkspace insights={diagnosisInsights} actionPlan={actionPlan} reviews={reviews} metrics={metrics} completedActions={completedActions} reviewNote={reviewNote} onToggleAction={toggleAction} onClearActions={clearActions} onSaveReviewNote={saveReviewNote} onClearReviewNote={clearReviewNote} /> : <ProductWorkspace products={products} productSource={productSource} productUploadMessage={productUploadMessage} onUpload={handleProductUpload} />}
    </section>
  </main>;
}
function Metric({ label, value, change, down = false }: { label: string; value: string; change: string; down?: boolean }) { return <article className="metric"><p>{label}</p><strong>{value}</strong><span className={down ? 'down' : ''}>{change}</span></article>; }

function DataWorkspace({ metrics, dataSource, dailyMetrics, dailySource, products, reviews, reviewSource }: { metrics: typeof initialMetrics; dataSource: string; dailyMetrics: DailyRecord[]; dailySource: string; products: ProductRecord[]; reviews: ReviewRecord[]; reviewSource: string }) {
  const fields = [
    { label: 'GMV', value: metrics.gmv, description: '本周成交金额，用于观察收入规模。' },
    { label: '支付转化率', value: metrics.conversionRate, description: '从访问到支付的效率，用于发现下单阻力。' },
    { label: '复购率', value: metrics.repeatPurchaseRate, description: '顾客再次购买比例，用于衡量留存质量。' },
    { label: '外卖好评率', value: metrics.deliveryRating, description: '配送体验反馈，用于守住口碑。' },
  ];
  return <section className="workspace-page">
    <section className="workspace-hero"><div><p className="eyebrow">数据接入</p><h2>当前数据快照已准备好</h2><p>先确保数据正确，再让 AI 基于同一份事实给出建议。</p></div><span className="status-pill">● 数据已就绪</span></section>
    <section className="data-summary-grid"><article className="panel source-panel"><p className="eyebrow">经营周报</p><h2>{dataSource}</h2><p>核心指标用于决定本周经营优先级，并和按天、商品、评价数据交叉验证。</p><div className="source-status"><span>核心字段</span><strong>4 / 4 已完整</strong></div></article><article className="panel quality-panel"><p className="eyebrow">按天经营数据</p><h2>{dailySource}</h2><ul><li><span>✓</span> 已识别 {dailyMetrics.length} 天访客、浏览、加购、支付与 GMV</li><li><span>✓</span> 含优惠、退款、出餐等待和外卖评分</li><li><span>✓</span> 总览趋势图已从真实数值渲染</li></ul></article></section>
    <section className="data-coverage"><article><strong>{dailyMetrics.length}</strong><span>天经营漏斗数据</span><small>访问 → 浏览 → 加购 → 支付 → GMV</small></article><article><strong>{products.length}</strong><span>个商品明细</span><small>销量、收入、毛利、复购、评分、缺货</small></article><article><strong>{reviews.length}</strong><span>条顾客评价</span><small>{reviewSource}</small></article></section>
    <section className="panel sample-data-panel"><div className="panel-head"><div><p className="eyebrow">数据使用方式</p><h2>先直接体验，再按需替换数据</h2></div><span className="period">演示模式已就绪</span></div><p>当前已自动载入 28 天经营、8 个商品和 12 条评价，无需下载或上传即可体验完整诊断流程。</p><div className="simple-data-flow"><article><span>01</span><div><strong>使用演示数据</strong><p>直接浏览总览、AI 诊断和商品分析，理解系统如何定位问题。</p></div></article><article><span>02</span><div><strong>需要时再换自己的数据</strong><p>仅需上传经营周报（右上角）和商品明细（商品分析页），其余数据先由系统内置。</p></div></article></div></section>
    <section className="panel daily-table-panel"><div className="panel-head"><div><p className="eyebrow">最近 7 天经营明细</p><h2>从收入变化追到经营环节</h2></div><span className="period">28 天样例数据</span></div><div className="daily-table"><div className="daily-table-row daily-table-head"><span>日期</span><span>访客</span><span>支付</span><span>GMV</span></div>{dailyMetrics.slice(-7).map((item) => <div className="daily-table-row" key={item.date}><span>{item.date.slice(5).replace('-', '/')}</span><span>{item.visitors}</span><span>{item.paidOrders}</span><strong>¥{item.gmv.toLocaleString('zh-CN')}</strong></div>)}</div></section>
    <section className="panel field-panel"><div className="panel-head"><div><p className="eyebrow">字段字典</p><h2>每个数字具体代表什么？</h2></div><span className="period">经营周报</span></div><div className="field-table"><div className="field-row field-head"><span>字段</span><span>当前值</span><span>业务意义</span></div>{fields.map((field) => <div className="field-row" key={field.label}><strong>{field.label}</strong><b>{field.value}</b><p>{field.description}</p></div>)}</div></section>
  </section>;
}

function DailyTrend({ dailyMetrics }: { dailyMetrics: DailyRecord[] }) {
  const recentDays = dailyMetrics.slice(-7);
  const peak = recentDays.reduce((current, item) => !current || item.gmv > current.gmv ? item : current, recentDays[0]);
  const maxGmv = Math.max(...recentDays.map((item) => item.gmv), 1);
  return <article className="panel trend"><div className="panel-head"><div><p className="eyebrow">GMV 趋势 · 按天数据</p><h2>{peak ? `${peak.date.slice(5).replace('-', '/')} 达到本周收入峰值` : '正在读取按天经营数据'}</h2></div><span className="period">最近 7 天 / 共 {dailyMetrics.length} 天</span></div>{recentDays.length > 0 ? <><div className="daily-bars">{recentDays.map((item) => <div className="daily-bar-item" key={item.date}><span>¥{(item.gmv / 1000).toFixed(1)}k</span><i style={{ height: `${Math.max(14, item.gmv / maxGmv * 100)}%` }} /><b>{item.date.slice(5).replace('-', '/')}</b></div>)}</div><div className="legend"><span><i className="dot purple"/>GMV（每日成交金额）</span><span>近 7 天 ¥{recentDays.reduce((sum, item) => sum + item.gmv, 0).toLocaleString('zh-CN')}</span></div></> : <p className="empty-data">暂无按天数据。</p>}</article>;
}

function DiagnosisWorkspace({ insights, actionPlan, reviews, metrics, completedActions, reviewNote, onToggleAction, onClearActions, onSaveReviewNote, onClearReviewNote }: { insights: Array<{ level: string; title: string; detail: string; tone: string }>; actionPlan: { title: string; basis: string; actions: string[] }; reviews: ReviewRecord[]; metrics: typeof initialMetrics; completedActions: string[]; reviewNote: ReviewNote; onToggleAction: (action: string) => void; onClearActions: () => void; onSaveReviewNote: (outcome: string, note: string) => void; onClearReviewNote: () => void }) {
  const [showReviewSamples, setShowReviewSamples] = useState(false);
  const [draftOutcome, setDraftOutcome] = useState(reviewNote.outcome);
  const [draftNote, setDraftNote] = useState(reviewNote.note);
  const lowScoreReviews = reviews.filter((review) => review.rating <= 3);
  const waitIssues = lowScoreReviews.filter((review) => review.issueTag === '等待过长').length;
  const topIssue = ['等待过长', '漏品', '缺货', '包装漏液'].map((tag) => ({ tag, count: lowScoreReviews.filter((review) => review.issueTag === tag).length })).sort((a, b) => b.count - a.count)[0];
  const reviewSamples = [...lowScoreReviews].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const checkpoints = [
    { label: '支付转化率', baseline: metrics.conversionRate, target: `≥ ${(Number(metrics.conversionRate.replace('%', '')) + 0.5).toFixed(1)}%`, meaning: '午高峰商品组合与出餐效率' },
    { label: '复购率', baseline: metrics.repeatPurchaseRate, target: `≥ ${(Number(metrics.repeatPurchaseRate.replace('%', '')) + 2).toFixed(1)}%`, meaning: '复购券与加购组合是否有效' },
    { label: '外卖好评率', baseline: metrics.deliveryRating, target: `≥ ${(Number(metrics.deliveryRating) + 0.05).toFixed(2)}`, meaning: '低分订单修复是否改善体验' },
  ];
  useEffect(() => { setDraftOutcome(reviewNote.outcome); setDraftNote(reviewNote.note); }, [reviewNote]);
  return <section className="workspace-page"><section className="workspace-hero"><div><p className="eyebrow">诊断中心</p><h2>先做最值得做的一件事</h2><p>诊断不只告诉商家“哪里有问题”，还会给出判断依据和可验证的行动。</p></div><span className="status-pill">✦ 已生成优先级</span></section><section className="priority-card"><span className="priority-index">P1</span><div><p className="eyebrow light">本周最高优先级</p><h2>{actionPlan.title}</h2><p>{actionPlan.basis}</p></div><div className="priority-action"><span>建议先做</span><strong>{actionPlan.actions[0]}</strong></div></section><section className="review-evidence"><article><span>低分评价</span><strong>{lowScoreReviews.length} 条</strong><p>评分 ≤ 3 的真实评价</p></article><article><span>最集中问题</span><strong>{topIssue?.tag || '暂无'}</strong><p>{topIssue?.count || 0} 条评价涉及该问题</p></article><article><span>等待相关</span><strong>{waitIssues} 条</strong><p>可和高峰时段、出餐数据交叉分析</p></article></section><section className="review-samples"><button className="review-toggle" onClick={() => setShowReviewSamples((visible) => !visible)}>{showReviewSamples ? '收起低分评价样本' : `查看 ${lowScoreReviews.length} 条低分评价样本`}<span>{showReviewSamples ? '⌃' : '⌄'}</span></button>{showReviewSamples && <div className="review-sample-list">{reviewSamples.length > 0 ? reviewSamples.map((review) => <article key={`${review.date}-${review.productName}-${review.comment}`}><div className="review-sample-meta"><span>{review.date}</span><span>{review.channel}</span><span>{review.productName}</span><strong>{review.rating} 分</strong></div><p><b>{review.issueTag}</b>{review.comment}</p></article>) : <p className="review-empty">当前数据中没有低分评价。</p>}</div>}</section><section className="action-tracker"><div className="action-tracker-head"><div><p className="eyebrow">本周行动方案</p><h2>执行 {completedActions.length} / {actionPlan.actions.length}</h2></div><div className="action-tracker-tools"><span>本机保存 · 建议 7 天后复盘</span>{completedActions.length > 0 && <button onClick={onClearActions}>清空进度</button>}</div></div>{actionPlan.actions.map((action, index) => <article className={completedActions.includes(action) ? 'action-item completed' : 'action-item'} key={action}><button aria-label={`标记${action}完成`} onClick={() => onToggleAction(action)}>{completedActions.includes(action) ? '✓' : `0${index + 1}`}</button><div><strong>{action}</strong><p>{index === 0 ? '本周开始执行' : index === 1 ? '执行中观察顾客反馈' : '下周用数据验证效果'}</p></div><span>{completedActions.includes(action) ? '已完成' : '待执行'}</span></article>)}</section><section className="review-checkpoint"><div className="review-checkpoint-head"><div><p className="eyebrow">7 天后复盘</p><h2>用目标验证行动有没有效果</h2></div><span>{reviewNote.savedAt ? `已保存 · ${reviewNote.savedAt}` : '等待第一次复盘'}</span></div><p className="review-checkpoint-intro">当前数值是本周基线；下次上传周报后，按下面目标判断行动是否值得保留。</p><div className="checkpoint-table"><div className="checkpoint-row checkpoint-head"><span>指标</span><span>本周基线</span><span>下周验证目标</span><span>对应动作</span></div>{checkpoints.map((checkpoint) => <div className="checkpoint-row" key={checkpoint.label}><strong>{checkpoint.label}</strong><b>{checkpoint.baseline}</b><em>{checkpoint.target}</em><p>{checkpoint.meaning}</p></div>)}</div><div className="review-note-form"><label><span>本轮判断</span><select value={draftOutcome} onChange={(event) => setDraftOutcome(event.target.value)}><option>观察中</option><option>已验证有效</option><option>需要调整</option></select></label><label><span>复盘备注</span><textarea value={draftNote} onChange={(event) => setDraftNote(event.target.value)} placeholder="例如：午高峰套餐已测试 5 天，转化有所改善；下周继续观察。" /></label><div className="review-note-actions"><button onClick={() => onSaveReviewNote(draftOutcome, draftNote)}>保存本机复盘</button>{reviewNote.savedAt && <button className="clear-review" onClick={onClearReviewNote}>清空</button>}</div></div></section><section className="diagnosis-board">{insights.map((insight, index) => <article className={`diagnosis-detail ${insight.tone}`} key={insight.title}><div className="diagnosis-number">0{index + 1}</div><div><span>{insight.level}</span><h3>{insight.title}</h3><p>{insight.detail}</p></div><div className="diagnosis-next"><small>下一步</small><strong>{actionPlan.actions[index] || '持续观察相关指标，并在下周复盘。'}</strong></div></article>)}</section></section>;
}

function ProductWorkspace({ products, productSource, productUploadMessage, onUpload }: { products: ProductRecord[]; productSource: string; productUploadMessage: string; onUpload: (event: ChangeEvent<HTMLInputElement>) => void }) {
  const productInputRef = useRef<HTMLInputElement>(null);
  const productCards = products.map((product) => {
    if (product.rating < 4.7 || product.outOfStockCount > 0) return { product, level: '需要处理', detail: `评分 ${product.rating.toFixed(2)}，缺货 ${product.outOfStockCount} 次，体验可能影响后续购买。`, action: '检查低分反馈与缺货原因，优先修复体验问题。', tone: 'alert' };
    if (product.repeatPurchaseRate >= 0.3) return { product, level: '增长机会', detail: `复购率 ${(product.repeatPurchaseRate * 100).toFixed(0)}%，高于本项目设定的 30% 增长线。`, action: '搭配高毛利商品测试“第二杯 / 加购”组合。', tone: 'good' };
    return { product, level: '持续观察', detail: `销量 ${product.unitsSold} 件，毛利率 ${(product.grossMargin * 100).toFixed(0)}%，暂未发现紧急风险。`, action: '保留商品并持续观察销量、评分与复购变化。', tone: 'neutral' };
  }).sort((a, b) => (a.tone === 'alert' ? -1 : b.tone === 'alert' ? 1 : b.product.revenue - a.product.revenue));
  const totalRevenue = products.reduce((sum, product) => sum + product.revenue, 0);
  return <section className="workspace-page">
    <section className="workspace-hero product-workspace-hero">
      <div><p className="eyebrow">商品机会 · {productSource}</p><h2>用商品明细找到增长与风险</h2><p>当前判断同时参考销量、收入、毛利、复购、评分和缺货次数。</p></div>
      <div className="product-header-actions"><input ref={productInputRef} className="file-input" type="file" accept=".csv,text/csv" onChange={onUpload}/><button onClick={() => productInputRef.current?.click()}>＋ 上传商品明细</button><details className="field-requirements"><summary>查看字段要求</summary><p>商品名称、品类、销量、收入、毛利率、复购率、评分、缺货次数。</p></details><span className="status-pill">{products.length || '…'} 个商品已分析</span></div>
    </section>
    {productUploadMessage && <p className={`product-upload-message top-message ${productUploadMessage.startsWith('上传成功') ? 'success' : 'error'}`}>{productUploadMessage}</p>}
    <section className="product-summary"><article><span>商品收入合计</span><strong>¥{totalRevenue.toLocaleString('zh-CN')}</strong></article><article><span>需要优先处理</span><strong>{productCards.filter((item) => item.tone === 'alert').length} 个</strong></article><article><span>复购增长机会</span><strong>{productCards.filter((item) => item.level === '增长机会').length} 个</strong></article></section>
    <section className="product-grid">{productCards.map(({ product, level, detail, action, tone }) => <article className="product-card" key={product.productName}><div className="product-top"><span className={`tag ${tone}`}>{level}</span><b>收入 ¥{product.revenue.toLocaleString('zh-CN')}</b></div><h3>{product.productName}</h3><p>{detail}</p><div className="product-meta"><span>{product.category}</span><span>销量 {product.unitsSold}</span><span>毛利 {(product.grossMargin * 100).toFixed(0)}%</span></div><div className="product-action"><small>建议动作</small><strong>{action}</strong></div></article>)}</section>
  </section>;
}
