// UI 层回归测试：方案删除、界面收敛、财务模式与数据保护。
// 与 scheduler-cloud-tests.cjs 同一套做法：无第三方依赖，纯 node 直接运行。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('./scheduler-engine');
const seed=require('./scripts/export-library.cjs').build().data.rules;
const html=fs.readFileSync('scheduler.html','utf8');
const appSource=fs.readFileSync('scheduler-app.js','utf8');

let passed=0;
function test(name,fn){fn();passed++;console.log('PASS',name);}

// ---------- 静态检查 ----------
test('JS 引用的元素 id 都存在于 scheduler.html',()=>{
  const htmlIds=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
  const used=new Set([...appSource.matchAll(/\$\(.([A-Za-z0-9_]+).\)/g)].map(m=>m[1]));
  const dynamic=new Set(['lockDate','overseasDecision']); // 事件详情面板运行时生成
  const missing=[...used].filter(id=>!htmlIds.has(id)&&!dynamic.has(id));
  assert.deepEqual(missing,[],'缺少元素：'+missing.join(', '));
});

test('用户页面不含后台管理、调试开关和版本标记',()=>{
  for(const id of ['snapshotInfo','timeBudget','importRules','refreshCloud','preferWorkingDays','a1BusinessDaysOnly','keepPrevious','spreadWeeks'])assert(!html.includes('id="'+id+'"'),id);
  assert(!html.includes('测试阶段'));assert(!html.includes('单事件调周版'));
});

// ---------- 行为检查 ----------
function plan(id,name,withTemplate){
  return {id,name,source:'内置事件库快照',fingerprint:'fp-'+id,
    template:withTemplate?JSON.parse(JSON.stringify(seed)):null,
    settings:{anchorDates:{},locks:{},calendars:{},spreadWeeks:true,keepPrevious:true,preferWorkingDays:true,a1BusinessDaysOnly:true},
    result:null,pending:null,history:[],dirty:true};
}

function boot(db,cloud,workerGlobals={}){
  const els={};
  for(const [,name] of html.matchAll(/\bid="([^"]+)"/g)){
    els[name]={value:'',innerHTML:'',textContent:'',checked:false,hidden:false,disabled:false,className:'',
      attrs:{},setAttribute(k,v){this.attrs[k]=v;},classList:{add(){},remove(){}},selectedOptions:[{}],dataset:{},files:[]};
  }
  const state={};
  if(db!==undefined)state['ipo-scheduler-plans-v1']=JSON.stringify(db);
  const storage={getItem:k=>state[k]??null,setItem:(k,v)=>{state[k]=v;},removeItem:k=>{delete state[k];}};
  const window={IPOScheduler:E,IPOFinancialPlanning:require('./scheduler-financial-planning'),IPO_CLOUD_CONFIG:{enabled:!!cloud},confirm:()=>true,localStorage:storage,
    fetch:async()=>{throw new Error('测试环境不联网');}};
  if(cloud)window.IPOLibraryCloud=cloud;
  for(const [name,file] of [['IPORuleRevision','scheduler-rule-revision'],['IPOProspectusRevision','scheduler-prospectus-revision'],
    ['IPOFeedbackRevision','scheduler-feedback-revision'],['IPOBatch2Revision','scheduler-feedback-batch2'],
    ['IPOProspectusGrouping','scheduler-prospectus-grouping'],['IPOMeetingCycle','scheduler-meeting-cycle'],
    ['IPOFlexiblePlanning','scheduler-flexible-planning'],['IPO_PUBLIC_HOLIDAYS','scheduler-public-holidays']]){
    window[name]=require('./'+file);
  }
  const draft={window:{}};
  vm.runInNewContext(fs.readFileSync('scheduler-draft.js','utf8'),draft);
  window.IPO_DRAFT_RULES=draft.window.IPO_DRAFT_RULES;
  const context={window,document:{getElementById:id=>els[id],createElement:()=>({click(){},remove(){}}),body:{appendChild(){}}},localStorage:storage,setTimeout,clearTimeout,...workerGlobals,
    crypto:{randomUUID:(()=>{let n=0;return()=>'new-'+(++n);})()}};
  vm.createContext(context);
  vm.runInContext(appSource,context);
  const read=()=>JSON.parse(state['ipo-scheduler-plans-v1']||'null');
  return {els,state,window,read};
}

