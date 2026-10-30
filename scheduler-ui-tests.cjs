// UI 层回归测试：在虚拟 DOM 中运行 scheduler-app.js，验证方案删除与界面收敛。
// 与 scheduler-cloud-tests.cjs 同一套做法：无第三方依赖，纯 node 直接运行。
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('./scheduler-engine');
const seed=require('./scripts/export-library.cjs').build().data.rules;
const html=fs.readFileSync('scheduler.html','utf8');
const appSource=fs.readFileSync('scheduler-app.js','utf8');

let passed=0;
function test(name,fn){fn();passed++;console.log('PASS',name);}

// ---------- 静态检查 ----------
test('JS 引用的元素 id 都存在于 scheduler.html',()=>{
  const htmlIds=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
  const used=new Set([...appSource.matchAll(/\$\(.([A-Za-z0-9_]+).\)/g)].map(m=>m[1]));
  const dynamic=new Set(['lockDate']); // 事件详情面板运行时生成
  const missing=[...used].filter(id=>!htmlIds.has(id)&&!dynamic.has(id));
  assert.deepEqual(missing,[],'缺少元素：'+missing.join(', '));
});

test('后台入口已隐去：两处 details 置 hidden',()=>{
  assert.equal((html.match(/<details hidden>/g)||[]).length,2);
});

test('四个排程开关已隐藏且默认勾选',()=>{
  for(const id of ['spreadWeeks','keepPrevious','preferWorkingDays','a1BusinessDaysOnly']){
    const pos=html.indexOf('id="'+id+'"');
    assert.ok(pos>0,id+' 不存在');
    const openTag=html.slice(html.lastIndexOf('<label',pos),html.indexOf('>',html.lastIndexOf('<label',pos))+1);
    assert.ok(openTag.includes('class="check"'),id+' 应仍在 label.check 内');
    assert.ok(openTag.includes('hidden'),id+' 所在 label 应带 hidden');
    assert.ok(html.slice(pos,html.indexOf('>',pos)).includes('checked'),id+' 应默认勾选');
  }
});

// ---------- 行为检查 ----------
function plan(id,name,withTemplate){
  return {id,name,source:'内置事件库快照',fingerprint:'fp-'+id,
    template:withTemplate?JSON.parse(JSON.stringify(seed)):null,
    settings:{anchorDates:{},locks:{},calendars:{},spreadWeeks:true,keepPrevious:true,preferWorkingDays:true,a1BusinessDaysOnly:true},
    result:null,pending:null,history:[],dirty:true};
}

function boot(db){
  const els={};
  for(const [,name] of html.matchAll(/\bid="([^"]+)"/g)){
    els[name]={value:'',innerHTML:'',textContent:'',checked:false,hidden:false,disabled:false,className:'',
      classList:{add(){},remove(){}},selectedOptions:[{}],dataset:{},files:[]};
  }
  const state={};
  if(db!==undefined)state['ipo-scheduler-plans-v1']=JSON.stringify(db);
  const storage={getItem:k=>state[k]??null,setItem:(k,v)=>{state[k]=v;},removeItem:k=>{delete state[k];}};
  const window={IPOScheduler:E,IPO_CLOUD_CONFIG:{enabled:false},confirm:()=>true,localStorage:storage};
  for(const [name,file] of [['IPORuleRevision','scheduler-rule-revision'],['IPOProspectusRevision','scheduler-prospectus-revision'],
    ['IPOFeedbackRevision','scheduler-feedback-revision'],['IPOBatch2Revision','scheduler-feedback-batch2'],
    ['IPOProspectusGrouping','scheduler-prospectus-grouping'],['IPOMeetingCycle','scheduler-meeting-cycle'],
    ['IPOFlexiblePlanning','scheduler-flexible-planning'],['IPO_PUBLIC_HOLIDAYS','scheduler-public-holidays']]){
    window[name]=require('./'+file);
  }
  const draft={window:{}};
  vm.runInNewContext(fs.readFileSync('scheduler-draft.js','utf8'),draft);
  window.IPO_DRAFT_RULES=draft.window.IPO_DRAFT_RULES;
  const context={window,document:{getElementById:id=>els[id]},localStorage:storage,setTimeout,clearTimeout,
    crypto:{randomUUID:(()=>{let n=0;return()=>'new-'+(++n);})()}};
  vm.createContext(context);
  vm.runInContext(appSource,context);
  const read=()=>JSON.parse(state['ipo-scheduler-plans-v1']||'null');
  return {els,state,window,read};
}

test('载入已有方案时存储一字不动',()=>{
  const db={version:1,currentId:'p1',plans:[plan('p1','方案甲',true),plan('p2','方案乙',true)]};
  const before=JSON.stringify(db);
  const box=boot(db);
  assert.equal(box.state['ipo-scheduler-plans-v1'],before,'初始化不应改写已存方案');
});

test('删除有二次确认：取消则不删',()=>{
  const box=boot({version:1,currentId:'p1',plans:[plan('p1','方案甲',true),plan('p2','方案乙',true)]});
  box.window.confirm=()=>false;
  box.els.deletePlan.onclick();
  assert.equal(box.read().plans.length,2);
});

test('删除当前方案后切到相邻方案',()=>{
  const box=boot({version:1,currentId:'p1',plans:[plan('p1','方案甲',true),plan('p2','方案乙',true)]});
  box.els.deletePlan.onclick();
  const db=box.read();
  assert.equal(db.plans.length,1);
  assert.equal(db.plans[0].id,'p2');
  assert.equal(db.currentId,'p2','currentId 必须指向仍存在的方案');
  assert.ok(box.els.planSelect.innerHTML.includes('方案乙'),'下拉框应只剩剩余方案');
});

test('删除最后一个方案时自动补空白方案',()=>{
  const box=boot({version:1,currentId:'only',plans:[plan('only','唯一方案',true)]});
  box.els.deletePlan.onclick();
  const db=box.read();
  assert.equal(db.plans.length,1,'应自动补一个方案，避免空态');
  assert.notEqual(db.plans[0].id,'only');
  assert.equal(db.currentId,db.plans[0].id);
  assert.ok(db.plans[0].template&&db.plans[0].template.events.length>0,'新方案应已套用事件库');
});

test('没有当前方案时点击删除只提示、不抛错',()=>{
  const box=boot({version:1,currentId:'',plans:[plan('p1','方案甲',true)]});
  assert.doesNotThrow(()=>box.els.deletePlan.onclick());
  assert.equal(box.read().plans.length,1,'不应误删方案');
});

console.log('\n'+passed+' 组 UI 测试通过');
