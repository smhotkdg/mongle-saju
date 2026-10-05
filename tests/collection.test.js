import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {GUARDIANS} from '../src/guardians.js';
import {normalizeCollection,collectCharm,collectionBadges} from '../src/charmCollection.js';
import {makeManual} from '../src/manual.js';
import {makeReport} from '../src/report.js';
import {calculateChart} from '../src/manse.js';
import {makeFortune,publicCard,savedResult} from '../src/fortune.js';
const person={name:'몽글',birth:'2000-02-29',calendar:'solar',time:'09:00',unknown:false,boundary:'midnight'};
const report=extras=>makeReport(calculateChart({...person,...extras}));

test('collection recovers malformed storage, strips unknown data, and cannot favorite an unowned charm',()=>{
 for(const bad of [null,42,'oops',{owned:'words'}]) assert.deepEqual(normalizeCollection(bad),{owned:[],favorite:null});
 assert.deepEqual(normalizeCollection({owned:['words','words','invalid',null,'rest'],favorite:'worry',birth:person.birth}),{owned:['words','rest'],favorite:null});
 const once=collectCharm({},'rest');
 assert.deepEqual(collectCharm(once,'rest'),once);
 assert.deepEqual(collectCharm(once,'invalid'),once);
 assert.equal(normalizeCollection({...once,favorite:'rest'}).favorite,'rest');
 assert.equal(normalizeCollection({owned:[],favorite:'rest'}).favorite,null);
});
test('set badges count distinct charms and all ten illustrations are present',()=>{
 let collection={};
 for(const charm of GUARDIANS.filter(g=>g.set==='protect')) collection=collectCharm(collection,charm.key);
 assert.deepEqual(collectionBadges(collection).map(b=>[b.count,b.total]),[[5,5],[0,5],[5,10]]);
 for(const charm of GUARDIANS) {collection=collectCharm(collection,charm.key);assert.ok(existsSync(new URL('../public'+charm.image,import.meta.url)));}
 assert.deepEqual(collectionBadges(collection).map(b=>[b.count,b.total]),[[5,5],[5,5],[10,10]]);
});
test('manual cards follow calculated themes and preserve uncertainty',()=>{
 const morning=report(),night=report({time:'21:00'});
 assert.deepEqual(makeManual(morning,'friend'),makeManual(night,'friend'));
 assert.notDeepEqual(makeManual(morning,'work').rows,makeManual(night,'work').rows);
 assert.notDeepEqual(makeManual(morning,'friend').rows,makeManual(morning,'partner').rows);
 assert.deepEqual(makeManual(morning,'invalid'),makeManual(morning,'friend'));
 assert.equal(makeManual(report({unknown:true,boundary:'zi'})),null);
});
test('manual audience is kept in saved reports but excluded from public sharing',()=>{
 const result={...makeFortune(person,'saju','2026-10-05'),unlocked:true,manualAudience:'work'};
 assert.equal(savedResult(result).manualAudience,'work');
 assert.equal(publicCard(result).manualAudience,undefined);
 assert.equal(publicCard(result).report,undefined);
});

