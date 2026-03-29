// src/engine/RuleEngine.js
import { addMonths } from 'date-fns';

/**
 * 规则引擎 - 执行四类规则
 */
export class RuleEngine {
  constructor(rules) {
    this.rules = rules.filter(r => r.enabled);
  }

  /**
   * 执行延迟规则
   * @param {DelayRule} rule
   * @param {Map<string, Date>} eventDates
   * @returns {Date|null}
   */
  executeDelayRule(rule, eventDates) {
    const triggerDate = eventDates.get(rule.trigger);
    if (!triggerDate) return null;
    return addMonths(triggerDate, rule.delayMonths);
  }

  /**
   * 执行时长规则 - 返回天数范围
   * @param {DurationRule} rule
   * @returns {{ normal: number, min: number }}
   */
  executeDurationRule(rule) {
    return {
      normal: rule.normalDays,
      min: rule.minDays,
    };
  }

  /**
   * 执行顺序规则 - 返回依赖关系
   * @param {SequenceRule} rule
   * @returns {{ predecessor: string, successor: string }}
   */
  executeSequenceRule(rule) {
    return {
      predecessor: rule.predecessor,
      successor: rule.successor,
    };
  }

  /**
   * 执行条件约束规则
   * @param {ConditionalConstraintRule} rule
   * @param {AnchorDates} anchors
   * @returns {boolean}
   */
  executeConditionalConstraint(rule, anchors) {
    const { condition, constraint } = rule;
    let conditionMet = false;

    if (condition.field === 'reportingBaseDate') {
      conditionMet = anchors.baseDate.getMonth() + 1 === condition.month;
    }

    return conditionMet;
  }

  /**
   * 获取所有适用的延迟规则
   * @param {string} track
   * @returns {DelayRule[]}
   */
  getDelayRules(track) {
    return this.rules.filter(
      r => r.type === 'delay' &&
           r.applicableTracks.includes(track) &&
           r.category === 'hard_rule'
    );
  }

  /**
   * 获取所有适用的时长规则
   * @param {string} track
   * @returns {DurationRule[]}
   */
  getDurationRules(track) {
    return this.rules.filter(
      r => r.type === 'duration' &&
           r.applicableTracks.includes(track)
    );
  }

  /**
   * 获取所有顺序规则
   * @returns {SequenceRule[]}
   */
  getSequenceRules() {
    return this.rules.filter(r => r.type === 'sequence');
  }

  /**
   * 获取所有条件约束规则
   * @param {AnchorDates} anchors
   * @returns {ConditionalConstraintRule[]}
   */
  getConditionalConstraints(anchors) {
    return this.rules.filter(
      r => r.type === 'conditional_constraint' &&
           this.executeConditionalConstraint(r, anchors)
    );
  }
}