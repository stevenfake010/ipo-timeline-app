const assert=require('node:assert/strict'),E=require('./scheduler-engine'),F=require('./scheduler-financial-planning'),calendars=require('./scheduler-public-holidays');
const base=require('./scripts/export-library.cjs').build().data.rules,original=JSON.stringify(base),clone=x=>JSON.parse(JSON.stringify(x));
for(const mode of ['complete','staged'])for(const cybersecurity of [false,true]){
 const t=F.create(base,mode,{cybersecurity}),get=n=>t.events.find(e=>e.code==='EVT-'+String(n).padStart(3,'0')),dep=(a,b)=>get(b).dependencies.find(d=>d.predecessorEventId===get(a).id);
 assert.deepEqual(E.validateTemplate(t),[]);assert.equal(t.events.length,(mode==='staged'?171:165)+(cybersecurity?8:0));
 assert.equal(t.planningPolicy.alignPreparationToReadiness,true);
 const malformed=clone(t);malformed.planningPolicy.alignPreparationToReadiness='true';assert(E.validateTemplate(malformed).some(x=>x.includes('准备工作随材料')));
 assert.equal(dep(154,122).minLag,0);assert.equal(dep(154,122).targetLag,7);assert.equal(dep(122,134).minLag,2);assert.equal(dep(122,134).unit,'calendar_month');
 for(const n of [26,21,36,14,13,187]){assert(!dep(n,147));assert.equal(dep(n,149).minLag,2);assert(dep(n,148));}
 for(const n of [24,35,19,9,17,185,159,160,161])assert(dep(n,147),'first whole book still covers all initial content');
 assert(!dep(144,35));assert(!dep(142,159));assert(dep(35,145));
 for(const n of [4,5,7])assert.deepEqual(get(n).dependencies,base.events.find(e=>e.code===get(n).code).dependencies);
 assert.equal(get(191).sameWeekGroup,get(192).sameWeekGroup);assert.equal(get(85).sameWeekGroup,get(193).sameWeekGroup);
 assert.equal(dep(31,33).minLag,8);assert.equal(dep(31,33).targetLag,10);assert.equal(dep(33,3).targetLag,null);
 if(cybersecurity){assert(!dep(205,209));assert.equal(dep(206,209).minLag,5);assert.equal(dep(206,209).targetLag,10);assert(!dep(207,209));assert(dep(208,211));}
}
// Isolate the sponsor contract from unrelated workflows. Keep a daily exact filing anchor.
const full=F.create(base,'staged'),codes=new Set(['EVT-002','EVT-154','EVT-122','EVT-003','EVT-134']);
const sponsor={project:full.project,lanes:full.lanes,threads:full.threads,events:clone(full.events.filter(e=>codes.has(e.code))),sponsorReviewPolicy:full.sponsorReviewPolicy};
const ids=new Set(sponsor.events.map(e=>e.id));for(const e of sponsor.events)e.dependencies=e.dependencies.filter(d=>ids.has(d.predecessorEventId));
const g=n=>sponsor.events.find(e=>e.code==='EVT-'+String(n).padStart(3,'0'));
function sponsorRun(a1,locks={}){const s={anchorDates:{[g(2).id]:'2026-05-04',[g(3).id]:a1},locks,calendars,a1Id:g(3).id,a1BusinessDaysOnly:true,horizonStart:'2026-05-04',horizonEnd:a1,spreadWeeks:false,timeBudgetMs:900};const r=E.solve(sponsor,s);if(r.status==='feasible')assert.deepEqual(E.verify(sponsor,s,r.dates),[]);return r;}
const tight=sponsorRun('2026-07-06');assert.equal(tight.status,'feasible');assert.equal(tight.dates[g(122).id],'2026-05-06');assert.equal(tight.dates[g(154).id],'2026-05-06');assert(tight.warnings.some(x=>x.includes('审阅仅安排0')));
assert.equal(sponsorRun('2026-07-03').status,'infeasible','must not waive two-month requirement to make short plan fit');
assert.equal(sponsorRun('2026-07-06',{[g(122).id]:'2026-05-07'}).status,'infeasible','late signing lock is not moved');
const roomy=sponsorRun('2026-08-06'),cal=E.createCalendars(calendars);assert.equal(roomy.status,'feasible');assert.equal(roomy.dates[g(122).id],E.iso(cal.add(E.parseDate(roomy.dates[g(154).id]),7,'business_day','cn_hk')),'reward target when feasible');
const old=clone(sponsor);old.events.find(e=>e.id===g(122).id).dependencies.find(d=>d.predecessorEventId===g(154).id).minLag=5;
assert(E.verify(old,{anchorDates:{[g(2).id]:'2026-05-04',[g(3).id]:'2026-07-06'},calendars},tight.dates).length,'old snapshot retains its old minimum');
// Same-week exceptions affect preferences only. Fixed lag constraints still apply.
const toy={project:{defaultCalendar:'hk'},lanes:[{id:'l'}],threads:[{id:'th',laneId:'l'}],events:[
 {id:'s',code:'S',name:'S',threadId:'th',dateMode:'anchor_input',dependencies:[]},
 ...['a','b'].map(id=>({id,code:id,name:id,threadId:'th',dateMode:'calculated',sameWeekGroup:'closure',dependencies:[{id:'s-'+id,predecessorEventId:'s',minLag:1,targetLag:1,maxLag:null,unit:'business_day',calendar:'inherit',strength:'hard'}]}))
]};
const ts={anchorDates:{s:'2026-05-04'},horizonStart:'2026-05-04',horizonEnd:'2026-05-15',spreadWeeks:true,timeBudgetMs:500};
const tr=E.solve(toy,ts);assert.equal(tr.status,'feasible');assert.equal(tr.dates.a,tr.dates.b);assert.equal(tr.metrics.sameWeekPairs,0);assert(E.verify(toy,ts,{...tr.dates,a:'2026-05-04'}).length);
assert.equal(JSON.stringify(base),original);
console.log('PASS sponsor hard lead / compressible review / target reward / old snapshot / first-book coverage / conference readiness / cyber memo prerequisite / shared closeout');
