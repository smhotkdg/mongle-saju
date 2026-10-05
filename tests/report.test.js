import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {calculateChart} from '../src/manse.js';
import {guardianFor} from '../src/guardians.js';
import {makeReport,characterFor,makeMatchStory,ART_KEYS} from '../src/report.js';
import {makeFortune,publicCard,parseSharedCard,savedResult} from '../src/fortune.js';
import {makeLifeReadings} from '../src/lifeReadings.js';

const person={name:'몽글',birth:'2000-02-29',calendar:'solar',time:'09:00',unknown:false,boundary:'midnight'};
const chart=extras=>calculateChart({...person,...extras});
const share=card=>'#card='+encodeURIComponent(JSON.stringify(card));

test('all ten report types use complete verdicts and job sentences without asserting uncertain work themes',()=>{
 const reports=Array.from({length:10},(_,i)=>makeReport(chart({birth:`2000-03-${String(i+1).padStart(2,'0')}`})));
 assert.equal(new Set(reports.map(r=>r.persona.type)).size,10);
 for(const r of reports){
  assert.match(r.persona.intro,/타입입니다/);
  for(const job of r.jobs){assert.match(job.scene,/다\.$/);assert.doesNotMatch(job.scene,/장면|떠올려/);}
  for(const key of ['money','wealth','family','health','love']){
   assert.doesNotMatch(r.lifeReadings[key].story,/떠올려|장면/);
   assert.match(r.lifeReadings[key].title,/타입|형입니다/);
  }
 }
 const uncertain=makeReport(chart({birth:'2026-02-04',unknown:true}));
 assert.equal(uncertain.theme.generic,true);
 assert.match(uncertain.theme.hook,/확정하지/);
 assert.match(uncertain.lifeReadings.money.insight,/일반 예시/);
});

test('life readings cover six domains, vary by real chart symbols and preserve unknown-hour limits',()=>{
 const reports=Array.from({length:10},(_,i)=>makeReport(chart({birth:`2000-03-${String(i+1).padStart(2,'0')}`})));
 assert.equal(new Set(reports.map(r=>r.lifeReadings.love.title)).size,10);
 assert.equal(new Set(reports.map(r=>r.lifeReadings.wealth.title)).size,5);
 for(const r of reports){
  assert.deepEqual(Object.keys(r.lifeReadings).sort(),['version','money','wealth','love','family','health','pets'].sort());
  for(const key of ['money','wealth','love','family','health','pets']){
   const d=r.lifeReadings[key];assert.ok(d.title&&d.story&&d.action&&d.basis&&d.note);
  }
  assert.equal(r.lifeReadings.pets.matches.length,2);assert.equal(r.lifeReadings.pets.checks.length,4);
  assert.ok(r.lifeReadings.pets.matches.every(p=>p.scene&&p.care));
 }
 const a=makeReport(chart()),b=makeReport(chart({time:'21:00'}));
 assert.notEqual(a.lifeReadings.money.insight,b.lifeReadings.money.insight);
 assert.equal(a.lifeReadings.wealth.story,b.lifeReadings.wealth.story);
 assert.equal(makeReport(chart({unknown:true,boundary:'zi'})).lifeReadings,undefined);
 const unknown=makeReport(chart({unknown:true}));
 assert.ok(unknown.lifeReadings.health.note.includes('진단'));
});

test('saved legacy charts can generate life chapters and private domains stay out of shared cards',()=>{
 const result=makeFortune(person,'saju','2026-10-05');
 const stored=JSON.parse(JSON.stringify(savedResult(result)));
 assert.ok(stored.report.lifeReadings.family.story);
 delete stored.report.lifeReadings;
 assert.deepEqual(makeLifeReadings(stored.chart,stored.report.theme),result.report.lifeReadings);
 const card=publicCard(result);
 assert.equal(card.lifeReadings,undefined);assert.equal(card.report,undefined);
 assert.equal(makeLifeReadings({dayMaster:null}),null);
});

test('story examples vary with day stems and calculated work themes, with practical career steps',()=>{
 const reports=Array.from({length:10},(_,i)=>makeReport(chart({birth:`2000-03-${String(i+1).padStart(2,'0')}`})));
 assert.equal(new Set(reports.map(r=>r.storyDetails.hook)).size,10);
 assert.equal(new Set(reports.map(r=>r.storyDetails.self[0][1])).size,10);
 for(const r of reports){
  assert.equal(r.storyDetails.self.length,3);assert.equal(r.storyDetails.love.length,2);
  for(const job of r.jobs)assert.equal(r.storyDetails.career[job.title].length,3);
  assert.equal(r.storyDetails.contexts['job-seeking'].length,2);
 }
 const morning=makeReport(chart()),night=makeReport(chart({time:'21:00'}));
 assert.deepEqual(morning.storyDetails.self,night.storyDetails.self);
 assert.notDeepEqual(morning.storyDetails.office,night.storyDetails.office);
});

test('expanded stories do not infer an uncertain character or ambiguous month season, or leak through public cards',()=>{
 assert.equal(makeReport(chart({unknown:true,boundary:'zi'})).storyDetails,undefined);
 assert.equal(makeReport(chart({birth:'2026-02-04',unknown:true})).storyDetails.seasonExample,null);
 const result=makeFortune(person,'saju','2026-10-05');
 assert.ok(savedResult(result).report.storyDetails.self.length);
 assert.equal(publicCard(result).storyDetails,undefined);assert.equal(publicCard(result).report,undefined);
});

