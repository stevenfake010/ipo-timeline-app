// src/components/RuleEditor/RuleList.jsx
import React, { useState } from 'react';
import { Edit2, Trash2, Plus, Search, Filter, Lock, Unlock, ChevronDown, ChevronRight, Clock, Calendar, GitBranch, AlertTriangle } from 'lucide-react';

const RULE_TYPE_CONFIG = {
  delay: { label: '延迟规则', icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  duration: { label: '时长规则', icon: Calendar, color: 'text-green-600', bgColor: 'bg-green-50' },
  sequence: { label: '顺序规则', icon: GitBranch, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  conditional_constraint: { label: '条件约束', icon: AlertTriangle, color: 'text-orange-600', bgColor: 'bg-orange-50' },
};

const CATEGORY_CONFIG = {
  hard_rule: { label: '硬性规定（只读）', icon: Lock, color: 'text-gray-500', bgColor: 'bg-gray-100' },
  business_rule: { label: '业务规则（可编辑）', icon: Unlock, color: 'text-green-600', bgColor: 'bg-green-50' },
};

export function RuleList({ rules, onEdit, onDelete, onAdd, selectedRuleId }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [expandedCategories, setExpandedCategories] = useState(['hard_rule', 'business_rule']);

  // 过滤规则
  const filteredRules = rules.filter(rule => {
    const matchesSearch = rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          rule.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || rule.type === filterType;
    const matchesCategory = filterCategory === 'all' || rule.category === filterCategory;
    return matchesSearch && matchesType && matchesCategory;
  });

  // 按类别分组
  const groupedRules = filteredRules.reduce((acc, rule) => {
    if (!acc[rule.category]) acc[rule.category] = [];
    acc[rule.category].push(rule);
    return acc;
  }, {});

  const toggleCategory = (category) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const renderRuleCard = (rule) => {
    const typeConfig = RULE_TYPE_CONFIG[rule.type];
    const TypeIcon = typeConfig.icon;
    const isHardRule = rule.category === 'hard_rule';
    const isSelected = rule.id === selectedRuleId;

    return (
      <div
        key={rule.id}
        className={`p-4 border rounded-lg cursor-pointer transition-all ${
          isSelected
            ? 'border-blue-500 bg-blue-50 shadow-md'
            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
        } ${isHardRule ? 'opacity-75' : ''}`}
        onClick={() => onEdit(rule)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${typeConfig.bgColor}`}>
              <TypeIcon className={`w-4 h-4 ${typeConfig.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-gray-900 truncate">{rule.name}</h4>
                {isHardRule && <Lock className="w-3 h-3 text-gray-400" />}
              </div>
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{rule.description}</p>

              {/* 规则详情标签 */}
              <div className="flex flex-wrap gap-2 mt-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${typeConfig.bgColor} ${typeConfig.color}`}>
                  {typeConfig.label}
                </span>
                {rule.tags?.map(tag => (
                  <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                    {tag}
                  </span>
                ))}
              </div>

              {/* 规则特定信息 */}
              {rule.type === 'delay' && (
                <p className="text-xs text-gray-400 mt-2">
                  {rule.trigger} → {rule.delayMonths}个月 → {rule.result}
                </p>
              )}
              {rule.type === 'duration' && (
                <p className="text-xs text-gray-400 mt-2">
                  正常{rule.normalDays}天 / 最短{rule.minDays}天
                </p>
              )}
              {rule.type === 'sequence' && (
                <p className="text-xs text-gray-400 mt-2">
                  {rule.predecessor} → {rule.successor}
                </p>
              )}
            </div>
          </div>

          {!isHardRule && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(rule.id);
              }}
              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* 搜索和过滤 */}
      <div className="p-4 border-b space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索规则..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部类型</option>
            <option value="delay">延迟规则</option>
            <option value="duration">时长规则</option>
            <option value="sequence">顺序规则</option>
            <option value="conditional_constraint">条件约束</option>
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部类别</option>
            <option value="hard_rule">硬性规定</option>
            <option value="business_rule">业务规则</option>
          </select>
        </div>

        <button
          onClick={onAdd}
          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新建业务规则
        </button>
      </div>

      {/* 规则列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {Object.entries(groupedRules).map(([category, categoryRules]) => {
          const catConfig = CATEGORY_CONFIG[category];
          const CategoryIcon = catConfig.icon;
          const isExpanded = expandedCategories.includes(category);

          return (
            <div key={category}>
              <button
                onClick={() => toggleCategory(category)}
                className="flex items-center gap-2 w-full px-2 py-2 text-left hover:bg-gray-50 rounded-lg transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
                <CategoryIcon className={`w-4 h-4 ${catConfig.color}`} />
                <span className="font-medium text-gray-700">{catConfig.label}</span>
                <span className="ml-auto text-sm text-gray-400">({categoryRules.length})</span>
              </button>

              {isExpanded && (
                <div className="mt-2 space-y-2">
                  {categoryRules.map(rule => renderRuleCard(rule))}
                </div>
              )}
            </div>
          );
        })}

        {filteredRules.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>没有找到匹配的规则</p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
              >
                清除搜索
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
