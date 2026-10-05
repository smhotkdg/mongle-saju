import {GUARDIANS,CHARM_SETS} from './guardians.js';
export const COLLECTION_KEY='mongle-charms-v1';
export function normalizeCollection(value) {
 const valid=new Set(Array.isArray(value?.owned)?value.owned:[]);
 const owned=GUARDIANS.filter(g=>valid.has(g.key)).map(g=>g.key);
 return {owned,favorite:owned.includes(value?.favorite)?value.favorite:null};
}
export function collectCharm(value,key) {
 const current=normalizeCollection(value);
 if(!GUARDIANS.some(g=>g.key===key))return current;
 return normalizeCollection({...current,owned:[...current.owned,key]});
}
export function collectionBadges(value) {
 const {owned}=normalizeCollection(value);
 return [...CHARM_SETS.map(set=>({...set,count:GUARDIANS.filter(g=>g.set===set.id&&owned.includes(g.key)).length,total:GUARDIANS.filter(g=>g.set===set.id).length})),{id:'all',name:'전체 도감',badge:'몽글 수집가',count:owned.length,total:GUARDIANS.length}];
}
