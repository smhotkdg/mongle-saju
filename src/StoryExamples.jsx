import React from 'react';
import {Sparkles,MessageCircle} from 'lucide-react';
import './story-examples.css';

export function StoryText({text,className=''}) {
 const sentences=String(text||'').split(/(?<=[.!?])\s+/);
 const paragraphs=[];
 for(let i=0;i<sentences.length;i+=2)paragraphs.push(sentences.slice(i,i+2).join(' '));
 return <div className={'story-text '+className}>{paragraphs.map((part,i)=><p key={i}>{part}</p>)}</div>;
}
export function StoryHook({children,note}) {
 if(!children)return null;
 return <aside className="story-hook"><span><Sparkles size={15}/> 몽글도사의 작은 발견</span><h5>{children}</h5>{note&&<p>{note}</p>}</aside>;
}
export function StoryExamples({items,title='이런 날이라면, 이렇게',label='생활 속 예시'}) {
 if(!items?.length)return null;
 return <section className="story-examples" aria-label={title}><header><span>{label}</span><h5>{title}</h5><p>나와 닮은 장면부터 골라 읽어보세요.</p></header>{items.map(([when,scene,say],i)=><article key={when}><h6><span>0{i+1}</span>{when}</h6><StoryText text={scene}/><blockquote><MessageCircle size={15}/><div><span>이렇게 말해봐요</span><p>“{say}”</p></div></blockquote></article>)}</section>;
}
