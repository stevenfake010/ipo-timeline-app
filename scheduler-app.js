(() => {
  'use strict';
  const E=window.IPOScheduler, KEY='ipo-scheduler-plans-v1', LIBRARY_KEY='ipo-scheduler-default-library-v1';
  const $=id=>document.getElementById(id), copy=x=>JSON.parse(JSON.stringify(x));
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid=()=>typeof crypto.randomUUID==='function'?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2);
  const unitLabel=unit=>({business_day:'工作日',calendar_day:'自然日',calendar_month:'自然月'}[unit]||unit);
  let db={version:1,currentId:null,plans:[]}, worker=null, workerURL=null, generation=0, selected=null, collapsed=new Set(), toastTimer;
  let readError='';
  try { const raw=localStorage.getItem(KEY);if(raw){const parsed=JSON.parse(raw);if(parsed.version!==1||!Array.isArray(parsed.plans))throw new Error('方案存储格式无法识别');db=parsed;} }catch(e){readError='无法读取已有方案，未覆盖原存储。请导出当前工作后检查浏览器存储：'+e.message;}
  const reviewed=window.IPORuleRevision.revise(window.IPO_DRAFT_RULES,window.IPO_DRAFT_RULES).template;
  const embedded=window.IPOProspectusRevision.revise(reviewed,reviewed);
  let library={template:embedded.template,source:'内置最新事件库',agenda:embedded.agenda},libraryError='';
  try{const raw=localStorage.getItem(LIBRARY_KEY);if(raw){const saved=JSON.parse(raw),errors=E.validateTemplate(saved.template);if(errors.length)throw new Error(errors.join('；'));library=saved;}}
  catch(e){libraryError='本机事件库读取失败，原数据未覆盖：'+e.message;}
  function plan(){return db.plans.find(p=>p.id===db.currentId);}
  function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
  function status(text,kind=''){ $('status').textContent=text;$('status').className='status '+kind; }
  function save(){
    if(readError){$('saveState').textContent=readError;return;}
    try{localStorage.setItem(KEY,JSON.stringify(db));$('saveState').textContent='已保存本机 · '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});}
    catch(e){$('saveState').textContent='本机保存失败：请立即导出方案备份。';toast('本机空间不足或存储不可用，当前修改仅在内存中，请导出方案。');}
  }
  function blank(){return{id:uid(),name:'未命名排程方案',template:null,source:'',fingerprint:'',settings:{anchorDates:{},locks:{},calendars:copy(window.IPO_PUBLIC_HOLIDAYS),spreadWeeks:true,keepPrevious:true,preferWorkingDays:true,a1BusinessDaysOnly:true,timeBudgetMs:10000},result:null,pending:null,history:[],dirty:true};}
  function applyLibrary(p){const t=library.template;p.template=copy(t);p.source=library.source;p.fingerprint=fingerprint(t);p.conferenceAgenda=copy(library.agenda||[]);p.settings.a1Id=t.events.find(e=>e.dateMode==='anchor_input'&&/A1/i.test(e.name))?.id||'';}
  function newPlan(){if(libraryError){status(libraryError,'error');return;}stop();const p=blank();applyLibrary(p);db.plans.push(p);db.currentId=p.id;selected=null;save();render();}
  function currentResult(){return plan()?.pending||plan()?.result;}
  function mutate(){stop();const p=plan();p.pending=null;p.dirty=true;save();status(p.result?'设置已改变，下面仍是上次结果。请重新试排后确认新版本。':'设置已更新，请生成新的排程预览。','warning');renderPending();renderBoard();renderDetails();}
  function fingerprint(t){let h=2166136261;for(const c of JSON.stringify(t)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
  function effectiveCalendars(saved){const result=copy(window.IPO_PUBLIC_HOLIDAYS);for(const [name,c] of Object.entries(saved||{}))if(!c.builtin||!result[name])result[name]=copy(c);return result;}
  function loadRules(t,source){
    const errors=E.validateTemplate(t);if(errors.length)throw new Error(errors.join('\n'));
    stop();let p=plan();if(!p||p.template){p=blank();db.plans.push(p);db.currentId=p.id;}
    p.template=copy(t);p.source=source;p.fingerprint=fingerprint(t);p.name=(t.project.name||'IPO项目')+' · 排程方案';
    const a1=t.events.find(e=>e.dateMode==='anchor_input'&&/A1/i.test(e.name));p.settings.a1Id=a1?.id||'';
    selected=null;collapsed.clear();save();render();status('已复制 '+t.events.length+' 个事件。请填写锚点日期；原采集器未改动。');
  }
  function datesChanged(a,b){return Object.keys(b||{}).filter(id=>a?.[id]!==b[id]);}
  function render(){
    const p=plan();$('planSelect').innerHTML=db.plans.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');$('planSelect').value=p?.id||'';
    if(!p)return;
    $('planName').value=p.name;
    const t=p.template;$('eventCount').textContent=t?t.events.length+' 个事件':'未载入';
    $('snapshotInfo').textContent=t?`${p.source} · 快照 ${p.fingerprint} · ${t.threads.length} 个线程`:'独立复制规则，不改动采集器。';
    const anchors=t?.events.filter(e=>e.dateMode==='anchor_input')||[];
    $('anchorInputs').innerHTML=anchors.length?anchors.map(e=>`<label>${esc(e.name)}<input type="date" data-anchor="${esc(e.id)}" value="${esc(p.settings.anchorDates[e.id]||'')}"></label>`).join(''):'<p class="muted">载入规则后，填写项目日期。</p>';
    $('a1Select').innerHTML='<option value="">不指定</option>'+anchors.map(e=>`<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('');$('a1Select').value=p.settings.a1Id||'';
    $('a1BusinessDaysOnly').checked=p.settings.a1BusinessDaysOnly===true;
    $('spreadWeeks').checked=p.settings.spreadWeeks!==false;$('keepPrevious').checked=p.settings.keepPrevious!==false;
    $('preferWorkingDays').checked=p.settings.preferWorkingDays!==false;
    $('replanMode').value=p.settings.replanMode||'optimize';
    $('horizonStart').value=p.settings.horizonStart||'';$('horizonEnd').value=p.settings.horizonEnd||'';$('timeBudget').value=p.settings.timeBudgetMs||10000;
    $('calendarInfo').textContent=Object.entries(effectiveCalendars(p.settings.calendars)).map(([k,v])=>`${k}：${v.version}（${v.from} 至 ${v.to}）`).join('；');
    $('viewTitle').textContent=t?p.name:'把事件规则变成项目时间表';
    $('viewSubtitle').textContent=t?`${t.project.timezone||'Asia/Hong_Kong'} · 周一至周日 · 规则快照与采集器独立`:'输入锚点，再生成第一版推荐日期。';
    $('run').disabled=!t;$('earliestA1').disabled=!t||!p.settings.a1Id;
    $('conflicts').hidden=true;
    renderPending();renderBoard();renderHistory();renderDetails();
    if(readError||libraryError)status(readError||libraryError,'error');else if(p.dirty&&p.result)status('设置与已确认版本不同，当前表格是旧版结果。请重新试排。','warning');else if(currentResult())showResultStatus(currentResult().run);
  }
  function showResultStatus(run){status(run.message+'\n'+(run.warnings||[]).join('\n'),run.warnings?.length?'warning':'success');}
  function renderPending(){
    const p=plan(),pending=p?.pending;$('pendingBar').hidden=!pending;
    if(pending){const changed=datesChanged(p.result?.run.dates,pending.run.dates);$('pendingTitle').textContent=pending.settings.releaseAnchorId?'最早A1备选 · 待确认':'新排程预览 · 待确认';$('pendingText').textContent=`${changed.length} 个事件${p.result?'日期变化':'获得推荐日期'}。确认前不会替换已保存版本。`+(pending.settings.releaseAnchorId?` A1：${pending.run.dates[pending.settings.releaseAnchorId]}。`:'');}
  }
  function renderBoard(){
    const p=plan(),r=currentResult(),t=p?.template,term=$('search').value.trim().toLowerCase();
    if(!t||!r){$('summaryStats').innerHTML='';$('board').innerHTML=`<div class="empty"><div class="empty-icon">日</div><h3>${t?'规则已准备，等待项目日期':'无法载入事件库'}</h3><p>${t?'填写左侧锚点后，点击“生成 / 重新试排”。<br>所有时间安排将在独立方案中保存。':'请检查事件库数据，或在测试管理入口导入规则。'}</p></div>`;return;}
    const dates=r.run.dates,all=t.events.filter(e=>dates[e.id]),filtered=all.filter(e=>!term||(e.code+' '+e.name).toLowerCase().includes(term));
    const days=all.map(e=>E.parseDate(dates[e.id])),min=Math.min(...days),max=Math.max(...days),weeks=[];
    for(let w=E.week(min);w<=E.week(max);w+=7)weeks.push(w);
    const crowded=all.filter(e=>e.dateMode!=='anchor_input'&&all.some(x=>x.id!==e.id&&x.threadId===e.threadId&&E.week(E.parseDate(dates[x.id]))===E.week(E.parseDate(dates[e.id])))).length;
    $('summaryStats').innerHTML=`<div><strong>${all.length}</strong><span>已排事件</span></div><div><strong>${weeks.length}</strong><span>覆盖周次</span></div><div><strong>${crowded}</strong><span>同线程同周事件</span></div>`;
    const changed=new Set(datesChanged(p.result?.run.dates,dates));
    if($('viewMode').value!=='weeks'){
      const isChanges=$('viewMode').value==='changes';
      const rows=filtered.filter(e=>!isChanges||(p.pending&&changed.has(e.id))).sort((a,b)=>dates[a.id].localeCompare(dates[b.id])||a.code.localeCompare(b.code));
      $('board').innerHTML=`<table class="list-table"><thead><tr><th>事件</th><th>线程</th>${isChanges?'<th>原日期</th>':''}<th>推荐日期</th><th>状态</th></tr></thead><tbody>${rows.map(e=>`<tr><td><button data-event="${esc(e.id)}">${esc(e.code)} ${esc(e.name)}</button></td><td>${esc(t.threads.find(x=>x.id===e.threadId)?.name)}</td>${isChanges?`<td>${esc(p.result?.run.dates[e.id]||'—')}</td>`:''}<td>${dates[e.id]}</td><td>${r.settings.locks?.[e.id]?'人工锁定':e.dateMode==='anchor_input'?'锚点':'自动推荐'}</td></tr>`).join('')}</tbody></table>${rows.length?'':'<div class="empty">'+(isChanges?'没有待确认的日期变动。':'没有匹配的事件。')+'</div>'}`;return;
    }
    let html='<table class="timeline"><thead><tr><th class="row-name">条线 / 线程</th>'+weeks.map(w=>`<th>${E.iso(w).slice(5)} – ${E.iso(w+6).slice(5)}<br><small>${E.iso(w).slice(0,4)}</small></th>`).join('')+'</tr></thead><tbody>';
    for(const lane of t.lanes){
      const threads=t.threads.filter(th=>th.laneId===lane.id&&filtered.some(e=>e.threadId===th.id));if(!threads.length)continue;
      html+=`<tr class="lane-row"><td class="row-name"><button data-collapse="${esc(lane.id)}">${collapsed.has(lane.id)?'▸':'▾'} ${esc(lane.name)}</button></td><td colspan="${weeks.length}">${threads.length} 个线程</td></tr>`;
      if(collapsed.has(lane.id))continue;
      for(const th of threads){const es=filtered.filter(e=>e.threadId===th.id);html+=`<tr><td class="row-name"><button class="thread-toggle" data-collapse="${esc(th.id)}">${collapsed.has(th.id)?'▸':'▾'} ${esc(th.name)}<small>${es.length} 个事件</small></button></td>`;
        for(const w of weeks){const cell=es.filter(e=>E.week(E.parseDate(dates[e.id]))===w).sort((a,b)=>dates[a.id].localeCompare(dates[b.id])||a.code.localeCompare(b.code));
          html+='<td>'+(collapsed.has(th.id)?(cell.length?`<span class="muted">${cell.length} 项</span>`:''):cell.map(e=>`<button class="event-chip ${cell.length>1?'crowded':''} ${r.settings.locks?.[e.id]?'locked':''} ${e.dateMode==='anchor_input'?'anchor':''} ${selected===e.id?'selected':''} ${p.pending&&changed.has(e.id)?'changed':''}" data-event="${esc(e.id)}"><strong>${dates[e.id].slice(5)} · ${esc(e.code)}</strong>${esc(e.name)}</button>`).join(''))+'</td>';
        }html+='</tr>';
      }
    }
    $('board').innerHTML=html+'</tbody></table>';
  }
  function eventDetail(e,r){
    const p=plan(),dates=r.run.dates,cal=E.createCalendars(r.settings.calendars),rels=[];
    for(const to of p.template.events)for(const d of to.dependencies)if(to.id===e.id||d.predecessorEventId===e.id){const name=d.calendar==='inherit'?p.template.project.defaultCalendar||'hk':d.calendar,a=E.parseDate(dates[d.predecessorEventId]),b=E.parseDate(dates[to.id]),l=cal.add(a,d.minLag,d.unit,name),u=d.maxLag==null?Infinity:cal.add(a,d.maxLag,d.unit,name);rels.push({...d,toId:to.id,fromId:d.predecessorEventId,l,u,b,target:d.targetLag==null?null:cal.add(a,d.targetLag,d.unit,name),name});}
    const start=E.parseDate(r.run.horizon.start),end=E.parseDate(r.run.horizon.end),allowed=[];
    for(let day=start;day<=end;day++){
      if(r.settings.anchorDates[e.id]&&e.id!==r.settings.releaseAnchorId&&E.iso(day)!==r.settings.anchorDates[e.id])continue;
      if(r.settings.locks[e.id]&&E.iso(day)!==r.settings.locks[e.id])continue;
      if((r.settings.blockedDates||[]).includes(E.iso(day)))continue;
      if(r.settings.a1BusinessDaysOnly&&e.id===(r.settings.releaseAnchorId||r.settings.a1Id)&&!cal.get(p.template.project.defaultCalendar||'hk').isWorking(day))continue;
      if(rels.filter(x=>x.strength==='hard').every(x=>{const a=x.fromId===e.id?day:E.parseDate(dates[x.fromId]),b=x.toId===e.id?day:E.parseDate(dates[x.toId]);return b>=cal.add(a,x.minLag,x.unit,x.name)&&(x.maxLag==null||b<=cal.add(a,x.maxLag,x.unit,x.name));}))allowed.push(day);
    }
    return{rels,allowed};
  }
  function renderDetails(){
    const p=plan(),r=currentResult(),e=p?.template?.events.find(e=>e.id===selected);
    if(!e||!r){$('eventDetails').innerHTML='<p class="muted">点击时间表中的事件，查看日期依据、前后关系与人工锁定。</p>';return;}
    $('inspector').classList.add('open');
    const {rels,allowed}=eventDetail(e,r),byId=new Map(p.template.events.map(x=>[x.id,x]));
    const same=p.template.events.filter(x=>x.id!==e.id&&x.threadId===e.threadId&&E.week(E.parseDate(r.run.dates[x.id]))===E.week(E.parseDate(r.run.dates[e.id])));
    const collisionReasons=[...new Set((r.run.weekCollisions||[]).filter(x=>x.eventIds.includes(e.id)).map(x=>x.reason))];
    const outgoing=rels.filter(x=>x.fromId===e.id),incoming=rels.filter(x=>x.toId===e.id);
    const agenda=p.conferenceAgenda?.find(a=>a.eventCode===e.code);
    const agendaNames=codes=>codes.map(code=>{const item=p.template.events.find(x=>x.code===code);return esc(item?code+' '+item.name:code);}).join('；');
    $('eventDetails').innerHTML=`<small>${esc(e.code)} · ${esc(p.template.threads.find(x=>x.id===e.threadId)?.name)}</small><h3>${esc(e.name)}</h3><div class="detail-date">${r.run.dates[e.id]}</div><div class="detail-info">${e.dateMode==='anchor_input'?'项目锚点':r.settings.locks[e.id]?'人工锁定':'自动推荐'} · ${p.pending?'预览方案':'已确认方案'}<br>其他事件不动时可选 ${allowed.length} 天${allowed.length?`：${E.iso(allowed[0])} 至 ${E.iso(allowed.at(-1))}`:''}。${allowed.length&&allowed.at(-1)-allowed[0]+1!==allowed.length?'范围内有禁用日期，不是每一天都可选。':''}</div>
      <label>人工锁定日期<input type="date" id="lockDate" value="${esc(p.settings.locks[e.id]||r.run.dates[e.id])}"></label><div class="button-row"><button id="lockEvent">锁定并待重排</button><button id="unlockEvent">解除锁定</button></div><p class="hint">锁定不直接改动时间表，重新试排后生效。锚点请优先在左侧修改。</p>
      ${same.length?`<div class="calendar-notice">同线程同周：${same.map(x=>esc(x.code+' '+x.name)).join('；')}。${collisionReasons.length?collisionReasons.map(esc).join(' '):'错周是偏好，不能突破同日关系、锁定日期或硬区间。'}</div>`:''}
      ${agenda?`<h3>本次大会讨论安排</h3><p>${esc(agenda.purpose)}</p><p class="hint">会前材料：${agendaNames(agenda.inputs)}</p><p class="hint">会后推进：${agendaNames(agenda.outputs)}</p><p class="hint">议程是本版规则的业务映射；实际日期由下方前后关系共同约束。</p>`:''}
      <h3>前置条件 · ${incoming.length}</h3>${incoming.map(x=>ruleHTML(x,byId)).join('')||'<p class="hint">没有前置关系。</p>'}<h3>直接影响的后续事件 · ${outgoing.length}</h3>${outgoing.map(x=>ruleHTML(x,byId)).join('')||'<p class="hint">没有直接后续关系。</p>'}`;
  }
  function ruleHTML(x,byId){const ok=x.b>=x.l&&x.b<=x.u;return`<div class="rule ${ok?'':'warn'}"><span class="tag">${x.strength==='hard'?'硬条件':'软偏好'} · ${ok?'范围已满足':'偏好未满足'}</span><p>${esc(byId.get(x.fromId)?.code+' '+byId.get(x.fromId)?.name)} → ${esc(byId.get(x.toId)?.code+' '+byId.get(x.toId)?.name)}</p><p class="hint">间隔 ${x.minLag} / ${x.targetLag??'不设目标'} / ${x.maxLag??'不限'} ${unitLabel(x.unit)}<br>允许后置日：${E.iso(x.l)} 至 ${Number.isFinite(x.u)?E.iso(x.u):'不限'}<br>${x.target==null?'仅检查就绪顺序，不额外计目标等待。':`目标后置日：${E.iso(x.target)}；实际偏移 ${x.b-x.target} 个自然日`}</p></div>`;}
  function renderHistory(){const p=plan();$('historyList').innerHTML=p?.history.length?p.history.slice().reverse().map(h=>`<div class="history-item"><span>${esc(new Date(h.at).toLocaleString('zh-CN'))} · ${Object.keys(h.run.dates).length} 个事件</span><button data-restore="${esc(h.id)}">恢复此版本</button></div>`).join(''):'还没有已确认的排程。';}
  function stop(){generation++;if(worker){worker.terminate();worker=null;URL.revokeObjectURL(workerURL);workerURL=null;$('cancel').disabled=true;$('run').disabled=!plan()?.template;}}
  function begin(release=false){
    const p=plan();if(!p?.template)return;
    p.settings.calendars=effectiveCalendars(p.settings.calendars);
    stop();p.pending=null;save();renderPending();renderBoard();$('conflicts').hidden=true;
    const settings=copy(p.settings);settings.previousDates=p.result?.run.dates;
    if(release){if(!settings.a1Id){toast('请先指定A1锚点');return;}settings.releaseAnchorId=settings.a1Id;delete settings.locks[settings.a1Id];}
    else delete settings.releaseAnchorId;
    const token=p.id,requestGeneration=generation;
    try{
      workerURL=URL.createObjectURL(new Blob([E.workerSource],{type:'application/javascript'}));worker=new Worker(workerURL);
      $('cancel').disabled=false;$('run').disabled=true;status('正在本机计算；不会修改规则库或已确认版本。');
      worker.onmessage=event=>{
        if(requestGeneration!==generation)return;
        if(event.data.progress){status(event.data.progress.stage+'…');return;}
        const result=event.data.result;stop();if(plan()?.id!==token)return;
        if(result.status==='feasible'){
          const problems=E.verify(p.template,settings,result.dates);if(problems.length){showFailure({status:'invalid',errors:problems});return;}
          // Store compact diagnostics; the single-event movable range is recomputed on demand.
          for(const detail of Object.values(result.details||{}))delete detail.movableDates;
          p.pending={id:uid(),at:new Date().toISOString(),run:result,settings};save();render();showResultStatus(result);
        }else showFailure(result);
      };
      worker.onerror=event=>{if(requestGeneration!==generation)return;stop();status('计算任务失败，已确认方案未变：'+(event.message||'请使用支持本地后台计算的浏览器'),'error');};
      worker.postMessage({template:copy(p.template),settings});
    }catch(e){stop();status('无法启动本地计算：'+e.message+'。请用现代浏览器打开本地页面。','error');}
  }
  function showFailure(r){
    status((r.errors||['未能生成结果']).join('\n'),r.status==='unknown'?'warning':'error');
    const p=plan(),ids=new Set(r.conflict?.ruleIds||[]),items=[];
    const failed=p.template.events.find(e=>e.id===r.conflict?.eventId);
    for(const e of p.template.events){if(ids.has('date:'+e.id))items.push(`${e.code} ${e.name} 固定为 ${p.settings.locks[e.id]||p.settings.anchorDates[e.id]}`);for(const d of e.dependencies)if(ids.has(d.id)){const prev=p.template.events.find(x=>x.id===d.predecessorEventId);items.push(`${prev?.code} ${prev?.name} → ${e.code} ${e.name}：${d.minLag}–${d.maxLag??'不限'}${unitLabel(d.unit)}（${d.strength==='hard'?'硬条件':'软偏好'}）`);}}
    $('conflicts').hidden=false;$('conflicts').innerHTML=`<div class="conflict-box"><h3>${r.status==='infeasible'?'硬条件冲突（当前搜索范围内）':'需要检查输入或继续计算'}</h3><p>${failed?esc(failed.code+' '+failed.name)+'：':''}${esc(r.conflict?.message||'未生成新日期，原方案保持不变。')}</p>${items.length?'<ul>'+items.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':''}<p class="hint">这里是推导中涉及的条件集合，不保证是最小冲突集。可核对日期、扩大搜索范围，或试算释放A1的备选方案。软偏好不能修复硬条件矛盾。</p></div>`;
  }
  function accept(){const p=plan();if(!p?.pending)return;const r=p.pending;
    if(r.settings.releaseAnchorId){const id=r.settings.releaseAnchorId;p.settings.anchorDates[id]=r.run.dates[id];delete p.settings.locks[id];delete r.settings.releaseAnchorId;r.settings.anchorDates[id]=r.run.dates[id];}
    p.result=r;p.pending=null;p.dirty=false;delete p.result.settings.previousDates;
    p.history.push({id:r.id,at:r.at,settings:copy(r.settings),run:{...copy(r.run),details:{}}});p.history=p.history.slice(-8);save();render();toast('已确认新版本，原规则库未改变');}
  function download(name,content,type='application/json'){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function fileJSON(input,fn){try{const f=input.files[0];if(f){if(f.size>15*1024*1024)throw new Error('文件超过15MB，请检查文件类型');await fn(JSON.parse(await f.text()),f.name);}}catch(e){status(e.message,'error');toast('未导入：'+e.message);}finally{input.value='';}}
  $('exportRules').onclick=()=>download('当前事件规则库.json',JSON.stringify(library.template,null,2));
  $('importRules').onchange=e=>fileJSON(e.target,(t,name)=>{
    const errors=E.validateTemplate(t);if(errors.length)throw new Error(errors.join('；'));
    const same=['events','threads','lanes'].every(k=>JSON.stringify(t[k])===JSON.stringify(embedded.template[k]));
    const next={template:copy(t),source:'本机导入事件库 · '+name,agenda:same?copy(embedded.agenda):[]};
    try{localStorage.setItem(LIBRARY_KEY,JSON.stringify(next));}catch(err){throw new Error('无法保存事件库，原规则未更改：'+err.message);}
    library=next;libraryError='';status('事件库已更新，仅影响此浏览器之后新建的方案；已有方案与采集器数据未改变。','success');toast('事件库已保存，新建方案时生效');
  });
  $('newPlan').onclick=newPlan;
  $('copyPlan').onclick=()=>{stop();const p=copy(plan());p.id=uid();p.name+=' · 副本';p.pending=null;db.plans.push(p);db.currentId=p.id;save();render();};
  $('planSelect').onchange=e=>{stop();db.currentId=e.target.value;selected=null;save();render();};
  $('planName').oninput=e=>{const p=plan();p.name=e.target.value.trim()||'未命名排程方案';$('viewTitle').textContent=p.name;const option=$('planSelect').selectedOptions[0];if(option)option.textContent=p.name;save();};
  $('anchorInputs').onchange=e=>{if(e.target.dataset.anchor){plan().settings.anchorDates[e.target.dataset.anchor]=e.target.value;mutate();}};
  for(const [id,key] of [['spreadWeeks','spreadWeeks'],['keepPrevious','keepPrevious'],['preferWorkingDays','preferWorkingDays'],['replanMode','replanMode'],['a1BusinessDaysOnly','a1BusinessDaysOnly'],['horizonStart','horizonStart'],['horizonEnd','horizonEnd'],['a1Select','a1Id'],['timeBudget','timeBudgetMs']])$(id).onchange=e=>{plan().settings[key]=e.target.type==='checkbox'?e.target.checked:id==='timeBudget'?Number(e.target.value):e.target.value;mutate();$('earliestA1').disabled=!plan().template||!plan().settings.a1Id;};
  $('run').onclick=()=>begin();$('earliestA1').onclick=()=>begin(true);$('cancel').onclick=()=>{stop();status('已停止计算，原已确认方案未变。');};
  $('acceptResult').onclick=accept;$('discardResult').onclick=()=>{plan().pending=null;save();render();status('已放弃预览，已确认版本未变。');};
  $('search').oninput=renderBoard;$('viewMode').onchange=renderBoard;
  $('collapseAll').onclick=()=>{const t=plan()?.template;if(t)collapsed=new Set([...t.lanes,...t.threads].map(x=>x.id));renderBoard();};$('expandAll').onclick=()=>{collapsed.clear();renderBoard();};
  function jump(toA1){const p=plan(),r=currentResult();if(!r)return;const target=toA1?p.template.events.find(e=>e.id===p.settings.a1Id):p.template.events.find(e=>e.dateMode==='anchor_input'&&/启动/.test(e.name));if(!target){toast('未找到对应锚点');return;}$('viewMode').value='weeks';renderBoard();const first=Math.min(...Object.values(r.run.dates).map(d=>E.week(E.parseDate(d)))),offset=(E.week(E.parseDate(r.run.dates[target.id]))-first)/7;$('board').scrollLeft=offset*145;$('board').scrollTop=0;}
  $('jumpStart').onclick=()=>jump(false);$('jumpA1').onclick=()=>jump(true);
  $('board').onclick=e=>{const event=e.target.closest('[data-event]'),collapse=e.target.closest('[data-collapse]');if(event){selected=event.dataset.event;renderDetails();}else if(collapse){const id=collapse.dataset.collapse;collapsed.has(id)?collapsed.delete(id):collapsed.add(id);renderBoard();}};
  $('closeInspector').onclick=()=>{selected=null;$('inspector').classList.remove('open');renderDetails();};
  $('eventDetails').onclick=e=>{if(!selected)return;const p=plan();if(e.target.id==='lockEvent'){const date=$('lockDate').value;if(!date){toast('请选择锁定日期');return;}p.settings.locks[selected]=date;mutate();toast('锁定已保存，重新试排后生效');}if(e.target.id==='unlockEvent'){delete p.settings.locks[selected];mutate();toast('已解除人工锁定，锚点日期仍按左侧输入');}};
  $('historyList').onclick=e=>{const b=e.target.closest('[data-restore]');if(!b)return;const p=plan(),h=p.history.find(x=>x.id===b.dataset.restore);if(!h)return;stop();const errors=E.verify(p.template,h.settings,h.run.dates);if(errors.length){status('历史版本复核失败：'+errors.join('；'),'error');return;}p.settings=copy(h.settings);p.result=copy(h);p.pending=null;p.dirty=false;save();render();toast('已恢复历史版本');};
  $('exportPlan').onclick=()=>{const p=plan();if(!p?.template){toast('请先载入规则');return;}download(p.name+'_排程方案.json',JSON.stringify({format:'ipo-schedule-plan',version:1,exportedAt:new Date().toISOString(),plan:p},null,2));};
  $('importPlan').onchange=e=>fileJSON(e.target,(data)=>{
    if(data.format!=='ipo-schedule-plan'||data.version!==1||!data.plan?.template||!data.plan?.settings)throw new Error('不是有效的排程方案文件；事件信息JSON请在“导入规则”处导入');
    const p=copy(data.plan),errors=E.validateTemplate(p.template);if(errors.length)throw new Error(errors.join('\n'));
    p.settings.anchorDates ||= {};p.settings.locks ||= {};p.settings.calendars ||= {};
    for(const r of [p.result,p.pending,...(p.history||[])].filter(Boolean)){if(!r.settings||!r.run?.dates)throw new Error('方案结果结构不完整');const issues=E.verify(p.template,r.settings,r.run.dates);if(issues.length)throw new Error('方案日期无法通过复核：'+issues.join('；'));}
    p.history=Array.isArray(p.history)?p.history.slice(-8):[];p.id=uid();p.name=(p.name||'导入方案')+' · 导入';p.fingerprint=fingerprint(p.template);stop();db.plans.push(p);db.currentId=p.id;selected=null;save();render();toast('已作为新方案导入，原方案保留');
  });
  $('exportCSV').onclick=()=>{const p=plan(),r=currentResult();if(!r){toast('请先生成日期');return;}const quote=v=>'"'+String(v??'').replace(/^[=+\-@]/,"'$&").replace(/"/g,'""')+'"';const rows=[['条线','线程','事件编码','事件名称','推荐日期','周一起日','日期状态']];for(const e of p.template.events){const th=p.template.threads.find(x=>x.id===e.threadId),lane=p.template.lanes.find(x=>x.id===th.laneId);rows.push([lane.name,th.name,e.code,e.name,r.run.dates[e.id],E.iso(E.week(E.parseDate(r.run.dates[e.id]))),r.settings.locks?.[e.id]?'锁定':e.dateMode==='anchor_input'?'锚点':'推荐']);}download(p.name+'_日期表.csv','\ufeff'+rows.map(row=>row.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8');};
  $('calendarSample').onclick=()=>download('日历格式示例_需自行填入真实节假日.json',JSON.stringify({note:'仅为格式示例，空列表不代表实际无假期。填入完整资料后再导入。',calendars:{hk:{version:'请填写日历来源与版本',from:'2026-01-01',to:'2027-12-31',holidays:[],workingDays:[]},cn:{version:'请填写日历来源与版本',from:'2026-01-01',to:'2027-12-31',holidays:[],workingDays:[]}}},null,2));
  $('importCalendar').onchange=e=>fileJSON(e.target,(data)=>{if(!data.calendars||typeof data.calendars!=='object'||Array.isArray(data.calendars))throw new Error('缺少calendars日历对象');for(const [name,c] of Object.entries(data.calendars)){if(!['hk','cn','us','project'].includes(name))throw new Error('不支持的日历名称：'+name);if(!c.version||c.version.includes('请填写')||!Array.isArray(c.holidays)||!Array.isArray(c.workingDays))throw new Error('请填写真实日历来源版本及节假日/补班日数组，不能直接导入格式示例');const from=E.parseDate(c.from),to=E.parseDate(c.to);if(from>to)throw new Error('日历覆盖范围不正确');if((c.estimatedFrom&&!c.estimatedTo)||(!c.estimatedFrom&&c.estimatedTo))throw new Error('暂定区间须同时填写起止日期');if(c.estimatedFrom&&(E.parseDate(c.estimatedFrom)<from||E.parseDate(c.estimatedTo)>to||E.parseDate(c.estimatedFrom)>E.parseDate(c.estimatedTo)))throw new Error('暂定区间不在日历覆盖范围内');c.builtin=false;for(const d of [...c.holidays,...c.workingDays]){const day=E.parseDate(d);if(day<from||day>to)throw new Error('假期或补班日期超出该日历覆盖范围');}}plan().settings.calendars={...plan().settings.calendars,...copy(data.calendars)};mutate();render();toast('已载入用户提供的日历，请重新试排');});
  if(!db.plans.length){const p=blank();if(!libraryError)applyLibrary(p);db.plans.push(p);db.currentId=p.id;}
  if(!plan())db.currentId=db.plans[0].id;
  if(!plan().template&&!libraryError)applyLibrary(plan());
  render();
  if(!readError && plan().template)$('saveState').textContent='已读取本机保存的方案';
})();
