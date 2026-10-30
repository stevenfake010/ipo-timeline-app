(function(root){
  'use strict';
  const VERSION='2026-10-30-r7',copy=x=>JSON.parse(JSON.stringify(x));
  function revise(input){
    if(input.ruleRevision!=='2026-10-30-r6')throw Error('会议规则升级需要已核对的上一版');
    const t=copy(input),by=new Map(t.events.map(e=>[e.code,e])),get=c=>{if(!by.has(c))throw Error('缺少 '+c);return by.get(c);};
    function set(a,b,min,target,max,unit='business_day',weight=1){const e=get(b);let d=e.dependencies.find(d=>d.predecessorEventId===get(a).id);if(!d){d={id:'r7-'+a+'-'+b,predecessorEventId:get(a).id,calendar:'inherit',strength:'hard'};e.dependencies.push(d);}Object.assign(d,{minLag:min,targetLag:target,maxLag:max,unit,targetWeight:weight});}
    function remove(a,b){get(b).dependencies=get(b).dependencies.filter(d=>d.predecessorEventId!==get(a).id);}
    function add(code,name,th){const e={id:'evt-r7-'+code,code,name,threadId:get(th).threadId,dateMode:'calculated',description:'',dependencies:[]};if(by.has(code))throw Error('编码冲突');t.events.push(e);by.set(code,e);}
    add('EVT-158','传阅UoP章节更新稿','EVT-017');
    add('EVT-159','传阅招股书风险因素章节完整稿','EVT-157');
    add('EVT-160','传阅招股书监管章节完整稿','EVT-157');
    add('EVT-161','传阅其他招股书章节完整稿','EVT-157');
    const meetings=['EVT-141','EVT-142','EVT-144','EVT-145','EVT-148'];
    const inputs=[['EVT-022','EVT-008'],['EVT-023','EVT-009','EVT-157','EVT-019'],['EVT-024','EVT-011','EVT-010','EVT-017'],['EVT-035','EVT-025','EVT-020','EVT-158','EVT-012','EVT-159','EVT-160'],['EVT-026','EVT-021','EVT-036','EVT-014','EVT-013','EVT-161']];
    const staged=new Set(inputs.flat());
    // Replace all stale meeting-to-agenda and agenda-to-meeting edges together,
    // so the old direction-confirmation convention cannot create a cycle.
    for(const e of t.events)e.dependencies=e.dependencies.filter(d=>!(staged.has(e.code)&&meetings.some(c=>get(c).id===d.predecessorEventId)));
    for(const m of meetings)get(m).dependencies=get(m).dependencies.filter(d=>!t.events.some(e=>staged.has(e.code)&&e.id===d.predecessorEventId));
    remove('EVT-007','EVT-141'); // First conference now reviews OSS initial text.
    for(let i=0;i<meetings.length;i++){
      for(const c of inputs[i]){if(i)set(meetings[i-1],c,2,5,null);set(c,meetings[i],1,2,null);}
      if(i)set(meetings[i-1],meetings[i],7,14,28,'calendar_day',20);
    }
    // Preserve version chains, but do not let old expiry caps override the new stages.
    for(const [a,b]of [['EVT-007','EVT-022'],['EVT-022','EVT-023'],['EVT-023','EVT-024'],['EVT-024','EVT-025'],['EVT-025','EVT-026'],['EVT-019','EVT-020'],['EVT-020','EVT-021'],['EVT-008','EVT-009'],['EVT-009','EVT-011'],['EVT-011','EVT-010'],['EVT-010','EVT-012'],['EVT-011','EVT-013'],['EVT-013','EVT-014'],['EVT-012','EVT-014'],['EVT-035','EVT-036'],['EVT-017','EVT-158'],['EVT-157','EVT-159'],['EVT-159','EVT-161'],['EVT-160','EVT-161']])set(a,b,2,null,null);
    // Fifth conference is a complete-book review: all specified near-final
    // chapters must be ready before the bilingual whole-book first draft.
    for(const c of inputs[4])set(c,'EVT-147',0,null,null,'calendar_day');
    set('EVT-147','EVT-148',1,2,null);
    t.ruleRevision=VERSION;t.updatedAt=new Date().toISOString();
    const purposes=['OSS中文初稿及行业框架','OSS中文更新、行业初稿、风险标题及业务初稿','OSS英文初稿、行业更新及报告、UoP初稿','财务及各章节更新、风险因素和监管完整稿','整本招股书审阅'];
    return{template:t,agenda:meetings.map((eventCode,i)=>({eventCode,purpose:purposes[i],inputs:i===4?[...inputs[i],'EVT-147']:inputs[i],outputs:i<4?inputs[i+1]:['EVT-037','EVT-149']}))};
  }
  const api={VERSION,revise};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.IPOMeetingCycle=api;
})(typeof globalThis!=='undefined'?globalThis:this);
