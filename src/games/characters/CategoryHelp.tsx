import { useEffect, useRef } from 'react'
import type { Column } from './logic'

export type HelpCategory = Column | 'character'
type Help = { title: string; description: string; rules: string[]; examples: { title: string; text: string }[] }
const help: Record<HelpCategory, Help> = {
  character: { title: 'Character', description: 'The portrait identifies your guess. Hover or focus it to read the name.', rules: ['Newest guesses appear first; the badge shows the original guess number.', 'You must identify the character to win. Shared attributes alone do not count.', 'Crow and Uldren are one entry. Clovis’s Europa AI and Banshee-44 are separate entries.'], examples: [] },
  species: { title: 'Being type', description: 'The recognizable identity or being type selected for this character.', rules: ['The same type is green; a different type is red.', 'Awoken and Exo are separate categories. Temporary transformations do not necessarily replace the familiar identity.', 'Unknown is an intentional category. Labels such as Tormentor, Ascendant Soul and Paracausal entity are curated gameplay classifications.'], examples: [{ title: 'Human / Awoken / Exo', text: 'Eris is Human, Asher is Awoken, and Cayde and Clovis’s Europa head are Exo in this game.' }] },
  gender: { title: 'Gender', description: 'The recorded identity or presentation used in this curated roster.', rules: ['Matching values are green and different values are red.', 'An unrecorded value produces a gray comparison, unless you guessed the correct character.', 'AI presentation uses the agreed gender label; no gender is inferred from a voice actor.'], examples: [] },
  guardianClass: { title: 'Class', description: 'Guardian class or the broader Lightbearer category selected for this character.', rules: ['Titan, Hunter and Warlock include established former classes after loss of Light.', 'The Drifter is a Rogue Lightbearer. Savathûn and Luzaku are Hive Lightbearers.', 'None means no applicable Guardian class. Ghosts do not inherit their partner’s class.', 'The same category is green; other categories are red.'], examples: [] },
  affiliations: { title: 'Affiliation', description: 'The principal groups associated with the character in this roster.', rules: ['Green means identical sets, yellow means some overlap, and red means no overlap.', 'A deliberately unrecorded affiliation produces a gray comparison, not a false match with another blank.', 'This is a curated snapshot, not a list of every faction ever joined.'], examples: [] },
  roles: { title: 'Role', description: 'Short labels describing the character’s activities and story functions.', rules: ['Characters can have multiple roles, such as Guardian, Vendor, Leader or Researcher.', 'Green means the complete sets match, yellow means at least one shared role, and red means no shared role.', 'Vendor is a role, not a Guardian class.'], examples: [] },
  debutGame: { title: 'Debut game', description: 'The first Destiny game in which the character actually appeared.', rules: ['Destiny 1 and Destiny 2 are separate values. Lore mentions alone do not count.', 'Merged identities include their earlier incarnation.', 'This is separate from the selected Destiny 2 introduction release.'], examples: [] },
  release: { title: 'D2 introduction', description: 'The agreed Destiny 2 introduction used for this character’s clue.', rules: ['The same release is green. A different release in the same calendar year is yellow; a different year is red.', 'Arrows point toward the answer’s release: up means later, down means earlier.', 'Selected living or revealed introductions take precedence over earlier corpses or disguised/proxy appearances.', 'Reprised raids count for Oryx in S18 and Crota in S22. Starhorse uses the S15 Dares introduction.'], examples: [{ title: 'Saint-14', text: 'S9: Season of Dawn is used for his living introduction, rather than the earlier corpse in Curse of Osiris.' }] },
}

export default function CategoryHelp({ category, onClose }: { category: HelpCategory; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const content = help[category]
  useEffect(() => {
    const element = dialog.current!
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // StrictMode replays effects in development. Keep the dialog open during
    // that replay: close() would queue an onClose event that dismisses it again.
    if (!element.open) element.showModal()
    element.querySelector<HTMLHeadingElement>('h2')?.focus({ preventScroll: true })
    element.scrollTop = 0
    // Removing the dialog from the DOM closes it on unmount.
    return () => { document.body.style.overflow = previousOverflow }
  }, [])
  return (
    <dialog ref={dialog} className="category-dialog" aria-labelledby="category-title" onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close() }}>
      <div className="category-dialog-content">
        <p className="eyebrow">Category guide</p>
        <h2 id="category-title" tabIndex={-1}>{content.title}</h2>
        <p>{content.description}</p>
        <ul>{content.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
        <div className="category-examples">{content.examples.map((example) => (
          <article key={example.title}><h3>{example.title}</h3><p>{example.text}</p></article>
        ))}</div>
      </div>
      <form method="dialog" className="category-dialog-footer"><button>Got it</button></form>
    </dialog>
  )
}
