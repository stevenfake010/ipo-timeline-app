// src/utils/dateUtils.js
import { addWeeks, addMonths, differenceInDays, startOfWeek, format, parseISO, isValid } from 'date-fns';
import { zhCN } from 'date-fns/locale';

/**
 * 计算两个日期之间的周数差
 * @param {Date} start
 * @param {Date} end
 * @returns {number}
 */
export function weeksBetween(start, end) {
  const days = differenceInDays(end, start);
  return Math.ceil(days / 7);
}

/**
 * 获取某一周的周一日期
 * @param {Date} date
 * @returns {Date}
 */
export function getWeekStart(date) {
  return startOfWeek(date, { weekStartsOn: 1 }); // 周一为一周开始
}

/**
 * 根据锚点日期计算时间线
 * @param {AnchorDates} anchors
 * @returns {Map<string, number>} 事件名称到周数的映射
 */
export function buildTimelineFromAnchors(anchors) {
  const { startDate, baseDate, filingDate } = anchors;
  const timeline = new Map();

  timeline.set('项目启动', 1);
  timeline.set('基准日', weeksBetween(startDate, baseDate) + 1);
  timeline.set('A1申报', weeksBetween(startDate, filingDate) + 1);

  return timeline;
}

/**
 * 格式化周数为 W1, W2 格式
 * @param {number} weekNum
 * @returns {string}
 */
export function formatWeek(weekNum) {
  return `W${weekNum}`;
}

/**
 * 获取指定周的具体日期范围
 * @param {Date} projectStart - 项目开始日期
 * @param {number} weekNum - 周数 (1-based)
 * @returns {{ start: Date, end: Date, label: string }}
 */
export function getWeekDateRange(projectStart, weekNum) {
  const weekStart = addWeeks(projectStart, weekNum - 1);
  const weekEnd = addWeeks(weekStart, 1);
  return {
    start: weekStart,
    end: weekEnd,
    label: `${format(weekStart, 'M/dd')} - ${format(weekEnd, 'M/dd')}`,
  };
}

/**
 * 检查日期是否有效
 * @param {any} date
 * @returns {boolean}
 */
export function isValidDate(date) {
  if (!date) return false;
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isValid(d);
}