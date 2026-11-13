const assert=require('node:assert/strict'),E=require('./scheduler-engine'),F=require('./scheduler-financial-planning');
const base=require('./scripts/export-library.cjs').build().data.rules,original=JSON.stringify(base),clone=x=>JSON.parse(JSON.stringify(x));
// Small mathematical check: one early chapter suffices even when another is late.
const event=id=>({id,code:id,name:id,threadId:'t',dateMode:id==='work'?'calculated':'anchor_input',dependencies:[]});
const toy={project:{defaultCalendar:'hk'},lanes:[{id:'l',name:'l'}],threads:[{id:'t',laneId:'l',name:'t'}],events:['early','late','printer','work'].map(event),readinessGroups:[{id:'any',eventId:'work',anyOf:['early','late'],readyAfterEventIds:['printer'],minLag:0,targetLag:2,unit:'business_day',calendar:'inherit'}]};
const s={anchorDates:{early:'2026-05-04',late:'2026-05-25',printer:'2026-05-06'},horizonStart:'2026-05-01',horizonEnd:'2026-06-01',timeBudgetMs:700,spreadWeeks:false};
const r=E.solve(toy,s);assert.equal(r.status,'feasible',JSON.stringify(r));assert.equal(r.dates.work,'2026-05-08');assert.deepEqual(E.verify(toy,s,r.dates),[]);
assert(E.verify(toy,s,{...r.dates,work:'2026-05-05'}).some(x=>x.includes('任一材料')));
assert.equal(E.solve(toy,{...s,locks:{work:'2026-05-05'}}).status,'infeasible');
const swapped=E.solve(toy,{...s,anchorDates:{...s.anchorDates,early:'2026-05-25',late:'2026-05-04'}});assert.equal(swapped.dates.work,'2026-05-08');
const sole=E.solve(toy,{...s,anchorDates:{late:'2026-05-25',printer:'2026-05-06'},locks:{work:'2026-05-08'}});assert.equal(sole.status,'feasible');assert(sole.dates.early<='2026-05-08');
const malformed=clone(toy);malformed.readinessGroups[0].anyOf=['missing'];assert(E.validateTemplate(malformed).length);
console.log('PASS ANY readiness, independent verification, reverse pruning, alternate witness and fixed-date conflict');
for(const mode of ['complete','staged'])for(const cybersecurity of [false,true]){
 const t=F.create(base,mode,{cybersecurity}),by=new Map(t.events.map(e=>[e.code,e])),get=n=>by.get('EVT-'+String(n).padStart(3,'0'));
 const dep=(a,b)=>get(b).dependencies.find(d=>d.predecessorEventId===get(a).id);
 assert.deepEqual(E.validateTemplate(t),[]);assert.equal(t.events.length,(mode==='staged'?171:165)+(cybersecurity?8:0));
 for(const n of [4,5,7])assert.deepEqual(get(n).dependencies,base.events.find(e=>e.code===get(n).code).dependencies);
 assert.equal(dep(24,19).strength,'soft');assert.equal(dep(24,19).minLag,0);assert(!dep(19,142));assert(dep(19,144));
 assert(get(19).name.includes('英文'));assert(get(20).name.includes('更新稿'));assert(get(21).name.includes('终稿'));
 for(const a of t.conferenceAgenda){const m=by.get(a.eventCode);assert(m.name.includes(a.purpose));for(const c of a.inputs)assert(m.dependencies.some(d=>d.predecessorEventId===by.get(c).id),'agenda matches hard prerequisites');}
 assert(!dep(145,146));assert(dep(156,146));assert.equal(t.readinessGroups.find(g=>g.eventId===get(146).id).anyOf.length,5);
 assert(get(188)&&get(189));assert(dep(189,150));assert(dep(191,193)&&dep(193,85));assert(dep(196,109));assert(!dep(81,99));
 assert(!dep(132,113));assert(!dep(113,115));assert.notEqual(get(113).threadId,get(115).threadId);
 for(const n of [156,124,126,127,128])assert.deepEqual(get(n).dependencies.map(d=>d.predecessorEventId),[get(2).id]);
 assert.equal(get(198).name,'确定是否需要聘请海外律师，开展专项境外法律尽调，并确定尽调范围');
 assert.equal(!!get(204),cybersecurity);if(cybersecurity)assert(dep(208,211)&&dep(211,150));
 const noOverseas=F.create(base,mode,{cybersecurity,overseasRequired:false});assert(noOverseas.events.some(e=>e.code==='EVT-198'));assert(!noOverseas.events.some(e=>e.code==='EVT-199'));assert.deepEqual(E.validateTemplate(noOverseas),[]);
 const anchors={2:'2024-10-21',3:'2025-04-10',153:'2024-12-31',162:'2025-02-24'};if(mode==='staged')anchors[163]='2024-12-02';
 const settings={anchorDates:Object.fromEntries(Object.entries(anchors).map(([n,d])=>[get(n).id,d])),financialBaseDate:'2023-12-31',a1Id:get(3).id,a1BusinessDaysOnly:true,calendars:require('./scheduler-public-holidays'),horizonStart:'2024-10-21',horizonEnd:'2025-04-10',timeBudgetMs:5000,spreadWeeks:true};
 const run=E.solve(t,settings);assert.equal(run.status,'feasible',JSON.stringify(run.errors||run.conflict));assert.deepEqual(E.verify(t,settings,run.dates),[]);const d=n=>run.dates[get(n).id];
 for(const [n,date]of Object.entries(anchors))assert.equal(d(n),date);
 assert(d(146)<d(145),'translation no longer waits for conference 4');assert(d(189)<d(145),'verification begins before conference 4');
 for(const n of [1,18,38,54,68,77,86,91,95,97])assert(d(n)<='2024-10-25',get(n).code+' request should be in kickoff week');
 assert(d(190)<=d(84),'walkthrough collection can start alongside visits');
 if(mode==='staged'){assert(d(84)<d(162));assert(d(85)>=d(168));assert(d(101)<d(162));assert(d(109)>=d(167));}
 console.log('PASS',mode,{cybersecurity,translation:d(146),verification:d(189),visitStart:d(84),visitEnd:d(85),registryStart:d(101),registryEnd:d(109),meetings:t.planningPolicy.meetingEventIds.map(id=>run.dates[id])});
}
assert.equal(JSON.stringify(base),original);console.log('PASS immutable base and all approved workflow revisions');
