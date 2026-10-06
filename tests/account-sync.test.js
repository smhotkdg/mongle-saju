import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { useAccountVault } from '../src/useAccountVault.js';
import { emptyVault } from '../src/vault.js';
import { makeFortune } from '../src/fortune.js';

test('account hydration never uploads guest data; saves serialize, retain edits, retry and detect conflicts',async()=>{
  const original={fetch:globalThis.fetch,window:globalThis.window,localStorage:globalThis.localStorage,act:globalThis.IS_REACT_ACT_ENVIRONMENT};
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  globalThis.window=new EventTarget();
  const guest=makeFortune({name:'비회원',birth:'1995-03-12',time:'10:30',calendar:'solar',boundary:'midnight',unknown:false},'saju');
  const local=new Map([['mongle-results',JSON.stringify([guest])]]);let localWrites=0;
  globalThis.localStorage={getItem:key=>local.get(key)||null,setItem:(key,value)=>{localWrites++;local.set(key,value);}};
  const pending=[],puts=[];let serverData=emptyVault(),serverRevision=0;
  globalThis.fetch=async(path,options)=>{
    if(path==='/api/session')return Response.json({user:{id:'account-a',name:'계정',provider:'google'},csrf:'test',providers:[]});
    if(options?.method==='PUT'){
      const body=JSON.parse(options.body);puts.push(body);
      return new Promise(resolve=>pending.push({body,resolve}));
    }
    return Response.json({data:serverData,revision:serverRevision});
  };
  let vault,renderer;
  function Harness(){vault=useAccountVault();return null;}
  async function complete(status=200){await act(async()=>{const next=pending.shift();assert.ok(next);if(status===200){serverData=next.body.data;serverRevision++;next.resolve(Response.json({revision:serverRevision}));}else next.resolve(Response.json({error:status===409?'conflict':'offline'},{status}));});}
  try {
    await act(async()=>{renderer=create(React.createElement(Harness));});
    assert.equal(vault.ready,true);assert.equal(vault.data.results.length,0);assert.equal(puts.length,0);
    await act(async()=>vault.importLocal());assert.equal(puts.length,1);assert.ok(!JSON.stringify(puts[0]).includes('solarDate'));
    await act(async()=>vault.setResults(list=>list.map(r=>({...r,reportChecks:[1,2]}))));assert.equal(puts.length,1);
    await complete();assert.equal(puts.length,2);assert.equal(puts[1].revision,1);
    await complete();assert.equal(vault.hasPending,false);assert.deepEqual(serverData.results[0].reportChecks,[1,2]);assert.equal(localWrites,0);
    await act(async()=>vault.setResults(list=>list.map(r=>({...r,reportChecks:[1,2,3]}))));await complete(503);
    assert.equal(vault.hasPending,true);assert.equal(vault.error,'offline');
    await act(async()=>vault.retry());await complete();assert.equal(vault.hasPending,false);
    await act(async()=>vault.setResults([]));await complete(409);assert.equal(vault.hasPending,true);
    await act(async()=>vault.reload());assert.equal(vault.data.results.length,1);assert.equal(vault.hasPending,false);
  } finally {
    if(renderer)await act(async()=>renderer.unmount());
    globalThis.fetch=original.fetch;globalThis.window=original.window;globalThis.localStorage=original.localStorage;globalThis.IS_REACT_ACT_ENVIRONMENT=original.act;
  }
});
