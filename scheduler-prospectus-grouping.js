/* Reorganize the existing seven threads; keep event IDs and dependencies intact. */
(function(root){
  'use strict';
  const VERSION='2026-10-30-r6',copy=x=>JSON.parse(JSON.stringify(x));
  function revise(input){
    if(input.ruleRevision!=='2026-10-30-r5')throw Error('事件库不是已核对的上一版，未自动整理。');
    const t=copy(input),laneId='lane-r6-prospectus-writing';
    if(t.lanes.some(l=>l.id===laneId||l.name==='招股书撰写'))throw Error('招股书撰写条线已存在');
    const labels=[['招股书OSS撰写','OSS 撰写'],['行业条线','行业章节及报告'],['UoP','募集资金用途（UoP）'],['招股书业务章节撰写','业务章节撰写'],['招股书财务章节撰写','财务章节撰写'],['其他招股书章节撰写','其他章节撰写'],['招股书大会','招股书大会及全本整合']];
    const moved=labels.map(([oldName,name])=>{const matches=t.threads.filter(th=>th.name===oldName);if(matches.length!==1)throw Error('线程无法唯一匹配：'+oldName);const th=matches[0];th.name=name;th.laneId=laneId;return th;});
    const oldLane=t.lanes.find(l=>l.name==='其他重点尽调及其他招股书章节撰写');if(!oldLane)throw Error('缺少原条线');oldLane.name='其他重点尽调';
    t.lanes.splice(1,0,{id:laneId,name:'招股书撰写',description:''});
    const movedIds=new Set(moved.map(th=>th.id));t.threads=[...t.threads.filter(th=>!movedIds.has(th.id)),...moved];
    t.ruleRevision=VERSION;t.updatedAt=new Date().toISOString();return t;
  }
  const api={VERSION,revise};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.IPOProspectusGrouping=api;
})(typeof globalThis!=='undefined'?globalThis:this);
