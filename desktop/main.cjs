'use strict';
const {app,BrowserWindow,protocol,Menu,dialog,shell,ipcMain}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {createStorage}=require('./storage.cjs');
const {configureStorage,handleApi}=require('./server.cjs');
protocol.registerSchemesAsPrivileged([{scheme:'atlas',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true,allowServiceWorkers:false}}]);
app.setPath('userData',path.join(app.getPath('appData'),'AtlasMaster'));
const gotLock=app.requestSingleInstanceLock();
let window,storage;
if(!gotLock)app.quit();
else {
  app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus()}});
  app.whenReady().then(async()=>{
    const directory=path.join(app.getPath('userData'),'data');
    try{storage=await createStorage(directory);configureStorage(storage.database,storage.bucket);}catch(error){dialog.showErrorBox('Не удалось открыть данные',`Папка кампаний сохранена: ${directory}\n${error.message}`);app.quit();return;}
    const root=path.join(__dirname,'dist-renderer');
    const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.wasm':'application/wasm','.json':'application/json','.ttf':'font/ttf','.woff2':'font/woff2','.bcmap':'application/octet-stream','.pfb':'application/octet-stream'};
    const csp="default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: http:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-src 'self' blob:";
    protocol.handle('atlas',async req=>{
      try{
        const url=new URL(req.url);
        if(url.host!=='app')return new Response('Forbidden',{status:403});
        if(url.pathname.startsWith('/api/'))return handleApi(req);
        if(req.method!=='GET'&&req.method!=='HEAD')return new Response('Method not allowed',{status:405});
        const relative=decodeURIComponent(url.pathname).replace(/^\/+/,''),file=path.resolve(root,relative||'index.html');
        if(file!==root&&!file.startsWith(root+path.sep))return new Response('Forbidden',{status:403});
        if(!fs.existsSync(file)||!fs.statSync(file).isFile())return new Response('Not found',{status:404});
        return new Response(req.method==='HEAD'?null:fs.readFileSync(file),{headers:{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Security-Policy':csp,'X-Content-Type-Options':'nosniff'}});
      }catch(error){console.error(error);return new Response('Локальный файл недоступен',{status:500});}
    });
    if(process.platform==='win32')app.setAppUserModelId('ru.atlasmaster.desktop');
    window=new BrowserWindow({title:'Атлас мастера',icon:path.join(__dirname,'icon.png'),width:1360,height:900,minWidth:850,minHeight:620,show:false,backgroundColor:'#11171e',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,spellcheck:false}});
    const session=window.webContents.session;
    session.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
    session.setPermissionCheckHandler(()=>false);
    session.on('will-download',(_event,item)=>{
      const target=dialog.showSaveDialogSync(window,{title:'Сохранить файл',defaultPath:path.join(app.getPath('documents'),path.basename(item.getFilename()))});
      if(target)item.setSavePath(target);else item.cancel();
    });
    const openExternal=url=>{try{if(['https:','http:'].includes(new URL(url).protocol))void shell.openExternal(url);}catch{}};
    window.webContents.setWindowOpenHandler(({url})=>{
      try{
        const target=new URL(url);
        if(target.protocol==='atlas:'&&target.host==='app'&&/^\/api\/assets\/[a-f0-9-]{36}$/.test(target.pathname)){
          void handleApi(new Request(url)).then(async response=>{
            if(response.ok&&response.headers.get('content-type')==='application/pdf'){
              const viewer=new BrowserWindow({title:'PDF — Атлас мастера',width:1000,height:800,parent:window,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
              viewer.setMenu(null);
              viewer.webContents.setWindowOpenHandler(()=>({action:'deny'}));
              viewer.webContents.on('will-navigate',(event,next)=>{if(next!==url){event.preventDefault();openExternal(next)}});
              await viewer.loadURL(url);
            }
          }).catch(error=>dialog.showErrorBox('Не удалось открыть PDF',error.message));
        }else openExternal(url);
      }catch{}
      return {action:'deny'};
    });
    window.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith('atlas://app/')){event.preventDefault();openExternal(url)}});
    window.webContents.on('will-prevent-unload',event=>{
      const result=dialog.showMessageBoxSync(window,{type:'warning',title:'Есть несохранённые изменения',message:'Закрыть приложение без сохранения?',detail:'Несохранённые изменения будут потеряны.',buttons:['Вернуться','Закрыть без сохранения'],defaultId:0,cancelId:0});
      if(result===1)event.preventDefault();
    });
    Menu.setApplicationMenu(null);
    window.removeMenu();
    window.setMenuBarVisibility(false);
    const preferenceFile=path.join(app.getPath('userData'),'preferences.json');
    let savedZoom=1;
    try{const value=JSON.parse(fs.readFileSync(preferenceFile,'utf8')).zoomFactor;if(Number.isFinite(value)&&value>=.7&&value<=1.8)savedZoom=value;}catch{}
    const desktopInfo=()=>({version:(require(path.join(__dirname,'package.json')).atlasVersion??require(path.join(__dirname,'package.json')).version),dataDirectory:directory,zoomFactor:window.webContents.getZoomFactor(),fullscreen:window.isFullScreen()});
    const applyZoom=value=>{
      const zoom=Math.max(.7,Math.min(1.8,Math.round(value*10)/10));
      window.webContents.setZoomFactor(zoom);
      const tmp=preferenceFile+'.tmp';
      fs.writeFileSync(tmp,JSON.stringify({zoomFactor:zoom}));fs.renameSync(tmp,preferenceFile);
    };
    ipcMain.handle('atlas:settings',async(event,action)=>{
      if(event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame)throw new Error('Недопустимый источник команды.');
      const source=new URL(event.senderFrame.url);
      if(source.protocol!=='atlas:'||source.host!=='app'||source.pathname!=='/')throw new Error('Недопустимый источник команды.');
      const editActions={'undo':'undo','redo':'redo','cut':'cut','copy':'copy','paste':'paste','select-all':'selectAll'};
      if(action==='info')return desktopInfo();
      if(action==='open-data-folder'){const error=await shell.openPath(directory);if(error)throw new Error(error);}
      else if(action==='quit')setImmediate(()=>app.quit());
      else if(Object.hasOwn(editActions,action))window.webContents[editActions[action]]();
      else if(action==='zoom-in')applyZoom(window.webContents.getZoomFactor()+.1);
      else if(action==='zoom-out')applyZoom(window.webContents.getZoomFactor()-.1);
      else if(action==='zoom-reset')applyZoom(1);
      else if(action==='fullscreen')window.setFullScreen(!window.isFullScreen());
      else throw new Error('Команда не поддерживается.');
      return desktopInfo();
    });
    window.webContents.once('did-finish-load',()=>window.webContents.setZoomFactor(savedZoom));
    window.webContents.on('before-input-event',(event,input)=>{
      if(input.type!=='keyDown')return;
      if(input.key==='F11'){event.preventDefault();window.setFullScreen(!window.isFullScreen());}
      else if(input.control&&!input.alt){
        if(['+','='].includes(input.key)){event.preventDefault();applyZoom(window.webContents.getZoomFactor()+.1);}
        else if(input.key==='-'){event.preventDefault();applyZoom(window.webContents.getZoomFactor()-.1);}
        else if(input.key==='0'){event.preventDefault();applyZoom(1);}
      }
    });
    window.once('ready-to-show',()=>window.show());
    await window.loadURL('atlas://app/');
  }).catch(error=>{dialog.showErrorBox('Ошибка запуска',error.message);app.quit()});
  app.on('window-all-closed',()=>app.quit());
  app.on('will-quit',()=>{if(storage)storage.close()});
}
