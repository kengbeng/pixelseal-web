import * as mupdf from './vendor/mupdf.js';
export { mupdf };
export const quadRect=q=>[Math.min(q[0],q[2],q[4],q[6]),Math.min(q[1],q[3],q[5],q[7]),Math.max(q[0],q[2],q[4],q[6]),Math.max(q[1],q[3],q[5],q[7])];
const overlaps=(a,b)=>a[0]<b[2]-.01&&a[2]>b[0]+.01&&a[1]<b[3]-.01&&a[3]>b[1]+.01;
export function openPDF(bytes,password='') {
 const doc=new mupdf.PDFDocument(bytes);
 doc.pixelsealProtected=doc.needsPassword();
 if(doc.pixelsealProtected&&!doc.authenticatePassword(password)){doc.destroy();const error=Error('This PDF needs a valid password.');error.code='PASSWORD_REQUIRED';throw error;}
 return doc;
}
export function exportPDF(bytes,marks,password='') {
 if(!marks.length)throw Error('Draw at least one redaction before exporting.');
 const source=openPDF(bytes,password), output=new mupdf.PDFDocument();
 try {
  const count=source.countPages();
  for(const m of marks){if(!Number.isInteger(m.page)||m.page<0||m.page>=count||m.rect.length!==4||!m.rect.every(Number.isFinite)||m.rect[2]<=m.rect[0]||m.rect[3]<=m.rect[1])throw Error('Invalid redaction coordinates.');}
  for(let i=0;i<count;i++){
   const page=source.loadPage(i);
   try {
    const widgets=page.getWidgets();const hasWidgets=widgets.length>0;widgets.forEach(w=>w.destroy());
    if(hasWidgets)throw Error('Interactive PDF forms are not supported in this prototype. Flatten the form before opening it.');
    const bounds=page.getBounds();const regions=marks.filter(m=>m.page===i);
    for(const m of regions){if(m.rect[0]<bounds[0]||m.rect[1]<bounds[1]||m.rect[2]>bounds[2]||m.rect[3]>bounds[3])throw Error('A redaction extends beyond the page.');const a=page.createAnnotation('Redact');a.setRect(m.rect);a.destroy();}
    // Remove text, image pixels and any line art touched by each region.
    if(regions.length)page.applyRedactions(true,2,2,0);
    const annotations=page.getAnnotations();for(const a of annotations){page.deleteAnnotation(a);a.destroy();}
    output.graftPage(-1,source,i);
    // Strip page-level auxiliary data; document-level data is never grafted.
    const obj=output.findPage(i);for(const key of ['Annots','Metadata','PieceInfo','AA','AF','PresSteps'])obj.delete(key);obj.destroy();
   } finally {page.destroy();}
  }
  const buffer=output.saveToBuffer('garbage=4,compress=yes');const data=new Uint8Array(buffer.asUint8Array());buffer.destroy();
  verifyPDF(data,marks);
  return data;
 }finally{source.destroy();output.destroy();}
}
export function verifyPDF(bytes,marks){
 const doc=openPDF(bytes);
 try{
  for(const index of new Set(marks.map(m=>m.page))){
   const page=doc.loadPage(index),regions=marks.filter(m=>m.page===index).map(m=>m.rect);
   try{
    // Check glyph outlines instead of oversized font ascent/descent boxes.
    // Ignore ActualText substitutions so they cannot hide underlying characters.
    const text=page.toStructuredText('accurate-bboxes,accurate-side-bearings,ignore-actualtext');
    try{text.walk({onChar(c,o,f,s,q){if(c.trim()&&regions.some(r=>overlaps(quadRect(q),r)))throw Error(`Verification failed: text remains in a marked area on page ${index+1} (character ${JSON.stringify(c)}).`);}});}finally{text.destroy();}
    const pix=page.toPixmap([1,0,0,1,0,0],mupdf.ColorSpace.DeviceRGB,false,false);
    try{
     const pixels=pix.getPixels(),stride=pix.getStride(),n=pix.getNumberOfComponents();
     for(const r of regions){let sampled=0;for(let y=Math.ceil(r[1])+1;y<Math.floor(r[3])-1;y++)for(let x=Math.ceil(r[0])+1;x<Math.floor(r[2])-1;x++){
      const pos=(y-pix.getY())*stride+(x-pix.getX())*n;
      if(pos<0||pos+2>=pixels.length||pixels[pos]>8||pixels[pos+1]>8||pixels[pos+2]>8)throw Error(`Verification failed: the redaction fill is incomplete on page ${index+1}.`);sampled++;
     }if(!sampled)throw Error('A redaction is too small to verify. Draw a larger box.');}
    }finally{pix.destroy();}
   }finally{page.destroy();}
  }
 }finally{doc.destroy();}
}
// MuPDF normalises whitespace and matches without case sensitivity.
export function searchPDF(doc,query,pageNumbers){
 query=query.trim();if(!query)throw Error('Enter text to search.');
 const matches=[];let limited=false;
 for(const i of pageNumbers||Array.from({length:doc.countPages()},(_,i)=>i)){
  const page=doc.loadPage(i);
  try{
   const b=page.getBounds(),text=page.toStructuredText('');
   try{
    const hits=text.search(query,'ignore-case');
    if(hits.reduce((n,h)=>n+h.length,0)>=500)limited=true;
     const neighbours=page.toStructuredText('accurate-bboxes,accurate-side-bearings');
     const glyphs=[];
     try{neighbours.walk({onChar(c,o,f,size,q){if(c.trim())glyphs.push(quadRect(q));}});}finally{neighbours.destroy();}
    for(const quads of hits){
     // Use the matched text extent, not a fixed margin that reaches into
     // neighbouring letters or punctuation. Account for glyph overhangs on
     // horizontal and rotated text before constructing the visible box.
     const rects=quads.map(q=>{
      const raw=quadRect(q);let r=[...raw];
      for(const g of glyphs){const cx=(g[0]+g[2])/2,cy=(g[1]+g[3])/2;
       if(g[1]<r[3]&&g[3]>r[1]){
        if(cx<raw[0]&&g[2]>r[0])r[0]=Math.max(r[0],g[2]+.02);
        if(cx>raw[2]&&g[0]<r[2])r[2]=Math.min(r[2],g[0]-.02);
       }
       if(g[0]<r[2]&&g[2]>r[0]){
        if(cy<raw[1]&&g[3]>r[1])r[1]=Math.max(r[1],g[3]+.02);
        if(cy>raw[3]&&g[1]<r[3])r[3]=Math.min(r[3],g[1]-.02);
       }
      }
      r=[Math.max(b[0],r[0]),Math.max(b[1],r[1]),Math.min(b[2],r[2]),Math.min(b[3],r[3])];
      if(r[2]<=r[0]||r[3]<=r[1])throw Error('A search match overlaps neighbouring glyphs ambiguously. Mark that match manually.');
      return r;
     });
     matches.push({page:i,rects,key:JSON.stringify([i,rects])});
    }
   }finally{text.destroy();}
  }finally{page.destroy();}
 }
 return {matches,limited};
}
