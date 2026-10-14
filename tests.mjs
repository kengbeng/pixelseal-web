import assert from 'node:assert/strict';
import {mupdf,openPDF,exportPDF,verifyPDF,quadRect} from './core.js';
import fs from 'node:fs';
const qa=new URL('./work/qa/',import.meta.url);
const source=new mupdf.PDFDocument(),font=source.addSimpleFont(new mupdf.Font('Helvetica'));
for(const rotation of [0,90,180,270]){const p=source.addPage([0,0,400,300],rotation,{Font:{F1:font}},'BT /F1 18 Tf 40 220 Td (SECRET-1234) Tj 0 -70 Td (PUBLIC INFORMATION) Tj ET');source.insertPage(-1,p);p.destroy();}
source.setMetaData('info:Title','SECRET-1234');const ef=source.addEmbeddedFile('secret.txt','text/plain','SECRET-1234',new Date(),new Date(),false);source.insertEmbeddedFile('secret.txt',ef);ef.destroy();
const buf=source.saveToBuffer(''),original=new Uint8Array(buf.asUint8Array());buf.destroy();const marks=[];
for(let i=0;i<4;i++){const p=source.loadPage(i),t=p.toStructuredText(''),boxes=t.search('SECRET-1234',{}).flat().map(quadRect);marks.push({page:i,rect:[Math.min(...boxes.map(b=>b[0]))-3,Math.min(...boxes.map(b=>b[1]))-3,Math.max(...boxes.map(b=>b[2]))+3,Math.max(...boxes.map(b=>b[3]))+3]});t.destroy();p.destroy();}
assert.throws(()=>verifyPDF(original,marks),/text remains/);assert.throws(()=>exportPDF(original,[]),/at least one/);
const result=exportPDF(original,marks),out=openPDF(result);assert.equal(out.countPages(),4);
for(let i=0;i<4;i++){const p=out.loadPage(i),t=p.toStructuredText('');assert(!t.asText().includes('SECRET'));assert(t.asText().includes('PUBLIC INFORMATION'));t.destroy();assert.equal(p.getAnnotations().length,0);p.destroy();}
assert.equal(Object.keys(out.getEmbeddedFiles()).length,0);assert(!out.getMetaData('info:Title')?.includes('SECRET'));
fs.mkdirSync(qa,{recursive:true});fs.writeFileSync(new URL('input.pdf',qa),original);fs.writeFileSync(new URL('redacted.pdf',qa),result);
const p=out.loadPage(0),pix=p.toPixmap([1,0,0,1,0,0],mupdf.ColorSpace.DeviceRGB,false);fs.writeFileSync(new URL('redacted.png',qa),pix.asPNG());pix.destroy();p.destroy();
assert.throws(()=>exportPDF(original,[{page:99,rect:[1,2,3,4]}]),/Invalid/);out.destroy();source.destroy();console.log('PASS: text removal, public text retention, four rotations, black-fill verification, metadata/attachment removal, invalid input rejection.');
// Confirm redaction changes the embedded image data, rather than covering it alone.
const imageDoc=new mupdf.PDFDocument(),imagePix=new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB,[0,0,100,100],false);
const colors=imagePix.getPixels();for(let i=0;i<colors.length;i+=3){colors[i]=255;colors[i+1]=0;colors[i+2]=0;}
const im=new mupdf.Image(imagePix),imageRef=imageDoc.addImage(im),imagePage=imageDoc.addPage([0,0,200,200],0,{XObject:{I:imageRef}},'q 200 0 0 200 0 0 cm /I Do Q');imageDoc.insertPage(-1,imagePage);
const annotation=imageDoc.loadPage(0).createAnnotation('Text');annotation.setRect([150,150,170,170]);annotation.setContents('PRIVATE COMMENT');annotation.destroy();
let imageBuffer=imageDoc.saveToBuffer(''),imageBytes=new Uint8Array(imageBuffer.asUint8Array());imageBuffer.destroy();
const imageOutput=openPDF(exportPDF(imageBytes,[{page:0,rect:[60,60,140,140]}]));let checkedImages=0;
const resource=imageOutput.findPage(0).get('Resources','XObject');resource.forEach(value=>{if(value.get('Subtype').asName()==='Image'){let loaded=imageOutput.loadImage(value),pix=loaded.toPixmap(),channels=pix.getNumberOfComponents(),center=50*pix.getStride()+50*channels,pixels=pix.getPixels();assert(!(pixels[center]===255&&pixels[center+1]===0&&pixels[center+2]===0),'Sensitive source image pixels survived');pix.destroy();loaded.destroy();checkedImages++;}});assert(checkedImages>0);assert.equal(imageOutput.loadPage(0).getAnnotations().length,0);
imageOutput.destroy();imagePage.destroy();imageRef.destroy();im.destroy();imagePix.destroy();imageDoc.destroy();console.log('PASS: embedded image pixels changed and private comments removed.');
