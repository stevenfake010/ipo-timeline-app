// src/components/TaskTable.jsx
import React, { useState } from 'react';
import { Edit2, Trash2, Plus, Save, X } from 'lucide-react';

export function TaskTable({ tasks, onUpdateTask, onDeleteTask, onAddTask }) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const handleEdit = (task) => {
    setEditingId(task.id);
    setEditForm({ ...task });
  };

  const handleSave = () => {
    onUpdateTask(editForm);
    setEditingId(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-lg font-semibold">详细任务列表</h2>
        <button
          onClick={onAddTask}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          添加自定义任务
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">任务名称</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">条线</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">子事项</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">开始周</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">结束周</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tasks.map((task) => (
              <tr key={task.id} className="hover:bg-gray-50">
                {editingId === task.id ? (
                  <>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full px-2 py-1 border rounded"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={editForm.track}
                        onChange={(e) => setEditForm({ ...editForm, track: e.target.value })}
                        className="w-full px-2 py-1 border rounded"
                      >
                        <option value="业务">业务</option>
                        <option value="法律">法律</option>
                        <option value="财务">财务</option>
                        <option value="综合">综合</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={editForm.subItem}
                        onChange={(e) => setEditForm({ ...editForm, subItem: e.target.value })}
                        className="w-full px-2 py-1 border rounded"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={editForm.startWeek}
                        onChange={(e) => setEditForm({ ...editForm, startWeek: parseInt(e.target.value) })}
                        className="w-full px-2 py-1 border rounded"
                        min="1"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={editForm.endWeek}
                        onChange={(e) => setEditForm({ ...editForm, endWeek: parseInt(e.target.value) })}
                        className="w-full px-2 py-1 border rounded"
                        min="1"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button onClick={handleSave} className="text-green-600 hover:text-green-800">
                          <Save className="w-4 h-4" />
                        </button>
                        <button onClick={handleCancel} className="text-gray-600 hover:text-gray-800">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2 text-sm">{task.name}</td>
                    <td className="px-4 py-2 text-sm">{task.track}</td>
                    <td className="px-4 py-2 text-sm">{task.subItem}</td>
                    <td className="px-4 py-2 text-sm">W{task.startWeek}</td>
                    <td className="px-4 py-2 text-sm">W{task.endWeek}</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(task)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteTask(task.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}