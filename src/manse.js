import KoreanLunarCalendar from 'korean-lunar-calendar';
import lunar from 'lunar-javascript';

const { Solar } = lunar;
export const ENGINE = 'korean-manse-v1';
export const STEMS = '甲乙丙丁戊己庚辛壬癸';
export const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
const stemKo = ['갑','을','병','정','무','기','경','신','임','계'];
const branchKo = ['자','축','인','묘','진','사','오','미','신','유','술','해'];
export const ELEMENTS = ['목','화','토','금','수'];
const branchElements = [4,2,0,0,2,1,1,2,3,3,2,4];
const termNames = {小寒:'소한',大寒:'대한',立春:'입춘',雨水:'우수',惊蛰:'경칩',春分:'춘분',清明:'청명',谷雨:'곡우',立夏:'입하',小满:'소만',芒种:'망종',夏至:'하지',小暑:'소서',大暑:'대서',立秋:'입추',处暑:'처서',白露:'백로',秋分:'추분',寒露:'한로',霜降:'상강',立冬:'입동',小雪:'소설',大雪:'대설',冬至:'동지',DA_XUE:'대설',DONG_ZHI:'동지',XIAO_HAN:'소한',DA_HAN:'대한',LI_CHUN:'입춘',YU_SHUI:'우수',JING_ZHE:'경칩'};
const pad = n => String(n).padStart(2,'0');
const ymd = c => `${c.year}-${pad(c.month)}-${pad(c.day)}`;
const wallDate = (date,time='00:00:00') => new Date(`${date}T${time.length===5?`${time}:00`:time}Z`);
const isoDate = d => d.toISOString().slice(0,10);
const solarAt = d => Solar.fromYmdHms(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate(),d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds());

