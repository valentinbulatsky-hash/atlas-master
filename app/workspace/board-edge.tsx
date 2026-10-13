'use client';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, Position, type EdgeProps } from '@xyflow/react';
import { edgeAppearance, labelTransform, lineStyle, type EdgeAppearance, type Endpoint } from '@/lib/board';

type EndPoint = { x: number; y: number; position: Position };
function EndpointGlyph({ endpoint, point, color }: { endpoint: Endpoint; point: EndPoint; color: string }) {
  if (!endpoint.enabled) return null;
  const angle = { left: 0, right: 180, top: 90, bottom: -90 }[point.position];
  return <g className={`board-endpoint ${endpoint.type}`} transform={`translate(${point.x},${point.y}) rotate(${angle})`} pointerEvents="none"><g transform={endpoint.type === 'arrow' ? undefined : 'translate(-6,0)'}>
    {endpoint.type === 'arrow' && <path d="M 0 0 L -11 -5 L -11 5 Z" fill={color}/>}
    {endpoint.type === 'cross' && <path d="M -4 -4 L 4 4 M -4 4 L 4 -4" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round"/>}
    {endpoint.type === 'circle' && <circle r={4} fill="var(--tone-141d28)" stroke={color} strokeWidth={2}/>}
    {endpoint.type === 'diamond' && <path d="M 0 -6 L 6 0 L 0 6 L -6 0 Z" fill={color}/>}
  </g></g>;
}

export function EdgeGraphic({ id, path, color, appearance, start, end, selected = false }: { id: string; path: string; color: string; appearance: EdgeAppearance; start: EndPoint; end: EndPoint; selected?: boolean }) {
  const style = lineStyle(appearance.lineType);
  return <>
    {selected && <path d={path} fill="none" stroke={color} strokeWidth={style.width + 9} opacity={0.18} pointerEvents="none"/>}
    <BaseEdge id={id} path={path} interactionWidth={22} style={{ stroke: color, strokeWidth: style.width, strokeDasharray: style.dash, strokeLinecap: 'round' }}/>
    {appearance.lineType === 'double' && <path className="board-double-gap" d={path} fill="none" stroke="var(--tone-141d28)" strokeWidth={2} pointerEvents="none"/>}
    <EndpointGlyph endpoint={appearance.startMarker} point={start} color={color}/>
    <EndpointGlyph endpoint={appearance.endMarker} point={end} color={color}/>
  </>;
}

export function AtlasEdge(props: EdgeProps) {
  const data = props.data as any;
  const appearance = edgeAppearance(data ?? {});
  const [path, x, y] = getSmoothStepPath({ ...props, borderRadius: 0 });
  return <>
    <EdgeGraphic id={props.id} path={path} color={data?.color ?? '#ba9158'} appearance={appearance} selected={props.selected}
      start={{ x: props.sourceX, y: props.sourceY, position: props.sourcePosition }} end={{ x: props.targetX, y: props.targetY, position: props.targetPosition }}/>
    {props.label && <EdgeLabelRenderer><span className="board-edge-label" style={{ transform: labelTransform(path, x, y, appearance.labelPosition) }}>{props.label}</span></EdgeLabelRenderer>}
  </>;
}
