const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {EventEmitter}=require('node:events');

test('production stylesheet includes responsive sidebar, collapse and hidden-label rules',()=>{
  const directory=path.join(__dirname,'../dist-renderer/assets');
  const file=fs.readdirSync(directory).find(name=>/^index-.*\.css$/.test(name));
  const css=fs.readFileSync(path.join(directory,file),'utf8');
  for(const selector of ['.flex{','.fixed{','.sr-only{','.md\\:flex','.md\\:block','collapsible','offcanvas','.app-settings','.settings-layout'])assert.ok(css.includes(selector),'Missing generated CSS: '+selector);
  assert.match(css,/left:calc\([^;}]*--sidebar-width[^;}]*\)/,'Missing leftward collapse offset');
});

test('desktop settings remove native menu, restrict callers and preserve scale preferences',async()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-settings-'));
  const app=new EventEmitter(),paths={appData:temp,documents:temp};let main,handler,opened,quits=0,applicationMenu='initial';
  Object.assign(app,{setPath:(key,value)=>paths[key]=value,getPath:key=>paths[key],getVersion:()=>(require('../package.json').atlasVersion??require('../package.json').version),requestSingleInstanceLock:()=>true,whenReady:()=>Promise.resolve(),setAppUserModelId:()=>{},quit:()=>quits++});
  class Window extends EventEmitter{
    constructor(options){super();main=this;this.options=options;this.fullscreen=false;this.contents=[];this.webContents=new EventEmitter();const frame={url:'atlas://app/'};this.webContents.mainFrame=frame;this.zoom=1;
      Object.assign(this.webContents,{session:Object.assign(new EventEmitter(),{setPermissionRequestHandler:()=>{},setPermissionCheckHandler:()=>{}}),getZoomFactor:()=>this.zoom,setZoomFactor:value=>this.zoom=value,setWindowOpenHandler:()=>{}});
      for(const command of ['undo','redo','cut','copy','paste','selectAll'])this.webContents[command]=()=>this.contents.push(command);
    }
    removeMenu(){this.menuRemoved=true}setMenuBarVisibility(value){this.menuVisible=value}isFullScreen(){return this.fullscreen}setFullScreen(value){this.fullscreen=value}show(){}focus(){}isMinimized(){return false}
    async loadURL(url){this.webContents.mainFrame.url=url;this.webContents.emit('did-finish-load')}
  }
  const electron={app,BrowserWindow:Window,Menu:{setApplicationMenu:value=>applicationMenu=value},protocol:{registerSchemesAsPrivileged:()=>{},handle:()=>{}},ipcMain:{handle:(channel,value)=>{assert.equal(channel,'atlas:settings');handler=value}},shell:{openPath:async value=>{opened=value;return ''},openExternal:()=>{}},dialog:{showErrorBox:(_title,message)=>{throw new Error(message)},showSaveDialogSync:()=>null}};
  const source=fs.readFileSync(path.join(__dirname,'../main.cjs'),'utf8');
  const context={__dirname:path.join(__dirname,'..'),process:{platform:'win32'},console,URL,Response,Request,setImmediate,require:name=>{
    if(name==='electron')return electron;
    if(name==='./storage.cjs')return {createStorage:async directory=>{fs.mkdirSync(directory,{recursive:true});return {database:{},bucket:{},close(){}}}};
    if(name==='./server.cjs')return {configureStorage(){},handleApi(){}};
    return require(name);
  }};
  try{
    vm.runInNewContext(source,context);await new Promise(resolve=>setImmediate(resolve));
    assert.equal(applicationMenu,null);assert.equal(main.menuRemoved,true);assert.equal(main.menuVisible,false);
    assert.equal(main.options.webPreferences.nodeIntegration,false);assert.equal(main.options.webPreferences.contextIsolation,true);assert.ok(main.options.webPreferences.preload.endsWith('preload.cjs'));
    const event={sender:main.webContents,senderFrame:main.webContents.mainFrame};
    assert.equal((await handler(event,'info')).version,(require('../package.json').atlasVersion??require('../package.json').version));
    assert.equal((await handler(event,'zoom-in')).zoomFactor,1.1);
    assert.equal(JSON.parse(fs.readFileSync(path.join(paths.userData,'preferences.json'),'utf8')).zoomFactor,1.1);
    assert.equal((await handler(event,'zoom-reset')).zoomFactor,1);
    assert.equal((await handler(event,'fullscreen')).fullscreen,true);
    await handler(event,'open-data-folder');assert.equal(opened,path.join(paths.userData,'data'));
    for(const command of ['undo','redo','cut','copy','paste','select-all'])await handler(event,command);
    assert.deepEqual(main.contents,['undo','redo','cut','copy','paste','selectAll']);
    await assert.rejects(handler(event,'read-any-file'));
    await assert.rejects(handler({sender:main.webContents,senderFrame:{url:'atlas://app/'}},'info'));
    await assert.rejects(handler({sender:{},senderFrame:event.senderFrame},'info'));
    event.senderFrame.url='https://foreign.example/';await assert.rejects(handler(event,'info'));event.senderFrame.url='atlas://app/';
    await handler(event,'quit');await new Promise(resolve=>setImmediate(resolve));assert.equal(quits,1);
  }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
