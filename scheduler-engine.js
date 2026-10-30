/* IPO scheduler, offline and dependency-free. Shared by Web Worker and Node tests. */
(function engineFactory(root) {
  'use strict';
  const VERSION = '0.2.0';
  const DAY = 86400000;
  function parseDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('日期须为 YYYY-MM-DD');
    const d = Date.parse(s + 'T00:00:00Z');
    if (!Number.isFinite(d) || new Date(d).toISOString().slice(0, 10) !== s) throw new Error('无效日期：' + s);
    return d / DAY;
  }
  const iso = d => new Date(d * DAY).toISOString().slice(0, 10);
  const weekday = d => ((d + 3) % 7 + 7) % 7; // Monday=0
  const week = d => d - weekday(d);
  const lower = (a, x) => { let l = 0, h = a.length; while (l < h) { const m = (l + h) >> 1; if (a[m] < x) l = m + 1; else h = m; } return l; };
  const compare = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
  function validateTemplate(t) {
    const errors = [];
    if (!t || !t.project || !Array.isArray(t.events) || !Array.isArray(t.threads) || !Array.isArray(t.lanes)) return ['文件缺少项目、条线、线程或事件数组'];
    if (!t.events.length) errors.push('事件库为空');
    const ids = new Set(), codes = new Set(), deps = new Set();
    const lanes = new Set(t.lanes.map(l => l.id)), threads = new Set(t.threads.map(x => x.id));
    if (lanes.size !== t.lanes.length || threads.size !== t.threads.length) errors.push('条线或线程ID重复');
    t.threads.forEach(x => { if (!lanes.has(x.laneId)) errors.push('线程归属无效：' + x.name); });
    for (const e of t.events) {
      if (!e.id || ids.has(e.id)) errors.push('事件ID缺失或重复'); ids.add(e.id);
      if (!e.code || codes.has(e.code)) errors.push('事件编码缺失或重复：' + e.code); codes.add(e.code);
      if (!threads.has(e.threadId) || !e.name) errors.push('事件名称或归属无效：' + e.code);
      if (!['calculated', 'anchor_input'].includes(e.dateMode) || !Array.isArray(e.dependencies)) errors.push('事件日期方式或前置格式无效：' + e.code);
    }
    const adjacency = new Map(t.events.map(e => [e.id, []]));
    for (const e of t.events) for (const d of (e.dependencies || [])) {
      if (!d.id || deps.has(d.id)) errors.push('关系ID缺失或重复：' + e.code); deps.add(d.id);
      if (!ids.has(d.predecessorEventId) || d.predecessorEventId === e.id) errors.push('前置引用无效：' + e.code);
      const lagOK=v=>Number.isInteger(v)&&v>=0&&v<=3650;
      if (!lagOK(d.minLag) || (d.targetLag!=null&&!lagOK(d.targetLag)) || (d.maxLag!=null&&!lagOK(d.maxLag)) || (d.targetLag!=null&&d.targetLag<d.minLag) || (d.maxLag!=null&&(d.maxLag<d.minLag || d.targetLag!=null&&d.targetLag>d.maxLag))) errors.push('最短须为非负整数；目标、最长可留空，填写时须满足最短≤目标≤最长：' + e.code);
      if (!['calendar_day','business_day','calendar_month'].includes(d.unit) || !['hard','soft'].includes(d.strength)) errors.push('关系单位或强度无效：' + e.code);
      if(d.targetWeight!=null&&(!Number.isInteger(d.targetWeight)||d.targetWeight<1||d.targetWeight>100))errors.push('目标权重须为1至100的整数：'+e.code);
      if (!['inherit','natural','hk','cn','us','project'].includes(d.calendar)) errors.push('日历标识无效：' + e.code);
      if (d.strength === 'hard' && adjacency.has(d.predecessorEventId)) adjacency.get(d.predecessorEventId).push(e.id);
    }
    const active = new Set(), done = new Set();
    function visit(id) { if (active.has(id)) { errors.push('硬前置关系成环：' + (t.events.find(e => e.id === id)?.code || id)); return; } if (done.has(id)) return; active.add(id); for (const next of adjacency.get(id) || []) visit(next); active.delete(id); done.add(id); }
    for (const id of ids) visit(id);
    return [...new Set(errors)];
  }
  function createCalendars(config = {}) {
    const cache = new Map();
    function get(name) {
      if (cache.has(name)) return cache.get(name);
      const c = config[name] || {};
      const holidays = new Set((c.holidays || []).map(parseDate));
      const working = new Set((c.workingDays || []).map(parseDate));
      const cal = { isWorking: d => name === 'natural' || working.has(d) || (weekday(d) < 5 && !holidays.has(d)), version: c.version || '仅周末（未核验公众假期）', from: c.from ? parseDate(c.from) : null, to: c.to ? parseDate(c.to) : null, estimatedFrom:c.estimatedFrom?parseDate(c.estimatedFrom):null, estimatedTo:c.estimatedTo?parseDate(c.estimatedTo):null };
      cache.set(name, cal); return cal;
    }
    const memo = new Map();
    function add(d, n, unit, name) {
      if(unit==='calendar_month'){
        const date=new Date(d*DAY),originalDay=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+n);
        const last=new Date(date);last.setUTCMonth(last.getUTCMonth()+1,0);date.setUTCDate(Math.min(originalDay,last.getUTCDate()));return date.getTime()/DAY;
      }
      if (unit === 'calendar_day' || n === 0 || name === 'natural') return d + n;
      const key = `${name}:${d}:${n}`; if (memo.has(key)) return memo.get(key);
      const cal = get(name); let result = d, left = n;
      while (left) { result++; if (cal.isWorking(result)) left--; if (result - d > 20000) throw new Error('日历有效工作日不足'); }
      memo.set(key, result); return result;
    }
    return {get, add};
  }
  function compile(template, settings = {}) {
    const errors = validateTemplate(template); if (errors.length) throw new Error(errors.join('\n'));
    const events = template.events, index = new Map(events.map((e, i) => [e.id,i]));
    if (settings.releaseAnchorId && (!index.has(settings.releaseAnchorId) || events[index.get(settings.releaseAnchorId)].dateMode!=='anchor_input')) throw new Error('指定的A1锚点不是有效锚点事件');
    for(const key of ['anchorDates','locks'])for(const [id,date] of Object.entries(settings[key]||{}))if(date&&!index.has(id))throw new Error('固定日期引用了不存在的事件：'+id);
    const calendars = createCalendars(settings.calendars);
    const fixed = new Map(), warnings = [];
    const a1Id=settings.releaseAnchorId||settings.a1Id;
    if(settings.a1BusinessDaysOnly && (!a1Id||!index.has(a1Id)))throw new Error('已启用A1仅安排工作日，请先指定A1锚点');
    for (const e of events) {
      const anchor = settings.anchorDates?.[e.id], lock = settings.locks?.[e.id];
      if (anchor && e.id !== settings.releaseAnchorId) fixed.set(index.get(e.id), parseDate(anchor));
      if (lock) { const d = parseDate(lock); if (fixed.has(index.get(e.id)) && fixed.get(index.get(e.id)) !== d) throw new Error(e.code + '：锁定日与锚点日期不同'); fixed.set(index.get(e.id),d); }
    }
    if (!fixed.size) throw new Error('至少填写一个锚点日期，才能定位排程');
    const seed = [...fixed.values()];
    const start = settings.horizonStart ? parseDate(settings.horizonStart) : Math.min(...seed) - 180;
    const end = settings.horizonEnd ? parseDate(settings.horizonEnd) : Math.max(...seed) + 365;
    if (end < start || end - start > 1800) throw new Error('搜索范围须为0–1800个自然日；可在设置中缩小范围');
    for (const [i,d] of fixed) if (d < start || d > end) throw new Error(events[i].code + '的固定日期在搜索范围外');
    const edges = [];
    for (const e of events) for (const dep of e.dependencies) {
      const calendar = dep.calendar === 'inherit' ? template.project.defaultCalendar || 'hk' : dep.calendar;
      edges.push({ ...dep, a: index.get(dep.predecessorEventId), b: index.get(e.id), calendar });
    }
    const hard = edges.filter(e => e.strength === 'hard'), soft = edges.filter(e => e.strength === 'soft');
    const relevant = new Set(edges.filter(e => e.unit === 'business_day').map(e => e.calendar));
    relevant.add(template.project.defaultCalendar || 'hk');
    for (const name of relevant) {
      if (name === 'natural') continue;
      const c = calendars.get(name);
      if (c.from === null || c.to === null || c.from > start || c.to < end) warnings.push(`${name}日历未覆盖全部搜索范围，本方案含未核验假期的日期；仅供试排。`);
      if(c.estimatedFrom!==null && c.estimatedTo!==null && start<=c.estimatedTo && end>=c.estimatedFrom)warnings.push(`${name}日历的${iso(c.estimatedFrom)}至${iso(c.estimatedTo)}为暂定估算（含可能的调休），搜索范围涉及该区间；正式公布后需更新重排。`);
    }
    const neighbors = events.map(() => []); for (const e of hard) { neighbors[e.a].push(e.b); neighbors[e.b].push(e.a); }
    const connected = new Set(fixed.keys()), queue = [...connected];
    for (let k = 0; k < queue.length; k++) for (const v of neighbors[queue[k]]) if (!connected.has(v)) { connected.add(v); queue.push(v); }
    const unpositioned = events.map((e,i) => !connected.has(i) ? e.code : null).filter(Boolean);
    if (unpositioned.length) throw new Error('以下事件没有通过硬关系连接到已填写日期的锚点，请补日期或关系：' + unpositioned.join('、'));
    const prohibited = new Set((settings.blockedDates || []).map(parseDate));
    const allDates = Array.from({length:end-start+1}, (_,i)=>start+i).filter(d=>!prohibited.has(d));
    const projectCalendar=calendars.get(template.project.defaultCalendar||'hk');
    for(const [i,d] of fixed){
      if(settings.a1BusinessDaysOnly && events[i].id===a1Id && !projectCalendar.isWorking(d))throw new Error('A1固定日期不符合本方案的工作日限制。请调整A1日期，或明确取消“A1仅安排在项目工作日”。');
      if(events[i].dateMode==='anchor_input'&&!projectCalendar.isWorking(d))warnings.push(events[i].name+'落在项目日历非工作日，已按输入保留，请确认。');
    }
    const domains = events.map((e,i) => (fixed.has(i) ? (prohibited.has(fixed.get(i)) ? [] : [fixed.get(i)]) : allDates.slice()).filter(d=>!settings.a1BusinessDaysOnly || e.id!==a1Id || projectCalendar.isWorking(d)));
    return {events,index,calendars,fixed,edges,hard,soft,domains,start,end,warnings,settings,template};
  }
  function bounds(c,e,day) { return [c.calendars.add(day,e.minLag,e.unit,e.calendar),e.maxLag==null?Infinity:c.calendars.add(day,e.maxLag,e.unit,e.calendar)]; }
  function propagate(c, input, deadline) {
    const ds = input.map(d => d.slice());
    const causes = c.events.map((_,i) => new Set(c.fixed.has(i) ? ['date:' + c.events[i].id] : []));
    let dirty = true;
    while (dirty) {
      dirty = false;
      for (const e of c.hard) {
        if (Date.now() > deadline) return {timedOut:true};
        const aa = ds[e.a], bb = ds[e.b];
        const a2 = aa.filter(a => { const [l,u] = bounds(c,e,a), j = lower(bb,l); return j < bb.length && bb[j] <= u; });
        if (a2.length !== aa.length) { ds[e.a]=a2; dirty=true; causes[e.a].add(e.id); for (const x of causes[e.b]) causes[e.a].add(x); }
        if (!a2.length) return {conflict:{eventId:c.events[e.a].id, ruleIds:[...causes[e.a]], message:'该事件没有同时满足所有硬条件的候选日期。'}};
        let p = 0;
        const b2 = bb.filter(b => {
          while (p < a2.length && bounds(c,e,a2[p])[1] < b) p++;
          return p < a2.length && bounds(c,e,a2[p])[0] <= b;
        });
        if (b2.length !== bb.length) { ds[e.b]=b2; dirty=true; causes[e.b].add(e.id); for (const x of causes[e.a]) causes[e.b].add(x); }
        if (!b2.length) return {conflict:{eventId:c.events[e.b].id, ruleIds:[...causes[e.b]], message:'该事件没有同时满足所有硬条件的候选日期。'}};
      }
    }
    if (ds.some(d => !d.length)) return {conflict:{message:'固定日期落在禁止日期内，或搜索范围没有有效候选日。',ruleIds:[]}};
    return {domains:ds};
  }
  // Independent numerical validator (does not trust propagation/optimizer state).
  function verify(template, settings, dates) {
    const problems = [], calendars = createCalendars(settings.calendars);
    for (const e of template.events) {
      let b; try { b = parseDate(dates[e.id]); } catch (_) { problems.push(e.code + '缺少有效日期'); continue; }
      const fixed = settings.anchorDates?.[e.id];
      if(settings.a1BusinessDaysOnly && e.id===(settings.releaseAnchorId||settings.a1Id) && !calendars.get(template.project.defaultCalendar||'hk').isWorking(b))problems.push(e.code+'违反本方案的A1工作日限制');
      if (fixed && e.id !== settings.releaseAnchorId && dates[e.id] !== fixed) problems.push(e.code+'改变了锚点');
      if (settings.locks?.[e.id] && settings.locks[e.id] !== dates[e.id]) problems.push(e.code+'改变了锁定日期');
      if ((settings.blockedDates || []).includes(dates[e.id])) problems.push(e.code+'落在禁止日期');
      if (settings.horizonStart && b < parseDate(settings.horizonStart) || settings.horizonEnd && b > parseDate(settings.horizonEnd)) problems.push(e.code+'超出搜索范围');
      for (const d of e.dependencies.filter(x => x.strength === 'hard')) {
        let a; try { a = parseDate(dates[d.predecessorEventId]); } catch (_) { continue; }
        const name = d.calendar === 'inherit' ? template.project.defaultCalendar || 'hk' : d.calendar;
        const offset=n=>{if(n==null)return Infinity;if(d.unit==='calendar_month'){const value=new Date(a*DAY),original=value.getUTCDate();value.setUTCMonth(value.getUTCMonth()+n);if(value.getUTCDate()!==original)value.setUTCDate(0);return value.getTime()/DAY;}if(d.unit==='calendar_day'||name==='natural')return a+n;let day=a,count=0;while(count<n){day++;if(calendars.get(name).isWorking(day))count++;if(day-a>20000)throw new Error('日历有效工作日不足');}return day;};
        const l=offset(d.minLag),u=offset(d.maxLag);
        if (b < l || b > u) problems.push(`${e.code}违反关系 ${d.id}：允许${iso(l)}至${Number.isFinite(u)?iso(u):'不限'}，实际${iso(b)}`);
      }
    }
    return problems;
  }
  function groups(c) {
    const parent=c.events.map((_,i)=>i); const find=i=>parent[i]===i?i:parent[i]=find(parent[i]);
    for (const e of c.hard) if (e.minLag===0 && e.maxLag===0) parent[find(e.a)]=find(e.b);
    const m=new Map(); c.events.forEach((_,i)=>{const r=find(i);if(!m.has(r))m.set(r,[]);m.get(r).push(i);});return [...m.values()];
  }
  function score(c, dates, previous) {
    let soft=0,target=0,collision=0,moved=0,shift=0,weekends=0;
    const bins=new Map(), same=groups(c), equality=new Map();same.forEach((g,i)=>g.forEach(v=>equality.set(v,i)));
    for (const e of c.edges) {
      const [l,u]=bounds(c,e,dates[e.a]), b=dates[e.b];
      if(e.strength==='soft') soft+=Math.max(0,l-b,b-u);
      if(e.targetLag!=null)target+=(e.targetWeight||1)*Math.abs(b-c.calendars.add(dates[e.a],e.targetLag,e.unit,e.calendar));
    }
    c.events.forEach((e,i)=>{
      const prev=previous?.[e.id];if(prev && parseDate(prev)!==dates[i]){moved++;shift+=Math.abs(parseDate(prev)-dates[i]);}
      if(!c.calendars.get(c.template.project.defaultCalendar||'hk').isWorking(dates[i]))weekends++;
      if(e.dateMode==='anchor_input')return;
      const key=e.threadId+':'+week(dates[i]);if(!bins.has(key))bins.set(key,[]);bins.get(key).push(i);
    });
    if(c.settings.spreadWeeks!==false) for(const bin of bins.values())for(let i=0;i<bin.length;i++)for(let j=i+1;j<bin.length;j++)if(equality.get(bin[i])!==equality.get(bin[j]))collision++;
    const released=c.settings.releaseAnchorId ? dates[c.index.get(c.settings.releaseAnchorId)] : 0;
    const workdayPenalty=c.settings.preferWorkingDays===false?0:weekends;
    // A bounded cost for a same-week pair, not unlimited priority over business timing.
    // Stability is a cost, never a blanket exemption from optimization. Locked dates
    // remain hard constraints in compile/verify.
    const stability=c.settings.keepPrevious!==false&&previous ? moved+shift/20 : 0;
    return [released,workdayPenalty,soft,c.settings._searchStyle==='spread'?collision:collision*14+target+stability,c.settings._searchStyle==='spread'?target:collision,target,moved,shift];
  }
  function solveSingle(template, settings={}, progress=()=>{}) {
    const started=Date.now(), budget=Math.max(500,Math.min(settings.timeBudgetMs||5000,30000)), finishDeadline=started+budget, deadline=started+Math.floor(budget*.9);
    let c; try { c=compile(template,settings); } catch(e) { return {status:'invalid',errors:e.message.split('\n')}; }
    progress({stage:'正在双向检查全部硬条件'});
    const initial=propagate(c,c.domains,deadline);
    if(initial.timedOut)return {status:'unknown',errors:['检查超时，尚未判断是否可行。请提高时间预算或缩小搜索范围。']};
    if(initial.conflict){
      // Reduce the explanation by removing unnecessary relations, within a bounded budget.
      const explainDeadline=Math.min(deadline,Date.now()+800);
      let core=c.hard.slice(),diagnostic=initial.conflict;
      const mentioned=new Set(initial.conflict.ruleIds);
      const subset=core.filter(e=>mentioned.has(e.id));
      if(subset.length){const check=propagate({...c,hard:subset},c.domains,explainDeadline);if(check.conflict){core=subset;diagnostic=check.conflict;}}
      for(const edge of core.slice()){
        if(Date.now()>explainDeadline)break;
        const reduced=core.filter(e=>e.id!==edge.id),check=propagate({...c,hard:reduced},c.domains,explainDeadline);
        if(check.conflict){core=reduced;diagnostic=check.conflict;}
      }
      return {status:'infeasible',conflict:diagnostic,errors:['在当前搜索范围、日历和固定日期下无可行方案。'],horizon:{start:iso(c.start),end:iso(c.end)}};
    }
    const dateMap=a=>Object.fromEntries(c.events.map((e,i)=>[e.id,iso(a[i])]));
    let best=initial.domains.map(d=>d[0]);
    const basicErrors=verify(template,settings,dateMap(best));
    if(basicErrors.length)return {status:'unknown',errors:['推导边界未形成完整可行解，未输出日期。',...basicErrors]};
    // With monotone endpoint functions, the least arc-consistent vector is a feasible solution.
    // Verification above is mandatory; no unchecked inference is presented to users.
    const minimumReleased = settings.releaseAnchorId ? best[c.index.get(settings.releaseAnchorId)] : null;
    const priorFeasible=settings.previousDates && !verify(template,settings,settings.previousDates).length && c.events.every((e,i)=>initial.domains[i].includes(parseDate(settings.previousDates[e.id])));
    const keepExactPrior=priorFeasible && settings.replanMode==='repair_only' && !settings.releaseAnchorId;
    let bestScore=score(c,best,settings.previousDates), candidates=1, coordinatedMoves=0;
    if(priorFeasible){
      const prior=c.events.map(e=>parseDate(settings.previousDates[e.id])),s=score(c,prior,settings.previousDates);
      if(keepExactPrior||compare(s,bestScore)<0){best=prior;bestScore=s;}
    }
    const gs=groups(c), hardDomains=initial.domains;
    let domains=hardDomains,searchDomains=hardDomains;
    // Working dates are a preference, not a new hard rule: retain the unrestricted
    // feasible solution if this domain fails. Fixed anchors/locks are never moved.
    if(settings.preferWorkingDays!==false && !keepExactPrior){
      const cal=c.calendars.get(template.project.defaultCalendar||'hk');
      const input=domains.map((ds,i)=>c.fixed.has(i)?ds:ds.filter(d=>cal.isWorking(d)));
      if(settings.releaseAnchorId)input[c.index.get(settings.releaseAnchorId)]=[minimumReleased];
      const working=propagate(c,input,deadline);
      if(working.domains){domains=searchDomains=working.domains;const trial=searchDomains.map(ds=>ds[0]),s=score(c,trial,settings.previousDates);if(compare(s,bestScore)<0&&!verify(template,settings,dateMap(trial)).length){best=trial;bestScore=s;candidates++;}}
    }
    progress({stage:'已找到可行方案，正在优化错周和目标间隔'});
    // Greedy domain fixing creates several globally feasible starting solutions.
    for(let pass=0;pass<3 && !keepExactPrior && Date.now()<deadline;pass++) {
      let live=searchDomains.map(d=>d.slice()), current=best.slice();
      const order=gs.slice().sort((a,b)=>pass===1?domains[a[0]].length-domains[b[0]].length:a[0]-b[0]);
      for(const g of order) {
        if(Date.now()>deadline)break;
        if(g.some(i=>c.fixed.has(i)))continue;
        const i=g[0], prefs=[];
        for(const e of c.edges)if(e.b===i&&e.targetLag!=null)prefs.push(c.calendars.add(current[e.a],e.targetLag,e.unit,e.calendar));
        if(settings.previousDates?.[c.events[i].id] && settings.keepPrevious!==false)prefs.unshift(parseDate(settings.previousDates[c.events[i].id]));
        let wanted=prefs.length?Math.max(...prefs):current[i];
        if(pass===2)wanted+=7;
        const options=live[i].slice().sort((a,b)=>Math.abs(a-wanted)-Math.abs(b-wanted)).slice(0,4);
        for(const v of options){
          const input=live.map(d=>d.slice());g.forEach(j=>input[j]=[v]);const next=propagate(c,input,deadline);
          if(next.domains){live=next.domains;current=live.map(d=>d[0]);break;}
          if(next.timedOut)break;
        }
      }
      if(!verify(template,settings,dateMap(current)).length){const s=score(c,current,settings.previousDates);candidates++;if(compare(s,bestScore)<0){best=current;bestScore=s;}}
    }
    // Coordinate descent moves equality groups together; every move checks all touching hard edges.
    for(let pass=0;pass<8 && !keepExactPrior && Date.now()<deadline;pass++) {
      let improved=false;
      for(const g of gs){
        if(Date.now()>deadline)break;
        if(g.some(i=>c.fixed.has(i)))continue;
        const members=new Set(g), touching=c.hard.filter(e=>members.has(e.a)||members.has(e.b));
        const options=new Set([best[g[0]],domains[g[0]][0],domains[g[0]].at(-1)]);
        for(let d=-21;d<=21;d++)options.add(best[g[0]]+d);
        for(const i of g)for(const e of c.edges)if(e.b===i&&e.targetLag!=null)options.add(c.calendars.add(best[e.a],e.targetLag,e.unit,e.calendar));
        let chosen=best,chosenScore=bestScore;
        for(const v of options){
          if(Date.now()>deadline)break;
          if(g.some(i=>!domains[i].includes(v)))continue;
          const trial=best.slice();g.forEach(i=>trial[i]=v);
          if(touching.some(e=>{const [l,u]=bounds(c,e,trial[e.a]);return trial[e.b]<l||trial[e.b]>u;}))continue;
          const s=score(c,trial,settings.previousDates);if(compare(s,chosenScore)<0){chosen=trial;chosenScore=s;}
        }
        if(chosen!==best){best=chosen;bestScore=chosenScore;improved=true;}
      }
      if(!improved)break;
    }
    const beforeCoordinated=bestScore.slice();
    const groupOf=new Map();gs.forEach(g=>g.forEach(i=>groupOf.set(i,g)));
    function collisionPairs(days){
      const pairs=[];
      for(let i=0;i<c.events.length;i++)for(let j=i+1;j<c.events.length;j++)if(c.events[i].dateMode!=='anchor_input'&&c.events[j].dateMode!=='anchor_input'&&c.events[i].threadId===c.events[j].threadId&&groupOf.get(i)!==groupOf.get(j)&&week(days[i])===week(days[j]))pairs.push({i,j,key:i+':'+j});
      return pairs;
    }
    // Single-event moves can get stuck at a neighbor's hard bound. Move the necessary
    // chain together: for a later move, keep every date >= its current date and take
    // the least propagated vector; for an earlier move, use <= and the greatest vector.
    // This avoids introducing fictitious business edges solely to separate weeks.
    for(let pass=0;pass<4 && !keepExactPrior && Date.now()<deadline;pass++){
      let improved=false;
      const crowded=new Set();
      for(let i=0;i<c.events.length;i++)for(let j=i+1;j<c.events.length;j++){
        if(c.events[i].dateMode!=='anchor_input' && c.events[j].dateMode!=='anchor_input' && c.events[i].threadId===c.events[j].threadId && week(best[i])===week(best[j])){crowded.add(i);crowded.add(j);}
      }
      const ordered=gs.slice().sort((a,b)=>Number(b.some(i=>crowded.has(i)))-Number(a.some(i=>crowded.has(i))));
      for(const g of ordered){
        if(Date.now()>deadline)break;
        if(g.some(i=>c.fixed.has(i)))continue;
        const i=g[0],day=best[i],w=week(day),options=new Set();
        if(g.some(j=>crowded.has(j)))for(const v of [w+7,w-3,day+7,day-7,w+14,w-7])options.add(v);
        for(const e of c.edges)if(g.includes(e.b)&&e.targetLag!=null)options.add(c.calendars.add(best[e.a],e.targetLag,e.unit,e.calendar));
        for(const v of options){
          if(Date.now()>deadline)break;
          if(v===best[i]||g.some(j=>!domains[j].includes(v)))continue;
          const later=v>best[i],input=searchDomains.map((ds,j)=>ds.filter(d=>later?d>=best[j]:d<=best[j]));
          g.forEach(j=>input[j]=[v]);
          let moved=propagate(c,input,deadline);if(!moved.domains)continue;
          let trial=moved.domains.map(ds=>later?ds[0]:ds.at(-1));
          // A move can simply transfer a collision to the next thread. Follow newly
          // created collisions for a bounded number of steps before judging the move.
          // These are candidate choices only, never new persistent hard dependencies.
          if(settings.spreadWeeks!==false && g.some(j=>crowded.has(j))){
            const oldPairs=new Set(collisionPairs(best).map(x=>x.key));
            for(let step=0;step<12 && Date.now()<deadline;step++){
              let advanced=false;
              for(const pair of collisionPairs(trial).filter(x=>!oldPairs.has(x.key))){
                const ordered=[pair.i,pair.j].sort((a,b)=>trial[a]-trial[b]||a-b);
                const chosen=later?ordered[1]:ordered[0],linked=groupOf.get(chosen);
                if(linked.some(j=>c.fixed.has(j)))continue;
                const boundary=later?week(trial[chosen])+7:week(trial[chosen])-1;
                const attempt=moved.domains.map((ds,j)=>ds.filter(d=>later?d>=trial[j]:d<=trial[j]));
                linked.forEach(j=>attempt[j]=attempt[j].filter(d=>later?d>=boundary:d<=boundary));
                if(attempt.some(ds=>!ds.length))continue;
                const repair=propagate(c,attempt,deadline);
                if(repair.domains){moved=repair;trial=moved.domains.map(ds=>later?ds[0]:ds.at(-1));advanced=true;break;}
              }
              if(!advanced)break;
            }
          }
          const s=score(c,trial,settings.previousDates);
          if(compare(s,bestScore)<0 && !verify(template,settings,dateMap(trial)).length){best=trial;bestScore=s;improved=true;coordinatedMoves++;candidates++;}
        }
      }
      if(!improved)break;
    }
    // Mixed-direction repair: fix one candidate date and let both upstream and
    // downstream groups move. Unlike the monotone projection above, other dates
    // need not all move in the same direction. No candidate choices become rules.
    let jointMoves=0;
    function repair(input, wanted){
      let state=propagate(c,input,deadline);if(!state.domains)return null;
      const order=gs.slice().sort((a,b)=>state.domains[a[0]].length-state.domains[b[0]].length||a[0]-b[0]);
      for(const g of order){
        if(Date.now()>deadline)return null;
        const i=g[0];if(state.domains[i].length===1)continue;
        const ds=state.domains[i],at=lower(ds,wanted[i]),options=[ds[at],ds[at-1]].filter(v=>v!==undefined).sort((a,b)=>Math.abs(a-wanted[i])-Math.abs(b-wanted[i]));
        let next=null;
        for(const v of options){const attempt=state.domains.slice();g.forEach(j=>attempt[j]=[v]);const check=propagate(c,attempt,deadline);if(check.domains){next=check;break;}if(check.timedOut)return null;}
        if(!next)return null;state=next;
      }
      return state.domains.map(ds=>ds[0]);
    }
    for(let pass=0;pass<3&&!keepExactPrior&&Date.now()<deadline;pass++){
      let improved=false;
      const crowded=new Set(collisionPairs(best).flatMap(p=>[p.i,p.j]));
      const order=gs.slice().sort((a,b)=>Number(b.some(i=>crowded.has(i)))-Number(a.some(i=>crowded.has(i)))||a[0]-b[0]);
      for(const g of order){
        if(Date.now()>deadline)break;if(g.some(i=>c.fixed.has(i)))continue;
        const i=g[0],ds=searchDomains[i],w=week(best[i]),options=new Set();
        if(g.some(j=>crowded.has(j)))for(const v of [w-3,w+7,best[i]-7,best[i]+7])options.add(v);
        for(const edge of c.edges)if(edge.b===i&&edge.targetLag!=null)options.add(c.calendars.add(best[edge.a],edge.targetLag,edge.unit,edge.calendar));
        if(!c.hard.some(e=>g.includes(e.a))){options.add(ds[0]);options.add(ds.at(-1));}
        for(const wanted of options){
          if(Date.now()>deadline)break;const at=lower(ds,wanted),v=ds[at]??ds.at(-1);if(v===best[i]||g.some(j=>!searchDomains[j].includes(v)))continue;
          const input=searchDomains.slice();g.forEach(j=>input[j]=[v]);
          const trial=repair(input,best);if(!trial)continue;
          candidates++;const s=score(c,trial,settings.previousDates);
          if(compare(s,bestScore)<0&&!verify(template,settings,dateMap(trial)).length){best=trial;bestScore=s;jointMoves++;improved=true;}
        }
      }
      if(!improved)break;
    }
    // Joint moves may expose inexpensive single-group improvements. Reserve a
    // bounded finishing pass so an expensive neighborhood search cannot starve it.
    for(let pass=0;pass<4&&!keepExactPrior&&Date.now()<finishDeadline;pass++){
      let improved=false;
      for(const g of gs){
        if(Date.now()>finishDeadline)break;if(g.some(i=>c.fixed.has(i)))continue;
        const members=new Set(g),touching=c.hard.filter(e=>members.has(e.a)||members.has(e.b));
        let chosen=best,chosenScore=bestScore;
        for(const v of searchDomains[g[0]].filter(v=>Math.abs(v-best[g[0]])<=21)){
          if(Date.now()>finishDeadline)break;if(g.some(i=>!searchDomains[i].includes(v)))continue;
          const trial=best.slice();g.forEach(i=>trial[i]=v);
          if(touching.some(e=>{const[l,u]=bounds(c,e,trial[e.a]);return trial[e.b]<l||trial[e.b]>u;}))continue;
          const s=score(c,trial,settings.previousDates);if(compare(s,chosenScore)<0){chosen=trial;chosenScore=s;}
        }
        if(chosen!==best){best=chosen;bestScore=chosenScore;improved=true;candidates++;}
      }
      if(!improved)break;
    }
    const dates=dateMap(best), verification=verify(template,{...settings,horizonStart:iso(c.start),horizonEnd:iso(c.end)},dates);
    if(verification.length)return {status:'invalid',errors:['独立复核失败，未保存结果。',...verification]};
    const details={};
    for(let i=0;i<c.events.length;i++){
      const e=c.events[i], touching=c.edges.filter(x=>x.a===i||x.b===i);
      const allowed=hardDomains[i].filter(v=>c.hard.filter(x=>x.a===i||x.b===i).every(x=>{const a=x.a===i?v:best[x.a],b=x.b===i?v:best[x.b],[l,u]=bounds(c,x,a);return b>=l&&b<=u;}));
      const sameWeek=c.events.filter((other,j)=>j!==i && other.threadId===e.threadId && week(best[j])===week(best[i])).map(x=>x.id);
      details[e.id]={date:dates[e.id],derivedStart:iso(hardDomains[i][0]),derivedEnd:iso(hardDomains[i].at(-1)),movableDates:allowed.map(iso),sameWeek,
        rules:touching.map(x=>{const[l,u]=bounds(c,x,best[x.a]),target=x.targetLag==null?null:c.calendars.add(best[x.a],x.targetLag,x.unit,x.calendar);return{id:x.id,predecessorId:c.events[x.a].id,successorId:c.events[x.b].id,strength:x.strength,earliest:iso(l),latest:Number.isFinite(u)?iso(u):null,target:target==null?null:iso(target),deviationDays:target==null?null:best[x.b]-target,satisfied:best[x.b]>=l&&best[x.b]<=u};})};
    }
    const weekCollisions=collisionPairs(best).map(({i,j})=>{
      const wi=new Set(hardDomains[i].map(week)),wj=new Set(hardDomains[j].map(week));
      const forced=wi.size===1&&wj.size===1&&[...wi][0]===[...wj][0];
      return {eventIds:[c.events[i].id,c.events[j].id],weekStart:iso(week(best[i])),forcedByHardWindows:forced,
        reason:forced?'两个事件在当前硬条件下的全部候选日期均落在同一周，无法通过重排错开。':'当前可行解仍同周；未证明无法错开，可放开非必要锁定或继续调整偏好。',
        windows:[i,j].map(k=>({eventId:c.events[k].id,start:iso(hardDomains[k][0]),end:iso(hardDomains[k].at(-1))}))};
    });
    const canonicalScore=score({...c,settings:{...settings,_searchStyle:undefined}},best,settings.previousDates);
    return {status:'feasible',version:VERSION,dates,details,score:canonicalScore,scoreVersion:2,metrics:{nonWorkingEvents:canonicalScore[1],softViolationDays:canonicalScore[2],qualityCost:canonicalScore[3],sameWeekPairs:canonicalScore[4],targetDeviationDays:canonicalScore[5],movedEvents:canonicalScore[6],shiftDays:canonicalScore[7]},weekCollisions,verified:true,optimal:false,candidates,coordinatedMoves,jointMoves,beforeCoordinatedScore:beforeCoordinated,elapsedMs:Date.now()-started,
      earliestA1Proven:minimumReleased!==null && best[c.index.get(settings.releaseAnchorId)]===minimumReleased,
      warnings:c.warnings,horizon:{start:iso(c.start),end:iso(c.end)},message:'硬条件全部通过独立复核；优先工作日，综合权衡错周、目标间隔及改期成本。未证明全局最优。'};
  }
  function solve(template,settings={},progress=()=>{}){
    const started=Date.now(),budget=Math.max(500,Math.min(settings.timeBudgetMs||5000,30000));
    const portfolio=budget>=2000&&settings.replanMode!=='repair_only';
    const first=solveSingle(template,{...settings,_searchStyle:undefined,timeBudgetMs:portfolio?Math.floor(budget*.55):budget},progress);
    if(!portfolio||first.status!=='feasible')return first;
    const left=budget-(Date.now()-started);
    if(left<500)return first;
    progress({stage:'正在从另一种周次安排起点交叉搜索'});
    const rhythm=template.events.flatMap(e=>e.dependencies.filter(d=>d.targetWeight>=20&&d.unit==='calendar_day'&&d.targetLag!=null).map(d=>({a:d.predecessorEventId,b:e.id,n:d.targetLag})));
    const second=solveSingle(template,{...settings,_searchStyle:'spread',timeBudgetMs:rhythm.length?Math.max(500,left-1800):left},progress);
    // Both searches are assessed under the identical public objective. A restart
    // is only a different search strategy, never a change to accepted constraints.
    let chosen=second.status==='feasible'&&compare(second.score,first.score)<0?second:first;
    // Test an exact high-priority cadence as a candidate, not a persistent hard
    // restriction. Recompute final diagnostics with the user's original locks.
    if(rhythm.length&&budget-(Date.now()-started)>800){
      const locks={...(settings.locks||{})},trialDates={...chosen.dates};let valid=true;
      for(const e of rhythm){const wanted=iso(parseDate(trialDates[e.a])+e.n);if((locks[e.b]&&locks[e.b]!==wanted)||(settings.anchorDates?.[e.b]&&settings.anchorDates[e.b]!==wanted)){valid=false;break;}locks[e.b]=wanted;trialDates[e.b]=wanted;}
      if(valid){const candidate=solveSingle(template,{...settings,locks,timeBudgetMs:Math.max(500,budget-(Date.now()-started)-600)},()=>{});
        if(candidate.status==='feasible'&&compare(candidate.score,chosen.score)<0){const clean=solveSingle(template,{...settings,previousDates:candidate.dates,replanMode:'repair_only',timeBudgetMs:600},()=>{});if(clean.status==='feasible'){const cc=compile(template,settings),s=score(cc,cc.events.map(e=>parseDate(clean.dates[e.id])),settings.previousDates);clean.score=s;Object.assign(clean.metrics,{qualityCost:s[3],sameWeekPairs:s[4],targetDeviationDays:s[5],movedEvents:s[6],shiftDays:s[7]});if(compare(s,chosen.score)<0)chosen=clean;}}
      }
    }
    return{...chosen,elapsedMs:Date.now()-started,searchStarts:2,candidates:first.candidates+(second.candidates||0),jointMoves:first.jointMoves+(second.jointMoves||0)};
  }
  const api={VERSION,parseDate,iso,week,weekday,validateTemplate,createCalendars,compile,propagate,solve,verify};
  api.workerSource='('+engineFactory.toString()+')(self); self.onmessage=function(event){ try { const p=event.data; const result=IPOScheduler.solve(p.template,p.settings,progress=>self.postMessage({progress})); self.postMessage({result}); } catch(error) { self.postMessage({result:{status:"invalid",errors:[error.message]}}); }};';
  if(typeof module!=='undefined' && module.exports)module.exports=api;else root.IPOScheduler=api;
})(typeof globalThis!=='undefined'?globalThis:this);
