from pathlib import Path
import hashlib,json
root=Path('.')
files=['index.html','app.js','core.js','worker.js','model.js','ocr.js','ocr-model.js','search-model.js','ui-model.js','pwa.js','styles.css','manifest.webmanifest','icon.svg','favicon.svg','favicon.ico','icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png','LICENSE','vendor/mupdf.js','vendor/mupdf-wasm.js','vendor/mupdf-wasm.wasm','vendor/LICENSE']
files += [str(p) for p in sorted(Path('vendor/ocr').iterdir()) if p.is_file()]
digest=hashlib.sha256(b''.join(p.encode()+Path(p).read_bytes() for p in files)).hexdigest()[:16]
source='''const VERSION='0.5.0';
const ASSETS=__ASSETS__;
const PREFIX='pixelseal:'+new URL(self.registration.scope).pathname+':';
const CACHE=PREFIX+VERSION+':__DIGEST__';
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
'''.replace('__ASSETS__',json.dumps(files)).replace('__DIGEST__',digest)
Path('sw.js').write_text(source)
print('Offline cache:',len(files),'files,',sum(Path(p).stat().st_size for p in files),'bytes, digest',digest)
