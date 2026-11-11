# Weapon import and review

This is a development-only importer. It does **not** overwrite the playable JSON,
fetch data during gameplay, or publish anything. The default trial selects 50
weapon identities, prioritizing the curated starter names and then sorting by name.

## Run

```sh
npm run data:import
```

The script reads the current English Bungie Manifest, downloads inventory item and
collectible definitions, and caches the raw files in ignored `.cache/weapon-import/`.
If the Manifest version and table URLs are unchanged, subsequent online runs reuse
those tables. A network connection is required to check for a new version. It uses
public definitions; no account login or stored API credential is involved.

Offline rerun after the first successful download:

```sh
npm run data:import -- --manifest .cache/weapon-import/items.json --collectibles .cache/weapon-import/collectibles.json
```

Use `--limit all --output data/weapon-import/full` for the full catalog. This still
only generates review artifacts; it does not expand the live answer pool.
`--limit 50`, `--overrides path`, and `--output directory` are also supported.
Relative output/override paths are relative to the repository root. Offline input
paths are relative to the current working directory.

## Outputs

- `trial/candidates.json`: Manifest provenance, counts, grouped identities, every
  included item hash, extracted fields, suggestions, and unresolved review items.
- `trial/review.md`: concise review checklist for each selected identity.
- `trial/reviewed-drafts.json`: runtime-shaped drafts for explicitly reviewed
  identities only. These are **not automatically promoted** or guaranteed to have
  local images. No raw Manifest files belong in Git.

Offline runs record the input's SHA-256; online runs record the Manifest version
and table URLs. The same inputs and overrides produce deterministic output.

## What is automatic

The importer keeps non-redacted, non-blacklisted, equippable, instanced weapons of
Legendary or Exotic rarity. It excludes recipes and lower rarities. It groups exact
names after normalizing apostrophes/case and stripping `(Adept)`, `(Timelost)`, or
`(Harrowed)`. Other specially named variants remain separate pending review.

It extracts type, slot, ammo, intrinsic/frame, base damage, icon URL, source text,
and release evidence. Raw source text is **not** automatically mapped to a category.
Item hashes are never used as dates. Watermarks and release traits are evidence,
not proof of first introduction. Frame-based Champion suggestions follow the
known rules, but remain unapproved; Exotic exceptions and multi-element behavior
must be reviewed. Default damage alone is insufficient for Exotics.

Different-element reissues retain separate versions. Curated starter entries are
references, not silently merged into new data. Existing aliases and stable IDs
are preserved when the name matches. Other identity merges require code/rule
review; the importer fails on conflicting generated IDs.

## Manual overrides

`overrides.json` is the tracked source of explicit review decisions. It includes
three examples drawn from our existing curated data: Ammit AR2, The Palindrome,
and Wish-Ender. Selecting Palindrome's Arc hash leaves its other variants visible
in the candidate report.

Each weapon ID may have:

```json
{
  "firstReleaseId": "plunder",
  "currentItemHash": "2119346509",
  "aliases": ["Ammit"],
  "versions": {
    "2119346509": {
      "releaseId": "plunder",
      "source": { "category": "world-loot", "name": "Legendary engrams / Foundry Resonance" },
      "champion": { "basis": "frame", "counters": ["barrier"] },
      "damageTypes": ["solar"]
    }
  }
}
```

Put that object under `weapons.ammit-ar2` in the schema-version-1 override file.
Use string item hashes. Only standard versions can be selected. Unknown fields,
hashes, release IDs, and invalid values fail rather than silently disappearing.
Add missing releases to the release catalog with their actual chronological order.

Review each candidate's current standard item hash, original Destiny 2 release,
version release, original source category, damage types, and effective Champion
counter. Do not infer "latest" from numeric hash order. Add citations in the
runtime dataset when promoting an entry. The generated draft includes an official
item-definition reference, but that alone does not substantiate historical claims.

## Promotion

1. Inspect reviewed drafts against their candidate evidence and references.
2. Download each approved `iconUrl` to the draft's `public/images/weapons/<id>.jpg`
   location (or convert the image/update its extension as needed). Never overwrite
   an existing image without checking whether it is the intended selected version.
3. Merge approved drafts into `src/data/destiny2/weapons.json`, preserving useful
   existing history, aliases, and citations. Avoid replacing the whole file.
4. Run `npm run data:check`, `npm test`, and `npm run build` before committing.

The trial intentionally leaves unresolved weapons out of the game. The playable
gate checks complete clues, release references, and a local image path. Build-time
validation also checks that image files exist and have the expected file headers.

## Sources

- https://github.com/Bungie-net/api/wiki/Obtaining-Destiny-Definitions-%22The-Manifest%22
- https://bungie-net.github.io/multi/schema_Destiny-Definitions-DestinyInventoryItemDefinition.html
- https://www.bungie.net/7/en/News/Article/destiny_update_9_7_0
