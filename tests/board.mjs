import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getSmoothStepPath, Position } from '@xyflow/react';
await mkdir('.sites-runtime', { recursive: true });
const database = new DatabaseSync(':memory:');
database.exec(await readFile('drizzle/0000_medical_tag.sql', 'utf8'));
globalThis.__boardEnv = { DB: { prepare(sql) {
  const statement = database.prepare(sql); let args = [];
  return { bind(...values) { args = values; return this; }, async all() { return { results: statement.all(...args) }; }, async first() { return statement.get(...args) ?? null; }, async run() { return { meta: { changes: statement.run(...args).changes } }; } };
} } };
globalThis.__boardUser = { userId: 'board-owner', email: 'owner@test.invalid' };
const outfile = path.resolve('.sites-runtime/board-check.mjs');
await build({ stdin: { contents: `export * as board from './lib/board';export * as schema from './lib/validation';export {applyBoardChanges} from './lib/board-changes';export {ShapeChoices,LineChoices,MarkerChoices} from './app/workspace/board-symbols';export * as api from './app/api/entities/route';export {EdgeGraphic} from './app/workspace/board-edge';export {MaterialBrowser} from './app/workspace/board-links';`, loader: 'ts', resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', external: ['react', 'react-dom', 'react-dom/*', '@xyflow/react', 'lucide-react', 'radix-ui', '@base-ui/react/*', 'class-variance-authority', 'clsx', 'tailwind-merge', 'sonner'], outfile, logLevel: 'silent', plugins: [{ name: 'board-runtime', setup(build) {
  build.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: 'env', namespace: 'runtime' }));
  build.onResolve({ filter: /^@\/app\/chatgpt-auth$/ }, () => ({ path: 'auth', namespace: 'runtime' }));
  build.onLoad({ filter: /.*/, namespace: 'runtime' }, args => ({ contents: args.path === 'env' ? 'export const env=globalThis.__boardEnv;' : 'export async function getChatGPTUser(){return globalThis.__boardUser}', loader: 'js' }));
} }] });
try {
  const { board: b, schema, api, EdgeGraphic, MaterialBrowser, applyBoardChanges, ShapeChoices, LineChoices, MarkerChoices } = await import(pathToFileURL(outfile).href);
  const legacy = { dashed: true, directed: true };
  assert.equal(b.edgeAppearance(legacy).lineType, 'dashed');
  assert.deepEqual(b.edgeAppearance(legacy).startMarker, { enabled: false, type: 'arrow' });
  assert.deepEqual(b.edgeAppearance(legacy).endMarker, { enabled: true, type: 'arrow' });
  assert.equal(b.edgeAppearance({}).labelPosition, 'middle');
  assert.equal(b.edgeAppearance({ directed: true, endMarker: { enabled: false, type: 'cross' } }).endMarker.enabled, false);
  assert.equal(b.labelTransform('M0 0L200 0', 100, 0, 'above'), 'translate(100px, -10px) translate(-50%, -100%)');
  assert.equal(b.labelTransform('M0 0L200 0', 100, 0, 'below'), 'translate(100px, 10px) translate(-50%, 0%)');
  assert.equal(b.labelTransform('M0 0L0 200', 0, 100, 'above'), 'translate(-10px, 100px) translate(-100%, -50%)');
  assert.equal(b.labelTransform('M0 0L0 200', 0, 100, 'below'), 'translate(10px, 100px) translate(0%, -50%)');
  assert.equal(b.labelTransform('M0 0L0 200', 0, 100, 'middle'), 'translate(0px, 100px) translate(-50%, -50%)');
  assert(b.lineStyle('bold').width > b.lineStyle('normal').width);
  const entity = { id: 'pc', kind: 'character', title: 'Герой', summary: 'Исходное описание', payload: { characterType: 'pc' } };
  assert.equal(b.nodeDescription({ summary: '' }, entity), 'Исходное описание');
  assert.equal(b.nodeDescription({ summary: '', customSummary: true }, entity), '');
  const entities = [entity, { ...entity, id: 'npc', payload: { characterType: 'npc' } }, { ...entity, id: 'article', kind: 'article' }, { ...entity, id: 'folder', kind: 'folder' }, { ...entity, id: 'map', kind: 'map' }];
  assert.deepEqual(b.categoryMaterials(entities, 'pc').map(e => e.id), ['pc']);
  assert.deepEqual(b.categoryMaterials(entities, 'npc').map(e => e.id), ['npc']);
  assert.deepEqual(b.categoryMaterials(entities, 'article', ' ГЕРОЙ ').map(e => e.id), ['article']);
  assert.deepEqual(b.categoryMaterials(entities, 'map').map(e => e.id), ['map']);
  const picker = renderToStaticMarkup(React.createElement(MaterialBrowser, { entities, value: '', onChange() {} }));
  for (const category of b.linkCategories) assert(picker.includes(category.label));
  assert(!picker.includes('role="combobox"'));

  for (const [Component, value, label, count] of [[ShapeChoices, 'rounded', 'Форма', 3], [LineChoices, 'double', 'Линия', 6], [MarkerChoices, 'circle', 'Указатель', 4]]) {
    const symbols = renderToStaticMarkup(React.createElement(Component, { value, label, onChange() {} }));
    assert.equal((symbols.match(/<svg /g) ?? []).length, count);
    assert.equal((symbols.match(/data-state="on"/g) ?? []).length, 1);
    assert(symbols.includes('aria-label='));
    assert(!symbols.includes('role="combobox"'));
  }
  const defaults = ['rectangle', 'rounded', 'circle'].map((shape, i) => b.withNodeSize({ id: `default-${i}`, position: { x: i * 384, y: 48 }, data: { shape, title: 'Title '.repeat(i * 10), summary: 'Description '.repeat(i * 15) } }));
  for (const node of defaults) assert.deepEqual({ width: node.width, height: node.height }, { width: 240, height: 240 });
  assert.deepEqual(b.dockingHandles(defaults[0], defaults[1]), { sourceHandle: 'right', targetHandle: 'left' });
  const [straight] = getSmoothStepPath({ sourceX: 240, sourceY: 48 + defaults[0].height / 2, sourcePosition: Position.Right, targetX: 384, targetY: 48 + defaults[1].height / 2, targetPosition: Position.Left, borderRadius: 0 });
  const pathPoints = [...straight.matchAll(/[ML]\s*([-+\d.e]+)[,\s]+([-+\d.e]+)/gi)].map(p => Number(p[2]));
  assert(pathPoints.length > 1); assert(pathPoints.every(y => y === 168));
  const resizeState = new Set();
  const resizeOptions = { grid: true, align: true, threshold: 8 };
  assert.equal(applyBoardChanges([{ id: defaults[0].id, type: 'dimensions', dimensions: { width: 241, height: 241 } }], defaults, defaults, resizeOptions, resizeState), null);
  const resized = applyBoardChanges([{ id: defaults[0].id, type: 'position', position: { x: -37, y: 29 } }, { id: defaults[0].id, type: 'dimensions', dimensions: { width: 277, height: 259 }, resizing: true, setAttributes: true }], defaults, defaults, resizeOptions, resizeState);
  assert.equal(resized.nodes[0].position.x + resized.nodes[0].width, 240);
  assert.equal(resized.nodes[0].position.y + resized.nodes[0].height, 288);
  assert.deepEqual(resized.nodes[0].position, { x: -37, y: 29 });
  assert(!('measured' in resized.nodes[0])); assert(resizeState.has(defaults[0].id));
  const finished = applyBoardChanges([{ id: defaults[0].id, type: 'dimensions', dimensions: { width: 300, height: 280 }, resizing: false }], resized.nodes, resized.nodes, resizeOptions, resizeState);
  assert.equal(finished.nodes[0].width, 300); assert.equal(finished.nodes[0].height, 280); assert(!resizeState.size);
  assert(!('resizing' in finished.nodes[0]));

  const group = [{ x: 35, y: 49 }, { x: 157, y: 190 }];
  const offset = b.gridGroupOffset(group);
  const snappedGroup = group.map(p => ({ x: p.x + offset.x, y: p.y + offset.y }));
  assert.deepEqual(snappedGroup[0], { x: 24, y: 48 });
  assert.equal(snappedGroup[1].x - snappedGroup[0].x, group[1].x - group[0].x);
  assert.equal(snappedGroup[1].y - snappedGroup[0].y, group[1].y - group[0].y);
  const moving = { id: 'moving', position: { x: -35, y: 49 }, measured: { width: 230, height: 160 } };
  assert.deepEqual(b.snapPosition(moving, [], { grid: true, align: false, threshold: 8 }).position, { x: -24, y: 48 });
  assert.deepEqual(b.snapPosition(moving, [], { grid: false, align: false, threshold: 8 }).position, moving.position);
  const other = { id: 'other', position: { x: 240, y: 0 }, measured: { width: 230, height: 160 } };
  const near = { ...moving, position: { x: 235, y: 240 } };
  const magnetic = b.snapPosition(near, [other], { grid: true, align: true, threshold: 8 });
  assert.equal(magnetic.position.x, 240); assert.equal(magnetic.guides[0].axis, 'x');
  assert.equal(magnetic.guides[0].coordinate, 355);
  const circle = { id: 'circle', position: { x: 242, y: 240 }, measured: { width: 240, height: 240 }, data: { shape: 'circle' } };
  assert.equal(b.snapPosition(circle, [other], { grid: false, align: true, threshold: 8 }).position.x, 240);
  const horizontal = b.snapPosition({ ...moving, position: { x: 600, y: 6 } }, [other], { grid: false, align: true, threshold: 8 });
  assert.equal(horizontal.position.y, 0); assert.equal(horizontal.guides[0].axis, 'y');
  assert.deepEqual(b.snapPosition(moving, [moving], { grid: false, align: true, threshold: 8 }).guides, []);
  assert.equal(b.snapPosition({ ...moving, position: { x: 228, y: 240 } }, [other], { grid: true, align: true, threshold: 8 }).guides.length, 0);
  assert.deepEqual(b.dockingHandles(other, { ...other, id: 'right', position: { x: 700, y: 0 } }), { sourceHandle: 'right', targetHandle: 'left' });
  assert.deepEqual(b.dockingHandles(other, { ...other, id: 'below', position: { x: 240, y: 400 } }), { sourceHandle: 'bottom', targetHandle: 'top' });

  const graphics = [];
  const endpoints = { start: { x: 20, y: 25, position: 'right' }, end: { x: 350, y: 25, position: 'left' } };
  for (const [i, line] of b.lineTypes.entries()) {
    const a = b.edgeAppearance({ lineType: line.value, startMarker: { enabled: true, type: b.markerTypes[i % 4].value }, endMarker: { enabled: true, type: b.markerTypes[(i + 1) % 4].value } });
    const graphic = renderToStaticMarkup(React.createElement('svg', {}, React.createElement(EdgeGraphic, { ...endpoints, id: `edge-${i}`, path: 'M 20 25 L 350 25', color: '#ba9158', appearance: a })));
    assert.equal((graphic.match(/class="board-endpoint /g) ?? []).length, 2);
    assert(graphic.includes('translate(20,25) rotate(180)') && graphic.includes('translate(350,25) rotate(0)'));
    assert.equal(graphic.includes('board-double-gap'), line.value === 'double');
    assert(graphic.indexOf('board-endpoint') > graphic.indexOf('board-double-gap'));
    graphics.push(React.createElement('g', { key: line.value, transform: `translate(10,${i * 65 + 15})` }, React.createElement('text', { x: 20, y: 8, fill: '#ddd', fontSize: 12 }, line.label), React.createElement(EdgeGraphic, { start: { ...endpoints.start, y: 32 }, end: { ...endpoints.end, y: 32 }, id: `preview-${i}`, path: 'M 20 32 L 350 32', color: '#ba9158', appearance: a })));
  }
  const disabled = renderToStaticMarkup(React.createElement('svg', {}, React.createElement(EdgeGraphic, { ...endpoints, id: 'disabled', path: 'M0 0L100 0', color: '#ba9158', appearance: b.edgeAppearance({}) })));
  assert(!disabled.includes('board-endpoint'));
  const svg = renderToStaticMarkup(React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', width: 410, height: 415, style: { '--tone-141d28': '#141d28' } }, React.createElement('rect', { width: 410, height: 415, fill: '#141d28' }), ...graphics));
  await writeFile('.sites-runtime/board-edges.svg', svg.replaceAll('var(--tone-141d28)', '#141d28'));

  const request = (method, value) => new Request('https://atlas.test/api/entities', { method, headers: { 'X-Atlas-Request': '1', 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  async function write(method, value) { const response = await api[method](request(method, value)); const data = await response.json(); assert.equal(response.status, 200, JSON.stringify(data)); return data.entity; }
  const campaign = await write('POST', { kind: 'campaign', title: 'Board test', summary: '', payload: {} });
  const article = await write('POST', { kind: 'article', campaignId: campaign.id, title: 'Linked material', summary: '', payload: {} });
  const node = { id: 'one', position: { x: 0, y: 0 }, data: { title: 'Note', summary: 'Custom description', text: 'Keep previous full text', linkedEntityId: article.id, shape: 'rounded', color: '#ba9158', mode: 'summary', customSummary: true } };
  const payload = { nodes: [node, { ...node, id: 'two', position: { x: 240, y: 240 } }], edges: b.lineTypes.map((line, i) => ({ id: `e${i}`, source: 'one', target: 'two', sourceHandle: 'bottom', targetHandle: 'top', label: line.label, color: '#ba9158', dashed: false, directed: false, ...b.edgeAppearance({ lineType: line.value, startMarker: { enabled: true, type: b.markerTypes[i % 4].value }, endMarker: { enabled: i % 2 === 0, type: b.markerTypes[(i + 1) % 4].value }, labelPosition: ['above', 'middle', 'below'][i % 3] }) })), snapToGrid: false, alignNodes: true, viewport: { x: 10, y: 20, zoom: 1 } };
  const board = await write('POST', { kind: 'board', campaignId: campaign.id, title: 'New board', summary: '', payload });
  assert.deepEqual(board.payload, payload);
  const edited = await write('PATCH', { ...board, payload: { ...payload, snapToGrid: true, alignNodes: false, nodes: payload.nodes.map(n => ({ ...n, data: { ...n.data, summary: '' } })) } });
  const resizedRecord = await write('PATCH', { ...edited, payload: { ...edited.payload, nodes: edited.payload.nodes.map(n => ({ ...n, width: 384, height: 192 })) } });
  assert.equal(resizedRecord.payload.nodes[0].width, 384); assert.equal(resizedRecord.payload.nodes[0].height, 192);
  const saved = (await (await api.GET(new Request('https://atlas.test/api/entities'))).json()).entities.find(e => e.id === resizedRecord.id);
  assert.deepEqual(saved.payload, resizedRecord.payload); assert.equal(saved.payload.nodes[0].data.text, node.data.text);
  const oldPayload = { nodes: payload.nodes, edges: [{ id: 'old', source: 'one', target: 'two', label: 'Old relation', color: '#ba9158', dashed: true, directed: true }] };
  assert.deepEqual((await write('POST', { kind: 'board', campaignId: campaign.id, title: 'Old board', summary: '', payload: oldPayload })).payload, oldPayload);
  assert.equal((await api.PATCH(request('PATCH', board))).status, 409);
  for (const width of [0, 191, 1441, Infinity]) assert(!schema.entityInput.safeParse({ ...board, payload: { ...payload, nodes: [{ ...node, width }] } }).success);
  assert(!schema.entityInput.safeParse({ ...board, payload: { ...payload, edges: [{ ...payload.edges[0], lineType: 'invalid' }] } }).success);
  assert(!schema.entityInput.safeParse({ ...board, payload: { ...payload, edges: [{ ...payload.edges[0], startMarker: { enabled: true, type: 'invalid' } }] } }).success);
  assert.throws(() => schema.checkPayload({ ...payload, edges: [{ ...payload.edges[0], target: 'missing' }] }));
  globalThis.__boardUser = { userId: 'another-owner', email: 'other@test.invalid' };
  assert.equal((await api.PATCH(request('PATCH', edited))).status, 404);
  assert.equal((await (await api.GET(new Request('https://atlas.test/api/entities'))).json()).entities.length, 0);
  console.log('Board checks passed: symbol choices, uniform dimensions and straight horizontal paths, border resizing without anchor drift, size persistence, category filtering, grid and magnetic geometry, four-side docking, SVG lines and independent markers, actual API/D1 roundtrip, legacy boards, conflicts and owner isolation.');
} finally {
  database.close(); await rm(outfile); delete globalThis.__boardEnv; delete globalThis.__boardUser;
}
