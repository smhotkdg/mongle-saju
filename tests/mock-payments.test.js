import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../server/app.js';
import { createStore } from '../server/store.js';
import { simulatePayment, mockOwns } from '../src/mockPayments.js';
import { makeFortune } from '../src/fortune.js';

test('local simulations grant only the exact approved report without modifying it',()=>{
  const result=makeFortune({name:'테스트',birth:'1995-03-12',time:'10:30',calendar:'solar',boundary:'midnight',unknown:false},'saju');
  const before=JSON.stringify(result);
  for(const provider of ['kakaopay','naverpay','tosspay']){
    for(const outcome of ['cancelled','failed'])assert.equal(mockOwns([simulatePayment(result,provider,outcome)],result),false);
    const approved=simulatePayment(result,provider,'paid');
    assert.equal(mockOwns([approved],result),true);
    assert.equal(mockOwns([approved],{...result,name:'다른 사주'}),false);
    assert.equal(mockOwns([{...approved,mode:'sandbox'}],result),false);
    assert.equal(mockOwns([],result),false);
  }
  assert.equal(JSON.stringify(result),before);
});
test('mock availability fails closed outside local development and can be disabled',async t=>{
  for(const [env,expected] of [
    [{NODE_ENV:'development',APP_ORIGIN:'http://127.0.0.1:5173'},true],
    [{NODE_ENV:'development',APP_ORIGIN:'http://127.0.0.1:5173',PAYMENT_LOCAL_MOCK:'false'},false],
    [{NODE_ENV:'development',APP_ORIGIN:'https://example.com'},false],
    [{NODE_ENV:'production',APP_ORIGIN:'https://localhost'},false],
    [{APP_ORIGIN:'http://127.0.0.1:5173'},false],
  ]){
    const store=createStore(':memory:'),api=createApi({env,store}),server=api.app.listen(0,'127.0.0.1');
    await new Promise(r=>server.once('listening',r));
    try{const data=await(await fetch(`http://127.0.0.1:${server.address().port}/health`)).json();assert.equal(data.localPaymentMock,expected);}finally{await new Promise(r=>server.close(r));api.close();}
  }
});
