import weaponData from './weapons.json'
import releaseData from './releases.json'
import type { Release, Weapon, WeaponVersion } from '../../types/weapon'

// JSON shape and cross-references are checked by npm run data:check.
export const weapons = weaponData as Weapon[]
export const releases = releaseData as Release[]

export function getCurrentVersion(weapon: Weapon): WeaponVersion {
  const version = weapon.versions.find((entry) => entry.id === weapon.currentVersionId)
  if (!version) throw new Error(`Missing current version for ${weapon.id}`)
  return version
}

// Incomplete research entries stay available for editing, but not for guessing.
export const playableWeapons = weapons.filter(
  (weapon) => getCurrentVersion(weapon).champion.counters !== null,
)
