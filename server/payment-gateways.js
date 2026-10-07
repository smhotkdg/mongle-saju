// Payment credentials are deliberately separate from social-login credentials.
// Live charging stays disabled until merchant onboarding and launch review are complete.
export function paymentConfig(env) {
  const sandbox = !env.PAYMENT_MODE || env.PAYMENT_MODE === 'sandbox';
  return {
    tosspay: { label:'토스페이', enabled:sandbox && /^sk_test_\S+$/.test(env.TOSSPAY_API_KEY_TEST||''), secret:env.TOSSPAY_API_KEY_TEST },
    kakaopay: { label:'카카오페이', enabled:sandbox && !!env.KAKAOPAY_SECRET_KEY_DEV, secret:env.KAKAOPAY_SECRET_KEY_DEV, cid:'TC0ONETIME' },
    naverpay: { label:'네이버페이', enabled:sandbox && !!(env.NAVERPAY_CLIENT_ID && env.NAVERPAY_CLIENT_SECRET && env.NAVERPAY_CHAIN_ID), clientId:env.NAVERPAY_CLIENT_ID, secret:env.NAVERPAY_CLIENT_SECRET, chainId:env.NAVERPAY_CHAIN_ID },
  };
}

export function createPaymentGateway(config, request=fetch) {
  async function tossCall(path,body){
    if(!config.tosspay?.enabled)throw new Error('Toss Pay test key required');
    const response=await request(`https://pay.toss.im/api/v2/${path}`,{method:'POST',signal:AbortSignal.timeout(60000),headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,apiKey:config.tosspay.secret})});
    const data=await response.json();
    if(!response.ok||data.code!==0)throw new Error('Toss Pay did not confirm the operation');
    return data;
  }
  async function call(provider, path, body, key) {
    const p=config[provider], kakao=provider==='kakaopay';
    const response=await request((kakao?'https://open-api.kakaopay.com/online/v1/payment/':'https://dev-pay.paygate.naver.com/naverpay-partner/naverpay/payments/')+path, {
      method:'POST', signal:AbortSignal.timeout(60000),
      headers:kakao?{'Content-Type':'application/json',Authorization:`SECRET_KEY ${p.secret}`}:{'Content-Type':'application/x-www-form-urlencoded','X-Naver-Client-Id':p.clientId,'X-Naver-Client-Secret':p.secret,'X-NaverPay-Chain-Id':p.chainId,...(key?{'X-NaverPay-Idempotency-Key':key}:{})},
      body:kakao?JSON.stringify(body):new URLSearchParams(body).toString(),
    });
    const data=await response.json();
    if ((!response.ok && !(response.status===409 && data.code==='Success')) || (!kakao && data.code!=='Success')) throw new Error('Payment provider did not confirm the operation');
    return data;
  }
  return {
    async ready(order, returnUrl) {
      if(order.provider==='tosspay'){
        const data=await tossCall('payments',{orderNo:order.id,productDesc:'몽글 상세 사주 테스트',amount:order.amount,amountTaxFree:0,retUrl:returnUrl,retCancelUrl:returnUrl+'&cancel=1',autoExecute:false,cashReceipt:false});
        const url=new URL(data.checkoutPage);
        if(url.protocol!=='https:'||url.hostname!=='pay.toss.im'||url.username||url.password||typeof data.payToken!=='string'||!data.payToken)throw new Error('Invalid Toss Pay checkout response');
        return {paymentId:data.payToken,checkout:{kind:'redirect',url:url.href}};
      }
      if(order.provider==='naverpay')return {paymentId:null,checkout:{kind:'naverpay',clientId:config.naverpay.clientId,chainId:config.naverpay.chainId,options:{merchantUserKey:order.user_id,merchantPayKey:order.id,productName:'몽글 상세 사주 (테스트)',productCount:1,totalPayAmount:order.amount,taxScopeAmount:order.amount,taxExScopeAmount:0,returnUrl,productItems:[{categoryType:'ETC',categoryId:'ETC',uid:'saju-report',name:'상세 사주',count:1,payReferrer:'ETC'}]}}};
      const data=await call('kakaopay','ready',{cid:config.kakaopay.cid,partner_order_id:order.id,partner_user_id:order.user_id,item_name:'몽글 상세 사주 (테스트)',quantity:1,total_amount:order.amount,tax_free_amount:0,approval_url:returnUrl,cancel_url:returnUrl+'&cancel=1',fail_url:returnUrl+'&cancel=1'});
      const url=new URL(data.next_redirect_pc_url);
      if(url.protocol!=='https:' || !['kakao.com','kakaopay.com'].some(domain=>url.hostname===domain||url.hostname.endsWith('.'+domain)) || typeof data.tid!=='string')throw new Error('Invalid checkout response');
      return {paymentId:data.tid,checkout:{kind:'redirect',url:url.href}};
    },
    async approve(order, proof) {
      if(order.provider==='tosspay')return tossCall('execute',{payToken:order.payment_id,orderNo:order.id});
      if(order.provider==='kakaopay')return call('kakaopay','approve',{cid:config.kakaopay.cid,tid:order.payment_id,partner_order_id:order.id,partner_user_id:order.user_id,pg_token:proof,total_amount:order.amount});
      return call('naverpay','v2.2/apply/payment',{paymentId:order.payment_id},order.id);
    },
  };
}

export function validApproval(order, data, config) {
  if(order.provider==='tosspay')return data.code===0 && data.mode==='TEST' && data.orderNo===order.id && data.payToken===order.payment_id && data.amount===order.amount && typeof data.transactionId==='string' && !!data.transactionId && typeof data.approvalTime==='string' && !!data.approvalTime;
  if(order.provider==='kakaopay')return data.tid===order.payment_id && data.cid===config.kakaopay.cid && data.partner_order_id===order.id && data.partner_user_id===order.user_id && data.amount?.total===order.amount && data.amount?.tax_free===0 && typeof data.aid==='string' && !!data.approved_at;
  const d=data.body?.detail;
  return data.code==='Success' && data.body?.paymentId===order.payment_id && d?.paymentId===order.payment_id && d.merchantPayKey===order.id && d.merchantUserKey===order.user_id && d.admissionTypeCode==='01' && d.admissionState==='SUCCESS' && d.totalPayAmount===order.amount && d.taxScopeAmount===order.amount && d.taxExScopeAmount===0;
}
