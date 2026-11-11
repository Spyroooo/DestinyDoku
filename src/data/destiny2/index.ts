import weaponData from './weapons.json'
import releaseData from './releases.json'
import { weaponReadinessIssues } from '../weapon-readiness'
import type { Release, Weapon, WeaponVersion } from '../../types/weapon'

// JSON shape and cross-references are checked by npm run data:check.
export const weapons = weaponData as Weapon[]
export const releases = releaseData as Release[]

export function getCurrentVersion(weapon: Weapon): WeaponVersion {
  const version = weapon.versions.find((entry) => entry.id === weapon.currentVersionId)
  if (!version) throw new Error(`Missing current version for ${weapon.id}`)
  return version
}

// Ready entries are valid guesses; the game separately excludes unreleased answers.
export const playableWeapons = weapons.filter(
  (weapon) => weaponReadinessIssues(weapon, releases).length === 0,
)
