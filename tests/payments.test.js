import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../server/app.js';
import { createStore } from '../server/store.js';
import { paymentConfig, createPaymentGateway, validApproval } from '../server/payment-gateways.js';
import { reportKey } from '../server/payments.js';
import { makeFortune } from '../src/fortune.js';
import { emptyVault, resultSchema } from '../src/vault.js';

const env={APP_ORIGIN:'http://127.0.0.1:5173',KAKAOPAY_SECRET_KEY_DEV:'test-secret',NAVERPAY_CLIENT_ID:'test-id',NAVERPAY_CLIENT_SECRET:'test-secret',NAVERPAY_CHAIN_ID:'test-chain'};
const result=()=>makeFortune({name:'테스트',birth:'1995-03-12',time:'10:30',calendar:'solar',boundary:'midnight',unknown:false},'saju');
function approval(o){return o.provider==='kakaopay'?{tid:o.payment_id,cid:'TC0ONETIME',partner_order_id:o.id,partner_user_id:o.user_id,amount:{total:990,tax_free:0},aid:'approval',approved_at:'2026-10-06T12:00:00'}:{code:'Success',body:{paymentId:o.payment_id,detail:{paymentId:o.payment_id,merchantPayKey:o.id,merchantUserKey:o.user_id,admissionTypeCode:'01',admissionState:'SUCCESS',totalPayAmount:990,taxScopeAmount:990,taxExScopeAmount:0}}};}
async function harness(t,approve=async o=>approval(o),envOverrides={}) {
  const store=createStore(':memory:'), callbacks=new Map();let calls=0;
  const api=createApi({env:{...env,...envOverrides},store,paymentGateway:{ready:async(o,url)=>{callbacks.set(o.id,new URL(url));return {paymentId:o.provider==='kakaopay'?'tid-test':null,checkout:{kind:'redirect',url:'https://mockup-pg-web.kakao.com/test'}};},approve:async(o,proof)=>{calls++;return approve(o,proof);}}});
  const server=api.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const request=(path,options={})=>fetch(`http://127.0.0.1:${server.address().port}${path}`,{redirect:'manual',...options});
  function user(subject){const u=store.user('google',subject,'테스트'),s=store.createSession(u.id);return {...u,headers:{cookie:`${(envOverrides.APP_ORIGIN||env.APP_ORIGIN).startsWith('https:')?'__Host-mongle-session':'mongle-session'}=${s.id}`,Origin:envOverrides.APP_ORIGIN||env.APP_ORIGIN,'X-CSRF-Token':s.csrf,'Content-Type':'application/json'}};}
  const a=user('one'),b=user('two');
  const post=(path,body,who=a)=>request(path,{method:'POST',headers:who.headers,body:JSON.stringify(body)});
  async function order(provider='kakaopay',r=result()){const res=await post('/payments/orders',{provider,result:r,amount:1});assert.equal(res.status,200);return res.json();}
  function callback(o,who=a,query={}){const u=new URL(callbacks.get(o.id));u.searchParams.set('pg_token','proof');u.searchParams.set('resultCode','Success');u.searchParams.set('paymentId','naver-payment');for(const [k,v]of Object.entries(query))u.searchParams.set(k,v);return request(u.pathname.replace('/api','')+u.search,{headers:who.headers});}
  t.after(async()=>{await new Promise(r=>server.close(r));store.close();});
  return {store,request,post,order,callback,a,b,calls:()=>calls};
}

