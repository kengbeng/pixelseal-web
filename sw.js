const VERSION='0.5.2';
const ASSETS=["help.html", "help.css", "help.js", "index.html", "app.js", "core.js", "worker.js", "model.js", "ocr.js", "ocr-model.js", "search-model.js", "ui-model.js", "pwa.js", "styles.css", "manifest.webmanifest", "icon.svg", "favicon.svg", "favicon.ico", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "LICENSE", "vendor/mupdf.js", "vendor/mupdf-wasm.js", "vendor/mupdf-wasm.wasm", "vendor/LICENSE", "vendor/ocr/README.md", "vendor/ocr/TESSDATA-LICENSE", "vendor/ocr/TESSERACT-CORE-LICENSE", "vendor/ocr/TESSERACT-JS-LICENSE", "vendor/ocr/chi_sim.traineddata.gz", "vendor/ocr/eng.traineddata.gz", "vendor/ocr/tesseract-core-lstm.wasm.js", "vendor/ocr/tesseract-core-relaxedsimd-lstm.wasm.js", "vendor/ocr/tesseract-core-relaxedsimd.wasm.js", "vendor/ocr/tesseract-core-simd-lstm.wasm.js", "vendor/ocr/tesseract-core-simd.wasm.js", "vendor/ocr/tesseract-core.wasm.js", "vendor/ocr/tesseract.esm.min.js", "vendor/ocr/tesseract.min.js.LICENSE.txt", "vendor/ocr/worker.min.js", "vendor/ocr/worker.min.js.LICENSE.txt"];
const PREFIX='pixelseal:'+new URL(self.registration.scope).pathname+':';
const CACHE=PREFIX+VERSION+':c5723510d46a234d';
const urlFor=path=>new URL(path,self.registration.scope).href;
const allowed=new Set(ASSETS.map(urlFor));
async function announce(data){for(const client of await self.clients.matchAll({includeUncontrolled:true}))client.postMessage(data);}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);let done=0;
 try{for(const path of ASSETS){const url=urlFor(path),response=await fetch(url,{cache:'reload'});if(!response.ok)throw Error('Offline asset unavailable: '+path);await cache.put(url,response);await announce({type:'OFFLINE_PROGRESS',done:++done,total:ASSETS.length});}}
 catch(e){await caches.delete(CACHE);throw e;}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);
 await self.clients.claim();await announce({type:'OFFLINE_READY',version:VERSION});
})()));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();if(event.data?.type==='CACHE_STATUS')event.waitUntil((async()=>{const cache=await caches.open(CACHE);const complete=(await Promise.all(ASSETS.map(url=>cache.match(urlFor(url))))).every(Boolean);event.source?.postMessage({type:complete?'OFFLINE_READY':'OFFLINE_INCOMPLETE',version:VERSION});})());});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;const url=new URL(event.request.url),scope=new URL(self.registration.scope);if(url.origin!==scope.origin)return;
 let canonical=url.origin+url.pathname;if(url.pathname===scope.pathname)canonical=urlFor('index.html');if(!allowed.has(canonical))return;
 event.respondWith((async()=>{const cached=await (await caches.open(CACHE)).match(canonical);return cached||fetch(event.request);})());
});
