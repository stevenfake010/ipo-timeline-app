/* Meeting/draft feedback migration. Explicit copy only; never mutates input. */
(function(root){
  'use strict';
  const VERSION='2026-10-30-r3',copy=x=>JSON.parse(JSON.stringify(x));
  function revise(input,reviewedR2){
    if(input.ruleRevision===VERSION)throw new Error('当前已经是招股书大会修订版。');
    if(!reviewedR2||reviewedR2.ruleRevision!=='2026-10-29-r2'||input.ruleRevision!==reviewedR2.ruleRevision||['events','threads','lanes'].some(k=>JSON.stringify(input[k])!==JSON.stringify(reviewedR2[k])))throw new Error('请先载入已核对的核心修订版。当前规则如有手工改动，须逐项合并，未自动覆盖。');
    const t=copy(input),by=new Map(t.events.map(e=>[e.code,e])),changes=[];
    function set(a,b,min,target,max,unit,reason){
      const e=by.get(b),from=by.get(a);if(!e||!from)throw new Error('缺少既有事件 '+a+' / '+b);
      let d=e.dependencies.find(x=>x.predecessorEventId===from.id),before=d?copy(d):null;
      if(!d){d={id:'revision-r3-'+a+'-'+b,predecessorEventId:from.id,calendar:'inherit',strength:'hard'};e.dependencies.push(d);}
      Object.assign(d,{minLag:min,targetLag:target,maxLag:max,unit});
      changes.push({action:before?'修改':'新增关系',from:a,to:b,before,after:copy(d),reason});
    }
    const read=(a,b)=>set(a,b,1,2,null,'business_day','会前材料至少提前1工作日传阅，目标2工作日；计划假设，可调整。');
    const feedback=(a,b)=>set(a,b,2,5,null,'business_day','吸收大会反馈后形成该阶段稿件，最短2、目标5工作日；不增加稿件事件。');
    const version=(a,b)=>set(a,b,2,null,null,'business_day','保留相邻版本至少2工作日修改时间；目标工期由会议反馈关系控制，取消旧版有限最长造成的冲突。');
    // Conference 1 confirms the OSS direction; preparation remains parallel.
    read('EVT-007','EVT-141');read('EVT-008','EVT-141');
    feedback('EVT-141','EVT-022');
    set('EVT-007','EVT-022',0,null,null,'calendar_day','OSS中文初稿已有框架输入，具体撰写时间从第1次大会确认方向后计算。');
    set('EVT-006','EVT-022',0,null,null,'calendar_day','资料需求就绪关系，不对资料设置虚构有效期。');
    set('EVT-141','EVT-019',5,7,null,'business_day','用户确认：第1次大会确定OSS方向后，律师推进正式业务初稿；最短5、目标7工作日。');
    set('EVT-022','EVT-019',2,5,null,'business_day','业务初稿同时需要OSS中文文字稿作为输入，最短2、目标5工作日；与会议工期共同取交集，不相加。');
    set('EVT-018','EVT-019',7,null,null,'calendar_day','保留补充资料需求后的原最短准备时间，不让旧最长值迫使业务稿在方向确认前完成。');
    // Conference 2 reviews first drafts; the named updates now incorporate it.
    for(const a of ['EVT-022','EVT-019','EVT-009'])read(a,'EVT-142');
    for(const b of ['EVT-023','EVT-020','EVT-011'])feedback('EVT-142',b);
    for(const [a,b] of [['EVT-022','EVT-023'],['EVT-019','EVT-020'],['EVT-009','EVT-011']])version(a,b);
    // Conference 3 integrates updated narrative, industry evidence and UoP.
    for(const a of ['EVT-023','EVT-020','EVT-010','EVT-017'])read(a,'EVT-144');
    feedback('EVT-144','EVT-025');version('EVT-024','EVT-025');
    feedback('EVT-144','EVT-013');version('EVT-011','EVT-013');
    // Conference 4 aligns the financial and business narrative; the next finance
    // and near-final OSS/business versions must incorporate that discussion.
    for(const a of ['EVT-025','EVT-035','EVT-020','EVT-011','EVT-017'])read(a,'EVT-145');
    for(const b of ['EVT-036','EVT-026','EVT-021'])feedback('EVT-145',b);
    for(const [a,b] of [['EVT-035','EVT-036'],['EVT-025','EVT-026'],['EVT-020','EVT-021']])version(a,b);
    // Conference 5 reviews the complete bilingual draft. Earlier conference
    // outputs are already prerequisites through the conference/translation path.
    read('EVT-147','EVT-148');
    feedback('EVT-148','EVT-037');version('EVT-036','EVT-037');
    set('EVT-030','EVT-037',0,null,null,'calendar_day','财务章节基本定稿仍需审计数字就绪，取消无必要的独立等待与有效期。');
    set('EVT-148','EVT-149',5,10,null,'business_day','第5次全本审阅后形成接近终稿全本，最短5、目标10工作日；不是新增事件。');
    for(const [a,b,target] of [['EVT-141','EVT-142',14],['EVT-142','EVT-144',14],['EVT-144','EVT-145',7]])set(a,b,5,target,null,'calendar_day','保留会议顺序及节奏目标，取消无业务依据的硬最长；实际最早日期仍受会前稿与会后修改共同约束。');
    const agenda=[
      {eventCode:'EVT-141',purpose:'确定OSS框架与行业叙事方向',inputs:['EVT-007','EVT-008'],outputs:['EVT-022','EVT-019']},
      {eventCode:'EVT-142',purpose:'审阅OSS、业务与行业初稿',inputs:['EVT-022','EVT-019','EVT-009'],outputs:['EVT-023','EVT-020','EVT-011']},
      {eventCode:'EVT-144',purpose:'整合更新后的业务逻辑、行业依据和募集资金用途',inputs:['EVT-023','EVT-020','EVT-010','EVT-017'],outputs:['EVT-025','EVT-013']},
      {eventCode:'EVT-145',purpose:'财务与OSS、业务、行业和募集资金用途衔接',inputs:['EVT-025','EVT-035','EVT-020','EVT-011','EVT-017'],outputs:['EVT-036','EVT-026','EVT-021','EVT-146']},
      {eventCode:'EVT-148',purpose:'审阅中英文全本并落实最终整合意见',inputs:['EVT-147'],outputs:['EVT-037','EVT-149']}
    ];
    t.ruleRevision=VERSION;t.updatedAt=new Date().toISOString();
    return{template:t,changes,agenda,version:VERSION};
  }
  const api={VERSION,revise};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.IPOProspectusRevision=api;
})(typeof globalThis!=='undefined'?globalThis:this);
