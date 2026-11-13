import { readdir, readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

const defaultRoot = join(homedir(), 'Desktop', 'Otto用素材', '電子ドラムサンプル')
const rules = [
  [0, /kick|bass.?drum/i, 'キック'],
  [1, /snare/i, 'スネア'],
  [3, /open.?h(at|h)|o(h|pen.?h)/i, 'オープンHH'],
  [2, /hat|(?:^|[_ -])hh(?:[_ -]|$)/i, 'ハイハット'],
  [4, /808/i, '808'],
  [5, /clap/i, 'クラップ'],
  [6, /block/i, 'ブロック'],
  [7, /perc/i, 'パーカッション'],
]

/** @param {string} root */
export async function discoverDrumKits(root = defaultRoot) {
  let folders
  try { folders = await readdir(root, {withFileTypes:true}) }
  catch (error) { if (error.code === 'ENOENT') return []; throw error }
  const kits = []
  for (const folder of folders.filter(entry => entry.isDirectory()).sort((a,b) => a.name.localeCompare(b.name))) {
    const entries = await readdir(join(root, folder.name), {withFileTypes:true})
    const files = entries.filter(entry => entry.isFile() && /\.wav$/i.test(entry.name)).map(entry => entry.name).sort()
    const assigned = new Map()
    const pending = []
    for (const file of files) {
      const match = rules.find(([id, pattern]) => pattern.test(file) && !assigned.has(id))
      if (match) assigned.set(match[0], {id:match[0], label:match[2], file})
      else pending.push(file)
    }
    for (const file of pending) {
      const slot = [2,3,4,5,6,7,0,1].find(id => !assigned.has(id))
      if (slot === undefined) break
      const label = /hat|(?:^|[_ -])hh(?:[_ -]|$)/i.test(file) ? 'ハイハット2' : file.replace(/\.wav$/i, '')
      assigned.set(slot, {id:slot, label, file})
    }
    if (assigned.size) kits.push({id:folder.name, name:folder.name, samples:[...assigned.values()].sort((a,b)=>a.id-b.id), skipped:Math.max(0, files.length-8)})
  }
  return kits
}

/** @param {{root?:string}} [options] */
export function createDrumKitHandler({root = defaultRoot} = {}) {
  return async function drumKits(request, response) {
    const host = request.headers.host ?? ''
    const localHost = /^(localhost|127\.0\.0\.1|\[::1\]):(4175|4176)$/.test(host)
    const localPeer = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)
    if (!localHost || !localPeer || request.headers['x-otto-local'] !== '1' ||
        (request.headers.origin && request.headers.origin !== 'http://' + host)) {
      response.writeHead(403).end()
      return
    }
    if (request.method !== 'GET') { response.writeHead(405).end(); return }
    try {
      const url = new URL(request.url, 'http://' + host)
      const kits = await discoverDrumKits(root)
      if (url.pathname === '/api/drum-kits') {
        response.writeHead(200, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'})
        response.end(JSON.stringify(kits))
        return
      }
      const kit = kits.find(item => item.id === url.searchParams.get('kit'))
      const sample = kit?.samples.find(item => item.file === url.searchParams.get('file'))
      if (!kit || !sample) { response.writeHead(404).end(); return }
      const path = join(root, kit.id, sample.file)
      const info = await stat(path)
      if (info.size > 4 * 1024 * 1024) { response.writeHead(413).end('WAVは4 MB以下にしてください。'); return }
      const bytes = await readFile(path)
      response.writeHead(200, {'Content-Type':'audio/wav', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'})
      response.end(bytes)
    } catch {
      response.writeHead(500).end('ドラムキットを読み込めませんでした。')
    }
  }
}
