# IPO 排程器交接说明

更新时间：2026-10-30。面向接手的开发者或 AI 助手。先读本文件，再读对应代码，不必重放历史聊天。

## 1. 目标与已经确认的产品决策

港股 IPO 申报准备期排程工具，不是某个真实项目时间表的复制器。案例用于理解业务和校验，不能把样本日期硬编码成通用规则。

- 架构固定为「条线 → 线程 → 事件」。事件均为日期节点，持续工作拆成节点；不另建交付物实体或 gate 层。
- 自动生成事件编码，既有 ID/code 稳定，依赖引用 ID。不要重编号、静默覆盖用户输入或擅自增删事件；用户明确要求增补时例外。
- 主要规则是前置事件及最短/目标/最长间隔。目标、最长可空，空不是0。多数工作没有真实最长间隔，不用人为上限强迫紧排。
- 默认进入排程器；采集器是测试期后台，不做复杂事件库版本选择器，暂不做责任和适用性管理。
- v0.12 起界面按终端用户视角收敛：事件库管理、日历与计算范围两块后台入口不再展示；`spreadWeeks` / `keepPrevious` / `preferWorkingDays` / `a1BusinessDaysOnly` 四个开关恒为开，逻辑保留但不再让用户勾选。方案增加删除功能（含二次确认）。元素仍留在 DOM 中并置 `hidden`，是刻意的：脚本按 id 取用，删除元素会让初始化直接报错。
- 测试期维护方式已选定：用户提意见 → 助手/受权开发者修改云端草稿 → 结构与短/中/长窗口试排 → 发布。暂不开发网页管理员写入界面。
- 核心优先：排程合理性和数据保护。非核心 UI/外围功能不要过度测试。
- 不使用 Sites。GitHub 源码、Vercel 静态部署。事件库已获准公开，**不代表本机真实项目资料、个人方案和密钥也可公开**。

业务口径：中证监「所有备案文件定稿」须在 A1 当天或之前，这是文件准备完成而非实际报送。多家保荐人及整体协调人聘任协议假设同日签署。程序不是完整法规合规校验工具。

## 2. 当前资源与版本

| 项目 | 当前值 |
| --- | --- |
| 正式网站 | https://ipo-timeline-app.vercel.app/ |
| GitHub（公开） | https://github.com/stevenfake010/ipo-timeline-app |
| 本地目录 | `/Users/ethanzuo/Documents/IPO timeline` |
| 界面 / 引擎 | v0.12 / `IPOScheduler.VERSION = 0.10.0`，版本不同是正常的 |
| 内置默认包 | `2026-10-30-r8`，129事件、7条线、23线程；未来以当前云端包为准 |
| 初始云端发布 | `2026-10-30-r8.initial`，ID `4508a256-d18a-4da4-8384-059605793dd0` |
| Supabase | `ipo-timeline-app`，ref `mffcztvzoaayihqttrjo`，新加坡 `ap-southeast-1` |
| 数据库控制台 | https://supabase.com/dashboard/project/mffcztvzoaayihqttrjo |
| Vercel | project `prj_7RFj949sHmkKJPt7485qSR4IKYk5`；team `team_X45vrsmBeRWFLYcQwi5J6aA8`（`ethan-zs-projects`） |
| 云端接入 PR | https://github.com/stevenfake010/ipo-timeline-app/pull/1 |

本地 `.git` 在此次工作时没有提交或 remote，文件为 untracked，不是完成 clone 的正常仓库。**不要直接 git add .**：目录有私有样本、个人 JSON 和历史修订输出。本次通过 GitHub 连接器按文件白名单提交。

接手者推荐从上述仓库另建干净 clone，再开 `codex/…` 分支；不要覆盖原目录或清理 untracked 文件。GitHub main 是部署源。连接器凭据不随文档交接，接手者使用自己的正常授权。

## 3. 文件地图和本地运行

纯 HTML/CSS/JavaScript，无 package.json、npm 依赖或构建步骤。浏览器计算，Node 测试。`index.html` 跳转 `scheduler.html`。

