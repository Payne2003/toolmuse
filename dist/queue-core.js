// Pure preparation logic. This module never authenticates or submits provider jobs.
export function parsePrompts(text,mode='line',separator='---'){
  const value=String(text||'').replace(/\r\n/g,'\n');
  const chunks=mode==='blank'?value.split(/\n\s*\n/):mode==='custom'?(separator?value.split(separator):[value]):value.split('\n');
  return chunks.map(s=>s.trim()).filter(Boolean);
}

export function planQueue(jobs,accounts,costPerJob){
  const cost=Number(costPerJob);
  if(!Number.isFinite(cost)||cost<=0)throw new Error('Nhập số credit dự kiến cho mỗi tác vụ.');
  const pool=accounts.filter(a=>a.enabled&&Number.isFinite(a.credits)&&a.credits>=cost).map(a=>({id:a.id,remaining:a.credits,lanes:Array.from({length:Math.max(1,Math.min(4,Math.floor(Number(a.concurrency)||1)))},()=>0),reserved:0}));
  const assignments=[];const unassigned=[];
  for(const job of jobs){
    if(job.video||job.outputImage||job.sent)continue;
    const candidates=pool.filter(a=>a.remaining+1e-9>=cost).sort((a,b)=>Math.min(...a.lanes)-Math.min(...b.lanes)||a.lanes.reduce((x,y)=>x+y,0)/a.lanes.length-b.lanes.reduce((x,y)=>x+y,0)/b.lanes.length||accounts.findIndex(x=>x.id===a.id)-accounts.findIndex(x=>x.id===b.id));
    if(!candidates.length){unassigned.push(job.id);continue;}
    const account=candidates[0];const index=account.lanes.indexOf(Math.min(...account.lanes));
    assignments.push({jobId:job.id,accountId:account.id,lane:index+1,position:account.lanes[index]+1,cost});
    account.lanes[index]++;account.remaining-=cost;account.reserved+=cost;
  }
  return {assignments,unassigned,accounts:pool.map(a=>({id:a.id,reserved:a.reserved,remaining:Math.max(0,a.remaining),lanes:a.lanes}))};
}
