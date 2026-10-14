import {searchOCRPages} from './ocr-model.js?v=0.5.0';
export function patternRegex(mode,value=''){
 if(mode==='email')return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
 if(mode==='phone')return /(?:\+\d{1,3}[ .-]?)?(?:\(\d{2,4}\)[ .-]?)?(?:\d[ .-]?){7,14}\d/g;
 if(mode!=='custom')throw Error('Choose a supported pattern.');
 if(!value.trim()||value.length>120)throw Error('Enter a custom pattern of 1–120 characters.');
 let source='',escaped=false;
 for(const c of value){if(escaped){source+=c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');escaped=false;}else if(c==='\\')escaped=true;else if(c==='#')source+='[0-9]';else if(c==='@')source+='[A-Za-z]';else if(c==='?')source+='[^\\s]';else source+=c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
 if(escaped)throw Error('Finish the escaped character in your custom pattern.');
 return new RegExp(source,'giu');
}
export function findPatternText(text,spec,limit=500){
 const regex=patternRegex(spec.mode,spec.value),hits=[];let limited=false;
 for(const match of text.matchAll(regex)){
  const value=match[0],start=match.index,end=start+value.length;
  if(spec.mode==='phone'&&(/[\p{L}\d]/u.test(text[start-1]||'')||/[\p{L}\d]/u.test(text[end]||'')||value.replace(/\D/g,'').length>15))continue;
  if(spec.mode==='email'&&(value.length>254||value.includes('..')))continue;
  if(hits.length===limit){limited=true;break;}hits.push({text:value,start,end});
 }
 return {hits,limited};
}
export function searchOCR(pages,spec){
 if(spec.mode==='text')return searchOCRPages(pages,spec.value);
 const matches=[];let limited=false;
 for(const [page,words]of pages){let text='',spans=[];
  for(const word of words){if(text&&!(/[\u3400-\u9fff]$/.test(text)&&/^[\u3400-\u9fff]/.test(word.text)))text+=' ';const start=text.length;text+=word.text;spans.push({start,end:text.length,word});}
  const result=findPatternText(text,spec);limited ||= result.limited;
  for(const hit of result.hits){const found=spans.filter(s=>s.start<hit.end&&s.end>hit.start).map(s=>s.word);if(!found.length)continue;const rects=found.map(w=>[...w.rect]);matches.push({page,rects,key:JSON.stringify(['ocr',page,rects]),source:'ocr',confidence:Math.round(Math.min(...found.map(w=>w.confidence))),text:hit.text});}
 }
 return {matches,limited};
}
function intersects(a,b){const intersection=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));const area=Math.min((a[2]-a[0])*(a[3]-a[1]),(b[2]-b[0])*(b[3]-b[1]));return area>0&&intersection/area>=.5;}
export function mergeMatches(native,scanned){const result=[...native],keys=new Set(native.map(m=>m.key));for(const hit of scanned){if(keys.has(hit.key)||native.some(n=>n.page===hit.page&&hit.rects.every(r=>n.rects.some(b=>intersects(r,b)))))continue;keys.add(hit.key);result.push(hit);}return result;}
export function pageMarkCounts(marks){const counts=new Map();for(const mark of marks)counts.set(mark.page,(counts.get(mark.page)||0)+1);return counts;}