test('调周只改一个日期，失败不写入；放弃恢复原预览，采用后写入历史',()=>{
  const p=plan('p','调周',true);
  const event=(id,fixed,from)=>({id,name:id,code:id,threadId:'t',dateMode:fixed?'anchor_input':'calculated',dependencies:from?[{id:from+id,predecessorEventId:from,minLag:1,targetLag:null,maxLag:null,unit:'calendar_day',calendar:'inherit',strength:'hard'}]:[]});
  p.template={project:{defaultCalendar:'hk',calculatedWorkingDaysOnly:true},lanes:[{id:'l',name:'l'}],threads:[{id:'t',laneId:'l',name:'t'}],events:[event('s',true),event('x',false,'s'),event('y',false,'x'),event('a',true,'y')]};
  Object.assign(p.settings,{anchorDates:{s:'2026-07-06',a:'2026-08-03'},a1Id:'a',horizonStart:'2026-07-06',horizonEnd:'2026-08-03'});
  const dates={...p.settings.anchorDates,x:'2026-07-14',y:'2026-07-24'};
  p.pending={id:'first',at:'2026-07-01',run:{status:'feasible',dates,horizon:{start:p.settings.horizonStart,end:p.settings.horizonEnd}},settings:p.settings};
  const original=JSON.parse(JSON.stringify(p.pending)),initial={version:1,plans:[p],currentId:p.id};
  class Worker {terminate(){} postMessage({template,settings,weekMove:m}){this.onmessage({data:{result:E.moveEventWeek(template,settings,m.dates,m.id,m.week)}});}}
  const box=boot(initial,null,{Worker,Blob,URL}),b=box.els.board;
  box.els.viewMode.value='weeks';box.els.viewMode.onchange();
  assert(b.innerHTML.includes('draggable="true"'));assert(b.innerHTML.includes('data-week="2026-07-27"'));
  function drag(week){b.ondragstart({target:{closest:()=>({dataset:{event:'x'}})},dataTransfer:{setData(){}}});b.ondrop({target:{closest:()=>({dataset:{thread:'t',week}})},preventDefault(){}});}
  drag('2026-07-27');assert.deepEqual(box.read(),initial);
  drag('2026-07-20');let q=box.read().plans[0];assert.deepEqual(q.pending.run.dates,{...dates,x:'2026-07-21'});assert.deepEqual(q.pending.beforeWeekEdits,original);
  drag('2026-07-27');assert.deepEqual(box.read().plans[0],q);
  drag('2026-07-06');assert.deepEqual(box.read().plans[0].pending.beforeWeekEdits,original);
  box.els.discardResult.onclick();assert.deepEqual(box.read().plans[0].pending,original);
  drag('2026-07-20');box.els.acceptResult.onclick();q=box.read().plans[0];assert.equal(q.pending,null);assert.deepEqual(q.result.run.dates,{...dates,x:'2026-07-21'});assert.deepEqual(q.settings.locks,{});assert(!('beforeWeekEdits' in q.result));assert.deepEqual(q.history[0].run.dates,q.result.run.dates);
});

