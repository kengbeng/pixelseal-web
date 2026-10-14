import {OCRController} from './ocr.js?v=0.3.1';
import {searchOCRPages} from './ocr-model.js?v=0.3.1';
import {History,clone,moveRect,resizeRect} from './model.js?v=0.3.1';
const $=id=>document.getElementById(id),worker=new Worker('./worker.js?v=0.3.1',{type:'module'}),history=new History(),ocr=new OCRController();
let seq=0,pending=new Map(),page=0,count=0,marks=[],bounds,name='',busy=false,url,drag,selected=-1,matches=[],checked=new Set(),activeHit=-1;
worker.onmessage=({data:d})=>{let p=pending.get(d.id);if(p){pending.delete(d.id);d.error?p.reject(Object.assign(Error(d.error),{code:d.code})):p.resolve(d.result);}};
worker.onerror=()=>{for(let p of pending.values())p.reject(Error('The PDF engine could not load. Refresh the page.'));pending.clear();};
const call=(type,data={})=>new Promise((resolve,reject)=>{let id=++seq;pending.set(id,{resolve,reject});worker.postMessage({id,type,...data});});
function status(s,error=false){$('status').textContent=s;$('status').classList.toggle('error',error);}
function controls(){
 for(let id of ['exportjump','downloadexport','closeexport'])$(id).disabled=busy;
 $('exportprev').disabled=busy||exportPage===0;$('exportnext').disabled=busy||exportPage>=exportCount-1;
 for(let id of ['clear','export'])$(id).disabled=busy||!marks.length;
 $('undo').disabled=busy||!history.past.length;$('redo').disabled=busy||!history.future.length;
 $('prev').disabled=busy||page<=0;$('next').disabled=busy||page>=count-1;$('file').disabled=busy;$('zoom').disabled=busy;
 for(let id of ['runocr','ocrscope','ocrlanguage','ocrrotation','addarea'])$(id).disabled=busy||!count;
 $('cancelocr').disabled=!ocr.run;
 for(let id of ['query','search'])$(id).disabled=busy||!count;
 for(let id of ['selectall','selectnone'])$(id).disabled=busy||!matches.length;
 $('addmatches').disabled=busy||!checked.size;
 $('pageinfo').textContent=count?`Page ${page+1} of ${count}`:'No pages';$('total').textContent=marks.length;
 for(let id of ['editx','edity','editw','edith','applyedit','remove'])$(id).disabled=busy;
}
function cancelDrag(){if(drag?.before)marks=clone(drag.before);drag=null;}
async function task(fn){cancelDrag();busy=true;draw();drawResults();controls();try{await fn();}catch(e){status(e.message,true);}finally{busy=false;draw();drawResults();controls();}}
function commit(next,message){history.commit(next);marks=clone(history.value);if(selected>=marks.length)selected=-1;draw();drawResults();controls();if(message)status(message);}
function restore(action){cancelDrag();if(history[action]()){marks=clone(history.value);selected=-1;draw();drawResults();controls();status(action==='undo'?'Change undone.':'Change restored.');}}
function svgRect(r,cls,index,corner){let el=document.createElementNS('http://www.w3.org/2000/svg','rect');for(let [k,v]of Object.entries({x:r[0],y:r[1],width:r[2]-r[0],height:r[3]-r[1],class:cls}))el.setAttribute(k,v);if(index!==undefined)el.dataset.index=index;if(corner)el.dataset.corner=corner;$('overlay').append(el);return el;}
function draw(){
 $('overlay').replaceChildren();$('marks').replaceChildren();
 if(bounds)$('overlay').setAttribute('viewBox',`${bounds[0]} ${bounds[1]} ${bounds[2]-bounds[0]} ${bounds[3]-bounds[1]}`);
 matches.forEach((hit,i)=>{if(hit.page===page)hit.rects.forEach(r=>svgRect(r,'hit'+(i===activeHit?' active':'')));});
 marks.forEach((m,i)=>{if(m.page===page)svgRect(m.rect,'mark'+(i===selected?' selected':''),i);let li=document.createElement('li'),show=document.createElement('button'),remove=document.createElement('button');show.textContent=`Page ${m.page+1} · area ${i+1}`;show.className='show';show.disabled=remove.disabled=busy;show.onclick=()=>task(async()=>{selected=i;if(page!==m.page){page=m.page;await render();}draw();});remove.textContent='Remove';remove.setAttribute('aria-label',`Remove area ${i+1}`);remove.onclick=()=>{selected=-1;commit(marks.filter((_,j)=>i!==j),'Area removed.');};li.append(show,remove);$('marks').append(li);});
 const m=marks[selected];$('editbox').hidden=!m;
 if(m){let r=m.rect;for(let [id,v]of [['editx',r[0]],['edity',r[1]],['editw',r[2]-r[0]],['edith',r[3]-r[1]]])$(id).value=Number(v.toFixed(2));if(m.page===page&&bounds){const size=8/Number($('zoom').value);for(let [corner,x,y]of [['nw',r[0],r[1]],['ne',r[2],r[1]],['sw',r[0],r[3]],['se',r[2],r[3]]])svgRect([x-size/2,y-size/2,x+size/2,y+size/2],'handle '+corner,selected,corner);}}
 if(drag?.mode==='draw'&&drag.rect)svgRect(drag.rect,'draft');
}
function alreadyMarked(hit){return hit.rects.every(r=>marks.some(m=>m.page===hit.page&&JSON.stringify(m.rect)===JSON.stringify(r)));}
function drawResults(){
 $('results').replaceChildren();$('review').hidden=!matches.length;
 matches.forEach((hit,i)=>{let li=document.createElement('li'),label=document.createElement('label'),input=document.createElement('input'),button=document.createElement('button');input.type='checkbox';input.checked=checked.has(i);input.disabled=busy;input.setAttribute('aria-label',`Select match ${i+1} on page ${hit.page+1}`);input.onchange=()=>{input.checked?checked.add(i):checked.delete(i);controls();};label.append(input,document.createTextNode(`Page ${hit.page+1} · match ${i+1}${hit.source==='ocr'?` · OCR ${hit.confidence}%${hit.confidence<70?' · LOW CONFIDENCE — check against page image':''}`:''}${alreadyMarked(hit)?' (marked)':''}`));if(hit.source==='ocr'){let recognized=document.createElement('small');recognized.className='recognized';recognized.textContent=hit.text;li.append(recognized);}
button.textContent='Show';button.setAttribute('aria-label',`Show match ${i+1}`);button.disabled=busy;button.onclick=()=>task(async()=>{activeHit=i;selected=-1;if(page!==hit.page){page=hit.page;await render();}draw();});li.append(label,button);$('results').append(li);});
}
async function render(){let r=await call('render',{page,scale:Number($('zoom').value)});bounds=r.bounds;URL.revokeObjectURL(url);url=URL.createObjectURL(new Blob([r.png],{type:'image/png'}));await new Promise((resolve,reject)=>{$('image').onload=resolve;$('image').onerror=()=>reject(Error('Preview failed.'));$('image').src=url;});$('image').style.width=`${(bounds[2]-bounds[0])*Number($('zoom').value)}px`;$('empty').hidden=true;$('page').hidden=false;draw();}
function askPassword(filename,incorrect=false){
 return new Promise(resolve=>{
 const dialog=$('passworddialog'),input=$('pdfpassword');
 $('passwordfile').textContent=filename;
 $('passworderror').textContent=incorrect?'Incorrect password. Try again.':'';
 input.value='';$('showpassword').checked=false;input.type='password';
 $('passwordform').onsubmit=e=>{e.preventDefault();const value=input.value;input.value='';dialog.close();resolve(value);};
 const cancel=()=>{input.value='';dialog.close();resolve(null);};
 $('cancelpassword').onclick=cancel;dialog.oncancel=e=>{e.preventDefault();cancel();};
 dialog.showModal();input.focus();
 });
}
$('showpassword').onchange=()=>{$('pdfpassword').type=$('showpassword').checked?'text':'password';};
$('file').onchange=()=>task(async()=>{let f=$('file').files[0];if(!f)return;status('Opening PDF…');$('protectioninfo').hidden=true;$('filename').textContent='No document open';count=0;marks=[];history.reset();ocr.reset();$('ocrprogress').hidden=true;$('ocrprogress').value=0;$('ocrinfo').textContent='Select the scan language and rotation. Review OCR matches on the page before marking.';selected=-1;matches=[];checked.clear();activeHit=-1;bounds=null;$('query').value='';$('searchinfo').textContent='Search PDF text and completed OCR pages.';$('page').hidden=true;$('empty').hidden=false;let bytes=await f.arrayBuffer(),r;let password='',incorrect=false;for(;;){try{r=await call('open',{bytes,password});password='';break;}catch(e){password='';if(e.code!=='PASSWORD_REQUIRED')throw e;password=await askPassword(f.name,incorrect);if(password===null){await call('close');$('file').value='';$('filename').textContent='No document open';throw Error('Opening cancelled. Select a PDF to try again.');}incorrect=true;}}$('protectioninfo').hidden=!r.protected;name=f.name;count=r.count;page=0;$('filename').textContent=name;await render();status('Search text to review matches, or drag to draw a redaction box.');});
$('prev').onclick=()=>task(async()=>{page--;selected=-1;await render();});$('next').onclick=()=>task(async()=>{page++;selected=-1;await render();});$('zoom').onchange=()=>{if(count)task(render);};
$('undo').onclick=()=>restore('undo');$('redo').onclick=()=>restore('redo');$('clear').onclick=()=>{selected=-1;commit([],'All marks cleared. Undo restores them.');};
$('searchform').onsubmit=e=>{e.preventDefault();if(busy||!count)return;task(async()=>{matches=[];checked.clear();activeHit=-1;status('Searching all pages…');const result=await call('search',{query:$('query').value}),scanned=searchOCRPages(ocr.pages,$('query').value);matches=[...result.matches,...scanned.matches].sort((a,b)=>a.page-b.page);result.limited ||= scanned.limited;$('searchinfo').textContent=matches.length?`${matches.length} matches (${matches.filter(m=>m.source==='ocr').length} OCR). Review and select the matches to mark.${result.limited?' Results may be incomplete: a page reached the engine limit of 500 highlight regions. Use a more specific search.':''}`:'No matches found. Run OCR first if the document is a scan.';status(matches.length?'Search finished. No matches are selected automatically.':'No text matches found.');});};
$('selectall').onclick=()=>{checked=new Set(matches.map((_,i)=>i));drawResults();controls();};$('selectnone').onclick=()=>{checked.clear();drawResults();controls();};
$('addmatches').onclick=()=>{let next=clone(marks),added=0;for(let i of checked){let hit=matches[i];for(let r of hit.rects){if(!next.some(m=>m.page===hit.page&&JSON.stringify(m.rect)===JSON.stringify(r))){next.push({page:hit.page,rect:[...r]});added++;}}}selected=-1;checked.clear();commit(next,added?`${added} redaction areas added from selected matches.`:'These matches are already marked.');};
$('editbox').onsubmit=e=>{e.preventDefault();if(busy||selected<0||!bounds)return;let x=Number($('editx').value),y=Number($('edity').value),width=Number($('editw').value),height=Number($('edith').value),r=[x,y,x+width,y+height];if(!r.every(Number.isFinite)||width<5||height<5||r[0]<bounds[0]||r[1]<bounds[1]||r[2]>bounds[2]||r[3]>bounds[3])return status('Keep the area inside the page, with width and height of at least 5 points.',true);let next=clone(marks);next[selected].rect=r;commit(next,'Area dimensions updated.');};
$('remove').onclick=()=>{let i=selected;selected=-1;commit(marks.filter((_,j)=>j!==i),'Area removed.');};
function point(e){let r=$('overlay').getBoundingClientRect();return [Math.max(bounds[0],Math.min(bounds[2],bounds[0]+(e.clientX-r.left)/r.width*(bounds[2]-bounds[0]))),Math.max(bounds[1],Math.min(bounds[3],bounds[1]+(e.clientY-r.top)/r.height*(bounds[3]-bounds[1])))];}
const rect=(a,b)=>[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])];
$('overlay').onpointerdown=e=>{if(busy||!bounds||e.button!==0||$('touchmode').getAttribute('aria-pressed')==='true')return;e.preventDefault();$('overlay').focus({preventScroll:true});let target=e.target.closest('[data-index]'),start=point(e);if(target){selected=Number(target.dataset.index);drag={mode:target.dataset.corner?'resize':'move',corner:target.dataset.corner,start,rect:[...marks[selected].rect],before:clone(marks),index:selected};}else{selected=-1;drag={mode:'draw',start,rect:[...start,...start],before:clone(marks)};}$('overlay').setPointerCapture(e.pointerId);draw();};
$('overlay').onpointermove=e=>{if(!drag)return;let p=point(e);if(drag.mode==='draw')drag.rect=rect(drag.start,p);else marks[drag.index].rect=drag.mode==='move'?moveRect(drag.rect,p[0]-drag.start[0],p[1]-drag.start[1],bounds):resizeRect(drag.rect,drag.corner,p,bounds);draw();};
$('overlay').onpointerup=e=>{if(!drag)return;let d=drag,p=point(e),next=clone(marks);if(d.mode==='draw'){let r=rect(d.start,p);if(r[2]-r[0]>=5&&r[3]-r[1]>=5){next.push({page,rect:r});selected=next.length-1;}else status('Draw a box at least 5 PDF points wide and tall.',true);}else next[d.index].rect=d.mode==='move'?moveRect(d.rect,p[0]-d.start[0],p[1]-d.start[1],bounds):resizeRect(d.rect,d.corner,p,bounds);marks=d.before;drag=null;commit(next);controls();};
$('overlay').onpointercancel=()=>{cancelDrag();draw();};
document.addEventListener('keydown',e=>{if(busy||document.querySelector('dialog[open]')||e.target.closest('input,textarea,select,[contenteditable]'))return;const key=e.key.toLowerCase();if((e.ctrlKey||e.metaKey)&&key==='z'){e.preventDefault();restore(e.shiftKey?'redo':'undo');return;}if((e.ctrlKey||e.metaKey)&&key==='y'){e.preventDefault();restore('redo');return;}if(key==='escape'){cancelDrag();selected=-1;draw();return;}if(selected<0)return;if(key==='delete'||key==='backspace'){e.preventDefault();$('remove').click();return;}if(e.target===$('overlay')&&['arrowleft','arrowright','arrowup','arrowdown'].includes(key)){e.preventDefault();let step=e.shiftKey?10:1,next=clone(marks);next[selected].rect=moveRect(next[selected].rect,key==='arrowleft'?-step:key==='arrowright'?step:0,key==='arrowup'?-step:key==='arrowdown'?step:0,bounds);commit(next);}});
let exportBytes,exportPage=0,exportCount=0,exportURL;
async function renderExport(){const r=await call('exportRender',{page:exportPage});URL.revokeObjectURL(exportURL);exportURL=URL.createObjectURL(new Blob([r.png],{type:'image/png'}));await new Promise((resolve,reject)=>{$('exportimage').onload=resolve;$('exportimage').onerror=()=>reject(Error('Export preview failed.'));$('exportimage').src=exportURL;});const overlay=$('exportoverlay');overlay.replaceChildren();overlay.setAttribute('viewBox',`${r.bounds[0]} ${r.bounds[1]} ${r.bounds[2]-r.bounds[0]} ${r.bounds[3]-r.bounds[1]}`);const selectedArea=marks[Number($('exportjump').value)];if(selectedArea?.page===exportPage){const rect=document.createElementNS('http://www.w3.org/2000/svg','rect'),b=selectedArea.rect;for(const [k,v]of Object.entries({x:b[0],y:b[1],width:b[2]-b[0],height:b[3]-b[1],fill:'none',stroke:'#dd8b00','stroke-width':2}))rect.setAttribute(k,v);overlay.append(rect);const frame=$('exportimage').closest('.exportimage');frame.scrollTop=Math.max(0,(b[1]-r.bounds[1])/(r.bounds[3]-r.bounds[1])*$('exportimage').clientHeight-frame.clientHeight/2);}$('exportpage').textContent=`Page ${exportPage+1} of ${exportCount}`;$('exportprev').disabled=exportPage===0;$('exportnext').disabled=exportPage===exportCount-1;}
$('export').onclick=()=>task(async()=>{status('Applying redactions and verifying export…');const r=await call('export',{marks});exportBytes=r.bytes;exportCount=r.count;exportPage=marks[0].page;$('exportreport').textContent=`Verified ${marks.length} marked area${marks.length===1?'':'s'} on ${new Set(marks.map(m=>m.page)).size} page${new Set(marks.map(m=>m.page)).size===1?'':'s'}: no remaining PDF text in marked areas; black fill checks passed.`;$('exportjump').replaceChildren();marks.forEach((m,i)=>{const option=document.createElement('option');option.value=i;option.textContent=`Area ${i+1} · page ${m.page+1}`;$('exportjump').append(option);});await renderExport();$('exportdialog').showModal();status('Export verified. Review the redacted output before downloading.');});
$('exportprev').onclick=()=>task(async()=>{exportPage--;await renderExport();});$('exportnext').onclick=()=>task(async()=>{exportPage++;await renderExport();});$('exportjump').onchange=()=>task(async()=>{exportPage=marks[Number($('exportjump').value)].page;await renderExport();});
$('downloadexport').onclick=()=>{if(!exportBytes)return;const u=URL.createObjectURL(new Blob([exportBytes],{type:'application/pdf'})),a=document.createElement('a');a.href=u;a.download=name.replace(/\.pdf$/i,'')+'-redacted.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(u),60000);status('Verified copy downloaded. It is not password-protected.');};
function closeExport(){exportBytes=undefined;URL.revokeObjectURL(exportURL);$('exportimage').removeAttribute('src');}
$('closeexport').onclick=()=>$('exportdialog').close();$('exportdialog').onclose=closeExport;
$('addarea').onclick=()=>{if(!bounds||busy)return;const [x,y,x1,y1]=bounds,w=Math.min(120,x1-x),h=Math.min(40,y1-y);selected=marks.length;commit([...marks,{page,rect:[x+(x1-x-w)/2,y+(y1-y-h)/2,x+(x1-x+w)/2,y+(y1-y+h)/2]}],'Area added. Adjust coordinates or move with arrow keys.');$('editx').focus();};
$('touchmode').onclick=()=>{const pan=$('touchmode').getAttribute('aria-pressed')!=='true';$('touchmode').setAttribute('aria-pressed',String(pan));$('touchmode').textContent=pan?'Draw / edit areas':'Pan page';$('page').classList.toggle('pan',pan);};controls();

$('runocr').onclick=()=>{if(busy||!count)return;task(async()=>{
 const mode=$('ocrscope').value;let pages;
 if(mode==='current')pages=[page];else if(mode==='all')pages=Array.from({length:count},(_,i)=>i);else pages=(await call('pageInfo')).pages.filter(p=>!p.hasText).map(p=>p.page);
 if(!pages.length){$('ocrinfo').textContent='Every page already has selectable text. Use Current page or All pages to recognise the image anyway.';status('No pages need OCR for this selection.');return;}
 matches=[];checked.clear();activeHit=-1;$('ocrprogress').hidden=false;$('ocrprogress').value=0;status('Recognising text locally…');
 try{const result=await ocr.scan(pages,p=>call('ocrRender',{page:p,rotation:Number($('ocrrotation').value)}),m=>{const progress=Math.min(1,(m.completed+(m.status==='recognizing text'?m.progress:0))/m.total);$('ocrprogress').value=progress;$('ocrinfo').textContent=`${m.page===undefined?'Preparing OCR engine':`Page ${m.page+1} · ${m.status}`} · ${m.completed}/${m.total} complete`;$('cancelocr').disabled=false;},$('ocrlanguage').value);$('ocrinfo').textContent=`OCR complete: ${result.words} words on ${result.pages} pages. Search and review the results before marking.`;status('OCR complete. Enter a search term to review recognised matches.');}
 catch(e){$('ocrinfo').textContent=`${e.message} ${ocr.pages.size} completed pages remain available for search.`;throw e;}
 finally{$('cancelocr').disabled=true;}
 });};
$('cancelocr').onclick=()=>ocr.cancel();
