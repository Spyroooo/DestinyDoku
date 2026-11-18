import data from '../../data/destiny2/characters.json'
import type { Character, CharacterRelease } from '../../types/character'

export const characters = data.characters as Character[]
export const releases: CharacterRelease[] = data.releases
