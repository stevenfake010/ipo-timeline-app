const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),E=require('./scheduler-engine'),Cloud=require('./scheduler-cloud-library');
const seed=require('./scripts/export-library.cjs').build();
const config={enabled:true,url:'https://example.supabase.co',publishableKey:'sb_publishable_test',channel:'production'};
const id='4508a256-d18a-4da4-8384-059605793dd0';
let record={...seed,id,version:'test-publication',status:'published',published_at:'2026-10-30T08:00:00Z'},calls=[];
const state={},storage={getItem:k=>state[k]||null,setItem:(k,v)=>state[k]=v,removeItem:k=>delete state[k]};
const fetcher=async(url,options)=>{calls.push({url,options});return{ok:true,text:async()=>JSON.stringify(url.includes('ipo_library_channels')?[{release_id:id}]:[record])};};
async function run(){
  let r=await Cloud.load({config,engine:E,embedded:seed.data,storage,fetcher});assert.equal(r.mode,'cloud');assert.equal(r.data.rules.events.length,129);assert.equal(calls.length,2);assert(calls.every(c=>c.options.method==='GET'&&!c.options.body&&!c.options.headers.Authorization));
  const offline=async()=>{throw Error('offline');};r=await Cloud.load({config,engine:E,embedded:seed.data,storage,fetcher:offline});assert.equal(r.mode,'cache');assert.equal(r.release.id,id);
  r=await Cloud.load({config,engine:E,embedded:seed.data,storage:{getItem:()=>'{bad'},fetcher:offline});assert.equal(r.mode,'builtin');assert.equal(r.release,null);
  const invalid=JSON.parse(JSON.stringify(record));invalid.data.rules.events[0].dependencies[0].predecessorEventId='missing';assert.throws(()=>Cloud.validate(invalid,E));
  assert.throws(()=>Cloud.validate({...record,status:'draft'},E));assert.throws(()=>Cloud.validate({...record,min_engine_version:'999.0.0'},E));
  const badCalendar=JSON.parse(JSON.stringify(record));badCalendar.data.calendars.hk.holidays.push('2028-02-30');assert.throws(()=>Cloud.validate(badCalendar,E));
  const abortFetch=(url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('timeout'))));r=await Cloud.load({config,engine:E,embedded:seed.data,fetcher:abortFetch,timeoutMs:5});assert.equal(r.mode,'builtin');
  const html=fs.readFileSync('scheduler.html','utf8'),els={};for(const [,name]of html.matchAll(/\bid="([^"]+)"/g))els[name]={value:'',innerHTML:'',textContent:'',classList:{add(){},remove(){}},selectedOptions:[{}]};
  const oldPlan={id:'saved-old',name:'旧项目不可覆盖',source:'原规则',fingerprint:'old',template:JSON.parse(JSON.stringify(seed.data.rules)),settings:{anchorDates:{},locks:{},calendars:{hk:{version:'用户原日历',from:'2026-01-01',to:'2026-12-31',holidays:[],workingDays:[]}},spreadWeeks:true},result:null,pending:null,history:[],dirty:true};
  oldPlan.template.events[0].name='用户手工修改事件';
  const original=JSON.stringify(oldPlan);state['ipo-scheduler-plans-v1']=JSON.stringify({version:1,currentId:oldPlan.id,plans:[oldPlan]});
  const context={window:{IPOScheduler:E,IPORuleRevision:require('./scheduler-rule-revision'),IPOProspectusRevision:require('./scheduler-prospectus-revision'),IPOFeedbackRevision:require('./scheduler-feedback-revision'),IPOBatch2Revision:require('./scheduler-feedback-batch2'),IPOProspectusGrouping:require('./scheduler-prospectus-grouping'),IPOMeetingCycle:require('./scheduler-meeting-cycle'),IPOFlexiblePlanning:require('./scheduler-flexible-planning'),IPO_PUBLIC_HOLIDAYS:require('./scheduler-public-holidays'),IPOLibraryCloud:Cloud,IPO_CLOUD_CONFIG:config,fetch:fetcher,localStorage:storage},document:{getElementById:id=>els[id]},localStorage:storage,setTimeout,clearTimeout,crypto:{randomUUID:(()=>{let x=0;return()=>String(++x)})()}};
  const draft={window:{}};vm.runInNewContext(fs.readFileSync('scheduler-draft.js','utf8'),draft);context.window.IPO_DRAFT_RULES=draft.window.IPO_DRAFT_RULES;vm.createContext(context);vm.runInContext(fs.readFileSync('scheduler-app.js','utf8'),context);await new Promise(resolve=>setImmediate(resolve));
  assert(els.cloudInfo.textContent.includes('云端已连接'));assert.equal(state['ipo-scheduler-plans-v1'],JSON.stringify({version:1,currentId:oldPlan.id,plans:[oldPlan]}));
  await els.newPlan.onclick();let db=JSON.parse(state['ipo-scheduler-plans-v1']),p=db.plans.find(p=>p.id===db.currentId);assert.equal(p.ruleRelease.id,id);assert.equal(p.settings.calendarRelease.id,id);assert.equal(p.template.events[0].name,seed.data.rules.events[0].name);assert.equal(JSON.stringify(db.plans.find(p=>p.id==='saved-old')),original);
  record={...record,version:'next-publication',data:JSON.parse(JSON.stringify(record.data))};record.data.rules.project.name='新默认项目';await els.refreshCloud.onclick();assert.equal(JSON.stringify(JSON.parse(state['ipo-scheduler-plans-v1']).plans.find(x=>x.id===p.id)),JSON.stringify(p));
  await els.newPlan.onclick();db=JSON.parse(state['ipo-scheduler-plans-v1']);assert.equal(db.plans.find(p=>p.id===db.currentId).template.project.name,'新默认项目');
  console.log('PASS 云端读取/缓存/断网/超时/无效数据/引擎兼容/纯GET/已有方案保护/新方案固定发布版本');
}
run().catch(e=>{console.error(e);process.exitCode=1});
