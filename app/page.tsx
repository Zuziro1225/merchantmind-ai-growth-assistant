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
import './week-comparison.css';
import './daily-anomaly.css';
import './diagnosis-fold.css';
import './dashboard-overview.css';

const initialMetrics = {
  gmv: '¥48,620',
  conversionRate: '7.8%',
  repeatPurchaseRate: '22.6%',
  deliveryRating: '4.76',
};

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
type AnalysisRange = 7 | 14 | 28 | 180 | 365;
type SavedWeeklyUpload = { record: MetricRecord; fileName: string };
type SavedDailyUpload = { records: DailyRecord[]; fileName: string };
type SavedProductUpload = { records: ProductRecord[]; fileName: string };

const weeklyUploadStorageKey = 'merchantmind-weekly-upload';
const dailyUploadStorageKey = 'merchantmind-daily-upload';
const productUploadStorageKey = 'merchantmind-product-upload';

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const source = csv.replace(/^\uFEFF/, '');

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (inQuotes && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  if (inQuotes) throw new Error('CSV 中有未闭合的英文双引号');
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function toRecords(headers: string[], rows: string[][]): MetricRecord[] {
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

function readRate(value: string, fieldName: string): number {
  const raw = value.trim();
  const usesPercentSign = raw.endsWith('%');
  const number = Number(usesPercentSign ? raw.slice(0, -1).trim() : raw);
  if (Number.isNaN(number) || number < 0 || (usesPercentSign && number > 100) || (!usesPercentSign && number > 1)) {
    throw new Error(`${fieldName}请填写 0 到 1 的小数，或带 % 的百分比`);
  }
  return usesPercentSign ? number / 100 : number;
}

function readNonNegativeNumber(value: string, fieldName: string): number {
  const number = Number(value);
  if (Number.isNaN(number) || number < 0) throw new Error(`${fieldName}需要填写大于或等于 0 的数字`);
  return number;
}

function readWeeklyMetrics(csv: string): MetricRecord {
  const rows = parseCsvRows(csv);
  if (rows.length < 2) throw new Error('文件中需要包含表头和至少一行数据');

  const headers = rows[0];
  const values = rows[1];
  const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  const missing = requiredMetricFields.filter((field) => !record[field]);

  if (missing.length) throw new Error('缺少必填字段：' + missing.join('、'));
  const gmv = readNonNegativeNumber(record.gmv, 'GMV');
  const deliveryRating = Number(record.delivery_rating);
  if (Number.isNaN(deliveryRating) || deliveryRating < 0 || deliveryRating > 5) throw new Error('外卖好评率请填写 0 到 5 的数字');
  return { ...record, gmv: String(gmv), payment_conversion_rate: String(readRate(record.payment_conversion_rate, '支付转化率')), repeat_purchase_rate: String(readRate(record.repeat_purchase_rate, '复购率')), delivery_rating: String(deliveryRating) };
}

function readProductMetrics(csv: string): ProductRecord[] {
  const csvRows = parseCsvRows(csv);
  if (csvRows.length < 2) throw new Error('文件中需要包含表头和至少一条商品数据');
  const headers = csvRows[0];
  const missing = requiredProductFields.filter((field) => !headers.includes(field));
  if (missing.length) throw new Error('缺少必填字段：' + missing.join('、'));
  const rows = toRecords(headers, csvRows.slice(1));
  const records = rows.map((row, index) => {
    const rowLabel = `第 ${index + 2} 行`;
    if (!row.product_name || !row.category) throw new Error(`${rowLabel}缺少商品名称或品类`);
    const rating = Number(row.rating);
    if (Number.isNaN(rating) || rating < 0 || rating > 5) throw new Error(`${rowLabel}评分请填写 0 到 5 的数字`);
    return {
      productName: row.product_name,
      category: row.category,
      unitsSold: readNonNegativeNumber(row.units_sold, `${rowLabel}销量`),
      revenue: readNonNegativeNumber(row.revenue, `${rowLabel}收入`),
      grossMargin: readRate(row.gross_margin, `${rowLabel}毛利率`),
      repeatPurchaseRate: readRate(row.repeat_purchase_rate, `${rowLabel}复购率`),
      rating,
      outOfStockCount: readNonNegativeNumber(row.out_of_stock_count, `${rowLabel}缺货次数`),
    };
  });
  return records;
}

function readDailyMetrics(csv: string): DailyRecord[] {
  const csvRows = parseCsvRows(csv);
  if (csvRows.length < 2) throw new Error('文件中需要包含表头和至少一天数据');
  const headers = csvRows[0];
  const required = ['date', 'visitors', 'orders', 'paid_orders', 'gmv'];
  const missing = required.filter((field) => !headers.includes(field));
  if (missing.length) throw new Error('缺少必填字段：' + missing.join('、'));
  const records = toRecords(headers, csvRows.slice(1)).map((row, index) => {
    const rowLabel = `第 ${index + 2} 行`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) throw new Error(`${rowLabel}日期请使用 YYYY-MM-DD 格式`);
    const deliveryRating = Number(row.delivery_rating);
    if (Number.isNaN(deliveryRating) || deliveryRating < 0 || deliveryRating > 5) throw new Error(`${rowLabel}外卖好评率请填写 0 到 5 的数字`);
    return {
      date: row.date,
      visitors: readNonNegativeNumber(row.visitors, `${rowLabel}访客`),
      orders: readNonNegativeNumber(row.orders, `${rowLabel}下单订单`),
      paidOrders: readNonNegativeNumber(row.paid_orders, `${rowLabel}支付订单`),
      gmv: readNonNegativeNumber(row.gmv, `${rowLabel}GMV`),
      avgWaitMinutes: readNonNegativeNumber(row.avg_wait_minutes, `${rowLabel}平均等待`),
      deliveryRating,
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
  if (new Set(records.map((record) => record.date)).size !== records.length) throw new Error('按天数据中存在重复日期，请保留每个日期的一条汇总记录');
  return records;
}

function readReviews(csv: string): ReviewRecord[] {
  const csvRows = parseCsvRows(csv);
  const headers = csvRows[0] || [];
  const required = ['date', 'channel', 'product_name', 'rating', 'issue_tag', 'comment'];
  if (required.some((field) => !headers.includes(field))) throw new Error('评价数据缺少必要字段');
  return toRecords(headers, csvRows.slice(1)).map((row) => {
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
  const [analysisRange, setAnalysisRange] = useState<AnalysisRange>(7);
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
  const [dailyUploadMessage, setDailyUploadMessage] = useState('');
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [uploadMessage, setUploadMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const conversionRate = Number(metrics.conversionRate.replace('%', '')) / 100;
  const repeatPurchaseRate = Number(metrics.repeatPurchaseRate.replace('%', '')) / 100;
  const deliveryRating = Number(metrics.deliveryRating);
  const actionPlan = buildActionPlan(conversionRate, repeatPurchaseRate, deliveryRating);
  const hasSavedWeeklyUpload = dataSource.startsWith('已上传') || dataSource.startsWith('已从本机恢复');
  const hasSavedDailyUpload = dailySource.startsWith('已上传') || dailySource.startsWith('已从本机恢复');
  const diagnosisInsights = hasSavedWeeklyUpload
    ? [getConversionInsight(conversionRate), hasSavedDailyUpload ? getDailyTrendInsight(dailyMetrics) : { level: '需要更多数据', title: '按天趋势等待补充', detail: '当前已上传经营汇总；如需定位具体日期和高峰问题，需要补充按天经营记录。', tone: 'neutral' }]
    : [getConversionInsight(conversionRate), getDailyTrendInsight(dailyMetrics), getReviewInsight(reviews)];
  const pageTitle = tab === '总览'
    ? '我是子月，我正在用 AI 帮商家找到增长机会。'
    : tab === '经营数据'
      ? '让每一条经营数据都能支持一个判断。'
      : tab === 'AI 诊断'
      ? '把指标变化，转成清晰的下一步行动。'
        : '找到值得持续投入的商品机会。';
  const rangeLabel = analysisRange === 7 ? '近 7 天' : analysisRange === 14 ? '近 14 天' : analysisRange === 28 ? '近 1 月' : analysisRange === 180 ? '近 6 个月' : '近 1 年';
  const topbarContext = tab === '经营数据'
    ? `经营数据 · ${rangeLabel} · 已加载 ${dailyMetrics.length} 天历史数据`
    : tab === '商品分析'
      ? `商品分析 · ${productSource}`
    : `${tab} · 2026/08/18 — 08/24 · ${dataSource}`;
  const hasSavedProductUpload = productSource.startsWith('已上传') || productSource.startsWith('已从本机恢复');

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
        window.localStorage.setItem(weeklyUploadStorageKey, JSON.stringify({ record, fileName: file.name } satisfies SavedWeeklyUpload));
        setCompletedActions([]);
        clearReviewNote();
        setUploadMessage('上传成功：看板和诊断已按新数据刷新，数据已保存在当前浏览器');
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
        const records = readProductMetrics(String(reader.result));
        setProducts(records);
        setProductSource(`已上传 ${file.name}`);
        window.localStorage.setItem(productUploadStorageKey, JSON.stringify({ records, fileName: file.name } satisfies SavedProductUpload));
        setProductUploadMessage('上传成功：商品机会已按新数据重新排序，数据已保存在当前浏览器');
      } catch (error) {
        setProductUploadMessage(error instanceof Error ? `上传失败：${error.message}` : '上传失败，请检查文件格式');
      }
    };
    reader.readAsText(file, 'utf-8');
    event.target.value = '';
  }

  function handleDailyUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setDailyUploadMessage('请选择 CSV 格式的按天经营数据文件');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const records = readDailyMetrics(String(reader.result));
        setDailyMetrics(records);
        setDailySource(`已上传 ${file.name}`);
        window.localStorage.setItem(dailyUploadStorageKey, JSON.stringify({ records, fileName: file.name } satisfies SavedDailyUpload));
        setCompletedActions([]);
        clearReviewNote();
        setDailyUploadMessage(`上传成功：已读取 ${records.length} 天记录，趋势、对比和异常定位已刷新`);
      } catch (error) {
        setDailyUploadMessage(error instanceof Error ? `上传失败：${error.message}` : '上传失败，请检查文件格式');
      }
    };
    reader.readAsText(file, 'utf-8');
    event.target.value = '';
  }

  function restoreDemoMetrics() {
    window.localStorage.removeItem(weeklyUploadStorageKey);
    fetch('/data/weekly_metrics.csv')
      .then((response) => response.text())
      .then((csv) => {
        applyMetricRecord(readWeeklyMetrics(csv), '已恢复 weekly_metrics.csv');
        setCompletedActions([]);
        clearReviewNote();
        setUploadMessage('已恢复演示经营数据');
      })
      .catch(() => setUploadMessage('恢复失败：演示经营数据暂时不可用'));
  }

  function restoreDemoProducts() {
    window.localStorage.removeItem(productUploadStorageKey);
    fetch('/data/product_metrics.csv')
      .then((response) => response.text())
      .then((csv) => {
        setProducts(readProductMetrics(csv));
        setProductSource('已恢复 product_metrics.csv');
        setProductUploadMessage('已恢复演示商品明细');
      })
      .catch(() => setProductUploadMessage('恢复失败：演示商品明细暂时不可用'));
  }

  function restoreDemoDaily() {
    window.localStorage.removeItem(dailyUploadStorageKey);
    fetch('/data/daily_metrics.csv')
      .then((response) => response.text())
      .then((csv) => {
        setDailyMetrics(readDailyMetrics(csv));
        setDailySource('已恢复 daily_metrics.csv');
        setCompletedActions([]);
        clearReviewNote();
        setDailyUploadMessage('已恢复演示按天经营数据');
      })
      .catch(() => setDailyUploadMessage('恢复失败：演示按天经营数据暂时不可用'));
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
    try {
      const saved = window.localStorage.getItem(weeklyUploadStorageKey);
      if (saved) {
        const upload = JSON.parse(saved) as SavedWeeklyUpload;
        if (upload.fileName && upload.record) {
          window.setTimeout(() => applyMetricRecord(upload.record, `已从本机恢复 ${upload.fileName}`), 0);
          return;
        }
      }
    } catch {
      window.localStorage.removeItem(weeklyUploadStorageKey);
    }
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
      if (saved) window.setTimeout(() => setCompletedActions(JSON.parse(saved) as string[]), 0);
    } catch {
      window.localStorage.removeItem('merchantmind-action-progress');
    } finally {
      window.setTimeout(() => setActionProgressReady(true), 0);
    }
  }, []);

  useEffect(() => {
    if (actionProgressReady) window.localStorage.setItem('merchantmind-action-progress', JSON.stringify(completedActions));
  }, [actionProgressReady, completedActions]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('merchantmind-review-note');
      if (saved) window.setTimeout(() => setReviewNote(JSON.parse(saved) as ReviewNote), 0);
    } catch {
      window.localStorage.removeItem('merchantmind-review-note');
    } finally {
      window.setTimeout(() => setReviewNoteReady(true), 0);
    }
  }, []);

  useEffect(() => {
    if (reviewNoteReady) window.localStorage.setItem('merchantmind-review-note', JSON.stringify(reviewNote));
  }, [reviewNoteReady, reviewNote]);

  useEffect(() => {
    fetch('/data/reviews.csv')
      .then((response) => response.text())
      .then((csv) => { setReviews(readReviews(csv)); })
      .catch(() => { setReviews([]); });
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(dailyUploadStorageKey);
      if (saved) {
        const upload = JSON.parse(saved) as SavedDailyUpload;
        if (upload.fileName && Array.isArray(upload.records)) {
          window.setTimeout(() => {
            setDailyMetrics(upload.records);
            setDailySource(`已从本机恢复 ${upload.fileName}`);
          }, 0);
          return;
        }
      }
    } catch {
      window.localStorage.removeItem(dailyUploadStorageKey);
    }
    fetch('/data/daily_metrics.csv')
      .then((response) => response.text())
      .then((csv) => {
        setDailyMetrics(readDailyMetrics(csv));
        setDailySource('已读取 daily_metrics.csv');
      })
      .catch(() => { setDailyMetrics([]); setDailySource('暂时没有可读取的按天数据'); });
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(productUploadStorageKey);
      if (saved) {
        const upload = JSON.parse(saved) as SavedProductUpload;
        if (upload.fileName && Array.isArray(upload.records)) {
          window.setTimeout(() => {
            setProducts(upload.records);
            setProductSource(`已从本机恢复 ${upload.fileName}`);
          }, 0);
          return;
        }
      }
    } catch {
      window.localStorage.removeItem(productUploadStorageKey);
    }
    fetch('/data/product_metrics.csv')
      .then((response) => response.text())
      .then((csv) => {
        setProducts(readProductMetrics(csv));
        setProductSource('已读取 product_metrics.csv');
      })
      .catch(() => { setProducts([]); setProductSource('暂时没有可读取的商品数据'); });
  }, []);

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">M</span><span>MerchantMind</span></div>
      <p className="workspace">好日子咖啡 · 经营驾驶舱</p>
      <nav aria-label="主导航">{['总览', '经营数据', 'AI 诊断', '商品分析'].map((item) => <button key={item} onClick={() => setTab(item)} className={tab === item ? 'nav-item active' : 'nav-item'}><span>{item === '总览' ? '◈' : item === '经营数据' ? '⌁' : item === 'AI 诊断' ? '✦' : '◌'}</span>{item}</button>)}</nav>
      <div className="sidebar-footer"><span className="avatar">张</span><div><strong>子月的作品集</strong><small>演示模式</small></div></div>
    </aside>
    <section className="content">
      <header className="topbar"><div><p className="eyebrow">{topbarContext}</p><h1>{pageTitle}</h1>{uploadMessage && <p className={`upload-message ${uploadMessage.startsWith('上传成功') || uploadMessage.startsWith('已恢复') ? 'success' : 'error'}`}>{uploadMessage}</p>}</div><div><input ref={fileInputRef} className="file-input" type="file" accept=".csv,text/csv" onChange={handleUpload}/><button className="upload" onClick={() => fileInputRef.current?.click()}>＋ 上传经营数据</button>{hasSavedWeeklyUpload && <button className="restore-demo" onClick={restoreDemoMetrics}>恢复演示数据</button>}<p className="upload-hint">支持核心指标 CSV 上传 · <a href="/data/weekly_metrics.csv" download="经营周报案例.csv">下载案例</a></p></div></header>
      {tab === '总览' ? <><section className="hero-card"><div><p className="eyebrow light">当前经营健康度</p><div className="score-row"><strong>82</strong><span>/ 100</span><b>↑ 6 分</b></div></div><div className="hero-action"><span>✦ AI 给出的下一步</span><strong>{actionPlan.title}</strong><button onClick={() => setTab('AI 诊断')}>查看完整诊断 →</button></div></section>
      <section className="metrics" aria-label="核心指标"><Metric label="GMV" value={metrics.gmv} change="↑ 12.4%" /><Metric label="支付转化率" value={metrics.conversionRate} change="↓ 1.6%" down/><Metric label="复购率" value={metrics.repeatPurchaseRate} change="↑ 3.1%"/><Metric label="外卖好评率" value={metrics.deliveryRating} change="↓ 0.08" down/></section>
      <section className="grid-section">
        <DailyTrend dailyMetrics={dailyMetrics} analysisRange={analysisRange} onChangeRange={setAnalysisRange} onOpenData={() => setTab('经营数据')} isCaseData={!hasSavedDailyUpload} />
        <article className="panel diagnosis"><div className="panel-head"><div><p className="eyebrow">经营提醒</p><h2>当前值得留意的信号</h2></div><span className="spark">✦</span></div>{diagnosisInsights.slice(0, 2).map((x, index) => { const target = index === 0 ? 'AI 诊断' : '经营数据'; return <div className={`insight ${x.tone}`} key={x.title}><span>{x.level}</span><div><strong>{x.title}</strong><p>{x.detail}</p></div><button onClick={() => setTab(target)} aria-label={`${target === 'AI 诊断' ? '查看完整诊断' : '查看经营数据'}：${x.title}`}>{target === 'AI 诊断' ? '去诊断' : '看数据'} →</button></div>; })}</article>
      </section>
      <section className="panel ask"><div><p className="eyebrow">问问你的 AI 运营助手</p><h2>“为什么这周 GMV 增长了，转化率却下降？”</h2></div><button onClick={() => setAskOpen(!askOpen)}>{askOpen ? '收起问答' : '开始分析'} <span>→</span></button></section>
      {askOpen && <section className="ask-workspace" aria-label="运营问答"><div className="ask-intro"><div><p className="eyebrow">数据问答</p><h2>基于当前上传的经营数据提问</h2></div><span>{useModel ? '大模型优先' : '规则版回答'}</span></div><label className="model-switch"><input type="checkbox" checked={useModel} onChange={(event) => setUseModel(event.target.checked)}/><span>优先使用 OpenAI 大模型生成回答</span><small>未开通额度时自动使用规则版</small></label><div className="question-chips"><button onClick={() => submitQuestion('为什么这周 GMV 增长了，转化率却下降？')}>GMV 与转化</button><button onClick={() => submitQuestion('如何提高复购？')}>如何提高复购？</button><button onClick={() => submitQuestion('外卖评分需要处理吗？')}>外卖评分需要处理吗？</button></div><div className="question-form"><input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submitQuestion(); }} aria-label="输入经营问题" placeholder="例如：应该先做引流还是复购？"/><button disabled={isAnalyzing} onClick={() => submitQuestion()}>{isAnalyzing ? '分析中…' : '分析'}</button></div>{answer && <div className="answer-card"><span>✦ {answerSource || '分析结果'}</span><p>{answer}</p></div>}</section>}
      </> : tab === '经营数据' ? <DataWorkspace metrics={metrics} dataSource={dataSource} dailyMetrics={dailyMetrics} dailySource={dailySource} dailyUploadMessage={dailyUploadMessage} showRestoreDemo={hasSavedDailyUpload} analysisRange={analysisRange} onChangeRange={setAnalysisRange} onUploadDaily={handleDailyUpload} onRestoreDemoDaily={restoreDemoDaily} /> : tab === 'AI 诊断' ? <DiagnosisWorkspace actionPlan={actionPlan} reviews={reviews} dailyMetrics={dailyMetrics} metrics={metrics} usesCaseEvidence={!hasSavedDailyUpload} completedActions={completedActions} reviewNote={reviewNote} onToggleAction={toggleAction} onClearActions={clearActions} onSaveReviewNote={saveReviewNote} onClearReviewNote={clearReviewNote} /> : <ProductWorkspace products={products} productSource={productSource} productUploadMessage={productUploadMessage} onUpload={handleProductUpload} onRestoreDemo={restoreDemoProducts} showRestoreDemo={hasSavedProductUpload} />}
    </section>
  </main>;
}
function Metric({ label, value, change, down = false }: { label: string; value: string; change: string; down?: boolean }) { return <article className="metric"><p>{label}</p><strong>{value}</strong><span className={down ? 'down' : ''}>{change}</span></article>; }

