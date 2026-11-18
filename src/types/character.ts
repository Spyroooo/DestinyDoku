export type CharacterRelease = { id: string; name: string; year: number; seasonNumber: number; order: number }
export type Character = {
  id: string
  edition: 'destiny2'
  name: string
  aliases: string[]
  icon: string
  species: string
  gender: string | null
  guardianClass: string
  affiliations: string[] | null
  roles: string[]
  debutGame: 'destiny1' | 'destiny2'
  firstReleaseId: string
}
