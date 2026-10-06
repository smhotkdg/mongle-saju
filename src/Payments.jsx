import React, { useCallback, useEffect, useRef, useState } from 'react';
import { accountRequest } from './useAccountVault.js';
import { reportIdentity, paymentStatus } from './paymentModel.js';
import './payments.css';

let naverSdk;
function loadNaver() {
  if(window.Naver?.Pay)return Promise.resolve(window.Naver.Pay);
  if(!naverSdk)naverSdk=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://nsp.pay.naver.com/sdk/js/naverpay.min.js';script.async=true;
    const timer=setTimeout(()=>{script.remove();naverSdk=null;reject(new Error('네이버페이 결제창을 불러오지 못했어요.'));},15000);
    script.onload=()=>{clearTimeout(timer);if(window.Naver?.Pay)resolve(window.Naver.Pay);else{naverSdk=null;reject(new Error('네이버페이 연결을 확인해주세요.'));}};
    script.onerror=()=>{clearTimeout(timer);script.remove();naverSdk=null;reject(new Error('네이버페이 연결을 확인해주세요.'));};
    document.head.appendChild(script);
  });
  return naverSdk;
}
export function usePayments(vault) {
  const [config,setConfig]=useState(null),[orders,setOrders]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const working=useRef(false);
  const refresh=useCallback(async()=>{
    if(!vault.session?.user)return;
    try{const [c,o]=await Promise.all([accountRequest('/payments/config'),accountRequest('/payments/orders')]);setConfig(c);setOrders(o.orders);setError('');}catch(e){setError(e.message);}
  },[vault.session?.user?.id]);
  useEffect(()=>{void refresh();},[refresh]);
  const post=(path,body)=>accountRequest('/payments'+path,{method:'POST',headers:{'X-CSRF-Token':vault.session.csrf},body:JSON.stringify(body)});
  async function checkout(provider,result) {
    if(working.current||vault.hasPending)return;
    working.current=true;setBusy(true);setError('');
    try {
      const sdk=provider==='naverpay'?await loadNaver():null;
      const order=await post('/orders',{provider,result});
      if(order.checkout.kind==='redirect')window.location.assign(order.checkout.url);
      else sdk.create({mode:'development',clientId:order.checkout.clientId,chainId:order.checkout.chainId,payType:'normal',openType:'page'}).open(order.checkout.options);
    }catch(e){await refresh();setError(e.message+' 결제 내역에서 진행 중인 주문을 확인해주세요.');}
    finally{working.current=false;setBusy(false);}
  }
  async function cancel(id){if(working.current)return;working.current=true;setBusy(true);try{await post(`/orders/${id}/cancel`,{});await refresh();}catch(e){setError(e.message);}finally{working.current=false;setBusy(false);}}
  return {config,orders,error,busy,refresh,checkout,cancel,owns:result=>!!result&&orders.some(o=>o.status==='paid'&&reportIdentity(o.result)===reportIdentity(result))};
}
export function PaymentCheckout({vault,payments,result,onLogin,onHistory}) {
  return <section className="payment-checkout" aria-label="결제 수단 선택"><span className="pill purple">테스트 결제 · 실제 청구 없음</span><h2>나의 상세 사주 열기</h2><p>열네 가지 이야기와 부적 10종을 계정에서 다시 볼 수 있어요.</p><div className="payment-total"><span>상세 사주 1회</span><strong>990<span>원</span></strong></div>
    <div className="social-logins">{(payments.config?.providers||[{id:'kakaopay',label:'카카오페이'},{id:'naverpay',label:'네이버페이'}]).map(p=><button className={`social-login ${p.id==='kakaopay'?'kakao':'naver'}`} key={p.id} disabled={!vault.session?.user||!p.enabled||payments.busy||vault.hasPending} onClick={()=>payments.checkout(p.id,result)}>{p.label} 테스트 결제{!vault.session?.user?<small>로그인 필요</small>:!p.enabled&&<small>가맹점 설정 필요</small>}</button>)}</div>
    {!vault.session?.user?<><p>결제 결과를 보관하려면 먼저 로그인해주세요.</p><button className="button primary full" onClick={onLogin}>로그인하고 계속하기</button></>:<><p className="account-note">테스트 가맹점으로 진행해요. 승인 결과가 확인되면 상세 풀이가 열려요.</p>{vault.hasPending&&<p role="status">보관함 저장을 마친 뒤 결제할 수 있어요.</p>}<button className="text-button" onClick={onHistory}>결제 내역 확인</button></>}
    {payments.error&&<p role="alert" className="account-error">{payments.error}</p>}
  </section>;
}
export function PaymentHistory({vault,payments,onOpen,onLogin}) {
  return <section className="payment-history"><p>테스트 주문입니다. 실제 청구는 발생하지 않아요.</p>{!vault.session?.user?<button className="button primary" onClick={onLogin}>로그인하기</button>:<><button className="button secondary" disabled={payments.busy} onClick={payments.refresh}>상태 새로고침</button>{payments.error&&<p role="alert">{payments.error}</p>}{!payments.orders.length&&<p>결제 내역이 없어요.</p>}{payments.orders.map(o=><article key={o.id}><strong>{o.provider==='kakaopay'?'카카오페이':'네이버페이'} · {o.amount.toLocaleString()}원</strong><p>{paymentStatus[o.status]||'확인 필요'} · {new Date(o.createdAt).toLocaleString('ko-KR')}</p><small>주문번호 {o.id}</small>{o.status==='paid'&&<button className="button primary full" onClick={()=>onOpen(o.result)}>상세 풀이 열기</button>}{o.status==='ready'&&<><p>결제창을 닫았다면 승인 전 주문을 취소하고 다시 시작할 수 있어요.</p><button className="button secondary" disabled={payments.busy} onClick={()=>payments.cancel(o.id)}>승인 전 주문 취소</button></>}{['creating','approving','review'].includes(o.status)&&<p role="status">중복 결제를 막기 위해 재결제가 잠겨 있어요. 주문번호로 관리자에게 결제사 확인을 요청해주세요.</p>}</article>)}</>}</section>;
}
