# Characters

Playable at `/characters` and `/characters/practice`, with a separate daily round at `/characters/daily`. Uses the same presentation as Weapons: image tiles with hover/focus names, an overlay search dropdown, unlimited guesses, newest guesses first, sequential clue reveals, category dialogs and a shareable result grid.

The 67-character catalog is generated from `data/character-research/candidates.json`. Source links for portraits are in `data/character-research/portraits.json`; all images are served locally. Run `node scripts/build-character-data.mjs` after approved research changes. The build validates that the generated catalog is up to date.

Hunter, Titan and Warlock use their distinct class emblems. Additional Hive, Cabal, Scorn and faction artwork comes from [justrealmilk/destiny-icons](https://github.com/justrealmilk/destiny-icons). Files, upstream license and individual source URLs are stored under `public/images/characters/symbols`. The artwork is displayed in white for contrast. Simple custom glyphs cover gender and other values without a suitable mapped Destiny symbol; they are illustrative rather than official lore classifications. Faction emblems are used for explicitly mapped groups, with a generic clan glyph as the fallback.

Clues: being type, gender, class, affiliation, role, debut game and D2 introduction. Affiliation and role use exact-set/overlap/no-overlap comparisons. Deliberately empty gender/affiliation fields compare as gray (unavailable), rather than counting two blanks as matching facts. An exact character guess wins and makes the final row green. Explicit Unknown being-type values remain real game categories. Non-Guardian class labels are normalized to None in the playable catalog.

The first-letter hint unlocks after 3 incorrect guesses; the selected D2 introduction unlocks after 5. Neither is disclosed until clicked. Hints and round progress are saved separately for each mode. Daily puzzles reset at Europe/Zurich midnight, sharing the Weapons calendar/countdown functions, with a distinct character seed and storage namespace. Development edits reset both modes and change the development daily answer without touching production saves or live counters.

## Community counters

The shared client and Worker now support `/characters/daily` and `/characters/practice`. Only completed rounds count. Daily totals are keyed by game in the existing tables. Character practice has separate tables added by migration 0003; Weapons data and deduplication hashes are preserved. Client reporting acknowledgements and offline queues are also isolated by game.

Before publishing the page, apply the new migration to your existing database, then deploy the updated Worker from the project root:

```sh
npx wrangler d1 migrations apply destinydoku-community --remote --config cloudflare/daily-counter/wrangler.jsonc
npm run counter:deploy
```

These commands change the live database/Worker. Implementation and tests do not execute them automatically. The game remains playable if the counter endpoint is unavailable; the counter stays hidden until the service responds. Development and localhost preview never report wins.
