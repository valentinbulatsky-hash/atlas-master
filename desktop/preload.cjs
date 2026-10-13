'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const actions=new Set(['info','open-data-folder','quit','undo','redo','cut','copy','paste','select-all','zoom-in','zoom-out','zoom-reset','fullscreen']);
contextBridge.exposeInMainWorld('atlasDesktop',Object.freeze({
  execute(action){if(!actions.has(action))return Promise.reject(new Error('Команда не поддерживается.'));return ipcRenderer.invoke('atlas:settings',action);},
}));
