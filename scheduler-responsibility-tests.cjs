const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const F=require('./scheduler-financial-planning'),R=F.responsibilities;
const base=require('./scripts/export-library.cjs').build().data.rules;
const without=t=>({...t,events:t.events.map(({responsibility,...e})=>e)});
const raw=without(base),saved=JSON.stringify(raw);
// Run the identical compiler with the enrichment step disabled, as an independent control.
const context={module:{exports:{}},require:name=>name==='./scheduler-event-responsibilities'?{enrich:t=>t}:require(name)};
vm.runInNewContext(fs.readFileSync(require.resolve('./scheduler-financial-planning'),'utf8'),context);
const control=context.module.exports,seen=new Set();
for(const mode of ['complete','staged'])for(const cybersecurity of [false,true])for(const overseasRequired of [false,true,null]){
  const options={cybersecurity,overseasRequired},t=F.create(raw,mode,options);
  assert.deepEqual(without(t),JSON.parse(JSON.stringify(control.create(raw,mode,options))));
  for(const e of t.events){
    seen.add(e.code);const r=e.responsibility;assert(r?.responsible.length,e.code);
    assert([...r.responsible,...r.supporting].every(s=>typeof s==='string'&&s.length),e.code);
    assert.equal(new Set([...r.responsible,...r.supporting]).size,r.responsible.length+r.supporting.length,e.code);
    assert.deepEqual(r,R.get({...e,responsibility:undefined}));
    assert.deepEqual(r,R.get(e));assert(Object.hasOwn(R.labels,r.basis));
  }
}
assert.equal(seen.size,179);assert.equal(JSON.stringify(raw),saved);assert(base.events.every(e=>e.responsibility?.responsible.length));
const model=raw.events.find(e=>e.code==='EVT-040');
assert.deepEqual(R.get(model).responsible,['保荐人']);
assert.equal(R.get({...model,id:'local-event'}),null);
assert.equal(R.get({...model,name:'完全不同的工作'}),null);
assert.equal(R.get({...model,responsibility:null}),null);
const own={...model,owner:'项目财务组',participants:['财务顾问']};
assert.deepEqual(R.enrich({events:[own]}).events[0].responsibility,{responsible:['项目财务组'],supporting:['财务顾问'],basis:'custom'});
const custom={...model,responsibility:{responsible:['项目组长'],supporting:[],basis:'custom'}};
assert.strictEqual(R.enrich({events:[custom]}).events[0],custom);
console.log('PASS 全部179节点、12种组合、旧库和用户分工保护；除分工字段外编译结果逐字段相同');
