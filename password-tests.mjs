import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mupdf,openPDF,searchPDF,exportPDF} from './core.js';
const source=new mupdf.PDFDocument(),font=source.addSimpleFont(new mupdf.Font('Helvetica'));
const page=source.addPage([0,0,400,300],0,{Font:{F1:font}},'BT /F1 18 Tf 40 220 Td (SECRET PASSWORD TEST) Tj 0 -70 Td (PUBLIC INFORMATION) Tj ET');source.insertPage(-1,page);page.destroy();
for(const encryption of ['rc4-128','aes-128','aes-256']){
 const buffer=source.saveToBuffer(`encrypt=${encryption},user-password=reader,owner-password=owner`),bytes=new Uint8Array(buffer.asUint8Array());buffer.destroy();
 assert.throws(()=>openPDF(bytes),e=>e.code==='PASSWORD_REQUIRED');assert.throws(()=>openPDF(bytes,'wrong'),e=>e.code==='PASSWORD_REQUIRED');
 for(const password of ['reader','owner']){const doc=openPDF(bytes,password);assert.equal(doc.countPages(),1);const found=searchPDF(doc,'SECRET PASSWORD TEST');assert.equal(found.matches.length,1);assert.equal(doc.pixelsealProtected,true);doc.destroy();const output=exportPDF(bytes,found.matches.flatMap(m=>m.rects.map(rect=>({page:m.page,rect}))),password),verified=openPDF(output);assert.equal(verified.needsPassword(),false);assert.equal(searchPDF(verified,'SECRET').matches.length,0);assert.equal(searchPDF(verified,'PUBLIC INFORMATION').matches.length,1);verified.destroy();}
 fs.mkdirSync('work/qa',{recursive:true});fs.writeFileSync(`work/qa/protected-${encryption}.pdf`,bytes);
}
source.destroy();console.log('PASS: encrypted RC4/AES PDFs, wrong/missing passwords, user/owner unlock and verified unencrypted redaction output.');
