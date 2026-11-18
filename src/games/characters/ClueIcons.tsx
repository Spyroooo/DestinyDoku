import type { Character } from '../../types/character'
import { assetUrl } from '../weapons/assets'
import type { Column } from './logic'

const symbols = '/images/characters/symbols/'
const classSymbols: Record<string, string> = {
  Hunter: 'class_hunter_proportional.svg',
  Titan: 'class_titan_proportional.svg',
  Warlock: 'class_warlock_proportional.svg',
}
const factionSymbols: Record<string, string> = {
  Vanguard: 'faction_vanguard.svg', Crucible: 'faction_crucible.svg',
  'Iron Lords': 'faction_ironbanner.svg', 'Cult of Osiris': 'faction_osiris.svg',
  'Royal Awoken Guard': 'faction_queens_wrath.svg', Reef: 'faction_queens_wrath.svg',
  'The Nine': 'faction_thenine.svg', VI: 'faction_thenine.svg',
  'Future War Cult': 'faction_fwc.svg',
  'Black Armory': 'black_armory.svg', 'Clovis Bray': 'clovis_bray.svg', 'House Bray': 'clovis_bray.svg',
  'House of Judgment': 'fallen_judgement.svg', 'House of Light': 'fallen_light.svg',
  'House of Spider': 'fallen_spider.svg', 'Red Legion': 'faction_red_legion.svg',
  Scorn: 'fallen_scorn.svg', 'Revenant Scorn': 'fallen_scorn.svg',
}
const speciesSymbols: Record<string, string> = { Hive: 'hive.svg', Cabal: 'cabal-gold.svg', Scorn: 'fallen_scorn.svg', Vex: 'vex.svg' }
const speciesGlyphs: Record<string, string> = { Human: 'person', Awoken: 'awoken', Exo: 'exo', Frame: 'exo', AI: 'ai', Servitor: 'servitor', 'Servitor/Brig': 'servitor', Unknown: 'unknown', 'Ascendant Soul': 'soul' }
const releaseSymbols: Record<string, string> = { warmind: 'warmind.svg', forge: 'black_armory.svg', splicer: 'splicer.svg' }
const paths: Record<string, string> = {
  person: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  awoken: 'M15 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 3l1.5 3L23 7.5 20.5 9 19 12l-1.5-3L15 7.5 17.5 6 19 3Z',
  exo: 'M5 6h14v14H5V6Zm7 0V2m-5 9h3m4 0h3m-8 5h6M2 10v6m20-6v6',
  ai: 'M6 6h12v12H6V6Zm3 3h6v6H9V9ZM9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4',
  servitor: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-6a4 4 0 1 0 0-8 4 4 0 0 0 0 8M2 12h6m8 0h6M12 2v6m0 8v6',
  male: 'M17 2h5v5m0-5-7 7M10 21a7 7 0 1 0 0-14 7 7 0 0 0 0 14',
  female: 'M12 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12m0 0v8m-4-4h8',
  nonbinary: 'M12 22a6 6 0 1 0 0-12 6 6 0 0 0 0 12m0-12V1m-4 1 8 6m0-6-8 6',
  unknown: 'M9 8a3 3 0 1 1 5 2.3c-1.5 1-2 1.7-2 3.7m0 4h.01M12 23a11 11 0 1 0 0-22 11 11 0 0 0 0 22',
  none: 'M5 12h14',
  entity: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z',
  soul: 'M12 3c-6 5-8 8-8 11a8 8 0 0 0 16 0c0-3-2-6-8-11Zm-3 11h.01m6 0h.01m-6 4h6',
  book: 'M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3V4Zm9 2v15',
  vendor: 'M4 7h16v15H4V7Zm4 0V5a4 4 0 0 1 8 0v2',
  leader: 'm3 5 4 5 5-7 5 7 4-5-2 14H5L3 5Zm3 10h12',
  compass: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm5-17-3 9-9 3 3-9 9-3Z',
  pyramid: 'M12 2 1 21h22L12 2Zm0 0v19',
  calendar: 'M4 5h16v16H4V5Zm3-3v6m10-6v6M4 10h16m-12 4h2m4 0h2m-8 3h2',
}
function Glyph({ name }: { name: string }) {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name] ?? paths.entity} /></svg>
}
function Pictures({ names }: { names: string[] }) {
  return <>{[...new Set(names)].map(name => <img key={name} src={assetUrl(`${symbols}${name}`)} alt="" width="30" height="30" className="white-symbol" />)}</>
}
export default function ClueIcons({ column, character }: { column: Column; character: Character }) {
  let content
  switch (column) {
    case 'guardianClass':
      content = classSymbols[character.guardianClass] ? <Pictures names={[classSymbols[character.guardianClass]]} />
        : character.guardianClass === 'Hive Lightbearer' ? <Pictures names={['hive.svg', 'light.svg']} />
        : character.guardianClass === 'Rogue Lightbearer' ? <Pictures names={['light.svg']} /> : <Glyph name="none" />
      break
    case 'gender':
      content = <Glyph name={character.gender === 'Male' ? 'male' : character.gender === 'Female' ? 'female' : character.gender === 'Non-binary' ? 'nonbinary' : character.gender === 'Not applicable' ? 'none' : 'unknown'} />
      break
    case 'species': {
      const image = speciesSymbols[character.species]
      content = image ? <Pictures names={[image]} /> : character.species === 'Ghost'
        ? <img src={assetUrl('/images/categories/ghost.svg')} alt="" width="30" height="30" className="white-symbol" />
        : <Glyph name={speciesGlyphs[character.species] ?? 'entity'} />
      break
    }
    case 'affiliations': {
      const images = (character.affiliations ?? []).map(group => factionSymbols[group]).filter(Boolean)
      content = !character.affiliations ? <Glyph name="unknown" /> : <Pictures names={images.length ? images : ['clan.svg']} />
      break
    }
    case 'roles':
      content = character.roles.includes('Vendor') ? <Glyph name="vendor" />
        : character.roles.includes('Warmind') ? <Pictures names={['warmind.svg']} />
        : character.roles.includes('Cryptarch') ? <Pictures names={['faction_cryptarch.svg']} />
        : character.roles.includes('Gunsmith') ? <Pictures names={['gunsmith_materials.svg']} />
        : character.roles.includes('Splicer') ? <Pictures names={['splicer.svg']} />
        : character.roles.includes('Leader') ? <Glyph name="leader" />
        : character.roles.includes('Disciple') ? <Glyph name="pyramid" />
        : character.roles.some(role => ['Researcher', 'Scribe', 'Investigator'].includes(role)) ? <Glyph name="book" />
        : <Glyph name="compass" />
      break
    case 'debutGame':
      content = <span className="character-game-symbol"><img src={assetUrl('/images/categories/destiny.svg')} alt="" width="28" height="28" className="white-symbol" /><span>{character.debutGame === 'destiny1' ? 'I' : 'II'}</span></span>
      break
    case 'release': {
      const image = releaseSymbols[character.firstReleaseId]
      content = image ? <Pictures names={[image]} /> : <Glyph name="calendar" />
      break
    }
  }
  return <span className={`clue-icons character-clue-icon character-icons-${column}`} aria-hidden="true">{content}</span>
}
