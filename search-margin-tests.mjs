import assert from 'node:assert/strict';
import {mupdf,openPDF,searchPDF,exportPDF,verifyPDF,quadRect} from './core.js';
for(const rotation of [0,90,180,270]){
 const d=new mupdf.PDFDocument(),f=d.addSimpleFont(new mupdf.Font('Helvetica'));
 const obj=d.addPage([0,0,400,300],rotation,{Font:{F1:f}},'BT /F1 9 Tf 40 220 Td [(of) 130 ( workplace) 130 ( hazards)] TJ 0 -30 Td <74686520776f726b706c616365292e> Tj ET');d.insertPage(-1,obj);obj.destroy();
 const hits=searchPDF(d,'workplace');assert.equal(hits.matches.length,2);
 const b=d.saveToBuffer(''),bytes=new Uint8Array(b.asUint8Array());b.destroy();const marks=hits.matches.flatMap(h=>h.rects.map(rect=>({page:h.page,rect})));
 assert.throws(()=>verifyPDF(bytes,marks),/text remains/);
 const output=openPDF(exportPDF(bytes,marks)),p=output.loadPage(0),t=p.toStructuredText('');assert(!t.asText().includes('workplace'));assert(t.asText().includes('of'));assert(t.asText().includes('hazards'));t.destroy();p.destroy();output.destroy();d.destroy();
}
console.log('PASS: tightly spaced neighbouring words and punctuation remain intact after search redaction at four rotations.');
