import { resultSchema } from './vault.js';
export const paymentProviders=[{id:'kakaopay',label:'카카오페이',className:'kakao'},{id:'naverpay',label:'네이버페이',className:'naver'},{id:'tosspay',label:'토스페이',className:'toss'}];
export const paymentLabel=id=>paymentProviders.find(p=>p.id===id)?.label||id;
export const paymentClass=id=>paymentProviders.find(p=>p.id===id)?.className||'';

export function reportIdentity(value) {
  const parsed=resultSchema.safeParse(value);
  if(!parsed.success)return null;
  const r=parsed.data;
  return JSON.stringify([r.id,r.kind,r.name,r.engine,r.chart]);
}
export const paymentStatus={creating:'결제창 준비 중',ready:'승인 전',approving:'승인 확인 중',paid:'테스트 결제 완료',review:'결제사 확인 필요',cancelled:'결제 취소됨',failed:'결제창 준비 실패',sandbox_reset:'테스트 해금 초기화됨 (거래 기록 유지)'};
