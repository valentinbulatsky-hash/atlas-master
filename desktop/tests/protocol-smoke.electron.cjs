// Run in Electron: electron --no-sandbox --ozone-platform=headless tests/protocol-smoke.electron.cjs
const {app,Menu}=require('electron');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-protocol-'));
app.setPath('appData',directory);
const timer=setTimeout(()=>{console.error('Electron smoke timeout');app.exit(1)},30000);
app.on('browser-window-created',(_event,window)=>{
  window.webContents.on('console-message',(_event,...args)=>console.log('renderer',...args));
  window.webContents.once('did-finish-load',async()=>{
    try{
      if(Menu.getApplicationMenu()!==null||window.isMenuBarVisible())throw new Error('Native menu is still visible');
      const result=await window.webContents.executeJavaScript(`(async()=>{
        const response=await fetch('/api/entities');
        const list=await response.json();if(!response.ok||!Array.isArray(list.entities))throw new Error('Local fetch failed');
        const created=await fetch('/api/entities',{method:'POST',headers:{'Content-Type':'application/json','X-Atlas-Request':'1'},body:JSON.stringify({kind:'campaign',title:'Проверка Electron',summary:'',payload:{},campaignId:null,folderId:null})});
        if(!created.ok)throw new Error('Local POST failed');
        const form=new FormData();form.set('kind','pdf');form.set('file',new File(['%PDF-1.7\\nprotocol fixture\\n%%EOF'],'sheet.pdf',{type:'application/pdf'}));
        const uploaded=await fetch('/api/assets',{method:'POST',headers:{'X-Atlas-Request':'1'},body:form});const asset=await uploaded.json();if(!uploaded.ok)throw new Error('Multipart upload failed');
        const bytes=await fetch(asset.url);if((await bytes.text()).slice(0,5)!=='%PDF-')throw new Error('Attachment fetch failed');
        await new Promise(r=>setTimeout(r,500));
        if(!document.body.textContent.includes('Новая кампания'))throw new Error('Interface not rendered');
        const wait=async check=>{for(let n=0;n<80;n++){if(check())return;await new Promise(r=>setTimeout(r,100))}throw new Error('UI wait timeout')};
        if(!window.atlasDesktop)throw new Error('Desktop settings bridge missing');
        const info=await window.atlasDesktop.execute('info');if(info.version!=='0.1.1')throw new Error('Unexpected version');
        const buttons=[...document.querySelectorAll('button')];
        const enter=buttons.find(b=>b.textContent.includes('Открыть последнюю кампанию'))??buttons.find(b=>b.textContent.includes('Попробовать'));
        if(!enter)throw new Error('Campaign entry missing');enter.click();
        await wait(()=>document.querySelector('[data-slot="sidebar-container"]'));
        const panel=document.querySelector('[data-slot="sidebar-container"]');
        if(getComputedStyle(panel).position!=='fixed'||Math.abs(panel.getBoundingClientRect().left)>2)throw new Error('Sidebar is not fixed on the left');
        if(getComputedStyle(document.querySelector('[data-slot="sidebar-wrapper"]')).display!=='flex')throw new Error('Sidebar flex layout missing');
        document.querySelector('[data-sidebar="trigger"]').click();
        await wait(()=>panel.getBoundingClientRect().right<=1);
        document.querySelector('[data-sidebar="trigger"]').click();await wait(()=>Math.abs(panel.getBoundingClientRect().left)<2);
        [...document.querySelectorAll('button')].find(b=>b.textContent.includes('Настройки приложения')).click();
        await wait(()=>document.querySelector('[data-atlas-settings]'));
        if(document.querySelector('[data-atlas-settings]').getBoundingClientRect().width<500)throw new Error('Settings layout too narrow');
        const theme=document.documentElement.getAttribute('data-theme');document.querySelector('[data-atlas-settings] [role="switch"]').click();
        await wait(()=>document.documentElement.getAttribute('data-theme')!==theme);
        return {origin:location.origin,secure:isSecureContext,subtle:!!crypto.subtle,title:document.title,api:true,upload:true,sidebar:true,settings:true,theme:true};
      })()`);
      console.log('ELECTRON_PROTOCOL_SMOKE',JSON.stringify(result));clearTimeout(timer);app.exit(0);
    }catch(error){console.error(error);clearTimeout(timer);app.exit(1)}
  });
});
require('../main.cjs');
