import path from 'node:path'
import ts from 'typescript'

/** Check entries independently so catalogue growth cannot create a giant union. */
export function catalogTypeDiagnostics(weapons, releases, root) {
  const filename = path.join(root, '__catalog_type_check__.ts')
  const source = [
    "import type { Weapon, Release } from './src/types/weapon';",
    ...weapons.map((weapon, index) => `const weapon_${index}: Weapon = ${JSON.stringify(weapon)};`),
    ...releases.map((release, index) => `const release_${index}: Release = ${JSON.stringify(release)};`),
  ].join('\n')
  const options = { strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ESNext }
  const host = ts.createCompilerHost(options)
  const originalGetSourceFile = host.getSourceFile.bind(host)
  host.getSourceFile = (name, languageVersion, ...rest) => name === filename
    ? ts.createSourceFile(name, source, languageVersion, true)
    : originalGetSourceFile(name, languageVersion, ...rest)
  return ts.getPreEmitDiagnostics(ts.createProgram([filename], options, host))
}
