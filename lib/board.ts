import { isSession, characterType, type Entity } from './model';

export const GRID_SIZE = 24;
export const DEFAULT_NODE_SIZE = { width: 240, height: 240 };
export const MIN_NODE_SIZE = { width: 192, height: 144 };
export const MAX_NODE_SIZE = 1440;
export function withNodeSize<T extends { width?: number; height?: number }>(node: T) {
  return { ...node, width: node.width ?? DEFAULT_NODE_SIZE.width, height: node.height ?? DEFAULT_NODE_SIZE.height };
}
export const lineTypes = [
  { value: 'normal', label: 'Обычная' }, { value: 'bold', label: 'Жирная' },
  { value: 'double', label: 'Двойная' }, { value: 'dashed', label: 'Пунктир' },
  { value: 'dotted', label: 'Точки' }, { value: 'dashdot', label: 'Штрихпунктир' },
] as const;
export const markerTypes = [
  { value: 'arrow', label: 'Стрелочка' }, { value: 'cross', label: 'Крестик' },
  { value: 'circle', label: 'Кружок' }, { value: 'diamond', label: 'Ромб' },
] as const;
export type Endpoint = { enabled: boolean; type: typeof markerTypes[number]['value'] };
export type EdgeAppearance = {
  lineType: typeof lineTypes[number]['value'];
  startMarker: Endpoint; endMarker: Endpoint;
  labelPosition: 'above' | 'middle' | 'below';
};
export function edgeAppearance(edge: Partial<EdgeAppearance> & { dashed?: boolean; directed?: boolean }): EdgeAppearance {
  return {
    lineType: edge.lineType ?? (edge.dashed ? 'dashed' : 'normal'),
    startMarker: edge.startMarker ?? { enabled: false, type: 'arrow' },
    endMarker: edge.endMarker ?? { enabled: !!edge.directed, type: 'arrow' },
    labelPosition: edge.labelPosition ?? 'middle',
  };
}
export function lineStyle(type: EdgeAppearance['lineType']) {
  return { width: type === 'bold' ? 4 : type === 'double' ? 6 : 2,
    dash: ({ dashed: '8 6', dotted: '1 7', dashdot: '9 5 1 5' } as Record<string, string>)[type] };
}
export function labelTransform(path: string, x: number, y: number, position: EdgeAppearance['labelPosition']) {
  const points = [...path.matchAll(/[ML]\s*([-+\d.e]+)[,\s]+([-+\d.e]+)/gi)].map(m => ({ x: Number(m[1]), y: Number(m[2]) }));
  let vertical = false, longest = -1;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const length = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    if (x >= Math.min(a.x, b.x) - .01 && x <= Math.max(a.x, b.x) + .01 && y >= Math.min(a.y, b.y) - .01 && y <= Math.max(a.y, b.y) + .01 && length > longest) {
      vertical = Math.abs(b.x - a.x) < .01; longest = length;
    }
  }
  if (position === 'middle') return `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  // Offset the whole label, including long/wrapped text, away from the segment.
  if (vertical) return position === 'above'
    ? `translate(${x - 10}px, ${y}px) translate(-100%, -50%)`
    : `translate(${x + 10}px, ${y}px) translate(0%, -50%)`;
  return position === 'above'
    ? `translate(${x}px, ${y - 10}px) translate(-50%, -100%)`
    : `translate(${x}px, ${y + 10}px) translate(-50%, 0%)`;
}

export const linkCategories = [
  { value: 'pc', label: 'Игровые персонажи' }, { value: 'npc', label: 'NPC' },
  { value: 'map', label: 'Локации и карты' }, { value: 'article', label: 'Статьи' },
  { value: 'board', label: 'Доски связей' }, { value: 'sessions', label: 'Сессии' }, { value: 'campaign', label: 'Кампании' },
] as const;
export function linkCategory(entity: Entity) { return isSession(entity)?'sessions':characterType(entity) ?? entity.kind; }
export function categoryMaterials(entities: Entity[], category: string, query = '') {
  const needle = query.trim().toLocaleLowerCase('ru');
  return entities.filter(e => linkCategory(e) === category && e.title.toLocaleLowerCase('ru').includes(needle))
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'));
}
export function nodeDescription(data: { summary?: string; customSummary?: boolean }, entity?: Entity) {
  return data.customSummary ? data.summary ?? '' : data.summary || entity?.summary?.slice(0, 500) || '';
}

type Point = { x: number; y: number };
export type SnapNode = { id: string; position: Point; width?: number; height?: number; measured?: { width?: number; height?: number }; data?: { shape?: string } };
export type Guide = { axis: 'x' | 'y'; coordinate: number; from: number; to: number };
function dimensions(node: SnapNode) {
  return { width: node.width ?? node.measured?.width ?? DEFAULT_NODE_SIZE.width, height: node.height ?? node.measured?.height ?? DEFAULT_NODE_SIZE.height };
}
export function gridPosition(position: Point) {
  return { x: Math.round(position.x / GRID_SIZE) * GRID_SIZE, y: Math.round(position.y / GRID_SIZE) * GRID_SIZE };
}
export function gridGroupOffset(positions: Point[]) {
  if (!positions.length) return { x: 0, y: 0 };
  const snapped = gridPosition(positions[0]);
  return { x: snapped.x - positions[0].x, y: snapped.y - positions[0].y };
}
// Magnetism wins over the grid within the threshold; otherwise the node lands on a grid point.
export function snapPosition(moving: SnapNode, others: SnapNode[], options: { grid: boolean; align: boolean; threshold: number }) {
  const position = options.grid ? gridPosition(moving.position) : { ...moving.position };
  const guides: Guide[] = [];
  if (!options.align) return { position, guides };
  const size = dimensions(moving);
  for (const axis of ['x', 'y'] as const) {
    const dimension = axis === 'x' ? 'width' : 'height';
    let best: { distance: number; position: number; coordinate: number; other: SnapNode } | undefined;
    for (const other of others) {
      if (other.id === moving.id) continue;
      const otherSize = dimensions(other);
      // Centers first, then matching near/far edges; tie-breaking stays stable.
      for (const fraction of [0.5, 0, 1]) {
        const coordinate = other.position[axis] + otherSize[dimension] * fraction;
        const candidate = coordinate - size[dimension] * fraction;
        const distance = Math.abs(candidate - moving.position[axis]);
        if (distance <= options.threshold && (!best || distance < best.distance)) best = { distance, position: candidate, coordinate, other };
      }
    }
    if (best) {
      position[axis] = best.position;
      const perpendicular = axis === 'x' ? 'y' : 'x';
      const extent = axis === 'x' ? 'height' : 'width';
      guides.push({ axis, coordinate: best.coordinate,
        from: Math.min(position[perpendicular], best.other.position[perpendicular]) - 50,
        to: Math.max(position[perpendicular] + size[extent], best.other.position[perpendicular] + dimensions(best.other)[extent]) + 50 });
    }
  }
  return { position, guides };
}
export function dockingHandles(source: SnapNode, target: SnapNode) {
  const a = dimensions(source), b = dimensions(target);
  const dx = target.position.x + b.width / 2 - source.position.x - a.width / 2;
  const dy = target.position.y + b.height / 2 - source.position.y - a.height / 2;
  return Math.abs(dx) >= Math.abs(dy)
    ? { sourceHandle: dx >= 0 ? 'right' : 'left', targetHandle: dx >= 0 ? 'left' : 'right' }
    : { sourceHandle: dy >= 0 ? 'bottom' : 'top', targetHandle: dy >= 0 ? 'top' : 'bottom' };
}