function DataWorkspace({ metrics, dataSource, dailyMetrics, dailySource, dailyUploadMessage, showRestoreDemo, analysisRange, onChangeRange, onUploadDaily, onRestoreDemoDaily }: { metrics: typeof initialMetrics; dataSource: string; dailyMetrics: DailyRecord[]; dailySource: string; dailyUploadMessage: string; showRestoreDemo: boolean; analysisRange: AnalysisRange; onChangeRange: (range: AnalysisRange) => void; onUploadDaily: (event: ChangeEvent<HTMLInputElement>) => void; onRestoreDemoDaily: () => void }) {
  const dailyInputRef = useRef<HTMLInputElement>(null);
  const fields = [
    { label: 'GMV', value: metrics.gmv, description: '本周成交金额，用于观察收入规模。' },
    { label: '支付转化率', value: metrics.conversionRate, description: '从访问到支付的效率，用于发现下单阻力。' },
    { label: '复购率', value: metrics.repeatPurchaseRate, description: '顾客再次购买比例，用于衡量留存质量。' },
    { label: '外卖好评率', value: metrics.deliveryRating, description: '配送体验反馈，用于守住口碑。' },
  ];
  const isUploadedWeekly = dataSource.startsWith('已上传') || dataSource.startsWith('已从本机恢复');
  const weeklySource = isUploadedWeekly ? '已上传并保存在本机' : '演示数据';
  const isUploadedDaily = dailySource.startsWith('已上传') || dailySource.startsWith('已从本机恢复');
  const dailyStatus = isUploadedDaily ? '已上传并保存在本机' : '演示数据';
  const rangeOptions: Array<{ days: AnalysisRange; label: string }> = [{ days: 7, label: '近 7 天' }, { days: 14, label: '近 14 天' }, { days: 28, label: '近 1 月' }, { days: 180, label: '近 6 个月' }, { days: 365, label: '近 1 年' }];
  const selectedLabel = rangeOptions.find((option) => option.days === analysisRange)?.label || '近 7 天';
  const selectedData = dailyMetrics.slice(-analysisRange);
  return <section className="workspace-page">
    <section className="workspace-hero data-workspace-hero"><h2>经营数据</h2><div className="data-header-actions"><input ref={dailyInputRef} className="file-input" type="file" accept=".csv,text/csv" onChange={onUploadDaily}/><button onClick={() => dailyInputRef.current?.click()}>＋ 上传按天数据</button>{showRestoreDemo && <button className="data-restore-demo" onClick={onRestoreDemoDaily}>恢复演示数据</button>}<a href="/data/daily_metrics.csv" download="按天经营数据案例.csv">下载案例</a><span className="status-pill">● 数据已更新</span></div></section>
    {dailyUploadMessage && <p className={`product-upload-message top-message ${dailyUploadMessage.startsWith('上传成功') || dailyUploadMessage.startsWith('已恢复') ? 'success' : 'error'}`}>{dailyUploadMessage}</p>}
    <section className="data-status-bar" aria-label="数据状态"><span><b>经营汇总</b>{weeklySource}</span><span><b>按天记录</b>{dailyStatus}</span><span><b>AI 诊断</b>可以开始</span></section>
    <section className="range-control"><span>查看范围</span><div>{rangeOptions.map((option) => <button key={option.days} disabled={option.days > dailyMetrics.length} className={analysisRange === option.days ? 'active' : ''} title={option.days > dailyMetrics.length ? `当前仅有 ${dailyMetrics.length} 天历史数据` : undefined} onClick={() => onChangeRange(option.days)}>{option.label}</button>)}</div><small>当前已加载 {dailyMetrics.length} 天历史数据</small></section>
    <WeekComparison dailyMetrics={dailyMetrics} periodDays={analysisRange} />
    <section className="panel daily-table-panel"><div className="panel-head"><div><p className="eyebrow">{selectedLabel}经营明细</p><h2>从收入变化追到经营环节</h2></div><span className="period">按天数据</span></div><div className="daily-table"><div className="daily-table-row daily-table-head"><span>日期</span><span>访客</span><span>支付</span><span>GMV</span></div>{selectedData.map((item) => <div className="daily-table-row" key={item.date}><span>{item.date.slice(5).replace('-', '/')}</span><span>{item.visitors}</span><span>{item.paidOrders}</span><strong>¥{item.gmv.toLocaleString('zh-CN')}</strong></div>)}</div></section>
    <details className="field-help"><summary><div><p className="eyebrow">需要时再看</p><strong>字段说明与上传帮助</strong></div><span>⌄</span></summary><div className="field-help-body"><p>顶部“上传经营数据”用于经营汇总：GMV、支付转化率、复购率、外卖好评率。此处“上传按天数据”用于趋势与异常定位：日期、访客、下单订单、支付订单、GMV、平均等待、外卖好评率。</p><div className="field-table"><div className="field-row field-head"><span>字段</span><span>当前值</span><span>业务意义</span></div>{fields.map((field) => <div className="field-row" key={field.label}><strong>{field.label}</strong><b>{field.value}</b><p>{field.description}</p></div>)}</div></div></details>
  </section>;
}

