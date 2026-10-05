import {characterFor} from './report.js';
const FONT='"Mongle", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

// Prefer word boundaries for Korean text; split only an oversized word.
export function wrapCardText(text,maxWidth,measure) {
 const rows=[];
 for(const paragraph of String(text||'').split('\n')){
  let row='';
  for(const word of paragraph.trim().split(/\s+/).filter(Boolean)){
   const next=row?row+' '+word:word;
   if(measure(next)<=maxWidth){row=next;continue;}
   if(row){rows.push(row);row='';}
   for(const char of Array.from(word)){
    if(row&&measure(row+char)>maxWidth){rows.push(row);row='';}
    row+=char;
   }
  }
  if(row)rows.push(row);
 }
 return rows.length?rows:[''];
}

function textBlock(ctx,text,{top,height,size,minSize=size,weight=500,width=820,color='#695078',maxLines=2}){
 let rows,lineHeight;
 for(let fontSize=size;fontSize>=minSize;fontSize--){
  ctx.font=`${weight} ${fontSize}px ${FONT}`;
  lineHeight=Math.ceil(fontSize*1.35);
  rows=wrapCardText(text,width,s=>ctx.measureText(s).width);
  if(rows.length<=maxLines&&rows.length*lineHeight<=height)break;
 }
 const limit=Math.max(1,Math.min(maxLines,Math.floor(height/lineHeight)));
 if(rows.length>limit){
  rows=rows.slice(0,limit);
  let last=rows[limit-1];
  while(last&&ctx.measureText(last+'…').width>width)last=Array.from(last).slice(0,-1).join('');
  rows[limit-1]=last+'…';
 }
 ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='top';
 const start=top+(height-rows.length*lineHeight)/2;
 rows.forEach((row,i)=>ctx.fillText(row,540,start+i*lineHeight));
}

export async function createCard(result){
 const character=result.chart?characterFor(result.chart):result.character;
 await document.fonts.load(`700 36px ${FONT}`,'몽글사주 오늘의 운세');
 await document.fonts.ready;
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;
 const c=canvas.getContext('2d');
 const gradient=c.createLinearGradient(0,0,1080,1350);gradient.addColorStop(0,'#f3edff');gradient.addColorStop(1,'#ffede1');
 c.fillStyle=gradient;c.fillRect(0,0,1080,1350);
 c.fillStyle='#fffaf3';c.beginPath();c.roundRect(65,65,950,1220,55);c.fill();
 const label=result.kind==='match'?'우리의 궁합':result.kind==='saju'?'나의 사주':'오늘의 작은 행운';
 textBlock(c,'몽글사주 · '+label,{top:104,height:55,size:32,weight:700,maxLines:1});
 textBlock(c,result.date,{top:164,height:40,size:25,color:'#88758b',maxLines:1});
 try{
  const img=new Image();img.src=character?.image||'/hamster.png';await img.decode();
  const scale=Math.min(340/img.naturalWidth,340/img.naturalHeight),w=img.naturalWidth*scale,h=img.naturalHeight*scale;
  c.drawImage(img,540-w/2,380-h/2,w,h);
 }catch{textBlock(c,'🐹',{top:245,height:270,size:110,maxLines:1});}
 const name=result.kind==='match'?result.name+'의 궁합':result.name+'님의 '+(result.kind==='saju'?'사주':'오늘의 운세');
 textBlock(c,name,{top:565,height:82,size:31,minSize:26,color:'#716174'});
 const headline=result.kind==='saju'&&character?character.name:result.engine?result.headline:`${result.score}점`;
 textBlock(c,headline,{top:665,height:158,size:result.kind==='saju'?58:80,minSize:38,weight:800});
 textBlock(c,result.subline||'이전 데모 결과',{top:831,height:72,size:28,minSize:24,color:'#88758b'});
 textBlock(c,result.title,{top:923,height:110,size:42,minSize:32,weight:700,color:'#554350'});
 textBlock(c,'나를 닮은 색 · '+result.color,{top:1049,height:44,size:28,minSize:24,color:'#88758b',maxLines:1});
 c.fillStyle='#f1eaf7';c.beginPath();c.roundRect(130,1110,820,126,28);c.fill();
 textBlock(c,result.kind==='match'?'함께 해볼 일':'오늘의 미션',{top:1125,height:30,size:22,weight:700,color:'#876d91',maxLines:1});
 textBlock(c,result.action,{top:1161,height:66,size:28,minSize:24,width:750,color:'#65516e'});
 textBlock(c,'전통 해석 참고 · 미래 예측 아님',{top:1250,height:30,size:21,color:'#99868f',maxLines:1});
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve({blob,preview:canvas.toDataURL('image/png')}):reject(new Error('이미지 저장에 실패했어요.')),'image/png'));
}