test('旧方案展示负责方；清单、检索和导出读取相同分工且不改原方案',()=>{
  const p=plan('roles','已有排程',true);
  const [model,audit]=['EVT-040','EVT-027'].map(code=>{
    const {responsibility,...record}=seed.events.find(e=>e.code===code);return {...record,dependencies:[]};
  });
  p.template={project:seed.project,threads:seed.threads,lanes:seed.lanes,events:[model,audit]};
  p.result={run:{dates:{[model.id]:'2026-07-08',[audit.id]:'2026-07-07'},horizon:{start:'2026-07-06',end:'2026-07-10'}},settings:p.settings};
  const original={version:1,currentId:p.id,plans:[p]},files=[];
  const box=boot(original,null,{Blob:class{constructor(parts){this.text=parts.join('');}},URL:{createObjectURL:b=>(files.push(b.text),'mock'),revokeObjectURL(){}}});
  const els=box.els;els.viewMode.value='list';els.viewMode.onchange();
  assert(els.board.innerHTML.includes('<th>负责方</th>'));assert(els.board.innerHTML.includes('保荐人'));
  els.search.value='审计师';els.search.oninput();assert(els.board.innerHTML.includes(audit.code));assert(!els.board.innerHTML.includes(model.code));
  els.board.onclick({target:{closest:s=>s==='[data-event]'?{dataset:{event:model.id}}:null}});
  assert(els.eventDetails.innerHTML.includes('负责方：</strong>保荐人'));assert(els.eventDetails.innerHTML.includes('配合方：公司、审计师'));
  els.exportCSV.onclick();assert(files[0].includes('"负责方","配合方","分工依据"'));assert(files[0].includes('"保荐人","公司、审计师","案例分工"'));
  els.exportPlan.onclick();const exported=JSON.parse(files[1]).plan;
  assert.deepEqual(exported.template.events[0].responsibility.responsible,['保荐人']);assert.deepEqual(exported.result,p.result);assert.deepEqual(box.read(),original);
});

test('演示切换不修改方案，未排程时隐藏结果工具',()=>{
  const original={version:1,currentId:'p',plans:[plan('p','演示项目',true)]},box=boot(original);
  assert.equal(box.els.boardTools.hidden,true);assert.equal(box.els.resultNotes.hidden,true);
  box.els.presentation.onclick();assert.equal(box.els.presentation.attrs['aria-pressed'],'true');
  box.els.presentation.onclick();assert.equal(box.els.presentation.attrs['aria-pressed'],'false');
  assert.deepEqual(box.read(),original);
});

test('载入已有方案时存储一字不动',()=>{
  const db={version:1,currentId:'p1',plans:[plan('p1','方案甲',true),plan('p2','方案乙',true)]};
  const before=JSON.stringify(db);
  const box=boot(db);
  assert.equal(box.state['ipo-scheduler-plans-v1'],before,'初始化不应改写已存方案');
});

test('删除有二次确认：取消则不删',()=>{
  const box=boot({version:1,currentId:'p1',plans:[plan('p1','方案甲',true),plan('p2','方案乙',true)]});
  box.window.confirm=()=>false;
  box.els.deletePlan.onclick();
  assert.equal(box.read().plans.length,2);
});

test('删除当前方案后切到相邻方案',()=>{
  const box=boot({version:1,currentId:'p1',plans:[plan('p1','方案甲',true),plan('p2','方案乙',true)]});
  box.els.deletePlan.onclick();
  const db=box.read();
  assert.equal(db.plans.length,1);
  assert.equal(db.plans[0].id,'p2');
  assert.equal(db.currentId,'p2','currentId 必须指向仍存在的方案');
  assert.ok(box.els.planSelect.innerHTML.includes('方案乙'),'下拉框应只剩剩余方案');
});

test('删除最后一个方案时自动补空白方案',()=>{
  const box=boot({version:1,currentId:'only',plans:[plan('only','唯一方案',true)]});
  box.els.deletePlan.onclick();
  const db=box.read();
  assert.equal(db.plans.length,1,'应自动补一个方案，避免空态');
  assert.notEqual(db.plans[0].id,'only');
  assert.equal(db.currentId,db.plans[0].id);
  assert.ok(db.plans[0].template&&db.plans[0].template.events.length>0,'新方案应已套用事件库');
});

test('没有当前方案时点击删除只提示、不抛错',()=>{
  const box=boot({version:1,currentId:'',plans:[plan('p1','方案甲',true)]});
  assert.doesNotThrow(()=>box.els.deletePlan.onclick());
  assert.equal(box.read().plans.length,1,'不应误删方案');
});

