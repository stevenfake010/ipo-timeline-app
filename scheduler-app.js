(() => {
  'use strict';
  const E=window.IPOScheduler, KEY='ipo-scheduler-plans-v1', LIBRARY_KEY='ipo-scheduler-default-library-v1';
  const roles=window.IPOFinancialPlanning?.responsibilities,assignment=e=>roles?.get(e),ownerText=e=>assignment(e)?.responsible.join("、")||"";
  const $=id=>document.getElementById(id), copy=x=>JSON.parse(JSON.stringify(x));
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid=()=>typeof crypto.randomUUID==='function'?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2);
  const unitLabel=unit=>({business_day:'工作日',calendar_day:'自然日',calendar_month:'自然月'}[unit]||unit);
  // These switches are product defaults now: the UI no longer exposes them, and plans always run with them on.
  const FORCED_SETTINGS=['spreadWeeks','keepPrevious','preferWorkingDays','a1BusinessDaysOnly'];
  let db={version:1,currentId:null,plans:[]}, worker=null, workerURL=null, generation=0, selected=null, collapsed=new Set(), toastTimer;
  let readError='';
  try { const raw=localStorage.getItem(KEY);if(raw){const parsed=JSON.parse(raw);if(parsed.version!==1||!Array.isArray(parsed.plans))throw new Error('方案存储格式无法识别');db=parsed;} }catch(e){readError='无法读取已有方案，未覆盖原存储。请导出当前工作后检查浏览器存储：'+e.message;}
  const reviewed=window.IPORuleRevision.revise(window.IPO_DRAFT_RULES,window.IPO_DRAFT_RULES).template;
  const prospectus=window.IPOProspectusRevision.revise(reviewed,reviewed);
  const batch1=window.IPOFeedbackRevision.revise(prospectus.template);
  const agenda=copy(prospectus.agenda);agenda.find(x=>x.eventCode==='EVT-141').outputs.push('EVT-157');agenda.find(x=>x.eventCode==='EVT-142').inputs.push('EVT-157');
  const batch2=window.IPOBatch2Revision.revise(batch1);
  const cycle=window.IPOMeetingCycle.revise(window.IPOProspectusGrouping.revise(batch2));
  const embedded={...cycle,template:window.IPOFlexiblePlanning.revise(cycle.template)};
  if(roles)embedded.template=roles.enrich(embedded.template);
  let defaultCalendars=copy(window.IPO_PUBLIC_HOLIDAYS),defaultRelease=null;
  let defaultLibrary={template:embedded.template,source:'内置最新事件库',agenda:embedded.agenda,release:null};
  let library=copy(defaultLibrary),libraryError='',customLibrary=false,libraryLoading=false;
  try{const raw=localStorage.getItem(LIBRARY_KEY);if(raw){const saved=JSON.parse(raw),errors=E.validateTemplate(saved.template);if(errors.length)throw new Error(errors.join('；'));library=saved;customLibrary=true;}}
  catch(e){libraryError='本机事件库读取失败，原数据未覆盖：'+e.message;}
  function plan(){return db.plans.find(p=>p.id===db.currentId);}
  function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
  function status(text,kind=''){const el=$('status');el.textContent=text;el.className='status '+kind;el.hidden=!text;}
  function save(){
    if(readError){$('saveState').textContent=readError;return;}
    try{localStorage.setItem(KEY,JSON.stringify(db));$('saveState').textContent='已保存本机 · '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});}
    catch(e){$('saveState').textContent='本机保存失败：请立即导出方案备份。';toast('本机空间不足或存储不可用，当前修改仅在内存中，请导出方案。');}
  }
  function blank(){return{id:uid(),name:'未命名排程方案',template:null,source:'',fingerprint:'',settings:{anchorDates:{},locks:{},calendars:copy(defaultCalendars),calendarRelease:copy(defaultRelease),spreadWeeks:true,keepPrevious:true,preferWorkingDays:true,a1BusinessDaysOnly:true,timeBudgetMs:10000},result:null,pending:null,history:[],dirty:true};}
  function applyLibrary(p){const t=library.template;p.template=copy(t);p.source=library.source;p.ruleRelease=copy(library.release||null);p.conferenceAgenda=copy(library.agenda||[]);p.settings.a1Id=t.events.find(e=>e.dateMode==='anchor_input'&&/A1/i.test(e.name))?.id||'';
    if(window.IPOFinancialPlanning?.supported(t)){p.financialBaseTemplate=copy(t);p.template=window.IPOFinancialPlanning.create(t,'complete');}
    p.conferenceAgenda=copy(p.template.conferenceAgenda||p.conferenceAgenda);p.fingerprint=fingerprint(p.template);
  }
  function changeFinancialMode(mode,force=false,options){
    const old=plan(),F=window.IPOFinancialPlanning;if(!old?.template||!F)return;
    if(old.template.financialStrategy?.mode===mode&&!force)return;
    try{
      const base=old.financialBaseTemplate||old.template,next=F.create(base,mode,options||old.template.executionOptions||{});
      // Any existing snapshot is preserved by an explicit revision copy, including unsolved user edits.
      stop();const p=copy(old);p.id=uid();p.name+=' · '+(mode==='staged'?'分阶段':'完整数据')+'修订';
      p.financialBaseTemplate=copy(base);p.template=next;p.conferenceAgenda=copy(next.conferenceAgenda||p.conferenceAgenda||[]);p.fingerprint=fingerprint(next);
      p.settings.calendars=historicalCalendars(p.settings.calendars,true);p.settings.calendarOverlayRevision='2026-11-02-history-v1';
      const ids=new Set(next.events.map(e=>e.id));
      for(const key of ['anchorDates','locks'])p.settings[key]=Object.fromEntries(Object.entries(p.settings[key]||{}).filter(([id])=>ids.has(id)));
      p.result=null;p.pending=null;p.history=[];p.dirty=true;
      db.plans.push(p);db.currentId=p.id;selected=null;save();render();status('已创建新方案。确认财务数据可用日后即可排程，原方案保留。','warning');
    }catch(e){render();status(e.message,'error');}
  }
  async function newPlan(){if(libraryLoading){toast('正在读取已发布规则，请稍候');return;}if(libraryError){status(libraryError,'error');return;}if(window.IPOLibraryCloud&&window.IPO_CLOUD_CONFIG?.enabled)await refreshCloud();stop();const p=blank();applyLibrary(p);db.plans.push(p);db.currentId=p.id;selected=null;save();render();}
  function currentResult(){return plan()?.pending||plan()?.result;}
  function movable(p,r,e){return !!(r&&e?.dateMode==='calculated'&&!r.settings.releaseAnchorId&&!r.settings.locks?.[e.id]&&!r.settings.anchorDates?.[e.id]&&(!p.dirty||p.pending));}
  function moveWeeks(dates){
    const days=Object.values(dates).map(E.parseDate),weeks=[];
    for(let w=E.week(Math.min(...days)),end=E.week(Math.max(...days));w<=end;w+=7)weeks.push(w);
    return weeks;
  }
  function dateLabel(r,e){return e.dateMode==='anchor_input'?'锚点':r.settings.locks?.[e.id]?'人工锁定':r.manualIds?.includes(e.id)?'手动调周':'自动推荐';}
  function mutate(){stop();const p=plan();p.pending=null;p.dirty=true;save();status(p.result?'设置已改变，下面仍是上次结果。请重新试排后确认新版本。':'',p.result?'warning':'');renderPending();renderBoard();renderDetails();}
  function fingerprint(t){let h=2166136261;for(const c of JSON.stringify(t)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
  function effectiveCalendars(saved){return{...copy(defaultCalendars),...copy(saved||{})};}
  function historicalCalendars(input,onlyBuiltin=false){
    const out=copy(input||{});
    for(const [name,c]of Object.entries(out)){
      const local=window.IPO_PUBLIC_HOLIDAYS[name];if(!local||!c.from||c.from<=local.from||onlyBuiltin&&c.builtin!==true)continue;
      const oldFrom=c.from;
      c.holidays=[...new Set([...c.holidays,...local.holidays.filter(d=>d>=local.from&&d<oldFrom)])].sort();
      c.workingDays=[...new Set([...c.workingDays,...local.workingDays.filter(d=>d>=local.from&&d<oldFrom)])].sort();
      c.from=local.from;c.version+='；'+local.from.slice(0,4)+'–'+String(Number(oldFrom.slice(0,4))-1)+'历史假期补充';
      c.sources=[...new Set([...(c.sources||[]),c.source,...(local.sources||[]),local.source].filter(Boolean))];
    }
    return out;
  }
  function datesChanged(a,b){return Object.keys(b||{}).filter(id=>a?.[id]!==b[id]);}
  function render(){
    const p=plan();$('planSelect').innerHTML=db.plans.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');$('planSelect').value=p?.id||'';
    if(!p)return;
    $('planName').value=p.name;
    const t=p.template;
    const anchors=t?.events.filter(e=>e.dateMode==='anchor_input')||[];
    const financial=t?.financialStrategy,F=window.IPOFinancialPlanning;
    $('financialMode').value=financial?.mode||'legacy';$('financialMode').disabled=!(F&&(financial||F.supported(t)));
    $('financialInfo').textContent=financial?.mode==='staged'?'首批数据先行，完整数据到位后更新。切换模式将保留原方案。':'可用日指审计师出具可分析数据的日期。切换模式将保留原方案。';
    $('financialCoverageLabel').hidden=financial?.mode!=='staged';$('financialBaseDate').value=p.settings.financialBaseDate||'';
    $('refreshFinancial').hidden=!financial||financial.revision===F?.VERSION||!p.financialBaseTemplate;
    $('cybersecurityLabel').hidden=!t?.executionOptions;$('cybersecurity').checked=!!t?.executionOptions?.cybersecurity;
    const dateField=e=>`<label>${esc(e.name)}<input type="date" data-anchor="${esc(e.id)}" value="${esc(p.settings.anchorDates[e.id]||'')}"></label>`;
    $('anchorInputs').innerHTML=anchors.filter(e=>e.id!==financial?.firstAnchorId).map(dateField).join('');
    $('firstAvailableInput').innerHTML=anchors.filter(e=>e.id===financial?.firstAnchorId).map(dateField).join('');
    $('a1Select').innerHTML='<option value="">不指定</option>'+anchors.filter(e=>![financial?.fullAnchorId,financial?.firstAnchorId].includes(e.id)).map(e=>`<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('');$('a1Select').value=p.settings.a1Id||'';
    $('replanMode').value=p.settings.replanMode||'optimize';
    $('viewTitle').textContent=projectTitle(p);
    $('run').disabled=!t||!!worker;$('run').textContent=worker?'计算中…':currentResult()?'重新排程':'生成排程';$('earliestA1').disabled=!t||!p.settings.a1Id;
    $('conflicts').hidden=true;
    renderPending();renderBoard();renderHistory();renderDetails();
    if(readError||libraryError)status(readError||libraryError,'error');else if(worker)status('正在计算，请稍候。');else if(p.dirty&&p.result&&!p.pending)status('设置已更改。当前显示上次确认的时间表，请重新排程。','warning');else status('');
  }
  function projectTitle(p){return p.name==='未命名排程方案'?'港股 IPO 项目':p.name;}
  function showResultStatus(run){if(run.message?.includes('仅此事件改期'))status(run.message,'success');else status('');}
  function renderOverview(p,r){
    const t=p.template,events=t?.events||[],stage=t?.financialStrategy;
    const subtitle=[stage?(stage.mode==='staged'?'两阶段财务数据':'完整报告期数据'):'',r?(p.pending?'待确认预览':p.dirty?'上次确认的排程':'已确认排程'):'待排程'].filter(Boolean);
    $('viewSubtitle').textContent=subtitle.join('  /  ');
    const dates=r?.run.dates||p.settings.anchorDates||{},anchor=code=>events.find(e=>e.code===code)?.id;
    const keys=[['项目启动',anchor('EVT-002')],...(stage?.firstAnchorId?[['首批数据可用',stage.firstAnchorId]]:[]),['完整数据可用',stage?.fullAnchorId],['A1 申报',r?.settings?.a1Id||p.settings.a1Id]];
    $('milestones').innerHTML=keys.filter(([,id])=>id).map(([label,id])=>`<div><small>${label}</small><b class="${dates[id]?'':'unset'}">${esc(dates[id]?.replaceAll('-','.')||'待填写')}</b></div>`).join('');
    const stats=[['事件',events.length],['工作线程',t?.threads?.length||0]];
    if(r)stats.push(['覆盖周数',moveWeeks(dates).length]);
    $('summaryStats').innerHTML=stats.map(([label,n])=>`<div><strong>${n}</strong><span>${label}</span></div>`).join('');
    const warnings=r?.run.warnings||[];
    $('resultNotes').hidden=!warnings.length;$('noteCount').textContent='需留意 · '+warnings.length+' 项';$('noteList').innerHTML=warnings.map(x=>'<li>'+esc(x)+'</li>').join('');
    $('historySection').hidden=!p.history?.length;$('boardTools').hidden=!r;$('legend').hidden=!r||$('viewMode').value!=='weeks';
  }
  function renderPending(){
    const p=plan(),pending=p?.pending;$('pendingBar').hidden=!pending;
    if(pending){const base=pending.beforeWeekEdits||p.result,changed=datesChanged(base?.run.dates,pending.run.dates);$('pendingTitle').textContent=pending.manualIds?'手动调周预览 · 待确认':pending.settings.releaseAnchorId?'最早A1备选 · 待确认':'新排程预览 · 待确认';$('pendingText').textContent=`${changed.length} 个事件${base?'日期变化':'获得推荐日期'}。确认前不会替换已保存版本。`+(pending.settings.releaseAnchorId?` A1：${pending.run.dates[pending.settings.releaseAnchorId]}。`:'');}
  }
  function renderBoard(){
    const p=plan(),r=currentResult(),t=p?.template,term=$('search').value.trim().toLowerCase();
    renderOverview(p,r);$('weekMoveHint').hidden=!r||$('viewMode').value!=='weeks';
    if(!t||!r){$('board').innerHTML=`<div class="empty"><div class="empty-icon" aria-hidden="true"><i></i></div><h3>${t?'规划项目的第一周':'打开项目方案'}</h3><p>${t?'填写关键日期，生成从启动会到 A1 申报的时间表。':'导入已保存的方案，继续查看时间表。'}</p><div class="button-row">${t?'<button data-setup class="primary">设置关键日期</button>':''}<button data-import>导入方案</button></div></div>`;return;}
    const dates=r.run.dates,all=t.events.filter(e=>dates[e.id]),filtered=all.filter(e=>!term||(e.code+' '+e.name+' '+ownerText(e)).toLowerCase().includes(term));
    const weeks=moveWeeks(dates);
    const baseline=p.pending?.beforeWeekEdits||p.result,changed=new Set(datesChanged(baseline?.run.dates,dates));
    if($('viewMode').value!=='weeks'){
      const isChanges=$('viewMode').value==='changes';
      const rows=filtered.filter(e=>!isChanges||(p.pending&&changed.has(e.id))).sort((a,b)=>dates[a.id].localeCompare(dates[b.id])||a.code.localeCompare(b.code));
      $('board').innerHTML=`<table class="list-table"><thead><tr><th>事件</th><th>线程</th><th>负责方</th>${isChanges?'<th>原日期</th>':''}<th>推荐日期</th><th>状态</th></tr></thead><tbody>${rows.map(e=>`<tr><td><button data-event="${esc(e.id)}">${esc(e.code)} ${esc(e.name)}</button></td><td>${esc(t.threads.find(x=>x.id===e.threadId)?.name)}</td><td>${esc(ownerText(e)||"未指定")}</td>${isChanges?`<td>${esc(baseline?.run.dates[e.id]||'—')}</td>`:''}<td>${dates[e.id]}</td><td>${dateLabel(r,e)}</td></tr>`).join('')}</tbody></table>${rows.length?'':'<div class="empty">'+(isChanges?'没有待确认的日期变动。':'没有匹配的事件。')+'</div>'}`;return;
    }
    let html='<table class="timeline"><thead><tr><th class="row-name">条线 / 线程</th>'+weeks.map(w=>`<th data-head-week="${E.iso(w)}">${E.iso(w).slice(5)} – ${E.iso(w+6).slice(5)}<br><small>${E.iso(w).slice(0,4)}</small></th>`).join('')+'</tr></thead><tbody>';
    for(const lane of t.lanes){
      const threads=t.threads.filter(th=>th.laneId===lane.id&&filtered.some(e=>e.threadId===th.id));if(!threads.length)continue;
      html+=`<tr class="lane-row"><td class="row-name"><button data-collapse="${esc(lane.id)}">${collapsed.has(lane.id)?'▸':'▾'} ${esc(lane.name)}</button></td><td colspan="${weeks.length}">${threads.length} 个线程</td></tr>`;
      if(collapsed.has(lane.id))continue;
      for(const th of threads){const es=filtered.filter(e=>e.threadId===th.id);html+=`<tr><td class="row-name"><button class="thread-toggle" data-collapse="${esc(th.id)}">${collapsed.has(th.id)?'▸':'▾'} ${esc(th.name)}<small>${es.length} 个事件</small></button></td>`;
        for(const w of weeks){const cell=es.filter(e=>E.week(E.parseDate(dates[e.id]))===w).sort((a,b)=>dates[a.id].localeCompare(dates[b.id])||a.code.localeCompare(b.code));
          html+=`<td data-week="${E.iso(w)}" data-thread="${esc(th.id)}">`+(collapsed.has(th.id)?(cell.length?`<span class="muted">${cell.length} 项</span>`:''):cell.map(e=>`<button draggable="${movable(p,r,e)}" class="event-chip ${r.manualIds?.includes(e.id)?'manual':''} ${cell.length>1?'crowded':''} ${r.settings.locks?.[e.id]?'locked':''} ${e.dateMode==='anchor_input'?'anchor':''} ${selected===e.id?'selected':''} ${p.pending&&changed.has(e.id)?'changed':''}" title="${esc(e.code)} · ${esc(e.name)}" data-event="${esc(e.id)}"><strong>${dates[e.id].slice(5)}${e.dateMode==='anchor_input'?' · 锚点':r.manualIds?.includes(e.id)?' · 手调':''}</strong>${esc(e.name)}</button>`).join(''))+'</td>';
        }html+='</tr>';
      }
    }
    $('board').innerHTML=html+'</tbody></table>';
    if(!filtered.length){$('board').innerHTML='<div class="empty"><h3>未找到匹配事件</h3><p>试试其他关键词或事件编码。</p></div>';return;}
    if(boardPlan!==p.id){boardPlan=p.id;const kickoff=t.events.find(e=>e.code==='EVT-002');if(kickoff)scrollWeek(dates[kickoff.id]);}
  }
  function eventDetail(e,r){
    const p=plan(),dates=r.run.dates,cal=E.createCalendars(r.settings.calendars),rels=[];
    for(const to of p.template.events)for(const d of to.dependencies)if(to.id===e.id||d.predecessorEventId===e.id){const name=d.calendar==='inherit'?p.template.project.defaultCalendar||'hk':d.calendar,a=E.parseDate(dates[d.predecessorEventId]),b=E.parseDate(dates[to.id]),l=cal.add(a,d.minLag,d.unit,name),u=d.maxLag==null?Infinity:cal.add(a,d.maxLag,d.unit,name);rels.push({...d,toId:to.id,fromId:d.predecessorEventId,l,u,b,target:d.targetLag==null?null:cal.add(a,d.targetLag,d.unit,name),name});}
    const start=E.parseDate(r.run.horizon.start),end=E.parseDate(r.run.horizon.end),allowed=[];
    for(let day=start;day<=end;day++){
      if(r.settings.anchorDates[e.id]&&e.id!==r.settings.releaseAnchorId&&E.iso(day)!==r.settings.anchorDates[e.id])continue;
      if(r.settings.locks[e.id]&&E.iso(day)!==r.settings.locks[e.id])continue;
      if((r.settings.blockedDates||[]).includes(E.iso(day)))continue;
      if(p.template.project.calculatedWorkingDaysOnly&&e.dateMode==='calculated'&&!cal.get(p.template.project.defaultCalendar||'hk').isWorking(day))continue;
      if(r.settings.a1BusinessDaysOnly&&e.id===(r.settings.releaseAnchorId||r.settings.a1Id)&&!cal.get(p.template.project.defaultCalendar||'hk').isWorking(day))continue;
      const candidate={...dates,[e.id]:E.iso(day)};
      if((p.template.readinessGroups||[]).some(g=>{const ready=Math.max(Math.min(...g.anyOf.map(id=>E.parseDate(candidate[id]))),...g.readyAfterEventIds.map(id=>E.parseDate(candidate[id])));return E.parseDate(candidate[g.eventId])<cal.add(ready,g.minLag,g.unit,g.calendar==='inherit'?p.template.project.defaultCalendar||'hk':g.calendar);}))continue;
      if(rels.filter(x=>x.strength==='hard').every(x=>{const a=x.fromId===e.id?day:E.parseDate(dates[x.fromId]),b=x.toId===e.id?day:E.parseDate(dates[x.toId]);return b>=cal.add(a,x.minLag,x.unit,x.name)&&(x.maxLag==null||b<=cal.add(a,x.maxLag,x.unit,x.name));}))allowed.push(day);
    }
    return{rels,allowed};
  }
  function renderDetails(){
    const p=plan(),r=currentResult(),e=p?.template?.events.find(e=>e.id===selected);
    if(!e||!r){$('inspector').classList.remove('open');$('eventDetails').innerHTML='';return;}
    $('inspector').classList.add('open');
    const {rels,allowed}=eventDetail(e,r),byId=new Map(p.template.events.map(x=>[x.id,x]));
    const same=p.template.events.filter(x=>x.id!==e.id&&x.threadId===e.threadId&&E.week(E.parseDate(r.run.dates[x.id]))===E.week(E.parseDate(r.run.dates[e.id])));
    const collisionReasons=[...new Set((r.run.weekCollisions||[]).filter(x=>x.eventIds.includes(e.id)).map(x=>x.reason))];
    const outgoing=rels.filter(x=>x.fromId===e.id),incoming=rels.filter(x=>x.toId===e.id);
    const agenda=(p.template.conferenceAgenda||p.conferenceAgenda)?.find(a=>a.eventCode===e.code);
    const readiness=(p.template.readinessGroups||[]).filter(g=>g.eventId===e.id);
    const closeout=r.run.details?.[e.id]?.softWindow;
    const agendaNames=codes=>codes.map(code=>{const item=p.template.events.find(x=>x.code===code);return esc(item?code+' '+item.name:code);}).join('；');
    const role=assignment(e);
    $('eventDetails').innerHTML=`<small>${esc(e.code)} · ${esc(p.template.threads.find(x=>x.id===e.threadId)?.name)}</small><h3>${esc(e.name)}</h3><div class="detail-date">${r.run.dates[e.id]}</div><div class="detail-info">${dateLabel(r,e)} · ${p.pending?'预览方案':'已确认方案'}<br>其他事件不动时可选 ${allowed.length} 天${allowed.length?`：${E.iso(allowed[0])} 至 ${E.iso(allowed.at(-1))}`:''}。${allowed.length&&allowed.at(-1)-allowed[0]+1!==allowed.length?'范围内有禁用日期，不是每一天都可选。':''}</div>
      <div class="detail-info"><strong>负责方：</strong>${esc(role?.responsible.join("、")||"未指定")}${role?.supporting.length?`<br>配合方：${esc(role.supporting.join("、"))}`:""}${role?`<br><small>${esc(roles.labels[role.basis])}</small>`:""}</div>
      ${movable(p,r,e)?`<label>仅移动此事件<select data-week-picker><option value="">选择目标周…</option>${moveWeeks(r.run.dates).filter(w=>w!==E.week(E.parseDate(r.run.dates[e.id]))).map(w=>`<option value="${E.iso(w)}">${E.iso(w)} 至 ${E.iso(w+6).slice(5)}</option>`).join('')}</select></label><p class="hint">试移后可预览；不增加日期锁定。</p>`:''}
      <details><summary>锁定日期</summary><label>人工锁定日期<input type="date" id="lockDate" value="${esc(p.settings.locks[e.id]||r.run.dates[e.id])}"></label><div class="button-row"><button id="lockEvent">锁定并待重排</button><button id="unlockEvent">解除锁定</button></div><p class="hint">锁定不直接改动时间表，重新试排后生效。锚点在项目设置中修改。</p></details>
      ${e.code==='EVT-198'?`<label>专项境外法律尽调需求<select id="overseasDecision"><option value="pending">待确认（先预留后续工作）</option><option value="yes">需要</option><option value="no">不需要（仅保留范围确认节点）</option></select></label><p class="hint">调整会创建修订副本，不改动原方案。</p>`:''}
      ${agenda?`<h3>本次大会讨论安排</h3><p>${esc(agenda.purpose)}</p><p class="hint">会前材料：${agendaNames(agenda.inputs)}</p><p class="hint">后续重点（部分可提前准备）：${agendaNames(agenda.outputs)}</p>`:''}
      ${readiness.length||same.length||closeout||e.sameWeekGroup?`<details><summary>日期依据</summary>
      ${readiness.map(g=>`<p class="calendar-notice">任一材料就绪即可：${g.anyOf.map(id=>esc(byId.get(id)?.name)).join(' / ')}。${g.readyAfterEventIds.length?'同时须完成：'+g.readyAfterEventIds.map(id=>esc(byId.get(id)?.name)).join('、')+'。':''}目标在条件就绪后 ${g.targetLag} 个项目工作日启动。</p>`).join('')}
      ${same.length?`<div class="calendar-notice">同线程同周：${same.map(x=>esc(x.code+' '+x.name)).join('；')}。${collisionReasons.length?collisionReasons.map(esc).join(' '):'错周是偏好，不能突破同日关系、锁定日期或硬区间。'}</div>`:''}
      ${closeout?`<p class="calendar-notice">建议收尾窗口：${esc(closeout.earliest)} 至 ${esc(closeout.latest)}。${closeout.satisfied?'本次已落在窗口内。':'本次偏离窗口，建议复核。'}这是项目软偏好，不是硬期限或法规有效期。</p>`:''}
      ${e.sameWeekGroup?'<p class="hint">本事件与同组协作事项允许同周安排，不为错周而延迟；最短处理间隔仍须满足。</p>':''}</details>`:''}
      <details><summary>事件依赖</summary>
      <h3>前置条件 · ${incoming.length}</h3>${incoming.map(x=>ruleHTML(x,byId)).join('')||'<p class="hint">没有前置关系。</p>'}<h3>直接影响的后续事件 · ${outgoing.length}</h3>${outgoing.map(x=>ruleHTML(x,byId)).join('')||'<p class="hint">没有直接后续关系。</p>'}</details>`;
    if(e.code==='EVT-198')$('overseasDecision').value=p.template.executionOptions?.overseasRequired===false?'no':p.template.executionOptions?.overseasRequired===true?'yes':'pending';
  }
  function ruleHTML(x,byId){const ok=x.b>=x.l&&x.b<=x.u;return`<div class="rule ${ok?'':'warn'}"><span class="tag">${x.strength==='hard'?'硬条件':'软偏好'} · ${ok?'范围已满足':'偏好未满足'}</span><p>${esc(byId.get(x.fromId)?.code+' '+byId.get(x.fromId)?.name)} → ${esc(byId.get(x.toId)?.code+' '+byId.get(x.toId)?.name)}</p><p class="hint">间隔 ${x.minLag} / ${x.targetLag??'不设目标'} / ${x.maxLag??'不限'} ${unitLabel(x.unit)}<br>允许后置日：${E.iso(x.l)} 至 ${Number.isFinite(x.u)?E.iso(x.u):'不限'}<br>${x.target==null?'仅检查就绪顺序，不额外计目标等待。':`目标后置日：${E.iso(x.target)}；实际偏移 ${x.b-x.target} 个自然日`}</p></div>`;}
  function renderHistory(){const p=plan();$('historyList').innerHTML=p?.history.length?p.history.slice().reverse().map(h=>`<div class="history-item"><span>${esc(new Date(h.at).toLocaleString('zh-CN'))} · ${Object.keys(h.run.dates).length} 个事件</span><button data-restore="${esc(h.id)}">恢复此版本</button></div>`).join(''):'还没有已确认的排程。';}
  function stop(){generation++;if(worker){worker.terminate();worker=null;URL.revokeObjectURL(workerURL);workerURL=null;$('cancel').disabled=true;$('run').disabled=!plan()?.template;$('run').textContent=currentResult()?'重新排程':'生成排程';}}
  function startWorker(p,payload,message,onResult){
    const token=generation;
    try{
      workerURL=URL.createObjectURL(new Blob([E.workerSource],{type:'application/javascript'}));worker=new Worker(workerURL);
      $('cancel').disabled=false;$('run').disabled=true;$('run').textContent='计算中…';status(message);
      worker.onmessage=event=>{
        if(token!==generation||plan()?.id!==p.id)return;
        if(event.data.progress){status('正在生成时间表…');return;}
        stop();onResult(event.data.result);
      };
      worker.onerror=event=>{if(token!==generation)return;stop();status('计算任务失败，原表未变：'+(event.message||'请使用支持本地后台计算的浏览器'),'error');};
      worker.postMessage({...payload,template:p.template});
    }catch(err){stop();status('无法启动本地计算：'+err.message,'error');}
  }
  function tryWeekMove(id,week){
    const p=plan(),base=currentResult(),e=p?.template?.events.find(x=>x.id===id);
    if(worker||!movable(p,base,e)){toast('当前卡片不能移动，请先完成试排或检查日期锁定。');return;}
    const dates=base.run.dates;
    if(week===E.iso(E.week(E.parseDate(dates[id]))))return;
    const settings=copy(base.settings);
    stop();$('conflicts').hidden=true;
    startWorker(p,{settings,weekMove:{id,week,dates}},'正在检查目标周，仅调整 '+e.code+'，其他日期不动。',result=>{
      if(currentResult()!==base)return;
      if(result.status!=='feasible'){const msg=(result.errors||['目标周没有可行日期，原表未变。']).join('\n');status(msg,'warning');toast(msg.split('\n')[0]);return;}
      const delta=datesChanged(dates,result.dates);
      if(delta.length!==1||delta[0]!==id||E.iso(E.week(E.parseDate(result.dates[id])))!==week||E.verify(p.template,settings,result.dates).length){status('单事件复核未通过，原表未变。','error');return;}
      for(const detail of Object.values(result.details||{}))delete detail.movableDates;
      const originalPreview=p.pending?(Object.hasOwn(base,'beforeWeekEdits')?base.beforeWeekEdits:base):null;
      p.pending={id:uid(),at:new Date().toISOString(),settings,run:result,manualIds:[...new Set([...(base.manualIds||[]),id])],beforeWeekEdits:originalPreview};
      save();render();toast(e.code+' 已试移至 '+result.dates[id]+'，其他日期未变。');
    });
  }
  function begin(release=false){
    const p=plan();if(!p?.template)return;
    const missing=p.template.events.filter(e=>e.dateMode==='anchor_input'&&!(release&&e.id===p.settings.a1Id)&&!p.settings.anchorDates[e.id]);
    if(missing.length){status('请填写固定锚点：'+missing.map(e=>e.name).join('、'),'error');return;}
    if(p.template.financialStrategy?.mode==='staged'&&!p.settings.financialBaseDate){status('请填写首批财务数据基准日','error');return;}
    p.settings.calendars=effectiveCalendars(p.settings.calendars);
    stop();p.pending=null;save();renderPending();renderBoard();$('conflicts').hidden=true;
    const settings=copy(p.settings);
    // The UI no longer exposes these switches; force them on the computation copy only,
    // so a stored plan's saved settings are never rewritten behind the user's back.
    for(const k of FORCED_SETTINGS)settings[k]=true;
    settings.previousDates=p.result?.run.dates;
    if(release){if(!settings.a1Id){toast('请先指定A1锚点');return;}settings.releaseAnchorId=settings.a1Id;delete settings.locks[settings.a1Id];}
    else delete settings.releaseAnchorId;
    startWorker(p,{settings},'正在生成时间表…',result=>{
        if(result.status==='feasible'){
          const problems=E.verify(p.template,settings,result.dates);if(problems.length){showFailure({status:'invalid',errors:problems});return;}
          // Store compact diagnostics; the single-event movable range is recomputed on demand.
          for(const detail of Object.values(result.details||{}))delete detail.movableDates;
          p.pending={id:uid(),at:new Date().toISOString(),run:result,settings};save();render();showResultStatus(result);
        }else showFailure(result);
    });
  }
  function showFailure(r){
    status((r.errors||['未能生成结果']).join('\n'),r.status==='unknown'?'warning':'error');
    const p=plan(),ids=new Set(r.conflict?.ruleIds||[]),items=[];
    if(p.template.debtPolicy&&[...ids].some(id=>id.startsWith('debt-')))items.push('债项内部基准日须早于启动且距A1不超过2个自然月；准备至少8个项目工作日，完成后招股书才可最终定稿。');
    const failed=p.template.events.find(e=>e.id===r.conflict?.eventId);
    for(const e of p.template.events){if(ids.has('date:'+e.id))items.push(`${e.code} ${e.name} 固定为 ${p.settings.locks[e.id]||p.settings.anchorDates[e.id]}`);for(const d of e.dependencies)if(ids.has(d.id)){const prev=p.template.events.find(x=>x.id===d.predecessorEventId);items.push(`${prev?.code} ${prev?.name} → ${e.code} ${e.name}：${d.minLag}–${d.maxLag??'不限'}${unitLabel(d.unit)}（${d.strength==='hard'?'硬条件':'软偏好'}）`);}}
    $('conflicts').hidden=false;$('conflicts').innerHTML=`<div class="conflict-box"><h3>${r.status==='infeasible'?'日期条件冲突':'需要检查输入或继续计算'}</h3><p>${failed?esc(failed.code+' '+failed.name)+'：':''}${esc(r.conflict?.message||'未生成新日期，原方案保持不变。')}</p>${items.length?'<ul>'+items.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':''}<p class="hint">请检查相关日期及锁定项目，或试算最早 A1。原时间表未变。</p></div>`;
  }
  function accept(){const p=plan();if(!p?.pending)return;stop();const r=p.pending;delete r.beforeWeekEdits;
    if(r.settings.releaseAnchorId){const id=r.settings.releaseAnchorId;p.settings.anchorDates[id]=r.run.dates[id];delete p.settings.locks[id];delete r.settings.releaseAnchorId;r.settings.anchorDates[id]=r.run.dates[id];}
    p.result=r;p.pending=null;p.dirty=false;delete p.result.settings.previousDates;
    p.history.push({id:r.id,at:r.at,...(r.manualIds?{manualIds:[...r.manualIds]}:{}),settings:copy(r.settings),run:{...copy(r.run),details:{}}});p.history=p.history.slice(-8);save();render();toast('已采用此版本');}
  function download(name,content,type='application/json'){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function fileJSON(input,fn){try{const f=input.files[0];if(f){if(f.size>15*1024*1024)throw new Error('文件超过15MB，请检查文件类型');await fn(JSON.parse(await f.text()),f.name);}}catch(e){status(e.message,'error');toast('未导入：'+e.message);}finally{input.value='';}}
  // Presentation is a view setting only: never write project data or change the schedule.
  let presenting=false,boardPlan=null;
  function present(on){presenting=on;$('appShell').classList[on?'add':'remove']('presenting');$('presentation').setAttribute('aria-pressed',String(on));$('presentation').textContent=on?'退出演示':'演示视图';$('fileMenu').open=false;}
  $('presentation').onclick=()=>present(!presenting);
  $('openImport').onclick=()=>{$('fileMenu').open=false;$('importPlan').click();};
  document.addEventListener?.('keydown',ev=>{if(ev.key==='Escape'){if(selected)$('closeInspector').click();else if($('boardMenu').open||$('fileMenu').open){$('boardMenu').open=false;$('fileMenu').open=false;}else if(presenting)present(false);}});
  document.addEventListener?.('click',ev=>{for(const id of ['fileMenu','boardMenu']){const m=$(id);if(!m.contains(ev.target)||ev.target.closest('button'))m.open=false;}});
  $('newPlan').onclick=newPlan;
  $('financialMode').onchange=e=>changeFinancialMode(e.target.value);
  $('refreshFinancial').onclick=()=>changeFinancialMode(plan().template.financialStrategy.mode,true);
  $('cybersecurity').onchange=e=>{const p=plan();changeFinancialMode(p.template.financialStrategy.mode,true,{...p.template.executionOptions,cybersecurity:e.target.checked});};
  $('eventDetails').onchange=e=>{if(e.target.dataset?.weekPicker!==undefined){const w=e.target.value;e.target.value='';if(w)tryWeekMove(selected,w);return;}if(e.target.id!=='overseasDecision')return;const p=plan();changeFinancialMode(p.template.financialStrategy.mode,true,{...p.template.executionOptions,overseasRequired:e.target.value==='pending'?null:e.target.value==='yes'});};
  $('financialBaseDate').onchange=e=>{plan().settings.financialBaseDate=e.target.value;mutate();};
  $('copyPlan').onclick=()=>{stop();const p=copy(plan());p.id=uid();p.name+=' · 副本';p.pending=null;db.plans.push(p);db.currentId=p.id;save();render();};
  $('deletePlan').onclick=()=>{
    const p=plan();
    if(!p){toast('当前没有可删除的方案');return;}
    const label=p.name||'未命名排程方案';
    const versions=(p.history||[]).length;
    if(!window.confirm(`删除方案「${label}」？\n已确认版本 ${versions} 个将一并删除，无法恢复。建议先“导出方案”备份。`))return;
    stop();
    const index=db.plans.findIndex(x=>x.id===p.id);
    db.plans=db.plans.filter(x=>x.id!==p.id);
    if(!db.plans.length){const next=blank();if(!libraryError)applyLibrary(next);db.plans.push(next);db.currentId=next.id;}
    else db.currentId=db.plans[Math.min(index,db.plans.length-1)].id;
    selected=null;save();render();
    toast('已删除方案：'+label);
  };
  $('planSelect').onchange=e=>{stop();db.currentId=e.target.value;selected=null;save();render();};
  $('planName').oninput=e=>{const p=plan();p.name=e.target.value.trim()||'未命名排程方案';$('viewTitle').textContent=projectTitle(p);const option=$('planSelect').selectedOptions[0];if(option)option.textContent=p.name;save();};
  $('anchorInputs').onchange=$('firstAvailableInput').onchange=e=>{if(e.target.dataset.anchor){plan().settings.anchorDates[e.target.dataset.anchor]=e.target.value;mutate();}};
  for(const [id,key] of [['replanMode','replanMode'],['a1Select','a1Id']])$(id).onchange=e=>{plan().settings[key]=e.target.value;mutate();$('earliestA1').disabled=!plan().template||!plan().settings.a1Id;};
  $('run').onclick=()=>begin();$('earliestA1').onclick=()=>begin(true);$('cancel').onclick=()=>{stop();status('已停止计算，原已确认方案未变。');};
  $('acceptResult').onclick=accept;$('discardResult').onclick=()=>{stop();const p=plan();p.pending=p.pending?.beforeWeekEdits||null;save();render();status(p.pending?'已放弃调周，恢复拖动前的预览。':'已放弃预览，已确认版本未变。');};
  $('search').oninput=renderBoard;$('viewMode').onchange=renderBoard;
  $('collapseAll').onclick=()=>{const t=plan()?.template;if(t)collapsed=new Set([...t.lanes,...t.threads].map(x=>x.id));renderBoard();};$('expandAll').onclick=()=>{collapsed.clear();renderBoard();};
  function scrollWeek(date){if(!date)return;const board=$('board'),head=board.querySelector?.('[data-head-week="'+E.iso(E.week(E.parseDate(date)))+'"]');if(head){const left=board.querySelector('.row-name').getBoundingClientRect().width;board.scrollLeft+=head.getBoundingClientRect().left-board.getBoundingClientRect().left-left;}}
  function jump(toA1){const p=plan(),r=currentResult();if(!r)return;const target=toA1?p.template.events.find(e=>e.id===r.settings.a1Id):p.template.events.find(e=>e.dateMode==='anchor_input'&&/启动/.test(e.name));if(!target){toast('未找到对应日期');return;}$('viewMode').value='weeks';renderBoard();scrollWeek(r.run.dates[target.id]);$('board').scrollTop=0;}
  $('jumpStart').onclick=()=>jump(false);$('jumpA1').onclick=()=>jump(true);
  let drag=null,highlight=null;
  function highlightDrop(cell){if(highlight===cell)return;highlight?.classList.remove('drop-week');highlight=cell;cell?.classList.add('drop-week');}
  function dropCell(target){const cell=target.closest('td[data-week]');return drag&&cell?.dataset.thread===drag.threadId&&drag.planId===plan()?.id?cell:null;}
  $('board').ondragstart=ev=>{
    const chip=ev.target.closest('.event-chip'),p=plan(),e=p?.template?.events.find(x=>x.id===chip?.dataset.event);
    if(worker||!movable(p,currentResult(),e)){ev.preventDefault();return;}
    drag={id:e.id,threadId:e.threadId,planId:p.id};ev.dataTransfer.effectAllowed='move';ev.dataTransfer.setData('text/plain',e.code);
  };
  $('board').ondragover=ev=>{const cell=dropCell(ev.target);highlightDrop(cell);if(cell){ev.preventDefault();ev.dataTransfer.dropEffect='move';}};
  $('board').ondragleave=ev=>{if(highlight&&!highlight.contains(ev.relatedTarget))highlightDrop(null);};
  $('board').ondragend=()=>{drag=null;highlightDrop(null);};
  $('board').ondrop=ev=>{const cell=dropCell(ev.target),id=drag?.id;drag=null;highlightDrop(null);if(cell){ev.preventDefault();tryWeekMove(id,cell.dataset.week);}};
  $('board').onclick=e=>{if(e.target.closest('[data-setup]')){present(false);const field=$('anchorInputs').querySelector('input:not([value]), input[value=""]')||$('anchorInputs').querySelector('input');field?.focus();return;}if(e.target.closest('[data-import]')){$('importPlan').click();return;}const event=e.target.closest('[data-event]'),collapse=e.target.closest('[data-collapse]');if(event){selected=event.dataset.event;renderDetails();}else if(collapse){const id=collapse.dataset.collapse;collapsed.has(id)?collapsed.delete(id):collapsed.add(id);renderBoard();}};
  $('closeInspector').onclick=()=>{selected=null;$('inspector').classList.remove('open');renderDetails();};
  $('eventDetails').onclick=e=>{if(!selected)return;const p=plan();if(e.target.id==='lockEvent'){const date=$('lockDate').value;if(!date){toast('请选择锁定日期');return;}p.settings.locks[selected]=date;mutate();toast('锁定已保存，重新试排后生效');}if(e.target.id==='unlockEvent'){delete p.settings.locks[selected];mutate();toast('已解除人工锁定，锚点日期仍按左侧输入');}};
  $('historyList').onclick=e=>{const b=e.target.closest('[data-restore]');if(!b)return;const p=plan(),h=p.history.find(x=>x.id===b.dataset.restore);if(!h)return;stop();const errors=E.verify(p.template,h.settings,h.run.dates);if(errors.length){status('历史版本复核失败：'+errors.join('；'),'error');return;}p.settings=copy(h.settings);p.result=copy(h);p.pending=null;p.dirty=false;save();render();toast('已恢复历史版本');};
  $('exportPlan').onclick=()=>{const p=plan();if(!p?.template){toast('请先载入规则');return;}const out={...p};if(roles){out.template=roles.enrich(p.template);if(p.financialBaseTemplate)out.financialBaseTemplate=roles.enrich(p.financialBaseTemplate);out.fingerprint=fingerprint(out.template);}download(p.name+'_排程方案.json',JSON.stringify({format:'ipo-schedule-plan',version:1,exportedAt:new Date().toISOString(),plan:out},null,2));};
  $('importPlan').onchange=e=>fileJSON(e.target,(data)=>{
    if(data.format!=='ipo-schedule-plan'||data.version!==1||!data.plan?.template||!data.plan?.settings)throw new Error('请选择从排程器导出的方案 JSON 文件');
    const p=copy(data.plan),errors=E.validateTemplate(p.template);if(errors.length)throw new Error(errors.join('\n'));
    p.settings.anchorDates ||= {};p.settings.locks ||= {};p.settings.calendars ||= {};
    for(const r of [p.result,p.pending,p.pending?.beforeWeekEdits,...(p.history||[])].filter(Boolean)){if(!r.settings||!r.run?.dates||r.manualIds!=null&&!Array.isArray(r.manualIds))throw new Error('方案结果结构不完整');const issues=E.verify(p.template,r.settings,r.run.dates);if(issues.length)throw new Error('方案日期无法通过复核：'+issues.join('；'));}
    p.history=Array.isArray(p.history)?p.history.slice(-8):[];p.id=uid();p.name=(p.name||'导入方案')+' · 导入';p.fingerprint=fingerprint(p.template);stop();db.plans.push(p);db.currentId=p.id;selected=null;save();render();toast('已作为新方案导入，原方案保留');
  });
  $('exportCSV').onclick=()=>{const p=plan(),r=currentResult();if(!r){toast('请先生成日期');return;}const quote=v=>'"'+String(v??'').replace(/^[=+\-@]/,"'$&").replace(/"/g,'""')+'"';const rows=[['条线','线程','事件编码','事件名称','推荐日期','周一起日','日期状态','负责方','配合方','分工依据']];for(const e of p.template.events){const th=p.template.threads.find(x=>x.id===e.threadId),lane=p.template.lanes.find(x=>x.id===th.laneId);const role=assignment(e);rows.push([lane.name,th.name,e.code,e.name,r.run.dates[e.id],E.iso(E.week(E.parseDate(r.run.dates[e.id]))),dateLabel(r,e),role?.responsible.join("、"),role?.supporting.join("、"),role?roles.labels[role.basis]:"未指定"]);}download(p.name+'_日期表.csv','\ufeff'+rows.map(row=>row.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8');};
  function start(){
    const existed=db.plans.length>0;
    if(!db.plans.length){const p=blank();if(!libraryError)applyLibrary(p);db.plans.push(p);db.currentId=p.id;}
    if(!plan())db.currentId=db.plans[0].id;
    if(!plan().template&&!libraryError)applyLibrary(plan());
    render();if(!readError&&existed&&plan().template)$('saveState').textContent='已读取本机保存的方案';
  }
  function pristine(p){
    // 只有“刚建出来、一个字都没填”的方案才允许被云端快照静默替换。
    return !!p&&!p.result&&!p.pending&&!(p.history&&p.history.length)&&!p.settings.financialBaseDate&&!p.settings.financialCoverage&&p.template?.financialStrategy?.mode!=='staged'
      &&!Object.keys(p.settings.anchorDates||{}).length&&!Object.keys(p.settings.locks||{}).length;
  }
  async function refreshCloud(options={}){
    const quiet=!!options.quiet,upgradePristine=!!options.upgradePristine;
    if(libraryLoading)return;libraryLoading=true;
    try{
      let storage;try{storage=window.localStorage;}catch(e){/* Browser storage may be disabled. */}
      const result=await window.IPOLibraryCloud.load({config:window.IPO_CLOUD_CONFIG,engine:E,embedded:{rules:embedded.template,agenda:embedded.agenda,calendars:window.IPO_PUBLIC_HOLIDAYS},storage,fetcher:window.fetch.bind(window)});
      defaultRelease=result.release;defaultCalendars=historicalCalendars(result.data.calendars);
      defaultLibrary={template:result.data.rules,agenda:result.data.agenda,source:result.mode==='cloud'?'云端已发布事件库':result.mode==='cache'?'云端已发布缓存':'内置事件库兜底',release:copy(result.release)};
      if(!customLibrary&&!libraryError)library=copy(defaultLibrary);
      // 首屏是拿内置包先画出来的；云端到货后，只在空白方案上换成云端快照，动过的方案一律不碰。
      // 注意：只有真的来自云端（含本机缓存）才换。落到内置兜底时包没变，换了也没有意义，更不该提示“已切换到云端”。
      const fromCloud=result.mode==='cloud'||result.mode==='cache';
      const p=plan();
      if(upgradePristine&&fromCloud&&p&&p.ruleRelease===null&&!customLibrary&&!libraryError&&pristine(p)){
        applyLibrary(p);save();
        return;
      }
    }catch(e){if(!quiet)status('暂时无法刷新默认规则，沿用本机版本。','warning');}
    finally{libraryLoading=false;render();}
  }
  // 先用内置包把界面画出来（不再等云端），云端回来后再补上默认库并换掉空白方案的快照。
  start();
  if(window.IPOLibraryCloud)refreshCloud({quiet:true,upgradePristine:true});
})();

