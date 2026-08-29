import { describe, expect, it } from 'vitest';
import { getHealthScore, parseCsvRows, readRate } from './business-rules';

describe('CSV 解析', () => {
  it('保留带逗号的引号字段，并兼容 UTF-8 BOM', () => {
    expect(parseCsvRows('\uFEFFdate,comment\n2026-08-01,"包装, 漏液"')).toEqual([
      ['date', 'comment'],
      ['2026-08-01', '包装, 漏液'],
    ]);
  });

  it('对未闭合引号给出明确错误', () => {
    expect(() => parseCsvRows('date,comment\n2026-08-01,"未完成')).toThrow('未闭合');
  });
});

describe('经营规则', () => {
  it('同时接受小数和百分比格式', () => {
    expect(readRate('0.226', '复购率')).toBe(0.226);
    expect(readRate('22.6%', '复购率')).toBe(0.226);
  });

  it('根据核心经营指标计算健康度', () => {
    expect(getHealthScore(0.078, 0.226, 4.76)).toEqual({ score: 82, label: '可以提升' });
    expect(getHealthScore(0.1, 0.3, 5)).toEqual({ score: 100, label: '状态良好' });
  });
});
