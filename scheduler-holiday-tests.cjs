const assert=require('node:assert/strict'),E=require('./scheduler-engine'),data=require('./scheduler-public-holidays');
const cal=E.createCalendars(data),day=x=>E.parseDate(x),work=(region,date)=>cal.get(region).isWorking(day(date));
for(const d of ['2024-12-25','2024-12-26','2025-01-01','2025-01-29','2025-01-30','2025-01-31','2025-04-04'])assert(!work('hk',d),d);
assert(work('cn','2024-10-12'));assert(work('cn','2025-01-26'));assert(work('cn','2025-02-08'));assert(!work('cn','2025-02-03'));assert(!work('us','2025-02-17'));
for(const date of ['2026-01-04','2026-02-14','2026-02-28','2026-05-09','2026-09-20','2026-10-10'])assert(work('cn',date),date);
for(const date of ['2026-02-16','2026-05-04','2026-10-06','2027-02-08','2028-01-31','2028-10-03'])assert(!work('cn',date),date);
assert(work('cn','2027-02-14'));assert(work('cn','2028-01-22'));
for(const date of ['2026-04-07','2027-02-09','2028-05-29','2028-10-02','2028-10-04'])assert(!work('hk',date),date);
assert(work('hk','2028-10-03')); // Mid-Autumn itself is not HK general holiday.
for(const date of ['2026-07-03','2027-06-18','2027-12-31','2028-11-10','2028-12-25'])assert(!work('us',date),date);
assert.equal(E.iso(cal.add(day('2026-02-13'),1,'business_day','cn')),'2026-02-14');
assert.equal(E.iso(cal.add(day('2027-12-30'),1,'business_day','us')),'2028-01-03');
const t={project:{name:'test',defaultCalendar:'hk'},lanes:[{id:'l'}],threads:[{id:'t',laneId:'l'}],events:[{id:'e',code:'E',name:'anchor',threadId:'t',dateMode:'anchor_input',dependencies:[]}]};
let c=E.compile(t,{anchorDates:{e:'2028-05-01'},horizonStart:'2028-01-01',horizonEnd:'2028-12-31',calendars:data});
assert(c.warnings.some(x=>x.includes('hk')&&x.includes('暂定')));
c=E.compile(t,{anchorDates:{e:'2027-01-04'},horizonStart:'2027-01-01',horizonEnd:'2027-12-31',calendars:data});assert(!c.warnings.some(x=>x.includes('暂定')));
assert.equal(E.createCalendars({hk:{from:'2026-01-01',to:'2028-12-31',holidays:[],workingDays:[]}}).get('hk').estimatedFrom,null);
console.log('PASS 2026官方调休、香港补假、美国跨年观测日、未来估算与警告');
