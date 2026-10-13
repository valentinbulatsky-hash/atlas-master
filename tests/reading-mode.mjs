import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
await mkdir('.sites-runtime',{recursive:true});
const outfile=path.resolve('.sites-runtime/reading-check.mjs');
globalThis.__readingFlow=null;
const flowStub=`import React from 'react';
export const Position={Left:'left',Right:'right',Top:'top',Bottom:'bottom'},ConnectionMode={Loose:'loose'},ConnectionLineType={Step:'step'};
export function ReactFlowProvider({children}){return children}
export function useReactFlow(){return {getNodes:()=>[],getZoom:()=>1,fitView(){},screenToFlowPosition:p=>p}}
export function ReactFlow(props){globalThis.__readingFlow=props;return React.createElement('div',{'data-flow':'true'},...props.nodes.map(n=>React.createElement(props.nodeTypes[n.type],{key:n.id,data:n.data,selected:n.selected})),...props.edges.map(e=>React.createElement('span',{key:e.id,'data-edge':e.id})),props.children)}
export function Handle(props){return React.createElement('span',{'data-handle':props.id,'data-connectable':String(props.isConnectable),style:props.style})}
export function NodeResizer(){return React.createElement('span',{'data-resizer':'true'})}
export function Background(){return null}export function Controls(){return null}export function MiniMap(){return null}export function ViewportPortal(){return null}
export function BaseEdge(){return null}export function EdgeLabelRenderer({children}){return children}export function getSmoothStepPath(){return ['M0 0 L1 1',0,0]}
export function applyNodeChanges(){throw new Error('Read-only board attempted to apply node changes')}
`;
const uiStub=`import React from 'react';export function Button({children,onClick,disabled}){return React.createElement('button',{onClick,disabled},children)}export function Switch(){return React.createElement('input',{type:'checkbox'})}export function Dialog({open,children}){return open?children:null}export function DialogContent({children,className}){return React.createElement('div',{className},children)}export function DialogTitle({children}){return React.createElement('h2',null,children)}export function DialogDescription({children}){return React.createElement('p',null,children)}export function Field({children,label}){return React.createElement('label',null,label,children)}export function Choice(){return React.createElement('select')}export function ImageUpload(){return React.createElement('input',{type:'file'})}export function EntityPicker(){return React.createElement('input')}export function BoardLinkPicker(){return null}export function MaterialBrowser(){return null}export function ShapeChoices(){return null}export function LineChoices(){return null}export function MarkerChoices(){return null}export function RichEditor({readonly,value}){return React.createElement('div',{'data-readonly':String(readonly)},JSON.stringify(value))}export async function api(){}export async function upload(){}`;
await build({stdin:{contents:`export {default as Board} from './app/workspace/board';export {default as WorldMap} from './app/workspace/world-map';export {default as MaterialReader} from './app/workspace/material-reader';export {default as BackgroundDialog} from './app/workspace/campaign-background';`,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',external:['react','react-dom','react-dom/*','lucide-react','sonner'],outfile,logLevel:'silent',plugins:[{name:'reading-runtime',setup(build){
  build.onResolve({filter:/\.css$/},()=>({path:'empty',namespace:'stub'}));
  build.onResolve({filter:/^@xyflow\/react$/},()=>({path:'flow',namespace:'stub'}));
  build.onResolve({filter:/^next-themes$/},()=>({path:'theme',namespace:'stub'}));
  build.onResolve({filter:/^@\/components\/ui\/(button|switch|dialog)$/},()=>({path:'ui',namespace:'stub'}));
  build.onResolve({filter:/^\.\/(ui|board-links|board-symbols|rich-editor)$/},()=>({path:'ui',namespace:'stub'}));
  build.onLoad({filter:/.*/,namespace:'stub'},args=>({contents:args.path==='flow'?flowStub:args.path==='theme'?`export function useTheme(){return {resolvedTheme:'dark'}}`:args.path==='ui'?uiStub:'',loader:'js'}));
}}]});
try{
  const {Board,WorldMap,MaterialReader,BackgroundDialog}=await import(pathToFileURL(outfile).href);
  const entity={id:'article',kind:'article',title:'История мира',summary:'Описание',payload:{content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Читать'}]}]}},revision:1};
  const nodes=[{id:'one',position:{x:0,y:0},data:{title:'Мир',summary:'Описание',text:'',linkedEntityId:'article',shape:'rounded',color:'#ba9158',mode:'summary'}},{id:'two',position:{x:300,y:0},data:{title:'Заметка',summary:'Коротко',text:'Полный текст',shape:'rounded',color:'#628eb3',mode:'summary'}}];
  const payload={nodes,edges:[{id:'edge',source:'one',target:'two',label:'связь',color:'#ba9158',directed:true,dashed:false}]};
  let mutations=0,opened=[];const props={payload,entities:[entity],onChange(){mutations++},onOpen(id){opened.push(id)},onNote(title,text){opened.push([title,text])}};
  const html=renderToStaticMarkup(React.createElement(Board,{...props,readonly:true})),flow=globalThis.__readingFlow;
  assert.equal(flow.nodesDraggable,false);assert.equal(flow.nodesConnectable,false);assert.equal(flow.edgesReconnectable,false);
  assert(!html.includes('data-resizer'));assert.equal((html.match(/data-handle=/g)??[]).length,8);assert(html.includes('data-connectable="false"'));assert(html.includes('data-edge="edge"'));
  assert(!html.includes('>Блок<'));assert(!html.includes('>Связь<'));assert(!html.includes('type="checkbox"'));
  flow.onNodesChange([{type:'position',id:'one',position:{x:500,y:500}}]);flow.onEdgesChange([{type:'remove',id:'edge'}]);flow.onConnect({source:'one',target:'two'});flow.onMoveEnd(null,{x:200,y:300,zoom:1.4});assert.equal(mutations,0);
  flow.onNodeClick(null,flow.nodes[0]);flow.nodes[1].data.open();assert.deepEqual(opened,['article',['Заметка','Полный текст']]);
  const editable=renderToStaticMarkup(React.createElement(Board,props));assert(editable.includes('data-resizer'));assert.equal(globalThis.__readingFlow.nodesDraggable,true);globalThis.__readingFlow.onMoveEnd(null,{x:1,y:2,zoom:1});assert.equal(mutations,1);
  const readMap=renderToStaticMarkup(React.createElement(WorldMap,{readonly:true,payload:{image:'/api/assets/map',pins:[]},entities:[],onChange(){throw new Error('Map changed')},onOpen(){}}));assert(!readMap.includes('type="file"'));assert(!readMap.includes('Добавить метку'));assert(readMap.includes('Увеличить карту'));
  const reading=renderToStaticMarkup(React.createElement(MaterialReader,{entity,entities:[entity],onClose(){},onEdit(){},onOpen(){},onNote(){}}));assert(reading.includes('Редактировать'));assert(reading.includes('data-readonly="true"'));assert(!reading.includes('<input'));assert(!reading.includes('<textarea'));
  const preview=renderToStaticMarkup(React.createElement(BackgroundDialog,{campaign:{...entity,kind:'campaign',payload:{background:{type:'preset',preset:'forest'}}},onClose(){},onSaved(){}}));assert(preview.includes('Версия для ПК'));assert(preview.includes('Мобильная версия'));assert(preview.includes('accept="image/jpeg,image/png"'));
  console.log('Reading mode passed: no board mutations from dragging, connections or viewport changes; links/notes remain accessible; handles preserve edge geometry; map upload/editing hidden; articles read-only; two background previews.');
}finally{await rm(outfile,{force:true});delete globalThis.__readingFlow}
