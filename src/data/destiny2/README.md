# Destiny 2 weapon catalogue

The catalogue contains all 1,105 grouped weapon names from the reviewed Manifest:
1,102 eligible answers and three Unreleased discoveries that are valid guesses
only. Bushwhacker, Timecard and Traitor's Fate retain the Unreleased source from
the approved reviews. Their internal catalogue era is not a real launch date.

## Files and use

- `weapons.json`: identities, aliases, local thumbnails and selected versions.
- `releases.json`: edition-specific releases in chronological order.
- `index.ts`: typed exports, `getCurrentVersion` and ready `playableWeapons` guesses.
- `../../types/weapon.ts`: the data contract.

Vite bundles the reviewed local data; the game makes no live Bungie requests.
Player progress is stored separately in browser localStorage. The game filters
Unreleased entries out of answer selection while retaining them in search and
history. They also cannot become hidden answers through restored saves.

## Comparison rules

1. One identity per name and edition; Adept variants are grouped.
2. `currentVersionId` explicitly selects the version used for clues.
3. `firstReleaseId` records original Destiny 2 introduction. Exact releases match;
   different releases in the same calendar year are partial. Unreleased guesses
   show Unreleased rather than a date.
4. A selected version's `releaseId` is its introduction, not its latest perk patch.
5. Historical reissue elements are separate. Supported current firing modes and
   fixed catalyst element conversion can create multi-element damage sets.
   Incidental secondary explosions and external buffs do not add clue elements.
6. Champion clues use current frame capabilities and Exotic exceptions, excluding
   optional random-roll perks and external buffs. `null` means unverified.
7. Source is one curated acquisition source for the selected version. Reviewed
   current mission sources and verified Exotic Archive fallbacks are included;
   this is not an exhaustive live list of every acquisition route. An archived
   older definition does not establish a reissue's source.

## Review provenance

The original starter selection has been expanded through the development importer
and the local checker. Raw definitions, reference mappings, research decisions,
user-approved proposals and saved checker reviews are kept separately. The final
103 checker reviews were approved and promoted on 11 November 2026. Their selected
fields are preserved in `data/weapon-import/research/user-confirmations.json`.

See `data/weapon-import/research/README.md` and `audit.json` at the repository root
for the Manifest version, field-specific evidence and review policy. Original
release proposals accepted by the user remain distinguishable from independently
corroborated history. This is a grouped identity catalogue, not an archive of
every historical item definition.

Icons live under `public/images/weapons`; JSON paths are relative to Vite's base
URL. Asset credits are in `public/images/CREDITS.md`.

## Editing and validation

Use `npm run data:check` after editing. It checks every entry against the actual
TypeScript types independently, then checks catalogue-wide uniqueness, release
references, chronology, selected versions, damage, counters, URLs and images.
Independent declarations avoid TypeScript's giant-array union complexity limit
without weakening validation. This check also runs during `npm run build`.

Use `npm run data:import` for development imports; generated candidates remain
separate from game data. See `data/weapon-import/README.md` for the importer and
review workflow. The local checker stays Git-ignored and is not deployed.
