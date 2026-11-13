const assert=require('node:assert/strict'),E=require('./scheduler-engine'),F=require('./scheduler-financial-planning'),calendars=require('./scheduler-public-holidays');
const base=require('./scripts/export-library.cjs').build().data.rules,cal=E.createCalendars(calendars),day=E.parseDate;
for(const d of ['2025-01-28','2025-02-03','2025-02-04','2025-04-18','2025-04-21','2025-02-08','2024-10-12'])assert(!cal.get('cn_hk').isWorking(day(d)),d);
assert(cal.get('cn_hk').isWorking(day('2025-02-05')));assert(cal.get('cn_hk').isWorking(day('2025-02-17')),'美国假期不会自动并入');
assert.equal(E.iso(cal.add(day('2025-01-27'),1,'business_day','cn_hk')),'2025-02-05');
assert.equal(E.iso(cal.add(day('2025-02-05'),-1,'business_day','cn_hk')),'2025-01-27');
assert.equal(E.createCalendars({hk:calendars.hk}).get('cn_hk').from,null,'缺少一地覆盖不能冒充完整日历');
const original=JSON.stringify(base);
for(const mode of ['complete','staged']){
 const t=F.create(base,mode),m=new Map(t.events.map(e=>[e.code,e])),dep=(a,b)=>m.get(b).dependencies.find(d=>d.predecessorEventId===m.get(a).id);
 assert.equal(t.project.defaultCalendar,'cn_hk');assert.equal(t.project.calculatedWorkingDaysOnly,true);assert.deepEqual(E.validateTemplate(t),[]);
 assert.equal(dep(mode==='staged'?'EVT-163':'EVT-162','EVT-040').targetLag,null);
 // v0.17 removes the preceding-conference gate, so the writing interval has a useful target again.
 assert.equal(dep('EVT-034','EVT-035').targetLag,7);
 assert.equal(dep('EVT-022','EVT-141').targetLag,null);assert.equal(dep('EVT-036','EVT-148').targetLag,null);assert.equal(dep('EVT-147','EVT-148').targetLag,2);assert.equal(dep('EVT-145','EVT-148').targetLag,14);
 if(mode==='staged')assert(!dep('EVT-029','EVT-030'));
 assert(dep(mode==='staged'?'EVT-166':'EVT-162','EVT-076'));assert(dep(mode==='staged'?'EVT-167':'EVT-081','EVT-109'));
 for(const code of ['EVT-051','EVT-065','EVT-076','EVT-109','EVT-112','EVT-120','EVT-085','EVT-148'])assert(t.planningPolicy.anchorRelativeWindows[m.get(code).id]);
 // v0.17 uses an early appointment window, not the final-work closing window.
 assert.equal(t.planningPolicy.anchorRelativeWindows[m.get('EVT-125').id].latestLag,-25);
 const anchors={'EVT-002':'2024-10-12','EVT-003':'2025-04-10','EVT-153':'2024-12-31','EVT-162':'2025-02-24'};if(mode==='staged')anchors['EVT-163']='2024-12-02';
 const s={anchorDates:Object.fromEntries(Object.entries(anchors).map(([c,d])=>[m.get(c).id,d])),financialBaseDate:'2023-12-31',calendars,locks:{},a1Id:m.get('EVT-003').id,a1BusinessDaysOnly:true,spreadWeeks:true,preferWorkingDays:true,horizonStart:'2024-10-12',horizonEnd:'2025-04-10',timeBudgetMs:10000};
 const r=E.solve(t,s);assert.equal(r.status,'feasible',JSON.stringify(r.errors||r.conflict));assert.deepEqual(E.verify(t,s,r.dates),[]);
 for(const e of t.events)if(e.dateMode==='calculated')assert(cal.get('cn_hk').isWorking(day(r.dates[e.id])),e.code+'落在假期');
 assert.equal(r.dates[m.get('EVT-002').id],'2024-10-12','保留用户固定周六启动');
 const bad={...r.dates,[m.get('EVT-141').id]:'2025-01-28'};assert(E.verify(t,s,bad).some(x=>x.includes('事件工作日')));
 const holidayLocks={...s,locks:{[m.get('EVT-141').id]:'2025-01-28'}};assert.equal(E.solve(t,holidayLocks).status,'infeasible','假期锁定报冲突，不擅自移动');
 const d=c=>r.dates[m.get(c).id];
 assert(d('EVT-076')>=d(mode==='staged'?'EVT-166':'EVT-162'));assert(d('EVT-109')>=d(mode==='staged'?'EVT-167':'EVT-081'));
 assert(d('EVT-051')>='2025-03-01');assert(d('EVT-065')>='2025-03-01');assert(d('EVT-112')>='2025-03-01');
 if(mode==='staged')assert(d('EVT-029')<'2025-01-01','首轮访谈不应被完整期定稿拉迟');
 assert(r.debtAssessment.preparationWorkdays>=8);assert(d('EVT-033')<=d('EVT-151'));
 console.log('PASS '+mode,JSON.stringify({meetings:t.planningPolicy.meetingEventIds.map(id=>r.dates[id]),firstInterview:d('EVT-029'),finals:Object.fromEntries(['EVT-051','EVT-065','EVT-076','EVT-085','EVT-109','EVT-112','EVT-120'].map(c=>[c,d(c)])),debt:r.debtAssessment}));
}
assert.equal(JSON.stringify(base),original);
// Existing snapshots retain their original workday semantics under the new engine.
const old={project:{defaultCalendar:'hk'},lanes:[{id:'l'}],threads:[{id:'t',laneId:'l'}],events:[{id:'a',code:'A',name:'anchor',threadId:'t',dateMode:'anchor_input',dependencies:[]},{id:'b',code:'B',name:'work',threadId:'t',dateMode:'calculated',dependencies:[{id:'ab',predecessorEventId:'a',minLag:0,maxLag:null,targetLag:null,unit:'business_day',calendar:'inherit',strength:'hard'}]}]};
assert.deepEqual(E.verify(old,{anchorDates:{a:'2025-01-27'},calendars},{a:'2025-01-27',b:'2025-01-28'}),[]);
console.log('PASS 中港假期并集、补班交集、双模式共通修订、固定日期保护、原始库不变及旧方案兼容');
