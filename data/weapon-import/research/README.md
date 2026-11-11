# Catalog review, 11 November 2026

Scope: all 1,105 grouped names in Bungie Manifest
`245114.26.10.13.2000-1-bnet.66137` (2,059 eligible item definitions).

All 1,105 imported weapon names are in the game catalogue: 1,102 eligible answers
and three Unreleased discoveries (Bushwhacker, Timecard and Traitor's Fate) that
can be guessed but cannot be hidden answers. These source choices reflect the
saved reviews, including the user's final checker pass.

The final 103 completed reviews were promoted together, preserving the selected
item hash, source, damage set, Champion counters, aliases and notes from the local
checker. Their approved fields are stored in `user-confirmations.json` so future
audits preserve them. There are no unpromoted names and no outstanding reviews.
The checker’s Ready to promote filter excludes every identity already in the
catalogue; it is now empty.

Both the build validator and local checker use the shared
`scripts/lib/catalog-type-check.mjs`: each weapon and release is checked as an
independent typed declaration. This avoids TypeScript's oversized array union
without dropping schema, duplicate, reference, chronology or image checks. A
1,500-entry regression test also confirms invalid nested fields remain rejected.

Sources, Champion counters and damage remain independent checks. The user
previously accepted 241 proposed first releases; these remain accepted proposals,
rather than newly verified historical facts. See `bulk-release-approval.json` for
those decisions and `not-added-weapons.md` for all remaining exclusions.
The original 50-name trial is fully completed.

## What was checked

- Weapon family, ammo, slot, intrinsic/frame and base damage: Bungie definitions.
- Exotic damage: reviewed the selected item's base element and its bound
  intrinsic, trait and catalyst plug definitions (including plug-set membership
  and sandbox-perk text). Element-switching and alternate projectile exceptions
  were checked separately against linked item/perk descriptions and research.
  Firing modes, inherent multi-element projectiles and fixed catalyst element
  conversion count; incidental secondary explosions, reflected attacks, ordinary
  Glaive melee and optional random-roll conversion perks do not. Ergo Sum uses
  its possible Light-element rolls; generic Kinetic previews for it and
  Tessellation are placeholders. Quicksilver Storm's former Arc rocket behavior
  was removed in update 6.3.0; its current set is Kinetic/Strand.
- Champion counters: Bungie's documented Anti-Champion 2.0 frame rules, with
  explicit exceptions checked separately. Optional random-roll perks are excluded.
  Light.gg's explicit Shield Piercing/Disruption/Stagger labels on exact item
  pages resolved 149 of 161 pending counters. The 12 cases with missing or
  insufficient retrieved text remain unverified, never assumed to have no counter.
- Version release: DIM's watermark mapping plus archived per-item season fallback.
  `releases.v970.core` is treated as the Monument of Triumph update. Its API season
  numbering differs from the community S29 label; the named release is preserved.
- Newest standard version: highest supported release, never highest item hash.
  Equivalent same-season definitions are grouped; missing dates or conflicting
  gameplay attributes prevent selection.
- Original introduction: existing curated history, explicitly researched trial
  entries, launch-era definitions, or corroborating source-to-season mappings for
  the oldest retained definition. Watermarks alone are not sufficient to infer
  the original release, particularly when only a reissue remains.
- Accepted release-only policy: Light.gg item introduction records or explicitly
  labelled alternate versions corroborate the proposed season. This does not
  establish that no older definition exists. All 541 attempts, including 12
  unconfirmed/conflicting cases, are saved in `lightgg-release-checks.json`.
  Grasp weapons from S15 use the separate 30th Anniversary release rather than
  Season of the Lost. User confirmations retain precedence.
- Source category: explicit collectible source text or DIM's curated item/source
  group membership, with reviewed current-acquisition exceptions. For remaining
  Exotics, available acquisition missions/quests take priority over stale
  collectible text. Exotic Archive requires an exact selected-item match in
  the kiosk vendor tree; retiring a quest alone is insufficient. Original
  acquisition context is retained separately in the review record.
- Archive inspection follows only the Monument to Lost Lights kiosk and its
  linked subvendors, including Legacy Gear. It found 13 Legendary names with
  older archived definitions, but no missing selected Legendary reissue matched
  the Archive inventory. These reissues retain their independent source checks.
- Outbreak Perfected and Whisper of the Worm now drop from their Pinnacle Ops
  missions even though their old quest wrappers were retired. Revision Zero's
  mission reward remains available. See Bungie's 9.7.0 notes and acquisition
  evidence. Praxic Blade, Wolfsbane and the remaining campaign/dungeon sources
  were reviewed separately; obsolete pre-order text is not assumed current.
- Added Season Pass, Vendor and Tenet Engram categories in both the game and
  local checker. Explicit pass acquisition text is distinct from seasonal activity
  drops. Exact Tenet sale hashes identify direct purchases; engram membership is
  traced through the Tenet's sold engram to its preview vendor reward names.
  These checks resolved 56 missing sources. A later sale does not override an
  already established activity origin or a user-confirmed source.
- Images: downloaded directly from Bungie; valid local images required before
  promotion. Catalog validation and tests ran after applying changes.

The saved Apex Predator review had an original item hash paired with a later
release; it now selects the actual newer definition. Same-hash crafting/perk
updates are not falsely represented as new item definitions. Existing aliases
are retained, and gameplay-distinct history such as Void/Arc Palindrome versions
is preserved. Earlier duplicate starter entries with identical comparison clues
are consolidated into the selected reviewed definition.

## Files

- `audit.json`: every weapon, decision, unresolved field and source links.
- `exotic-acquisition-review.md`: readable quest/mission/Archive outcomes for all
  45 reviewed Exotics and the 13 older-version-only Legendary Archive matches.
- `archive-source-checks.json`: exact kiosk inventory matches, vendor routes,
  current acquisition decisions, quest history and evidence URLs. These reviewed
  current sources take priority over the earlier source suggestions; explicit
  user per-version confirmations remain authoritative.
- `bulk-release-approval.json`: the 241 proposed first releases accepted by the
  user on 11 November, with the supporting retained definition and other issues.
  `user-confirmations.json` preserves these choices across subsequent audits.
- `unresolved.md`: full searchable list of the remaining cases.
- `not-added-weapons.md`: every currently excluded weapon with plain-language
  reasons, plus the 12 remaining release-only cases. Regenerate with
  `node scripts/report-pending-weapons.mjs` after changing the playable pool.
- `lightgg-release-checks.json`: proposed seasons, checked item hashes, outcomes
  and Light.gg evidence URLs; successful checks feed the audit and promotion.
- `exotic-damage-checks.json`: all 134 reviewed Exotic element sets, checked plug
  hashes, policy, exception notes and evidence URLs. Reviews apply only to the
  exact selected item hash and never automatically approve new item definitions.
- `lightgg-champion-checks.json`: exact item hashes, verified Champion properties
  and Light.gg evidence URLs, including unconfirmed attempts.
- `source-category-checks.json`: source classification evidence including vendor,
  engram, preview and reward hashes. Regenerate from the cached vendor Manifest
  with `node scripts/check-weapon-sources.mjs` before rerunning the audit.
- `watermark-to-season.json`, `season-history.json`, `source-to-season.json`,
  `source-groups.json`: source snapshots used to cross-check Bungie definitions.
- `DIM-LICENSE.md`: license for DIM's supplemental mapping data.

The local checker drafts contain the same reviewed fields and unresolved notes.
Original game JSON, review decisions and local drafts were backed up under the
Git-ignored `.local/weapon-review/backups/` directory before changes.

## Sources and exceptions

- https://www.bungie.net/7/en/News/Article/destiny_update_9_7_0
- https://github.com/DestinyItemManager/d2-additional-info
- https://masterworked.gg/database/weapons/347366834/ace-of-spades
- https://www.light.gg/db/new-items/monument-of-triumph/
- https://mlichy911.artstation.com/projects/Z0GRm1 (Accelerando-42's artist entry)
- https://www.destructoid.com/action-item-god-rolls-and-how-to-get-them-in-destiny-2/

The user confirmed Hard Light as Overload, A Good Shout as a Renegades / Zavala
weapon, A Sudden Death as Prophecy, Adamantite as Pit of Heresy, and Adored as
Pinnacle Ops. These per-version decisions are preserved in
`user-confirmations.json` and take precedence over automatic audit suggestions.

The report does not claim that all remaining identities have unknown stats.
Many already have type/ammo/damage/frame/Champion fields checked and saved; a
single unresolved original-release field is enough to prevent promotion.
