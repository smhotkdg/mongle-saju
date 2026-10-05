import React,{useState} from 'react';
import {Download,MessageCircle,Gift} from 'lucide-react';
import {makeManual,MANUAL_AUDIENCES} from './manual.js';
import './manual.css';

function lines(ctx,text,maxWidth){const out=[];let line='';for(const c of Array.from(text)){if(ctx.measureText(line+c).width>maxWidth&&line){out.push(line);line=c;}else line+=c;}if(line)out.push(line);return out;}
async function createManualCard(manual,name) {
 await document.fonts.ready;const img=new Image();img.src=manual.character.image;await img.decode();
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;const ctx=canvas.getContext('2d');
 ctx.fillStyle='#fff9ef';ctx.fillRect(0,0,1080,1350);ctx.fillStyle='#f1e9f6';ctx.beginPath();ctx.roundRect(45,45,990,1260,40);ctx.fill();
 ctx.textAlign='center';ctx.fillStyle='#80678a';ctx.font='500 22px Pretendard, sans-serif';ctx.fillText('MONGLE · MY LITTLE MANUAL',540,109);
 let title=(name||'나')+'의 사용설명서',size=46;do{ctx.font='700 '+size+'px Pretendard, sans-serif';if(ctx.measureText(title).width<=880)break;size--;}while(size>28);ctx.fillStyle='#59435f';ctx.fillText(title,540,180);
 ctx.save();ctx.beginPath();ctx.roundRect(100,223,215,215,26);ctx.clip();ctx.drawImage(img,100,223,215,215);ctx.restore();
 ctx.textAlign='left';ctx.font='500 22px Pretendard, sans-serif';ctx.fillStyle='#897095';ctx.fillText(manual.label+' · 대화를 시작하는 카드',350,271);ctx.fillStyle='#634870';ctx.font='700 31px Pretendard, sans-serif';ctx.fillText(manual.character.name,350,329);ctx.font='400 22px Pretendard, sans-serif';ctx.fillStyle='#705a79';lines(ctx,manual.tags.join(' · '),610).forEach((line,i)=>ctx.fillText(line,350,376+i*33));
 manual.rows.forEach(([label,text],i)=>{const y=482+i*228;ctx.fillStyle=i===1?'#fff4e9':'#fffdfa';ctx.beginPath();ctx.roundRect(85,y,910,210,23);ctx.fill();ctx.fillStyle='#725783';ctx.font='700 25px Pretendard, sans-serif';ctx.fillText('0'+(i+1)+'  '+label,115,y+43);let fs=27,wrapped;do{ctx.font='400 '+fs+'px Pretendard, sans-serif';wrapped=lines(ctx,text,850);if(wrapped.length<=4)break;fs--;}while(fs>19);ctx.fillStyle='#534755';wrapped.forEach((line,n)=>ctx.fillText(line,115,y+87+n*(fs+8)));});
 ctx.textAlign='center';ctx.font='400 21px Pretendard, sans-serif';ctx.fillStyle='#85728c';ctx.fillText('나와 닮은 문장으로 대화를 시작해보세요 · 몽글사주',540,1245);
 return canvas.toDataURL('image/png');
}
export function ManualPreview({report,compact=false}) {
 const manual=makeManual(report);if(!manual)return null;
 return <section className={'manual-preview '+(compact?'compact':'')}><span><Gift size={16}/> 상세 해금에 함께 담았어요</span><h3>나를 대하는 사용설명서</h3><p>“나를 어떻게 대해주면 좋을까?”<br/>친구·연인·동료에게 건네는 나만의 대화 카드 3종.</p><div className="manual-mini"><img src={manual.character.image} alt="" loading="lazy"/><div><small>내 사주로 완성될 카드 · 미리보기</small><strong>{manual.character.name}</strong><span>“{manual.rows[2][1]}”</span></div></div><p className="manual-included">상황별 사용설명서 3종 + PNG 저장 · 990원 데모에 포함</p></section>;
}
export function ManualCard({report,name,audience,onAudienceChange}) {
 const [localAudience,setLocalAudience]=useState('friend'),[image,setImage]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const manual=makeManual(report,audience||localAudience);if(!manual)return null;
 async function download(){setBusy(true);setError('');try{setImage({audience:manual.audience,url:await createManualCard(manual,name)});}catch{setError('카드를 만들지 못했어요. 다시 시도해주세요.');}finally{setBusy(false);}}
 return <div className="manual-full"><p>나를 설명하기 어려울 때, 이 카드로 대화를 시작해보세요. 함께 이야기할 사람을 고르면 문장이 달라져요.</p><div className="manual-audiences" role="group" aria-label="사용설명서를 건넬 사람">{MANUAL_AUDIENCES.map(a=><button type="button" key={a.id} aria-pressed={manual.audience===a.id} onClick={()=>{setLocalAudience(a.id);onAudienceChange?.(a.id);setImage(null);}}>{a.label}</button>)}</div><div className="manual-sheet"><header><img src={manual.character.image} alt={manual.character.alt} loading="lazy"/><div><span>{manual.label} · MONGLE MANUAL</span><h3>{name}의 사용설명서</h3><p>{manual.character.name}</p></div></header>{manual.rows.map(([label,text],i)=><section key={label}><h5><span>0{i+1}</span>{label}</h5><p>{text}</p></section>)}<footer><MessageCircle size={15}/>{manual.note}</footer></div><button type="button" className="button primary full" disabled={busy} onClick={download}><Download size={17}/>{busy?'사용설명서를 만드는 중…':'나의 사용설명서 카드 만들기'}</button>{error&&<p role="alert">{error}</p>}{image?.audience===manual.audience&&<div className="manual-export"><img src={image.url} alt={manual.label+' 나의 사용설명서 저장용 카드'}/><a className="button secondary full" href={image.url} download={'몽글사주-사용설명서-'+manual.audience+'.png'}>PNG 사용설명서 저장</a></div>}</div>;
}
