(() => {
  "use strict";

  const STORAGE_KEY = "ipo-schedule-rule-collector-v1";
  const TREE_VIEW_STORAGE_KEY = "ipo-schedule-tree-view-v1";
  const SCHEMA_VERSION = "1.5";

  const CALENDAR_LABELS = {
    inherit: "继承项目默认日历",
    natural: "自然日",
    hk: "香港工作日",
    cn: "中国内地工作日",
    us: "美国工作日",
    project: "项目自定义日历",
  };

  const dom = {};
  let state = loadState();
  let selectedEventId = state.events[0]?.id || null;
  let searchTerm = "";
  let toastTimer = null;
  const treeViewState = loadTreeViewState();
  const collapsedLaneIds = new Set(treeViewState.lanes);
  const collapsedThreadIds = new Set(treeViewState.threads);

  function newState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      project: {
        name: "未命名港股 IPO 项目",
        description: "请先建立条线、线程和事件。",
        timezone: "Asia/Hong_Kong",
        defaultCalendar: "hk",
        customCalendarName: "",
      },
      lanes: [],
      threads: [],
      events: [],
      updatedAt: new Date().toISOString(),
    };
  }

  function newEvent(threadId, code = "") {
    return {
      id: uid("evt"),
      threadId,
      code,
      name: "未命名事件",
      description: "",
      dateMode: "calculated",
      dependencies: [],
    };
  }

  function newDependency(predecessorEventId) {
    return {
      id: uid("dep"),
      predecessorEventId,
      minLag: 0,
      targetLag: 0,
      maxLag: 0,
      unit: "calendar_day",
      calendar: "inherit",
      strength: "hard",
    };
  }

  function uid(prefix) {
    const token =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${token}`;
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return newState();
      return normalizeState(JSON.parse(saved));
    } catch (error) {
      console.warn("无法读取本机数据，将使用空白项目。", error);
      return newState();
    }
  }

  function loadTreeViewState() {
    try {
      const saved = JSON.parse(localStorage.getItem(TREE_VIEW_STORAGE_KEY) || "{}");
      return {
        lanes: Array.isArray(saved.lanes) ? saved.lanes : [],
        threads: Array.isArray(saved.threads) ? saved.threads : [],
      };
    } catch (error) {
      console.warn("无法读取导航折叠状态，将默认展开全部项目。", error);
      return { lanes: [], threads: [] };
    }
  }

  function saveTreeViewState() {
    try {
      localStorage.setItem(
        TREE_VIEW_STORAGE_KEY,
        JSON.stringify({
          lanes: [...collapsedLaneIds],
          threads: [...collapsedThreadIds],
        }),
      );
    } catch (error) {
      console.warn("无法保存导航折叠状态。", error);
    }
  }

  function normalizeState(input) {
    const blank = newState();
    if (!input || typeof input !== "object") return blank;

    const normalized = {
      ...blank,
      ...input,
      schemaVersion: SCHEMA_VERSION,
      project: { ...blank.project, ...(input.project || {}) },
      lanes: Array.isArray(input.lanes) ? input.lanes : [],
      threads: Array.isArray(input.threads) ? input.threads : [],
      events: Array.isArray(input.events) ? input.events : [],
    };

    normalized.events = normalized.events.map((event) => {
      const base = newEvent(event.threadId || "");
      const {
        basisType: _basisType,
        reviewer: _reviewer,
        sourceNote: _sourceNote,
        notes: _notes,
        applicability: _applicability,
        applicabilityNote: _applicabilityNote,
        owner: _owner,
        participants: _participants,
        eventType: legacyEventType,
        duration: _duration,
        earliestDate: _earliestDate,
        latestDate: _latestDate,
        ...computableEvent
      } = event;
      if (!["calculated", "anchor_input"].includes(computableEvent.dateMode)) {
        computableEvent.dateMode = legacyEventType === "anchor" ? "anchor_input" : "calculated";
      }
      return {
        ...base,
        ...computableEvent,
        dependencies: Array.isArray(computableEvent.dependencies)
          ? computableEvent.dependencies.map((dependency) => {
              const { note: _note, relation: _relation, ...computableDependency } = dependency;
              return {
                ...newDependency(computableDependency.predecessorEventId || ""),
                ...computableDependency,
              };
            })
          : [],
      };
    });

    normalized.events.forEach((event) => {
      if (!event.code || !event.code.trim()) event.code = nextEventCode(normalized.events);
    });

    return normalized;
  }

  function nextEventCode(events = state.events) {
    const used = new Set(events.map((event) => String(event.code || "").toUpperCase()));
    const maxSequence = events.reduce((maximum, event) => {
      const match = String(event.code || "").toUpperCase().match(/^EVT-(\d+)$/);
      return match ? Math.max(maximum, Number(match[1])) : maximum;
    }, 0);
    let sequence = maxSequence + 1;
    let candidate = `EVT-${String(sequence).padStart(3, "0")}`;
    while (used.has(candidate)) {
      sequence += 1;
      candidate = `EVT-${String(sequence).padStart(3, "0")}`;
    }
    return candidate;
  }

  function saveState() {
    state.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      dom.saveState.textContent = `已保存 · ${new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date())}`;
    } catch (error) {
      dom.saveState.textContent = "本机保存失败，请及时导出";
      console.warn("无法保存到本机。", error);
    }
  }

  function cacheDom() {
    [
      "saveState",
      "projectNameDisplay",
      "projectDescriptionDisplay",
      "laneCount",
      "threadCount",
      "eventCount",
      "searchInput",
      "structureTree",
      "collapseAllButton",
      "expandAllButton",
      "emptyState",
      "eventEditor",
      "eventBreadcrumb",
      "eventTitle",
      "eventLaneSelect",
      "eventThreadSelect",
      "dependencyList",
      "dependencyEmpty",
      "readinessScore",
      "readinessText",
      "readinessBar",
      "issueCountBadge",
      "issueList",
      "entityDialog",
      "entityForm",
      "entityEyebrow",
      "entityDialogTitle",
      "entityType",
      "entityParentId",
      "entityNameLabel",
      "entityNameInput",
      "entityDescriptionInput",
      "projectDialog",
      "projectForm",
      "projectNameInput",
      "projectDescriptionInput",
      "projectTimezoneInput",
      "projectCalendarInput",
      "projectCustomCalendarInput",
      "importFile",
      "toast",
    ].forEach((id) => {
      dom[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    document.getElementById("addLaneButton").addEventListener("click", () => openEntityDialog("add-lane"));
    document.getElementById("emptyAddLaneButton").addEventListener("click", handleEmptyAction);
    document.getElementById("projectSettingsButton").addEventListener("click", openProjectDialog);
    document.getElementById("exportButton").addEventListener("click", exportJson);
    document.getElementById("validateButton").addEventListener("click", () => {
      renderInspector();
      showToast("信息完整性检查已完成");
    });
    document.getElementById("resetButton").addEventListener("click", resetData);
    document.getElementById("addDependencyButton").addEventListener("click", addDependency);
    document.getElementById("deleteEventButton").addEventListener("click", deleteSelectedEvent);
    document.getElementById("duplicateEventButton").addEventListener("click", duplicateSelectedEvent);
    document.getElementById("cancelEntityButton").addEventListener("click", () => dom.entityDialog.close());
    document.getElementById("cancelProjectButton").addEventListener("click", () => dom.projectDialog.close());
    dom.collapseAllButton.addEventListener("click", collapseAllTreeNodes);
    dom.expandAllButton.addEventListener("click", expandAllTreeNodes);

    dom.searchInput.addEventListener("input", (event) => {
      searchTerm = event.target.value.trim().toLowerCase();
      renderTree();
    });

    dom.structureTree.addEventListener("click", handleTreeClick);
    dom.entityForm.addEventListener("submit", saveEntityDialog);
    dom.projectForm.addEventListener("submit", saveProjectDialog);
    dom.importFile.addEventListener("change", importJson);
    document.getElementById("openSchedulerButton")?.addEventListener("click", () => {
      const target = window.open("scheduler.html", "ipo-scheduler");
      if (!target) { window.alert("请允许打开本地排程器窗口，或手动打开 scheduler.html 并导入规则 JSON。"); return; }
      const listener = (event) => {
        if (event.source !== target || event.data?.type !== "ipo-scheduler-ready") return;
        if (event.origin !== location.origin && !(location.protocol === "file:" && event.origin === "null")) return;
        target.postMessage({ type: "ipo-scheduler-snapshot", template: JSON.parse(JSON.stringify(state)) }, location.origin === "null" ? "*" : location.origin);
        window.removeEventListener("message", listener);
      };
      window.addEventListener("message", listener);
      window.setTimeout(() => window.removeEventListener("message", listener), 30000);
    });
    dom.issueList.addEventListener("click", handleIssueClick);

    dom.eventEditor.addEventListener("input", handleEditorInput);
    dom.eventEditor.addEventListener("change", handleEditorChange);
    dom.dependencyList.addEventListener("input", handleDependencyInput);
    dom.dependencyList.addEventListener("change", handleDependencyInput);
    dom.dependencyList.addEventListener("click", handleDependencyClick);
  }

  function renderAll() {
    ensureSelectedEvent();
    renderProjectSummary();
    renderTree();
    renderEditor();
    renderInspector();
  }

  function ensureSelectedEvent() {
    if (selectedEventId && state.events.some((event) => event.id === selectedEventId)) return;
    selectedEventId = state.events[0]?.id || null;
  }

  function renderProjectSummary() {
    dom.projectNameDisplay.textContent = state.project.name || "未命名港股 IPO 项目";
    dom.projectDescriptionDisplay.textContent = state.project.description || "请先建立条线、线程和事件。";
    dom.laneCount.textContent = String(state.lanes.length);
    dom.threadCount.textContent = String(state.threads.length);
    dom.eventCount.textContent = String(state.events.length);
  }

  function renderTree() {
    if (!state.lanes.length) {
      dom.structureTree.innerHTML = '<div class="tree-empty">尚未建立条线。<br />点击上方按钮开始。</div>';
      return;
    }

    const html = state.lanes
      .map((lane) => {
        const laneThreads = state.threads.filter((thread) => thread.laneId === lane.id);
        const laneThreadIds = new Set(laneThreads.map((thread) => thread.id));
        const laneEventCount = state.events.filter((event) => laneThreadIds.has(event.threadId)).length;
        const laneCollapsed = !searchTerm && collapsedLaneIds.has(lane.id);
        const threadHtml = laneThreads
          .map((thread) => {
            const allThreadEvents = state.events.filter((event) => event.threadId === thread.id);
            const threadEvents = state.events.filter((event) => {
              if (event.threadId !== thread.id) return false;
              if (!searchTerm) return true;
              return `${event.code} ${event.name}`.toLowerCase().includes(searchTerm);
            });
            const threadCollapsed = !searchTerm && collapsedThreadIds.has(thread.id);

            const eventHtml = threadEvents
              .map(
                (event) => `
                  <button class="event-row ${event.id === selectedEventId ? "active" : ""}" data-action="select-event" data-id="${escapeHtml(event.id)}" type="button">
                    <span class="event-type-dot">${event.dateMode === "anchor_input" ? "锚" : "事"}</span>
                    <span class="event-name">${escapeHtml(event.name || "未命名事件")}</span>
                  </button>`,
              )
              .join("");

            return `
              <div class="thread-block">
                <div class="thread-row">
                  <button class="tree-toggle thread-toggle" data-action="toggle-thread" data-id="${escapeHtml(thread.id)}" type="button" aria-expanded="${!threadCollapsed}" title="${threadCollapsed ? "展开" : "收起"}线程">
                    <span class="tree-chevron" aria-hidden="true">${threadCollapsed ? "›" : "⌄"}</span>
                    <span class="thread-name">${escapeHtml(thread.name || "未命名线程")}</span>
                    <span class="tree-count" aria-label="${allThreadEvents.length} 个事件">${allThreadEvents.length}</span>
                  </button>
                  <span class="row-actions">
                    <button class="mini-icon" data-action="add-event" data-id="${escapeHtml(thread.id)}" type="button" title="新增事件">＋</button>
                    <button class="mini-icon" data-action="edit-thread" data-id="${escapeHtml(thread.id)}" type="button" title="编辑线程">✎</button>
                    <button class="mini-icon" data-action="delete-thread" data-id="${escapeHtml(thread.id)}" type="button" title="删除线程">×</button>
                  </span>
                </div>
                <div class="thread-events ${threadCollapsed ? "tree-collapsed" : ""}">
                  ${eventHtml}
                </div>
              </div>`;
          })
          .join("");

        return `
          <div class="lane-block">
            <div class="lane-row">
              <button class="tree-toggle lane-toggle" data-action="toggle-lane" data-id="${escapeHtml(lane.id)}" type="button" aria-expanded="${!laneCollapsed}" title="${laneCollapsed ? "展开" : "收起"}条线">
                <span class="tree-chevron" aria-hidden="true">${laneCollapsed ? "›" : "⌄"}</span>
                <span class="lane-name">${escapeHtml(lane.name || "未命名条线")}</span>
                <span class="tree-count" aria-label="${laneEventCount} 个事件">${laneEventCount}</span>
              </button>
              <span class="row-actions">
                <button class="mini-icon" data-action="add-thread" data-id="${escapeHtml(lane.id)}" type="button" title="新增线程">＋</button>
                <button class="mini-icon" data-action="edit-lane" data-id="${escapeHtml(lane.id)}" type="button" title="编辑条线">✎</button>
                <button class="mini-icon" data-action="delete-lane" data-id="${escapeHtml(lane.id)}" type="button" title="删除条线">×</button>
              </span>
            </div>
            <div class="lane-children ${laneCollapsed ? "tree-collapsed" : ""}">
              ${threadHtml}
            </div>
          </div>`;
      })
      .join("");

    dom.structureTree.innerHTML = html;
  }

  function renderEditor() {
    const event = getSelectedEvent();
    if (!event) {
      dom.eventEditor.classList.add("hidden");
      dom.emptyState.classList.remove("hidden");
      renderEmptyState();
      return;
    }

    dom.emptyState.classList.add("hidden");
    dom.eventEditor.classList.remove("hidden");

    renderThreadSelect(event);
    dom.eventEditor.querySelectorAll("[data-field]").forEach((input) => {
      if (input.closest(".dependency-row")) return;
      const value = getPath(event, input.dataset.field);
      input.value = value ?? "";
    });

    updateEditorHeading(event);
    renderDependencies(event);
  }

  function renderEmptyState() {
    const title = dom.emptyState.querySelector("h2");
    const copy = dom.emptyState.querySelector("p:not(.eyebrow)");
    const button = document.getElementById("emptyAddLaneButton");

    if (!state.lanes.length) {
      title.textContent = "从第一条条线开始采集";
      copy.textContent = "本工具不预置任何真实项目事件，也不会从样本推断规则。所有条线、线程、事件和先后关系均由你亲自填写。";
      button.textContent = "新增第一条线";
    } else if (!state.threads.length) {
      title.textContent = "为条线增加线程";
      copy.textContent = "线程用于组织一组严格相关的事件。线程名称和说明均由你定义。";
      button.textContent = "新增第一条线程";
    } else {
      title.textContent = "在线程下创建事件";
      copy.textContent = "事件是排程引擎的最小计算单位；不同阶段、不同版本均可以分别建立为事件。";
      button.textContent = "新增第一项事件";
    }
  }

  function renderThreadSelect(event) {
    const options = state.lanes
      .map((lane) => {
        const threads = state.threads.filter((thread) => thread.laneId === lane.id);
        if (!threads.length) return "";
        return `<optgroup label="${escapeHtml(lane.name)}">${threads
          .map(
            (thread) =>
              `<option value="${thread.id}" ${thread.id === event.threadId ? "selected" : ""}>${escapeHtml(thread.name)}</option>`,
          )
          .join("")}</optgroup>`;
      })
      .join("");

    dom.eventThreadSelect.innerHTML = options;
    const thread = getThread(event.threadId);
    const lane = thread ? getLane(thread.laneId) : null;
    dom.eventLaneSelect.innerHTML = `<option>${escapeHtml(lane?.name || "未找到所属条线")}</option>`;
  }

  function updateEditorHeading(event) {
    const thread = getThread(event.threadId);
    const lane = thread ? getLane(thread.laneId) : null;
    dom.eventBreadcrumb.textContent = `${lane?.name || "未找到条线"} / ${thread?.name || "未找到线程"}`;
    dom.eventTitle.textContent = event.name || "未命名事件";
  }

  function renderDependencies(event) {
    if (!event.dependencies.length) {
      dom.dependencyList.innerHTML = "";
      dom.dependencyEmpty.classList.remove("hidden");
      return;
    }

    dom.dependencyEmpty.classList.add("hidden");
    dom.dependencyList.innerHTML = event.dependencies
      .map((dependency, index) => {
        const eventOptions = buildPredecessorOptions(event.id, dependency.predecessorEventId);
        const calendarOptions = Object.entries(CALENDAR_LABELS)
          .map(
            ([value, label]) =>
              `<option value="${value}" ${dependency.calendar === value ? "selected" : ""}>${escapeHtml(label)}</option>`,
          )
          .join("");

        return `
          <div class="dependency-row" data-dependency-id="${dependency.id}">
            <div class="dependency-row-head">
              <strong>前置关系 ${index + 1}</strong>
              <button class="mini-icon" data-action="remove-dependency" data-id="${dependency.id}" type="button" title="删除关系">×</button>
            </div>
            <div class="dependency-grid">
              <label><span>前置事件</span><select data-dep-field="predecessorEventId">${eventOptions}</select></label>
              <label><span>最小间隔</span><input data-dep-field="minLag" type="number" min="0" value="${escapeHtml(String(dependency.minLag ?? 0))}" /></label>
              <label><span>目标间隔（可空）</span><input data-dep-field="targetLag" type="number" min="0" placeholder="不设目标" value="${escapeHtml(String(dependency.targetLag ?? ''))}" /></label>
              <label><span>最大间隔（可空）</span><input data-dep-field="maxLag" type="number" min="0" placeholder="不限" value="${escapeHtml(String(dependency.maxLag ?? ''))}" /></label>
              <label><span>单位</span><select data-dep-field="unit">
                <option value="calendar_day" ${dependency.unit === "calendar_day" ? "selected" : ""}>自然日</option>
                <option value="business_day" ${dependency.unit === "business_day" ? "selected" : ""}>工作日</option>
                <option value="calendar_month" ${dependency.unit === "calendar_month" ? "selected" : ""}>自然月（对应日，月末截断）</option>
              </select></label>
              <label><span>计算日历</span><select data-dep-field="calendar">${calendarOptions}</select></label>
            </div>
            <div class="dependency-bottom single-field">
              <label class="field"><span>约束强度</span><select data-dep-field="strength">
                <option value="hard" ${dependency.strength === "hard" ? "selected" : ""}>硬约束：范围必须满足</option>
                <option value="soft" ${dependency.strength === "soft" ? "selected" : ""}>软偏好：尽量满足</option>
              </select></label>
            </div>
          </div>`;
      })
      .join("");
  }

  function buildPredecessorOptions(currentEventId, selectedId) {
    const selectedExists = state.events.some(
      (event) => event.id === selectedId && event.id !== currentEventId,
    );
    const placeholder = `<option value="" ${selectedExists ? "" : "selected"}>请选择前置事件</option>`;
    return placeholder + state.lanes
      .map((lane) => {
        const laneThreads = state.threads.filter((thread) => thread.laneId === lane.id);
        const options = laneThreads
          .flatMap((thread) =>
            state.events
              .filter((event) => event.threadId === thread.id && event.id !== currentEventId)
              .map(
                (event) =>
                  `<option value="${event.id}" ${event.id === selectedId ? "selected" : ""}>${escapeHtml(thread.name)} · ${escapeHtml(event.name)}</option>`,
              ),
          )
          .join("");
        return options ? `<optgroup label="${escapeHtml(lane.name)}">${options}</optgroup>` : "";
      })
      .join("");
  }

  function renderInspector() {
    const issues = validateState();
    const score = calculateReadiness();
    dom.readinessScore.textContent = `${score}%`;
    dom.readinessBar.style.width = `${score}%`;
    dom.readinessText.textContent = !state.events.length
      ? "尚未录入事件"
      : score === 100
        ? "已具备求解输入"
        : score >= 70
          ? "主要信息已填写"
          : "仍需补充关键字段";

    dom.issueCountBadge.textContent = String(issues.length);
    if (!state.events.length) {
      dom.issueList.innerHTML = '<p class="muted-copy">录入事件后，这里会检查缺失字段、非法区间、循环依赖和未连接锚点的事件。</p>';
      return;
    }

    if (!issues.length) {
      dom.issueList.innerHTML = '<div class="issue-item info"><strong>未发现结构问题</strong><small>仍需由你确认规则内容本身是否正确。</small></div>';
      return;
    }

    dom.issueList.innerHTML = issues
      .slice(0, 18)
      .map((issue) => {
        const event = issue.eventId ? getEvent(issue.eventId) : null;
        return `<div class="issue-item ${issue.level}" ${issue.eventId ? `data-event-id="${issue.eventId}"` : ""}>
          <strong>${escapeHtml(issue.message)}</strong>
          ${event ? `<small>${escapeHtml(event.code || "未编码")} · ${escapeHtml(event.name)}</small>` : ""}
        </div>`;
      })
      .join("");
  }

  function validateState() {
    const issues = [];
    if (!state.lanes.length) issues.push({ level: "info", message: "尚未建立条线。" });
    if (state.lanes.length && !state.threads.length) issues.push({ level: "info", message: "已有条线，但尚未建立线程。" });
    if (state.threads.length && !state.events.length) issues.push({ level: "info", message: "已有线程，但尚未建立事件。" });
    if (!state.events.length) return issues;

    const anchors = state.events.filter((event) => event.dateMode === "anchor_input");
    if (!anchors.length) issues.push({ level: "warning", message: "项目尚未定义任何锚点事件。" });

    const codeMap = new Map();
    state.events.forEach((event) => {
      if (!event.code.trim()) {
        issues.push({ level: "error", eventId: event.id, message: "缺少事件编码。" });
      } else {
        const normalizedCode = event.code.trim().toLowerCase();
        if (codeMap.has(normalizedCode)) {
          issues.push({ level: "error", eventId: event.id, message: "事件编码与其他事件重复。" });
        } else {
          codeMap.set(normalizedCode, event.id);
        }
      }

      if (!event.name.trim() || event.name === "未命名事件") {
        issues.push({ level: "error", eventId: event.id, message: "缺少清晰的事件名称。" });
      }
      if (!getThread(event.threadId)) {
        issues.push({ level: "error", eventId: event.id, message: "事件未归属有效线程。" });
      }
      if (event.dateMode === "calculated" && !event.dependencies.length) {
        issues.push({ level: "warning", eventId: event.id, message: "由关系计算的事件尚未添加前置事件。" });
      }

      event.dependencies.forEach((dependency) => {
        if (!getEvent(dependency.predecessorEventId)) {
          issues.push({ level: "error", eventId: event.id, message: "存在未选择前置事件的关系。" });
        }
        if (dependency.predecessorEventId === event.id) {
          issues.push({ level: "error", eventId: event.id, message: "事件不能把自己设为前置事件。" });
        }
        const range = numericRange(dependency.minLag, dependency.targetLag, dependency.maxLag);
        if (!range.valid) {
          issues.push({ level: "error", eventId: event.id, message: "前置关系的最小／目标／最大间隔顺序不合法。" });
        }
      });
    });

    const cycleNodes = findCycleNodes();
    cycleNodes.forEach((eventId) => {
      issues.push({ level: "error", eventId, message: "该事件位于循环依赖中。严格先后关系不能形成闭环。" });
    });

    if (anchors.length) {
      const connected = eventsConnectedToAnchors(anchors.map((anchor) => anchor.id));
      state.events.forEach((event) => {
        if (!connected.has(event.id)) {
          issues.push({ level: "warning", eventId: event.id, message: "该事件所在关系网络尚未连接任何锚点。" });
        }
      });
    }

    return dedupeIssues(issues);
  }

  function numericRange(min, target, max) {
    const numbers = [Number(min),target==null||target===''?null:Number(target),max==null||max===''?null:Number(max)];
    const valid = min!==''&&min!=null&&numbers.every(value=>value===null||Number.isInteger(value)&&value>=0&&value<=3650) && (numbers[1]===null||numbers[0]<=numbers[1]) && (numbers[2]===null||numbers[0]<=numbers[2]&&(numbers[1]===null||numbers[1]<=numbers[2]));
    return { valid, numbers };
  }

  function findCycleNodes() {
    const adjacency = new Map(state.events.map((event) => [event.id, []]));
    state.events.forEach((event) => {
      event.dependencies.forEach((dependency) => {
        if (adjacency.has(dependency.predecessorEventId)) {
          adjacency.get(dependency.predecessorEventId).push(event.id);
        }
      });
    });

    const visiting = new Set();
    const visited = new Set();
    const cycleNodes = new Set();

    function walk(nodeId, stack) {
      if (visiting.has(nodeId)) {
        const start = stack.indexOf(nodeId);
        stack.slice(start).forEach((id) => cycleNodes.add(id));
        return;
      }
      if (visited.has(nodeId)) return;
      visiting.add(nodeId);
      stack.push(nodeId);
      (adjacency.get(nodeId) || []).forEach((nextId) => walk(nextId, stack));
      stack.pop();
      visiting.delete(nodeId);
      visited.add(nodeId);
    }

    adjacency.forEach((_, nodeId) => walk(nodeId, []));
    return cycleNodes;
  }

  function eventsConnectedToAnchors(anchorIds) {
    const adjacency = new Map(state.events.map((event) => [event.id, new Set()]));
    state.events.forEach((event) => {
      event.dependencies.forEach((dependency) => {
        if (!adjacency.has(dependency.predecessorEventId)) return;
        adjacency.get(event.id).add(dependency.predecessorEventId);
        adjacency.get(dependency.predecessorEventId).add(event.id);
      });
    });

    const connected = new Set();
    const queue = [...anchorIds];
    while (queue.length) {
      const current = queue.shift();
      if (connected.has(current)) continue;
      connected.add(current);
      (adjacency.get(current) || []).forEach((next) => {
        if (!connected.has(next)) queue.push(next);
      });
    }
    return connected;
  }

  function dedupeIssues(issues) {
    const seen = new Set();
    return issues.filter((issue) => {
      const key = `${issue.level}|${issue.eventId || ""}|${issue.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function calculateReadiness() {
    if (!state.events.length) return 0;
    let achieved = 0;
    let possible = 0;

    state.events.forEach((event) => {
      const checks = [
        Boolean(event.code.trim()),
        Boolean(event.name.trim() && event.name !== "未命名事件"),
        Boolean(getThread(event.threadId)),
        Boolean(event.description.trim()),
      ];

      if (event.dateMode === "calculated") checks.push(event.dependencies.length > 0);
      checks.forEach((passed) => {
        possible += 1;
        if (passed) achieved += 1;
      });
    });

    return Math.round((achieved / possible) * 100);
  }

  function handleEmptyAction() {
    if (!state.lanes.length) {
      openEntityDialog("add-lane");
    } else if (!state.threads.length) {
      openEntityDialog("add-thread", state.lanes[0].id);
    } else {
      addEvent(state.threads[0].id);
    }
  }

  function handleTreeClick(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    const id = target.dataset.id;

    if (action === "toggle-lane") {
      toggleCollapsedId(collapsedLaneIds, id);
    } else if (action === "toggle-thread") {
      toggleCollapsedId(collapsedThreadIds, id);
    } else if (action === "select-event") {
      selectedEventId = id;
      renderAll();
    } else if (action === "add-thread") {
      openEntityDialog("add-thread", id);
    } else if (action === "add-event") {
      addEvent(id);
    } else if (action === "edit-lane") {
      openEntityDialog("edit-lane", id);
    } else if (action === "edit-thread") {
      openEntityDialog("edit-thread", id);
    } else if (action === "delete-lane") {
      deleteLane(id);
    } else if (action === "delete-thread") {
      deleteThread(id);
    }
  }

  function toggleCollapsedId(collection, id) {
    if (collection.has(id)) collection.delete(id);
    else collection.add(id);
    saveTreeViewState();
    renderTree();
  }

  function collapseAllTreeNodes() {
    state.lanes.forEach((lane) => collapsedLaneIds.add(lane.id));
    state.threads.forEach((thread) => collapsedThreadIds.add(thread.id));
    saveTreeViewState();
    renderTree();
  }

  function expandAllTreeNodes() {
    collapsedLaneIds.clear();
    collapsedThreadIds.clear();
    saveTreeViewState();
    renderTree();
  }

  function expandEventPath(eventId) {
    const event = getEvent(eventId);
    const thread = getThread(event?.threadId);
    if (!thread) return;
    const threadChanged = collapsedThreadIds.delete(thread.id);
    const laneChanged = collapsedLaneIds.delete(thread.laneId);
    if (threadChanged || laneChanged) saveTreeViewState();
  }

  function openEntityDialog(type, id = "") {
    dom.entityType.value = type;
    dom.entityParentId.value = id;
    dom.entityNameInput.value = "";
    dom.entityDescriptionInput.value = "";

    if (type === "add-lane") {
      dom.entityEyebrow.textContent = "LANE";
      dom.entityDialogTitle.textContent = "新增条线";
      dom.entityNameLabel.textContent = "条线名称";
    } else if (type === "add-thread") {
      const lane = getLane(id);
      dom.entityEyebrow.textContent = lane?.name || "THREAD";
      dom.entityDialogTitle.textContent = "新增线程";
      dom.entityNameLabel.textContent = "线程名称";
    } else if (type === "edit-lane") {
      const lane = getLane(id);
      dom.entityEyebrow.textContent = "LANE";
      dom.entityDialogTitle.textContent = "编辑条线";
      dom.entityNameLabel.textContent = "条线名称";
      dom.entityNameInput.value = lane?.name || "";
      dom.entityDescriptionInput.value = lane?.description || "";
    } else if (type === "edit-thread") {
      const thread = getThread(id);
      dom.entityEyebrow.textContent = getLane(thread?.laneId)?.name || "THREAD";
      dom.entityDialogTitle.textContent = "编辑线程";
      dom.entityNameLabel.textContent = "线程名称";
      dom.entityNameInput.value = thread?.name || "";
      dom.entityDescriptionInput.value = thread?.description || "";
    }

    dom.entityDialog.showModal();
    requestAnimationFrame(() => dom.entityNameInput.focus());
  }

  function saveEntityDialog(event) {
    event.preventDefault();
    const type = dom.entityType.value;
    const id = dom.entityParentId.value;
    const name = dom.entityNameInput.value.trim();
    const description = dom.entityDescriptionInput.value.trim();
    if (!name) return;

    if (type === "add-lane") {
      state.lanes.push({ id: uid("lane"), name, description });
    } else if (type === "add-thread") {
      state.threads.push({ id: uid("thread"), laneId: id, name, description });
      collapsedLaneIds.delete(id);
      saveTreeViewState();
    } else if (type === "edit-lane") {
      const lane = getLane(id);
      if (lane) Object.assign(lane, { name, description });
    } else if (type === "edit-thread") {
      const thread = getThread(id);
      if (thread) Object.assign(thread, { name, description });
    }

    dom.entityDialog.close();
    saveState();
    renderAll();
  }

  function addEvent(threadId) {
    const event = newEvent(threadId, nextEventCode());
    state.events.push(event);
    selectedEventId = event.id;
    expandEventPath(event.id);
    saveState();
    renderAll();
    requestAnimationFrame(() => dom.eventEditor.querySelector('[data-field="name"]')?.focus());
  }

  function deleteLane(laneId) {
    const lane = getLane(laneId);
    if (!lane) return;
    const threadIds = state.threads.filter((thread) => thread.laneId === laneId).map((thread) => thread.id);
    const eventIds = state.events.filter((event) => threadIds.includes(event.threadId)).map((event) => event.id);
    const message = eventIds.length
      ? `删除“${lane.name}”会同时删除其 ${threadIds.length} 个线程和 ${eventIds.length} 个事件。是否继续？`
      : `确认删除条线“${lane.name}”？`;
    if (!window.confirm(message)) return;
    state.events = state.events.filter((event) => !eventIds.includes(event.id));
    state.threads = state.threads.filter((thread) => !threadIds.includes(thread.id));
    state.lanes = state.lanes.filter((item) => item.id !== laneId);
    collapsedLaneIds.delete(laneId);
    threadIds.forEach((threadId) => collapsedThreadIds.delete(threadId));
    saveTreeViewState();
    removeDependencyReferences(eventIds);
    saveState();
    renderAll();
  }

  function deleteThread(threadId) {
    const thread = getThread(threadId);
    if (!thread) return;
    const eventIds = state.events.filter((event) => event.threadId === threadId).map((event) => event.id);
    const message = eventIds.length
      ? `删除“${thread.name}”会同时删除其 ${eventIds.length} 个事件。是否继续？`
      : `确认删除线程“${thread.name}”？`;
    if (!window.confirm(message)) return;
    state.events = state.events.filter((event) => !eventIds.includes(event.id));
    state.threads = state.threads.filter((item) => item.id !== threadId);
    collapsedThreadIds.delete(threadId);
    saveTreeViewState();
    removeDependencyReferences(eventIds);
    saveState();
    renderAll();
  }

  function removeDependencyReferences(eventIds) {
    state.events.forEach((event) => {
      event.dependencies = event.dependencies.filter(
        (dependency) => !eventIds.includes(dependency.predecessorEventId),
      );
    });
    if (eventIds.includes(selectedEventId)) selectedEventId = null;
  }

  function deleteSelectedEvent() {
    const event = getSelectedEvent();
    if (!event || !window.confirm(`确认删除事件“${event.name}”？其他事件对它的前置关系也会被移除。`)) return;
    state.events = state.events.filter((item) => item.id !== event.id);
    removeDependencyReferences([event.id]);
    saveState();
    renderAll();
  }

  function duplicateSelectedEvent() {
    const event = getSelectedEvent();
    if (!event) return;
    const copy = normalizeState({ events: [{ ...event }] }).events[0];
    copy.id = uid("evt");
    copy.code = nextEventCode();
    copy.name = `${event.name}（副本）`;
    copy.dependencies = event.dependencies.map((dependency) => ({ ...dependency, id: uid("dep") }));
    state.events.push(copy);
    selectedEventId = copy.id;
    expandEventPath(copy.id);
    saveState();
    renderAll();
    showToast("事件副本已创建");
  }

  function addDependency() {
    const event = getSelectedEvent();
    if (!event) return;
    const predecessor = state.events.find((candidate) => candidate.id !== event.id);
    if (!predecessor) {
      showToast("请先创建至少另一个事件");
      return;
    }
    event.dependencies.push(newDependency(predecessor.id));
    saveState();
    renderDependencies(event);
    renderInspector();
  }

  function handleDependencyClick(event) {
    const target = event.target.closest('[data-action="remove-dependency"]');
    if (!target) return;
    const selected = getSelectedEvent();
    if (!selected) return;
    selected.dependencies = selected.dependencies.filter((dependency) => dependency.id !== target.dataset.id);
    saveState();
    renderDependencies(selected);
    renderInspector();
  }

  function handleDependencyInput(event) {
    const input = event.target.closest("[data-dep-field]");
    if (!input) return;
    const row = input.closest("[data-dependency-id]");
    const selected = getSelectedEvent();
    const dependency = selected?.dependencies.find((item) => item.id === row?.dataset.dependencyId);
    if (!dependency) return;
    dependency[input.dataset.depField] = input.type === "number" ? (input.value===''&&['targetLag','maxLag'].includes(input.dataset.depField)?null:numberOrBlank(input.value)) : input.value;
    saveState();
    renderInspector();
  }

  function handleEditorInput(event) {
    const input = event.target.closest("[data-field]");
    if (!input || input.closest(".dependency-row")) return;
    const selected = getSelectedEvent();
    if (!selected) return;
    const value = input.type === "number" ? numberOrBlank(input.value) : input.value;
    setPath(selected, input.dataset.field, value);
    saveState();
    updateEditorHeading(selected);
    renderTree();
    renderInspector();
  }

  function handleEditorChange(event) {
    const input = event.target.closest("[data-field]");
    if (!input || input.closest(".dependency-row")) return;
    const selected = getSelectedEvent();
    if (!selected) return;
    setPath(selected, input.dataset.field, input.type === "number" ? numberOrBlank(input.value) : input.value);

    saveState();

    if (input.dataset.field === "threadId") {
      expandEventPath(selected.id);
      renderEditor();
      renderTree();
    } else {
      renderTree();
    }
    renderInspector();
  }

  function openProjectDialog() {
    dom.projectNameInput.value = state.project.name || "";
    dom.projectDescriptionInput.value = state.project.description || "";
    dom.projectTimezoneInput.value = state.project.timezone;
    dom.projectCalendarInput.value = state.project.defaultCalendar;
    dom.projectCustomCalendarInput.value = state.project.customCalendarName || "";
    dom.projectDialog.showModal();
  }

  function saveProjectDialog(event) {
    event.preventDefault();
    state.project = {
      ...state.project,
      name: dom.projectNameInput.value.trim() || "未命名港股 IPO 项目",
      description: dom.projectDescriptionInput.value.trim(),
      timezone: dom.projectTimezoneInput.value,
      defaultCalendar: dom.projectCalendarInput.value,
      customCalendarName: dom.projectCustomCalendarInput.value.trim(),
    };
    dom.projectDialog.close();
    saveState();
    renderAll();
  }

  async function importJson(fileEvent) {
    const file = fileEvent.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed.project || !Array.isArray(parsed.lanes) || !Array.isArray(parsed.threads) || !Array.isArray(parsed.events)) {
        throw new Error("文件缺少项目、条线、线程或事件数组。" );
      }
      if (state.events.length && !window.confirm("导入会替换当前本机数据。是否继续？")) return;
      state = normalizeState(parsed);
      selectedEventId = state.events[0]?.id || null;
      collapsedLaneIds.clear();
      collapsedThreadIds.clear();
      saveTreeViewState();
      saveState();
      renderAll();
      showToast("JSON 已导入");
    } catch (error) {
      window.alert(`导入失败：${error.message}`);
    } finally {
      fileEvent.target.value = "";
    }
  }

  function exportJson() {
    const payload = {
      ...state,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sanitizeFilename(state.project.name || "IPO排程规则")}_事件信息.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("JSON 已导出");
  }

  function resetData() {
    if (!window.confirm("确认清空全部本机采集数据？请先导出 JSON 备份。")) return;
    state = newState();
    selectedEventId = null;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TREE_VIEW_STORAGE_KEY);
    collapsedLaneIds.clear();
    collapsedThreadIds.clear();
    renderAll();
    dom.saveState.textContent = "仅保存在本机";
    showToast("本机数据已清空");
  }

  function handleIssueClick(event) {
    const item = event.target.closest("[data-event-id]");
    if (!item) return;
    selectedEventId = item.dataset.eventId;
    expandEventPath(selectedEventId);
    renderAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function getSelectedEvent() {
    return state.events.find((event) => event.id === selectedEventId) || null;
  }

  function getEvent(id) {
    return state.events.find((event) => event.id === id) || null;
  }

  function getThread(id) {
    return state.threads.find((thread) => thread.id === id) || null;
  }

  function getLane(id) {
    return state.lanes.find((lane) => lane.id === id) || null;
  }

  function getPath(object, path) {
    return path.split(".").reduce((value, key) => value?.[key], object);
  }

  function setPath(object, path, value) {
    const keys = path.split(".");
    const last = keys.pop();
    const parent = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== "object") current[key] = {};
      return current[key];
    }, object);
    parent[last] = value;
  }

  function numberOrBlank(value) {
    return value === "" ? "" : Number(value);
  }

  function sanitizeFilename(name) {
    return name.replace(/[\\/:*?"<>|\s]+/g, "_").replace(/^_+|_+$/g, "") || "IPO排程规则";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showToast(message) {
    dom.toast.textContent = message;
    dom.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dom.toast.classList.remove("show"), 2200);
  }

  document.addEventListener("DOMContentLoaded", () => {
    cacheDom();
    bindEvents();
    renderAll();
  });
})();
