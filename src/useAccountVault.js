import { useEffect, useRef, useState } from 'react';
import { collectCharm, normalizeCollection } from './charmCollection.js';
import { guestVault, importGuest, vaultSchema } from './vault.js';

export async function accountRequest(path, options={}) {
  const response=await fetch(`/api${path}`,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(15000)});
  const body=await response.json();
  if(!response.ok)throw Object.assign(new Error(body.error||'서버와 연결하지 못했어요.'),{status:response.status});
  return body;
}
export function useAccountVault() {
  const [session,setSession]=useState(null),[data,setData]=useState(()=>guestVault(localStorage)),[ready,setReady]=useState(false),[status,setStatus]=useState('불러오는 중…'),[error,setError]=useState('');
  const current=useRef(data),revision=useRef(0),sessionRef=useRef(null),dirty=useRef(false),saving=useRef(false),alive=useRef(true),failed=useRef(false);
  useEffect(()=>{
    alive.current=true;
    (async()=>{
      try {
        const next=await accountRequest('/session');
        if(!alive.current)return;
        sessionRef.current=next;setSession(next);
        if(next.user){const vault=await accountRequest('/vault');if(!alive.current)return;current.current=vault.data;revision.current=vault.revision;setData(vault.data);setStatus('계정에 저장됨');}
        else setStatus('이 브라우저에 보관 중');
        setReady(true);
      } catch { if(alive.current){setError('계정 보관함에 연결하지 못했어요. 새로고침해서 다시 연결해주세요.');setStatus('연결 실패');/* Do not expose or overwrite guest data when session is unknown. */} }
    })();
    const beforeUnload=e=>{if(dirty.current){e.preventDefault();e.returnValue='';}};
    window.addEventListener('beforeunload',beforeUnload);
    return()=>{alive.current=false;window.removeEventListener('beforeunload',beforeUnload);};
  },[]);
  async function flush() {
    if(saving.current || !sessionRef.current?.user || failed.current)return;
    saving.current=true;
    try {
      while(dirty.current){
        const snapshot=current.current;setStatus('계정에 저장 중…');
        const saved=await accountRequest('/vault',{method:'PUT',headers:{'X-CSRF-Token':sessionRef.current.csrf},body:JSON.stringify({data:vaultSchema.parse(snapshot),revision:revision.current})});
        revision.current=saved.revision;
        dirty.current=current.current!==snapshot;
      }
      setStatus('계정에 저장됨');setError('');
    } catch(e){failed.current=true;setError(e.message||'저장하지 못했어요. 연결을 확인하고 다시 시도해주세요.');setStatus('저장되지 않은 변경이 있어요');}
    finally{saving.current=false;}
  }
  function change(update) {
    const next=update(current.current);current.current=next;setData(next);
    if(sessionRef.current?.user){dirty.current=true;void flush();}
    else {try{localStorage.setItem('mongle-results',JSON.stringify(next.results));localStorage.setItem('mongle-charms-v1',JSON.stringify(next.collection));setError('');}catch{setError('브라우저 저장 공간이 부족해 보관하지 못했어요.');}}
  }
  async function reload() {
    if(saving.current)return;
    try{const vault=await accountRequest('/vault');current.current=vault.data;revision.current=vault.revision;dirty.current=false;failed.current=false;setData(vault.data);setError('');setStatus('계정에 저장됨');}catch(e){setError(e.message);}
  }
  async function exit(remove=false) {
    if(dirty.current||saving.current)return;
    try{await accountRequest(remove?'/account':'/logout',{method:remove?'DELETE':'POST',headers:{'X-CSRF-Token':sessionRef.current.csrf}});window.location.assign('/');}catch(e){setError(e.message);}
  }
  return {ready,session,data,status,error,
    setResults:value=>change(v=>({...v,results:typeof value==='function'?value(v.results):value})),
    charms:{collection:data.collection,storageError:false,collect:key=>change(v=>({...v,collection:collectCharm(v.collection,key)})),remove:key=>change(v=>({...v,collection:normalizeCollection({...v.collection,owned:v.collection.owned.filter(k=>k!==key)})})),favorite:key=>change(v=>({...v,collection:normalizeCollection({...v.collection,favorite:v.collection.favorite===key?null:key})}))},
    importLocal:()=>change(v=>importGuest(v,guestVault(localStorage))),
    retry:()=>{failed.current=false;void flush();},reload,logout:()=>exit(),deleteAccount:()=>exit(true),
    hasPending:dirty.current||saving.current,
  };
}
