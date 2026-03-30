// src/components/RuleEditor/DurationRuleForm.jsx
import React from 'react';
import { Calendar } from 'lucide-react';
import trackTemplates from '../../data/trackTemplates.json';

// 获取所有任务名称
const ALL_TASKS = trackTemplates.tracks.flatMap(track =>
  track.subItems.flatMap(sub => sub.tasks.map(task => ({ task, subItem: sub.name, track: track.name })))
);

export function DurationRuleForm({ formData, onChange, errors }) {
  const handleChange = (field, value) => {
    onChange({ ...formData, [field]: value });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-green-600 mb-4">
        <Calendar className="w-5 h-5" />
        <span className="font-medium">时长规则配置</span>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          规则名称 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.name || ''}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="如：审计工作时长"
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
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
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          关联任务 <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.taskName || ''}
          onChange={(e) => {
            const selected = ALL_TASKS.find(t => t.task === e.target.value);
            handleChange('taskName', e.target.value);
            if (selected) {
              handleChange('subItem', selected.subItem);
              handleChange('track', selected.track);
            }
          }}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
            errors?.taskName ? 'border-red-500' : 'border-gray-300'
          }`}
        >
          <option value="">选择关联任务</option>
          {ALL_TASKS.map(({ task, subItem, track }) => (
            <option key={`${track}-${subItem}-${task}`} value={task}>
              {track} - {subItem} - {task}
            </option>
          ))}
        </select>
        {errors?.taskName && <p className="text-red-500 text-xs mt-1">{errors.taskName}</p>}
        <p className="text-gray-400 text-xs mt-1">
          选择此规则关联的任务（如不匹配可选"其他"后手动填写）
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            正常所需天数 <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={formData.normalDays || ''}
            onChange={(e) => handleChange('normalDays', parseInt(e.target.value) || '')}
            min="1"
            max="365"
            placeholder="如：60"
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
              errors?.normalDays ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors?.normalDays && <p className="text-red-500 text-xs mt-1">{errors.normalDays}</p>}
          <p className="text-gray-400 text-xs mt-1">正常情况下的预计工期</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            最短天数 <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={formData.minDays || ''}
            onChange={(e) => handleChange('minDays', parseInt(e.target.value) || '')}
            min="1"
            max={formData.normalDays || 365}
            placeholder="如：40"
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
              errors?.minDays ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors?.minDays && <p className="text-red-500 text-xs mt-1">{errors.minDays}</p>}
          <p className="text-gray-400 text-xs mt-1">极端情况可压缩的最短工期</p>
        </div>
      </div>

      {formData.minDays && formData.normalDays && formData.minDays > formData.normalDays && (
        <p className="text-orange-600 text-sm">
          注意：最短天数不应大于正常天数
        </p>
      )}

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
                className="rounded border-gray-400 text-green-600 focus:ring-green-500"
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
          placeholder="如：审计（多个标签用逗号分隔）"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
    </div>
  );
}
