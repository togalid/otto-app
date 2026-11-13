import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EventEmitter } from 'node:events'
import { createDrumKitHandler, discoverDrumKits } from '../server/drum-kits.mjs'
import { createStaticHandler } from '../server/static.mjs'
import { bundledDrumKits } from '../dist/drum-kit-manifest.js'

function response() {
  return Object.assign(new EventEmitter(), {
    writeHead(status, headers = {}) { this.status = status; this.headers = headers; return this },
    end(body) { this.body = body; return this },
  })
}
function request(url, headers = {}) {
  return {method:'GET', url, headers:{host:'localhost:4175', 'x-otto-local':'1', ...headers}, socket:{remoteAddress:'127.0.0.1'}}
}

test('local drum kits are discovered on each request and reject unsafe files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'oto-kits-'))
  try {
    const handler = createDrumKitHandler({root})
    const empty = response()
    await handler(request('/api/drum-kits'), empty)
    assert.deepEqual(JSON.parse(empty.body), [])

    await mkdir(join(root, '04_Microhouse'))
    await writeFile(join(root, '04_Microhouse', 'kick.wav'), 'kick')
    await writeFile(join(root, '04_Microhouse', 'snare.wav'), 'snare')
    await symlink(join(root, '04_Microhouse', 'kick.wav'), join(root, '04_Microhouse', 'other.wav'))
    const kits = await discoverDrumKits(root)
    assert.deepEqual(kits[0].samples.map(({id,file}) => [id,file]), [[0,'kick.wav'], [1,'snare.wav']])

    const sample = response()
    await handler(request('/api/drum-kit-sample?kit=04_Microhouse&file=kick.wav'), sample)
    assert.equal(sample.status, 200)
    assert.equal(sample.body.toString(), 'kick')

    for (const url of ['/api/drum-kit-sample?kit=..&file=kick.wav', '/api/drum-kit-sample?kit=04_Microhouse&file=other.wav']) {
      const rejected = response()
      await handler(request(url), rejected)
      assert.equal(rejected.status, 404)
    }
    const remote = response()
    const remoteRequest = request('/api/drum-kits')
    remoteRequest.socket.remoteAddress = '192.0.2.1'
    await handler(remoteRequest, remote)
    assert.equal(remote.status, 403)
    const crossOrigin = response()
    await handler(request('/api/drum-kits', {origin:'https://example.com'}), crossOrigin)
    assert.equal(crossOrigin.status, 403)

    await mkdir(join(root, '05_New'))
    await writeFile(join(root, '05_New', 'hat.wav'), 'hat')
    const updated = response()
    await handler(request('/api/drum-kits'), updated)
    assert.deepEqual(JSON.parse(updated.body).map(kit => kit.name), ['04_Microhouse', '05_New'])
  } finally {
    await rm(root, {recursive:true, force:true})
  }
})


test('bundled kit is served without access to the local source directory', async () => {
  const kit = bundledDrumKits.find(item => item.id === '04_Microhouse')
  assert.ok(kit)
  assert.equal(kit.samples.length, 8)
  const serve = createStaticHandler()
  for (const sample of kit.samples) {
    const res = response()
    const url = `/samples/${encodeURIComponent(kit.id)}/${encodeURIComponent(sample.file)}`
    await serve({url, method:'GET', headers:{}}, res)
    assert.equal(res.status, 200)
    assert.equal(res.body.toString('ascii', 0, 4), 'RIFF')
    assert.equal(res.body.toString('ascii', 8, 12), 'WAVE')
  }
})
