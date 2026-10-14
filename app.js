import {searchOCR,mergeMatches,patternRegex,pageMarkCounts} from './search-model.js?v=0.4.0';
import {OCRController} from './ocr.js?v=0.4.0';
import {searchOCRPages} from './ocr-model.js?v=0.4.0';
import {History,clone,moveRect,resizeRect} from './model.js?v=0.4.0';
const $=id=>document.getElementById(id),worker=new Worker('./worker.js?v=0.4.0',{type:'module'}),history=new History(),ocr=new OCRController();
let seq=0,pending=new Map(),page=0,count=0,marks=[],bounds,name='',busy=false,url,drag,selected=-1,matches=[],checked=new Set(),activeHit=-1,scanning=false,scanCancelled=false,searchSession=null;
worker.onmessage=({data:d})=>{let p=pending.get(d.id);if(p){pending.delete(d.id);d.error?p.reject(Object.assign(Error(d.error),{code:d.code})):p.resolve(d.result);}};
worker.onerror=()=>{for(let p of pending.values())p.reject(Error('The PDF engine could not load. Refresh the page.'));pending.clear();};
const call=(type,data={})=>new Promise((resolve,reject)=>{let id=++seq;pending.set(id,{resolve,reject});worker.postMessage({id,type,...data});});
function status(s,error=false){$('status').textContent=s;$('status').classList.toggle('error',error);}
function controls(){
 for(let id of ['exportjump','downloadexport','closeexport','reviewedpage'])$(id).disabled=busy;
 $('exportprev').disabled=busy||exportPage===0;$('exportnext').disabled=busy||exportPage>=exportCount-1;
 $('clear').disabled=busy||!marks.length;$('export').disabled=busy||scanning||!marks.length;
 $('undo').disabled=busy||!history.past.length;$('redo').disabled=busy||!history.future.length;
 $('prev').disabled=busy||page<=0;$('next').disabled=busy||page>=count-1;$('file').disabled=busy||scanning;$('zoom').disabled=busy;
 for(let id of ['runocr','ocrscope','ocrlanguage','ocrrotation','includescan','searchmode'])$(id).disabled=busy||scanning||!count;$('addarea').disabled=busy||!count;
 $('cancelocr').disabled=!scanning;
 $('search').disabled=busy||scanning||!count;$('query').disabled=busy||scanning||!count||['email','phone'].includes($('searchmode').value);
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
 updateThumbnailLabels();
 $('overlay').replaceChildren();$('marks').replaceChildren();
 if(bounds)$('overlay').setAttribute('viewBox',`${bounds[0]} ${bounds[1]} ${bounds[2]-bounds[0]} ${bounds[3]-bounds[1]}`);
 matches.forEach((hit,i)=>{if(hit.page===page)hit.rects.forEach(r=>svgRect(r,'hit'+(i===activeHit?' active':'')));});
 marks.forEach((m,i)=>{if(m.page===page)svgRect(m.rect,'mark'+(i===selected?' selected':''),i);let li=document.createElement('li'),show=document.createElement('button'),remove=document.createElement('button');show.textContent=`Page ${m.page+1} · area ${i+1}`;show.className='show';show.disabled=remove.disabled=busy;show.onclick=()=>task(async()=>{selected=i;if(page!==m.page){page=m.page;await render();}draw();});remove.textContent='Remove';remove.setAttribute('aria-label',`Remove area ${i+1}`);remove.onclick=()=>{selected=-1;commit(marks.filter((_,j)=>i!==j),'Area removed.');};li.append(show,remove);$('marks').append(li);});
 const m=marks[selected];$('editbox').hidden=!m;
 if(m){let r=m.rect;if(!document.activeElement?.closest('#editbox'))for(let [id,v]of [['editx',r[0]],['edity',r[1]],['editw',r[2]-r[0]],['edith',r[3]-r[1]]])$(id).value=Number(v.toFixed(2));if(m.page===page&&bounds){const size=8/Number($('zoom').value);for(let [corner,x,y]of [['nw',r[0],r[1]],['ne',r[2],r[1]],['sw',r[0],r[3]],['se',r[2],r[3]]])svgRect([x-size/2,y-size/2,x+size/2,y+size/2],'handle '+corner,selected,corner);}}
 if(drag?.mode==='draw'&&drag.rect)svgRect(drag.rect,'draft');
}
function alreadyMarked(hit){return hit.rects.every(r=>marks.some(m=>m.page===hit.page&&JSON.stringify(m.rect)===JSON.stringify(r)));}
function drawResults(){
 const focus=document.activeElement?.getAttribute('aria-label'),scroll=$('results').scrollTop;
 $('results').replaceChildren();$('review').hidden=!matches.length;
 matches.forEach((hit,i)=>{let li=document.createElement('li'),label=document.createElement('label'),input=document.createElement('input'),button=document.createElement('button');input.type='checkbox';input.checked=checked.has(hit.key);input.disabled=busy;input.setAttribute('aria-label',`Select match ${i+1} on page ${hit.page+1}`);input.onchange=()=>{input.checked?checked.add(hit.key):checked.delete(hit.key);controls();};label.append(input,document.createTextNode(`Page ${hit.page+1} · match ${i+1}${hit.source==='ocr'?` · OCR ${hit.confidence}%${hit.confidence<70?' · LOW CONFIDENCE — check against page image':''}`:''}${alreadyMarked(hit)?' (marked)':''}`));if(hit.text){let recognized=document.createElement('small');recognized.className='recognized';recognized.textContent=hit.text;li.append(recognized);}
button.textContent='Show';button.setAttribute('aria-label',`Show match ${i+1}`);button.disabled=busy;button.onclick=()=>task(async()=>{activeHit=i;selected=-1;if(page!==hit.page){page=hit.page;await render();}draw();});li.append(label,button);$('results').append(li);});$('results').scrollTop=scroll;if(focus)for(const el of $('results').querySelectorAll('input,button'))if(el.getAttribute('aria-label')===focus)el.focus({preventScroll:true});
}
async function render(){let r=await call('render',{page,scale:Number($('zoom').value)});bounds=r.bounds;URL.revokeObjectURL(url);url=URL.createObjectURL(new Blob([r.png],{type:'image/png'}));await new Promise((resolve,reject)=>{$('image').onload=resolve;$('image').onerror=()=>reject(Error('Preview failed.'));$('image').src=url;});$('image').style.width=`${(bounds[2]-bounds[0])*Number($('zoom').value)}px`;$('empty').hidden=true;$('page').hidden=false;draw();}
const thumbnailStates=new Map();
function clearThumbnails(kind){const state=thumbnailStates.get(kind);if(state){state.observer.disconnect();for(const value of state.urls.values())URL.revokeObjectURL(value);state.cancelled=true;thumbnailStates.delete(kind);}$(kind==='source'?'thumbnails':'exportthumbnails').replaceChildren();}
function updateThumbnailLabels(){const counts=pageMarkCounts(marks);for(const [kind,state]of thumbnailStates){for(const [i,button]of state.buttons){const current=kind==='source'?page:exportPage;button.setAttribute('aria-current',i===current?'page':'false');button.disabled=busy;const marked=counts.get(i)||0,reviewed=kind==='export'&&reviewedPages.has(i);button.querySelector('.thumb-caption').textContent=`Page ${i+1} · ${marked} area${marked===1?'':'s'}${kind==='export'?reviewed?' · reviewed':' · not reviewed':''}`;button.setAttribute('aria-label',`Show ${kind==='export'?'exported ':''}page ${i+1}, ${marked} marked areas${kind==='export'?reviewed?', reviewed':', not reviewed':''}`);}}
}
function buildThumbnails(kind,total){
 clearThumbnails(kind);const container=$(kind==='source'?'thumbnails':'exportthumbnails'),state={urls:new Map(),buttons:new Map(),queue:[],loading:false,cancelled:false};thumbnailStates.set(kind,state);
 async function load(){if(state.loading)return;state.loading=true;try{while(state.queue.length&&!state.cancelled){const i=state.queue.shift();if(state.urls.has(i))continue;const result=await call(kind==='source'?'thumbnail':'exportThumbnail',{page:i});if(state.cancelled)break;const url=URL.createObjectURL(new Blob([result.png],{type:'image/png'})),button=state.buttons.get(i),image=button.querySelector('img');state.urls.set(i,url);image.src=url;image.hidden=false;button.querySelector('.thumbnail-placeholder').hidden=true;if(state.urls.size>48){const [old,u]=state.urls.entries().next().value;URL.revokeObjectURL(u);state.urls.delete(old);const oldButton=state.buttons.get(old);oldButton.querySelector('img').removeAttribute('src');oldButton.querySelector('img').hidden=true;oldButton.querySelector('.thumbnail-placeholder').hidden=false;}}}catch(e){if(!state.cancelled)container.setAttribute('aria-description','Some thumbnail previews could not load. Page navigation remains available.');}finally{state.loading=false;}}
 state.observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){const i=Number(e.target.dataset.page);if(!state.urls.has(i)&&!state.queue.includes(i))state.queue.push(i);}load();},{root:container,rootMargin:'150px'});
 for(let i=0;i<total;i++){const button=document.createElement('button');button.className='thumbnail';button.dataset.page=i;const image=document.createElement('img');image.alt='';image.hidden=true;const placeholder=document.createElement('span');placeholder.className='thumbnail-placeholder';placeholder.textContent=String(i+1);const caption=document.createElement('span');caption.className='thumb-caption';button.append(image,placeholder,caption);button.onclick=()=>task(async()=>{if(kind==='source'){page=i;selected=-1;await render();}else{exportPage=i;await renderExport();}});container.append(button);state.buttons.set(i,button);state.observer.observe(button);}updateThumbnailLabels();
}
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
$('file').onchange=()=>task(async()=>{let f=$('file').files[0];if(!f)return;status('Opening PDF…');$('protectioninfo').hidden=true;$('filename').textContent='No document open';count=0;marks=[];history.reset();ocr.reset();$('ocrprogress').hidden=true;$('ocrprogress').value=0;$('ocrinfo').textContent='Completed scans are reused for this document and scan settings.';selected=-1;matches=[];checked.clear();activeHit=-1;bounds=null;$('query').value='';$('searchinfo').textContent='Enter text or choose a pattern, then select Find.';$('page').hidden=true;$('empty').hidden=false;searchSession=null;clearThumbnails('source');let bytes=await f.arrayBuffer(),r;let password='',incorrect=false;for(;;){try{r=await call('open',{bytes,password});password='';break;}catch(e){password='';if(e.code!=='PASSWORD_REQUIRED')throw e;password=await askPassword(f.name,incorrect);if(password===null){await call('close');$('file').value='';$('filename').textContent='No document open';throw Error('Opening cancelled. Select a PDF to try again.');}incorrect=true;}}$('protectioninfo').hidden=!r.protected;name=f.name;count=r.count;page=0;$('filename').textContent=name;await render();buildThumbnails('source',count);status('Search text to review matches, or drag to draw a redaction box.');});
$('prev').onclick=()=>task(async()=>{page--;selected=-1;await render();});$('next').onclick=()=>task(async()=>{page++;selected=-1;await render();});$('zoom').onchange=()=>{if(count)task(render);};
$('undo').onclick=()=>restore('undo');$('redo').onclick=()=>restore('redo');$('clear').onclick=()=>{selected=-1;commit([],'All marks cleared. Undo restores them.');};
function refreshSearch(message){
 if(!searchSession)return;
 const {spec,native,language,rotation,includeScan}=searchSession,key=`${language}:${rotation}`;
 const pages=new Map([...ocr.pages].filter(([page])=>ocr.settings.get(page)===key)),scanned=includeScan?searchOCR(pages,spec):{matches:[],limited:false};
 matches=mergeMatches(native.matches,scanned.matches);const available=new Set(matches.map(m=>m.key));checked=new Set([...checked].filter(k=>available.has(k)));
 const limited=native.limited||scanned.limited;
 $('searchinfo').textContent=`${message} ${matches.length} matches (${matches.filter(m=>m.source==='ocr').length} OCR). Review before marking.${limited?' Results may be incomplete: a page reached the 500-match limit. Narrow the search.':''}`;
 drawResults();draw();controls();
}
function searchSpec(){const mode=$('searchmode').value,value=$('query').value.trim();if(mode==='text'&&!value)throw Error('Enter a word or phrase.');if(mode!=='text')patternRegex(mode,value);return {mode,value};}
async function beginSearch(){
 if(busy||scanning||!count)return;searchSession=null;
 await task(async()=>{matches=[];checked.clear();activeHit=-1;const spec=searchSpec();status('Searching PDF text…');const native=await call(spec.mode==='text'?'search':'patterns',spec.mode==='text'?{query:spec.value}:{spec});searchSession={spec,native,language:$('ocrlanguage').value,rotation:Number($('ocrrotation').value),includeScan:$('includescan').checked};refreshSearch($('includescan').checked?'PDF text ready; preparing scanned search.':'Search complete (PDF text only).');});
 if(!searchSession)return;
 if($('includescan').checked)await scanDocument(false);else status('Search complete. Scanned pages were not recognised for this search.');
}
$('searchform').onsubmit=e=>{e.preventDefault();beginSearch();};
$('searchmode').onchange=()=>{const mode=$('searchmode').value;$('querylabel').textContent=mode==='custom'?'Custom pattern':'Name, identifier or phrase';$('query').placeholder=mode==='custom'?'Example: ID-####':mode==='text'?'Search document text':'No search text needed';$('patternhelp').hidden=mode==='text';if(['email','phone'].includes(mode))$('query').value='';controls();};
$('selectall').onclick=()=>{checked=new Set(matches.map(m=>m.key));drawResults();controls();};$('selectnone').onclick=()=>{checked.clear();drawResults();controls();};
$('addmatches').onclick=()=>{let next=clone(marks),added=0;for(const hit of matches.filter(m=>checked.has(m.key))){for(let r of hit.rects){if(!next.some(m=>m.page===hit.page&&JSON.stringify(m.rect)===JSON.stringify(r))){next.push({page:hit.page,rect:[...r]});added++;}}}selected=-1;checked.clear();commit(next,added?`${added} redaction areas added from selected matches.`:'These matches are already marked.');};
$('editbox').onsubmit=e=>{e.preventDefault();if(busy||selected<0||!bounds)return;let x=Number($('editx').value),y=Number($('edity').value),width=Number($('editw').value),height=Number($('edith').value),r=[x,y,x+width,y+height];if(!r.every(Number.isFinite)||width<5||height<5||r[0]<bounds[0]||r[1]<bounds[1]||r[2]>bounds[2]||r[3]>bounds[3])return status('Keep the area inside the page, with width and height of at least 5 points.',true);let next=clone(marks);next[selected].rect=r;commit(next,'Area dimensions updated.');};
$('remove').onclick=()=>{let i=selected;selected=-1;commit(marks.filter((_,j)=>j!==i),'Area removed.');};
function point(e){let r=$('overlay').getBoundingClientRect();return [Math.max(bounds[0],Math.min(bounds[2],bounds[0]+(e.clientX-r.left)/r.width*(bounds[2]-bounds[0]))),Math.max(bounds[1],Math.min(bounds[3],bounds[1]+(e.clientY-r.top)/r.height*(bounds[3]-bounds[1])))];}
const rect=(a,b)=>[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])];
$('overlay').onpointerdown=e=>{if(busy||!bounds||e.button!==0||$('touchmode').getAttribute('aria-pressed')==='true')return;e.preventDefault();$('overlay').focus({preventScroll:true});let target=e.target.closest('[data-index]'),start=point(e);if(target){selected=Number(target.dataset.index);drag={mode:target.dataset.corner?'resize':'move',corner:target.dataset.corner,start,rect:[...marks[selected].rect],before:clone(marks),index:selected};}else{selected=-1;drag={mode:'draw',start,rect:[...start,...start],before:clone(marks)};}$('overlay').setPointerCapture(e.pointerId);draw();};
$('overlay').onpointermove=e=>{if(!drag)return;let p=point(e);if(drag.mode==='draw')drag.rect=rect(drag.start,p);else marks[drag.index].rect=drag.mode==='move'?moveRect(drag.rect,p[0]-drag.start[0],p[1]-drag.start[1],bounds):resizeRect(drag.rect,drag.corner,p,bounds);draw();};
$('overlay').onpointerup=e=>{if(!drag)return;let d=drag,p=point(e),next=clone(marks);if(d.mode==='draw'){let r=rect(d.start,p);if(r[2]-r[0]>=5&&r[3]-r[1]>=5){next.push({page,rect:r});selected=next.length-1;}else status('Draw a box at least 5 PDF points wide and tall.',true);}else next[d.index].rect=d.mode==='move'?moveRect(d.rect,p[0]-d.start[0],p[1]-d.start[1],bounds):resizeRect(d.rect,d.corner,p,bounds);marks=d.before;drag=null;commit(next);controls();};
$('overlay').onpointercancel=()=>{cancelDrag();draw();};
document.addEventListener('keydown',e=>{if(busy||document.querySelector('dialog[open]')||e.target.closest('input,textarea,select,[contenteditable]'))return;const key=e.key.toLowerCase();if((e.ctrlKey||e.metaKey)&&key==='z'){e.preventDefault();restore(e.shiftKey?'redo':'undo');return;}if((e.ctrlKey||e.metaKey)&&key==='y'){e.preventDefault();restore('redo');return;}if(key==='escape'){cancelDrag();selected=-1;draw();return;}if(selected<0)return;if(key==='delete'||key==='backspace'){e.preventDefault();$('remove').click();return;}if(e.target===$('overlay')&&['arrowleft','arrowright','arrowup','arrowdown'].includes(key)){e.preventDefault();let step=e.shiftKey?10:1,next=clone(marks);next[selected].rect=moveRect(next[selected].rect,key==='arrowleft'?-step:key==='arrowright'?step:0,key==='arrowup'?-step:key==='arrowdown'?step:0,bounds);commit(next);}});
let exportBytes,exportPage=0,exportCount=0,exportURL,reviewedPages=new Set();
function updateReview(){ $('reviewedpage').checked=reviewedPages.has(exportPage);$('reviewcount').textContent=`${reviewedPages.size}/${exportCount} exported pages marked reviewed. Review tracking records your confirmation; it is not an additional security check.`;updateThumbnailLabels();}
$('reviewedpage').onchange=()=>{$('reviewedpage').checked?reviewedPages.add(exportPage):reviewedPages.delete(exportPage);updateReview();};
async function renderExport(){const r=await call('exportRender',{page:exportPage});URL.revokeObjectURL(exportURL);exportURL=URL.createObjectURL(new Blob([r.png],{type:'image/png'}));await new Promise((resolve,reject)=>{$('exportimage').onload=resolve;$('exportimage').onerror=()=>reject(Error('Export preview failed.'));$('exportimage').src=exportURL;});const overlay=$('exportoverlay');overlay.replaceChildren();overlay.setAttribute('viewBox',`${r.bounds[0]} ${r.bounds[1]} ${r.bounds[2]-r.bounds[0]} ${r.bounds[3]-r.bounds[1]}`);const selectedArea=marks[Number($('exportjump').value)];if(selectedArea?.page===exportPage){const rect=document.createElementNS('http://www.w3.org/2000/svg','rect'),b=selectedArea.rect;for(const [k,v]of Object.entries({x:b[0],y:b[1],width:b[2]-b[0],height:b[3]-b[1],fill:'none',stroke:'#dd8b00','stroke-width':2}))rect.setAttribute(k,v);overlay.append(rect);const frame=$('exportimage').closest('.exportimage');frame.scrollTop=Math.max(0,(b[1]-r.bounds[1])/(r.bounds[3]-r.bounds[1])*$('exportimage').clientHeight-frame.clientHeight/2);}$('exportpage').textContent=`Page ${exportPage+1} of ${exportCount}`;$('exportprev').disabled=exportPage===0;$('exportnext').disabled=exportPage===exportCount-1;updateReview();}
$('export').onclick=()=>task(async()=>{status('Applying redactions and verifying export…');const r=await call('export',{marks});exportBytes=r.bytes;exportCount=r.count;reviewedPages.clear();exportPage=marks[0].page;$('exportreport').textContent=`Verified ${marks.length} marked area${marks.length===1?'':'s'} on ${new Set(marks.map(m=>m.page)).size} page${new Set(marks.map(m=>m.page)).size===1?'':'s'}: no remaining PDF text in marked areas; black fill checks passed.`;$('exportjump').replaceChildren();marks.forEach((m,i)=>{const option=document.createElement('option');option.value=i;option.textContent=`Area ${i+1} · page ${m.page+1}`;$('exportjump').append(option);});await renderExport();$('exportdialog').showModal();buildThumbnails('export',exportCount);status('Export verified. Review the redacted output before downloading.');});
$('exportprev').onclick=()=>task(async()=>{exportPage--;await renderExport();});$('exportnext').onclick=()=>task(async()=>{exportPage++;await renderExport();});$('exportjump').onchange=()=>task(async()=>{exportPage=marks[Number($('exportjump').value)].page;await renderExport();});
$('downloadexport').onclick=()=>{if(!exportBytes)return;const u=URL.createObjectURL(new Blob([exportBytes],{type:'application/pdf'})),a=document.createElement('a');a.href=u;a.download=name.replace(/\.pdf$/i,'')+'-redacted.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(u),60000);status('Verified copy downloaded. It is not password-protected.');};
function closeExport(){clearThumbnails('export');reviewedPages.clear();exportBytes=undefined;URL.revokeObjectURL(exportURL);$('exportimage').removeAttribute('src');}
$('closeexport').onclick=()=>$('exportdialog').close();$('exportdialog').onclose=closeExport;
$('addarea').onclick=()=>{if(!bounds||busy)return;const [x,y,x1,y1]=bounds,w=Math.min(120,x1-x),h=Math.min(40,y1-y);selected=marks.length;commit([...marks,{page,rect:[x+(x1-x-w)/2,y+(y1-y-h)/2,x+(x1-x+w)/2,y+(y1-y+h)/2]}],'Area added. Adjust coordinates or move with arrow keys.');$('editx').focus();};
$('touchmode').onclick=()=>{const pan=$('touchmode').getAttribute('aria-pressed')!=='true';$('touchmode').setAttribute('aria-pressed',String(pan));$('touchmode').textContent=pan?'Draw / edit areas':'Pan page';$('page').classList.toggle('pan',pan);};controls();

async function scanDocument(force){
 if(scanning)return;scanning=true;scanCancelled=false;controls();
 const mode=$('ocrscope').value,language=$('ocrlanguage').value,rotation=Number($('ocrrotation').value),key=`${language}:${rotation}`;
 $('ocrprogress').hidden=false;$('ocrprogress').value=0;
 try{
  let pages=mode==='current'?[page]:mode==='all'?Array.from({length:count},(_,i)=>i):(await call('pageInfo')).pages.filter(p=>!p.hasText).map(p=>p.page);
  if(scanCancelled)throw Error('Scan cancelled.');
  if(!force)pages=pages.filter(p=>ocr.settings.get(p)!==key);
  if(!pages.length){$('ocrinfo').textContent='No new pages to scan for these settings. Completed scans are reused. For mixed pages, choose Scan all pages.';refreshSearch('Search complete for selected scan scope.');status(searchSession?'Search complete for the selected scan scope.':'Scans are current. Enter text or choose a pattern, then select Find.');return;}
  status('Recognising scanned text locally. Available matches can be reviewed now.');
  const result=await ocr.scan(pages,p=>call('ocrRender',{page:p,rotation}),m=>{
   $('ocrprogress').value=Math.min(1,(m.completed+(m.status==='recognizing text'?m.progress:0))/m.total);
   $('ocrinfo').textContent=`${m.page===undefined?'Preparing scan engine':`Page ${m.page+1} · ${m.status}`} · ${m.completed}/${m.total} complete`;
   if(m.status==='page complete')refreshSearch('Scanning in progress; matches may still arrive.');controls();
  },language,rotation);
  $('ocrinfo').textContent=`Scan complete: ${result.words} words on ${result.pages} pages. Results are reused for these settings.`;refreshSearch('Search complete for selected scan scope.');status(searchSession?'Search complete. Review matches before marking.':'Scan complete. Enter text or choose a pattern, then select Find.');
 }catch(e){const message=scanCancelled?'Search incomplete: scan cancelled. Completed results retained.':`Search incomplete: ${e.message}`;$('ocrinfo').textContent=message;refreshSearch(message);status(message,!scanCancelled);}
 finally{scanning=false;controls();}
}
$('runocr').onclick=()=>{if(busy||scanning||!count)return;searchSession=null;matches=[];checked.clear();drawResults();draw();scanDocument(true);};
$('cancelocr').onclick=()=>{scanCancelled=true;ocr.cancel();};
