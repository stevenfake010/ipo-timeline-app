/* Public, GET-only Supabase reader. No plan data is sent to the server. */
(function(root){
  'use strict';
  const copy=x=>JSON.parse(JSON.stringify(x));
  function atLeast(a,b){const parse=s=>{if(!/^\d+\.\d+\.\d+$/.test(s))throw Error('引擎版本格式无效');return s.split('.').map(Number);};const x=parse(a),y=parse(b);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]>y[i];return true;}
  function validate(record,E){
    if(!record||record.status!=='published'||record.schema_version!==1||!/^[-a-f0-9]{36}$/.test(record.id)||typeof record.version!=='string'||!record.published_at||!Number.isFinite(Date.parse(record.published_at)))throw Error('云端发布版本格式无效');
    if(!atLeast(E.VERSION,record.min_engine_version))throw Error('云端规则需要更新版本的排程引擎');
    const data=record.data;if(!data||!Array.isArray(data.agenda)||!data.calendars||typeof data.calendars!=='object'||Array.isArray(data.calendars))throw Error('云端规则与日历包不完整');
    const errors=E.validateTemplate(data.rules);if(errors.length)throw Error(errors.join('；'));
    if(data.rules.events.length>2000)throw Error('事件库超过当前支持规模');
    const codes=new Set(data.rules.events.map(e=>e.code));
    for(const a of data.agenda)if(!codes.has(a.eventCode)||!Array.isArray(a.inputs)||!Array.isArray(a.outputs)||[...a.inputs,...a.outputs].some(c=>!codes.has(c)))throw Error('会议议程引用无效');
    for(const required of ['cn','hk','us'])if(!data.calendars[required])throw Error('缺少三地日历');
    for(const [name,c] of Object.entries(data.calendars)){
      if(!['cn','hk','us','project'].includes(name)||!c||typeof c.version!=='string'||!Array.isArray(c.holidays)||!Array.isArray(c.workingDays)||c.holidays.length+c.workingDays.length>10000)throw Error('日历结构无效');
      const from=E.parseDate(c.from),to=E.parseDate(c.to);if(from>to)throw Error('日历覆盖范围无效');
      if(!!c.estimatedFrom!==!!c.estimatedTo)throw Error('暂定日历区间不完整');
      if(c.estimatedFrom&&(E.parseDate(c.estimatedFrom)<from||E.parseDate(c.estimatedTo)>to||E.parseDate(c.estimatedFrom)>E.parseDate(c.estimatedTo)))throw Error('暂定日历区间无效');
      const holidays=new Set(c.holidays);for(const d of [...c.holidays,...c.workingDays]){const day=E.parseDate(d);if(day<from||day>to)throw Error('假期或补班超出日历范围');}if(c.workingDays.some(d=>holidays.has(d)))throw Error('日历同时标为假期及补班日');
    }
    return copy(data);
  }
  async function load({config,engine,embedded,storage,fetcher,timeoutMs=6000}){
    if(!config?.enabled)return{mode:'builtin',data:copy(embedded),release:null,warning:'未配置云端，使用内置事件库及日历。'};
    if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.url)||!/^sb_publishable_/.test(config.publishableKey)||config.channel!=='production')throw Error('云端公开连接配置无效');
    const key='ipo-published-library-v1:'+config.url+':'+config.channel;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
    const describe=r=>({id:r.id,version:r.version,publishedAt:r.published_at,minEngineVersion:r.min_engine_version});
    async function read(path){const response=await fetcher(config.url+'/rest/v1/'+path,{method:'GET',headers:{apikey:config.publishableKey,Accept:'application/json'},signal:controller.signal,credentials:'omit',cache:'no-store'});if(!response.ok)throw Error('云端读取失败（HTTP '+response.status+'）');const raw=await response.text();if(raw.length>2000000)throw Error('云端数据包过大');return JSON.parse(raw);}
    try{
      const pointers=await read('ipo_library_channels?name=eq.production&select=release_id');
      if(!Array.isArray(pointers)||pointers.length!==1||!/^[-a-f0-9]{36}$/.test(pointers[0].release_id))throw Error('尚无有效的云端正式发布');
      const rows=await read('ipo_library_releases?id=eq.'+pointers[0].release_id+'&status=eq.published&select=id,version,status,schema_version,min_engine_version,data,published_at');
      if(!Array.isArray(rows)||rows.length!==1||rows[0].id!==pointers[0].release_id)throw Error('云端正式版本不可读取');
      const record=rows[0],data=validate(record,engine);let warning='';
      try{storage?.setItem(key,JSON.stringify(record));}catch(e){warning='云端已读取，但本机缓存保存失败。';}
      return{mode:'cloud',data,release:describe(record),warning};
    }catch(error){
      try{const cached=JSON.parse(storage?.getItem(key)||'null');if(cached){const data=validate(cached,engine);return{mode:'cache',data,release:describe(cached),warning:'云端暂不可用，使用上次已发布缓存：'+error.message};}}catch(e){/* Corrupt cache is ignored, not written over. */}
      return{mode:'builtin',data:copy(embedded),release:null,warning:'云端暂不可用，使用内置事件库及日历：'+error.message};
    }finally{clearTimeout(timer);}
  }
  const api={load,validate,atLeast};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.IPOLibraryCloud=api;
})(typeof globalThis!=='undefined'?globalThis:this);