| 文件 | 职责 |
| --- | --- |
| `scheduler.html` / `scheduler.css` | 排程页面和样式，脚本顺序在 HTML 中定义 |
| `scheduler-app.js` | 本机方案、云端默认包接入、Worker、预览/采用、锁定、导入导出 |
| `scheduler-engine.js` | UMD 核心，浏览器/Worker/Node 共用 |
| `collector.html` / `app.js` / `styles.css` | 原规则采集器，保留原本机录入 |
| `scheduler-draft.js` | 历史124事件基础包，不是当前完整库 |
| `scheduler-rule-revision.js` | r2核心前置、间隔修正 |
| `scheduler-prospectus-revision.js` | r3招股书关系修正 |
| `scheduler-feedback-revision.js` / `scheduler-feedback-batch2.js` | r4/r5业务反馈、增删改名与前置调整 |
| `scheduler-prospectus-grouping.js` | r6归拢「招股书撰写」条线 |
| `scheduler-meeting-cycle.js` | r7五次大会及材料，返回 template 和 agenda |
| `scheduler-flexible-planning.js` | r8最长间隔放宽、会议弹性、窗口布局 planningPolicy |
| `scheduler-public-holidays.js` | 2026–2028日历及来源、估算区间 |
| `scheduler-cloud-library.js` | GET-only云端读取、校验、缓存、回退 |
| `cloud-config.js` | URL及公开 publishable key，不含管理密钥 |
| `scripts/export-library.cjs` | 按上述顺序生成内置默认包，校验后输出JSON |
| `db/library-schema.sql` / `db/README.md` | 表/RLS/触发器可审阅源与云端维护说明 |

本机运行 `python3 -m http.server 8000` 后访问 `http://localhost:8000/`，Ctrl+C 停止。直接开文件也可计算，但来源/浏览器权限会影响云端读取和存储。旧 README、ENGINE_SPEC、SCHEDULER_DESIGN_DRAFT、SCHEDULER_QA 不一定与 v0.11 同步，以当前代码、测试及本文件为准。

## 4. 规则字段与核心算法

完整结构以 `scheduler-engine.js::validateTemplate` 为准；用 `require('./scripts/export-library.cjs').build()` 检查当前代码内置包。

- template：project、lanes、threads、events；线程引用 laneId，事件引用 threadId。
- event：id、code、name、threadId、dateMode、dependencies。dateMode 仅 `anchor_input` / `calculated`，不要恢复早期四种日期方式或四种事件类型。
- dependency 存在后置事件上：id、predecessorEventId、minLag、targetLag、maxLag、unit、calendar、strength，可含 targetWeight。多前置同时满足（AND）。
- `hard` 的 min/max 是硬边界；即使 hard 关系，其 target 也只是优化目标。`soft` 关系允许违反并计代价。
- unit：calendar_day / business_day / calendar_month；自然月按对应日/月末，不等同30天。工作日偏移不计出发日，0保留当天。
- calendar：inherit/natural/hk/cn/us/project；inherit 用项目默认日历，不取三地假期并集。
- target=null 不奖励特定等待；max=null 无上界；0/0/0 是严格同日，不可作为空缺清除。硬前置环非法，只有软连接不能定位到锚点。

路径：结构校验 → compile 日期域与硬条件 → 双向传播 → 限时搜索/优化 → 独立 verify。不是只从启动顺排，A1 可以向前收缩日期域。人工锁定、固定锚点及硬区间不能被优化牺牲。

同日节点成组移动；同线程错周是偏好，不是「每周最多一个」。联动移动支持事件链，避免卡在邻居边界。可行旧版也会优化；「仅修复硬冲突」与「重新优化」不同。

r8 planningPolicy：起终锚点、会议列表、事件阶段比例、会议相对布局和权重，仅影响偏好，不新增固定日期/硬前置。阶段随实际窗口调整，避免宽松项目后期大量空周；不会为填满每周制造任务。

会议间隔 min7 / target14 / max42 **自然日**，奖励两周，紧可一周、松可三周。42天仍是当前有限护栏。r8 放开了大多数历史推断型最长值，仅保留明确业务上限/同日关系；不要批量加回上限。

