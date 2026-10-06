import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../server/store.js';
import { createApi } from '../server/app.js';
import { authorizationUrl, providersFromEnv, exchangeIdentity } from '../server/providers.js';
import { emptyVault, vaultSchema, importGuest } from '../src/vault.js';
import { makeFortune, makeCompatibility } from '../src/fortune.js';

const env={APP_ORIGIN:'http://127.0.0.1:5173',GOOGLE_CLIENT_ID:'test-google',GOOGLE_CLIENT_SECRET:'test-only',KAKAO_CLIENT_ID:'test-kakao',NAVER_CLIENT_ID:'test-naver',NAVER_CLIENT_SECRET:'test-only'};
const person={name:'테스트',birth:'1995-03-12',time:'10:30',calendar:'solar',boundary:'midnight',unknown:false};
const cookie=res=>res.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
async function harness(t) {
  const store=createStore(':memory:');
  let exchanges=0;
  const api=createApi({env,store,exchange:async(_id,_provider,_callback,code)=>{exchanges++;return {subject:code,name:'테스트 친구'};}});
  const server=api.app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));store.close();});
  const request=(path,options={})=>fetch(base+path,{redirect:'manual',...options});
  async function login(provider='google',code='person-1') {
    const start=await request('/auth/'+provider);
    const state=new URL(start.headers.get('location')).searchParams.get('state');
    const end=await request(`/auth/${provider}/callback?state=${state}&code=${code}`,{headers:{cookie:cookie(start)}});
    assert.equal(end.headers.get('location'),env.APP_ORIGIN+'/#account');
    const sessionCookie=cookie(end);
    const session=await (await request('/session',{headers:{cookie:sessionCookie}})).json();
    return {session,headers:{cookie:sessionCookie,Origin:env.APP_ORIGIN,'X-CSRF-Token':session.csrf,'Content-Type':'application/json'}};
  }
  return {store,request,login,exchanges:()=>exchanges};
}
test('OAuth providers are disabled without keys; Google uses nonce and PKCE',()=>{
  assert.ok(Object.values(providersFromEnv({})).every(p=>!p.enabled));
  const p=providersFromEnv(env),u=new URL(authorizationUrl('google',p.google,'https://example.com/api/auth/google/callback',{state:'state',nonce:'nonce',verifier:'verifier'}));
  assert.equal(u.searchParams.get('code_challenge_method'),'S256');assert.equal(u.searchParams.get('nonce'),'nonce');assert.equal(u.searchParams.get('scope'),'openid profile');
});
test('OAuth state, browser binding, provider binding and replay are enforced',async t=>{
  const h=await harness(t);
  let start=await h.request('/auth/google');let state=new URL(start.headers.get('location')).searchParams.get('state');
  let bad=await h.request(`/auth/google/callback?state=${state}&code=attacker`);
  assert.match(bad.headers.get('location'),/invalid_state/);
  bad=await h.request(`/auth/naver/callback?state=${state}&code=attacker`,{headers:{cookie:cookie(start)}});
  assert.match(bad.headers.get('location'),/invalid_state/);assert.equal(h.exchanges(),0);
  start=await h.request('/auth/google');state=new URL(start.headers.get('location')).searchParams.get('state');
  const opts={headers:{cookie:cookie(start)}};
  const ok=await h.request(`/auth/google/callback?state=${state}&code=good`,opts);assert.match(ok.headers.get('location'),/#account$/);
  const replay=await h.request(`/auth/google/callback?state=${state}&code=good`,opts);assert.match(replay.headers.get('location'),/invalid_state/);assert.equal(h.exchanges(),1);
  const sessionHeader=ok.headers.getSetCookie().find(v=>v.startsWith('mongle-session='));assert.match(sessionHeader,/HttpOnly/);assert.match(sessionHeader,/SameSite=Lax/);
});
test('all providers create isolated users, vaults require session, CSRF and exact origin',async t=>{
  const h=await harness(t),a=await h.login('kakao'),b=await h.login('naver'),g=await h.login();
  assert.equal(new Set([a.session.user.id,b.session.user.id,g.session.user.id]).size,3);
  assert.equal((await h.request('/vault')).status,401);
  const data={...emptyVault(),results:[makeFortune(person,'saju')]},body=JSON.stringify({data,revision:0});
  assert.equal((await h.request('/vault',{method:'PUT',headers:{...a.headers,'X-CSRF-Token':'wrong'},body})).status,403);
  assert.equal((await h.request('/vault',{method:'PUT',headers:{...a.headers,Origin:'https://attacker.example'},body})).status,403);
  assert.equal((await h.request('/vault',{method:'PUT',headers:a.headers,body})).status,200);
  const own=await (await h.request('/vault',{headers:a.headers})).json(),other=await (await h.request('/vault',{headers:b.headers})).json();
  assert.equal(own.data.results.length,1);assert.equal(other.data.results.length,0);
  assert.equal((await h.request('/vault',{method:'PUT',headers:a.headers,body})).status,409);
  assert.equal((await h.request('/vault',{method:'PUT',headers:a.headers,body:JSON.stringify({revision:1,data:{...emptyVault(),results:[{id:'bad'}]}})})).status,400);
  const repeat=await h.login('kakao');assert.equal(repeat.session.user.id,a.session.user.id);
  await h.request('/logout',{method:'POST',headers:a.headers});assert.equal((await h.request('/vault',{headers:a.headers})).status,401);
  await h.request('/account',{method:'DELETE',headers:repeat.headers});assert.equal((await h.request('/vault',{headers:repeat.headers})).status,401);
  const recreated=await h.login('kakao');assert.notEqual(recreated.session.user.id,a.session.user.id);assert.equal((await (await h.request('/vault',{headers:recreated.headers})).json()).data.results.length,0);
});
test('vault schema preserves supported results and checks while discarding birth data and unknown fields',()=>{
  const results=['daily','saju'].map(kind=>makeFortune(person,kind));results.push(makeCompatibility(person,{...person,name:'친구',birth:'1994-07-15'},'친구'));
  results[1].reportChecks=[1,3];results[1].birth='private';results[1].chart.secret='private';
  const vault=vaultSchema.parse({results,collection:{owned:[],favorite:null},access_token:'private'});
  const serialized=JSON.stringify(vault);assert.ok(!serialized.includes('solarDate'));assert.ok(!serialized.includes('lunarDate'));assert.ok(!serialized.includes('private'));assert.deepEqual(vault.results[1].reportChecks,[1,3]);assert.ok(vault.results[1].character);
  const imported=importGuest(vault,{results:[...results,{bad:true}],collection:{owned:[],favorite:null}});assert.equal(imported.results.length,3);
});
test('SQLite vault and sessions survive restart; stale session and transaction are rejected',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mongle-account-')),path=join(dir,'test.sqlite');
  try {
    let store=createStore(path);const user=store.user('google','id','친구'),session=store.createSession(user.id);store.save(user.id,emptyVault(),0);store.close();
    store=createStore(path);assert.equal(store.session(session.id).id,user.id);assert.equal(store.vault(user.id).revision,1);store.logout(session.id);assert.equal(store.session(session.id),undefined);store.close();
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('Kakao and Naver exchange codes only server-side and reject provider errors',async()=>{
  const providers=providersFromEnv(env);
  for(const id of ['kakao','naver']){
    let calls=0;
    const request=async(url,options)=>{calls++;if(calls===1){assert.equal(url,providers[id].token);assert.equal(options.method,'POST');assert.equal(options.body.get('code'),'one-use-code');return Response.json({access_token:'test-access'});}assert.equal(options.headers.Authorization,'Bearer test-access');return Response.json(id==='kakao'?{id:42,kakao_account:{profile:{nickname:'친구'}}}:{resultcode:'00',response:{id:'42',nickname:'친구'}});};
    assert.deepEqual(await exchangeIdentity(id,providers[id],'https://example.com/callback','one-use-code',{state:'state'},request),{subject:'42',name:'친구'});
    await assert.rejects(()=>exchangeIdentity(id,providers[id],'https://example.com/callback','code',{state:'state'},async()=>Response.json({error:'invalid_grant'})));
  }
});
