'use client';
import { useState, useRef } from 'react';
import { useTheme } from 'next-themes';
import { ReactFlow, Background, Controls, MiniMap, Handle, Position, ReactFlowProvider, useReactFlow, ViewportPortal, ConnectionMode, ConnectionLineType, NodeResizer, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, FileText, Link2, Trash2, Maximize2, Eye, X, Grid2X2, Magnet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { type Entity, colors, materialLabel } from '@/lib/model';
import { GRID_SIZE, dockingHandles, edgeAppearance, gridPosition, withNodeSize, DEFAULT_NODE_SIZE, MIN_NODE_SIZE, MAX_NODE_SIZE, nodeDescription, type Endpoint, type Guide } from '@/lib/board';
import { Choice, Field } from './ui';
import { BoardLinkPicker, MaterialBrowser } from './board-links';
import { AtlasEdge } from './board-edge';
import { ShapeChoices, LineChoices, MarkerChoices } from './board-symbols';
import { applyBoardChanges } from '@/lib/board-changes';

function AtlasNode({ data, selected }: NodeProps) {
  const d = data as any;
  return <div className={`atlas-node ${d.shape} ${selected ? 'selected' : ''}`} style={{ '--node-color': d.color } as any}>
    {([Position.Left, Position.Right, Position.Top, Position.Bottom]).map(position => <Handle key={position} id={position} type="source" position={position} isConnectable={!d.readonly} style={d.readonly?{visibility:'hidden',pointerEvents:'none'}:undefined} aria-hidden={d.readonly} aria-label={`Точка связи: ${position}`}/>)}
    <>{!d.readonly && <NodeResizer color={d.color} minWidth={MIN_NODE_SIZE.width} minHeight={MIN_NODE_SIZE.height} maxWidth={MAX_NODE_SIZE} maxHeight={MAX_NODE_SIZE} keepAspectRatio={d.shape === 'circle'} lineClassName="board-resize-line" handleClassName="board-resize-handle" onResizeStart={() => d.startResize()}/>}</>
    <div className="atlas-node-content"><div className="node-type"><FileText size={13}/>{d.kind ?? 'Заметка'}</div>
    <strong>{d.label}</strong><p className="nodrag nowheel">{d.description || 'Добавьте краткое описание'}</p>
    <button className="nodrag nopan node-open board-open-icon" aria-label={`Открыть содержание: ${d.label}`} title="Открыть содержание" onClick={e => { e.stopPropagation(); d.open(); }}><Eye size={18}/></button></div>
  </div>;
}
const nodeTypes = { atlas: AtlasNode };
const edgeTypes = { atlas: AtlasEdge };
type BoardProps = { payload: Record<string, any>; onChange: (p: Record<string, any>) => void; entities: Entity[]; onOpen: (id: string) => void; onNote: (title: string, text: string) => void; readonly?: boolean };
export default function Board(props: BoardProps) { return <ReactFlowProvider><BoardCanvas {...props}/></ReactFlowProvider>; }

function BoardCanvas({ payload, onChange, entities, onOpen, onNote, readonly=false }: BoardProps) {
  const [selected, setSelected] = useState(''), [edgeId, setEdgeId] = useState('');
  const [adding, setAdding] = useState(false), [linkId, setLinkId] = useState('');
  const [connecting, setConnecting] = useState(false), [source, setSource] = useState(''), [target, setTarget] = useState('');
  const [guides, setGuides] = useState<Guide[]>([]);
  const { resolvedTheme } = useTheme();
  const flow = useReactFlow();
  const base = (payload.nodes ?? []).map(withNodeSize), lines = payload.edges ?? [];
  const resizing = useRef(new Set<string>());
  const grid = payload.snapToGrid ?? true, align = payload.alignNodes ?? true;
  const update = (p: any) => { if (!readonly) onChange({ ...payload, ...p }); };
  const openNode = (n: any) => n.data.linkedEntityId ? onOpen(n.data.linkedEntityId) : onNote(n.data.title, n.data.text || n.data.summary);
  const nodes = base.map((n: any) => {
    const e = entities.find(e => e.id === n.data.linkedEntityId);
    return { ...n, type: 'atlas', draggable: !readonly, connectable: !readonly, selected: n.id === selected, data: { ...n.data,
      readonly, label: e?.title ?? (n.data.linkedEntityId ? 'Материал удалён' : n.data.title),
      description: nodeDescription(n.data, e), kind: e ? materialLabel(e) : 'Заметка', open: () => openNode(n), startResize: () => { setSelected(n.id); setEdgeId(''); } } };
  });
  const measured = flow.getNodes();
  const edges = lines.map((e: any) => {
    const s = measured.find(n => n.id === e.source) ?? base.find((n: any) => n.id === e.source);
    const t = measured.find(n => n.id === e.target) ?? base.find((n: any) => n.id === e.target);
    const handles = s && t ? dockingHandles(s, t) : { sourceHandle: 'right', targetHandle: 'left' };
    return { ...e, sourceHandle: e.sourceHandle ?? handles.sourceHandle, targetHandle: e.targetHandle ?? handles.targetHandle,
      selected: e.id === edgeId, type: 'atlas', data: { ...edgeAppearance(e), color: e.color } };
  });
  const n = base.find((n: any) => n.id === selected), edge = lines.find((e: any) => e.id === edgeId);
  const appearance = edge ? edgeAppearance(edge) : null;
  const linked = entities.find(e => e.id === n?.data.linkedEntityId);
  const changeNode = (data: any) => update({ nodes: base.map((x: any) => x.id === selected ? { ...x, data: { ...x.data, ...data } } : x) });
  const changeEdge = (data: any) => update({ edges: lines.map((x: any) => x.id === edgeId ? { ...x, ...data } : x) });
  const connect = (s: string, t: string, sourceHandle?: string | null, targetHandle?: string | null) => {
    if (readonly || !s || !t || s === t || lines.length >= 200) return;
    const id = crypto.randomUUID();
    update({ edges: [...lines, { id, source: s, target: t, sourceHandle: sourceHandle ?? null, targetHandle: targetHandle ?? null,
      label: '', color: colors[0], dashed: false, directed: true, ...edgeAppearance({ directed: true }) }] });
    setEdgeId(id); setSelected('');
  };
  const beginAdding = () => { setLinkId(''); setAdding(true); };
  return <div className="board-shell">
    <div className="canvas-toolbar board-toolbar">
      {!readonly && <div><Button size="sm" disabled={base.length >= 100} onClick={beginAdding}><Plus size={15}/>Блок</Button><Button size="sm" variant="outline" disabled={base.length < 2 || lines.length >= 200} onClick={() => { setSource(''); setTarget(''); setConnecting(true); }}><Link2 size={15}/>Связь</Button></div>}
      {!readonly && <div className="board-snap-controls">
        <label className="switch-row"><Grid2X2 size={15}/>Сетка<Switch aria-label="Привязка к сетке" checked={grid} onCheckedChange={v => update({ snapToGrid: v })}/></label>
        <label className="switch-row"><Magnet size={15}/>Магниты<Switch aria-label="Магнитное выравнивание блоков" checked={align} onCheckedChange={v => { setGuides([]); update({ alignNodes: v }); }}/></label>
      </div>}
      <button className="plain-button" onClick={() => flow.fitView({ padding: .25 })}><Maximize2 size={15}/>Показать всё</button>
    </div>
    <div className="board-body"><div className="flow-area"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
      nodesDraggable={!readonly} nodesConnectable={!readonly} edgesReconnectable={!readonly} connectionMode={ConnectionMode.Loose} connectionLineType={ConnectionLineType.Step}
      snapToGrid={grid && !align} snapGrid={[GRID_SIZE, GRID_SIZE]}
      onNodesChange={changes => {
        if (readonly) return;
        const changed = applyBoardChanges(changes, base, flow.getNodes(), { grid, align, threshold: 8 / Math.max(flow.getZoom(), .5) }, resizing.current);
        if (!changed) return;
        setGuides(changed.guides);
        update({ nodes: changed.nodes, edges: lines.filter((e: any) => changed.nodes.some(n => n.id === e.source) && changed.nodes.some(n => n.id === e.target)) });
      }}
      onNodeDragStop={() => setGuides([])}
      onEdgesChange={changes => { if (readonly) return; const removed = changes.filter(c => c.type === 'remove').map(c => c.id); if (removed.length) update({ edges: lines.filter((e: any) => !removed.includes(e.id)) }); }}
      onNodeClick={(_, n) => { if(readonly){openNode(n);return;} setSelected(n.id); setEdgeId(''); }} onEdgeClick={(_, e) => { setEdgeId(e.id); setSelected(''); }}
      onPaneClick={() => { setSelected(''); setEdgeId(''); }} onNodeDoubleClick={(_, n) => openNode(n)}
      onConnect={c => connect(c.source, c.target, c.sourceHandle, c.targetHandle)}
      defaultViewport={payload.viewport ?? { x: 60, y: 60, zoom: 1 }} onMoveEnd={(_, v) => { if (!readonly && JSON.stringify(v) !== JSON.stringify(payload.viewport)) update({ viewport: v }); }}
      minZoom={.15} maxZoom={2} colorMode={resolvedTheme === 'light' ? 'light' : 'dark'} deleteKeyCode={null}>
      <Background color="var(--canvas-dot)" gap={GRID_SIZE} size={1}/><Controls showInteractive={false}/><MiniMap nodeColor={n => (n.data.color as string) ?? colors[0]} maskColor="var(--canvas-mask)"/>
      <ViewportPortal>{guides.map(g => <div key={g.axis} className={`board-alignment-guide ${g.axis}`} style={g.axis === 'x' ? { left: g.coordinate, top: g.from, height: g.to - g.from } : { left: g.from, top: g.coordinate, width: g.to - g.from }}/>)}</ViewportPortal>
    </ReactFlow>
    {!base.length && <div className="canvas-empty"><Link2 size={32}/><h3>Дайте истории форму</h3><p>Добавьте персонажей, места и заметки.<br/>Соедините их так, как устроен ваш мир.</p>{!readonly && <Button onClick={beginAdding}><Plus size={16}/>Первый блок</Button>}</div>}
    <span className="canvas-hint">{readonly ? 'Перемещайте и масштабируйте доску · Нажмите на блок, чтобы прочитать содержание' : 'Рамка — размер · Точки — связи · Сетка: 24'}</span>
    </div>
    {!readonly && (n || edge) && <aside className="inspector board-inspector"><div className="inspector-heading"><strong>{n ? 'Свойства блока' : 'Свойства связи'}</strong><button className="plain-button" aria-label="Закрыть свойства" title="Закрыть" onClick={() => { setSelected(''); setEdgeId(''); }}><X size={18}/></button></div>
      {n ? <>
        <div className="field"><span>Форма</span><ShapeChoices value={n.data.shape} onChange={shape => update({ nodes: base.map((x: any) => x.id !== n.id ? x : { ...x, ...(shape === 'circle' ? { width: Math.max(x.width, x.height), height: Math.max(x.width, x.height) } : {}), data: { ...x.data, shape } }) })}/></div>
        <Palette value={n.data.color} onChange={v => changeNode({ color: v })}/>
        <Field label="Краткое описание"><textarea rows={3} maxLength={500} value={nodeDescription(n.data, linked)} onChange={e => changeNode({ summary: e.target.value, customSummary: true })}/></Field>
        <BoardLinkPicker entities={entities} value={n.data.linkedEntityId} onChange={id => {
          const material = entities.find(e => e.id === id);
          changeNode({ linkedEntityId: id || null, title: id ? n.data.title : linked?.title ?? n.data.title,
            summary: n.data.customSummary ? n.data.summary : (material?.summary ?? nodeDescription(n.data, linked)).slice(0, 500), customSummary: true });
        }}/>
        {!n.data.linkedEntityId && <Field label="Название"><input className="text-input" maxLength={120} value={n.data.title} onChange={e => changeNode({ title: e.target.value })}/></Field>}
        <div className="board-inspector-footer"><Button size="icon" variant="outline" aria-label="Открыть содержание" title="Открыть содержание" onClick={() => openNode(n)}><Eye size={18}/></Button>
          <Button className="delete-button" variant="ghost" onClick={() => { update({ nodes: base.filter((x: any) => x.id !== n.id), edges: lines.filter((e: any) => e.source !== n.id && e.target !== n.id) }); setSelected(''); }}><Trash2 size={16}/>Удалить блок</Button></div>
      </> : appearance && <>
        <Field label="Подпись связи"><input className="text-input" maxLength={120} value={edge.label} onChange={e => changeEdge({ label: e.target.value })}/></Field>
        <Field label="Расположение подписи"><Choice label="Расположение подписи связи" value={appearance.labelPosition} onChange={v => changeEdge({ labelPosition: v })} options={[{ value: 'above', label: 'Сверху линии' }, { value: 'middle', label: 'Посередине линии' }, { value: 'below', label: 'Снизу линии' }]}/></Field>
        <div className="field"><span>Тип линии</span><LineChoices value={appearance.lineType} onChange={v => changeEdge({ lineType: v, dashed: v === 'dashed' })}/></div>
        <Palette value={edge.color} onChange={v => changeEdge({ color: v })}/>
        <div className="board-marker-settings"><MarkerControl label="Первый конец" endpoint={appearance.startMarker} onChange={v => changeEdge({ startMarker: v })}/><MarkerControl label="Второй конец" endpoint={appearance.endMarker} onChange={v => changeEdge({ endMarker: v, directed: v.enabled && v.type === 'arrow' })}/></div>
        <Button className="delete-button" variant="ghost" onClick={() => { update({ edges: lines.filter((e: any) => e.id !== edgeId) }); setEdgeId(''); }}><Trash2 size={16}/>Удалить связь</Button>
      </>}
    </aside>}
    </div>
    <Dialog open={adding} onOpenChange={setAdding}><DialogContent className="board-link-dialog"><DialogTitle>Новый блок</DialogTitle><DialogDescription>Выберите категорию и материал или добавьте блок без ссылки.</DialogDescription>
      <MaterialBrowser key={String(adding)} entities={entities} value={linkId} onChange={setLinkId}/>
      {linkId && <p className="board-new-selection">Выбрано: <strong>{entities.find(e => e.id === linkId)?.title}</strong></p>}
      <Button onClick={() => {
        const id = crypto.randomUUID(), rect = document.querySelector('.flow-area')?.getBoundingClientRect();
        const rawPosition = flow.screenToFlowPosition({ x: (rect?.left ?? 0) + 180, y: (rect?.top ?? 0) + 130 }, { snapToGrid: false });
        const entity = entities.find(e => e.id === linkId);
        update({ nodes: [...base, { id, ...DEFAULT_NODE_SIZE, position: grid ? gridPosition(rawPosition) : rawPosition, data: { title: entity?.title ?? 'Новая заметка', summary: (entity?.summary ?? '').slice(0, 500), customSummary: true, text: '', linkedEntityId: linkId || null, shape: 'rounded', mode: 'summary', color: colors[base.length % colors.length] } }] });
        setSelected(id); setEdgeId(''); setAdding(false);
      }}>Добавить на доску</Button>
    </DialogContent></Dialog>
    <Dialog open={connecting} onOpenChange={setConnecting}><DialogContent><DialogTitle>Связать блоки</DialogTitle><DialogDescription>Выберите начало и конец. Оформление можно настроить после создания связи.</DialogDescription>
      <Field label="От блока"><Choice label="Начало связи" value={source} onChange={setSource} options={[{ value: 'none', label: 'Выберите блок' }, ...nodes.map((n: any) => ({ value: n.id, label: n.data.label }))]}/></Field>
      <Field label="К блоку"><Choice label="Конец связи" value={target} onChange={setTarget} options={[{ value: 'none', label: 'Выберите блок' }, ...nodes.map((n: any) => ({ value: n.id, label: n.data.label }))]}/></Field>
      <Button disabled={!source || !target || source === 'none' || target === 'none' || source === target} onClick={() => { connect(source, target); setConnecting(false); }}>Создать связь</Button>
    </DialogContent></Dialog>
  </div>;
}

function MarkerControl({ label, endpoint, onChange }: { label: string; endpoint: Endpoint; onChange: (v: Endpoint) => void }) {
  return <fieldset className="board-marker-box"><legend>{label}</legend><label className="switch-row">Указатель<Switch aria-label={`${label}: включить указатель`} checked={endpoint.enabled} onCheckedChange={v => onChange({ ...endpoint, enabled: v })}/></label>
    <MarkerChoices label={`${label}: вид указателя`} value={endpoint.type} onChange={v => onChange({ ...endpoint, type: v as Endpoint['type'] })}/>
  </fieldset>;
}
function Palette({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <div className="field"><span>Цвет</span><div className="palette">{colors.map(c => <button key={c} title={c} aria-label={`Цвет ${c}`} aria-pressed={value === c} style={{ background: c }} className={value === c ? 'selected' : ''} onClick={() => onChange(c)}/>)}</div></div>;
}