function DailyTrend({ dailyMetrics, analysisRange, onChangeRange, onOpenData, isCaseData = false }: { dailyMetrics: DailyRecord[]; analysisRange: AnalysisRange; onChangeRange: (range: AnalysisRange) => void; onOpenData: () => void; isCaseData?: boolean }) {
  const [activeDay, setActiveDay] = useState<DailyRecord | null>(null);
  const overviewRanges: Array<{ days: AnalysisRange; label: string }> = [{ days: 7, label: '7 天' }, { days: 14, label: '14 天' }, { days: 28, label: '1 月' }];
  const visibleDays = dailyMetrics.slice(-analysisRange);
  const peak = visibleDays.reduce((current, item) => !current || item.gmv > current.gmv ? item : current, visibleDays[0]);
  const maxGmv = Math.max(...visibleDays.map((item) => item.gmv), 1);
  const periodLabel = analysisRange === 7 ? '近 7 天' : analysisRange === 14 ? '近 14 天' : '近 1 月';
  const totalGmv = visibleDays.reduce((sum, item) => sum + item.gmv, 0);
  const labelInterval = Math.ceil(visibleDays.length / 5);
  const selectedDay = activeDay && visibleDays.some((item) => item.date === activeDay.date) ? activeDay : visibleDays[visibleDays.length - 1];
  const selectedConversion = selectedDay && selectedDay.visitors > 0 ? selectedDay.paidOrders / selectedDay.visitors * 100 : 0;
  return <article className="panel trend"><div className="panel-head"><div><p className="eyebrow">GMV 趋势 · 按天数据</p><h2>{peak ? `${peak.date.slice(5).replace('-', '/')} 达到该周期收入峰值` : '正在读取按天经营数据'}</h2></div><span className="period">{isCaseData ? '项目案例按天数据' : `共 ${dailyMetrics.length} 天`}</span></div><div className="trend-tools"><div>{overviewRanges.map((option) => <button key={option.days} disabled={option.days > dailyMetrics.length} className={analysisRange === option.days ? 'active' : ''} onClick={() => onChangeRange(option.days)}>{option.label}</button>)}</div><button className="trend-detail-link" onClick={onOpenData}>查看明细 →</button></div>{visibleDays.length > 0 ? <><div className={`daily-bars ${visibleDays.length > 14 ? 'compact' : ''}`}>{visibleDays.map((item, index) => {
    const conversion = item.visitors > 0 ? item.paidOrders / item.visitors * 100 : 0;
    const tooltipEdge = index === 0 ? 'tooltip-start' : index === visibleDays.length - 1 ? 'tooltip-end' : '';
    return <button type="button" className="daily-bar-item" key={item.date} onMouseEnter={() => setActiveDay(item)} onFocus={() => setActiveDay(item)} onClick={() => setActiveDay(item)} aria-label={`查看 ${item.date} 数据：GMV ¥${item.gmv.toLocaleString('zh-CN')}，访客 ${item.visitors}，支付订单 ${item.paidOrders}，支付转化率 ${conversion.toFixed(1)}%`}><span>¥{(item.gmv / 1000).toFixed(1)}k</span><i style={{ height: `${Math.max(14, item.gmv / maxGmv * 100)}%` }} /><div className={`bar-tooltip ${tooltipEdge}`}><strong>{item.date}</strong><span>GMV　¥{item.gmv.toLocaleString('zh-CN')}</span><span>访客 {item.visitors} · 支付 {item.paidOrders}</span><span>支付转化率 {conversion.toFixed(1)}%</span></div><b>{index === 0 || index === visibleDays.length - 1 || index % labelInterval === 0 ? item.date.slice(5).replace('-', '/') : ''}</b></button>;
  })}</div>{selectedDay && <div className="trend-selection" aria-live="polite"><span><b>{selectedDay.date.slice(5).replace('-', '/')}</b> 当日数据</span><strong>GMV ¥{selectedDay.gmv.toLocaleString('zh-CN')}</strong><span>访客 {selectedDay.visitors}</span><span>支付 {selectedDay.paidOrders}</span><span>转化 {selectedConversion.toFixed(1)}%</span></div>}<div className="legend"><span><i className="dot purple"/>GMV（每日成交金额）</span><span>{periodLabel} ¥{totalGmv.toLocaleString('zh-CN')}</span></div></> : <p className="empty-data">暂无按天数据。</p>}</article>;
}

