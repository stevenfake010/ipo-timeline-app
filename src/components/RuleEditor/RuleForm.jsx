// src/components/RuleEditor/RuleForm.jsx
import React, { useState, useEffect } from 'react';
import { X, Save, Clock, Calendar, GitBranch, AlertTriangle } from 'lucide-react';
import { DelayRuleForm } from './DelayRuleForm';
import { DurationRuleForm } from './DurationRuleForm';
import { SequenceRuleForm } from './SequenceRuleForm';
import { ConstraintRuleForm } from './ConstraintRuleForm';

const RULE_TYPES = [
  { value: 'delay', label: '延迟规则', icon: Clock, description: '事件触发 → 固定等待 → 结果' },
  { value: 'duration', label: '时长规则', icon: Calendar, description: '任务完成的正常/最短时长' },
  { value: 'sequence', label: '顺序规则', icon: GitBranch, description: '前置任务完成后才能开始后继' },
  { value: 'conditional_constraint', label: '条件约束', icon: AlertTriangle, description: '满足条件时的时间窗口约束' },
];

const DEFAULT_FORM_DATA = {
  delay: {
    name: '',
    description: '',
    trigger: '',
    delayMonths: 2,
    result: '',
    applicableTracks: [],
    tags: [],
  },
  duration: {
    name: '',
    description: '',
    taskName: '',
    subItem: '',
    track: '',
    normalDays: 30,
    minDays: 20,
    applicableTracks: [],
    tags: [],
  },
  sequence: {
    name: '',
    description: '',
    predecessor: '',
    successor: '',
    applicableTracks: [],
    tags: [],
  },
  conditional_constraint: {
    name: '',
    description: '',
    condition: { field: '', month: '' },
    constraint: { field: '', allowedRange: { start: '', end: '' } },
    applicableTracks: [],
    tags: [],
  },
};

export function RuleForm({ rule, onSave, onClose }) {
  const [ruleType, setRuleType] = useState(rule?.type || 'delay');
  const [formData, setFormData] = useState(rule || { ...DEFAULT_FORM_DATA[rule?.type || 'delay'] });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (rule) {
      setRuleType(rule.type);
      setFormData(rule);
    } else {
      setRuleType('delay');
      setFormData({ ...DEFAULT_FORM_DATA.delay, type: 'delay', category: 'business_rule', enabled: true });
    }
  }, [rule]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name?.trim()) {
      newErrors.name = '请输入规则名称';
    }

    if (ruleType === 'delay') {
      if (!formData.trigger?.trim()) newErrors.trigger = '请输入触发事件';
      if (!formData.delayMonths) newErrors.delayMonths = '请输入延迟月数';
      if (!formData.result?.trim()) newErrors.result = '请输入结果事件';
    }

    if (ruleType === 'duration') {
      if (!formData.taskName?.trim()) newErrors.taskName = '请选择关联任务';
      if (!formData.normalDays) newErrors.normalDays = '请输入正常天数';
      if (!formData.minDays) newErrors.minDays = '请输入最短天数';
    }

    if (ruleType === 'sequence') {
      if (!formData.predecessor?.trim()) newErrors.predecessor = '请选择前置任务';
      if (!formData.successor?.trim()) newErrors.successor = '请选择后继任务';
    }

    if (ruleType === 'conditional_constraint') {
      if (!formData.condition?.field) newErrors['condition.field'] = '请选择条件字段';
      if (!formData.condition?.month) newErrors['condition.month'] = '请选择条件月份';
      if (!formData.constraint?.field) newErrors['constraint.field'] = '请选择约束字段';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    const ruleData = {
      ...formData,
      type: ruleType,
      category: 'business_rule',
      enabled: true,
      id: formData.id || `biz_${Date.now()}`,
    };

    onSave(ruleData);
  };

  const renderTypeForm = () => {
    const commonProps = { formData, onChange: setFormData, errors };

    switch (ruleType) {
      case 'delay':
        return <DelayRuleForm {...commonProps} />;
      case 'duration':
        return <DurationRuleForm {...commonProps} />;
      case 'sequence':
        return <SequenceRuleForm {...commonProps} />;
      case 'conditional_constraint':
        return <ConstraintRuleForm {...commonProps} />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {rule ? '编辑规则' : '新建业务规则'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 规则类型选择 */}
        {!rule && (
          <div className="px-6 py-4 border-b bg-gray-50">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              规则类型
            </label>
            <div className="grid grid-cols-2 gap-3">
              {RULE_TYPES.map(({ value, label, icon: Icon, description }) => (
                <button
                  key={value}
                  onClick={() => {
                    setRuleType(value);
                    setFormData({ ...DEFAULT_FORM_DATA[value], type: value, category: 'business_rule', enabled: true });
                    setErrors({});
                  }}
                  className={`p-3 border rounded-lg text-left transition-all ${
                    ruleType === value
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`w-5 h-5 ${ruleType === value ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span className="font-medium text-gray-900">{label}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 表单内容 */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderTypeForm()}
        </div>

        {/* 底部操作 */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Save className="w-4 h-4" />
            保存规则
          </button>
        </div>
      </div>
    </div>
  );
}
