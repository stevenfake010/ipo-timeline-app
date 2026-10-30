/* Planning assumptions, not statutory deadlines. Upgrade only the reviewed r7. */
(function(root){
  'use strict';
  const VERSION='2026-10-30-r8',copy=x=>JSON.parse(JSON.stringify(x));
  function revise(input){
    if(input.ruleRevision!=='2026-10-30-r7')throw Error('弹性排程需要已核对的上一版规则');
    const t=copy(input),by=new Map(t.events.map(e=>[e.code,e])),code=new Map(t.events.map(e=>[e.id,e.code]));
    // Explicit user-specified maxima remain hard. Exact same-day relationships,
    // hard minima, anchors and locks are never relaxed by the optimizer.
    const retain=new Set(['EVT-002>EVT-154','EVT-154>EVT-122','EVT-005>EVT-007','EVT-077>EVT-079','EVT-002>EVT-155','EVT-002>EVT-156','EVT-097>EVT-116']);
    let relaxed=0;
    for(const e of t.events)for(const d of e.dependencies){const key=code.get(d.predecessorEventId)+'>'+e.code;if(d.maxLag!=null&&d.maxLag!==0&&!retain.has(key)){d.maxLag=null;relaxed++;}}
    const meetingCodes=['EVT-141','EVT-142','EVT-144','EVT-145','EVT-148'];
    for(let i=1;i<meetingCodes.length;i++){
      const d=by.get(meetingCodes[i]).dependencies.find(d=>d.predecessorEventId===by.get(meetingCodes[i-1]).id);
      Object.assign(d,{minLag:7,targetLag:14,maxLag:42,targetWeight:2});
    }
    // Relative positions are soft preferences within the user's real project
    // window, not hard dates or a mandate to put a task in every week.
    const progress={};
    for(const th of t.threads){
      const es=t.events.filter(e=>e.threadId===th.id&&e.dateMode!=='anchor_input'),ids=new Set(es.map(e=>e.id)),depth=new Map();
      function level(e,active=new Set()){if(depth.has(e.id))return depth.get(e.id);if(active.has(e.id))throw Error('线程依赖成环');active.add(e.id);const prev=e.dependencies.filter(d=>d.strength==='hard'&&ids.has(d.predecessorEventId)).map(d=>t.events.find(x=>x.id===d.predecessorEventId));const n=prev.length?1+Math.max(...prev.map(p=>level(p,active))):0;active.delete(e.id);depth.set(e.id,n);return n;}
      for(const e of es)level(e);const max=Math.max(1,...depth.values());
      for(const e of es)progress[e.id]=.05+.7*depth.get(e.id)/max;
    }
    const stages=[['EVT-022','EVT-008'],['EVT-023','EVT-009','EVT-157','EVT-019'],['EVT-024','EVT-011','EVT-010','EVT-017'],['EVT-035','EVT-025','EVT-020','EVT-158','EVT-012','EVT-159','EVT-160'],['EVT-026','EVT-021','EVT-036','EVT-014','EVT-013','EVT-161']];
    const cadencePositions={};meetingCodes.forEach((c,i)=>{progress[by.get(c).id]=.22+.15*i;cadencePositions[by.get(c).id]=i;for(const material of stages[i]){progress[by.get(material).id]=.145+.15*i;cadencePositions[by.get(material).id]=i-.5;}});
    cadencePositions[by.get('EVT-146').id]=3.2;cadencePositions[by.get('EVT-147').id]=3.85;
    for(const [c,v]of Object.entries({'EVT-007':.10,'EVT-018':.12,'EVT-146':.70,'EVT-147':.80,'EVT-037':.86,'EVT-149':.90,'EVT-150':.94,'EVT-151':.96,'EVT-152':.97,'EVT-129':.65,'EVT-130':.78,'EVT-131':.87,'EVT-132':.91,'EVT-133':.985,'EVT-134':1,'EVT-135':.65,'EVT-136':.62,'EVT-137':.91,'EVT-138':.90,'EVT-139':.98}))progress[by.get(c).id]=v;
    for(const c of ['EVT-001','EVT-004','EVT-005','EVT-154','EVT-122','EVT-045','EVT-054','EVT-068','EVT-077','EVT-086','EVT-091','EVT-095','EVT-097','EVT-155'])progress[by.get(c).id]=.04;
    t.planningPolicy={version:1,startEventId:by.get('EVT-002').id,finishEventId:by.get('EVT-003').id,meetingEventIds:meetingCodes.map(c=>by.get(c).id),progress,cadencePositions,layoutWeight:3,ordinaryTargetWeight:.2,relaxedMaxima:relaxed};
    t.ruleRevision=VERSION;t.updatedAt=new Date().toISOString();return t;
  }
  const api={VERSION,revise};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.IPOFlexiblePlanning=api;
})(typeof globalThis!=='undefined'?globalThis:this);