限时启发式不保证偏好全局最优，超时/未知不能说无解。每次结果再用 `verify(template, settings, dates)` 检查，返回空问题数组才通过，不只看 status 或事件数。A1工作日限制是方案级可取消硬条件，不是法规结论；最早A1仅释放指定锚点，仍受其他固定输入及搜索范围限制。未实现人员容量、完整法规核验、已完成事项管理等。

### 五次招股书大会（用户确认）

| 大会 | 事前讨论材料 |
| --- | --- |
| 第一次 EVT-141 | OSS中文初稿、行业概览框架稿 |
| 第二次 EVT-142 | OSS中文更新稿、行业概览章节初稿、风险因素标题稿、业务章节中文初稿 |
| 第三次 EVT-144 | OSS英文初稿、行业概览更新稿、行业报告初稿、UoP初稿 |
| 第四次 EVT-145 | 财务初稿、OSS英文更新稿、业务更新稿、UoP更新稿、行业报告更新稿、风险因素完整稿、监管完整稿 |
| 第五次 EVT-148 | 整本招股书；OSS基本定稿、业务终稿、财务更新稿、行业报告终稿、行业概览终稿、其他章节完整稿及整本合稿就绪 |

第N次材料置于第N−1次会后、本次会前，版本链也需满足。通常前次会→材料 min2/target5工作日，材料→本次会 min1/target2工作日，实际以依赖为准。第五次整本合稿还有输入。OSS→业务章节方向不能丢。

agenda 是说明性议程，真正约束是 dependencies；改议程须同步依赖/测试。新增 EVT-158～161，编码存在历史空号，最大编码不等于事件数。

## 5. 数据保护和云端行为

production指针 → 不可变发布包（rules+calendars+agenda）→ 新方案快照 → 本机试排/预览/采用。网页不上传方案，没有云端写入接口。

| localStorage键 | 内容 |
| --- | --- |
| `ipo-schedule-rule-collector-v1` | 原采集器录入，不得用默认包覆盖 |
| `ipo-scheduler-plans-v1` | 本机方案、规则/日历快照、日期/锁定/历史 |
| `ipo-scheduler-default-library-v1` | 本机导入的自定义默认库，优先于云端默认规则 |
| `ipo-published-library-v1:<Supabase URL>:production` | 校验通过的公开发布缓存，无个人方案 |

云端不可用时用缓存，再回退内置包，明确提示；读取总超时约6秒。新建会再读发布，非实时推送。刷新默认不升级当前方案。

旧方案保存 template、settings.calendars 和 ruleRelease/calendarRelease；旧记录可能没有发布标识，不能因此删除/重建。旧方案自定义事件和日历不可被新默认库覆盖。结果先预览，采用才生效，保留最近8个确认版本。完整JSON才是备份，CSV不是。

不同域名/预览/端口/file地址的存储可能隔离。看不见旧方案先核对来源并导出备份，不先清缓存、重置或用另一包覆盖。

## 6. 云端草稿、发布与回滚

详见 db/README.md。远程迁移 `20261030092449_ipo_library_releases` 已应用，schema.sql 不是重复执行的初始化命令。不再建新项目/表，不碰同账号其他数据库。

- `ipo_library_releases`：唯一version、draft/published、schema_version=1、min_engine_version、data、published_at；发布后禁止改/删。
- `ipo_library_channels`：production/preview及release_id，禁止指向草稿。当前客户端只读production，preview这个名称不表示已经有独立测试环境。
- RLS：匿名/普通登录只读published与production指针，草稿不可见，无写入或发布权。
- 前端只用公开publishable key；secret/service_role/数据库密码绝不进代码、聊天、日志或文档。管理写入用受权连接器/控制台。

操作流程：

