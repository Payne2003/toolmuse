import assert from 'node:assert/strict';
import {parsePrompts,planQueue} from './dist/queue-core.js';
assert.deepEqual(parsePrompts('first\r\n\nsecond\n','line'),['first','second']);
assert.deepEqual(parsePrompts('shot A\nline two\n\nshot B','blank'),['shot A\nline two','shot B']);
assert.deepEqual(parsePrompts('a\nline\n###\nb','custom','###'),['a\nline','b']);
const accounts=[{id:'a',enabled:true,credits:6,concurrency:2},{id:'b',enabled:true,credits:4,concurrency:1},{id:'empty',enabled:true,credits:0,concurrency:4},{id:'unknown',enabled:true,credits:null,concurrency:4},{id:'off',enabled:false,credits:100,concurrency:4}];
const jobs=Array.from({length:8},(_,i)=>({id:String(i)}));
const p=planQueue(jobs,accounts,2);
assert.equal(p.assignments.length,5);assert.equal(p.unassigned.length,3);
assert.equal(new Set(p.assignments.map(a=>a.jobId)).size,5);
assert.ok(p.assignments.every(a=>['a','b'].includes(a.accountId)));
for(const a of p.accounts){assert.ok(a.reserved<=accounts.find(x=>x.id===a.id).credits);assert.ok(a.remaining>=0);}
assert.ok(p.assignments.filter(a=>a.accountId==='a').every(a=>a.lane<=2));
assert.ok(p.assignments.filter(a=>a.accountId==='b').every(a=>a.lane===1));
assert.equal(accounts[0].credits,6,'Planning must not deduct actual credits');
assert.deepEqual(planQueue([{id:'done',video:{id:'video'}}],accounts,2).assignments,[]);
assert.throws(()=>planQueue(jobs,accounts,0));assert.throws(()=>planQueue(jobs,accounts,NaN));
assert.equal(planQueue(jobs,[],1).unassigned.length,8);
console.log('Queue checks passed: prompt splitting, credit reservation, thread bounds, no duplicates, and no actual credit deduction.');