// Round-trip validation is essential: the calendar library silently normalizes
// an invalid leap-month flag. Never accept that normalization as a valid input.
export function convertBirth(person) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(person.birth || '')) throw new Error('생년월일을 모두 입력해주세요.');
  const [y,m,d] = person.birth.split('-').map(Number);
  if (y<1900 || y>2050) throw new Error('1900년부터 2050년까지의 날짜를 지원해요.');
  const calendar = new KoreanLunarCalendar();
  const isLunar = person.calendar==='lunar';
  const ok = isLunar ? calendar.setLunarDate(y,m,d,!!person.leap) : calendar.setSolarDate(y,m,d);
  const roundTrip = isLunar ? calendar.getLunarCalendar() : calendar.getSolarCalendar();
  if (!ok || roundTrip.year!==y || roundTrip.month!==m || roundTrip.day!==d || (isLunar && !!roundTrip.intercalation!==!!person.leap)) {
    throw new Error(isLunar ? '한국 음력에 없는 날짜 또는 윤달이에요. 평달·윤달을 확인해주세요.' : '달력에 없는 날짜예요. 생년월일을 확인해주세요.');
  }
  return {solarDate:ymd(calendar.getSolarCalendar()),lunarDate:ymd(calendar.getLunarCalendar()),leap:!!calendar.getLunarCalendar().intercalation};
}
export function lunarMonthDays(year,month,leap=false) {
  if (!year || !month) return null;
  try { convertBirth({birth:`${year}-${pad(month)}-30`,calendar:'lunar',leap}); return 30; }
  catch { try { convertBirth({birth:`${year}-${pad(month)}-29`,calendar:'lunar',leap}); return 29; } catch { return null; } }
}
export function stemInfo(char) {
  const index=STEMS.indexOf(char);
  return {char,index,korean:stemKo[index],element:ELEMENTS[Math.floor(index/2)],elementIndex:Math.floor(index/2),polarity:index%2===0?'양':'음'};
}
export function ganZhiKo(value) { return value ? stemKo[STEMS.indexOf(value[0])]+branchKo[BRANCHES.indexOf(value[1])] : ''; }
export function dayGanZhi(date) {
  const c=new KoreanLunarCalendar(); const [y,m,d]=date.split('-').map(Number);
  if (!c.setSolarDate(y,m,d)) throw new Error('계산할 수 있는 달력 범위를 벗어났어요.');
  return c.getChineseGapja().day.slice(0,2);
}
// Solar-term library times use UTC+8. Birth inputs and all displayed times use
// fixed Korean standard time (UTC+9), so the library receives one hour earlier.
function calculateAt(date,time,boundary='midnight') {
  const wall=wallDate(date,time);
  const l=solarAt(new Date(wall.getTime()-3600000)).getLunar();
  const dayDate=boundary==='zi' && wall.getUTCHours()===23 ? isoDate(new Date(wall.getTime()+86400000)) : date;
  const day=dayGanZhi(dayDate);
  const branch=Math.floor(((wall.getUTCHours()+1)%24)/2);
  const stem=(STEMS.indexOf(day[0])%5*2+branch)%10;
  return [l.getYearInGanZhiExact(),l.getMonthInGanZhiExact(),day,STEMS[stem]+BRANCHES[branch]];
}
export function solarTerms(year) {
  const table=Solar.fromYmdHms(year,6,15,12,0,0).getLunar().getJieQiTable();
  return Object.entries(table).map(([key,value])=>{
    const stamp=value.toYmdHms();
    const kst=new Date(wallDate(stamp.slice(0,10),stamp.slice(11)).getTime()+3600000);
    return {name:termNames[key] || key,at:kst.toISOString().slice(0,19).replace('T',' ')};
  }).filter(t=>Number(t.at.slice(0,4))===year).sort((a,b)=>a.at.localeCompare(b.at));
}
function countElements(values) {
  const counts=ELEMENTS.map(()=>0);
  values.filter(Boolean).forEach(value=>{counts[Math.floor(STEMS.indexOf(value[0])/2)]++;counts[branchElements[BRANCHES.indexOf(value[1])]]++;});
  return counts;
}
export function calculateChart(person) {
  const converted=convertBirth(person);
  const boundary=person.boundary==='zi'?'zi':'midnight';
  if (!person.unknown && !/^([01]\d|2[0-3]):[0-5]\d$/.test(person.time || '')) throw new Error('태어난 시간을 입력하거나 ‘시간 모름’을 선택해주세요.');
  let scenarios;
  if (person.unknown) {
    const times=['00:00:00','22:59:59','23:00:00','23:59:59'];
    solarTerms(Number(converted.solarDate.slice(0,4))).filter(t=>t.at.startsWith(converted.solarDate)).forEach(t=>{
      const instant=wallDate(t.at.slice(0,10),t.at.slice(11));
      for (const delta of [-1000,1000]) { const d=new Date(instant.getTime()+delta); if (isoDate(d)===converted.solarDate) times.push(d.toISOString().slice(11,19)); }
    });
    scenarios=[...new Map(times.map(t=>{const p=calculateAt(converted.solarDate,t,boundary).slice(0,3);return [p.join(''),p];})).values()];
  } else scenarios=[calculateAt(converted.solarDate,person.time,boundary)];
  const pillars=['년주','월주','일주','시주'].map((label,index)=>{
    const candidates=[...new Set(scenarios.map(s=>s[index]).filter(Boolean))];
    const value=candidates.length===1?candidates[0]:null;
    return {label,value,korean:ganZhiKo(value),candidates,unknown:index===3 && person.unknown};
  });
  const counts=scenarios.map(countElements);
  const elements=ELEMENTS.map((name,i)=>({name,min:Math.min(...counts.map(c=>c[i])),max:Math.max(...counts.map(c=>c[i]))}));
  return {engine:ENGINE,...converted,boundary,unknown:!!person.unknown,pillars,elements,dayMaster:pillars[2].value?stemInfo(pillars[2].value[0]):null,
    warnings:[...(person.unknown?['출생 시간 미상: 시주를 제외했어요.']:[]),...(pillars.some(p=>p.candidates.length>1)?['절기 또는 날짜 경계가 있어요. 출생 시간에 따라 표시한 후보 중 하나로 달라져요.']:[])]};
}
export function tenGod(dayStem,targetStem) {
  const a=stemInfo(dayStem),b=stemInfo(targetStem),same=a.index%2===b.index%2;
  const diff=(b.elementIndex-a.elementIndex+5)%5;
  return [['비견','겁재'],['식신','상관'],['편재','정재'],['편관','정관'],['편인','정인']][diff][same?0:1];
}
export function branchRelation(a,b) {
  if (['子丑','寅亥','卯戌','辰酉','巳申','午未'].some(pair=>pair.includes(a)&&pair.includes(b)&&a!==b)) return '육합';
  if (Math.abs(BRANCHES.indexOf(a)-BRANCHES.indexOf(b))===6) return '충';
  if (a===b) return '같은 일지';
  return '합·충 없음';
}
export function stemRelation(a,b) {
  const x=stemInfo(a),y=stemInfo(b),diff=(y.elementIndex-x.elementIndex+5)%5;
  if (diff===0) return '같은 오행';
  if (diff===1) return `${x.element} → ${y.element} 상생`;
  if (diff===4) return `${y.element} → ${x.element} 상생`;
  return diff===2 ? `${x.element} → ${y.element} 상극` : `${y.element} → ${x.element} 상극`;
}
