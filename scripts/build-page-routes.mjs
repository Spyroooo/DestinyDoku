import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { sitePaths } from '../src/routes.ts'

const output = new URL('../dist/', import.meta.url)
const html = await readFile(new URL('index.html', output), 'utf8')
for (const path of sitePaths.filter((path) => path !== '/')) {
  const folder = new URL(`.${path}/`, output)
  await mkdir(folder, { recursive: true })
  await writeFile(new URL('index.html', folder), html)
}
await writeFile(new URL('404.html', output), html)
console.log(`Created GitHub Pages entries for ${sitePaths.length} routes and a 404 page.`)
