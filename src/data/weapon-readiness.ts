import type { Release, Weapon } from '../types/weapon'

/** Runtime guard as well as an import gate: incomplete entries never become answers. */
export function weaponReadinessIssues(weapon: Weapon, releases: Release[]): string[] {
  const issues: string[] = []
  const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
  if (!nonempty(weapon.id) || !nonempty(weapon.name)) issues.push('identity')
  const first = releases.find((release) => release.id === weapon.firstReleaseId && release.edition === weapon.edition)
  if (!first) issues.push('first release')
  if (!nonempty(weapon.icon) || !/^images\/weapons\/[a-z0-9-]+\.(jpg|png|webp)$/.test(weapon.icon)) issues.push('local weapon icon')
  const current = weapon.versions.find((version) => version.id === weapon.currentVersionId)
  if (!current) return [...issues, 'current version']
  const release = releases.find((entry) => entry.id === current.releaseId && entry.edition === weapon.edition)
  if (!release || (first && release.order < first.order)) issues.push('version release')
  if (!nonempty(current.weaponType) || !nonempty(current.slot) || !nonempty(current.ammoType)) issues.push('weapon attributes')
  if (!current.damageTypes?.length || current.damageTypes.some((value) => !nonempty(value))) issues.push('damage types')
  if (!nonempty(current.frame)) issues.push('frame')
  if (!current.champion?.counters?.length) issues.push('Champion counters')
  if (!nonempty(current.source?.category) || !nonempty(current.source?.name)) issues.push('source')
  if (!current.referenceUrls?.length) issues.push('references')
  return issues
}
