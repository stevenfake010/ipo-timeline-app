/* 2026-10-30 user comments: revise a copy of the reviewed r3 event library. */
(function(root){
  'use strict';
  const VERSION='2026-10-30-r4',copy=x=>JSON.parse(JSON.stringify(x));
  function revise(input){
    if(input.ruleRevision!=='2026-10-30-r3')throw new Error('事件库不是已核对的大会规则版本，未自动覆盖。');
    const t=copy(input),by=new Map(t.events.map(e=>[e.code,e]));
    const event=code=>{const e=by.get(code);if(!e)throw Error('缺少事件 '+code);return e;};
    const dep=(from,to)=>{const d=event(to).dependencies.find(x=>x.predecessorEventId===event(from).id);if(!d)throw Error('缺少关系 '+from+' → '+to);return d;};
    const replace=(from,to,patch)=>Object.assign(dep(from,to),patch);
    event('EVT-001').name='传阅管理层访谈问卷';
    replace('EVT-001','EVT-004',{minLag:1,targetLag:7,maxLag:14,unit:'calendar_day'});
    event('EVT-054').name='传阅内控报告协议初稿';
    event('EVT-077').name='传阅第三方尽调、工商税务调档（含控制表）、实地考察备忘录及需求清单';
    Object.assign(dep('EVT-078','EVT-079'),{predecessorEventId:event('EVT-077').id,minLag:5,targetLag:10,maxLag:20,unit:'business_day'});
    Object.assign(dep('EVT-004','EVT-007'),{predecessorEventId:event('EVT-005').id,minLag:3,targetLag:5,maxLag:10,unit:'business_day'});
    event('EVT-022').dependencies=event('EVT-022').dependencies.filter(d=>d.predecessorEventId!==event('EVT-006').id);
    const draft={id:'evt-r4-engagement-draft',code:'EVT-154',name:'传阅签署保荐人及整体协调人聘任协议（Engagement Letter）初稿',description:'',dateMode:'calculated',threadId:event('EVT-122').threadId,dependencies:[{id:'dep-r4-start-engagement-draft',predecessorEventId:event('EVT-002').id,minLag:0,targetLag:0,maxLag:2,unit:'business_day',calendar:'inherit',strength:'hard'}]};
    if(by.has(draft.code)||t.events.some(e=>e.id===draft.id))throw Error('新事件编码或ID已存在');
    t.events.splice(t.events.indexOf(event('EVT-122')),0,draft);
    Object.assign(dep('EVT-002','EVT-122'),{predecessorEventId:draft.id,minLag:5,targetLag:7,maxLag:15,unit:'business_day'});
    const deleted=new Set([event('EVT-006').id,event('EVT-078').id]);
    t.events=t.events.filter(e=>!deleted.has(e.id));
    for(const e of t.events)for(const d of e.dependencies)if(deleted.has(d.predecessorEventId))throw Error('删除事件后仍有悬空关系：'+e.code);
    t.ruleRevision=VERSION;t.updatedAt=new Date().toISOString();return t;
  }
  const api={VERSION,revise};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.IPOFeedbackRevision=api;
})(typeof globalThis!=='undefined'?globalThis:this);
