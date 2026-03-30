# IPO Timeline Automation — Design Specification

## Overview

A web-based tool that automatically generates weekly IPO execution timelines (上市时间表) for Hong Kong stock listings. Investment bankers input three anchor dates and the system computes all tasks across four parallel work tracks.

---

## Core Concepts

### Three-Level Hierarchy

```
项目 (IPO Timeline)
 │
 ├── 业务条线
 │    ├── 子事项A (如：尽职调查)
 │    │    ├── 任务节点 1
 │    │    ├── 任务节点 2
 │    │    └── ...
 │    ├── 子事项B (如：OSS撰写)
 │    │    └── ...
 │    └── ...
 │
 ├── 法律条线
 │    └── ...
 │
 ├── 财务条线
 │    └── ...
 │
 └── 综合条线
      └── ...
```

- **条线 (Track)**: Four parallel work streams — 业务、法律、财务、综合
- **子事项 (Sub-item)**: Grouped tasks within a track (e.g., 尽职调查, OSS撰写)
- **任务节点 (Task)**: Individual work items with specific start/end weeks

### Time Unit
- **Weekly granularity**: All timelines are expressed in weeks (W1, W2, W3...)
- A typical IPO spans 24-26 weeks (approximately 6 months)

---

## Input Parameters

### Anchor Dates (Required)
| Parameter | Description |
|-----------|-------------|
| 项目启动时间 | Project start date |
| 项目申报基准日 | Reporting base date (audit/legal reference date) |
| 项目申报时间 | A1 filing target date |

### Optional User Customization
- Add custom sub-items and tasks
- Modify auto-generated task durations within allowed range
- Adjust specific task dates manually

---

## Output

### Excel Timeline
- **甘特图视图**: Weekly grid with color-coded bars per track
- **详细列表**: Table view with task name, track, start week, end week
- **格式**: Compatible with standard Excel, matches existing banker workflows

---

## Rule Engine

### Four Rule Types

| Type | Description | Example |
|------|-------------|---------|
| `delay` | Event trigger → fixed wait → result | 保荐人聘任协议签署 → 2 months → 可申报A1 |
| `duration` | Task duration range | 审计工作: normal 60 days, min 40 days |
| `sequence` | Predecessor must complete before successor | OSS大纲完成 → 才能写OSS全稿 |
| `conditional_constraint` | IF condition THEN time constraint | 基准日9月30日 → A1时间必须在xxx-xxx |

### Duration Rule (Revised)
```javascript
{
  type: "duration",
  name: "审计工作",
  track: "财务",
  normalDays: 60,
  minDays: 40,  // compressible range, no subjective compression ratio
  applicableSubItems: ["审计尽调"]
}
```

### Conditional Constraint Rule
```javascript
{
  type: "conditional_constraint",
  name: "基准日9月申报时间约束",
  condition: { field: "reportingBaseDate", month: 9 },
  constraint: { field: "a1FilingDate", allowedRange: { start: "TBD", end: "TBD" } }
}
```

---

## Technical Architecture

### Stack
- **Frontend**: React 18 + Tailwind CSS (SPA)
- **Excel Generation**: SheetJS (xlsx)
- **Data Storage**: LocalStorage + JSON import/export
- **Build Tool**: Vite

### Project Structure
```
ipo-timeline-app/
├── public/
├── src/
│   ├── components/
│   │   ├── AnchorInput.jsx        # 输入三个锚点
│   │   ├── GanttChart.jsx         # 甘特图预览
│   │   ├── TaskTable.jsx          # 详细任务列表
│   │   ├── RuleEditor/
│   │   │   ├── RuleList.jsx       # 规则列表（分组展示）
│   │   │   ├── RuleForm.jsx       # 新建/编辑规则表单
│   │   │   └── RuleTypes/         # 四种规则的表单组件
│   │   └── ExcelExport.jsx         # 导出功能
│   ├── engine/
│   │   ├── RuleEngine.js          # 规则执行引擎
│   │   ├── TaskScheduler.js       # 任务排程计算
│   │   ├── DependencyGraph.js     # 依赖关系图构建
│   │   └── rules/                 # 内置规则库
│   ├── data/
│   │   ├── defaultRules.json      # 内置规则（硬性规定）
│   │   ├── businessRules.json     # 业务规则（用户可编辑）
│   │   └── trackTemplates.json    # 条线/子事项模板
│   ├── utils/
│   │   ├── dateUtils.js           # 日期计算工具
│   │   └── excelGenerator.js      # SheetJS 封装
│   ├── App.jsx
│   └── main.jsx
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

### Data Storage Strategy
- **内置规则**: Hard-coded in `defaultRules.json`, read-only
- **业务规则**: Stored in `businessRules.json`, user-editable via UI
- **项目数据**: Exported/imported as JSON, or kept in LocalStorage
- **未来扩展**: 如果规则库复杂化，可迁移到后端（FastAPI + SQLite）

---

## UI Components

### 1. Anchor Input Panel
- 输入三个日期：启动日、基准日、申报日
- [生成时间表] 按钮触发计算

### 2. Gantt Chart View
- 横轴：按周显示 (W1, W2... 下方标注具体日期)
- 纵轴：四个条线，每个条线下显示子事项
- 颜色区分不同条线
- 鼠标悬停显示任务详情

### 3. Task Table View
- 表格列：任务名称 | 条线 | 子事项 | 开始周 | 结束周 | 操作
- 支持编辑单个任务
- [添加自定义任务] 按钮

### 4. Rule Editor
- 左侧：规则列表，按类型分组（硬性规定 / 业务规则 / 条件约束）
- 顶部：搜索、筛选、新建
- 右侧弹窗：新建/编辑规则表单
- 四种规则类型有各自的配置表单

### 5. Excel Export
- 一键导出当前时间表为 Excel
- 格式与投行现有模板兼容

---

## Implementation Priority

### Phase 1: Core MVP
1. 数据模型和基础 UI 框架
2. 规则引擎（延迟、时长、顺序）
3. 甘特图生成
4. Excel 导出

### Phase 2: Enhanced Rules
5. 条件约束规则
6. 规则编辑器 UI
7. 业务规则可视化编辑

### Phase 3: Polish
8. 自定义任务功能
9. 项目导入/导出
10. 规则导入/导出

---

## Key Design Decisions

1. **Pure frontend first**: Validate feasibility before adding backend complexity
2. **Weekly granularity**: Matches actual banker workflow (按周排时间表)
3. **Rule categorization**: Hard rules (内置) vs Business rules (用户可编辑)
4. **Duration as range**: No subjective compression ratio, just min/normal days
5. **Excel output**: Direct match to existing banker workflows