test('旧方案切换财务模式创建副本，原规则/日期/日历不改',()=>{
  const old=plan('old','旧方案',true);old.settings.anchorDates[seed.events.find(e=>e.code==='EVT-002').id]='2024-10-21';
  old.settings.calendars.hk={version:'用户日历'};old.settings.preferWorkingDays=false;
  const original=JSON.stringify(old),box=boot({version:1,currentId:'old',plans:[old]});
  box.els.financialMode.onchange({target:{value:'staged'}});
  let db=box.read(),p=db.plans.find(p=>p.id===db.currentId);
  assert.equal(JSON.stringify(db.plans.find(p=>p.id==='old')),original);assert.equal(db.plans.length,2);
  assert.equal(p.template.events.length,171);assert.equal(p.template.financialStrategy.mode,'staged');assert.equal(p.result,null);assert.equal(p.history.length,0);
  assert.deepEqual(p.settings.anchorDates,old.settings.anchorDates);assert.deepEqual(p.settings.calendars,old.settings.calendars);assert.equal(p.settings.preferWorkingDays,false);
  box.els.run.onclick();assert.match(box.els.status.textContent,/请填写固定锚点/);
  const stagedId=p.id;box.els.financialMode.onchange({target:{value:'complete'}});db=box.read();p=db.plans.find(p=>p.id===db.currentId);
  assert.equal(p.template.events.length,165);assert(db.plans.find(p=>p.id===stagedId));
  assert(!p.template.events.some(e=>e.code==='EVT-163'));assert(!JSON.stringify(p.template).includes('finance-v1-EVT-168'));
});

// ---------- 首屏体验：不等云端，也不覆盖已动过的方案 ----------
test('旧财务策略显式升级为副本，同一模式也可更新，旧方案不变',()=>{
  const F=require('./scheduler-financial-planning'),old=plan('v1','旧两阶段',true);
  old.financialBaseTemplate=JSON.parse(JSON.stringify(seed));old.template=F.create(seed,'staged');old.template.financialStrategy.revision='2026-11-02-finance-v1';
  old.settings.financialBaseDate='2023-12-31';const original=JSON.stringify(old),box=boot({version:1,currentId:'v1',plans:[old]});
  assert.equal(box.els.refreshFinancial.hidden,false);box.els.refreshFinancial.onclick();const db=box.read();assert.equal(JSON.stringify(db.plans.find(p=>p.id==='v1')),original);
  assert.equal(db.plans.length,2);assert.equal(db.plans.find(p=>p.id===db.currentId).template.financialStrategy.revision,F.VERSION);
  assert.equal(box.els.refreshFinancial.hidden,true);
});

async function testAsync(name,fn){await fn();passed++;console.log('PASS',name);}
test('网络安全开关及境外需求确认创建副本，保留旧方案和当前财务模式',()=>{
  const F=require('./scheduler-financial-planning'),old=plan('options','选项方案',true);
  old.financialBaseTemplate=JSON.parse(JSON.stringify(seed));old.template=F.create(seed,'staged');old.settings.financialBaseDate='2023-12-31';
  const original=JSON.stringify(old),box=boot({version:1,currentId:'options',plans:[old]});
  box.els.cybersecurity.onchange({target:{checked:true}});
  let db=box.read(),p=db.plans.find(p=>p.id===db.currentId);
  assert.equal(JSON.stringify(db.plans.find(p=>p.id==='options')),original);assert.equal(p.template.events.length,179);assert.equal(p.template.financialStrategy.mode,'staged');
  assert.equal(p.conferenceAgenda[2].inputs.includes('EVT-019'),true);
  const cyberId=p.id,cyberOriginal=JSON.stringify(p);
  box.els.eventDetails.onchange({target:{id:'overseasDecision',value:'no'}});
  db=box.read();p=db.plans.find(p=>p.id===db.currentId);
  assert.equal(JSON.stringify(db.plans.find(p=>p.id===cyberId)),cyberOriginal);assert.equal(p.template.events.length,174);
  assert(p.template.events.some(e=>e.code==='EVT-198'));assert(!p.template.events.some(e=>e.code==='EVT-199'));assert(p.template.executionOptions.cybersecurity);
  box.els.cybersecurity.onchange({target:{checked:false}});db=box.read();p=db.plans.find(p=>p.id===db.currentId);
  assert.equal(p.template.events.length,166);assert.equal(p.template.executionOptions.overseasRequired,false);assert(!p.template.events.some(e=>e.code==='EVT-204'));
  assert.deepEqual(E.validateTemplate(p.template),[]);
});
const CAL={version:'测试日历',from:'2026-01-01',to:'2027-12-31',holidays:[],workingDays:[]};
function cloudStub(version,tag){
  return {load:async()=>{
    await new Promise(r=>setTimeout(r,20));
    return {mode:'cloud',release:{id:'rel-'+tag,version,min_engine_version:'0.10.0'},data:{rules:seed,agenda:[],calendars:{hk:CAL,cn:CAL,us:CAL}}};
  }};
}

