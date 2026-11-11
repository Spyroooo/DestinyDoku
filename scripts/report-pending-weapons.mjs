import { readFile, writeFile } from 'node:fs/promises'
const read=async(file)=>JSON.parse(await readFile(new URL(`../${file}`,import.meta.url),'utf8'))
const catalog=await read('src/data/destiny2/weapons.json')
const audit=await read('data/weapon-import/research/audit.json')
const checks=await read('data/weapon-import/research/lightgg-release-checks.json')
const releases=await read('src/data/destiny2/releases.json')
const champions=await read('data/weapon-import/research/lightgg-champion-checks.json')
const sources=await read('data/weapon-import/research/source-category-checks.json')
const damage=await read('data/weapon-import/research/exotic-damage-checks.json')
const acquisition=await read('data/weapon-import/research/archive-source-checks.json')
const playable=new Set(catalog.map((weapon)=>weapon.id))
const answerCount=catalog.filter((weapon)=>weapon.versions.find((version)=>version.id===weapon.currentVersionId)?.source.category!=='unreleased').length
const pending=audit.records.filter((record)=>!playable.has(record.id)).sort((a,b)=>a.name.localeCompare(b.name))
const labels={
 'First introduction: retained watermarks alone cannot prove original release':'First release has not been corroborated.',
 'Selected version source is missing or too vague':'Selected version’s acquisition source is missing or too vague.',
 'Champion counter requires an Exotic/custom-frame exception check':'Champion counter needs an Exotic or custom-frame check.',
 'Alternate damage types require an Exotic-specific check':'Supported damage types need an Exotic-specific check.',
 'At least one standard version has an unmapped release watermark; newest version is uncertain':'At least one version has no release mapping, so the newest version is uncertain.',
 'Newest season has conflicting gameplay variants':'Newest season has conflicting gameplay variants; select the intended version.',
}
const esc=(value)=>String(value).replaceAll('|','\\|')
const releaseName=(id)=>{const release=releases.find((r)=>r.id===id);return release?`S${release.seasonNumber} · ${release.name}`:id}
const issue=(record)=>record.unresolved.map((reason)=>labels[reason]??reason).join(' ')
const unchecked=checks.checks.filter((check)=>!playable.has(check.id))
const lines=['# Weapons not yet in the playable pool','',`Updated ${checks.checkedOn}. ${catalog.length} valid guesses, including ${answerCount} eligible answers; ${pending.length} imported names remain excluded. Unreleased discoveries can be guessed but never selected as answers. Every excluded weapon is listed below.`,
 '', '## Release-only checks', '',
 `${checks.checks.filter((check)=>check.status==='verified'&&playable.has(check.id)).length} release-only cases were added after Light.gg corroborated their proposed season. The checks use item introduction records or explicitly labelled alternate versions. They corroborate the proposed history; they do not prove that no older definition ever existed.`,
 '', unchecked.length?'These cases remain pending because Light.gg did not corroborate the proposed season, or returned conflicting information. No other fields are blocking these entries.':'No release-only cases remain pending. The user accepted the remaining proposed first releases; the original Light.gg outcomes above were not changed to verified.', '',
 '| Weapon | Proposed original release | Light.gg result |','| --- | --- | --- |',
 ...unchecked.map((check)=>`| ${esc(check.name)} | ${esc(releaseName(check.releaseId))} | ${check.status==='conflict'?`Conflicting record: linked item reports S${check.evidence.season}. [Item page](${check.evidence.url})`:'Could not corroborate the proposed season from the retrieved results.'} |`),
 '', '## Source and Champion review', '',
 `Checked the new Season Pass, Vendor and Tenet Engram categories: ${sources.checks.length} selected versions have explicit source evidence. Existing activity origins and user confirmations take precedence over a later vendor sale.`, '',
 `Light.gg confirmed ${champions.checks.filter((check)=>check.status==='verified').length} of ${champions.checks.length} previously unresolved Champion counters. Missing page text is not interpreted as no counter. These cases remain unverified:`, '',
 ...champions.checks.filter((check)=>check.status!=='verified').map((check)=>`- ${check.name} (${check.itemHash})`), '',
 `Reviewed all ${damage.checks.length} pending Exotic firing-element sets, including ${damage.checks.filter((check)=>check.damageTypes.length>1).length} multi-element exceptions. Intrinsic modes and fixed catalyst conversions are included; incidental secondary perk explosions are excluded. See [damage review](exotic-damage-checks.json).`, '',
 'Source and Champion fields are independent of the accepted first release and reviewed damage set. Unresolved fields still block promotion.', '',
 `Reviewed ${acquisition.exoticReviews.length} then-pending Exotics for quest/mission availability and all ${acquisition.missingSourceChecks.length} missing selected-version sources for Archive inventory membership. ${acquisition.checks.filter((check)=>check.source.category==='exotic-archive').length} selected weapons have verified Archive purchases. ${acquisition.olderVersionArchiveMatches.length} reissues have older archived versions; those old entries do not verify the selected reissue source. See [acquisition review](exotic-acquisition-review.md).`, '',
 '## Every excluded weapon', '', 'Several issues can apply to one weapon. “Damage types” includes alternate Exotic damage modes; confirming only its base element is insufficient. Acquisition source refers to the selected version, not necessarily its original drop source.', '',
 '| Weapon | Selected item hash | Issues preventing addition |','| --- | --- | --- |',
 ...pending.map((record)=>`| ${esc(record.name)} | ${record.currentItemHash??'Not selected'} | ${esc(issue(record)||'Data review is complete; promotion has not run.')} |`), '',
 'Evidence and machine-readable details: [audit.json](audit.json), [Light.gg release checks](lightgg-release-checks.json).', '']
await writeFile(new URL('../data/weapon-import/research/not-added-weapons.md',import.meta.url),lines.join('\n'))
console.log(JSON.stringify({playable:catalog.length,pending:pending.length,releaseOnly:unchecked.length,other:pending.length-unchecked.length}))
