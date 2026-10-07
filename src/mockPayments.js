import { reportIdentity } from './paymentModel.js';

export function simulatePayment(result,provider,outcome) {
  if(!['kakaopay','naverpay','tosspay'].includes(provider)||!['paid','cancelled','failed'].includes(outcome)||!reportIdentity(result))throw new Error('Invalid simulation');
  return {id:`local-${crypto.randomUUID()}`,provider,amount:990,status:outcome,createdAt:Date.now(),mode:'local-mock',result};
}
export function mockOwns(orders,result) {
  const identity=reportIdentity(result);
  return identity!==null && orders.some(o=>o.mode==='local-mock'&&o.status==='paid'&&reportIdentity(o.result)===identity);
}
