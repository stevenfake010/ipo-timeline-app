// src/components/GanttChart.jsx
import React, { useMemo } from 'react';
import { TRACK_COLORS, TRACK_BG_COLORS } from '../utils/dataModels';
import { getWeekDateRange } from '../utils/dateUtils';

export function GanttChart({ tasks, startDate, totalWeeks }) {
  // 按条线和子事项组织任务
  const groupedTasks = useMemo(() => {
    const groups = {};
    for (const task of tasks) {
      if (!groups[task.track]) groups[task.track] = {};
      if (!groups[task.track][task.subItem]) groups[task.track][task.subItem] = [];
      groups[task.track][task.subItem].push(task);
    }
    return groups;
  }, [tasks]);

  // 生成周列表
  const weeks = useMemo(() => {
    const result = [];
    for (let i = 1; i <= totalWeeks; i++) {
      result.push(getWeekDateRange(startDate, i));
    }
    return result;
  }, [startDate, totalWeeks]);

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">项目时间表 (甘特图)</h2>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-full">
          {/* 周标题行 */}
          <div className="flex border-b bg-gray-50">
            <div className="w-48 shrink-0 px-4 py-2 font-medium text-sm">条线/事项</div>
            <div className="flex-1 flex">
              {weeks.map((week, idx) => (
                <div
                  key={idx}
                  className="flex-1 px-1 py-2 text-center text-xs text-gray-600 border-l"
                >
                  <div className="font-medium">W{idx + 1}</div>
                  <div className="text-xs text-gray-400">{week.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 甘特图内容 */}
          {Object.entries(groupedTasks).map(([track, subItems]) => (
            <div key={track} className="border-b">
              {/* 条线标题 */}
              <div className={`flex items-center px-4 py-2 ${TRACK_BG_COLORS[track]}`}>
                <span className={`w-3 h-3 rounded-full ${TRACK_COLORS[track]} mr-2`}></span>
                <span className="font-semibold">{track}条线</span>
              </div>

              {/* 子事项和任务 */}
              {Object.entries(subItems).map(([subItem, subTasks]) => (
                <div key={subItem}>
                  <div className="flex">
                    <div className="w-48 shrink-0 px-4 py-1 text-sm text-gray-600 border-r bg-gray-50">
                      {subItem}
                    </div>
                    <div className="flex-1 flex relative">
                      {weeks.map((_, weekIdx) => (
                        <div
                          key={weekIdx}
                          className="flex-1 h-8 border-l"
                        >
                          {/* 任务条渲染 */}
                          {subTasks.map((task) => {
                            if (task.startWeek <= weekIdx + 1 && task.endWeek >= weekIdx + 1) {
                              const isStart = task.startWeek === weekIdx + 1;
                              const isEnd = task.endWeek === weekIdx + 1;
                              return (
                                <div
                                  key={task.id}
                                  className={`absolute h-6 top-1 ${TRACK_COLORS[track]} rounded ${
                                    isStart ? 'ml-1' : ''
                                  } ${isEnd ? 'mr-1' : ''} ${!(isStart || isEnd) ? 'ml-0 mr-0 w-full' : ''}`}
                                  style={{
                                    left: isStart ? '4px' : '0',
                                    right: isEnd ? '4px' : '0',
                                    width: isStart && isEnd ? 'calc(100% - 8px)' : isStart ? 'auto' : '0',
                                  }}
                                  title={`${task.name} (W${task.startWeek}-W${task.endWeek})`}
                                />
                              );
                            }
                            return null;
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}