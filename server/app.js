import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import { createStore, token } from './store.js';
import { providersFromEnv, authorizationUrl, exchangeIdentity } from './providers.js';
import { vaultSchema } from '../src/vault.js';
import { paymentRoutes, reportKey } from './payments.js';

const same = (a,b) => typeof a==='string' && typeof b==='string' && Buffer.byteLength(a)===Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a),Buffer.from(b));
const cookies = req => Object.fromEntries((req.headers.cookie||'').split(';').map(v=>v.trim().split('=')).filter(v=>v.length===2));
export function createApi({ env=process.env, store=createStore(resolve(env.DATA_DIR||'data','mongle.sqlite')), exchange=exchangeIdentity, paymentGateway }={}) {
  const origin = new URL(env.APP_ORIGIN || 'http://127.0.0.1:5173').origin;
  if (env.NODE_ENV==='production' && !origin.startsWith('https://')) throw new Error('Production APP_ORIGIN must use HTTPS');
  const providers = providersFromEnv(env), app = express();
  app.disable('x-powered-by');
  const cookieOptions = { httpOnly:true, sameSite:'lax', secure:origin.startsWith('https:'), path:'/' };
  const sessionCookie = cookieOptions.secure ? '__Host-mongle-session' : 'mongle-session';
  const oauthCookie = cookieOptions.secure ? '__Host-mongle-oauth' : 'mongle-oauth';
  const callback = id => `${origin}/api/auth/${id}/callback`;
  app.use((req,res,next)=>{res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});store.cleanup();next();});
  app.use(rateLimit({windowMs:60000,limit:240,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'요청이 많아요. 잠시 후 다시 시도해주세요.'}}));
  app.use(express.json({limit:'512kb'}));
  // Local simulations never call a payment provider or create purchase records.
  const localPaymentMock=env.NODE_ENV==='development' && ['127.0.0.1','localhost','[::1]'].includes(new URL(origin).hostname) && env.PAYMENT_LOCAL_MOCK!=='false';
  app.get('/health',(_req,res)=>res.json({ok:true,localPaymentMock}));
  app.get('/session',(req,res)=>{
    const user = store.session(cookies(req)[sessionCookie]);
    res.json({user:user?{id:user.id,name:user.name,provider:user.provider}:null,csrf:user?.csrf||null,providers:Object.entries(providers).map(([id,p])=>({id,label:p.label,enabled:p.enabled}))});
  });
  const loginLimit=rateLimit({windowMs:600000,limit:30,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'로그인 시도가 많아요. 잠시 후 다시 시도해주세요.'}});
  app.get('/auth/:provider',loginLimit,(req,res)=>{
    const id=req.params.provider, provider=providers[id];
    if (!provider?.enabled) return res.redirect(`${origin}/?auth_error=not_configured#account`);
    // Only the fixed configured origin can initiate a cookie-bound transaction.
    if (req.get('Sec-Fetch-Site')==='cross-site') return res.status(403).json({error:'서비스에서 로그인을 시작해주세요.'});
    const transaction={state:token(),verifier:token(),nonce:token()};
    store.consumeOAuth(cookies(req)[oauthCookie]);
    const handle=store.startOAuth(id,transaction.state,transaction.verifier,transaction.nonce);
    res.cookie(oauthCookie,handle,{...cookieOptions,maxAge:600000});
    res.redirect(authorizationUrl(id,provider,callback(id),transaction));
  });
  app.get('/auth/:provider/callback',loginLimit,async(req,res)=>{
    const id=req.params.provider, provider=providers[id];
    const transaction=store.consumeOAuth(cookies(req)[oauthCookie]);
    res.clearCookie(oauthCookie,cookieOptions);
    if (!provider?.enabled || !transaction || transaction.expires<=Date.now() || transaction.provider!==id || !same(transaction.state,req.query.state)) return res.redirect(`${origin}/?auth_error=invalid_state#account`);
    if (req.query.error) return res.redirect(`${origin}/?auth_error=cancelled#account`);
    if (typeof req.query.code!=='string' || req.query.code.length>4096) return res.redirect(`${origin}/?auth_error=failed#account`);
    try {
      const identity=await exchange(id,provider,callback(id),req.query.code,transaction);
      if (typeof identity.subject!=='string'||!identity.subject||identity.subject.length>255) throw new Error('Invalid identity');
      const user=store.user(id,identity.subject,identity.name.slice(0,80));
      store.logout(cookies(req)[sessionCookie]);
      const session=store.createSession(user.id);
      res.cookie(sessionCookie,session.id,{...cookieOptions,maxAge:7*86400000});
      res.redirect(`${origin}/#account`);
    } catch { res.redirect(`${origin}/?auth_error=failed#account`); }
  });
  app.use((req,res,next)=>{
    const user=store.session(cookies(req)[sessionCookie]);
    if(!user)return res.status(401).json({error:'로그인이 만료됐어요. 다시 로그인해주세요.'});
    if(!['GET','HEAD'].includes(req.method) && (req.get('Origin')!==origin || !same(req.get('X-CSRF-Token'),user.csrf))) return res.status(403).json({error:'요청을 확인하지 못했어요. 새로고침 후 다시 시도해주세요.'});
    req.user=user;next();
  });
  app.use('/payments',paymentRoutes({env,store,origin,gateway:paymentGateway}));
  const authorizeVault=(userId,data)=>({...data,results:data.results.map(r=>({...r,unlocked:store.paidReport(userId,reportKey(r))}))});
  app.get('/vault',(req,res)=>{const v=store.vault(req.user.id);res.json({...v,data:authorizeVault(req.user.id,v.data)});});
  app.put('/vault',(req,res)=>{
    const parsed=vaultSchema.safeParse(req.body?.data), revision=req.body?.revision;
    if(!parsed.success || !Number.isSafeInteger(revision) || revision<0) return res.status(400).json({error:'보관할 데이터 형식을 확인해주세요.'});
    const next=store.save(req.user.id,authorizeVault(req.user.id,parsed.data),revision);
    if(next===null)return res.status(409).json({error:'다른 탭이나 기기에서 보관함이 바뀌었어요. 최신 보관함을 불러온 뒤 다시 변경해주세요.'});
    res.json({revision:next});
  });
  app.post('/logout',(req,res)=>{store.logout(cookies(req)[sessionCookie]);res.clearCookie(sessionCookie,cookieOptions);res.json({ok:true});});
  app.delete('/account',(req,res)=>{if(store.hasPayments(req.user.id))return res.status(409).json({error:'테스트 결제 기록이 있어요. 관리자에게 테스트 주문과 계정 초기화를 요청해주세요.'});store.deleteUser(req.user.id);res.clearCookie(sessionCookie,cookieOptions);res.json({ok:true});});
  app.use((_req,res)=>res.status(404).json({error:'없는 요청이에요.'}));
  app.use((error,_req,res,_next)=>res.status(error.type==='entity.too.large'?413:error instanceof SyntaxError?400:500).json({error:'요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.'}));
  return {app,close:()=>store.close()};
}