function WeekComparison({ dailyMetrics, periodDays }: { dailyMetrics: DailyRecord[]; periodDays: AnalysisRange }) {
  const periodLabel = periodDays === 7 ? '近 7 天' : periodDays === 14 ? '近 14 天' : periodDays === 28 ? '近 1 月' : periodDays === 180 ? '近 6 个月' : '近 1 年';
  const previousWeek = dailyMetrics.slice(-periodDays * 2, -periodDays);
  const currentWeek = dailyMetrics.slice(-periodDays);
  if (currentWeek.length < periodDays) return <section className="panel week-comparison empty-week-comparison"><p className="eyebrow">趋势对比</p><h2>{periodLabel}数据尚未准备好</h2><p>继续积累历史经营数据后，即可查看这个时间范围的分析。</p></section>;
  if (previousWeek.length < periodDays) return <section className="panel week-comparison empty-week-comparison"><p className="eyebrow">趋势对比 · 按天数据</p><h2>{periodLabel}经营概览已准备好</h2><p>当前可查看 {periodLabel}明细；还需要再积累 {periodDays} 天历史数据，才能进行完整环比。</p></section>;
  const sum = (records: DailyRecord[], key: 'gmv' | 'visitors' | 'paidOrders') => records.reduce((total, item) => total + item[key], 0);
  const averageWait = (records: DailyRecord[]) => records.reduce((total, item) => total + item.avgWaitMinutes, 0) / records.length;
  const previousGmv = sum(previousWeek, 'gmv');
  const currentGmv = sum(currentWeek, 'gmv');
  const previousConversion = sum(previousWeek, 'paidOrders') / sum(previousWeek, 'visitors') * 100;
  const currentConversion = sum(currentWeek, 'paidOrders') / sum(currentWeek, 'visitors') * 100;
  const previousWait = averageWait(previousWeek);
  const currentWait = averageWait(currentWeek);
  const gmvChange = (currentGmv - previousGmv) / previousGmv * 100;
  const paidOrdersChange = (sum(currentWeek, 'paidOrders') - sum(previousWeek, 'paidOrders')) / sum(previousWeek, 'paidOrders') * 100;
  const comparisonItems = [
    { label: 'GMV', value: `¥${currentGmv.toLocaleString('zh-CN')}`, change: `${gmvChange >= 0 ? '↑' : '↓'} ${Math.abs(gmvChange).toFixed(1)}%`, good: gmvChange >= 0, note: `上一周期 ¥${previousGmv.toLocaleString('zh-CN')}` },
    { label: '支付转化率', value: `${currentConversion.toFixed(1)}%`, change: `${currentConversion - previousConversion >= 0 ? '↑' : '↓'} ${Math.abs(currentConversion - previousConversion).toFixed(1)} 个百分点`, good: currentConversion >= previousConversion, note: `上一周期 ${previousConversion.toFixed(1)}%` },
    { label: '支付订单', value: `${sum(currentWeek, 'paidOrders')} 单`, change: `${paidOrdersChange >= 0 ? '↑' : '↓'} ${Math.abs(paidOrdersChange).toFixed(1)}%`, good: paidOrdersChange >= 0, note: `上一周期 ${sum(previousWeek, 'paidOrders')} 单` },
    { label: '平均等待', value: `${currentWait.toFixed(1)} 分钟`, change: `${currentWait - previousWait <= 0 ? '↓' : '↑'} ${Math.abs(currentWait - previousWait).toFixed(1)} 分钟`, good: currentWait <= previousWait, note: `上一周期 ${previousWait.toFixed(1)} 分钟` },
  ];
  const dateRange = `${currentWeek[0].date.slice(5).replace('-', '/')} — ${currentWeek[currentWeek.length - 1].date.slice(5).replace('-', '/')}`;
  return <section className="panel week-comparison"><div className="panel-head"><div><p className="eyebrow">趋势对比 · 按天数据</p><h2>{periodLabel}对比上一周期</h2></div><span className="period">{dateRange}</span></div><div className="week-comparison-grid">{comparisonItems.map((item) => <article key={item.label}><span>{item.label}</span><strong>{item.value}</strong><b className={item.good ? 'positive' : 'negative'}>{item.change}</b><small>{item.note}</small></article>)}</div></section>;
}

