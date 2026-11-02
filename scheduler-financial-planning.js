/* Project-specific dependency compilation. Never rewrites the input library or saved plans. */
(function(root){
  'use strict';
  const VERSION='2026-11-02-finance-v1',copy=x=>JSON.parse(JSON.stringify(x));
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
      edge('EVT-027','EVT-164',0,3);edge('EVT-029','EVT-164');edge('EVT-164','EVT-165',2,5);
      edge('EVT-165','EVT-030',2,5);edge('EVT-165','EVT-036',2,5);
      edge('EVT-162','EVT-166',2,5);edge('EVT-079','EVT-166');
      edge('EVT-166','EVT-167',1,3);edge('EVT-027','EVT-167');edge('EVT-081','EVT-167');
      edge('EVT-167','EVT-168',2,5);edge('EVT-084','EVT-168');edge('EVT-168','EVT-085');
    }
    // Preparatory requests and assumptions can start early. Substantive outputs require auditor data.
    edge(source,'EVT-040',3,5);edge(source,'EVT-081');
    // Updating the model and preparing the first PFM can proceed in parallel after the first model.
    unlink('EVT-041','EVT-042');edge('EVT-040','EVT-042',2,5);edge('EVT-162','EVT-042',3,5);
    edge('EVT-041','EVT-043',2,5);
    get('EVT-042').name='传阅财务模型更新稿（纳入完整报告期数据）';
    // Correct the historical spelling while retaining stable IDs/codes.
    get('EVT-041').name='传阅PFM初稿';get('EVT-043').name='传阅PFM更新稿';
    t.financialStrategy={version:1,revision:VERSION,mode,fullAnchorId:full.id,firstAnchorId:mode==='staged'?get('EVT-163').id:null};
    if(t.planningPolicy){
      const p=t.planningPolicy.progress;
      if(mode==='staged')for(const [c,v]of Object.entries({'EVT-028':.15,'EVT-029':.23,'EVT-040':.3,'EVT-164':.65,'EVT-165':.72,'EVT-166':.62,'EVT-167':.7,'EVT-168':.85}))p[get(c).id]=v;
    }
    return t;
  }
  const api={VERSION,supported,create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.IPOFinancialPlanning=api;
})(typeof globalThis!=='undefined'?globalThis:this);
