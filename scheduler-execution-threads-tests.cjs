const assert=require('node:assert/strict'),E=require('./scheduler-engine'),F=require('./scheduler-financial-planning');
const base=require('./scripts/export-library.cjs').build().data.rules,original=JSON.stringify(base);
for(const mode of ['complete','staged']){
  const t=F.create(base,mode),by=new Map(t.events.map(e=>[e.code,e])),get=n=>by.get('EVT-'+n);
  assert.deepEqual(E.validateTemplate(t),[]);
  assert.equal(t.threads.length,base.threads.length+7);assert.equal(t.events.length,mode==='staged'?171:165);
  assert.equal(new Set(t.events.map(e=>e.id)).size,t.events.length);
  assert.equal(new Set(t.events.map(e=>e.code)).size,t.events.length);
  for(const e of base.events){assert.equal(by.get(e.code).id,e.id);if(e.code!=='EVT-113')assert.equal(by.get(e.code).threadId,e.threadId);}
  for(const [a,b] of [[169,170],[170,171],[171,'134'],['127',172],[172,173],[173,'151'],[174,175],[175,176],[176,177],['119',177],[177,178],[178,179],[179,'133'],[180,181],[181,182],[182,183],[183,184],[184,'150']]){
    const d=get(b).dependencies.find(d=>d.predecessorEventId===get(a).id);assert(d,`${a}→${b}`);assert.equal(d.maxLag,null);
  }
  assert(!t.events.some(e=>/取得.*商标.*证|完成商标注册$/.test(e.name)));
  // Preserve the explicitly approved MDD/notes/outline chain unchanged.
  for(const c of ['004','005','007'])assert.deepEqual(get(c).dependencies,base.events.find(e=>e.code==='EVT-'+c).dependencies);
  const anchors={'002':'2024-10-21','003':'2025-04-10','153':'2024-12-31','162':'2025-02-24'};
  if(mode==='staged')anchors['163']='2024-12-02';
  const s={anchorDates:Object.fromEntries(Object.entries(anchors).map(([c,d])=>[get(c).id,d])),financialBaseDate:'2023-12-31',a1Id:get('003').id,a1BusinessDaysOnly:true,calendars:require('./scheduler-public-holidays'),horizonStart:'2024-10-21',horizonEnd:'2025-04-10',spreadWeeks:true,timeBudgetMs:4000};
  const r=E.solve(t,s);assert.equal(r.status,'feasible',JSON.stringify(r.errors||r.conflict));assert.deepEqual(E.verify(t,s,r.dates),[]);
  for(const [c,d]of Object.entries(anchors))assert.equal(r.dates[get(c).id],d);
  assert(r.dates[get(171).id]<=r.dates[get('134').id]);assert(r.dates[get(173).id]<=r.dates[get('151').id]);
  assert(r.dates[get(179).id]<=r.dates[get('133').id]);assert(r.dates[get(184).id]<=r.dates[get('150').id]);
  console.log('PASS',mode,'4 threads / 16 events / dependencies / fixed anchors / verified schedule');
}
assert.equal(JSON.stringify(base),original);
const collision=JSON.parse(original);collision.events.push({...collision.events[0],id:'user-169',code:'EVT-169'});
const before=JSON.stringify(collision);assert.throws(()=>F.create(collision),/编码冲突/);assert.equal(JSON.stringify(collision),before);
console.log('PASS source library unchanged; stable identifiers; collisions fail without overwriting');
