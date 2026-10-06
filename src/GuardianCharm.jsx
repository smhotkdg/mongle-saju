import React,{useId,useState} from 'react';
import {ShieldCheck,Download,Sparkles,Check,ArrowRight} from 'lucide-react';
import {GUARDIANS,CHARM_SETS,guardianFor} from './guardians.js';
import './guardian.css';
import {StoryText} from './StoryExamples.jsx';

export async function createCharmCard(guardian,name) {
 await document.fonts.ready;
 const img=new Image();img.src=guardian.image;await img.decode();
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#fff9ef';ctx.fillRect(0,0,1080,1350);
 ctx.fillStyle=guardian.color;ctx.beginPath();ctx.roundRect(50,50,980,1250,48);ctx.fill();
 ctx.fillStyle='#99809f';ctx.textAlign='center';ctx.font='500 24px Pretendard, sans-serif';ctx.fillText('✦ 몽글도사의 액운막기 ✦',540,124);
 ctx.fillStyle='#786180';ctx.font='700 42px Pretendard, sans-serif';ctx.fillText(guardian.name,540,210);
 ctx.save();ctx.beginPath();ctx.roundRect(170,260,740,740,55);ctx.clip();ctx.drawImage(img,170,260,740,740);ctx.restore();
 ctx.fillStyle='#8f748e';ctx.font='600 27px Pretendard, sans-serif';ctx.fillText(`${name || '나'}의 오늘을 응원해요`,540,1064);
 ctx.font='500 24px Pretendard, sans-serif';ctx.fillText(guardian.mantra,540,1120);
 ctx.font='400 21px Pretendard, sans-serif';ctx.fillStyle='#aa94a1';ctx.fillText('마음을 돌보는 상징 부적 · 몽글사주',540,1246);
 return canvas.toDataURL('image/png');
}