function DailyAnomaly({ dailyMetrics }: { dailyMetrics: DailyRecord[] }) {
  if (dailyMetrics.length === 0) return null;
  const averageWait = dailyMetrics.reduce((sum, item) => sum + item.avgWaitMinutes, 0) / dailyMetrics.length;
  const averageConversion = dailyMetrics.reduce((sum, item) => sum + item.paidOrders / item.visitors, 0) / dailyMetrics.length;
  const anomaly = [...dailyMetrics].map((item) => ({ item, conversion: item.paidOrders / item.visitors, score: item.avgWaitMinutes / averageWait - item.paidOrders / item.visitors / averageConversion })).sort((a, b) => b.score - a.score)[0];
  if (!anomaly) return null;
  const { item, conversion } = anomaly;
  const waitGap = item.avgWaitMinutes - averageWait;
  const conversionGap = (conversion - averageConversion) * 100;
  return <section className="daily-anomaly"><div className="daily-anomaly-head"><div><p className="eyebrow">异常定位 · 按天数据</p><h2>{item.date.slice(5).replace('-', '/')} 值得优先复盘</h2></div><span>判断依据</span></div><div className="anomaly-evidence"><article><span>当天平均等待</span><strong>{item.avgWaitMinutes.toFixed(1)} 分钟</strong><p>较整体均值 {averageWait.toFixed(1)} 分钟 {waitGap >= 0 ? '高' : '低'} {Math.abs(waitGap).toFixed(1)} 分钟</p></article><article><span>当天支付转化</span><strong>{(conversion * 100).toFixed(1)}%</strong><p>较整体均值 {(averageConversion * 100).toFixed(1)}% {conversionGap >= 0 ? '高' : '低'} {Math.abs(conversionGap).toFixed(1)} 个百分点</p></article><article><span>建议排查</span><strong>{waitGap > 0 && conversionGap < 0 ? '等待与转化同步恶化' : '检查订单与出餐节奏'}</strong><p>回看当天午高峰备料、商品组合和低分评价原因。</p></article></div></section>;
}

