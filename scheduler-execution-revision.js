/* Approved execution workflow. Project-specific copy only; no writes to stored libraries. */
(function(root){
  'use strict';
  const VERSION='2026-11-13-execution-v7';
  function apply(t,options={}){
    const by=new Map(t.events.map(e=>[e.code,e])),code=n=>'EVT-'+String(n).padStart(3,'0'),get=n=>{const e=by.get(code(n));if(!e)throw Error('缺少事件 '+code(n));return e;},p=t.planningPolicy;
    function thread(key,name,ref){const id='execution-v6-'+key;if(t.threads.some(x=>x.id===id))throw Error('线程编码冲突');t.threads.push({id,name,laneId:t.threads.find(x=>x.id===get(ref).threadId).laneId,description:''});return id;}
    function add(n,name,th){if(by.has(code(n)))throw Error('事件编码冲突：'+code(n));const e={id:'execution-v6-'+code(n),code:code(n),name,threadId:th,dateMode:'calculated',dependencies:[],description:''};t.events.push(e);by.set(e.code,e);return e;}
    function remove(a,b){get(b).dependencies=get(b).dependencies.filter(d=>d.predecessorEventId!==get(a).id);}
    function edge(a,b,min=0,target=null,strength='hard'){remove(a,b);get(b).dependencies.push({id:'execution-v6-'+code(a)+'-'+code(b),predecessorEventId:get(a).id,minLag:min,targetLag:target,maxLag:null,unit:'business_day',calendar:'inherit',strength});}
    function target(n,lag,anchor=3,unit='business_day'){if(!p)return;p.anchorRelativeTargets[get(n).id]={anchorEventId:get(anchor).id,lag,unit,calendar:'inherit'};p.eventLayoutWeights[get(n).id]=4;delete p.progress[get(n).id];delete p.cadencePositions[get(n).id];}
    function ready(n,candidates,after,targetLag){t.readinessGroups.push({id:'readiness-'+code(n),eventId:get(n).id,anyOf:candidates.map(n=>get(n).id),readyAfterEventIds:after.map(n=>get(n).id),minLag:0,targetLag,unit:'business_day',calendar:'inherit'});}
    t.readinessGroups=[];
    // Low-effort requests may share kickoff week. The MDD completion/notes/outline chain is untouched.
    for(const n of [1,18,38,54,68,77,86,91,95,97,154]){
      if([18,38,95].includes(n)){get(n).dependencies=[];edge(2,n,0,1);}
      get(n).spreadWeeks=false;target(n,n===95?2:1,2);
    }
    get(19).name='传阅业务章节英文初稿';get(20).name='传阅业务章节英文更新稿';get(21).name='传阅业务章节英文终稿';
    get(9).name='传阅行业概览章节英文初稿';get(11).name='传阅行业概览章节英文更新稿';get(13).name='传阅行业概览章节英文终稿';
    get(159).name='传阅招股书风险因素章节英文完整稿';
    edge(24,19,0,null,'soft'); // Same day is allowed; not a new hard serial bottleneck.
    const hk=thread('hk-chapter','香港章节撰写',19);
    add(185,'传阅招股书香港章节英文初稿',hk);add(186,'传阅招股书香港章节英文更新稿',hk);add(187,'定稿招股书香港章节',hk);
    edge(2,185,5);edge(185,186,2);edge(186,187,2);edge(187,147,2,3);
    // One agenda definition supplies both dependencies and visible conference content.
    const meetings=[141,142,144,145,148],inputs=[
      [22,8], [23,9,157], [24,19,11,10,17,159,160,185],
      [35,25,20,158,12,186], [26,21,36,14,13,161,187,147]
    ];
    const staged=new Set(inputs.flat().filter(n=>n!==147)),meetingIds=new Set(meetings.map(n=>get(n).id));
    for(const n of staged)get(n).dependencies=get(n).dependencies.filter(d=>!meetingIds.has(d.predecessorEventId));
    const materialIds=new Set([...staged].map(n=>get(n).id));
    for(const n of meetings)get(n).dependencies=get(n).dependencies.filter(d=>!materialIds.has(d.predecessorEventId));
    for(let i=0;i<meetings.length;i++)for(const n of inputs[i]){
      if(n===147)continue;
      if(i)edge(meetings[i-1],n,2,5);
      edge(n,meetings[i],1);
      if(p){p.cadencePositions[get(n).id]=i-.5;p.progress[get(n).id]=Math.max(0,(i-.5)/5);}
    }
    const purpose=['OSS中文初稿、行业概览框架','OSS中文更新稿、行业英文初稿、风险因素标题稿','OSS及业务英文初稿、行业更新及报告、UoP初稿、风险因素及监管完整稿、香港章节初稿','财务章节初稿、OSS及业务更新稿、UoP及行业报告更新稿、香港章节更新稿','整本招股书、各章节最终及更新版本'];
    t.conferenceAgenda=meetings.map((n,i)=>({eventCode:code(n),purpose:purpose[i],inputs:inputs[i].map(code),outputs:(inputs[i+1]||[37,149]).map(code)}));
    for(let i=0;i<meetings.length;i++)get(meetings[i]).name=`召开第${i+1}次招股书讨论会（讨论：${purpose[i]}）`;
    // Appointment outcomes are independent A1-backward targets. Preserve the sponsor hard lead time.
    get(156).name='确定印刷商';get(124).name='传阅公司秘书聘任文件初稿';
    for(const n of [156,124,126,127,128]){get(n).dependencies=[];edge(2,n);}
    edge(124,125,2,5);
    for(const [n,lag]of [[154,-50],[156,-45],[124,-40],[125,-35],[126,-20],[127,-25],[128,-20]])target(n,lag);
    target(122,-2,3,'calendar_month');edge(125,175);edge(126,133);edge(128,133);
    // Translation starts after printer AND any eligible English draft, not after conference 4.
    remove(145,146);edge(2,146);edge(156,146);get(146).name='启动招股书英文稿滚动中文翻译';
    ready(146,[24,19,9,159,185],[156],2);edge(146,147,5); // final chapter incorporation lags remain in force
    if(p){delete p.progress[get(146).id];delete p.cadencePositions[get(146).id];}
    add(188,'开展招股书验证培训并传阅验证要求',get(150).threadId);
    add(189,'启动招股书章节滚动验证',get(150).threadId);
    edge(2,188,0,5);target(188,5,2);edge(188,189);ready(189,[22,9,19,35,159,185],[188],2);edge(189,150,5);
    // Third-party execution: documents collected alongside interviews; final scope includes full-period data.
    add(190,'启动第三方尽调穿行文件及支持材料收集',get(85).threadId);
    add(191,'完成第三方尽调穿行文件及支持材料收集',get(85).threadId);
    add(192,'完成第三方访谈笔记审阅及内容确认',get(85).threadId);
    add(193,'完成第三方尽调重点问题跟进及补充回复',get(85).threadId);
    edge(81,190,0,1);edge(190,191,5);edge(84,192,5);edge(192,193,2,5);
    const coverage=t.financialStrategy.mode==='staged'?168:81;
    edge(coverage,191,2);edge(coverage,192,2);edge(191,193);edge(193,85);edge(84,85,5);
    // Collection starts from the first agreed scope; completion is a separate full-period close-out.
    add(194,'收集工商税务调档主体清单、授权及申请材料',get(109).threadId);
    add(195,'整理工商税务调档工作底稿并开展勾稽',get(109).threadId);
    add(196,'完成工商税务调档差异核查及补充资料跟进',get(109).threadId);
    remove(81,99);edge(77,99,2,5);edge(99,194,1,3);edge(194,101,1,3);
    edge(101,195,5);edge(195,196,3,5);edge(t.financialStrategy.mode==='staged'?167:81,196,3);
    edge(196,109,2);edge(101,109,5); // no target penalizing a long rolling investigation
    // Litigation search is its own thread, no printer prerequisite or artificial China-opinion dependency.
    const search=thread('search','诉讼、破产及清盘查册',51);get(113).threadId=search;
    add(197,'确定诉讼、破产及清盘查册范围并启动查册',search);
    get(113).dependencies=[];edge(2,197);edge(197,113,3,5);remove(113,115);edge(113,150);
    target(197,-15);target(113,-10);
    t.threads.find(x=>x.id===get(91).threadId).name='中国法律尽职调查';
    const overseas=thread('overseas','境外法律尽调（如需）',115);
    add(198,'确定是否需要聘请海外律师，开展专项境外法律尽调，并确定尽调范围',overseas);
    add(199,'传阅专项境外法律尽调需求清单（如需）',overseas);
    add(200,'收集境外法律尽调资料并梳理重大问题（如需）',overseas);
    add(201,'传阅境外法律意见书初稿（如需）',overseas);
    add(202,'传阅境外法律意见书更新稿并跟进重点问题（如需）',overseas);
    add(203,'定稿境外法律意见书（如需）',overseas);
    edge(2,198,0,3);edge(198,199,1,3);edge(199,200,3,7);edge(200,201,5,10);edge(201,202,3,5);edge(202,203,3);edge(203,150);
    target(198,3,2);target(199,5,2);target(203,-15);
    if(options.cybersecurity===true){
      const cyber=thread('cybersecurity','网络安全及数据合规（如需）',115);
      for(const [n,name]of [[204,'启动网络安全及数据合规尽调并传阅需求清单'],[205,'传阅网络安全及数据合规风险与整改事项清单'],[206,'公司确认网络安全及数据合规整改方案'],[207,'完成网络安全及数据合规整改并提供证明材料'],[208,'完成网络安全及数据合规整改复核'],[209,'传阅网络安全及数据合规备忘录初稿'],[210,'传阅网络安全及数据合规备忘录更新稿'],[211,'定稿网络安全及数据合规备忘录']])add(n,name,cyber);
      edge(2,204,0,2);edge(204,205,5,10);edge(205,206,2,3);edge(206,207,5,10);edge(207,208,2,3);
      edge(205,209,3,5);edge(209,210,3,5);edge(210,211,2);edge(208,211,1);edge(211,150);
      target(204,2,2);target(211,-15);
    }
    if(options.overseasRequired===false){
      const omitted=new Set([199,200,201,202,203].map(n=>get(n).id));
      t.events=t.events.filter(e=>!omitted.has(e.id));for(const e of t.events)e.dependencies=e.dependencies.filter(d=>!omitted.has(d.predecessorEventId));
      if(p)for(const field of ['progress','cadencePositions','anchorRelativeTargets','anchorRelativeWindows','eventLayoutWeights'])for(const id of omitted)delete p[field]?.[id];
    }
    // v7: preserve hard readiness/review requirements; prefer workable intervals, not artificial waits.
    function window(n,lo,hi,anchor=3,weight=6){if(!p)return;delete p.anchorRelativeTargets[get(n).id];delete p.progress[get(n).id];delete p.cadencePositions[get(n).id];p.anchorRelativeWindows[get(n).id]={anchorEventId:get(anchor).id,earliestLag:lo,latestLag:hi,unit:'business_day',calendar:'inherit'};p.eventLayoutWeights[get(n).id]=weight;}
    function unstage(n){get(n).dependencies=get(n).dependencies.filter(d=>!meetingIds.has(d.predecessorEventId));if(p){delete p.progress[get(n).id];delete p.cadencePositions[get(n).id];}}
    // Contract review is compressible. The two-calendar-month signing-to-filing edge is NOT changed.
    edge(154,122,0,7);get(122).dependencies.find(d=>d.predecessorEventId===get(154).id).targetWeight=8;
    if(p)delete p.anchorRelativeTargets[get(122).id];
    t.sponsorReviewPolicy={draftEventId:get(154).id,signEventId:get(122).id,targetDays:7};
    // A first whole-book draft needs complete initial content, not every final chapter version.
    for(const n of [26,21,36,14,13,187]){remove(n,147);edge(n,149,2,3);}
    edge(185,147,2,3);edge(159,147,2,3);edge(160,147,2,3);
    // The only existing 'other chapters' content node remains mandatory for the first whole book.
    for(const n of [17,19,35,157,159,160,185,161])unstage(n);
    edge(2,157,5,10);edge(2,160,10,15);edge(2,185,5,10);
    edge(157,159,2,5);edge(159,161,2,3);edge(160,161,2,3);
    get(35).dependencies.find(d=>d.predecessorEventId===get(34).id).targetLag=7;
    // Final coverage can close together; version-review milestones are not blanket-exempt.
    for(const n of [168,191,192,193,85])if(by.has(code(n)))get(n).sameWeekGroup='third-party-closeout';
    for(const n of [195,196,109])get(n).sameWeekGroup='registry-closeout';
    for(const n of [122,156,125,126,127,128])get(n).sameWeekGroup='independent-appointments';
    if(t.financialStrategy.mode==='staged')for(const [n,lo,hi]of [[164,2,6],[165,5,11],[167,2,8],[168,5,15]])window(n,lo,hi,162,3);
    // Initiating follow-up need not wait an additional week after an interim report.
    const interim=get(48).dependencies.find(d=>d.predecessorEventId===get(47).id);interim.minLag=14;interim.targetLag=21;
    edge(48,49,0,0);
    for(const n of [109,112])get(115).dependencies.find(d=>d.predecessorEventId===get(n).id).targetLag=null;
    for(const [n,lo,hi]of [[156,-45,-25],[125,-40,-25],[126,-35,-20],[127,-35,-20],[128,-35,-20]])window(n,lo,hi);
    // The A1-relative preference must yield when an earlier chapter needs the printer.
    if(p)p.alignPreparationToReadiness=true;
    window(197,-12,-5);window(113,-7,-2);
    // Debt: retain 8-day minimum, 10-day preparation target and month-age validity.
    // Completion anywhere in a useful buffer window is acceptable, not only exactly A1 minus five days.
    get(3).dependencies.find(d=>d.predecessorEventId===get(33).id).targetLag=null;
    get(151).dependencies.find(d=>d.predecessorEventId===get(33).id).targetLag=null;
    if(p)delete p.anchorRelativeTargets[get(31).id];window(33,-15,-5);
    if(options.overseasRequired!==false)window(203,-10,-3);
    if(options.cybersecurity===true){
      // The memo needs the confirmed response plan, not just an unconfirmed issue list.
      // Drafting stays parallel with implementation; finalization still waits for review evidence.
      remove(205,209);edge(206,209,5,10);
      get(205).sameWeekGroup=get(206).sameWeekGroup='cyber-risk-response';
      for(const n of [207,208,211])get(n).sameWeekGroup='cyber-closeout';
      window(211,-10,-3);
    }
    t.executionOptions={cybersecurity:options.cybersecurity===true,overseasRequired:options.overseasRequired===false?false:options.overseasRequired===true?true:null};t.executionRevision=VERSION;t.minimumEngineVersion='0.17.0';
    return t;
  }
  const api={VERSION,apply};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.IPOExecutionRevision=api;
})(typeof globalThis!=='undefined'?globalThis:this);
