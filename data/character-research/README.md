# Character research

The approved roster contains **67 characters** and seven clue fields. Location has been removed because it is difficult to define consistently for non-vendors. This research dataset is the editable source for the playable Characters game; the frontend uses a compact generated catalog rather than bundling these research notes.

- [Overview](overview.md): all names and clue values, with uncertainty marked in the table.
- [Manual review](review.md): only the proposed or empty fields that need your attention.
- [Editable data](candidates.json): values, aliases, field-level sources, review statuses and explanations.

## Editing values

Every field has `value`, `status`, `sources` and `note`. Change the `value` directly in `candidates.json`; use arrays for affiliations and roles. Unresolved values are `null` with `missing` status. User-confirmed Unknown labels are explicit gameplay categories. A `null` with `confirmed` status is an intentional blank, not unresolved research.

User decisions have `confirmedBy: "user"`, and the earlier proposal is retained under `previousResearch`. Existing source links provide research background; a user-confirmed gameplay label is not necessarily the classification used by those sources. Historical location research is retained separately under `backgroundResearch.locations` and is excluded from clue validation and the review checklist.

| Status | Meaning |
| --- | --- |
| `researched` | Supported by the cited reference, including normalization of names. This is not independent verification against every original game appearance. |
| `curated` | An editorial gameplay label mapped from the source, principally roles and associated locations. |
| `confirmed` | The user selected the gameplay value or intentionally left it blank. This does not claim independent source verification. |
| `proposed` | A plausible value retained for you to double-check, with an explanation. |
| `missing` | No value selected. The value is `null` and requires manual checking. |

After a user decision, use `confirmed`, set `confirmedBy` to `user`, and explain the choice in `note`. Preserve earlier research separately. Markdown checkboxes are a reading aid; checking a box does not change the JSON.

Regenerate the overview and checklist from the project root:

```sh
node scripts/character-research.mjs --write
```

Validate the data and check that both documents match it:

```sh
node scripts/character-research.mjs
```

## Clue rules

1. **Being type:** recognizable gameplay identity. User decisions use Exo for Cayde and Clovis, Human for Eris and Sloane, Awoken for Asher, Cabal for Caiatl/Ghaul/Calus/Lume, Unknown for Xûr and the Witness, Tormentor for Nezarec, Human for Lodi, Ascendant Soul for Toland, and Paracausal entity for Starhorse. These include gameplay categories rather than exclusively biological species.
2. **Gender:** the character's established identity or agreed presentation. The user retained Female for Failsafe and Male for Rasputin and Starhorse. The Witness remains intentionally blank. Do not infer gender from voice actors.
3. **Guardian class:** established current or former Titan, Hunter or Warlock, plus broader categories Rogue Lightbearer (Drifter), Hive Lightbearer (Savathûn and Luzaku), and None (Bael). Loss of Light does not remove historical class. Existing `Not applicable` values for non-Guardians are intentional. Ghosts do not inherit their partner's class.
4. **Affiliation:** principal current or last-established groups, rather than every former allegiance. The user confirmed Vanguard for Orin and intentionally left Eramis and Riven blank.
5. **Role:** multiple short editorial labels can apply. These summarize activities or story functions; they are not a mutually exclusive official Bungie taxonomy. Enemy combat ranks are not Guardian classes.
6. **Debut game:** first actual game appearance, including voice or a recognizable depiction. Text/lore mentions alone do not count. Merged identities include their earlier incarnation.
7. **First Destiny 2 appearance:** the user-selected introduction for the clue, including historical removed content. Approved exceptions choose living/revealed characters over earlier corpses or proxies: Saint S9, Rasputin S3, Savathûn S15, Witness S16, and Starhorse S15. Reprised raid introductions count for Oryx S18 and Crota S22. Xivu Arath uses S21, Targe S1 and Sundance S1. Earlier appearances and the rationale remain in field notes; these values are gameplay decisions rather than a claim of the earliest depiction in every case. A date is a content-release date, not the character's in-universe age.

Crow/Uldren is one character. Clovis's Europa AI and Banshee-44 are distinct entries. Orin and Lodi are distinct despite both having used the Emissary title. Crota and Starhorse are included with their user-selected introductions. Aliases support future search; they are not extra playable characters.

## Releases and sources

The research JSON has a small local `releaseCatalog` with year and season number. Most IDs reuse the weapon release catalog. `final-shape` is separate here because the weapon catalog does not currently have that expansion as a standalone release. Shadowkeep uses the existing `undying` ID; Beyond Light and Season of the Hunt share S12. Their exact context is explained per character. No weapon release records were changed.

Research snapshot: **2026-11-18**. Destinypedia character infoboxes, introductions and appearance lists were consulted for all 67 entries; relevant Bungie promotional material was also consulted for Bael and Lume. Links are stored per field. These are initial secondary-source findings plus editorial mappings, not an exhaustive audit of every quest transcript or a Bungie API import. Current affiliations and transformations deserve particular attention as the story changes.

The Characters page uses all 67 approved entries. [portraits.json](portraits.json) records the reference page and original image URL for each locally stored portrait. Images are resized to at most 320 pixels and served locally, without live reference-site requests during play.

After editing approved research, regenerate `src/data/destiny2/characters.json` with `node scripts/build-character-data.mjs`, and regenerate the documents with `node scripts/character-research.mjs --write`. `npm run data:check` validates that the playable catalog matches the approved source and that every portrait exists. The full research JSON and location background notes are not imported by the frontend.
