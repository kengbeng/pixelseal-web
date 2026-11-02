import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {singlePDF,hasPDFHeader,isFileDrag} from './file-input.js';
// Exercise the actual import and drag handlers with a minimal event/DOM adapter.
const source=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');
const elements=new Map(),events=new Map(),opened=[],notices=[];
const element=id=>{if(!elements.has(id))elements.set(id,{hidden:true,textContent:'',value:'',classList:{toggle(){}},files:[]});return elements.get(id);};
const state={busy:false,scanning:false,marks:[],count:0,dialog:false,answer:true};
const context=vm.createContext({singlePDF,hasPDFHeader,isFileDrag,$:element,confirm:()=>state.answer,openFile:async f=>opened.push(f.name),document:{querySelector:()=>state.dialog?{}:null,addEventListener:(name,handler)=>events.set(name,handler)},window:{addEventListener(){}},...state});
vm.runInContext(source.slice(source.indexOf('let openingFile=false'))+'\nthis.acceptFiles=acceptFiles;',context);
const file=(name='sample.pdf',text='%PDF-1.7\n')=>({name,type:'application/pdf',size:text.length,slice:()=>({arrayBuffer:async()=>new TextEncoder().encode(text).buffer})});
await context.acceptFiles([file()]);assert.deepEqual(opened,['sample.pdf']);
context.marks=[{page:0,rect:[1,1,20,20]}];state.answer=false;
await context.acceptFiles([file('replacement.pdf')]);assert.equal(opened.length,1);assert.equal(context.marks.length,1);
state.answer=true;await context.acceptFiles([file('replacement.pdf')]);assert.equal(opened.at(-1),'replacement.pdf');
for(const [key,value]of [['busy',true],['scanning',true]]){context[key]=value;await context.acceptFiles([file()]);assert.equal(opened.length,2);context[key]=false;}
state.dialog=true;await context.acceptFiles([file()]);assert.equal(opened.length,2);state.dialog=false;
await context.acceptFiles([file('bad.pdf','not a PDF')]);assert.equal(opened.length,2);assert.match(element('importnotice').textContent,/PDF header/);
await context.acceptFiles([file(),file()]);assert.equal(opened.length,2);assert.match(element('importnotice').textContent,/one PDF/);
let prevented=0;const transfer={types:['Files'],files:[file('dropped.pdf')]};
events.get('dragenter')({dataTransfer:transfer,preventDefault(){prevented++;}});assert.equal(element('dropzone').hidden,false);
events.get('dragover')({dataTransfer:transfer,preventDefault(){prevented++;}});assert.equal(transfer.dropEffect,'copy');
events.get('drop')({dataTransfer:transfer,preventDefault(){prevented++;}});await new Promise(resolve=>setTimeout(resolve,0));assert.equal(opened.at(-1),'dropped.pdf');assert.equal(element('dropzone').hidden,true);assert.equal(prevented,3);
const before=opened.length;context.busy=true;
events.get('dragover')({dataTransfer:transfer,preventDefault(){}});assert.equal(transfer.dropEffect,'none');
events.get('drop')({dataTransfer:transfer,preventDefault(){}});await new Promise(resolve=>setTimeout(resolve,0));assert.equal(opened.length,before);assert.equal(element('dropzone').hidden,true);context.busy=false;
events.get('dragenter')({dataTransfer:{types:['text/plain']},preventDefault(){throw Error('Non-file drag intercepted');}});assert.equal(element('dropzone').hidden,true);
console.log('PASS: actual drop/import handlers, replacement cancel/confirm, busy/scan/dialog guards, invalid-file preservation, drop feedback, navigation prevention and non-file drag passthrough.');