test('a complete day-stem cycle has ten distinct stories and five available illustration assets',()=>{
 const reports=Array.from({length:10},(_,i)=>makeReport(chart({birth:`2000-03-${String(i+1).padStart(2,'0')}`})));
 assert.equal(new Set(reports.map(r=>r.character.name)).size,10);
 assert.equal(new Set(reports.map(r=>r.character.key)).size,5);
 for(const r of reports){
  assert.ok(existsSync(new URL('../public'+r.character.image,import.meta.url)));
  assert.equal(r.jobs.length,3);assert.equal(r.contexts.length,5);assert.equal(r.plan.length,7);
  assert.ok(r.tinyScene.length>50);assert.ok(r.persona.bright.length>50);
  assert.ok(r.office.say&&r.love.say&&r.season.story&&r.basis.work);
  assert.ok(r.contexts.every(c=>c.story&&c.action&&c.personal));
 }
});

test('actual hour and month stem relationships change job examples without changing a fixed day-stem character',()=>{
 const morning=makeReport(chart()),night=makeReport(chart({time:'21:00'})),laterMonth=makeReport(chart({birth:'2000-04-29'}));
 assert.equal(morning.character.name,night.character.name);assert.equal(morning.character.name,laterMonth.character.name);
 assert.equal(morning.theme.id,'maker');assert.equal(night.theme.id,'resource');assert.equal(laterMonth.theme.id,'resource');
 assert.notDeepEqual(morning.jobs,night.jobs);
 assert.equal(morning.theme.relations.find(r=>r.pillar==='월주').role,'상관');
 assert.equal(night.theme.relations.find(r=>r.pillar==='시주').role,'편재');
});

test('unknown day boundaries do not invent a character, while unknown other stems label jobs as generic',()=>{
 const uncertain=chart({unknown:true,boundary:'zi'});
 assert.equal(characterFor(uncertain),null);assert.equal(makeReport(uncertain).uncertain,true);
 assert.equal(makeReport(uncertain).jobs,undefined);
 const termDay=makeReport(chart({birth:'2026-02-04',unknown:true}));
 assert.equal(termDay.theme.generic,true);assert.equal(termDay.theme.relations.length,0);
 assert.match(termDay.theme.label,/시간 확인 전/);assert.match(termDay.basis.work,/일반적인 탐색/);
});

test('rich paid content and interaction state stay private while public character art is reconstructed locally',()=>{
 const result={...makeFortune(person,'saju','2026-10-05'),unlocked:true,storyContext:'job-seeking',reportChecks:[1,3],guardKey:'worry',guardBlessedKey:'worry'};
 const publicData=publicCard(result),parsed=parseSharedCard(share({...publicData,character:{...publicData.character,image:'https://example.com/tracker.png'}}));
 for(const key of ['chart','report','dailyScenes','matchStory','storyContext','reportChecks','guardKey','guardBlessedKey','unlocked'])assert.equal(publicData[key],undefined);
 assert.equal(publicData.character.key,'fire');assert.equal(parsed.character.image,'/characters/fire.png');
 assert.equal(parsed.unlocked,false);
 assert.equal(parseSharedCard(share({...publicData,character:{...publicData.character,key:'../secret'}})),null);
 assert.ok(ART_KEYS.includes(parsed.character.key));
 const stored=JSON.parse(JSON.stringify(savedResult(result)));
 assert.equal(stored.chart.solarDate,undefined);assert.equal(stored.chart.lunarDate,undefined);
 assert.equal(JSON.stringify(stored).includes(person.birth),false);
 assert.equal(stored.storyContext,'job-seeking');assert.deepEqual(stored.reportChecks,[1,3]);
 assert.equal(stored.report.character.name,result.report.character.name);
 assert.equal(stored.guardKey,'worry');assert.equal(stored.guardBlessedKey,'worry');
});

test('relationship situations retain calculated characters and only alter context for an ex',()=>{
 const a=chart(),b=chart({birth:'2000-03-01'});
 const couple=makeMatchStory(a,b,'연인'),ex=makeMatchStory(a,b,'전 애인');
 assert.deepEqual(couple.characters,ex.characters);assert.equal(couple.cards.length,3);
 assert.notEqual(couple.cards[2].text,ex.cards[2].text);assert.match(ex.cards[2].text,/현재 마음을 알려주지/);
 assert.equal(makeMatchStory(chart({unknown:true,boundary:'zi'}),b,'연인'),null);
});

test('daily scene narratives follow the actual ten-god relation and are repeatable',()=>{
 const first=makeFortune(person,'daily','2026-10-05'),next=makeFortune(person,'daily','2026-10-06');
 assert.equal(first.dailyScenes.length,3);assert.deepEqual(first.dailyScenes,makeFortune(person,'daily','2026-10-05').dailyScenes);
 assert.notEqual(first.headline,next.headline);assert.notEqual(first.dailyScenes[0].text,next.dailyScenes[0].text);
});

test('an ambiguous day stem has no inferred charm, and a deliberate selection overrides the symbolic default',()=>{
 const unknown=chart({unknown:true,boundary:'zi'});
 assert.equal(guardianFor(unknown),null);
 assert.equal(guardianFor(unknown,'not-a-charm'),null);
 assert.equal(guardianFor(unknown,'worry').key,'worry');
 assert.match(guardianFor(unknown,'worry').reason,/직접 고른/);
 assert.equal(guardianFor(chart()).key,'words');
 assert.equal(guardianFor(chart(),'worry').key,'worry');
 assert.equal(guardianFor(chart(),'https://example.com/asset').image,'/guardians/words.png');
});
