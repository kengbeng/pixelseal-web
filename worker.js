import {findPatternText} from './search-model.js?v=0.5.0';
import {mupdf,openPDF,exportPDF,searchPDF} from './core.js?v=0.5.0';
let doc,bytes,password='',exported;
self.onmessage=({data})=>{
 const {id,type}=data;
 try{
  let result;
  if(type==='open'){
   doc?.destroy();exported?.destroy();exported=undefined;doc=undefined;bytes=new Uint8Array(data.bytes);password=data.password||'';doc=openPDF(bytes,password);
   result={count:doc.countPages(),protected:doc.pixelsealProtected};
  }else if(type==='close'){doc?.destroy();exported?.destroy();exported=undefined;doc=undefined;bytes=undefined;password='';result={closed:true};
  }else if(type==='pageBounds'||type==='exportPageBounds'){
   const document=type==='pageBounds'?doc:exported;if(!document)throw Error('Open a PDF first.');const page=document.loadPage(data.page);try{result={bounds:page.getBounds()};}finally{page.destroy();}
  }else if(type==='render'){
   if(!doc)throw Error('Open a PDF first.');const page=doc.loadPage(data.page);
   try{const bounds=page.getBounds(),scale=data.scale;const pix=page.toPixmap([scale,0,0,scale,0,0],mupdf.ColorSpace.DeviceRGB,false,true);try{result={bounds,png:new Uint8Array(pix.asPNG())};}finally{pix.destroy();}}finally{page.destroy();}
  }else if(type==='search'){
   if(!doc)throw Error('Open a PDF first.');result=searchPDF(doc,data.query);
  }else if(type==='patterns'){
   if(!doc)throw Error('Open a PDF first.');const matches=[],keys=new Set();let limited=false;
   for(let i=0;i<doc.countPages();i++){const page=doc.loadPage(i);let content;try{const text=page.toStructuredText('');try{content=text.asText();}finally{text.destroy();}}finally{page.destroy();}
    const candidates=findPatternText(content,data.spec);limited ||= candidates.limited;let found=0;
    for(const value of new Set(candidates.hits.map(h=>h.text))){const result=searchPDF(doc,value,[i]);limited ||= result.limited;for(const hit of result.matches){if(keys.has(hit.key))continue;if(found>=500){limited=true;break;}keys.add(hit.key);matches.push({...hit,text:value,source:'pdf'});found++;}}
   }result={matches,limited};
  }else if(type==='thumbnail'||type==='exportThumbnail'){
   const document=type==='thumbnail'?doc:exported;if(!document)throw Error('Open a PDF first.');const page=document.loadPage(data.page);try{const b=page.getBounds(),scale=Math.min(110/(b[2]-b[0]),135/(b[3]-b[1]));const pix=page.toPixmap([scale,0,0,scale,0,0],mupdf.ColorSpace.DeviceRGB,false,true);try{result={png:new Uint8Array(pix.asPNG())};}finally{pix.destroy();}}finally{page.destroy();}
  }else if(type==='pageInfo'){
   if(!doc)throw Error('Open a PDF first.');const pages=[];
   for(let i=0;i<doc.countPages();i++){const page=doc.loadPage(i);try{const text=page.toStructuredText('');try{pages.push({page:i,hasText:!!text.asText().trim()});}finally{text.destroy();}}finally{page.destroy();}}
   result={pages};
  }else if(type==='ocrRender'){
   if(!doc)throw Error('Open a PDF first.');const page=doc.loadPage(data.page);
   try{const bounds=page.getBounds(),width=bounds[2]-bounds[0],height=bounds[3]-bounds[1],scale=Math.min(3,6000/Math.max(width,height),Math.sqrt(16000000/(width*height)));const rotation=Number(data.rotation)||0,matrix=rotation===90?[0,scale,-scale,0,0,0]:rotation===180?[-scale,0,0,-scale,0,0]:rotation===270?[0,-scale,scale,0,0,0]:[scale,0,0,scale,0,0];const pix=page.toPixmap(matrix,mupdf.ColorSpace.DeviceRGB,false,true);try{result={bounds,scale,matrix,origin:[pix.getX(),pix.getY()],png:new Uint8Array(pix.asPNG())};}finally{pix.destroy();}}finally{page.destroy();}
  }else if(type==='export'){const output=exportPDF(bytes,data.marks,password);exported?.destroy();exported=openPDF(output);result={bytes:output,count:exported.countPages()};}
  else if(type==='exportRender'){if(!exported)throw Error('Prepare an export first.');const page=exported.loadPage(data.page);try{const pix=page.toPixmap([data.scale||1,0,0,data.scale||1,0,0],mupdf.ColorSpace.DeviceRGB,false,true);try{result={bounds:page.getBounds(),png:new Uint8Array(pix.asPNG())};}finally{pix.destroy();}}finally{page.destroy();}}
  else throw Error('Unknown operation.');
  self.postMessage({id,result});
 }catch(e){if(type==='open')password='';self.postMessage({id,error:e.message||String(e),code:e.code});}
};
