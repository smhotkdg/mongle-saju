import React,{useEffect,useState} from 'react';
import {Bookmark,Heart,Check,Download,Award} from 'lucide-react';
import {GUARDIANS,CHARM_SETS} from './guardians.js';
import {COLLECTION_KEY,normalizeCollection,collectCharm,collectionBadges} from './charmCollection.js';
import {createCharmCard} from './GuardianCharm.jsx';
import './collection.css';

export function useCharmCollection() {
 const [collection,setCollection]=useState(()=>{try{return normalizeCollection(JSON.parse(localStorage.getItem(COLLECTION_KEY)));}catch{return normalizeCollection(null);}});
 const [storageError,setStorageError]=useState(false);
 useEffect(()=>{try{localStorage.setItem(COLLECTION_KEY,JSON.stringify(collection));setStorageError(false);}catch{setStorageError(true);}},[collection]);
 return {collection,storageError,collect:key=>setCollection(c=>collectCharm(c,key)),remove:key=>setCollection(c=>normalizeCollection({...c,owned:c.owned.filter(k=>k!==key)})),favorite:key=>setCollection(c=>normalizeCollection({...c,favorite:c.favorite===key?null:key}))};
}
export function CharmCollection({collection,onFavorite,onRemove,onExplore,storageError}) {
 const [filter,setFilter]=useState('all'),[selected,setSelected]=useState(collection.favorite||collection.owned[0]||GUARDIANS[0].key),[card,setCard]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const charm=GUARDIANS.find(g=>g.key===selected)||GUARDIANS[0],owned=collection.owned.includes(charm.key);
 const visible=GUARDIANS.filter(g=>filter==='all'||(filter==='owned'?collection.owned.includes(g.key):g.set===filter));
 function changeFilter(id){setFilter(id);const candidates=GUARDIANS.filter(g=>id==='all'||(id==='owned'?collection.owned.includes(g.key):g.set===id));if(candidates.length&&!candidates.some(g=>g.key===selected)){setSelected(candidates[0].key);setCard(null);}}
 function removeSelected(){onRemove(charm.key);setCard(null);if(filter==='owned'){const next=GUARDIANS.find(g=>g.key!==charm.key&&collection.owned.includes(g.key));if(next)setSelected(next.key);}}
 async function download(){setBusy(true);setError('');try{setCard({key:charm.key,url:await createCharmCard(charm,'나')});}catch{setError('이미지를 만들지 못했어요. 다시 눌러주세요.');}finally{setBusy(false);}}
 return <section className="charm-album" aria-label="나의 부적 도감"><header className="album-header"><span>MY LITTLE CHARM ALBUM</span><h2>한 장씩, 내 마음의 수집</h2><p>마음 지킴 5종 + 하루 응원 5종.<br/>마음에 드는 부적을 골라 나만의 도감을 채워보세요.</p><div className="album-count"><strong>{collection.owned.length}<small> / {GUARDIANS.length}</small></strong><span>모은 부적</span><progress value={collection.owned.length} max={GUARDIANS.length} aria-label="부적 수집 진행"/></div></header>
 <div className="album-badges">{collectionBadges(collection).map(b=><div key={b.id} className={b.count===b.total?'earned':''}><Award size={19}/><strong>{b.badge}</strong><small>{b.count===b.total?'세트 완성!':b.count+' / '+b.total}</small></div>)}</div>
 <div className="album-filters" role="group" aria-label="도감 분류">{[['all','전체'],...CHARM_SETS.map(s=>[s.id,s.name]),['owned','모은 부적']].map(([id,label])=><button key={id} type="button" onClick={()=>changeFilter(id)} aria-pressed={filter===id}>{label}</button>)}</div>
 <div className="album-grid">{visible.map(g=><button type="button" key={g.key} className={collection.owned.includes(g.key)?'collected':''} aria-pressed={selected===g.key} onClick={()=>{setSelected(g.key);setCard(null);}}><span className="album-number">NO. {g.number}</span>{collection.favorite===g.key&&<Heart className="album-favorite-icon" size={15} fill="currentColor"/>}<img src={g.image} alt={g.alt} loading="lazy"/><strong>{g.symbol}</strong><small>{collection.owned.includes(g.key)?<><Check size={12}/>모았어요</>:<><Bookmark size={12}/>아직 빈 자리</>}</small></button>)}</div>
 {visible.length===0&&<p className="album-empty">아직 모은 부적이 없어요. 상세 리포트의 부적에서 ‘도감에 담기’를 눌러보세요.</p>}
 {visible.length>0&&<div className="album-detail" aria-live="polite"><img src={charm.image} alt={charm.alt} loading="lazy"/><span>NO. {charm.number} · {CHARM_SETS.find(s=>s.id===charm.set).name}</span><h3>{charm.name}</h3><p>{charm.protect}</p><blockquote>“{charm.mantra}”</blockquote>{owned?<><div className="album-actions"><button type="button" className="button secondary" onClick={()=>onFavorite(charm.key)}><Heart size={16} fill={collection.favorite===charm.key?'currentColor':'none'}/>{collection.favorite===charm.key?'대표 부적 해제':'대표 부적으로'}</button><button type="button" className="button primary" disabled={busy} onClick={download}><Download size={16}/>{busy?'만드는 중…':'카드 만들기'}</button></div><button type="button" className="album-remove" onClick={removeSelected}>이 부적을 도감에서 빼기</button></>:<><p className="album-access">상세 사주 1회 해금에 10종 모두 포함돼요.<br/>원하는 부적을 하나씩 담아보세요.</p><button type="button" className="button primary" onClick={onExplore}>나의 사주와 부적 만나기</button></>}</div>}
 {card?.key===charm.key&&owned&&<div className="charm-card-export"><img src={card.url} alt="도감에서 만든 부적 카드"/><a className="button secondary full" href={card.url} download={'몽글사주-'+charm.key+'-부적.png'}>PNG 카드 저장</a></div>}
 {error&&<p role="alert">{error}</p>}{storageError&&<p role="alert">브라우저 저장 공간이 부족해 이번 수집을 보관하지 못했어요.</p>}<p className="album-footnote">도감은 이 브라우저에 보관돼요. 부적은 마음을 돌보는 상징 콘텐츠예요.</p></section>;
}
