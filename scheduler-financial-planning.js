/* Project-specific dependency compilation. Never rewrites the input library or saved plans. */
(function(root){
  'use strict';
  const VERSION='2026-11-02-finance-v3',copy=x=>JSON.parse(JSON.stringify(x));
  function supported(t){return !!t&&t.ruleRevision==='2026-10-30-r8'&&!t.financialStrategy&&Array.isArray(t.events)&&!t.events.some(e=>/^EVT-16[2-8]$/.test(e.code)||/^finance-v1-/.test(e.id))&&['EVT-027','EVT-028','EVT-029','EVT-030','EVT-035','EVT-036','EVT-038','EVT-040','EVT-041','EVT-042','EVT-043','EVT-044','EVT-079','EVT-081','EVT-084','EVT-085','EVT-153'].every(c=>t.events.some(e=>e.code===c));}
  function create(input,mode='complete'){
    if(!['complete','staged'].includes(mode))throw Error('财务工作开展方式无效');
    if(!supported(input))throw Error('此规则快照未适配财务锚点策略，请保留原方案并使用当前默认规则新建');
    const t=copy(input),by=new Map(t.events.map(e=>[e.code,e]));
    const get=c=>{const e=by.get(c);if(!e)throw Error('缺少事件 '+c);return e;};
    function add(code,name,ref,anchor=false){if(by.has(code))throw Error('财务策略事件编码冲突：'+code);const e={id:'finance-v1-'+code,code,name,threadId:get(ref).threadId,dateMode:anchor?'anchor_input':'calculated',description:'',dependencies:[]};t.events.push(e);by.set(code,e);return e;}
    function unlink(a,b){get(b).dependencies=get(b).dependencies.filter(d=>d.predecessorEventId!==get(a).id);}
    function edge(a,b,min=0,target=null,unit='business_day'){unlink(a,b);get(b).dependencies.push({id:'finance-v1-'+a+'-'+b,predecessorEventId:get(a).id,minLag:min,targetLag:target,maxLag:null,unit,calendar:'inherit',strength:'hard'});}
    const full=add('EVT-162','完整报告期财务数据可用日','EVT-027',true);
    edge('EVT-153','EVT-162',0,null,'calendar_day');
    // Report delivery is distinct from data readiness. Do not estimate data readiness from kickoff.
    unlink('EVT-001','EVT-027');edge('EVT-162','EVT-027',0,3);
    const source=mode==='staged'?'EVT-163':'EVT-162';
    if(mode==='staged'){
      add('EVT-163','首批财务数据可用日','EVT-027',true);
      edge('EVT-163','EVT-162',0,null,'calendar_day');
      add('EVT-164','传阅完整报告期补充财务尽调问卷','EVT-028');
      add('EVT-165','完成完整报告期补充财务尽调访谈','EVT-029');
      add('EVT-166','公司提供完整报告期第三方尽调更新资料','EVT-079');
      add('EVT-167','结合完整报告期审计数据复核第三方尽调范围','EVT-081');
      add('EVT-168','完成完整报告期必要的补充第三方尽调及覆盖核对','EVT-085');
      get('EVT-028').name='传阅首批期间财务尽调问卷';get('EVT-029').name='完成首批期间财务尽调访谈';
      get('EVT-035').name='传阅招股书财务章节初稿（基于首批期间数据）';
      get('EVT-040').name='传阅财务模型初稿（基于首批期间数据）';
      get('EVT-081').name='确定首批第三方尽调范围及安排';
      get('EVT-036').name='传阅招股书财务章节更新稿（纳入完整报告期数据）';
      unlink('EVT-027','EVT-028');edge('EVT-163','EVT-028',0,3);
      edge('EVT-027','EVT-164',2,3);edge('EVT-029','EVT-164');edge('EVT-164','EVT-165',3,5);
      edge('EVT-165','EVT-030',3,5);edge('EVT-165','EVT-036',3,5);
      edge('EVT-162','EVT-166',2,5);edge('EVT-079','EVT-166');
      edge('EVT-166','EVT-167',2,3);edge('EVT-027','EVT-167',2,3);edge('EVT-081','EVT-167');
      edge('EVT-167','EVT-168',3,7);edge('EVT-084','EVT-168');edge('EVT-168','EVT-085');
      edge('EVT-042','EVT-043',3,5);edge('EVT-043','EVT-044',3,5);
    }
    // Preparatory requests and assumptions can start early. Substantive outputs require auditor data.
    edge(source,'EVT-040',3,5);edge(source,'EVT-081');
    // Updating the model and preparing the first PFM can proceed in parallel after the first model.
    unlink('EVT-041','EVT-042');edge('EVT-040','EVT-042',2,5);edge('EVT-162','EVT-042',3,5);
    edge('EVT-041','EVT-043',2,5);
    get('EVT-042').name='传阅财务模型更新稿（纳入完整报告期数据）';
    // Correct the historical spelling while retaining stable IDs/codes.
    get('EVT-041').name='传阅PFM初稿';get('EVT-043').name='传阅PFM更新稿';
    // Debt statements have their own recent reference date; comfort-letter drafting is parallel.
    unlink('EVT-029','EVT-031');edge('EVT-002','EVT-031');
    unlink('EVT-031','EVT-032');edge('EVT-027','EVT-032',0,5);
    unlink('EVT-032','EVT-033');edge('EVT-031','EVT-033',8,10);
    edge('EVT-033','EVT-003',0,5);get('EVT-003').dependencies.find(d=>d.predecessorEventId===get('EVT-033').id).targetWeight=8;
    edge('EVT-033','EVT-151',0,1);
    t.debtPolicy={version:1,startEventId:get('EVT-031').id,completeEventId:get('EVT-033').id,finalizeEventId:get('EVT-151').id,a1EventId:get('EVT-003').id,maxAgeMonths:2,minPreparationDays:8,targetPreparationDays:10,bufferDays:5,calendar:'inherit'};
    // Incorporating new chapter text/numbers into BOTH languages takes time.
    for(const c of ['EVT-026','EVT-021','EVT-036','EVT-014','EVT-013','EVT-161'])edge(c,'EVT-147',2,3);
    // A report supplies the updated industry chapter, rather than depending on that chapter.
    unlink('EVT-011','EVT-010');edge('EVT-008','EVT-010',2,null);edge('EVT-010','EVT-011',1,2);
    edge('EVT-081','EVT-084',2,5);
    if(mode==='staged'){
      // Company transaction data may precede the auditor's numbers. Final scope still reconciles to audit.
      get('EVT-166').name='公司提供完整报告期第三方尽调基础更新资料（待审计勾稽）';
      unlink('EVT-162','EVT-166');edge('EVT-153','EVT-166',5,10);
    }
    t.financialStrategy={version:1,revision:VERSION,mode,fullAnchorId:full.id,firstAnchorId:mode==='staged'?get('EVT-163').id:null};
    if(t.planningPolicy){
      const p=t.planningPolicy.progress;
      if(mode==='staged')for(const [c,v]of Object.entries({'EVT-028':.15,'EVT-029':.23,'EVT-040':.3,'EVT-164':.65,'EVT-165':.72,'EVT-166':.62,'EVT-167':.7,'EVT-168':.85}))p[get(c).id]=v;
      if(mode==='staged'){
        // Late data makes absolute project-percentage targets fall in the past.
        // Plan the update cycle relative to actual data availability instead.
        // These are soft targets, NOT new fixed dates, deadlines or cross-thread serial edges.
        const lags={'EVT-027':3,'EVT-164':6,'EVT-165':11,'EVT-030':16,'EVT-036':16,'EVT-042':5,'EVT-043':10,'EVT-044':16,'EVT-166':5,'EVT-167':8,'EVT-168':15,'EVT-085':15};
        t.planningPolicy.anchorRelativeTargets={};
        for(const [c,lag]of Object.entries(lags))t.planningPolicy.anchorRelativeTargets[get(c).id]={anchorEventId:full.id,lag,unit:'business_day',calendar:'inherit'};
        t.planningPolicy.anchorRelativeTargets[get('EVT-166').id]={anchorEventId:get('EVT-153').id,lag:10,unit:'business_day',calendar:'inherit'};
      }
      // Only explicit chapter/conference/filing phases retain percentage guidance.
      // Generic thread-depth percentages caused unrelated finals to converge at 75%.
      const conferenceCodes=['EVT-141','EVT-142','EVT-144','EVT-145','EVT-148'];
      const explicit=new Set([...conferenceCodes,...Object.keys(t.planningPolicy.cadencePositions||{}).map(id=>t.events.find(e=>e.id===id)?.code),
        'EVT-007','EVT-018','EVT-037','EVT-146','EVT-147','EVT-149','EVT-150','EVT-151','EVT-152','EVT-129','EVT-130','EVT-131','EVT-132','EVT-133','EVT-134','EVT-135','EVT-136','EVT-137','EVT-138','EVT-139']);
      for(const e of t.events)if(!explicit.has(e.code))delete p[e.id];
      t.planningPolicy.layoutWeight=.4;t.planningPolicy.ordinaryTargetWeight=1;
      t.planningPolicy.eventLayoutWeights={};
      // Keep the explicit data-relative update targets stronger than broad project layout.
      for(const id of Object.keys(t.planningPolicy.anchorRelativeTargets||{}))t.planningPolicy.eventLayoutWeights[id]=3;
      t.planningPolicy.anchorRelativeTargets ||= {};
      for(const [code,lag]of [['EVT-031',-15],['EVT-033',-5]]){
        t.planningPolicy.anchorRelativeTargets[get(code).id]={anchorEventId:get('EVT-003').id,lag,unit:'business_day',calendar:'inherit'};
        t.planningPolicy.eventLayoutWeights[get(code).id]=2;
      }
    }
    return t;
  }
  const api={VERSION,supported,create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.IPOFinancialPlanning=api;
})(typeof globalThis!=='undefined'?globalThis:this);
