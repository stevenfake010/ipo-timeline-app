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
 return{anchorDates:Object.fromEntries(Object.entries(dates).map(([c,d])=>[m.get(c).id,d])),locks:{},financialCoverage:'2022–2023年度',a1Id:m.get('EVT-003').id,calendars:require('./scheduler-public-holidays'),spreadWeeks:true,preferWorkingDays:true,a1BusinessDaysOnly:true,keepPrevious:false,timeBudgetMs:budget,horizonStart:start,horizonEnd:a1};
}
for(const t of [full,staged]){
 const s=settings(t),missing=clone(s);delete missing.anchorDates[t.financialStrategy.fullAnchorId];assert.equal(E.solve(t,missing).status,'invalid');
 assert.throws(()=>E.compile(t,{...s,releaseAnchorId:t.financialStrategy.fullAnchorId}));
 assert(E.verify(t,missing,{}).some(x=>x.includes('固定锚点')));
 const bad=clone(t);bad.financialStrategy.fullAnchorId='missing';assert(E.validateTemplate(bad).length);
}
const inverted=settings(staged,{first:'2025-03-01'});assert.equal(E.solve(staged,inverted).status,'invalid');
assert.equal(E.solve(staged,{...settings(staged),financialCoverage:''}).status,'invalid');
assert.doesNotThrow(()=>E.compile(staged,settings(staged,{first:'2025-02-24'})));
assert.equal(E.solve(full,settings(full,{available:'2024-12-20'})).status,'infeasible');
console.log('PASS 固定锚点必填、不能释放、日期顺序/同日、报告期边界、覆盖期间必填');
for(const [name,t,opts]of [
 ['complete-short',full,{a1:'2025-02-28',available:'2025-01-06'}],
 ['staged-medium',staged,{}],
 ['complete-long',full,{a1:'2025-06-26',available:'2025-02-24'}]
]){
 const s=settings(t,opts),r=E.solve(t,s);assert.equal(r.status,'feasible',name+': '+JSON.stringify(r.errors||r.conflict));assert.deepEqual(E.verify(t,s,r.dates),[]);
 for(const [id,d]of Object.entries(s.anchorDates))assert.equal(r.dates[id],d);
 const m=by(t);for(const c of ['EVT-042','EVT-044','EVT-030'])assert(r.dates[m.get(c).id]>=s.anchorDates[t.financialStrategy.fullAnchorId]);
 if(t===staged){assert(r.dates[m.get('EVT-040').id]<s.anchorDates[t.financialStrategy.fullAnchorId],'模型应能够先行开展');assert(r.dates[m.get('EVT-084').id]<s.anchorDates[t.financialStrategy.fullAnchorId],'首批走访应能够先开展');
  for(const c of ['EVT-036','EVT-165','EVT-167','EVT-168','EVT-085'])assert(r.dates[m.get(c).id]>=s.anchorDates[t.financialStrategy.fullAnchorId]);
  const broken={...r.dates,[m.get('EVT-042').id]:'2025-02-23'};assert(E.verify(t,s,broken).length);
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
