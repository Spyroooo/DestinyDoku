import type { Weapon } from '../../types/weapon'
import { currentVersion } from './logic'
import type { Column } from './logic'

const weaponIcons: Record<string, string> = {
  'auto-rifle': 'auto_rifle', 'scout-rifle': 'scout_rifle', 'pulse-rifle': 'pulse_rifle',
  'hand-cannon': 'hand_cannon', 'submachine-gun': 'smg', sidearm: 'sidearm',
  'combat-bow': 'bow', shotgun: 'shotgun', 'sniper-rifle': 'sniper_rifle',
  'fusion-rifle': 'fusion_rifle', 'linear-fusion-rifle': 'fusion_rifle',
  'trace-rifle': 'trace_rifle', 'grenade-launcher': 'grenade_launcher',
  'rocket-launcher': 'rocket_launcher', 'machine-gun': 'machinegun', sword: 'sword_heavy', glaive: 'glaive',
}

export function assetUrl(path: string) {
  return `${import.meta.env.BASE_URL}${path}`
}

export default function ClueIcons({ column, weapon }: { column: Column; weapon: Weapon }) {
  const version = currentVersion(weapon)
  let icons: string[]
  switch (column) {
    case 'type': icons = [weaponIcons[version.weaponType]]; break
    case 'ammo': icons = [`ammo-${version.ammoType}`]; break
    case 'damage': icons = version.damageTypes.map((type) => `damage_${type}${type === 'strand' ? '.png' : ''}`); break
    case 'slot': icons = [version.slot === 'kinetic' ? 'damage_kinetic' : `${version.slot}_weapon`]; break
    case 'rarity': icons = ['engram']; break
    case 'champion': icons = (version.champion.counters ?? []).map((counter) => ({ barrier: 'pierce', overload: 'overload', unstoppable: 'stagger' })[counter]); break
    case 'source': icons = [version.source.category === 'raid' ? 'raid' : version.source.category === 'quest' || version.source.category === 'dungeon' ? 'quest' : version.source.category === 'nightfall' ? 'strike' : 'ghost']; break
    case 'release': icons = ['collections']; break
  }
  return (
    <span className={`clue-icons icons-${column} ${column === 'ammo' ? `ammo-${version.ammoType}` : ''} ${column === 'rarity' ? `rarity-${weapon.rarity}` : ''}`} aria-hidden="true">
      {icons.map((icon) => <img key={icon} className={icon === 'damage_stasis' ? 'stasis-symbol' : ['damage_arc', 'damage_solar', 'damage_void', 'damage_strand.png', 'ammo-special', 'ammo-heavy', 'ammo-primary'].includes(icon) ? undefined : 'white-symbol'} src={assetUrl(`images/categories/${icon}${icon.endsWith('.png') ? '' : '.svg'}`)} alt="" width="30" height="30" />)}
    </span>
  )
}
