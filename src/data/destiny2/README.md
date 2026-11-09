# Destiny 2 starter weapon data

This manually curated starter dataset contains 18 weapons: 13 Legendary and five
Exotic. Seventeen are in the ready pool. Hard Light demonstrates multiple damage
types, but its Champion counter remains unverified and is excluded from that pool.

## Files and use

- `weapons.json`: weapon identities, aliases, and selected versions.
- `releases.json`: only the releases used by this dataset, in chronological order.
- `index.ts`: typed exports, `getCurrentVersion`, and `playableWeapons`.
- `../../types/weapon.ts`: the data contract.

The Weapons page can import `playableWeapons` from this directory when we build
the game. Nothing fetches Bungie data at runtime. These files live in Git and will
be bundled by Vite when imported by the game. Player progress belongs in
localStorage, separately from this dataset.

## Comparison rules

1. One answer per weapon name within an edition. Adept variants are not separate answers.
2. Use `currentVersionId` for comparison attributes; never rely on array order.
3. Show `firstReleaseId` as **First introduced**, meaning first release in Destiny 2.
   Exact releases are green; different releases in the same calendar year are
   yellow; different years are red. Arrows point toward the answer’s release.
4. A version's `releaseId` means the selected item version's introduction. A patch
   updating its perks or tier support need not create another version here.
5. Store different reissue elements separately. The Palindrome includes its legacy
   Void and selected Arc versions; only Arc is used for current comparisons.
6. Multiple `damageTypes` mean that one version can produce those damage types.
   Hard Light is the example; do not merge historical elements into this array.
7. Champion counters use the current sandbox, even for retained legacy versions.
   Include the built-in frame or Exotic capability, excluding optional random-roll
   perks, external buffs, and subclass effects. `null` means unverified, not none.
8. Source is the selected version's origin, not a live availability tracker. For
   example, Thunderlord records its original event quest rather than its later
   Exotic-engram availability. Frame names on Exotics contain their intrinsic perk
   names; `champion.basis` describes how the counter was assigned separately.

## Research and limitations

Curated on 2026-11-09. Each version includes reference URLs. Main references:

- [Bungie's Anti-Champion 2.0 rules](https://www.bungie.net/7/en/News/Article/destiny_update_9_7_0)
- [Bungie's Manifest documentation](https://github.com/Bungie-net/api/wiki/Obtaining-Destiny-Definitions-%22The-Manifest%22)
- [Light.gg item definitions](https://www.light.gg/db/)

This is a starter selection, not a full Manifest import or exhaustive version
history. Some item pages could only be checked through indexed search extracts.
Review individual entries against the live Manifest/in-game inspection before a
public daily challenge. Structural validation cannot prove factual correctness.

Hard Light has conflicting indexed Champion labels between Light.gg and
Masterworked. Its counter is intentionally null until confirmed. Weapon icons are stored in `public/images/weapons`; JSON paths are relative to
the Vite base URL. Asset credits are in `public/images/CREDITS.md`.

Gnawing Hunger's first introduction is Season of the Drifter; Arrivals was a
reissue. Edition-specific release history must stay separate from Destiny 1.

## Editing and validation

Add a release when needed, keeping its ID stable and `order` chronological. Add a
weapon or version using the existing shape and document unusual behavior in
`notes`. Update `currentVersionId` explicitly when selecting a newer version.

Run `npm run data:check` after editing. It checks the JSON against the TypeScript
types and validates IDs, release references, chronology, selected versions,
damage types, Champion counters, and reference URLs. It also runs during
`npm run build`. No dependencies or credentials are needed beyond the project's
existing development dependencies.

Later, an importer can download Manifest definitions during development and
generate candidate changes. Keep manual identity grouping, release history,
aliases, and exceptions separate from raw imports and review updates before
committing. Do not commit API credentials or replace this curated file blindly.
