import { readFile, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { routes } from './routes.mjs'

// One entry per allowlisted file. Stat on each request keeps edits visible without
// a watcher, while unchanged reloads reuse bytes and browser ETags avoid transfers.
export function createStaticHandler({ root = new URL('../dist/', import.meta.url), read = readFile, metadata = stat } = {}) {
  const cache = new Map()
  return async function serveStatic(request, response) {
    let pathname
    try { pathname = new URL(request.url, 'http://localhost').pathname }
    catch { response.writeHead(400).end('Bad request'); return }
    const route = routes.get(pathname)
    if (!route) { response.writeHead(404).end('Not found'); return }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end()
      return
    }
    const [file, type] = route
    try {
      const url = new URL(file, root)
      const info = await metadata(url)
      const version = `${info.mtimeMs}:${info.ctimeMs}:${info.size}:${info.ino}`
      let entry = cache.get(file)
      if (!entry || entry.version !== version) {
        // Coalesce simultaneous requests for the same version, including / and /index.html.
        const pending = read(url).then(body => ({
          body,
          etag: `"${createHash('sha256').update(body).digest('base64url')}"`,
        }))
        entry = { version, pending }
        cache.set(file, entry)
      }
      const { body, etag } = await entry.pending
      const headers = {
        'Content-Type': `${type}; charset=utf-8`,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        ETag: etag,
      }
      const validators = String(request.headers['if-none-match'] || '').split(',').map(value => value.trim().replace(/^W\//, ''))
      if (validators.includes(etag) || validators.includes('*')) {
        response.writeHead(304, headers).end()
        return
      }
      response.writeHead(200, { ...headers, 'Content-Length': body.length })
      response.end(request.method === 'HEAD' ? undefined : body)
    } catch {
      cache.delete(file)
      response.writeHead(500).end('Unable to load file')
    }
  }
}
