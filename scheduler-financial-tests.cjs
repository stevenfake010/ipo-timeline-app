const assert=require('node:assert/strict'),E=require('./scheduler-engine'),F=require('./scheduler-financial-planning');
const base=require('./scripts/export-library.cjs').build().data.rules,clone=x=>JSON.parse(JSON.stringify(x));
const before=JSON.stringify(base),full=F.create(base),staged=F.create(base,'staged');
assert.equal(JSON.stringify(base),before);assert.equal(full.events.length,130);assert.equal(staged.events.length,136);
for(const t of [full,staged])assert.deepEqual(E.validateTemplate(t),[]);
const by=t=>new Map(t.events.map(e=>[e.code,e]));
function dep(t,a,b){const m=by(t);return m.get(b).dependencies.find(d=>d.predecessorEventId===m.get(a).id);}
assert(!dep(full,'EVT-001','EVT-027'));assert(dep(full,'EVT-162','EVT-027'));
assert(dep(full,'EVT-162','EVT-040'));assert(dep(staged,'EVT-163','EVT-040'));
assert(dep(staged,'EVT-162','EVT-042'));assert(dep(staged,'EVT-163','EVT-028'));assert(!dep(staged,'EVT-027','EVT-028'));
assert(dep(staged,'EVT-165','EVT-036'));assert(dep(staged,'EVT-165','EVT-030'));assert(dep(staged,'EVT-168','EVT-085'));
assert(!dep(staged,'EVT-041','EVT-042'));assert(dep(staged,'EVT-040','EVT-042'));assert(dep(staged,'EVT-041','EVT-043'));
assert(dep(staged,'EVT-003','EVT-134'));assert.equal(dep(staged,'EVT-122','EVT-134').unit,'calendar_month');
console.log('PASS 模式编译、原库不变、模型数据前置、补充尽调闭环、既有期限保留');
const colliding=clone(base);colliding.events.push({...clone(colliding.events[0]),code:'EVT-162',id:'custom-event'});assert(!F.supported(colliding));assert.throws(()=>F.create(colliding));
function settings(t,{start='2024-10-21',a1='2025-04-10',end='2024-12-31',available='2025-02-24',first='2024-12-02',budget=2500}={}){
 const m=by(t),dates={'EVT-002':start,'EVT-003':a1,'EVT-153':end,'EVT-162':available};if(t.financialStrategy.mode==='staged')dates['EVT-163']=first;
 return{anchorDates:Object.fromEntries(Object.entries(dates).map(([c,d])=>[m.get(c).id,d])),locks:{},financialBaseDate:'2023-12-31',a1Id:m.get('EVT-003').id,calendars:require('./scheduler-public-holidays'),spreadWeeks:true,preferWorkingDays:true,a1BusinessDaysOnly:true,keepPrevious:false,timeBudgetMs:budget,horizonStart:start,horizonEnd:a1};
}
for(const t of [full,staged]){
 const s=settings(t),missing=clone(s);delete missing.anchorDates[t.financialStrategy.fullAnchorId];assert.equal(E.solve(t,missing).status,'invalid');
 assert.throws(()=>E.compile(t,{...s,releaseAnchorId:t.financialStrategy.fullAnchorId}));
 assert(E.verify(t,missing,{}).some(x=>x.includes('固定锚点')));
 const bad=clone(t);bad.financialStrategy.fullAnchorId='missing';assert(E.validateTemplate(bad).length);
}
const inverted=settings(staged,{first:'2025-03-01'});assert.equal(E.solve(staged,inverted).status,'invalid');
assert.equal(E.solve(staged,{...settings(staged),financialBaseDate:''}).status,'invalid');
assert.equal(E.solve(staged,{...settings(staged),financialBaseDate:'2024-02-30'}).status,'invalid');
assert.equal(E.solve(staged,{...settings(staged),financialBaseDate:'2025-01-31'}).status,'invalid');
assert.equal(E.solve(staged,{...settings(staged,{first:'2025-02-01'}),financialBaseDate:'2025-01-01'}).status,'invalid');
assert.doesNotThrow(()=>E.compile(staged,{...settings(staged),financialBaseDate:'2024-12-02'}));
assert.doesNotThrow(()=>E.compile(staged,settings(staged,{first:'2025-02-24'})));
assert.equal(E.solve(full,settings(full,{available:'2024-12-20'})).status,'infeasible');
console.log('PASS 固定锚点必填、不能释放、日期顺序/同日、首批基准日及可用日边界');
for(const [name,t,opts]of [
 ['complete-short',full,{a1:'2025-02-28',available:'2025-01-06'}],
 ['staged-medium',staged,{}],
 ['staged-late-data',staged,{a1:'2025-06-26',available:'2025-05-12'}],
 ['complete-long',full,{a1:'2025-06-26',available:'2025-02-24'}]
]){
 const s=settings(t,opts),r=E.solve(t,s);assert.equal(r.status,'feasible',name+': '+JSON.stringify(r.errors||r.conflict));assert.deepEqual(E.verify(t,s,r.dates),[]);
 for(const [id,d]of Object.entries(s.anchorDates))assert.equal(r.dates[id],d);
 const m=by(t);for(const c of ['EVT-042','EVT-044','EVT-030'])assert(r.dates[m.get(c).id]>=s.anchorDates[t.financialStrategy.fullAnchorId]);
 if(t===staged){assert(r.dates[m.get('EVT-040').id]<s.anchorDates[t.financialStrategy.fullAnchorId],'模型应能够先行开展');assert(r.dates[m.get('EVT-084').id]<s.anchorDates[t.financialStrategy.fullAnchorId],'首批走访应能够先开展');
  for(const c of ['EVT-036','EVT-165','EVT-167','EVT-168','EVT-085'])assert(r.dates[m.get(c).id]>=s.anchorDates[t.financialStrategy.fullAnchorId]);
  const broken={...r.dates,[m.get('EVT-042').id]:'2025-02-23'};assert(E.verify(t,s,broken).length);
  const cal=E.createCalendars(s.calendars),data=E.parseDate(s.anchorDates[t.financialStrategy.fullAnchorId]);
  for(const [code,min]of [['EVT-036',8],['EVT-030',8],['EVT-168',7],['EVT-085',7]])assert(E.parseDate(r.dates[m.get(code).id])>=cal.add(data,min,'business_day','hk'),code+'不能在数据到位当周草率收尾');
  if(name==='staged-late-data'){
    const codes=['EVT-027','EVT-164','EVT-165','EVT-030','EVT-036','EVT-042','EVT-043','EVT-044','EVT-166','EVT-167','EVT-168'];
    const weeks=new Set(codes.map(c=>E.week(E.parseDate(r.dates[m.get(c).id]))));assert(weeks.size>=3,'宽松情况下完整数据更新应有多轮处理节奏');
    console.log('PASS 晚到数据的更新链覆盖周次',weeks.size,Object.fromEntries(codes.map(c=>[c,r.dates[m.get(c).id]])));
  }
 }
 console.log('PASS '+name,JSON.stringify({model:r.dates[m.get('EVT-040').id],fullData:s.anchorDates[t.financialStrategy.fullAnchorId],modelUpdate:r.dates[m.get('EVT-042').id],visit:r.dates[m.get('EVT-084').id],visitComplete:r.dates[m.get('EVT-085').id]}));
}
for(const t of [full,staged]){
 const s=settings(t,{a1:'2025-02-28',available:'2025-02-27'}),r=E.solve(t,s);assert.equal(r.status,'infeasible',JSON.stringify(r));assert(!r.dates);
 console.log('PASS 数据过晚明确冲突，不移动用户日期：'+t.financialStrategy.mode);
}
const earliestSettings=settings(staged,{budget:1500}),earliest=E.solve(staged,{...earliestSettings,releaseAnchorId:earliestSettings.a1Id});
assert.equal(earliest.status,'feasible');assert.deepEqual(E.verify(staged,{...earliestSettings,releaseAnchorId:earliestSettings.a1Id},earliest.dates),[]);
for(const id of [staged.financialStrategy.firstAnchorId,staged.financialStrategy.fullAnchorId])assert.equal(earliest.dates[id],earliestSettings.anchorDates[id]);
console.log('PASS 最早A1试算也保留两项财务锚点');
const invalid=clone(staged);invalid.planningPolicy.anchorRelativeTargets[invalid.events[0].id]={anchorEventId:'missing',lag:3,unit:'business_day',calendar:'inherit'};assert(E.validateTemplate(invalid).length);
// The preference follows the data date, not an absolute percentage of the project window.
const toy={project:{defaultCalendar:'hk'},lanes:[{id:'l',name:'线'}],threads:[{id:'th',name:'线程',laneId:'l'}],events:[
 {id:'start',code:'S',name:'启动',threadId:'th',dateMode:'anchor_input',dependencies:[]},
 {id:'data',code:'D',name:'数据可用',threadId:'th',dateMode:'anchor_input',dependencies:[{id:'sd',predecessorEventId:'start',minLag:0,targetLag:null,maxLag:null,unit:'calendar_day',calendar:'inherit',strength:'hard'}]},
 {id:'work',code:'W',name:'更新完成',threadId:'th',dateMode:'calculated',dependencies:[{id:'dw',predecessorEventId:'data',minLag:3,targetLag:5,maxLag:null,unit:'business_day',calendar:'inherit',strength:'hard'}]},
 {id:'finish',code:'F',name:'结束',threadId:'th',dateMode:'anchor_input',dependencies:[{id:'wf',predecessorEventId:'work',minLag:0,targetLag:null,maxLag:null,unit:'calendar_day',calendar:'inherit',strength:'hard'}]}
],planningPolicy:{version:1,startEventId:'start',finishEventId:'finish',meetingEventIds:[],progress:{work:.1},layoutWeight:3,ordinaryTargetWeight:.2,anchorRelativeTargets:{work:{anchorEventId:'data',lag:10,unit:'business_day',calendar:'hk'}}}};
for(const date of ['2026-09-07','2026-09-14']){const s={anchorDates:{start:'2026-07-01',data:date,finish:'2026-12-31'},timeBudgetMs:500,horizonStart:'2026-07-01',horizonEnd:'2026-12-31'};const r=E.solve(toy,s);assert.equal(r.status,'feasible');assert.equal(r.dates.work,E.iso(E.createCalendars({}).add(E.parseDate(date),10,'business_day','hk')));assert.deepEqual(E.verify(toy,s,r.dates),[]);}
console.log('PASS 更新节奏随数据锚点顺延，不被旧的全程百分比拉回最早日');
