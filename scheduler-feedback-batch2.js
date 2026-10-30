/* Apply user's second batch to the reviewed r4 template; preserve the input. */
(function(root){
  'use strict';
  const VERSION='2026-10-30-r5',copy=x=>JSON.parse(JSON.stringify(x));
  function revise(input){
    if(input.ruleRevision!=='2026-10-30-r4')throw Error('事件库不是已核对的上一版，未自动覆盖。');
    const t=copy(input),by=new Map(t.events.map(e=>[e.code,e]));
    const get=code=>{const e=by.get(code);if(!e)throw Error('缺少事件 '+code);return e;};
    const link=(from,to,min,target,max,unit,id)=>{const targetEvent=get(to);if(targetEvent.dependencies.some(d=>d.predecessorEventId===get(from).id))throw Error('关系已存在 '+from+' → '+to);targetEvent.dependencies.push({id,predecessorEventId:get(from).id,minLag:min,targetLag:target,maxLag:max,unit,calendar:'inherit',strength:'hard'});};
    const edge=(from,to)=>{const d=get(to).dependencies.find(d=>d.predecessorEventId===get(from).id);if(!d)throw Error('缺少关系 '+from+' → '+to);return d;};
    get('EVT-095').name='传阅合规证明开具范围、合规函控制表及各项合规证明函的模板、开始与主管部门预沟通';
    get('EVT-018').name='向公司传阅业务章节撰写所需资料清单';
    get('EVT-093').name='收集报告期法律尽调资料';
    const d=edge('EVT-097','EVT-116');for(const key of ['minLag','targetLag','maxLag'])if(d[key]!=null)d[key]*=2;
    get('EVT-122').name='签署保荐人及整体协调人聘任协议（Engagement Letter）并向联交所提交';
    const deleted=get('EVT-123').id;t.events=t.events.filter(e=>e.id!==deleted);
    for(const e of t.events)for(const dep of e.dependencies)if(dep.predecessorEventId===deleted)throw Error('删除的聘任协议备案事件仍有下游关系：'+e.code);
    const lane=t.lanes.find(l=>l.name==='其他重点尽调');if(!lane)throw Error('缺少其他重点尽调条线');lane.name='其他重点尽调及其他招股书章节撰写';
    const thread=t.threads.find(th=>th.laneId===lane.id&&th.name==='招股书其他章节撰写');if(!thread)throw Error('缺少已有的空招股书章节线程');thread.name='其他招股书章节撰写';
    function add(code,id,name,threadId,from,min,target,max,unit){
      if(by.has(code)||t.events.some(e=>e.id===id))throw Error('事件编码或ID冲突 '+code);
      const e={id,code,name,description:'',dateMode:'calculated',threadId,dependencies:[{id:'dep-r5-'+code+'-'+from,predecessorEventId:get(from).id,minLag:min,targetLag:target,maxLag:max,unit,calendar:'inherit',strength:'hard'}]};
      t.events.push(e);by.set(code,e);return e;
    }
    const filing=add('EVT-155','evt-r5-csrc-checklist','传阅中证监备案文件清单及分工控制表初稿（含备案文件签章要求）',get('EVT-135').threadId,'EVT-002',5,10,20,'business_day');
    // Place it at the start of its thread in the event library, without changing IDs.
    t.events.splice(t.events.indexOf(filing),1);t.events.splice(t.events.indexOf(get('EVT-135')),0,filing);
    link('EVT-155','EVT-135',0,null,null,'calendar_day','dep-r5-csrc-to-report');
    link('EVT-155','EVT-136',0,null,null,'calendar_day','dep-r5-csrc-to-opinion');
    const printer=add('EVT-156','evt-r5-printer-selection','开始选聘印刷商',get('EVT-122').threadId,'EVT-002',7,21,56,'calendar_day');
    t.events.splice(t.events.indexOf(printer),1);t.events.splice(t.events.indexOf(get('EVT-122'))+1,0,printer);
    link('EVT-156','EVT-132',0,null,null,'calendar_day','dep-r5-printer-before-discussion');
    add('EVT-157','evt-r5-risk-headings','传阅招股书风险因素章节标题初稿',thread.id,'EVT-141',1,2,null,'business_day');
    link('EVT-157','EVT-142',1,2,null,'business_day','dep-r5-risk-before-conf2');
    Object.assign(edge('EVT-141','EVT-142'),{minLag:7,targetLag:14,maxLag:null,unit:'calendar_day'});
    t.ruleRevision=VERSION;t.updatedAt=new Date().toISOString();return t;
  }
  const api={VERSION,revise};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.IPOBatch2Revision=api;
})(typeof globalThis!=='undefined'?globalThis:this);
