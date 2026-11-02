const assert=require('node:assert/strict'),E=require('./scheduler-engine'),calendars=require('./scheduler-public-holidays');
const edge=(id,from,min,target,unit='business_day',weight=1)=>({id,predecessorEventId:from,minLag:min,targetLag:target,maxLag:null,unit,calendar:'inherit',strength:'hard',targetWeight:weight});
const t={project:{defaultCalendar:'hk'},lanes:[{id:'l'}],threads:[{id:'th',laneId:'l'}],events:[
 {id:'s',code:'START',name:'启动债项',threadId:'th',dateMode:'calculated',dependencies:[]},
 {id:'c',code:'COMPLETE',name:'完成债项',threadId:'th',dateMode:'calculated',dependencies:[edge('sc','s',8,10)]},
 {id:'f',code:'FINAL',name:'招股书最终定稿',threadId:'th',dateMode:'calculated',dependencies:[edge('cf','c',0,1)]},
 {id:'a',code:'A1',name:'A1',threadId:'th',dateMode:'anchor_input',dependencies:[edge('ca','c',0,5,'business_day',8)]}
],debtPolicy:{version:1,startEventId:'s',completeEventId:'c',finalizeEventId:'f',a1EventId:'a',maxAgeMonths:2,minPreparationDays:8,targetPreparationDays:10,bufferDays:5,calendar:'inherit'}};
assert.deepEqual(E.validateTemplate(t),[]);
function settings(start='2025-03-03',complete='2025-03-17',final='2025-03-18',a1='2025-04-10'){return{anchorDates:{a:a1},locks:{s:start,c:complete,f:final},calendars,a1Id:'a',a1BusinessDaysOnly:true,horizonStart:'2025-01-01',horizonEnd:'2025-06-01',timeBudgetMs:500};}
function run(s,want){const r=E.solve(t,s);assert.equal(r.status,want,JSON.stringify(r.errors||r.conflict));if(r.dates)assert.deepEqual(E.verify(t,s,r.dates),[]);return r;}
let r=run(settings(),'feasible');assert.equal(r.debtAssessment.referenceDate,'2025-03-02');assert.equal(r.debtAssessment.preparationWorkdays,10);assert.deepEqual(Object.keys(r.dates).sort(),['a','c','f','s']);
// Calendar months, not 60 days; month-end inverse clipping must not admit an old basis.
run(settings('2025-03-01','2025-03-14','2025-03-17','2025-04-28'),'feasible');
run(settings('2025-03-01','2025-03-14','2025-03-17','2025-04-29'),'infeasible');
r=run(settings('2025-03-02','2025-03-14','2025-03-17','2025-04-29'),'feasible');assert.equal(r.debtAssessment.referenceDate,'2025-03-01');
r=run(settings('2025-03-03','2025-03-13','2025-03-14'),'feasible');assert.equal(r.debtAssessment.preparationWorkdays,8);
run(settings('2025-03-03','2025-03-12','2025-03-14'),'infeasible');
r=run(settings('2025-03-19','2025-04-02','2025-04-03'),'feasible');assert.equal(r.debtAssessment.bufferWorkdays,5);
r=run(settings('2025-03-24','2025-04-08','2025-04-09'),'feasible');assert.equal(r.debtAssessment.bufferWorkdays,2);assert(r.warnings.some(x=>x.includes('缓冲偏紧')));
run(settings('2025-03-19','2025-04-02','2025-04-01'),'infeasible');
assert(E.verify(t,settings(),{s:'2025-01-06',c:'2025-01-20',f:'2025-01-21',a:'2025-04-10'}).some(x=>x.includes('基准日')));
const s=settings();r=run({...s,releaseAnchorId:'a'},'feasible');assert.equal(r.dates.a,'2025-03-18');
const calendar=E.createCalendars(calendars);assert.equal(E.iso(calendar.add(E.parseDate('2025-04-10'),-5,'business_day','hk')),'2025-04-02');
assert.equal(E.iso(calendar.add(E.parseDate('2024-03-31'),-1,'calendar_month','natural')),'2024-02-29');
console.log('PASS 债项内部基准日/2自然月边界/8与10工作日/5日软缓冲/招股书前置/独立复核/最早A1/假期反推');
