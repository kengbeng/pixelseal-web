import assert from 'node:assert/strict';
import fs from 'node:fs';
import {History,moveRect,resizeRect} from './model.js';
import {mupdf,openPDF,searchPDF,exportPDF} from './core.js';
const bytes=fs.readFileSync(new URL('../../work/qa/input.pdf',import.meta.url)),doc=openPDF(bytes);
const hits=searchPDF(doc,'secret-1234');assert.equal(hits.matches.length,4);assert.equal(hits.limited,false);assert.deepEqual(hits.matches.map(h=>h.page),[0,1,2,3]);
assert.equal(searchPDF(doc,'not-present').matches.length,0);assert.throws(()=>searchPDF(doc,'  '),/Enter text/);
const marks=hits.matches.flatMap(h=>h.rects.map(rect=>({page:h.page,rect}))),out=openPDF(exportPDF(bytes,marks));
for(let i=0;i<4;i++){const p=out.loadPage(i),t=p.toStructuredText('');assert(!t.asText().includes('SECRET'));assert(t.asText().includes('PUBLIC INFORMATION'));t.destroy();p.destroy();}out.destroy();doc.destroy();
const h=new History(),initial=[{page:0,rect:[10,10,30,30]}];h.commit(initial);initial[0].rect[0]=999;assert.equal(h.value[0].rect[0],10);
h.commit([{page:0,rect:[20,20,40,40]}]);h.commit([]);h.undo();assert.equal(h.value[0].rect[0],20);h.undo();assert.equal(h.value[0].rect[0],10);h.undo();assert.equal(h.value.length,0);h.redo();h.redo();assert.equal(h.value[0].rect[0],20);h.undo();h.commit([{page:0,rect:[15,15,35,35]}]);assert.equal(h.redo(),false);h.reset();assert.equal(h.undo(),false);
assert.deepEqual(moveRect([10,10,30,30],-100,100,[0,0,50,50]),[0,30,20,50]);assert.deepEqual(resizeRect([10,10,30,30],'nw',[100,-10],[0,0,50,50]),[25,0,30,30]);assert.deepEqual(resizeRect([10,10,30,30],'se',[100,100],[0,0,50,50]),[10,10,50,50]);
console.log('PASS: search on four rotations, case-insensitive matching, search-to-export, empty/no-match search, edit/clear undo-redo, branching history, clamped movement and minimum-size resize.');

const large=new mupdf.PDFDocument(),font=large.addSimpleFont(new mupdf.Font('Helvetica'));let content='BT /F1 7 Tf 20 5900 Td ';for(let i=0;i<520;i++)content+='(TOKEN) Tj 0 -10 Td ';content+='ET';let lp=large.addPage([0,0,200,6000],0,{Font:{F1:font}},content);large.insertPage(-1,lp);assert.equal(searchPDF(large,'token').limited,true);lp.destroy();large.destroy();
const multi=new mupdf.PDFDocument(),mf=multi.addSimpleFont(new mupdf.Font('Helvetica')),mp=multi.addPage([0,0,300,300],0,{Font:{F1:mf}},'BT /F1 14 Tf 20 240 Td (ALPHA) Tj 0 -20 Td (BETA) Tj ET');multi.insertPage(-1,mp);const mh=searchPDF(multi,'alpha beta');assert.equal(mh.matches.length,1);assert.equal(mh.matches[0].rects.length,2);mp.destroy();multi.destroy();console.log('PASS: search limit disclosure and a multiline phrase with separate redaction boxes.');
