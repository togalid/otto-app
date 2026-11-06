import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'
import { createStaticHandler } from './server/static.mjs'
import { createStemHandler } from './server/stems.mjs'

export function createAppServer() {
  const serveStatic = createStaticHandler()
  const separate = createStemHandler()
  return createServer((request, response) => {
    if (request.method === 'POST' && request.url === '/api/stems') return separate(request, response)
    return serveStatic(request, response)
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createAppServer().listen(4175, '0.0.0.0', () => console.log('Local: http://localhost:4175'))
}
