/* Explicit, versioned migration of the reviewed 124-event snapshot. Never runs
 * on browser storage automatically; caller creates a separate plan. */
(function(root){
  'use strict';
  const VERSION='2026-10-29-r2',copy=x=>JSON.parse(JSON.stringify(x));
  function revise(input,baseline){
    if(input.ruleRevision===VERSION)throw new Error('当前规则已经是本次修订版，无需重复应用。');
    if(!baseline||JSON.stringify(input.events)!==JSON.stringify(baseline.events)||JSON.stringify(input.threads)!==JSON.stringify(baseline.threads)||JSON.stringify(input.lanes)!==JSON.stringify(baseline.lanes))throw new Error('当前事件或规则与已核对的初稿不同。为保护你的手工修改，未自动合并，请导出后逐项核对。');
    const t=copy(input),changes=[],by=new Map(t.events.map(e=>[e.code,e]));
    function dep(a,b){return by.get(b).dependencies.find(d=>d.predecessorEventId===by.get(a).id);}
    function change(a,b,patch,reason){const d=dep(a,b);if(!d)throw new Error('缺少待修订关系 '+a+' → '+b);const before=copy(d);Object.assign(d,patch);changes.push({action:'修改',from:a,to:b,before,after:copy(d),reason});}
    function remove(a,b,reason){const ds=by.get(b).dependencies,d=dep(a,b);if(!d)throw new Error('缺少待删除关系 '+a+' → '+b);by.get(b).dependencies=ds.filter(x=>x!==d);changes.push({action:'删除关系',from:a,to:b,before:copy(d),reason});}
    function add(a,b,min,target,max,reason,unit='calendar_day'){
      if(dep(a,b))throw new Error('关系已存在 '+a+' → '+b);
      const d={id:'revision-r2-'+a+'-'+b,predecessorEventId:by.get(a).id,minLag:min,targetLag:target,maxLag:max,unit,calendar:'inherit',strength:'hard'};
      by.get(b).dependencies.push(d);changes.push({action:'新增关系',from:a,to:b,after:copy(d),reason});
    }
    // Human-approved project deadline, not a claim about the legal filing event.
    add('EVT-139','EVT-134',0,null,null,'用户确认：备案文件须在A1当天或之前定稿；不增加或替代备案报送事件。');
    add('EVT-122','EVT-134',2,null,null,'用户按各家同日签署假设；本版暂以同日签署并生效计算至A1至少2自然月（HKEX 3A.02B）。若聘任函生效更晚或通知延迟影响正式委任日期，须调整口径。','calendar_month');
    add('EVT-012','EVT-014',0,null,null,'报告终稿须吸收同一报告更新稿，补齐版本链；无依据的目标等待和硬最长留空。');
    remove('EVT-084','EVT-101','调档启动保留自身范围计划前置，不再被第三方走访启动拖延。');
    for(const [a,b] of [['EVT-125','EVT-126'],['EVT-126','EVT-127'],['EVT-127','EVT-128'],['EVT-135','EVT-136'],['EVT-136','EVT-137'],['EVT-137','EVT-138']])remove(a,b,'仅为错周添加的软串行关系删除，错周交由优化器，不改变各自业务前置。');
    remove('EVT-025','EVT-147','用户确认第一轮合稿可使用对应语言章节初稿。');
    remove('EVT-036','EVT-147','用户确认第一轮合稿可使用章节初稿。');
    add('EVT-024','EVT-147',0,null,null,'第一轮双语合稿需要已有OSS英文初稿，不强制等更新稿。');
    add('EVT-035','EVT-147',0,null,null,'第一轮合稿需要财务章节初稿，不强制等更新稿。');
    add('EVT-019','EVT-147',0,null,null,'第一轮合稿纳入业务章节初稿。');
    add('EVT-009','EVT-147',0,null,null,'第一轮合稿纳入行业章节初稿。');
    add('EVT-017','EVT-147',0,null,null,'第一轮合稿纳入现有UoP章节初稿，不新增章节事件。');
    for(const a of ['EVT-023','EVT-010','EVT-017'])add(a,'EVT-144',0,null,null,'按本版第3次会议讨论OSS更新、行业报告和UoP的议题补齐材料就绪条件；不从案例周次臆造额外等待。');
    for(const a of ['EVT-020','EVT-011','EVT-017'])add(a,'EVT-145',0,null,null,'第4次会议讨论业务、行业和UoP更新进展，相关现有材料须已就绪。');
    add('EVT-153','EVT-027',0,null,null,'按既定财务报表基准日口径，报告期审计报告初稿不早于报告期末；不声称已覆盖财务资料有效期。');
    // Ready-to-use inputs: ordering only, not an extra suggested wait on every branch.
    for(const a of ['EVT-026','EVT-021','EVT-014','EVT-017','EVT-076'])change(a,'EVT-149',{targetLag:null,maxLag:null},'全本接近终稿的内容就绪关系，取消无独立依据的目标等待和最长有效期。');
    for(const a of ['EVT-051','EVT-065','EVT-090','EVT-085','EVT-120','EVT-115','EVT-044','EVT-033'])change(a,'EVT-150',{targetLag:null,maxLag:null},'最终验证须等相关工作完成，但不为每条汇合边设置额外理想等待或虚构有效期。');
    for(const a of ['EVT-115','EVT-151'])change(a,'EVT-139',{targetLag:null,maxLag:null},'备案文件定稿需口径衔接；完成期限由A1汇合边控制。');
    // Preparation can start promptly. Actual substantive work minima are retained.
    for(const [a,b,target] of [['EVT-002','EVT-054',0],['EVT-058','EVT-060',0],['EVT-002','EVT-077',0],['EVT-077','EVT-078',3],['EVT-079','EVT-081',0],['EVT-081','EVT-084',0],['EVT-002','EVT-086',0],['EVT-086','EVT-087',14],['EVT-087','EVT-089',0],['EVT-002','EVT-068',0],['EVT-002','EVT-097',0],['EVT-002','EVT-091',0],['EVT-002','EVT-095',3],['EVT-095','EVT-104',0],['EVT-145','EVT-146',0],['EVT-147','EVT-148',3]])change(a,b,{targetLag:target},'修正此前估算的准备/协调等待，不再为错周强加一周目标；原最短和最长不变。');
    // Rectification and report preparation are concurrent branches, reunited at final.
    remove('EVT-062','EVT-063','整改完成不必等待长版报告初稿；整改按自身执行时间推进。');
    add('EVT-060','EVT-063',14,28,null,'整改独立执行，暂按最短14、目标28自然日估算，无硬最长；需按实际问题复杂程度调整。');
    remove('EVT-063','EVT-064','报告更新可以与整改并行，不必等所有问题整改完毕。');
    add('EVT-062','EVT-064',3,7,null,'长版报告初稿至更新稿保留审阅时间。');
    add('EVT-063','EVT-065',0,null,null,'最终内控报告仍必须等整改完成，避免并行化后漏掉完成条件。');
    // Modest explicit review windows, rather than zero-day final convergence.
    change('EVT-150','EVT-151',{minLag:1,targetLag:2,maxLag:10,unit:'business_day'},'用户授权调整估算间隔：验证完成后至少1工作日整合，目标2工作日；属于计划假设，不是监管期限。');
    change('EVT-133','EVT-134',{minLag:1,targetLag:1,maxLag:3,unit:'business_day'},'全套A1文件定稿至报送预留至少1工作日准备；计划假设，可人工修订。');
    // Make independent appointments timely preferences without fictitious serial edges.
    t.ruleRevision=VERSION;t.schemaVersion='1.5';t.updatedAt=new Date().toISOString();
    return{template:t,changes,version:VERSION};
  }
  const api={VERSION,revise};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.IPORuleRevision=api;
})(typeof globalThis!=='undefined'?globalThis:this);
