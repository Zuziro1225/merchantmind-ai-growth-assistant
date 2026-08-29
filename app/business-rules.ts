export function parseCsvRows(csv: string): string[][] {
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

export function readRate(value: string, fieldName: string): number {
  const raw = value.trim();
  const usesPercentSign = raw.endsWith('%');
  const number = Number(usesPercentSign ? raw.slice(0, -1).trim() : raw);
  if (Number.isNaN(number) || number < 0 || (usesPercentSign && number > 100) || (!usesPercentSign && number > 1)) {
    throw new Error(`${fieldName}请填写 0 到 1 的小数，或带 % 的百分比`);
  }
  return usesPercentSign ? number / 100 : number;
}

export function readNonNegativeNumber(value: string, fieldName: string): number {
  const number = Number(value);
  if (Number.isNaN(number) || number < 0) throw new Error(`${fieldName}需要填写大于或等于 0 的数字`);
  return number;
}

export function getHealthScore(conversionRate: number, repeatPurchaseRate: number, deliveryRating: number) {
  const conversionScore = Math.min(conversionRate / 0.1, 1) * 45;
  const repeatScore = Math.min(repeatPurchaseRate / 0.3, 1) * 30;
  const ratingScore = Math.min(deliveryRating / 5, 1) * 25;
  const score = Math.round(conversionScore + repeatScore + ratingScore);
  const label = score >= 85 ? '状态良好' : score >= 70 ? '可以提升' : '优先调整';
  return { score, label };
}
