export const backgroundPresets = [
  { id: 'none', name: 'Без фона', image: 'none' },
  { id: 'parchment', name: 'Пергамент', image: 'radial-gradient(ellipse at 20% 15%, #ead8b5 0%, transparent 55%), repeating-linear-gradient(18deg, #c2a87918 0 1px, transparent 1px 7px), linear-gradient(130deg, #8d7557, #dfc797 55%, #967852)' },
  { id: 'forest', name: 'Сумеречный лес', image: 'repeating-linear-gradient(85deg, transparent 0 70px, #0b231b88 71px 92px, transparent 94px 140px), radial-gradient(ellipse at 65% 10%, #668f7a, transparent 65%), linear-gradient(160deg, #203e3a, #0e2021)' },
  { id: 'stars', name: 'Звёздное небо', image: 'radial-gradient(1px 1px at 12% 17%, #fff 99%, transparent), radial-gradient(2px 2px at 78% 30%, #dfd6b8 99%, transparent), radial-gradient(1px 1px at 42% 72%, #fff 99%, transparent), radial-gradient(ellipse at 60% 45%, #564775, transparent 70%), linear-gradient(150deg, #101c35, #151020)' },
  { id: 'stone', name: 'Древний камень', image: 'repeating-linear-gradient(0deg, transparent 0 78px, #2229 79px 82px), repeating-linear-gradient(90deg, transparent 0 148px, #2228 149px 152px), linear-gradient(135deg, #647078, #42454c 60%, #79736b)' },
] as const;
export type CampaignBackground = ({ type: 'preset'; preset: typeof backgroundPresets[number]['id'] } | { type: 'image'; src: string }) & { transparency?: number };
export function backgroundTransparency(background?: CampaignBackground): number {
  return typeof background?.transparency === 'number' && Number.isFinite(background.transparency)
    ? Math.min(100, Math.max(0, background.transparency)) : 50;
}
export function backgroundImage(background?: CampaignBackground): string {
  if (background?.type === 'image' && /^\/api\/assets\/[a-zA-Z0-9_-]+$/.test(background.src)) return `url("${background.src}")`;
  return backgroundPresets.find(p => p.id === (background?.type === 'preset' ? background.preset : 'none'))?.image ?? 'none';
}
