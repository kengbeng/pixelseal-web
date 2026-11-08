export function fitScale(bounds,viewport,mode='fit-page'){
 const width=bounds[2]-bounds[0],height=bounds[3]-bounds[1];if(width<=0||height<=0)return 1;
 const availableWidth=Math.max(1,viewport.width),availableHeight=Math.max(1,viewport.height);
 const desired=mode==='fit-width'?availableWidth/width:mode==='fit-page'?Math.min(availableWidth/width,availableHeight/height):Number(mode);
 const maximum=Math.min(4,Math.sqrt(16000000/(width*height)));
 return Math.min(maximum,Math.max(.05,Number.isFinite(desired)&&desired>0?desired:1));
}
export function groupMatches(matches){const groups=new Map();matches.forEach((hit,index)=>{if(!groups.has(hit.page))groups.set(hit.page,[]);groups.get(hit.page).push({hit,index});});return [...groups].sort(([a],[b])=>a-b);}
export function scrollTarget(rects,bounds,scale,viewport,offset={left:0,top:0}){
 const x=(Math.min(...rects.map(r=>r[0]))+Math.max(...rects.map(r=>r[2])))/2,y=(Math.min(...rects.map(r=>r[1]))+Math.max(...rects.map(r=>r[3])))/2;
 return {left:Math.max(0,offset.left+(x-bounds[0])*scale-viewport.width/2),top:Math.max(0,offset.top+(y-bounds[1])*scale-viewport.height/2)};
}

// Fold text while retaining offsets into the original snippet for safe DOM highlights.
function foldedText(value){let text='',map=[];let offset=0;const units=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(value)].map(s=>s.segment):Array.from(value);for(const char of units){const start=offset;offset+=char.length;const folded=char.normalize('NFKC').toLowerCase();for(const c of folded){if(/\s/u.test(c)){if(text.endsWith(' ')) {if(map.length)map[map.length-1].end=offset;continue;}text+=' ';map.push({start,end:offset});}else{for(let i=0;i<c.length;i++)map.push({start,end:offset});text+=c;}}}return {text,map};}
export function snippetParts(context,query){
 const needle=foldedText(query||'').text.trim(),folded=foldedText(context||'');if(!needle)return [{text:context||'',match:false}];
 const parts=[];let from=0,last=0;while(from<folded.text.length){const at=folded.text.indexOf(needle,from);if(at<0)break;const start=folded.map[at].start,end=folded.map[at+needle.length-1].end;if(start>last)parts.push({text:context.slice(last,start),match:false});if(end>last)parts.push({text:context.slice(Math.max(last,start),end),match:true});last=Math.max(last,end);from=at+needle.length;}if(last<context.length)parts.push({text:context.slice(last),match:false});return parts.length?parts:[{text:context||'',match:false}];
}
export function orderedMatchIndices(matches){return groupMatches(matches).flatMap(([,items])=>items.map(({index})=>index));}
export function stageAction(stage,{matchCount,selectedCount,markCount}){
 if(stage==='review')return 'download';if(stage==='mark')return 'review';if(selectedCount)return 'mark';if(markCount)return 'review';return matchCount?'select':'find';
}
export function comparisonRegion(rect,bounds,padding=28){return [Math.max(bounds[0],rect[0]-padding),Math.max(bounds[1],rect[1]-padding),Math.min(bounds[2],rect[2]+padding),Math.min(bounds[3],rect[3]+padding)];}