function DiagnosisWorkspace({ actionPlan, reviews, dailyMetrics, metrics, usesCaseEvidence, completedActions, reviewNote, onToggleAction, onClearActions, onSaveReviewNote, onClearReviewNote }: { actionPlan: { title: string; basis: string; actions: string[] }; reviews: ReviewRecord[]; dailyMetrics: DailyRecord[]; metrics: typeof initialMetrics; usesCaseEvidence: boolean; completedActions: string[]; reviewNote: ReviewNote; onToggleAction: (action: string) => void; onClearActions: () => void; onSaveReviewNote: (outcome: string, note: string) => void; onClearReviewNote: () => void }) {
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
  const peakWaitDay = [...dailyMetrics].sort((a, b) => b.avgWaitMinutes - a.avgWaitMinutes)[0];
  const primaryIsDelivery = actionPlan.title.includes('外卖');
  const primaryIsProductGrowth = actionPlan.title.includes('高价值商品');
  const secondPriority = usesCaseEvidence
    ? { priority: 'P2', title: '补充按天经营记录', detail: '当前上传的是 4 项经营汇总，无法判断具体哪一天、哪个高峰环节导致变化。', action: '记录每天的访客、支付订单、GMV 和平均等待时间，再定位异常日期。' }
    : primaryIsDelivery
      ? { priority: 'P2', title: '关注支付转化效率', detail: `当前支付转化率 ${metrics.conversionRate}，先持续观察高峰时段的商品选择和下单效率。`, action: '记录午高峰访客、支付订单和商品组合变化，判断转化是否稳定。' }
      : { priority: 'P2', title: '复盘午高峰出餐节奏', detail: peakWaitDay ? `${peakWaitDay.date.slice(5).replace('-', '/')} 平均等待 ${peakWaitDay.avgWaitMinutes.toFixed(1)} 分钟，是当前最值得回看的日期。` : '等待按天经营数据加载完成后，再定位高峰异常。', action: '回看异常日期的备料、出餐和商品组合，记录可改进环节。' };
  const priorityQueue = [
    { priority: 'P1', title: actionPlan.title, detail: actionPlan.basis, action: actionPlan.actions[0] },
    secondPriority,
    primaryIsProductGrowth
      ? { priority: 'P3', title: '建立新客复购跟踪', detail: `当前复购率 ${metrics.repeatPurchaseRate}，把新客与老客分组，才能验证优惠是否有效。`, action: '按新客和老客分别记录复购率，下周比较变化。' }
      : { priority: 'P3', title: '测试高复购商品组合', detail: '选择一个高复购商品做加购或套餐测试，作为低风险增长实验。', action: '测试一组加购组合，并记录客单价与复购变化。' },
  ];
  const completedPriorityCount = priorityQueue.filter((item) => completedActions.includes(item.action)).length;
  const continuousObservations = Number(metrics.deliveryRating) >= 4.7 ? [{ title: '外卖体验当前稳定', detail: `当前外卖好评率为 ${metrics.deliveryRating}，暂不进入本周待办；继续关注低分评价中的等待、漏品和包装问题。` }] : [];
  useEffect(() => {
    const timer = window.setTimeout(() => { setDraftOutcome(reviewNote.outcome); setDraftNote(reviewNote.note); }, 0);
    return () => window.clearTimeout(timer);
  }, [reviewNote]);
  return <section className="workspace-page">
    <section className="workspace-hero"><div><p className="eyebrow">诊断中心</p><h2>本周优先动作</h2></div><span className="status-pill">✦ {usesCaseEvidence ? '汇总优先级' : '已生成优先级'}</span></section>
    <section className="priority-card"><span className="priority-index">P1</span><div><p className="eyebrow light">本周最高优先级</p><h2>{priorityQueue[0].title}</h2><p>{priorityQueue[0].detail}</p></div><div className="priority-action"><span>建议先做</span><strong>{priorityQueue[0].action}</strong></div></section>
    <section className="action-tracker"><div className="action-tracker-head"><div><p className="eyebrow">本周优先动作</p><h2>执行 {completedPriorityCount} / {priorityQueue.length}</h2></div><div className="action-tracker-tools"><span>按 P1 → P3 推进</span>{completedActions.length > 0 && <button onClick={onClearActions}>清空进度</button>}</div></div>{priorityQueue.map((item) => <article className={`${completedActions.includes(item.action) ? 'action-item completed' : 'action-item'} priority-${item.priority.toLowerCase()}`} key={item.action}><button aria-label={`标记${item.title}完成`} onClick={() => onToggleAction(item.action)}>{completedActions.includes(item.action) ? '✓' : item.priority}</button><div><strong>{item.title}</strong><p>{item.detail}</p><small className="priority-action-copy">动作：{item.action}</small></div><span>{completedActions.includes(item.action) ? '已完成' : item.priority === 'P1' ? '优先处理' : item.priority === 'P2' ? '本周跟进' : '持续试验'}</span></article>)}</section>
    <details className="diagnosis-fold"><summary><div><p className="eyebrow">需要时查看</p><strong>判断依据</strong></div><span>{usesCaseEvidence ? '等待补充按天记录' : '异常日期与评价证据'}　⌄</span></summary><div className="diagnosis-fold-body">{usesCaseEvidence ? <p className="data-source-note"><b>当前数据：</b>经营汇总已上传；按天与评价记录未上传。</p> : <><DailyAnomaly dailyMetrics={dailyMetrics}/><section className="review-evidence"><article><span>低分评价</span><strong>{lowScoreReviews.length} 条</strong><p>评分 ≤ 3 的真实评价</p></article><article><span>最集中问题</span><strong>{topIssue?.tag || '暂无'}</strong><p>{topIssue?.count || 0} 条评价涉及该问题</p></article><article><span>等待相关</span><strong>{waitIssues} 条</strong><p>可和高峰时段、出餐数据交叉分析</p></article></section><section className="review-samples"><button className="review-toggle" onClick={() => setShowReviewSamples((visible) => !visible)}>{showReviewSamples ? '收起低分评价样本' : `查看 ${lowScoreReviews.length} 条低分评价样本`}<span>{showReviewSamples ? '⌃' : '⌄'}</span></button>{showReviewSamples && <div className="review-sample-list">{reviewSamples.length > 0 ? reviewSamples.map((review) => <article key={`${review.date}-${review.productName}-${review.comment}`}><div className="review-sample-meta"><span>{review.date}</span><span>{review.channel}</span><span>{review.productName}</span><strong>{review.rating} 分</strong></div><p><b>{review.issueTag}</b>{review.comment}</p></article>) : <p className="review-empty">当前数据中没有低分评价。</p>}</div>}</section></>}</div></details>
    <details className="diagnosis-fold"><summary><div><p className="eyebrow">执行之后再看</p><strong>7 天后复盘</strong></div><span>{reviewNote.savedAt ? `已保存 · ${reviewNote.savedAt}` : '设置验证目标'}　⌄</span></summary><div className="diagnosis-fold-body"><section className="review-checkpoint"><p className="review-checkpoint-intro">当前数值是本周基线；下次上传周报后，按下面目标判断行动是否值得保留。</p><div className="checkpoint-table"><div className="checkpoint-row checkpoint-head"><span>指标</span><span>本周基线</span><span>下周验证目标</span><span>对应动作</span></div>{checkpoints.map((checkpoint) => <div className="checkpoint-row" key={checkpoint.label}><strong>{checkpoint.label}</strong><b>{checkpoint.baseline}</b><em>{checkpoint.target}</em><p>{checkpoint.meaning}</p></div>)}</div><div className="review-note-form"><label><span>本轮判断</span><select value={draftOutcome} onChange={(event) => setDraftOutcome(event.target.value)}><option>观察中</option><option>已验证有效</option><option>需要调整</option></select></label><label><span>复盘备注</span><textarea value={draftNote} onChange={(event) => setDraftNote(event.target.value)} placeholder="例如：午高峰套餐已测试 5 天，转化有所改善；下周继续观察。" /></label><div className="review-note-actions"><button onClick={() => onSaveReviewNote(draftOutcome, draftNote)}>保存本机复盘</button>{reviewNote.savedAt && <button className="clear-review" onClick={onClearReviewNote}>清空</button>}</div></div></section></div></details>
    {continuousObservations.length > 0 && <details className="diagnosis-fold"><summary><div><p className="eyebrow">暂不进入待办</p><strong>持续观察（{continuousObservations.length}）</strong></div><span>查看稳定信号　⌄</span></summary><div className="diagnosis-fold-body"><section className="observation-list">{continuousObservations.map((observation) => <article key={observation.title}><span>持续观察</span><div><strong>{observation.title}</strong><p>{observation.detail}</p></div></article>)}</section></div></details>}
  </section>;
}

