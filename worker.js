import {mupdf,openPDF,exportPDF,searchPDF} from './core.js?v=0.3.0';
let doc,bytes,password='';
self.onmessage=({data})=>{
 const {id,type}=data;
 try{
  let result;
  if(type==='open'){
   doc?.destroy();doc=undefined;bytes=new Uint8Array(data.bytes);password=data.password||'';doc=openPDF(bytes,password);
   result={count:doc.countPages()};
  }else if(type==='render'){
   if(!doc)throw Error('Open a PDF first.');const page=doc.loadPage(data.page);
   try{const bounds=page.getBounds(),scale=data.scale;const pix=page.toPixmap([scale,0,0,scale,0,0],mupdf.ColorSpace.DeviceRGB,false,true);try{result={bounds,png:new Uint8Array(pix.asPNG())};}finally{pix.destroy();}}finally{page.destroy();}
  }else if(type==='search'){
   if(!doc)throw Error('Open a PDF first.');result=searchPDF(doc,data.query);
  }else if(type==='pageInfo'){
   if(!doc)throw Error('Open a PDF first.');const pages=[];
   for(let i=0;i<doc.countPages();i++){const page=doc.loadPage(i);try{const text=page.toStructuredText('');try{pages.push({page:i,hasText:!!text.asText().trim()});}finally{text.destroy();}}finally{page.destroy();}}
   result={pages};
  }else if(type==='ocrRender'){
   if(!doc)throw Error('Open a PDF first.');const page=doc.loadPage(data.page);
   try{const bounds=page.getBounds(),width=bounds[2]-bounds[0],height=bounds[3]-bounds[1],scale=Math.min(3,6000/Math.max(width,height),Math.sqrt(16000000/(width*height)));const pix=page.toPixmap([scale,0,0,scale,0,0],mupdf.ColorSpace.DeviceRGB,false,true);try{result={bounds,scale,origin:[pix.getX(),pix.getY()],png:new Uint8Array(pix.asPNG())};}finally{pix.destroy();}}finally{page.destroy();}
  }else if(type==='export')result={bytes:exportPDF(bytes,data.marks,password)};
  else throw Error('Unknown operation.');
  self.postMessage({id,result});
 }catch(e){self.postMessage({id,error:e.message||String(e)});}
};
