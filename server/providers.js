import { createHash } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const definitions = {
  kakao: { label:'카카오', authorize:'https://kauth.kakao.com/oauth/authorize', token:'https://kauth.kakao.com/oauth/token', profile:'https://kapi.kakao.com/v2/user/me' },
  naver: { label:'네이버', authorize:'https://nid.naver.com/oauth2.0/authorize', token:'https://nid.naver.com/oauth2.0/token', profile:'https://openapi.naver.com/v1/nid/me' },
  google: { label:'Google', authorize:'https://accounts.google.com/o/oauth2/v2/auth', token:'https://oauth2.googleapis.com/token' },
};
export function providersFromEnv(env) {
  return Object.fromEntries(Object.entries(definitions).map(([id, definition]) => {
    const clientId = env[`${id.toUpperCase()}_CLIENT_ID`] || '';
    const clientSecret = env[`${id.toUpperCase()}_CLIENT_SECRET`] || '';
    return [id, { ...definition, clientId, clientSecret, enabled: Boolean(clientId && (id==='kakao' || clientSecret)) }];
  }));
}
export function authorizationUrl(id, provider, callback, transaction) {
  const url = new URL(provider.authorize);
  url.search = new URLSearchParams({ client_id:provider.clientId, redirect_uri:callback, response_type:'code', state:transaction.state });
  if (id==='google') {
    url.searchParams.set('scope','openid profile');
    url.searchParams.set('nonce',transaction.nonce);
    url.searchParams.set('code_challenge',createHash('sha256').update(transaction.verifier).digest('base64url'));
    url.searchParams.set('code_challenge_method','S256');
  }
  return url.href;
}
export async function exchangeIdentity(id, provider, callback, code, transaction, request=fetch) {
  const params = new URLSearchParams({ grant_type:'authorization_code', client_id:provider.clientId, redirect_uri:callback, code, state:transaction.state });
  if (provider.clientSecret) params.set('client_secret',provider.clientSecret);
  if (id==='google') params.set('code_verifier',transaction.verifier);
  const response = await request(provider.token, { method:'POST', body:params, signal:AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Token request failed');
  const tokens = await response.json();
  if (!tokens.access_token || tokens.error) throw new Error('Missing access token');
  if (id==='google') {
    const { payload } = await jwtVerify(tokens.id_token, googleKeys, { issuer:['https://accounts.google.com','accounts.google.com'], audience:provider.clientId, algorithms:['RS256'], requiredClaims:['exp','iat','sub','nonce'] });
    if (payload.nonce!==transaction.nonce || !payload.sub) throw new Error('Invalid Google identity');
    return { subject:payload.sub, name:typeof payload.name==='string'?payload.name:'몽글 친구' };
  }
  const profileResponse = await request(provider.profile, { headers:{ Authorization:`Bearer ${tokens.access_token}` }, signal:AbortSignal.timeout(10000) });
  if (!profileResponse.ok) throw new Error('Profile request failed');
  const profile = await profileResponse.json();
  const subject = id==='kakao' ? profile.id : profile.resultcode==='00' ? profile.response?.id : null;
  if (!subject || !['string','number'].includes(typeof subject)) throw new Error('Missing provider identity');
  const name = id==='kakao' ? profile.kakao_account?.profile?.nickname : profile.response?.nickname;
  return { subject:String(subject), name:typeof name==='string'?name:'몽글 친구' };
}
