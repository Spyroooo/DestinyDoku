export type Edition = 'destiny2' | 'destiny1'
export type WeaponSlot = 'kinetic' | 'energy' | 'power'
export type AmmoType = 'primary' | 'special' | 'heavy'
export type DamageType = 'kinetic' | 'arc' | 'solar' | 'void' | 'stasis' | 'strand'
export type ChampionType = 'barrier' | 'overload' | 'unstoppable'
export type WeaponRarity = 'legendary' | 'exotic'
export type WeaponType =
  | 'auto-rifle' | 'scout-rifle' | 'pulse-rifle' | 'hand-cannon'
  | 'submachine-gun' | 'sidearm' | 'combat-bow' | 'shotgun'
  | 'sniper-rifle' | 'fusion-rifle' | 'linear-fusion-rifle'
  | 'trace-rifle' | 'grenade-launcher' | 'rocket-launcher'
  | 'machine-gun' | 'sword' | 'glaive'
export type SourceCategory =
  | 'world-loot' | 'raid' | 'dungeon' | 'quest' | 'seasonal'
  | 'crucible' | 'gambit' | 'nightfall' | 'activity' | 'event'

export interface Release {
  id: string
  edition: Edition
  name: string
  kind: 'base-game' | 'expansion' | 'season' | 'episode' | 'update'
  year: number
  /** Chronological ordering within the edition; gaps are intentional. */
  order: number
}

export interface WeaponVersion {
  id: string
  /** Release that introduced this selected item version, not its latest patch. */
  releaseId: string
  weaponType: WeaponType
  slot: WeaponSlot
  ammoType: AmmoType
  /** Damage available on this version, never elements merged across reissues. */
  damageTypes: DamageType[]
  /** Legendary frame name, or the Exotic's intrinsic perk name. */
  frame: string
  champion: {
    /** null means unverified, never "no counter". */
    counters: ChampionType[] | null
    basis: 'frame' | 'exotic-intrinsic'
  }
  /** Origin of this item version, not a live list of all acquisition routes. */
  source: { category: SourceCategory; name: string }
  referenceUrls: string[]
  notes?: string
}

export interface Weapon {
  id: string
  name: string
  edition: Edition
  rarity: WeaponRarity
  aliases: string[]
  firstReleaseId: string
  /** Explicit selection prevents array order from deciding the answer's clues. */
  currentVersionId: string
  /** Selected versions only; this is not a complete historical archive. */
  versions: WeaponVersion[]
  icon?: string
}
