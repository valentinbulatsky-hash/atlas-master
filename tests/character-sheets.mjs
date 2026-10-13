import { build } from 'esbuild';
import { mkdir,rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
await mkdir('.sites-runtime',{recursive:true});
const outfile=path.resolve('.sites-runtime/character-sheets-check.mjs');
await build({stdin:{contents:`
import assert from 'node:assert/strict';
import {entityInput,checkPayload} from './lib/validation';
import {characterDocuments} from './lib/character-documents';
import {assetMime} from './lib/assets';
const base={kind:'character',title:'Персонаж',summary:'',campaignId:'campaign-1',payload:{characterType:'pc',sheet:{pdf:'/api/assets/original-pdf',pages:[{src:'/api/assets/page-1',width:1191,height:1684}],text:'Характеристики и предыстория'}}};
const saved=entityInput.parse(JSON.parse(JSON.stringify(base)));
checkPayload(saved.payload);
assert.deepEqual(saved.payload.sheet,base.payload.sheet);
const attachment={...base.payload.sheet,pdf:'/api/assets/another-pdf',name:'Другой лист.pdf'};
const many=entityInput.parse({...base,payload:{...base.payload,documents:[attachment]}});
assert.deepEqual(many.payload.documents,[attachment]);
const entity={...many,id:'character-1',folderId:null,revision:1,createdAt:'',updatedAt:''};
assert.equal(characterDocuments(entity).length,2);
assert.equal(characterDocuments({...entity,payload:{documents:[attachment],characterType:'npc'}}).length,1);
assert(!entityInput.safeParse({...base,payload:{documents:[{...attachment,pdf:'https://outside.example/private.pdf'}]}}).success);
assert.equal(assetMime(new TextEncoder().encode('%PDF-1.7'), 'pdf'),'application/pdf');
assert.equal(assetMime(new TextEncoder().encode('%PDF-1.7'), 'image'),null);
assert.equal(assetMime(new TextEncoder().encode('<script>not a pdf</script>'), 'pdf'),null);
const edit=entityInput.parse({...saved,payload:{...saved.payload,cover:'/api/assets/portrait',notes:'Новая заметка'}});
assert.deepEqual(edit.payload.sheet,base.payload.sheet);
for(const pdf of ['https://outside.example/private.pdf','javascript:alert(1)','/api/assets/../other']){
 assert(!entityInput.safeParse({...base,payload:{...base.payload,sheet:{...base.payload.sheet,pdf}}}).success);
}
for(const pages of [[],[{src:'https://outside.example/page.png',width:1,height:1}],[{src:'/api/assets/a',width:0,height:1}]]){
 assert(!entityInput.safeParse({...base,payload:{...base.payload,sheet:{...base.payload.sheet,pages}}}).success);
}
assert(entityInput.safeParse({...base,payload:{characterType:'npc',content:{type:'doc',content:[{type:'paragraph'}]}}}).success);
console.log('Character sheets: full sheet survives edits; external URLs and invalid pages rejected; ordinary NPCs still valid.');
`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile,logLevel:'silent'});
try{await import(pathToFileURL(outfile).href)}finally{await rm(outfile)}
