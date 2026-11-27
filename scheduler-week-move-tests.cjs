const assert=require('node:assert/strict'),vm=require('node:vm'),E=require('./scheduler-engine');
const t={project:{defaultCalendar:'cn_hk',calculatedWorkingDaysOnly:true},lanes:[{id:'l'}],threads:[{id:'t',laneId:'l'}],events:[]};
function event(id,fixed,pred,min=0){return {id,name:id,code:id,threadId:'t',dateMode:fixed?'anchor_input':'calculated',dependencies:pred?[{id:pred+'-'+id,predecessorEventId:pred,minLag:min,targetLag:null,maxLag:null,unit:'calendar_day',calendar:'inherit',strength:'hard'}]:[]};}
t.events=[event('start',true),event('draft',false,'start',1),event('review',false,'draft',1),event('a1',true,'review',1)];
const s={anchorDates:{start:'2026-07-06',a1:'2026-08-03'},locks:{},calendars:{cn:{holidays:['2026-07-21']},hk:{holidays:['2026-07-20']}},horizonStart:'2026-07-06',horizonEnd:'2026-08-03',a1Id:'a1',a1BusinessDaysOnly:true};
const dates={...s.anchorDates,draft:'2026-07-14',review:'2026-07-24'},before=JSON.stringify({t,s,dates});
let response;
const self={postMessage:m=>{response=m.result;}};
vm.runInNewContext(E.workerSource,{self,get IPOScheduler(){return self.IPOScheduler;}});
function move(id,w,settings=s){self.onmessage({data:{template:t,settings,weekMove:{id,week:w,dates}}});return response;}
let r=move('draft','2026-07-20');assert.equal(r.status,'feasible');assert.equal(r.dates.draft,'2026-07-22');
assert.deepEqual(Object.keys(dates).filter(id=>dates[id]!==r.dates[id]),['draft']);assert.equal(r.metrics.movedEvents,1);
assert.equal(r.details.draft.date,r.dates.draft);assert.deepEqual(E.verify(t,s,r.dates),[]);
assert.equal(move('draft','2026-07-06').dates.draft,'2026-07-07','keep weekday when possible');
r=move('draft','2026-07-27');assert.equal(r.status,'invalid');assert(r.errors.join().includes('draft → review'));assert(!r.dates);
assert.equal(move('a1','2026-07-27').status,'invalid');
assert.equal(move('draft','2026-07-20',{...s,locks:{draft:dates.draft}}).status,'invalid');
assert.equal(move('draft','2026-07-13').status,'invalid','no-op drop');
assert.equal(move('draft','2026-07-13',{...s,releaseAnchorId:'a1'}).status,'invalid');
const allBlocked={...s,blockedDates:['2026-07-22','2026-07-23','2026-07-24']};
assert.equal(move('draft','2026-07-20',allBlocked).status,'invalid');
assert.equal(JSON.stringify({t,s,dates}),before);
console.log('PASS single-card worker: only one date changes, preferred weekday, CN/HK holidays, successor conflict, locks, anchors, input preservation');
