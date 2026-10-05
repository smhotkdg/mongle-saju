import test from 'node:test';
import assert from 'node:assert/strict';
import {wrapCardText} from '../src/resultCard.js';
import {makeFortune,makeCompatibility,makeSajuFromResult,savedResult,publicCard,parseSharedCard} from '../src/fortune.js';

const me={name:'내 이름 & 별명',birth:'2000-02-29',calendar:'solar',time:'09:00',unknown:false,boundary:'midnight'};
const day='2026-10-05';

test('card wrapping keeps Korean words intact, handles long words and preserves Unicode and explicit lines',()=>{
 const measure=s=>Array.from(s).length;
 assert.deepEqual(wrapCardText('편안한 약속을 만드는 하루',8,measure),['편안한 약속을','만드는 하루']);
 const text='아주긴한글닉네임입니다 🐹 좋은 하루';
 const rows=wrapCardText(text,6,measure);
 assert.ok(rows.every(r=>measure(r)<=6));
 assert.equal(rows.join('').replaceAll(' ',''),text.replaceAll(' ',''));
 assert.deepEqual(wrapCardText('첫 줄\n둘째 줄',20,measure),['첫 줄','둘째 줄']);
});

test('daily and compatibility continuation use my exact chart without requiring raw birth data or unlocking payment',()=>{
 const direct=makeFortune(me,'saju',day),daily=makeFortune(me,'daily',day);
 assert.deepEqual(makeSajuFromResult(daily),direct);
 const partner={...me,name:'상대방',birth:'2001-01-01',time:'21:00'};
 const match=makeCompatibility(me,partner,'연인',day);
 const next=makeSajuFromResult(savedResult(match));
 assert.equal(next.name,me.name);assert.equal(next.id,direct.id);
 assert.deepEqual(next.chart.pillars,direct.chart.pillars);assert.deepEqual(next.report,direct.report);
 assert.equal(next.chart.solarDate,undefined);assert.equal(next.otherChart,undefined);
 assert.equal(next.primaryName,undefined);assert.equal(next.unlocked,false);
 assert.equal(publicCard(match).primaryName,undefined);
});

test('shared cards and old results without a reliable owner require fresh input instead of reusing another chart',()=>{
 const daily=makeFortune(me,'daily',day);
 const shared=parseSharedCard('#card='+encodeURIComponent(JSON.stringify(publicCard(daily))));
 assert.equal(makeSajuFromResult(shared),null);
 assert.equal(makeSajuFromResult({...daily,shared:true}),null);
 const match=makeCompatibility(me,{...me,name:'상대방'},'친구',day);
 delete match.primaryName;
 assert.equal(makeSajuFromResult(match),null);
 assert.equal(makeSajuFromResult(null),null);
});
