const dialog=document.getElementById('helpdialog'),content=document.getElementById('helpcontent');
let guideLoaded=false,guideLoading,returnFocus;
async function openHelp(section='help-start',trigger){
 returnFocus=trigger;
 if(!dialog.open)dialog.showModal();
 document.getElementById('closehelp').focus();
 try{
  if(!guideLoaded){
   if(!guideLoading)guideLoading=fetch('./help.html').then(response=>{if(!response.ok)throw Error('Guide unavailable');return response.text();}).then(html=>{const guide=new DOMParser().parseFromString(html,'text/html').getElementById('guidebody');if(!guide)throw Error('Guide unavailable');content.replaceChildren(document.importNode(guide,true));guideLoaded=true;}).finally(()=>{guideLoading=null;});
   await guideLoading;
  }
  if(!dialog.open)return;
  const heading=document.getElementById(section)||document.getElementById('help-start');heading.scrollIntoView({block:'start'});heading.focus({preventScroll:true});
 }catch{
  content.replaceChildren();const message=document.createElement('p');message.className='help-error';message.textContent='The guide could not load. Close Help and try again, or open the printable guide in a new tab. Reconnect and update the app if offline files are incomplete.';message.setAttribute('role','alert');content.append(message);
 }
}
if(dialog){
 document.addEventListener('click',event=>{const button=event.target.closest('[data-help]');if(button)openHelp(button.dataset.help||'help-start',button);const anchor=event.target.closest('#helpcontent a[href^="#help-"]');if(anchor){event.preventDefault();const heading=document.getElementById(anchor.hash.slice(1));if(heading){heading.scrollIntoView({block:'start'});heading.focus({preventScroll:true});}}});
 document.getElementById('closehelp').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});});
}
const print=document.getElementById('printguide');if(print)print.onclick=()=>window.print();
