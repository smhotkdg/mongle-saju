import { ENGINE, calculateChart, convertBirth, dayGanZhi, ganZhiKo, tenGod, branchRelation, stemRelation } from './manse.js';
import { characterFor, makeReport, makeMatchStory, dailyScenes, ART_KEYS, ART_LABELS } from './report.js';

export function seoulDate(date=new Date()) {
  return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function validatePerson(person,today=seoulDate()) {
  if (!person.name?.trim()) return '몽글도사가 부를 이름을 알려주세요.';
  if (person.name.trim().length>16) return '이름은 16자 이내로 입력해주세요.';
  try { if (convertBirth(person).solarDate>today) return '태어난 날짜는 오늘보다 늦을 수 없어요. 음력은 양력으로 바꾼 날짜를 확인해요.'; }
  catch(error) { return error.message; }
  if (!person.unknown && !/^([01]\d|2[0-3]):[0-5]\d$/.test(person.time || '')) return '태어난 시간을 입력하거나 ‘시간 모름’을 선택해주세요.';
  return '';
}
const elementCopy = {
  목:{color:'세이지 그린',item:'작은 메모장',action:'새로운 생각 한 줄 적기'},
  화:{color:'피치 핑크',item:'따뜻한 차',action:'고마운 마음 말로 전하기'},
  토:{color:'버터 옐로',item:'익숙한 노트',action:'오늘의 작은 약속 지키기'},
  금:{color:'크림 화이트',item:'정리한 책상',action:'가장 중요한 일 하나 고르기'},
  수:{color:'라벤더 블루',item:'좋아하는 책',action:'조용히 생각할 시간 갖기'}
};
const stemStories = [
  ['큰 나무처럼 방향을 세우는 마음','갑목은 양의 나무에 비유해요. 전통 해석에서는 성장과 방향성을 상징해요. 스스로 중요하게 여기는 기준을 적어보며 내 선택을 살펴보세요.'],
  ['작은 풀처럼 유연하게 자라는 마음','을목은 음의 나무, 풀과 덩굴에 비유해요. 유연함과 연결을 상징하는 표현이에요. 주변에 맞추는 일과 내 마음을 지키는 일 사이의 균형을 돌아보세요.'],
  ['햇살처럼 온기를 나누는 마음','병화는 양의 불, 햇빛에 비유해요. 드러냄과 활력을 상징해요. 내가 기쁘게 표현할 수 있는 방식과 편안히 쉴 수 있는 시간을 함께 찾아보세요.'],
  ['작은 등불처럼 섬세하게 빛나는 마음','정화는 음의 불, 등불에 비유해요. 집중과 섬세함을 떠올리는 상징이에요. 오래 마음을 쏟고 싶은 한 가지를 골라 가볍게 이어가 보세요.'],
  ['산처럼 든든한 중심을 찾는 마음','무토는 양의 흙, 산과 넓은 땅에 비유해요. 안정과 중심을 상징해요. 책임을 맡는 만큼 필요할 때 도움을 청하는 연습도 해보세요.'],
  ['텃밭처럼 일상을 가꾸는 마음','기토는 음의 흙, 밭에 비유해요. 돌봄과 축적을 상징해요. 매일 조금씩 편안해지는 습관을 만들고, 나를 돌보는 시간도 남겨주세요.'],
  ['단단한 원석처럼 기준을 다듬는 마음','경금은 양의 금, 원석과 쇠에 비유해요. 결단과 원칙을 상징해요. 내 기준을 지키면서 다른 사람의 사정도 들을 여유를 가져보세요.'],
  ['작은 보석처럼 가치를 발견하는 마음','신금은 음의 금, 보석에 비유해요. 정교함과 구분을 상징해요. 잘하고 싶은 마음이 커질 때는 완벽보다 충분한 완성을 목표로 삼아보세요.'],
  ['큰 물처럼 넓게 흐르는 마음','임수는 양의 물, 바다와 강에 비유해요. 흐름과 확장을 상징해요. 다양한 가능성 중 지금 시작할 수 있는 작은 방향을 정해보세요.'],
  ['이슬처럼 차분히 스며드는 마음','계수는 음의 물, 비와 이슬에 비유해요. 관찰과 사색을 상징해요. 생각을 혼자 품기보다 믿을 수 있는 사람에게 한 문장 나눠보세요.']
];
const roleCopy = {
  비견:['나의 기준을 돌아보는 하루','같은 오행·같은 음양','나와 비슷한 관점과 자율성','내가 원하는 것 한 줄 적기'],
  겁재:['함께하는 방식에 귀 기울이는 하루','같은 오행·다른 음양','동료와 나눔, 경쟁','함께 지킬 약속 정하기'],
  식신:['작은 결과를 만들어보는 하루','내가 생하는 오행·같은 음양','생산과 표현','작은 일 하나 완성하기'],
  상관:['새로운 표현을 시도하는 하루','내가 생하는 오행·다른 음양','새로운 표현과 질문','새로운 생각을 다정하게 말하기'],
  편재:['주변의 자원을 살펴보는 하루','내가 극하는 오행·같은 음양','활동과 자원 활용','시간과 에너지의 우선순위 정하기'],
  정재:['일상을 차곡차곡 정돈하는 하루','내가 극하는 오행·다른 음양','관리와 꾸준함','오늘의 계획 세 가지 정리하기'],
  편관:['도전의 크기를 조절하는 하루','나를 극하는 오행·같은 음양','긴장과 도전','부담스러운 일 한 단계 나누기'],
  정관:['편안한 약속을 만드는 하루','나를 극하는 오행·다른 음양','규칙과 책임','지킬 수 있는 약속 하나 정하기'],
  편인:['익숙한 생각을 새롭게 보는 하루','나를 생하는 오행·같은 음양','탐색과 독특한 배움','궁금했던 주제 하나 찾아보기'],
  정인:['배움과 돌봄을 챙기는 하루','나를 생하는 오행·다른 음양','배움과 보호','나를 쉬게 하는 시간 갖기']
};
function chartKey(chart) { return chart.pillars.map(p=>p.candidates.join('/')).join('|')+'|'+chart.boundary; }
function details(chart) {
  const dm=chart.dayMaster;
  const countText=chart.elements.map(e=>e.name+' '+(e.min===e.max?e.min:e.min+'~'+e.max)+'개').join(' · ');
  const visible=chart.pillars.filter((p,i)=>i!==2 && p.value);
  const roles=dm?visible.map(p=>p.label+' 천간 '+p.value[0]+': '+tenGod(dm.char,p.value[0])).join(' · '):'일간이 확정되지 않아 십성을 하나로 정하지 않았어요.';
  const month=chart.pillars[1];
  const seasons={寅:'봄의 시작',卯:'봄의 중심',辰:'봄에서 여름으로의 전환',巳:'여름의 시작',午:'여름의 중심',未:'여름에서 가을로의 전환',申:'가을의 시작',酉:'가을의 중심',戌:'가을에서 겨울로의 전환',亥:'겨울의 시작',子:'겨울의 중심',丑:'겨울에서 봄으로의 전환'};
  return [
    {title:dm?'나를 나타내는 일간 · '+dm.korean+dm.element+' ('+dm.char+')':'나를 나타내는 일간 · 시간 확인 필요',text:dm?stemStories[dm.index][1]:'선택한 날짜 경계 기준에서는 출생 시각에 따라 일간이 달라져요. 출생 시간을 확인한 뒤 하나의 해석으로 읽어주세요.'},
    {title:'원국의 오행 · 눈에 보이는 분포',text:countText+'. 천간과 지지의 대표 오행을 각각 한 개로 센 값이에요. 지장간·계절 가중치를 적용한 신강·신약이나 용신 판정은 아니에요. 개수가 많거나 적다는 이유만으로 좋고 나쁨을 정하지 않아요.'},
    {title:'월주 · 태어난 계절의 자리',text:month.value?month.value+'('+month.korean+')는 '+seasons[month.value[1]]+'에 해당하는 월주예요. 음력 월의 숫자가 아니라 절입 시각을 경계로 계산했어요. 계절은 원국을 함께 읽는 배경이며 이 정보만으로 성격이나 직업을 단정하지 않아요.':'월주는 '+month.candidates.map(v=>v+'('+ganZhiKo(v)+')').join(' 또는 ')+'예요. 절기가 바뀌는 날이라 시간을 모르면 계절의 자리를 확정할 수 없어요.'},
    {title:'십성 · 일간과 다른 천간의 관계',text:roles+'. 십성은 오행의 생·극과 음양의 같고 다름으로 정하는 관계 이름이에요. 실제 미래의 사건이나 재산·건강·연애 결과를 예측하는 수치는 아니에요.'}
  ];
}
export function makeFortune(person,kind='daily',day=seoulDate()) {
  const chart=calculateChart(person),dm=chart.dayMaster;
  const palette=elementCopy[dm?.element || '토'];
  let headline=dm?.char || '확인',subline=dm?dm.korean+dm.element+' · '+dm.polarity+'의 '+['나무','불','흙','금','물'][dm.elementIndex]:'시간에 따라 일간이 달라져요';
  let [title,description]=dm?stemStories[dm.index]:['출생 시간을 함께 확인해요','가능한 원국을 표시했어요. 출생 시간을 알면 더 구체적으로 계산할 수 있어요.'];
  let action=palette.action,scenes=null;
  const evidence=dm?['일간 '+dm.char+'('+dm.korean+dm.element+')을 기준으로 읽었어요.']:['일간을 확정할 수 없어 단일한 성향 풀이를 하지 않았어요.'];
  if (kind==='daily') {
    const todayPillar=dayGanZhi(day),roles=[...new Set(chart.pillars[2].candidates.map(p=>tenGod(p[0],todayPillar[0])))];
    if (roles.length===1) {
      scenes=dailyScenes(roles[0],chart);headline=roles[0];subline='오늘 '+todayPillar+'('+ganZhiKo(todayPillar)+') · 일간 기준 십성';
      const [t,basis,symbol,mission]=roleCopy[roles[0]];
      title=t;description=roles[0]+'은 '+basis+'의 관계예요. 전통적으로 '+symbol+'의 상징으로 읽어요. 오늘의 미래를 확정하는 예언보다 일상을 돌아보는 힌트로 읽어주세요.';action=mission;
    } else { headline='시간 확인';subline='오늘 '+todayPillar+'('+ganZhiKo(todayPillar)+')';description='일간 후보에 따라 오늘의 십성은 '+roles.join(' 또는 ')+'로 달라져요. 시간을 확인하기 전에는 하나의 운세로 정하지 않았어요.'; }
    evidence.push('오늘의 일진: '+day+' · '+todayPillar+'('+ganZhiKo(todayPillar)+').');
    if (dm) evidence.push('내 일간 '+dm.char+'와 오늘 천간 '+todayPillar[0]+'의 관계: '+roles[0]+'.');
    if (chart.pillars[2].value) evidence.push('내 일지 '+chart.pillars[2].value[1]+'와 오늘 일지 '+todayPillar[1]+': '+branchRelation(chart.pillars[2].value[1],todayPillar[1])+'. 합·충만으로 하루의 좋고 나쁨을 판단하지 않아요.');
  }
  return {id:kind+'-'+chartKey(chart)+'-'+day+'-'+person.name.trim(),engine:ENGINE,kind,name:person.name.trim(),date:day,headline,subline,title,description,...palette,action,chart,evidence,readings:details(chart),character:characterFor(chart),dailyScenes:scenes,...(kind==='saju'?{report:makeReport(chart)}:{}),unlocked:false};
}
export function makeCompatibility(a,b,relation,day=seoulDate()) {
  const chart=calculateChart(a),otherChart=calculateChart(b);
  const x=chart.pillars[2].value,y=otherChart.pillars[2].value;
  const branch=x&&y?branchRelation(x[1],y[1]):'시간 확인 필요';
  const stem=x&&y?stemRelation(x[0],y[0]):'일간 후보가 있어 관계를 확정할 수 없어요';
  const copy={
    육합:['서로 연결되는 자리를 가진 사이','두 일지는 전통적인 육합 짝이에요. 연결과 협력의 상징으로 읽지만, 실제 관계의 만족도나 재회를 보장하지는 않아요. 편안한 대화와 서로의 경계를 함께 살펴보세요.'],
    충:['다른 리듬을 알아가는 사이','두 일지는 전통적인 충 관계예요. 서로 다른 리듬과 변화의 상징으로 읽어요. 나쁜 궁합이라는 뜻은 아니에요. 서로 다른 기대를 구체적으로 이야기해보세요.'],
    '같은 일지':['익숙한 리듬을 나누는 사이','두 사람의 일지가 같아요. 익숙함을 떠올리는 상징이지만 성격이 같다는 뜻은 아니에요. 닮은 점과 서로 다른 점을 실제 경험에서 찾아보세요.'],
    '합·충 없음':['우리만의 관계를 만들어가는 사이','두 일지 사이에는 육합과 충이 없어요. 이 두 규칙만으로 관계를 판단할 수 없다는 뜻이에요. 함께 지내며 느끼는 편안함과 존중을 더 중요한 기준으로 삼아보세요.'],
    '시간 확인 필요':['출생 시간을 함께 확인할 사이','가능한 일주가 여러 개라 합·충을 하나로 확정하지 않았어요. 표시된 원국 후보를 확인하고 출생 시각을 알게 되면 다시 계산해보세요.']
  };
  const [title,description]=copy[branch],keys=[chartKey(chart),chartKey(otherChart)].sort();
  const relationAdvice={'연인':'서로 바라는 애정 표현을 한 문장씩 나눠보세요.','친구':'함께 편안한 약속의 빈도를 이야기해보세요.','전 애인':'합·충은 재회의 신호가 아니에요. 지금의 마음과 상대의 의사를 먼저 살펴보세요.'};
  return {id:'match-'+keys.join('~')+'-'+relation+'-'+day+'-'+a.name.trim()+'-'+b.name.trim(),engine:ENGINE,kind:'match',relation,name:a.name.trim()+' & '+b.name.trim(),date:day,headline:branch==='육합'?'六合':branch==='충'?'沖':branch==='같은 일지'?'同支':branch==='합·충 없음'?'다른 자리':'시간 확인',subline:'일지: '+branch,title,description:description+' '+(relationAdvice[relation] || relationAdvice['연인']),matchStory:makeMatchStory(chart,otherChart,relation),color:'피치 핑크',item:'함께 쓰는 메모',action:relation==='전 애인'?'내 마음과 상대의 의사 살피기':'서로 바라는 것 한 문장 나누기',chart,otherChart,evidence:[a.name.trim()+'의 일주: '+(x?x+'('+ganZhiKo(x)+')':chart.pillars[2].candidates.join(' / '))+'.',b.name.trim()+'의 일주: '+(y?y+'('+ganZhiKo(y)+')':otherChart.pillars[2].candidates.join(' / '))+'.','일간 오행 관계: '+stem+'.','일지 관계: '+branch+'. 육합 6쌍과 서로 마주 보는 충 6쌍만 비교했어요.','관계 종류는 대화 제안에만 반영해요. 사주 계산과 합·충 결과는 동일해요.'],unlocked:true};
}
export function publicCard(result) {
  const card={kind:result.kind,name:result.name,title:result.title,description:result.description,date:result.date,color:result.color,item:result.item,action:result.action,relation:result.relation};
  return result.engine===ENGINE ? {...card,engine:ENGINE,headline:result.headline,subline:result.subline,...(result.character?{character:{key:result.character.key,name:result.character.name,tagline:result.character.tagline}}:{})} : {...card,score:result.score,scores:result.scores};
}
export function savedResult(result) {
  const strip=chart=>{if (!chart) return undefined; const {solarDate,lunarDate,...rest}=chart;return rest;};
  return {...result,chart:strip(result.chart),otherChart:strip(result.otherChart)};
}
export function parseSharedCard(hashValue) {
  try {
    if (!hashValue.startsWith('#card=') || hashValue.length>16000) return null;
    const r=JSON.parse(decodeURIComponent(hashValue.slice(6)));
    if (!['daily','saju','match'].includes(r.kind) || !['name','title','description','date','color','item','action'].every(k=>typeof r[k]==='string' && r[k].length<=600) || r.name.length>40 || r.title.length>70 || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || (r.relation!==undefined && !['연인','친구','전 애인'].includes(r.relation))) return null;
    if (r.engine===ENGINE) {
      if(r.character && (!ART_KEYS.includes(r.character.key) || typeof r.character.name!=='string' || r.character.name.length>50 || typeof r.character.tagline!=='string' || r.character.tagline.length>100))return null;
      if (typeof r.headline!=='string' || r.headline.length>24 || typeof r.subline!=='string' || r.subline.length>100) return null;
    } else if (r.engine!==undefined || !Number.isInteger(r.score) || r.score<0 || r.score>100) return null;
    const card=publicCard(r);
    if(card.character)card.character={...card.character,image:`/characters/${card.character.key}.png`,alt:ART_LABELS[ART_KEYS.indexOf(card.character.key)]};
    if (!r.engine) card.scores=Array.isArray(r.scores)&&r.scores.length===4&&r.scores.every(n=>Number.isInteger(n)&&n>=0&&n<=100)?r.scores:[r.score,r.score,r.score,r.score];
    return {...card,id:'shared',unlocked:false,shared:true};
  } catch { return null; }
}