export function GuardianCharm({chart,name,selectedKey,onSelect,full=false,compact=false,blessedKey,onBless,collection={owned:[],favorite:null},onCollect,onOpenCollection}) {
 const uid=useId(),[localKey,setLocalKey]=useState(null),[localBlessed,setLocalBlessed]=useState(null),[card,setCard]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const charm=guardianFor(chart,selectedKey || localKey) || guardianFor(null,GUARDIANS[0].key);
 const blessed=(blessedKey || localBlessed)===charm.key;
 const activeSet=charm.set;
 const collected=collection.owned.includes(charm.key);
 function chooseSet(id){select(GUARDIANS.find(g=>g.set===id).key);}
 function select(key){setLocalKey(key);onSelect?.(key);setCard(null);setError('');}
 async function download(){setBusy(true);setError('');try{setCard({key:charm.key,url:await createCharmCard(charm,name)});}catch{setError('카드를 만들지 못했어요. 잠시 후 다시 눌러주세요.');}finally{setBusy(false);}}
 return <section className={`guardian-charm ${compact?'compact':''} ${full?'full-charm':'charm-preview'} ${blessed?'blessed':''}`} aria-labelledby={`${uid}-title`} style={{'--charm-tint':charm.color}}>
  <div className="charm-heading"><span className="charm-kicker"><ShieldCheck size={15}/> MONGLE LITTLE GUARDIAN</span><h3 id={`${uid}-title`}>{full?'몽글도사의 액운막기':'액운막기, 미리 만나보세요'}</h3><p>{compact?'상세 리포트에 나를 응원하는 햄스터 부적도 함께 들어 있어요.':'마음이 지치는 순간마다, 몽글도사가 작은 방패를 들어줄게요.'}</p></div>
  {!compact&&<div className="charm-set-tabs" role="group" aria-label="부적 테마">{CHARM_SETS.map(s=><button key={s.id} type="button" aria-pressed={activeSet===s.id} onClick={()=>chooseSet(s.id)}>{s.name} · 5종</button>)}</div>}
  {!compact&&<div className="charm-picker" role="group" aria-label="막아주길 바라는 액운 선택">{GUARDIANS.filter(g=>g.set===activeSet).map(g=><button type="button" key={g.key} onClick={()=>select(g.key)} aria-pressed={charm.key===g.key}><img src={g.image} alt="" loading="lazy"/><span>{g.label}</span>{collection.owned.includes(g.key)&&<span className="charm-collected-check"><Check size={10}/>수집</span>}</button>)}</div>}
  <div className="charm-feature" aria-live="polite"><div className="charm-art-wrap"><img className="charm-art" src={charm.image} alt={charm.alt} loading="lazy"/>{blessed&&<span className="charm-seal"><Check size={13}/> 오늘의 응원 도장</span>}</div><div className="charm-copy"><span className="charm-symbol">{charm.symbol}</span><h4>{charm.name}</h4><p>{charm.protect}</p>{!compact&&<blockquote>“{charm.mantra}”</blockquote>}</div></div>
  {full?<><p className="charm-basis">{charm.reason}</p><div className="charm-story"><h5>몽글도사가 지켜주는 장면</h5><StoryText text={charm.scene}/></div><div className="charm-ritual"><h5><Sparkles size={16}/> 오늘의 작은 액운막기</h5>{charm.ritual.map(([title,text],i)=><div key={title}><span>{i+1}</span><div><b>{title}</b><p>{text}</p></div></div>)}</div><div className="charm-collection-status"><span>나의 부적 도감 <b>{collection.owned.length} / {GUARDIANS.length}</b></span>{onOpenCollection&&<button type="button" onClick={onOpenCollection}>도감 보기</button>}</div><div className="charm-buttons"><button type="button" className="button primary full" disabled={collected} onClick={()=>onCollect?.(charm.key)}><Check size={17}/>{collected?'도감에 모았어요':'이 부적을 도감에 담기'}</button><button type="button" className="button primary full" onClick={()=>{setLocalBlessed(charm.key);onBless?.(charm.key);}}><ShieldCheck size={17}/>{blessed?'오늘의 응원을 받았어요':'몽글도사에게 응원 받기'}</button><button type="button" className="button secondary full" disabled={busy} onClick={download}><Download size={16}/>{busy?'부적 카드를 그리고 있어요…':'나의 부적 카드 만들기'}</button></div>{blessed&&<p className="charm-cheer" role="status">톡! 몽글도사가 마음에 응원 도장을 찍었어요. 오늘은 이 한 문장을 주머니에 넣어두세요. 🐹</p>}{error&&<p className="charm-error" role="alert">{error}</p>}{card?.key===charm.key&&<div className="charm-card-export"><img src={card.url} alt={`${charm.name} 저장용 카드`}/><a className="button secondary full" href={card.url} download={`몽글사주-${charm.key}-부적.png`}><Download size={15}/>PNG 부적 카드 저장</a></div>}</>:<p className="charm-included"><Check size={14}/>{compact?'990원 테스트 결제에 포함 · 추가 결제 없음':'한 번 해금으로 10종 모두 포함 · 부적 도감 · 실천법 · PNG 저장'}</p>}
  <p className="charm-note">액운막기는 일상을 응원하는 상징 부적이에요. 실제 불운이나 사고를 예측하거나 막는 효능을 보장하지 않아요.</p>
 </section>;
}
export function GuardianShowcase({onStart,onOpenCollection,collection={owned:[]}}) {
 return <section className="guardian-showcase section-wrap" id="guardians"><div className="guardian-showcase-intro"><span className="eyebrow">A LITTLE SHIELD FOR YOUR DAY</span><h2>나쁜 기분은 멀리,<br/>몽글한 마음은 가까이.</h2><p>조급함부터 혼자 커지는 걱정까지.<br/>마음 지킴 5종과 하루 응원 5종을 모아보세요.</p><span className="charm-price">상세 사주 + 액운막기 · 990원 <small>테스트</small></span><button type="button" className="text-button" onClick={onStart}>내 사주와 부적 만나기 <ArrowRight size={17}/></button><button type="button" className="album-entry" onClick={onOpenCollection}>나의 부적 도감 <b>{collection.owned.length} / 10</b></button></div><GuardianCharm collection={collection}/></section>;
}