test('payment configuration never reuses login keys or enables production charging',()=>{
  assert.ok(Object.values(paymentConfig({KAKAO_CLIENT_ID:'login',NAVER_CLIENT_ID:'login',NAVER_CLIENT_SECRET:'login'})).every(p=>!p.enabled));
  assert.ok(Object.values(paymentConfig({...env,PAYMENT_MODE:'production'})).every(p=>!p.enabled));
});
test('sandbox reset retains transactions, revokes only owner entitlement and permits a fresh checkout',async t=>{
  const h=await harness(t,undefined,{NODE_ENV:'development'}),o=await h.order();await h.callback(o);
  assert.equal((await h.request('/payments/reset-sandbox',{method:'POST',headers:{...h.a.headers,'X-CSRF-Token':'bad'},body:'{}'})).status,403);
  assert.equal((await h.post('/payments/reset-sandbox',{},h.b)).status,200);
  assert.equal(h.store.payment(o.id).status,'paid');
  const response=await h.post('/payments/reset-sandbox',{});assert.equal(response.status,200);
  const data=await response.json();assert.equal(data.count,1);assert.equal(data.orders[0].status,'sandbox_reset');
  assert.equal(h.store.payment(o.id).payment_id,'tid-test');assert.equal(h.store.paidReport(h.a.id,reportKey(result())),false);
  await h.callback(o);assert.equal(h.calls(),1);assert.equal(h.store.payment(o.id).status,'sandbox_reset');
  assert.equal((await(await h.post('/payments/reset-sandbox',{})).json()).count,0);
  const next=await h.order();assert.notEqual(next.id,o.id);await h.callback(next);assert.equal(h.store.paidReport(h.a.id,reportKey(result())),true);
});
test('sandbox reset blocks pending/review orders and is unavailable outside local sandbox development',async t=>{
  const h=await harness(t,undefined,{NODE_ENV:'development'}),o=await h.order();
  for(const status of ['ready','approving','review','creating']){
    const current=h.store.payment(o.id).status;h.store.updatePayment(o.id,current,status);
    assert.equal((await h.post('/payments/reset-sandbox',{})).status,409);
    assert.equal(h.store.payment(o.id).status,status);
  }
  for(const settings of [{},{NODE_ENV:'development',PAYMENT_MODE:'production'},{NODE_ENV:'development',APP_ORIGIN:'https://example.com'}]){
    const other=await harness(t,undefined,settings);
    const config=await(await other.request('/payments/config',{headers:other.a.headers})).json();assert.equal(config.canResetSandbox,false);
    assert.equal((await other.post('/payments/reset-sandbox',{})).status,403);
  }
});
test('both gateways approve exactly once, isolate users and retain purchased snapshot',async t=>{
  for(const provider of ['kakaopay','naverpay'])await t.test(provider,async t=>{
    const h=await harness(t),r=result(),o=await h.order(provider,r);
    assert.equal(h.store.payment(o.id).amount,990);
    assert.equal((await h.callback(o,h.b)).status,403);
    assert.equal((await h.callback(o,h.a,{state:'forged'})).status,403);
    assert.equal(h.calls(),0);
    assert.equal((await h.post('/payments/orders',{provider,result:r})).status,409);
    await h.callback(o);await h.callback(o);
    assert.equal(h.calls(),1);assert.equal(h.store.payment(o.id).status,'paid');
    const rows=await (await h.request('/payments/orders',{headers:h.a.headers})).json();
    assert.equal(rows.orders[0].result.unlocked,true);assert.ok(!JSON.stringify(rows).includes('test-secret'));
    assert.equal((await (await h.request('/payments/orders',{headers:h.b.headers})).json()).orders.length,0);
    assert.equal(h.store.paidReport(h.a.id,reportKey(r)),true);
    assert.equal(h.store.paidReport(h.a.id,reportKey({...r,name:'다른 사람'})),false);
    assert.equal((await h.request('/account',{method:'DELETE',headers:h.a.headers})).status,409);
  });
});
test('vault rejects forged unlock and preserves entitlement only for the purchased chart',async t=>{
  const h=await harness(t),r=result(),data={...emptyVault(),results:[{...r,unlocked:true}]};
  const put=revision=>h.request('/vault',{method:'PUT',headers:h.a.headers,body:JSON.stringify({revision,data})});
  await put(0);let v=await (await h.request('/vault',{headers:h.a.headers})).json();assert.equal(v.data.results[0].unlocked,false);
  const o=await h.order();await h.callback(o);
  v=await (await h.request('/vault',{headers:h.a.headers})).json();assert.equal(v.data.results[0].unlocked,true);
  data.results[0].chart.pillars[0].value='甲子';await put(1);
  v=await (await h.request('/vault',{headers:h.a.headers})).json();assert.equal(v.data.results[0].unlocked,false);
});
test('uncertain approvals and amount mismatches never unlock or permit another charge',async t=>{
  for(const handler of [async()=>{throw new Error('timeout');},async o=>({...approval(o),amount:{total:1,tax_free:0}})])await t.test('review',async t=>{
    const h=await harness(t,handler),o=await h.order();await h.callback(o);
    assert.equal(h.store.payment(o.id).status,'review');assert.equal(h.store.paidReport(h.a.id,reportKey(result())),false);
    assert.equal((await h.post('/payments/orders',{provider:'naverpay',result:result()})).status,409);
    await h.callback(o);assert.equal(h.calls(),1);
    assert.equal((await h.post(`/payments/orders/${o.id}/cancel`,{})).status,409);
  });
});
test('cancellation, CSRF and callback races cannot accidentally approve an order',async t=>{
  const h=await harness(t),o=await h.order();
  assert.equal((await h.request('/payments/orders',{method:'POST',headers:{...h.a.headers,'X-CSRF-Token':'bad'},body:JSON.stringify({provider:'kakaopay',result:result()})})).status,403);
  assert.equal((await h.post(`/payments/orders/${o.id}/cancel`,{},h.b)).status,404);
  assert.equal((await h.post(`/payments/orders/${o.id}/cancel`,{})).status,200);
  await h.callback(o);assert.equal(h.calls(),0);assert.equal(h.store.payment(o.id).status,'cancelled');
  const next=await h.order();await Promise.all([h.callback(next),h.callback(next)]);assert.equal(h.calls(),1);
});
test('gateway requests use sandbox endpoints, server secrets and Naver idempotency',async()=>{
  const calls=[],config=paymentConfig(env),gateway=createPaymentGateway(config,async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify(url.endsWith('/ready')?{tid:'tid',next_redirect_pc_url:'https://mockup-pg-web.kakao.com/test'}:{code:'Success'}),{status:200});});
  const o={id:'order',user_id:'user',provider:'kakaopay',amount:990,payment_id:'tid'};
  await gateway.ready(o,'http://127.0.0.1:5173/api/payments/return/order?state=test');await gateway.approve(o,'proof');
  assert.equal(calls[0].init.headers.Authorization,'SECRET_KEY test-secret');assert.equal(JSON.parse(calls[0].init.body).cid,'TC0ONETIME');
  const n={...o,provider:'naverpay',payment_id:'naver-id'},ready=await gateway.ready(n,'http://127.0.0.1:5173/return');
  assert.equal(ready.checkout.options.totalPayAmount,990);assert.ok(!JSON.stringify(ready).includes('test-secret'));
  await gateway.approve(n,'unused');assert.match(calls[2].url,/^https:\/\/dev-pay.paygate.naver.com\/.+v2.2\/apply\/payment$/);assert.equal(calls[2].init.headers['X-NaverPay-Idempotency-Key'],'order');
  assert.equal(validApproval(n,approval(n),config),true);
  for(const field of ['paymentId','merchantPayKey','merchantUserKey','totalPayAmount','taxScopeAmount','taxExScopeAmount','admissionState']){const bad=approval(n);bad.body.detail[field]='bad';assert.equal(validApproval(n,bad,config),false,field);}
  assert.equal(reportKey(result()),reportKey(resultSchema.parse(result())));
});
