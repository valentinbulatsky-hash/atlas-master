import { applyNodeChanges, type Node, type NodeChange } from '@xyflow/react';
import { gridGroupOffset, snapPosition, type Guide } from './board';

export function applyBoardChanges(changes: NodeChange[], base: Node[], measured: Node[], options: { grid: boolean; align: boolean; threshold: number }, resizing: Set<string>) {
  for (const c of changes) if (c.type === 'dimensions' && c.resizing === true) resizing.add(c.id);
  const movingIds = new Set(changes.filter(c => c.type === 'position').map(c => c.id));
  const groupOffset = options.grid && movingIds.size > 1 ? gridGroupOffset(changes.flatMap(c => c.type === 'position' && c.position ? [c.position] : [])) : { x: 0, y: 0 };
  let guides: Guide[] = [];
  const meaningful = changes.filter(c => c.type === 'position' || c.type === 'remove' || (c.type === 'dimensions' && (c.setAttributes || c.resizing !== undefined))).map(c => {
    // The final resize event must persist its dimensions too, even if updates are batched.
    if (c.type === 'dimensions' && c.dimensions) return { ...c, setAttributes: true };
    if (c.type !== 'position' || !c.position) return c;
    // Moving the top/left border also changes position. Do not move the opposite border by snapping.
    if (resizing.has(c.id)) return c;
    if (movingIds.size > 1) return { ...c, position: { x: c.position.x + groupOffset.x, y: c.position.y + groupOffset.y } };
    const node = measured.find(n => n.id === c.id) ?? base.find(n => n.id === c.id);
    if (!node) return c;
    const snapped = snapPosition({ ...node, position: c.position }, measured.filter(n => !movingIds.has(n.id)), { ...options, align: options.align && movingIds.size === 1 });
    if (c.dragging) guides = snapped.guides;
    return { ...c, position: snapped.position };
  });
  if (!meaningful.length) return null;
  const nodes = applyNodeChanges<Node & { resizing?: boolean }>(meaningful, base).map(({ measured: _measurement, resizing: _resizing, dragging: _dragging, ...node }) => node);
  for (const c of changes) if (c.type === 'dimensions' && c.resizing === false) resizing.delete(c.id);
  return { nodes, guides };
}