function ProductWorkspace({ products, productSource, productUploadMessage, onUpload, onRestoreDemo, showRestoreDemo }: { products: ProductRecord[]; productSource: string; productUploadMessage: string; onUpload: (event: ChangeEvent<HTMLInputElement>) => void; onRestoreDemo: () => void; showRestoreDemo: boolean }) {
  const productInputRef = useRef<HTMLInputElement>(null);
  const [productFilter, setProductFilter] = useState<'全部' | '需要处理' | '增长机会' | '持续观察'>('全部');
  const productCards = products.map((product) => {
    if (product.rating < 4.7 || product.outOfStockCount > 0) return { product, level: '需要处理', detail: `评分 ${product.rating.toFixed(2)}，缺货 ${product.outOfStockCount} 次，体验可能影响后续购买。`, action: '检查低分反馈与缺货原因，优先修复体验问题。', tone: 'alert' };
    if (product.repeatPurchaseRate >= 0.3) return { product, level: '增长机会', detail: `复购率 ${(product.repeatPurchaseRate * 100).toFixed(0)}%，高于本项目设定的 30% 增长线。`, action: '搭配高毛利商品测试“第二杯 / 加购”组合。', tone: 'good' };
    return { product, level: '持续观察', detail: `销量 ${product.unitsSold} 件，毛利率 ${(product.grossMargin * 100).toFixed(0)}%，暂未发现紧急风险。`, action: '保留商品并持续观察销量、评分与复购变化。', tone: 'neutral' };
  }).sort((a, b) => (a.tone === 'alert' ? -1 : b.tone === 'alert' ? 1 : b.product.revenue - a.product.revenue));
  const totalRevenue = products.reduce((sum, product) => sum + product.revenue, 0);
  const productFilters = [
    { label: '全部', value: '全部' as const, count: productCards.length },
    { label: '优先处理', value: '需要处理' as const, count: productCards.filter((item) => item.level === '需要处理').length },
    { label: '增长机会', value: '增长机会' as const, count: productCards.filter((item) => item.level === '增长机会').length },
    { label: '持续观察', value: '持续观察' as const, count: productCards.filter((item) => item.level === '持续观察').length },
  ];
  const visibleProductCards = productFilter === '全部' ? productCards : productCards.filter((item) => item.level === productFilter);
  const filterGuidance = {
    全部: `先处理 ${productCards.filter((item) => item.level === '需要处理').length} 个体验或缺货风险商品，再从增长机会中挑 1 个做小范围测试。`,
    需要处理: '已按风险优先展示：先解决缺货和低评分，再观察评分与复购是否回升。',
    增长机会: '从中选择 1 个商品做加购或套餐测试，并在下个周期对比客单价与复购率。',
    持续观察: '这些商品暂未发现紧急风险；保持记录，等数据出现变化后再介入。',
  }[productFilter];
  return <section className="workspace-page">
    <section className="workspace-hero product-workspace-hero">
      <div><p className="eyebrow">商品机会 · {productSource}</p><h2>商品增长与风险</h2></div>
      <div className="product-header-actions"><input ref={productInputRef} className="file-input" type="file" accept=".csv,text/csv" onChange={onUpload}/><button onClick={() => productInputRef.current?.click()}>＋ 上传商品明细</button>{showRestoreDemo && <button className="product-restore-demo" onClick={onRestoreDemo}>恢复演示数据</button>}<a className="product-template-download" href="/data/product_metrics.csv" download="商品明细案例.csv">下载案例</a><details className="field-requirements"><summary>查看字段要求</summary><p>商品名称、品类、销量、收入、毛利率、复购率、评分、缺货次数。</p></details><span className="status-pill">{products.length || '…'} 个商品已分析</span></div>
    </section>
    {productUploadMessage && <p className={`product-upload-message top-message ${productUploadMessage.startsWith('上传成功') || productUploadMessage.startsWith('已恢复') ? 'success' : 'error'}`}>{productUploadMessage}</p>}
    <section className="product-summary"><article><span>商品收入合计</span><strong>¥{totalRevenue.toLocaleString('zh-CN')}</strong></article><article><span>需要优先处理</span><strong>{productCards.filter((item) => item.tone === 'alert').length} 个</strong></article><article><span>复购增长机会</span><strong>{productCards.filter((item) => item.level === '增长机会').length} 个</strong></article></section>
    <section className="product-filter" aria-label="商品分析筛选">{productFilters.map((filter) => <button className={productFilter === filter.value ? 'active' : ''} aria-pressed={productFilter === filter.value} key={filter.value} onClick={() => setProductFilter(filter.value)}>{filter.label}<span>{filter.count}</span></button>)}</section>
    <p className="product-filter-guidance"><b>当前怎么做：</b>{filterGuidance}</p>
    <section className="product-grid">{visibleProductCards.map(({ product, level, detail, action, tone }) => <article className="product-card" key={product.productName}><div className="product-top"><span className={`tag ${tone}`}>{level}</span><b>收入 ¥{product.revenue.toLocaleString('zh-CN')}</b></div><h3>{product.productName}</h3><p>{detail}</p><div className="product-meta"><span>{product.category}</span><span>销量 {product.unitsSold}</span><span>毛利 {(product.grossMargin * 100).toFixed(0)}%</span></div><div className="product-action"><small>建议动作</small><strong>{action}</strong></div></article>)}{visibleProductCards.length === 0 && <p className="product-empty">当前没有符合这个分类的商品。</p>}</section>
  </section>;
}
