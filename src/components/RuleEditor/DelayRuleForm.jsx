// src/components/RuleEditor/DelayRuleForm.jsx
import React from 'react';
import { Clock } from 'lucide-react';

export function DelayRuleForm({ formData, onChange, errors }) {
  const handleChange = (field, value) => {
    onChange({ ...formData, [field]: value });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-blue-600 mb-4">
        <Clock className="w-5 h-5" />
        <span className="font-medium">延迟规则配置</span>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          规则名称 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.name || ''}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="如：保荐人聘任协议签署后2个月才能申报A1"
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
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
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            触发事件 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.trigger || ''}
            onChange={(e) => handleChange('trigger', e.target.value)}
            placeholder="如：保荐人聘任协议签署"
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors?.trigger ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors?.trigger && <p className="text-red-500 text-xs mt-1">{errors.trigger}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            延迟月数 <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={formData.delayMonths || ''}
            onChange={(e) => handleChange('delayMonths', parseInt(e.target.value) || '')}
            min="1"
            max="24"
            placeholder="如：2"
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors?.delayMonths ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors?.delayMonths && <p className="text-red-500 text-xs mt-1">{errors.delayMonths}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          结果事件 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.result || ''}
          onChange={(e) => handleChange('result', e.target.value)}
          placeholder="如：可申报A1"
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors?.result ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors?.result && <p className="text-red-500 text-xs mt-1">{errors.result}</p>}
        <p className="text-gray-400 text-xs mt-1">
          填写触发事件名称和结果事件名称，系统将在触发事件完成后自动计算结果事件的时间
        </p>
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
                className="rounded border-gray-400 text-blue-600 focus:ring-blue-500"
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
          placeholder="如：A1申报, 保荐人（多个标签用逗号分隔）"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