(async()=>{
  await testAsync('首屏立即用内置包渲染，不等云端返回',async()=>{
    const box=boot(undefined,cloudStub('cloud-v1','1'));
    // boot() 内 vm 已同步执行完毕：此刻应已挂上事件库，而不是“未载入”空壳
    assert.ok(box.els.summaryStats.innerHTML.includes('<strong>'+(seed.events.length+36)+'</strong><span>事件</span>'));
    assert.ok(box.els.planSelect.innerHTML.includes('未命名排程方案'),'应已出现当前方案');
  });

  await testAsync('云端返回后，空白方案被升级到云端快照',async()=>{
    const box=boot(undefined,cloudStub('cloud-v1','1'));
    await new Promise(r=>setTimeout(r,120));
    const p=box.read().plans[0];
    assert.equal(p.ruleRelease.id,'rel-1','空白方案应换成云端发布');
    assert.equal(p.template.events.length,seed.events.length+36);
  });

  await testAsync('云端返回后，已填锚点的方案不动',async()=>{
    const filled=plan('keep','已填锚点',true);
    filled.ruleRelease=null;filled.settings.anchorDates={e0:'2026-11-02'};
    const box=boot({version:1,currentId:'keep',plans:[filled]},cloudStub('cloud-v2','2'));
    const before=box.state['ipo-scheduler-plans-v1'];
    await new Promise(r=>setTimeout(r,120));
    assert.equal(box.state['ipo-scheduler-plans-v1'],before,'动过的方案不应被云端替换');
  });

  await testAsync('只填了首批基准日、尚未填可用日，也不能被云端覆盖',async()=>{
    const box=boot(undefined,cloudStub('cloud-v3','3'));
    box.els.financialMode.onchange({target:{value:'staged'}});
    box.els.financialBaseDate.onchange({target:{value:'2023-12-31'}});
    const before=box.state['ipo-scheduler-plans-v1'];
    await new Promise(r=>setTimeout(r,120));
    assert.equal(box.state['ipo-scheduler-plans-v1'],before);
    assert.equal(box.read().plans.find(p=>p.id===box.read().currentId).template.financialStrategy.mode,'staged');
  });

  await testAsync('云端落到内置兜底时不假装切换、不弹提示',async()=>{
    const builtin={load:async()=>{await new Promise(r=>setTimeout(r,20));
      return {mode:'builtin',release:null,data:{rules:seed,agenda:[],calendars:{hk:CAL,cn:CAL,us:CAL}}};}};
    const box=boot(undefined,builtin);
    await new Promise(r=>setTimeout(r,120));
    assert.ok(box.els.summaryStats.innerHTML.includes('<strong>'+(seed.events.length+36)+'</strong><span>事件</span>'),'兜底时界面照常可用');
    assert.equal(box.read(),null,'兜底不写入本地方案');
    assert.ok(!String(box.els.toast.textContent).includes('已切换到云端'),'不应提示已切换到云端');
  });

  console.log('\n'+passed+' 组 UI 测试通过');
})();

