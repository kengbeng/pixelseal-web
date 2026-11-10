const label=document.getElementById('offline-state'),install=document.getElementById('install');
const dialog=document.getElementById('appstatusdialog'),info=document.getElementById('appstatusinfo'),check=document.getElementById('checkupdates');
const appMode=matchMedia('(display-mode: standalone)'),fullscreenMode=matchMedia('(display-mode: fullscreen)');
const watchedWorkers=new WeakSet();
let installed=appMode.matches||fullscreenMode.matches||navigator.standalone===true,prompt,ready=false,registration,waiting,downloading=false,activating=false,checking=false,lastUpdateCheck=0,activationTimer;
function message(text){info.textContent=text;}
function render(){
 const state=downloading||activating?'updating':waiting?'update':installed?'installed':'install';
 install.textContent={install:'Install',installed:'Installed',update:'Update',updating:'Updating…'}[state];install.dataset.state=state;
 install.disabled=state==='updating'||(!ready&&!installed&&!waiting);install.setAttribute('aria-busy',String(state==='updating'));install.setAttribute('aria-haspopup',state==='installed'||state==='install'&&!prompt?'dialog':'false');
 install.classList.toggle('installed-status',state==='installed');check.disabled=checking||downloading||activating||!!waiting||!registration;
}
function offerUpdate(worker){waiting=worker||undefined;downloading=false;if(waiting)message('An update is ready. Close this window and select Update to load it.');render();}
function watchWorker(worker){
 if(!worker||watchedWorkers.has(worker))return;watchedWorkers.add(worker);downloading=!!navigator.serviceWorker.controller;render();
 worker.addEventListener('statechange',()=>{
  if(worker.state==='installed'){if(navigator.serviceWorker.controller)offerUpdate(registration.waiting||worker);else{downloading=false;render();}}
  if(worker.state==='redundant'){downloading=false;message('The update could not finish. Check your connection and try again.');if(!ready)label.textContent='Offline setup failed. Reopen while online to retry.';render();}
 });
}
async function checkForUpdates(manual=false){
 if(checking||downloading||activating)return;
 if(!registration){if(manual)message('Update checking is not available yet. Please try again shortly.');return;}
 if(!navigator.onLine){if(manual)message('You are offline. Connect to the internet, then check again.');return;}
 checking=true;lastUpdateCheck=Date.now();if(manual)message('Checking for updates…');render();
 try{await registration.update();if(registration.waiting)offerUpdate(registration.waiting);else if(registration.installing){watchWorker(registration.installing);if(manual)message('Downloading the update. The button will show Update when it is ready.');}else if(manual)message('PixelSeal is up to date.');}
 catch{if(manual)message('Could not check for updates. Check your connection and try again.');}
 finally{checking=false;render();}
}
function activateUpdate(){
 if(!waiting||activating)return;
 if(document.body.dataset.documentOpen==='true'&&!confirm('Reload to update PixelSeal? The current PDF, OCR results and redaction marks will be cleared.'))return;
 const worker=waiting;activating=true;render();
 const changed=()=>{clearTimeout(activationTimer);location.reload();};
 navigator.serviceWorker.addEventListener('controllerchange',changed,{once:true});
 activationTimer=setTimeout(()=>{navigator.serviceWorker.removeEventListener('controllerchange',changed);activating=false;message('The update could not activate. Please try Update again.');render();},15000);
 worker.postMessage({type:'ACTIVATE_UPDATE'});
}
function openStatus(){
 document.getElementById('appstatustitle').textContent=installed?'PixelSeal is installed':'Install PixelSeal';
 document.getElementById('appstatusversion').textContent=`Version ${document.documentElement.dataset.version}`;
 document.getElementById('installinstructions').hidden=installed;
 message(waiting?'An update is ready. Close this window and select Update to load it.':ready?'Ready for offline use. Select Check for updates to look for a newer version.':'Offline files are still being prepared.');
 render();dialog.showModal();
}
install.onclick=async()=>{
 if(waiting){activateUpdate();return;}if(downloading||activating)return;
 if(!installed&&prompt){await prompt.prompt();const result=await prompt.userChoice;prompt=null;if(result.outcome==='accepted')installed=true;render();return;}
 openStatus();
};
check.onclick=()=>checkForUpdates(true);document.getElementById('closeappstatus').onclick=()=>dialog.close();
for(const mode of [appMode,fullscreenMode])mode.addEventListener('change',()=>{installed=appMode.matches||fullscreenMode.matches||navigator.standalone===true;render();});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();prompt=e;render();});
window.addEventListener('appinstalled',()=>{installed=true;prompt=null;render();});
render();
if(new URL(location.href).searchParams.has('dev')){label.textContent='Local preview';install.hidden=true;}
else if('serviceWorker' in navigator){
 navigator.serviceWorker.addEventListener('message',({data})=>{if(data.type==='OFFLINE_PROGRESS')label.textContent=`Preparing offline: ${data.done}/${data.total} files`;if(data.type==='OFFLINE_READY'){ready=true;label.textContent='Ready offline · English / Chinese OCR included';render();}});
 navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(async reg=>{registration=reg;if(reg.waiting)offerUpdate(reg.waiting);reg.addEventListener('updatefound',()=>watchWorker(reg.installing));if(reg.installing)watchWorker(reg.installing);render();await navigator.serviceWorker.ready;reg.active?.postMessage({type:'CACHE_STATUS'});}).catch(()=>{label.textContent='Offline setup unavailable. Use HTTPS or localhost.';message('Offline setup is unavailable. Reopen PixelSeal over HTTPS.');render();});
}else{label.textContent='This browser does not support offline installation.';install.hidden=true;}
// Returning to the app checks quietly; manual checks provide feedback in the popup.
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-lastUpdateCheck>60000)checkForUpdates();});
