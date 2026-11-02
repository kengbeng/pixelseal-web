import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('./pwa.js',import.meta.url),'utf8');
async function setup({standalone=false,safari=false,waiting=false,fullscreen=false}={}){
 const nodes=Object.fromEntries(['offline-state','install','updateapp'].map(id=>[id,{hidden:id==='updateapp',disabled:true,textContent:'',classList:{toggle(){}}}])),events={},swEvents={},messages=[];
 const worker={postMessage:m=>messages.push(m)},reg={waiting:waiting?worker:null,active:worker,addEventListener(){},update:async()=>{}};
 const context=vm.createContext({URL,Date,location:{href:'https://example.org/pixelseal/',reload(){}},confirm:()=>true,matchMedia:q=>({matches:q.includes('standalone')?standalone:fullscreen,addEventListener(){}}),navigator:{standalone:safari,onLine:true,serviceWorker:{register:async()=>reg,ready:Promise.resolve(reg),addEventListener:(name,f)=>swEvents[name]=f}},window:{addEventListener:(name,f)=>events[name]=f},document:{body:{dataset:{documentOpen:'false'}},getElementById:id=>nodes[id],addEventListener(){}}});
 vm.runInContext(source,context);await new Promise(r=>setTimeout(r,0));
 const ready=()=>swEvents.message({data:{type:'OFFLINE_READY'}});
 return {nodes,events,ready,messages};
}
for(const mode of [{standalone:true},{safari:true},{fullscreen:true}]){const s=await setup(mode);s.ready();assert.equal(s.nodes.install.textContent,'Installed');assert.equal(s.nodes.install.disabled,true);assert.equal(s.nodes.install.hidden,false);assert.equal(s.nodes.updateapp.hidden,true);}
const update=await setup({standalone:true,waiting:true});update.ready();assert.equal(update.nodes.install.hidden,true);assert.equal(update.nodes.updateapp.hidden,false);update.nodes.updateapp.onclick();assert.equal(update.messages.at(-1).type,'ACTIVATE_UPDATE');
const normal=await setup();normal.ready();assert.equal(normal.nodes.install.textContent,'Install app');assert.equal(normal.nodes.install.disabled,false);normal.events.appinstalled();normal.ready();assert.equal(normal.nodes.install.textContent,'Installed');assert.equal(normal.nodes.install.disabled,true);
console.log('PASS: standalone/Safari/fullscreen Installed status, offline-ready does not re-enable installation, waiting update replaces status, normal tab install flow and appinstalled event.');
