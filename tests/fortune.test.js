import test from 'node:test';
import assert from 'node:assert/strict';
import {makeFortune,makeCompatibility,validatePerson,seoulDate,parseSharedCard,publicCard,savedResult} from '../src/fortune.js';
import {calculateChart,convertBirth,solarTerms,lunarMonthDays,dayGanZhi,tenGod,branchRelation,STEMS,BRANCHES} from '../src/manse.js';

const p={name:'몽글',birth:'2000-02-29',calendar:'solar',time:'09:00',unknown:false};
const at=(date,time='12:00',extras={})=>calculateChart({...p,birth:date,time,...extras});
const values=chart=>chart.pillars.map(p=>p.value);
// Independently published Gregorian/lunar first days and daily gan-zhi.
// Source: https://astro.kasi.re.kr/kor/life/post/calendarData?search_year=2026
const kasiMonths=[
 ['2026-02-17',1,'壬戌'],['2026-03-19',2,'壬辰'],['2026-04-17',3,'辛酉'],
 ['2026-05-17',4,'辛卯'],['2026-06-15',5,'庚申'],['2026-07-14',6,'己丑'],
 ['2026-08-13',7,'己未'],['2026-09-11',8,'戊子'],['2026-10-11',9,'戊午'],
 ['2026-11-09',10,'丁亥'],['2026-12-09',11,'丁巳'],['2027-01-08',12,'丁亥']
];
const kasiTerms=[
 ['소한','01-05 17:23'],['대한','01-20 10:45'],['입춘','02-04 05:02'],['우수','02-19 00:52'],
 ['경칩','03-05 22:59'],['춘분','03-20 23:46'],['청명','04-05 03:40'],['곡우','04-20 10:39'],
 ['입하','05-05 20:49'],['소만','05-21 09:37'],['망종','06-06 00:48'],['하지','06-21 17:25'],
 ['소서','07-07 10:57'],['대서','07-23 04:13'],['입추','08-07 20:43'],['처서','08-23 11:19'],
 ['백로','09-07 23:41'],['추분','09-23 09:05'],['한로','10-08 15:29'],['상강','10-23 18:38'],
 ['입동','11-07 18:52'],['소설','11-22 16:23'],['대설','12-07 11:53'],['동지','12-22 05:50']
];
test('all twelve KASI 2026 lunar first days and daily pillars agree',()=>{
 for(const [solar,month,ganZhi] of kasiMonths){
   const birth='2026-'+String(month).padStart(2,'0')+'-01';
   assert.equal(convertBirth({...p,birth,calendar:'lunar'}).solarDate,solar);
   assert.equal(convertBirth({...p,birth:solar}).lunarDate,birth);
   assert.equal(dayGanZhi(solar),ganZhi);
 }
});
test('all 24 solar-term instants agree with KASI published minute within 31 seconds',()=>{
 const terms=solarTerms(2026);assert.equal(terms.length,24);
 for(const [name,date] of kasiTerms){
   const actual=terms.find(t=>t.name===name);assert.ok(actual);
   const difference=Math.abs(Date.parse(actual.at.replace(' ','T')+'Z')-Date.parse('2026-'+date+':00Z'));
   assert.ok(difference<=31000,name+' differs '+difference+'ms');
 }
});
test('Korean leap month is round-tripped and invalid leap flags are rejected',()=>{
 const leap=convertBirth({...p,birth:'2017-05-01',calendar:'lunar',leap:true});
 assert.equal(leap.solarDate,'2017-06-24');assert.equal(leap.leap,true);
 assert.equal(convertBirth({...p,birth:'2017-06-24'}).lunarDate,'2017-05-01');
 assert.throws(()=>convertBirth({...p,birth:'2026-01-01',calendar:'lunar',leap:true}));
 assert.equal(lunarMonthDays(2026,1),30);assert.equal(lunarMonthDays(2026,2),29);
 assert.ok(validatePerson({...p,birth:'2026-02-30',calendar:'lunar'},'2026-10-05'));
 assert.equal(validatePerson({...p,birth:'2026-01-30',calendar:'lunar'},'2026-10-05'),'');
 assert.equal(lunarMonthDays(2026,2,true),null);
});
test('solar invalid dates, future converted lunar dates and unknown times are validated',()=>{
 assert.equal(validatePerson(p,'2026-10-05'),'');assert.ok(validatePerson({...p,birth:'2001-02-29'}));
 assert.ok(validatePerson({...p,birth:'2026-12-01',calendar:'lunar'},'2026-10-05'));
 assert.ok(validatePerson({...p,birth:'2027-01-01'},'2026-10-05'));
 assert.ok(validatePerson({...p,time:''}));assert.equal(validatePerson({...p,time:'',unknown:true}),'');
 assert.ok(validatePerson({...p,time:'24:00'}));assert.ok(validatePerson({...p,birth:'1899-01-01'}));
});
test('year/month change at the KST instant of 입춘, not lunar new year',()=>{
 assert.deepEqual(values(at('2026-02-04','05:01')).slice(0,2),['乙巳','己丑']);
 assert.deepEqual(values(at('2026-02-04','05:03')).slice(0,2),['丙午','庚寅']);
 assert.equal(values(at('2026-02-16'))[0],'丙午');
 assert.equal(values(at('2026-02-17'))[0],'丙午');
});
test('monthly 절 boundaries use KST even when China date is previous day',()=>{
 assert.equal(values(at('2026-03-05','22:58'))[1],'庚寅');
 assert.equal(values(at('2026-03-05','23:00'))[1],'辛卯');
 assert.equal(values(at('2026-06-06','00:47'))[1],'癸巳');
 assert.equal(values(at('2026-06-06','00:49'))[1],'甲午');
 assert.equal(values(at('2026-02-19','00:53'))[1],'庚寅'); // 우수 is not a month boundary.
});
test('Korean civil day and hour stem are not taken from UTC+8 day',()=>{
 assert.deepEqual(values(at('2026-02-17','00:00')),['丙午','庚寅','壬戌','庚子']);
 assert.equal(values(at('2026-02-17','00:59'))[3],'庚子');
 assert.equal(values(at('2026-02-17','01:00'))[3],'辛丑');
 assert.equal(values(at('2026-02-17','12:00'))[3],'丙午');
 assert.equal(values(at('2026-02-17','22:59'))[3],'辛亥');
 assert.deepEqual(values(at('2026-02-17','23:00')).slice(2),['壬戌','庚子']);
 assert.deepEqual(values(at('2026-02-17','23:00',{boundary:'zi'})).slice(2),['癸亥','壬子']);
 assert.equal(values(at('2026-02-18','00:00'))[2],'癸亥');
});
test('every day stem maps all twelve hour branches by the five-rat rule',()=>{
 const cycleStarts=['甲','丙','戊','庚','壬','甲','丙','戊','庚','壬'];
 for(let offset=0;offset<10;offset++){
   const date=new Date(Date.UTC(2026,1,17+offset)).toISOString().slice(0,10);
   const dayIndex=STEMS.indexOf(dayGanZhi(date)[0]);
   for(let branch=0;branch<12;branch++){
     const hour=branch===0?0:branch*2;
     const expected=STEMS[(STEMS.indexOf(cycleStarts[dayIndex])+branch)%10]+BRANCHES[branch];
     assert.equal(values(at(date,String(hour).padStart(2,'0')+':00'))[3],expected);
   }
 }
});
test('unknown time omits hour pillar and exposes changing year/month/day candidates',()=>{
 const c=at('2026-02-04','',{unknown:true});
 assert.equal(c.pillars[3].value,null);assert.equal(c.pillars[3].candidates.length,0);
 assert.deepEqual(c.pillars[0].candidates,['乙巳','丙午']);
 assert.deepEqual(c.pillars[1].candidates,['己丑','庚寅']);
 assert.equal(c.pillars[2].value,'己酉');
 const midnight=at('2026-02-17','',{unknown:true});
 assert.equal(midnight.elements.reduce((n,e)=>n+e.min,0),6);
 const zi=at('2026-02-17','',{unknown:true,boundary:'zi'});
 assert.deepEqual(zi.pillars[2].candidates,['壬戌','癸亥']);assert.equal(zi.dayMaster,null);
});
test('equivalent solar/lunar dates produce identical original charts',()=>{
 const solar=at('2017-06-24','09:00');
 const lunar=at('2017-05-01','09:00',{calendar:'lunar',leap:true});
 assert.deepEqual(solar,lunar);assert.equal(solar.elements.reduce((n,e)=>n+e.min,0),8);
});
test('ten gods and all six pairs of 합/충 follow element/polarity rules',()=>{
 const expected=['비견','겁재','식신','상관','편재','정재','편관','정관','편인','정인'];
 [...STEMS].forEach((stem,i)=>assert.equal(tenGod('甲',stem),expected[i]));
 assert.equal(tenGod('乙','甲'),'겁재');assert.equal(tenGod('壬','辛'),'정인');
 for(const pair of ['子丑','寅亥','卯戌','辰酉','巳申','午未']){
   assert.equal(branchRelation(pair[0],pair[1]),'육합');assert.equal(branchRelation(pair[1],pair[0]),'육합');
 }
 for(let i=0;i<6;i++) assert.equal(branchRelation(BRANCHES[i],BRANCHES[i+6]),'충');
 assert.equal(branchRelation('子','子'),'같은 일지');assert.equal(branchRelation('子','寅'),'합·충 없음');
});
test('daily result is deterministic and reflects actual today pillar without invented scores',()=>{
 const a=makeFortune(p,'daily','2026-10-05'),b=makeFortune(p,'daily','2026-10-06');
 assert.deepEqual(a,makeFortune(p,'daily','2026-10-05'));assert.notEqual(a.id,b.id);
 assert.equal(a.score,undefined);assert.equal(a.headline,tenGod(a.chart.dayMaster.char,dayGanZhi(a.date)[0]));
 assert.ok(a.subline.includes(dayGanZhi(a.date)));
 assert.equal(seoulDate(new Date('2026-10-04T15:01:00Z')),'2026-10-05');
});
test('compatibility is symmetric and relation type only changes advice',()=>{
 const b={...p,name:'콩이',birth:'1999-04-12'};
 const a=makeCompatibility(p,b,'친구'),reverse=makeCompatibility(b,p,'친구'),lover=makeCompatibility(p,b,'연인');
 assert.equal(a.headline,reverse.headline);assert.equal(a.subline,reverse.subline);
 assert.equal(a.headline,lover.headline);assert.deepEqual(a.chart,lover.chart);assert.notEqual(a.description,lover.description);
 assert.equal(a.score,undefined);
});
test('shared and saved payloads omit raw birth data and shared links cannot unlock readings',()=>{
 const result=makeFortune(p,'saju'),card=publicCard(result),stored=savedResult(result);
 assert.equal(card.chart,undefined);assert.equal(card.birth,undefined);assert.equal(card.readings,undefined);
 assert.equal(stored.chart.solarDate,undefined);assert.equal(stored.chart.lunarDate,undefined);assert.ok(stored.chart.pillars);
 const shared=parseSharedCard('#card='+encodeURIComponent(JSON.stringify({...card,unlocked:true,birth:p.birth,chart:result.chart})));
 assert.equal(shared.headline,result.headline);assert.equal(shared.unlocked,false);assert.equal(shared.chart,undefined);
 assert.equal(shared.birth,undefined);
 assert.equal(parseSharedCard('#card=%broken'),null);
 assert.equal(parseSharedCard('#card='+encodeURIComponent(JSON.stringify({...card,headline:'x'.repeat(25)}))),null);
 assert.equal(parseSharedCard('#card='+encodeURIComponent(JSON.stringify({...card,engine:'unsupported'}))),null);
});
test('old demo shared cards remain readable and have no calculation engine marker',()=>{
 const legacy={kind:'daily',name:'몽글',title:'이전 카드',description:'데모',date:'2026-10-05',color:'핑크',item:'메모',action:'쉬기',score:88,scores:[88,77,66,55]};
 const shared=parseSharedCard('#card='+encodeURIComponent(JSON.stringify(legacy)));
 assert.equal(shared.score,88);assert.equal(shared.engine,undefined);assert.deepEqual(shared.scores,legacy.scores);
});
