import { z } from 'zod';
import { ENGINE, stemInfo } from './manse.js';
import { characterFor } from './report.js';
import { normalizeCollection } from './charmCollection.js';

const text = z.string().max(4000);
const ganzhi = z.string().regex(/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
const chartSchema = z.object({
  engine:z.literal(ENGINE), boundary:z.enum(['midnight','zi']), unknown:z.boolean(),
  pillars:z.array(z.object({ label:z.string().max(10), value:ganzhi.nullable(), korean:z.string().max(10), candidates:z.array(ganzhi).max(8), unknown:z.boolean() })).length(4),
  elements:z.array(z.object({ name:z.enum(['목','화','토','금','수']), min:z.number().int().min(0).max(8), max:z.number().int().min(0).max(8) })).length(5),
  warnings:z.array(text).max(10),
}).transform(chart=>({...chart,dayMaster:chart.pillars[2].value?stemInfo(chart.pillars[2].value[0]):null}));
const resultSchema = z.object({
  id:z.string().min(1).max(500), kind:z.enum(['daily','saju','match']), name:z.string().max(80), title:text,
  date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/), description:text, color:text, item:text, action:text,
  engine:z.literal(ENGINE).optional(), headline:z.string().max(100).optional(), subline:text.optional(),
  chart:chartSchema.optional(), otherChart:chartSchema.optional(), primaryName:z.string().max(40).optional(),
  relation:z.enum(['연인','친구','전 애인']).optional(), evidence:z.array(text).max(30).optional(),
  dailyScenes:z.array(z.object({title:text,text})).max(10).nullable().optional(),
  unlocked:z.boolean().optional(), shared:z.boolean().optional(), score:z.number().min(0).max(100).optional(), scores:z.array(z.number().min(0).max(100)).max(10).optional(),
  reportChecks:z.array(z.number().int().min(1).max(7)).max(7).optional(), storyContext:z.string().max(40).optional(),
  guardKey:z.string().max(40).nullable().optional(), guardBlessedKey:z.string().max(40).nullable().optional(), manualAudience:z.string().max(40).optional(),
}).transform(result=>({...result,...(result.chart?{character:characterFor(result.chart)}:{})}));
// Explicit schemas discard raw birth dates, OAuth tokens and unknown nested fields.
export const vaultSchema = z.object({
  results:z.array(resultSchema).max(20).refine(list=>new Set(list.map(r=>r.id)).size===list.length,'Duplicate result'),
  collection:z.object({owned:z.array(z.string().max(40)).max(10),favorite:z.string().max(40).nullable()}).transform(normalizeCollection),
});
export const emptyVault = () => ({results:[],collection:{owned:[],favorite:null}});
export function guestVault(storage) {
  let results=[],collection={};
  try { results=JSON.parse(storage.getItem('mongle-results') || '[]'); } catch {}
  try { collection=JSON.parse(storage.getItem('mongle-charms-v1') || '{}'); } catch {}
  return {results:Array.isArray(results)?results.filter(r=>r&&typeof r.id==='string'&&typeof r.name==='string'&&typeof r.title==='string').slice(0,20):[],collection:normalizeCollection(collection)};
}
export function importGuest(account, guest) {
  // Account copies win; importing never deletes existing records or preferences.
  const ids = new Set(account.results.map(r=>r.id));
  const valid = guest.results.map(r=>resultSchema.safeParse(r)).filter(r=>r.success).map(r=>r.data);
  return {results:[...account.results,...valid.filter(r=>!ids.has(r.id))].slice(0,20),collection:normalizeCollection({owned:[...account.collection.owned,...guest.collection.owned],favorite:account.collection.favorite||guest.collection.favorite})};
}
