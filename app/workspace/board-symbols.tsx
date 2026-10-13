'use client';
import { type ReactNode } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { lineStyle, lineTypes, markerTypes } from '@/lib/board';

export function SymbolChoice({ label, value, onChange, options, columns }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string; symbol: ReactNode }[]; columns: number }) {
  return <ToggleGroup className="board-symbol-list" type="single" value={value} onValueChange={v => { if (v) onChange(v); }} aria-label={label} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }} spacing={1}>
    {options.map(o => <ToggleGroupItem key={o.value} value={o.value} className="board-symbol-option" aria-label={o.label} title={o.label}>{o.symbol}</ToggleGroupItem>)}
  </ToggleGroup>;
}
export function ShapeChoices({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const options = [{ value: 'rectangle', label: 'Прямоугольник' }, { value: 'rounded', label: 'Скруглённый блок' }, { value: 'circle', label: 'Круг' }];
  return <SymbolChoice label="Форма блока" value={value} onChange={onChange} columns={3} options={options.map(o => ({ ...o, symbol: <svg aria-hidden="true" viewBox="0 0 42 32" fill="none" stroke="currentColor" strokeWidth={2}>{o.value === 'circle' ? <circle cx={21} cy={16} r={12}/> : <rect x={5} y={4} width={32} height={24} rx={o.value === 'rounded' ? 7 : 0}/>}</svg> }))}/>;
}
export function LineChoices({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <SymbolChoice label="Тип линии связи" value={value} onChange={onChange} columns={3} options={lineTypes.map(o => ({ ...o, symbol: <svg aria-hidden="true" viewBox="0 0 44 24" fill="none" stroke="currentColor" strokeLinecap="round">
    <path d={o.value === 'double' ? 'M4 9H40 M4 15H40' : 'M4 12H40'} strokeWidth={o.value === 'double' ? 2 : lineStyle(o.value).width} strokeDasharray={lineStyle(o.value).dash}/>
  </svg> }))}/>;
}
export function MarkerChoices({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <SymbolChoice label={label} value={value} onChange={onChange} columns={2} options={markerTypes.map(o => ({ ...o, symbol: <svg aria-hidden="true" viewBox="0 0 44 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    {o.value === 'arrow' && <><path d="M6 12H28"/><path d="M28 12L18 6L18 18Z" fill="currentColor" stroke="none"/></>}
    {o.value === 'cross' && <path d="M17 7L27 17 M17 17L27 7"/>}
    {o.value === 'circle' && <circle cx={22} cy={12} r={6}/>}
    {o.value === 'diamond' && <path d="M22 5L29 12L22 19L15 12Z"/>}
  </svg> }))}/>;
}
