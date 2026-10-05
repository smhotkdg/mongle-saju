import React from 'react';
import {Leaf} from 'lucide-react';
import {StoryHook,StoryText,StoryExamples} from './StoryExamples.jsx';
import './life-readings.css';

export function LifeChapter({reading,children}) {
 if(!reading)return null;
 return <div className="life-reading"><StoryHook note={reading.insight}>{reading.hook}</StoryHook><h5>{reading.title}</h5><StoryText text={reading.story}/>{reading.points&&<dl className="life-points">{reading.points.map(([label,text])=><div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}</dl>}{children}{reading.matches&&<section className="pet-matches" aria-label="반려동물 상징 매칭">{reading.matches.map(p=><article key={p.name}><span className="pet-emoji" aria-hidden="true">{p.emoji}</span><h5>{p.name}</h5><StoryText text={p.scene}/><div className="pet-care"><b>함께 살기 전에</b><p>{p.care}</p></div></article>)}</section>}{reading.checks&&<div className="pattern-note"><b>귀여움 다음에 확인할 네 가지</b><ul className="pet-checks">{reading.checks.map(t=><li key={t}>{t}</li>)}</ul></div>}<StoryExamples items={reading.examples} title="내 하루에 옮겨 읽는 두 장면"/><div className="report-action"><Leaf size={17}/><div><b>몽글도사와 오늘 해볼 일</b><p>{reading.action}</p></div></div><details className="life-basis"><summary>이 풀이의 근거와 읽는 범위</summary><p>{reading.basis}</p><p>{reading.note}</p></details></div>;
}
