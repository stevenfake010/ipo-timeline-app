// src/components/RuleEditor/RuleEditor.jsx
import React, { useState, useEffect } from 'react';
import { Settings, X } from 'lucide-react';
import { RuleList } from './RuleList';
import { RuleForm } from './RuleForm';

export function RuleEditor({ defaultRules, businessRules, onBusinessRulesChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const allRules = [...defaultRules, ...businessRules];

  const handleEdit = (rule) => {
    if (rule.category === 'hard_rule') {
      // 内置规则只读，弹窗提示
      alert('内置规则（硬性规定）为只读，不可编辑。如需修改，请新建业务规则。');
      return;
    }
    setSelectedRule(rule);
    setShowForm(true);
  };

  const handleDelete = (ruleId) => {
    if (!confirm('确定要删除这条规则吗？')) return;
    const updatedRules = businessRules.filter(r => r.id !== ruleId);
    onBusinessRulesChange(updatedRules);
  };

  const handleAdd = () => {
    setSelectedRule(null);
    setShowForm(true);
  };

  const handleSave = (ruleData) => {
    const existingIndex = businessRules.findIndex(r => r.id === ruleData.id);

    let updatedRules;
    if (existingIndex >= 0) {
      // 更新现有规则
      updatedRules = [...businessRules];
      updatedRules[existingIndex] = ruleData;
    } else {
      // 新增规则
      updatedRules = [...businessRules, ruleData];
    }

    onBusinessRulesChange(updatedRules);
    setShowForm(false);
    setSelectedRule(null);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedRule(null);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg flex items-center gap-2 transition-colors"
      >
        <Settings className="w-4 h-4" />
        规则编辑器
      </button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* 头部 */}
          <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">规则编辑器</h2>
              <p className="text-sm text-gray-500 mt-1">
                管理业务规则，内置规则只读不可修改
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 内容区域 */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full flex">
              {/* 左侧规则列表 */}
              <div className="w-96 border-r flex flex-col bg-gray-50">
                <RuleList
                  rules={allRules}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onAdd={handleAdd}
                  selectedRuleId={selectedRule?.id}
                />
              </div>

              {/* 右侧统计信息 */}
              <div className="flex-1 p-6 overflow-y-auto">
                <h3 className="font-medium text-gray-900 mb-4">规则统计</h3>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {defaultRules.filter(r => r.type === 'delay').length}
                    </div>
                    <div className="text-sm text-blue-600">内置延迟规则</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {businessRules.filter(r => r.type === 'duration').length}
                    </div>
                    <div className="text-sm text-green-600">业务时长规则</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {allRules.filter(r => r.type === 'sequence').length}
                    </div>
                    <div className="text-sm text-purple-600">顺序规则</div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {allRules.filter(r => r.type === 'conditional_constraint').length}
                    </div>
                    <div className="text-sm text-orange-600">条件约束</div>
                  </div>
                </div>

                <div className="bg-gray-100 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-700 mb-2">使用说明</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• <strong>内置规则</strong>：系统预置的硬性规定，不可编辑和删除</li>
                    <li>• <strong>业务规则</strong>：可自由新建、编辑和删除</li>
                    <li>• <strong>延迟规则</strong>：定义事件之间的等待时间</li>
                    <li>• <strong>时长规则</strong>：定义任务的正常/最短工期</li>
                    <li>• <strong>顺序规则</strong>：定义任务之间的依赖关系</li>
                    <li>• <strong>条件约束</strong>：定义特定条件下的时间窗口限制</li>
                  </ul>
                </div>

                {/* 快捷操作提示 */}
                <div className="mt-6 p-4 border border-dashed border-gray-300 rounded-lg">
                  <p className="text-sm text-gray-500 text-center">
                    点击左侧「新建业务规则」或选择一个规则进行编辑
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 规则编辑弹窗 */}
      {showForm && (
        <RuleForm
          rule={selectedRule}
          onSave={handleSave}
          onClose={handleCloseForm}
        />
      )}
    </>
  );
}
