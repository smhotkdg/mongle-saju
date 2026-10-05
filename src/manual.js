export const MANUAL_AUDIENCES=[{id:'friend',label:'친구에게'},{id:'partner',label:'연인에게'},{id:'work',label:'동료에게'}];
export function makeManual(report,audience='friend') {
 if(!report || report.uncertain || !report.persona)return null;
 const id=MANUAL_AUDIENCES.some(a=>a.id===audience)?audience:'friend';
 const p=report.persona;
 const variants={
  friend:[['이럴 때 나다워요',p.bright],['이럴 때 잠깐 쉬어요',p.shadow],['이 한마디를 건네요',p.dialogue]],
  partner:[['편안해지는 관계',p.love],['함께 지키고 싶은 선',p.boundary],['내 마음을 꺼내는 말',p.dialogue]],
  work:[['내가 살펴볼 일의 방식',report.theme.work],['업무에서 지킬 경계',report.office.watch+'에는 범위와 우선순위를 함께 확인하고 싶어요.'],['함께 일할 때 꺼낼 말',report.office.say]]
 };
 return {audience:id,label:MANUAL_AUDIENCES.find(a=>a.id===id).label,character:report.character,tags:p.tags,rows:variants[id],note:'사주 상징을 바탕으로 만든 대화의 시작점이에요. 나와 닮은 문장만 골라 이야기해보세요.'};
}
