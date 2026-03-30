// src/components/RuleEditor/SequenceRuleForm.jsx
import React from 'react';
import { GitBranch } from 'lucide-react';
import trackTemplates from '../../data/trackTemplates.json';

// 获取所有任务名称
const ALL_TASKS = trackTemplates.tracks.flatMap(track =>
  track.subItems.flatMap(sub => sub.tasks.map(task => ({ task, subItem: sub.name, track: track.name })))
);

export function SequenceRuleForm({ formData, onChange, errors }) {
  const handleChange = (field, value) => {
    onChange({ ...formData, [field]: value });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-purple-600 mb-4">
        <GitBranch className="w-5 h-5" />
        <span className="font-medium">顺序规则配置</span>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          规则名称 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.name || ''}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="如：OSS大纲完成后才能写全稿"
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
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
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            前置任务 <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.predecessor || ''}
            onChange={(e) => handleChange('predecessor', e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
              errors?.predecessor ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">选择前置任务</option>
            {ALL_TASKS.map(({ task, subItem, track }) => (
              <option key={`${track}-${subItem}-${task}`} value={task}>
                {task}
              </option>
            ))}
          </select>
          {errors?.predecessor && <p className="text-red-500 text-xs mt-1">{errors.predecessor}</p>}
          <p className="text-gray-400 text-xs mt-1">前置任务必须完成后，才能开始后继任务</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            后继任务 <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.successor || ''}
            onChange={(e) => handleChange('successor', e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
              errors?.successor ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">选择后继任务</option>
            {ALL_TASKS.map(({ task, subItem, track }) => (
              <option key={`${track}-${subItem}-${task}`} value={task}>
                {task}
              </option>
            ))}
          </select>
          {errors?.successor && <p className="text-red-500 text-xs mt-1">{errors.successor}</p>}
        </div>
      </div>

      {formData.predecessor && formData.successor && formData.predecessor === formData.successor && (
        <p className="text-red-500 text-sm">
          错误：前置任务和后继任务不能相同
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
                className="rounded border-gray-400 text-purple-600 focus:ring-purple-500"
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
          placeholder="如：OSS, 业务条线（多个标签用逗号分隔）"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>
    </div>
  );
}
