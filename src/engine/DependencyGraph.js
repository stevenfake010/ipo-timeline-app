// src/engine/DependencyGraph.js
import { RuleEngine } from './RuleEngine';

/**
 * 依赖图构建器 - 将规则转换为任务依赖关系
 */
export class DependencyGraph {
  constructor(rules) {
    this.ruleEngine = new RuleEngine(rules);
    this.dependencies = new Map(); // taskName -> [predecessor names]
    this.durations = new Map(); // taskName -> { normal, min }
  }

  /**
   * 从规则构建依赖图
   * @param {AnchorDates} anchors
   */
  buildFromRules(anchors) {
    // 处理顺序规则
    const sequenceRules = this.ruleEngine.getSequenceRules();
    for (const rule of sequenceRules) {
      this.addDependency(rule.successor, rule.predecessor);
    }

    // 处理时长规则
    for (const rule of this.ruleEngine.rules) {
      if (rule.type === 'duration') {
        const duration = this.ruleEngine.executeDurationRule(rule);
        this.durations.set(rule.taskName, duration);
      }
    }

    // 处理条件约束（用于后续校验）
    const constraints = this.ruleEngine.getConditionalConstraints(anchors);
    this.constraints = constraints;
  }

  /**
   * 添加依赖关系
   * @param {string} successor
   * @param {string} predecessor
   */
  addDependency(successor, predecessor) {
    if (!this.dependencies.has(successor)) {
      this.dependencies.set(successor, []);
    }
    this.dependencies.get(successor).push(predecessor);
  }

  /**
   * 获取任务的所有前置依赖
   * @param {string} taskName
   * @returns {string[]}
   */
  getDependencies(taskName) {
    return this.dependencies.get(taskName) || [];
  }

  /**
   * 获取任务时长
   * @param {string} taskName
   * @returns {{ normal: number, min: number }}
   */
  getDuration(taskName) {
    return this.durations.get(taskName) || { normal: 30, min: 20 };
  }
}