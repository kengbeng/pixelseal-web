import Tesseract from './vendor/ocr/tesseract.esm.min.js';
const {createWorker}=Tesseract;
import {wordsFromBlocks} from './ocr-model.js?v=0.3.1';
export class OCRController {
 constructor(){this.pages=new Map();this.run=null;}
 reset(){this.cancel();this.pages.clear();}
 cancel(){if(this.run){this.run.cancelled=true;this.run.reject(Error('OCR cancelled. Completed pages remain searchable.'));this.run.worker?.terminate().catch(()=>{});}}
 async scan(pageNumbers,render,onProgress,language='eng'){
  if(this.run)throw Error('OCR is already running.');
  let reject;const cancelled=new Promise((_,r)=>reject=r),token={cancelled:false,reject,worker:null};this.run=token;
  const directory=new URL('./vendor/ocr/',import.meta.url).href;
  const creation=createWorker(language,1,{workerPath:directory+'worker.min.js',corePath:directory,langPath:directory.replace(/\/$/,''),workerBlobURL:false,cacheMethod:'none',gzip:true,logger:m=>onProgress({status:m.status,progress:m.progress||0,page:token.page,completed:token.completed||0,total:pageNumbers.length})});
  creation.then(w=>{token.worker=w;if(token.cancelled)w.terminate().catch(()=>{});}).catch(()=>{});
  try{
   const engine=await Promise.race([creation,cancelled]);
   for(let i=0;i<pageNumbers.length;i++){
    token.page=pageNumbers[i];token.completed=i;onProgress({status:'rendering page',progress:0,page:token.page,completed:i,total:pageNumbers.length});
    const raster=await Promise.race([render(token.page),cancelled]);
    const result=await Promise.race([engine.recognize(new Blob([raster.png],{type:'image/png'}),{rotateAuto:false},{text:true,blocks:true}),cancelled]);
    if(token.cancelled)throw Error('OCR cancelled.');
    const words=wordsFromBlocks(result.data.blocks,raster);this.pages.set(token.page,words);token.completed=i+1;onProgress({status:'page complete',progress:1,page:token.page,completed:i+1,total:pageNumbers.length});
   }
   return {pages:pageNumbers.length,words:pageNumbers.reduce((n,page)=>n+(this.pages.get(page)?.length||0),0)};
  }finally{await token.worker?.terminate().catch(()=>{});if(this.run===token)this.run=null;}
 }
}
