// Export only the public default library. Never reads browser plans or user JSON.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function build(){
  const dir=path.resolve(__dirname,'..'),ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(dir,'scheduler-draft.js'),'utf8'),ctx);
  let t=ctx.window.IPO_DRAFT_RULES;t=require('../scheduler-rule-revision').revise(t,t).template;
  t=require('../scheduler-prospectus-revision').revise(t,t).template;
  for(const f of ['scheduler-feedback-revision','scheduler-feedback-batch2','scheduler-prospectus-grouping'])t=require('../'+f).revise(t);
  const cycle=require('../scheduler-meeting-cycle').revise(t);t=require('../scheduler-flexible-planning').revise(cycle.template);
  const E=require('../scheduler-engine'),errors=E.validateTemplate(t);if(errors.length)throw Error(errors.join('; '));
  return{schema_version:1,min_engine_version:E.VERSION,data:{rules:t,calendars:require('../scheduler-public-holidays'),agenda:cycle.agenda}};
}
if(require.main===module)process.stdout.write(JSON.stringify(build())+'\n');else module.exports={build};
