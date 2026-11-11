import { useEffect, useRef } from 'react'
import type { Column } from './logic'

export type HelpCategory = Column | 'weapon'
type Help = { title: string; description: string; rules: string[]; examples: { title: string; text: string }[] }
const help: Record<HelpCategory, Help> = {
  weapon: {
    title: 'Weapon', description: 'This tile identifies the weapon you guessed, using its inventory thumbnail.',
    rules: ['Hover over the image or focus it with your keyboard to see its name.', 'The newest guess appears first. The small number shows its original guess number.', 'You win by naming the hidden weapon. Matching every clue alone does not count as a win.'],
    examples: [{ title: 'One answer per name', text: 'Reissues and Adept variants are grouped under one weapon name. Comparisons use the selected current version.' }],
  },
  type: {
    title: 'Weapon type', description: 'The weapon family describes how the weapon fires, independently of its ammo or equipment slot.',
    rules: ['Green means the same weapon family. Other families are red.', 'Frames such as Adaptive and Precision are not separate weapon types here.'],
    examples: [{ title: 'Auto Rifle', text: 'Examples in this pool include Ammit AR2 and Gnawing Hunger.' }, { title: 'Fusion / Linear Fusion', text: 'These are distinct types even though their illustrative silhouettes are shared.' }],
  },
  ammo: {
    title: 'Ammo type', description: 'The ammunition the weapon consumes: Primary, Special, or Heavy.',
    rules: ['Green means the same ammo type; otherwise the tile is red.', 'Ammo type is separate from weapon type, damage type, and equipment slot.'],
    examples: [{ title: 'Primary', text: 'Examples: Ammit AR2 and Wish-Ender.' }, { title: 'Special', text: 'Examples: Riptide and Heritage.' }, { title: 'Heavy', text: 'Examples: Thunderlord and Leviathan’s Breath.' }],
  },
  slot: {
    title: 'Slot', description: 'The equipment slot occupied by the selected weapon version.',
    rules: ['Kinetic, Energy, and Power are the three slot values.', 'The same slot is green. A different slot is red.', 'A Kinetic-slot weapon does not necessarily deal Kinetic damage.'],
    examples: [{ title: 'Kinetic', text: 'Riptide occupies this slot while dealing Stasis damage.' }, { title: 'Energy', text: 'Examples include Funnelweb and The Palindrome.' }, { title: 'Power', text: 'Examples include Thunderlord and Apex Predator.' }],
  },
  damage: {
    title: 'Damage type', description: 'The damage types available on a single selected weapon version.',
    rules: ['Green: the complete sets match, regardless of order.', 'Yellow: at least one damage type overlaps, but the sets differ. Red: no overlap.', 'Built-in firing modes, multi-element projectiles, and fixed catalyst conversions are included. Variable-element drops use their supported element set.', 'Subclass buffs, incidental kill-triggered explosions, reflected attacks, optional random-roll conversion perks, and ordinary Glaive melee do not add elements here.', 'Different elements from historical reissues are never combined into one set.'],
    examples: [{ title: 'Single damage type', text: 'The selected Palindrome is Arc; its older Void version does not make this a multi-element answer.' }, { title: 'Multiple damage types', text: 'Hard Light switches between Arc, Solar, and Void. Conditional Finality fires Stasis and Solar pellets.' }, { title: 'Catalyst conversion', text: 'Quicksilver Storm is Kinetic without its catalyst and Strand with it, so both are included.' }],
  },
  rarity: {
    title: 'Rarity', description: 'The weapon’s item rarity, rather than its gear tier or release source.',
    rules: ['This starter game includes Legendary and Exotic weapons only.', 'The same rarity is green; a different rarity is red.', 'A seasonal or tiered weapon can still be Legendary.'],
    examples: [{ title: 'Legendary', text: 'Purple rarity, such as Funnelweb or Deliverance.' }, { title: 'Exotic', text: 'Gold rarity, such as Wish-Ender or Thunderlord.' }],
  },
  source: {
    title: 'Source category', description: 'The broad acquisition category recorded for the selected weapon version.',
    rules: ['Green means the same category, even when the exact activity differs.', 'This records one curated acquisition source. Available Exotic quests or missions are preferred; a verified Exotic Archive purchase can replace a removed source.', 'A removed quest alone does not establish Archive availability. Reissued weapons are checked separately from archived older versions.', 'Reissues may have a different source from the original weapon.'],
    examples: [{ title: 'Raid', text: 'Last Wish and Deep Stone Crypt both count as Raid.' }, { title: 'Season Pass', text: 'Season or reward pass weapons, including pass Exotics. This is separate from seasonal activity loot.' }, { title: 'Vendor', text: 'Weapons originating from direct vendor purchases. A later vendor sale alone does not replace an established activity origin.' }, { title: 'Tenet Engram', text: 'Weapons sourced from the Monument of Triumph Tenet weapon engrams. Direct Tenet purchases use Vendor.' }, { title: 'Exotic Archive', text: 'Monument to Lost Lights in the Tower, including verified Legacy Gear weapons. This is different from the Quest Archive terminal and the Monument of Triumph Tenet vendors.' }, { title: 'Unreleased', text: 'Exists in the game files but was never obtainable. These discoveries can be guessed and reveal an Easter egg, but cannot be hidden answers.' }, { title: 'Other categories', text: 'World Loot, Dungeon, Quest, Seasonal, Crucible, Gambit, Nightfall, Activity, and Event are distinct values.' }],
  },
  champion: {
    title: 'Champion counter', description: 'The built-in anti-Champion capability of the selected weapon version in the current sandbox.',
    rules: ['Counters are Barrier, Overload, and Unstoppable.', 'The complete counter sets must match for green; otherwise the tile is red.', 'Frame-based capabilities and Exotic intrinsic exceptions are included. Optional random-roll perks, external buffs, and subclass effects are excluded.'],
    examples: [{ title: 'Frame capability', text: 'Ammit AR2’s Precision Frame provides Barrier capability in this dataset.' }, { title: 'Exotic exception', text: 'Wish-Ender has its own built-in Barrier capability.' }],
  },
  release: {
    title: 'First introduced', description: 'The weapon’s original Destiny 2 release, including its season number and calendar year.',
    rules: ['Green: the exact release matches.', 'Yellow: a different release in the same calendar year. Red: a different calendar year.', '↑ means the answer was introduced later; ↓ means earlier. Arrows still appear on yellow tiles.', 'S4 means Season 4. Updates can share a season number while remaining separate releases.', 'Reissues do not change first introduction, and Destiny 1 appearances do not determine this clue.', 'Unreleased discoveries show Unreleased instead of a date; their internal catalogue era is not a real launch date.'],
    examples: [{ title: 'Same year, different release', text: 'Season of the Haunted and Season of Plunder are different releases in 2022, so they produce yellow.' }, { title: 'Original introduction', text: 'Gnawing Hunger uses Season of the Drifter, even though the selected version is a later reissue.' }],
  },
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
