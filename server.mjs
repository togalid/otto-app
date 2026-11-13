import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'
import { createStaticHandler } from './server/static.mjs'
import { createDrumKitHandler } from './server/drum-kits.mjs'
import { createStemHandler } from './server/stems.mjs'
import { editionFeatures } from './dist/features.js'

export function createAppServer({ edition = 'full' } = {}) {
  if (!Object.hasOwn(editionFeatures, edition)) throw new Error('Unknown Otto edition: ' + edition)
  const features = editionFeatures[edition]
  const serveStatic = createStaticHandler()
  const drumKits = createDrumKitHandler()
  const separate = features.stemSeparation ? createStemHandler() : null
  return createServer((request, response) => {
    if (request.url.split('?')[0] === '/api/drum-kits' || request.url.split('?')[0] === '/api/drum-kit-sample') return drumKits(request, response)
    if ((request.method === 'GET' || request.method === 'HEAD') &&
        request.url.split('?')[0] === '/edition.js') {
      response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' })
      return response.end(request.method === 'HEAD' ? undefined : 'export const edition = ' + JSON.stringify(edition))
    }
    if (request.method === 'POST' && request.url === '/api/stems') {
      return separate ? separate(request, response) : response.writeHead(404).end()
    }
    return serveStatic(request, response)
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const edition = process.argv.includes('--free') ? 'free' : 'full'
  const port = edition === 'free' ? 4176 : 4175
  const host = edition === 'free' ? '127.0.0.1' : '0.0.0.0'
  const urlHost = edition === 'free' ? '127.0.0.1' : 'localhost'
  createAppServer({ edition }).listen(port, host, () => console.log(edition + ': http://' + urlHost + ':' + port))
}
