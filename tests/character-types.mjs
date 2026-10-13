import { build } from 'esbuild';
import { mkdir,rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
await mkdir('.sites-runtime',{recursive:true});
const outfile=path.resolve('.sites-runtime/character-types-check.mjs');
await build({stdin:{contents:`
import assert from 'node:assert/strict';
import {entityInput} from './lib/validation';
import {matchesSection,materialLabel,characterType} from './lib/model';
const base={id:'character-1',kind:'character',title:'Персонаж',summary:'',campaignId:'campaign-1',folderId:null,revision:1,createdAt:'2026-10-05',updatedAt:'2026-10-05',payload:{notes:'Сохранённые заметки'}};
for(const t of ['pc','npc']){
 const v={...base,payload:{...base.payload,characterType:t}};
 const saved=entityInput.parse(JSON.parse(JSON.stringify(v)));
 assert.equal(saved.payload.characterType,t);
 assert.equal(saved.payload.notes,base.payload.notes);
 assert.equal(saved.id,base.id);
 assert(matchesSection(v,t));
 assert(!matchesSection(v,t==='pc'?'npc':'pc'));
 assert(!matchesSection(v,'all'));
}
assert(matchesSection({...base,kind:'article'},'all'));
for(const kind of ['character','map','board','folder','campaign'])assert(!matchesSection({...base,kind},'all'));
assert.equal(characterType(base),'npc');
assert.equal(materialLabel({...base,payload:{characterType:'pc'}}),'Игровой персонаж');
assert(!entityInput.safeParse({...base,payload:{characterType:'invalid'}}).success);
assert(!matchesSection({...base,kind:'article'},'npc'));
console.log('Character checks passed: both categories survive validation, remain separate, preserve IDs and notes; legacy records remain visible.');
`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile,logLevel:'silent'});
try{await import(pathToFileURL(outfile).href)}finally{await rm(outfile)}
