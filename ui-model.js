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
