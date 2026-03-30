// src/components/RuleEditor/ConstraintRuleForm.jsx
import React from 'react';
import { AlertTriangle } from 'lucide-react';

export function ConstraintRuleForm({ formData, onChange, errors }) {
  const handleChange = (field, value) => {
    if (field.startsWith('condition.') || field.startsWith('constraint.')) {
      const [parent, child] = field.split('.');
      onChange({
        ...formData,
        [parent]: {
          ...formData[parent],
          [child]: value,
        },
      });
    } else {
      onChange({ ...formData, [field]: value });
    }
  };

  const MONTHS = [
    { value: 1, label: '1月' },
    { value: 2, label: '2月' },
    { value: 3, label: '3月' },
    { value: 4, label: '4月' },
    { value: 5, label: '5月' },
    { value: 6, label: '6月' },
    { value: 7, label: '7月' },
    { value: 8, label: '8月' },
    { value: 9, label: '9月' },
    { value: 10, label: '10月' },
    { value: 11, label: '11月' },
    { value: 12, label: '12月' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-orange-600 mb-4">
        <AlertTriangle className="w-5 h-5" />
        <span className="font-medium">条件约束规则配置</span>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          规则名称 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.name || ''}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="如：基准日9月申报时间约束"
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
            errors?.name ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors?.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          规则描述
        </label>
        <textarea
          value={formData.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="描述此规则的业务背景..."
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {/* 条件设置 */}
      <div className="bg-orange-50 p-4 rounded-lg space-y-3">
        <h4 className="font-medium text-orange-800">触发条件</h4>
        <p className="text-sm text-orange-600">当以下条件满足时，触发此约束</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              条件字段 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.condition?.field || ''}
              onChange={(e) => handleChange('condition.field', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                errors?.['condition.field'] ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">选择字段</option>
              <option value="reportingBaseDate">申报基准日</option>
              <option value="startDate">项目启动日</option>
              <option value="filingDate">申报日</option>
            </select>
            {errors?.['condition.field'] && <p className="text-red-500 text-xs mt-1">{errors['condition.field']}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              条件月份 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.condition?.month || ''}
              onChange={(e) => handleChange('condition.month', parseInt(e.target.value) || '')}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                errors?.['condition.month'] ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">选择月份</option>
              {MONTHS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            {errors?.['condition.month'] && <p className="text-red-500 text-xs mt-1">{errors['condition.month']}</p>}
          </div>
        </div>
      </div>

      {/* 约束设置 */}
      <div className="bg-blue-50 p-4 rounded-lg space-y-3">
        <h4 className="font-medium text-blue-800">时间约束</h4>
        <p className="text-sm text-blue-600">满足条件后，对以下字段进行约束</p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            约束字段 <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.constraint?.field || ''}
            onChange={(e) => handleChange('constraint.field', e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors?.['constraint.field'] ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">选择字段</option>
            <option value="filingDate">A1申报日</option>
            <option value="startDate">项目启动日</option>
          </select>
          {errors?.['constraint.field'] && <p className="text-red-500 text-xs mt-1">{errors['constraint.field']}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              允许开始时间
            </label>
            <input
              type="text"
              value={formData.constraint?.allowedRange?.start || ''}
              onChange={(e) => handleChange('constraint.allowedRange.start', e.target.value)}
              placeholder="如：TBD 或 2024-07-01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-gray-400 text-xs mt-1">最早允许申报的时间</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              允许结束时间
            </label>
            <input
              type="text"
              value={formData.constraint?.allowedRange?.end || ''}
              onChange={(e) => handleChange('constraint.allowedRange.end', e.target.value)}
              placeholder="如：TBD 或 2024-08-31"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-gray-400 text-xs mt-1">最晚允许申报的时间</p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          适用条线
        </label>
        <div className="flex flex-wrap gap-2">
          {['业务', '法律', '财务', '综合'].map(track => (
            <label key={track} className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={formData.applicableTracks?.includes(track) || false}
                onChange={(e) => {
                  const tracks = formData.applicableTracks || [];
                  if (e.target.checked) {
                    handleChange('applicableTracks', [...tracks, track]);
                  } else {
                    handleChange('applicableTracks', tracks.filter(t => t !== track));
                  }
                }}
                className="rounded border-gray-400 text-orange-600 focus:ring-orange-500"
              />
              <span className="text-sm">{track}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          标签
        </label>
        <input
          type="text"
          value={formData.tags?.join(', ') || ''}
          onChange={(e) => handleChange('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
          placeholder="如：基准日, A1申报（多个标签用逗号分隔）"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>
    </div>
  );
}
