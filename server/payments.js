import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { hash, token } from './store.js';
import { resultSchema } from '../src/vault.js';
import { reportIdentity } from '../src/paymentModel.js';
import { paymentConfig, createPaymentGateway, validApproval } from './payment-gateways.js';

// Preferences/checklists may change without invalidating a purchased report.
export function reportKey(result) {
  return hash(reportIdentity(result)||'invalid');
}
export function paymentRoutes({env,store,origin,gateway}) {
  const router=Router(), config=paymentConfig(env), pay=gateway||createPaymentGateway(config);
  const canResetSandbox=env.NODE_ENV==='development' && ['127.0.0.1','localhost','[::1]'].includes(new URL(origin).hostname) && (!env.PAYMENT_MODE || env.PAYMENT_MODE==='sandbox');
  const publicOrder=o=>({id:o.id,provider:o.provider,amount:o.amount,status:o.status,createdAt:o.created_at,mode:'sandbox',...(o.status==='paid'?{result:{...JSON.parse(o.result),unlocked:true}}:{})});
  router.get('/config',(_req,res)=>res.json({mode:'sandbox',canResetSandbox,amount:990,providers:Object.entries(config).map(([id,p])=>({id,label:p.label,enabled:p.enabled}))}));
  router.get('/orders',(req,res)=>res.json({orders:store.paymentOrders(req.user.id).map(publicOrder)}));
  router.post('/reset-sandbox',(req,res)=>{
    if(!canResetSandbox)return res.status(403).json({error:'로컬 개발용 샌드박스에서만 초기화할 수 있어요.'});
    const count=store.resetSandboxPayments(req.user.id);
    if(count===null)return res.status(409).json({error:'진행 중이거나 확인이 필요한 주문이 있어요. 결제 내역에서 승인 전 주문을 취소하고, 승인 중·확인 필요 주문은 결제사 상태를 먼저 확인해주세요.'});
    res.json({count,orders:store.paymentOrders(req.user.id).map(publicOrder)});
  });
  router.post('/orders',async(req,res)=>{
    const parsed=resultSchema.safeParse(req.body?.result), provider=req.body?.provider;
    if(!Object.hasOwn(config,provider||'') || !config[provider].enabled)return res.status(400).json({error:'결제용 테스트 가맹점 설정이 필요해요.'});
    if(!parsed.success || parsed.data.kind!=='saju' || parsed.data.shared || !parsed.data.chart?.dayMaster)return res.status(400).json({error:'결제할 사주 결과를 확인해주세요.'});
    const result={...parsed.data,unlocked:false}, key=reportKey(result);
    const previous=store.activePayment(req.user.id,key);
    if(previous)return res.status(409).json({error:previous.status==='paid'?'이미 결제한 풀이예요. 결제 내역에서 열어주세요.':'진행 중인 주문이 있어요. 결제 내역을 먼저 확인해주세요.'});
    const state=token(), order={id:randomUUID(),user_id:req.user.id,provider,amount:990,status:'creating',result:JSON.stringify(result),report_key:key,state_hash:hash(state),created_at:Date.now()};
    store.addPayment(order);
    const callback=`${origin}/api/payments/return/${order.id}?state=${state}`;
    try {
      const ready=await pay.ready(order,callback);
      store.updatePayment(order.id,'creating','ready',ready.paymentId);
      res.json({id:order.id,checkout:ready.checkout});
    }catch{store.updatePayment(order.id,'creating','failed');res.status(502).json({error:'결제창을 준비하지 못했어요. 가맹점 테스트 설정을 확인해주세요.'});}
  });
  router.get('/return/:id',async(req,res)=>{
    const order=store.payment(req.params.id);
    if(!order || order.user_id!==req.user.id || typeof req.query.state!=='string' || hash(req.query.state)!==order.state_hash)return res.status(403).send('결제 요청을 확인하지 못했습니다. 로그인한 브라우저에서 다시 확인해주세요.');
    const back=()=>res.redirect(`${origin}/?payment_order=${order.id}#payments`);
    if(order.status!=='ready')return back();
    if(req.query.cancel==='1' || (order.provider==='naverpay' && String(req.query.resultCode).toLowerCase()!=='success')){store.updatePayment(order.id,'ready','cancelled');return back();}
    if(order.provider==='tosspay' && (req.query.status!=='PAY_APPROVED'||req.query.orderNo!==order.id))return res.status(400).send('토스페이 인증 결과가 주문과 일치하지 않습니다. 결제 내역을 확인해주세요.');
    const proof=order.provider==='kakaopay'?req.query.pg_token:order.provider==='tosspay'?order.payment_id:req.query.paymentId;
    if(typeof proof!=='string'||!proof||proof.length>2048)return res.status(400).send('결제 인증 정보가 없습니다. 결제 내역에서 상태를 확인해주세요.');
    if(Date.now()-order.created_at>30*60000){store.updatePayment(order.id,'ready','cancelled');return back();}
    if(!store.updatePayment(order.id,'ready','approving',order.provider==='naverpay'?proof:order.payment_id))return back();
    const approving=store.payment(order.id);
    try {
      const approved=await pay.approve(approving,proof);
      if(!validApproval(approving,approved,config))throw new Error('Approval does not match order');
      store.updatePayment(order.id,'approving','paid');
    }catch{
      // Never label a timeout/mismatched approval as unpaid or allow another charge.
      store.updatePayment(order.id,'approving','review');
    }
    return back();
  });
  router.post('/orders/:id/cancel',(req,res)=>{
    const order=store.payment(req.params.id);
    if(!order||order.user_id!==req.user.id)return res.status(404).json({error:'주문을 찾을 수 없어요.'});
    if(!store.updatePayment(order.id,'ready','cancelled'))return res.status(409).json({error:'이미 승인 중이거나 완료된 주문이에요. 결제 내역을 확인해주세요.'});
    res.json({ok:true});
  });
  return router;
}
