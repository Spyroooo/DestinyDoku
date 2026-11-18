// The build emits an entry document for each route so GitHub Pages can serve it.
export const sitePaths = [
  '/', '/weapons', '/weapons/practice', '/weapons/daily', '/characters', '/characters/practice', '/characters/daily',
  '/encounters', '/locations', '/music', '/who-said-it', '/exotics',
  '/destiny-grid', '/feedback',
]

export function normalizePath(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/'
}

export function legacyPath(hash: string): string | undefined {
  if (!hash.startsWith('#/')) return undefined
  const path = normalizePath(hash.slice(1))
  return sitePaths.includes(path) ? path : undefined
}
