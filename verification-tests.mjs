import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mupdf,searchPDF,exportPDF,verifyPDF,openPDF,quadRect} from './core.js';
const overlaps=(a,b)=>a[0]<b[2]-.01&&a[2]>b[0]+.01&&a[1]<b[3]-.01&&a[3]>b[1]+.01;
for(const rotation of [0,90,180,270]){
 const d=new mupdf.PDFDocument(),f=d.addSimpleFont(new mupdf.Font('Helvetica'));
 for(let i=0;i<3;i++){const p=d.addPage([0,0,400,300],rotation,{Font:{F1:f}},'BT /F1 18 Tf 40 220 Td (SECRET-1234) Tj 0 -24.5 Td (PUBLIC INFORMATION) Tj ET');d.insertPage(-1,p);p.destroy();}
 const hit=searchPDF(d,'secret-1234').matches[2],marks=hit.rects.map(rect=>({page:2,rect})),buf=d.saveToBuffer(''),input=new Uint8Array(buf.asUint8Array());buf.destroy();
 assert.throws(()=>verifyPDF(input,marks),/text remains/);
 const result=exportPDF(input,marks),out=openPDF(result),p=out.loadPage(2),normal=p.toStructuredText('');let legacyFalsePositive=false;
 normal.walk({onChar(c,o,f,s,q){if(c.trim()&&marks.some(m=>overlaps(quadRect(q),m.rect)))legacyFalsePositive=true;}});assert(legacyFalsePositive,'The fixture must reproduce the old oversized-font-box failure.');assert(!normal.asText().includes('SECRET'));assert(normal.asText().includes('PUBLIC INFORMATION'));normal.destroy();p.destroy();out.destroy();d.destroy();
 if(rotation===0){fs.writeFileSync(new URL('../../work/qa/page3-dense-input.pdf',import.meta.url),input);fs.writeFileSync(new URL('../../work/qa/page3-dense-redacted.pdf',import.meta.url),result);}
}
// Genuine residual text, including invisible text beneath a black rectangle, must fail.
for(const renderMode of [0,3]){
 const d=new mupdf.PDFDocument(),f=d.addSimpleFont(new mupdf.Font('Helvetica')),obj=d.addPage([0,0,300,300],0,{Font:{F1:f}},`BT /F1 16 Tf ${renderMode} Tr 40 220 Td (SECRET) Tj ET 0 0 0 rg 35 190 110 50 re f`);d.insertPage(-1,obj);
 const b=d.saveToBuffer(''),bytes=new Uint8Array(b.asUint8Array());b.destroy();assert.throws(()=>verifyPDF(bytes,[{page:0,rect:[35,60,145,110]}]),/text remains/);obj.destroy();d.destroy();
}
console.log('PASS: dense neighbouring lines on page 3 across four rotations; actual remaining visible and invisible text still rejected.');