1. 先读 production 当前完整发布包为基线，复制唯一版本号草稿。**脚本仅导出内置包，不读取云端**，今后可能落后，不能盲目拿它覆盖云端最新库。
2. 按明确意见改，保留逐条差异（名称、前置、单位、min/target/max、硬软、议程、日历来源及估算标记）。
3. 校验结构/引用/日历/引擎兼容，短中长窗口试排并verify。`IPOLibraryCloud.validate(record,E)` 只接受published外壳；草稿可在内存模拟发布元数据检查，不为校验而提前发布。
4. 在同一数据库事务中锁住审阅草稿和production行，核对草稿和正式基线未被他人改变；置published并填published_at，再切指针，任一步失败则回滚。不要强行覆盖并发更新。
5. 用公开只读权限确认包可读；页面刷新显示新版本，新建方案带版本标识，旧方案不变。普通数据更新无需前端部署；min_engine_version提高时先上线兼容代码。
6. 数据回退只切production到历史发布，不修改历史；已经生成的方案不自动降级。

用户已选择由助手按意见维护发布；超出明确意见的事件增删、重要业务取舍或权限扩大仍需确认。

日历当前标签：CN2026官方、2027–2028估算（含假设补班）；HK2026–2027官方、2028估算；US2026–2028 OPM联邦假期，非交易所日历。标签不代表官方公告永远未公布，后续核实公告再更新云端，不覆盖历史快照。

## 7. GitHub与Vercel工作流

干净clone → codex/…分支 → 相关核心测试 → 提交/PR → Vercel自动预览 → 用户确认 → 合并main → Git集成自动正式部署。核对目标team/project、commit、production状态与正式域名，不只看READY。

Git集成已接通，无需再手动部署同一提交。PR#1功能提交 `08d787714866256687ce1f3082907e2f3ef9b8f5`；用户已明确批准合入main，本交接随PR补充。最终merge SHA/部署以PR和Vercel最新记录为准。

当前未配置自动运行这些Node测试的GitHub Actions门禁，Vercel部署成功不等于测试通过。代码回退优先revert PR；紧急平台rollback会影响后续自动分配，需核对恢复流程。代码回退与云端指针回退独立，不删除发布表。

## 8. 测试、验证证据和后续优先事项

直接运行 `node <测试文件>`，无第三方依赖：

| 文件 | 重点 |
| --- | --- |
| `scheduler-tests.cjs` | 日期域、硬条件/锁定/软关系、随机图穷举、历史回归 |
| `scheduler-prospectus-tests.cjs` | 招股书依赖 |
| `scheduler-feedback-tests.cjs` / `scheduler-batch2-tests.cjs` | 两批业务反馈 |
| `scheduler-grouping-tests.cjs` | 条线线程归拢 |
| `scheduler-meeting-cycle-tests.cjs` | 五轮会议与材料 |
| `scheduler-flexible-tests.cjs` | 弹性间隔/宽松窗口/会议节奏 |
| `scheduler-holiday-tests.cjs` | 假期补班、估算提示、日历快照 |
| `scheduler-default-tests.cjs` | 默认包、本机数据保护 |
| `scheduler-cloud-tests.cjs` | GET-only、成功/缓存/断网/超时、坏包拒绝、旧方案保护 |

某些测试覆盖历史124事件是回归基线，不是现库数量错误。求解测试受时间预算影响；失败记录具体断言，不只增加超时掩盖问题。

云端接入已验证：cloud/default/holiday测试通过；匿名读、草稿不可见、普通角色不可写/发布、已发布不可变均检查通过，安全advisors无告警；预览浏览器看到v0.11、129事件和「云端已连接 · 2026-10-30-r8.initial」。不声称每轮重跑所有专项测试。

后续优先：

1. 继续依据业务反馈检查过强前置/最短间隔、宽松窗口集中问题、材料是否在两会之间；不局部模仿单例。
2. 草稿保留可审阅差异、试排再发布；同步内置离线包是独立代码工作，不自动跟随云端。
3. 正式假期公布后替换估算；美国若需交易日历先明确口径。
4. 跨设备项目保存、网页登录和管理员写入另定隐私/权限/测试环境/RLS，不把现有公开只读表直接开放写入。

诊断顺序：域名/代码版本 → 云端来源/发布号 → 当前方案快照vs新默认 → 本机自定义覆盖 → 相同包/锚点试排并verify → 依赖、日历、优化器。数据存在时不先重置。
