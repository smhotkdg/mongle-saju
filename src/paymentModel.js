import { resultSchema } from './vault.js';

export function reportIdentity(value) {
  const parsed=resultSchema.safeParse(value);
  if(!parsed.success)return null;
  const r=parsed.data;
  return JSON.stringify([r.id,r.kind,r.name,r.engine,r.chart]);
}
export const paymentStatus={creating:'결제창 준비 중',ready:'승인 전',approving:'승인 확인 중',paid:'테스트 결제 완료',review:'결제사 확인 필요',cancelled:'결제 취소됨',failed:'결제창 준비 실패',sandbox_reset:'테스트 해금 초기화됨 (거래 기록 유지)'};
