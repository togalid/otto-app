import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { createStaticHandler } from '../server/static.mjs'
import { createStemHandler, stemProcessEnvironment } from '../server/stems.mjs'

function response() {
  return Object.assign(new EventEmitter(), {
    writeHead(status, headers = {}) { this.status = status; this.headers = headers; return this },
    end(body) { this.body = body; this.writableEnded = true; return this },
  })
}
function request(url = '/', headers = {}, method = 'GET') { return { url, headers, method } }

test('static reloads revalidate without rereading or retransmitting; edits invalidate cache', async () => {
  let reads = 0, version = 1
  const serve = createStaticHandler({
    read: async () => { reads++; return Buffer.from(`version ${version}`) },
    metadata: async () => ({ mtimeMs: version, ctimeMs: version, size: 9, ino: 1 }),
  })
  const first = response(), parallel = response()
  await Promise.all([serve(request(), first), serve(request('/index.html'), parallel)])
  assert.equal(reads, 1)
  assert.equal(first.status, 200)
  const second = response()
  await serve(request('/', { 'if-none-match': `W/${first.headers.ETag}` }), second)
  assert.equal(second.status, 304)
  assert.equal(second.body, undefined)
  assert.equal(reads, 1)
  version++
  const edited = response()
  await serve(request('/', { 'if-none-match': first.headers.ETag }), edited)
  assert.equal(edited.status, 200)
  assert.equal(reads, 2)
  assert.notEqual(edited.headers.ETag, first.headers.ETag)
})

test('static handler rejects private paths and writes, serves HEAD without body, recovers failed reads', async () => {
  let fail = true, reads = 0
  const serve = createStaticHandler({
    read: async () => { reads++; if (fail) throw Error('transient'); return Buffer.from('ok') },
    metadata: async () => ({ mtimeMs: 1, ctimeMs: 1, size: 2, ino: 1 }),
  })
  for (const path of ['/server.mjs', '/../package.json', '/.env']) {
    const res = response(); await serve(request(path), res); assert.equal(res.status, 404)
  }
  const post = response(); await serve(request('/', {}, 'POST'), post); assert.equal(post.status, 405)
  assert.equal(reads, 0)
  const failed = response(); await serve(request(), failed); assert.equal(failed.status, 500)
  fail = false
  const head = response(); await serve(request('/', {}, 'HEAD'), head)
  assert.equal(head.status, 200); assert.equal(head.body, undefined); assert.equal(reads, 2)
})

test('stem separation keeps same-origin WAV gate and validates payload before running model', async () => {
  let runs = 0
  const separate = createStemHandler({ execute: async () => { runs++ } })
  const valid = { host: 'localhost:4175', origin: 'http://localhost:4175', 'content-type': 'audio/wav', 'content-length': '44' }
  for (const [headers, expected] of [
    [{ ...valid, origin: 'http://example.com' }, 403],
    [{ ...valid, host: 'example.com' }, 403],
    [{ ...valid, 'content-type': 'application/json' }, 403],
    [{ ...valid, 'content-length': '999999999' }, 413],
    [valid, 400],
  ]) {
    const req = Readable.from([Buffer.alloc(44)]); req.headers = headers
    const res = response(); await separate(req, res); assert.equal(res.status, expected)
  }
  assert.equal(runs, 0)
})

test('abandoning a stem response cancels its model process and releases the busy slot', async () => {
  let started
  const ready = new Promise(resolve => { started = resolve })
  const separate = createStemHandler({ execute: async (_command, _args, { signal }) => {
    started()
    await new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Error('aborted')), { once: true }))
  } })
  const wav = Buffer.alloc(44); wav.write('RIFF'); wav.write('WAVE', 8)
  const headers = { host: 'localhost:4175', origin: 'http://localhost:4175', 'content-type': 'audio/wav', 'content-length': '44' }
  const req = Readable.from([wav]); req.headers = headers
  const res = response(); const pending = separate(req, res)
  await ready
  const concurrent = Readable.from([wav]); concurrent.headers = headers
  const busy = response(); await separate(concurrent, busy); assert.equal(busy.status, 429)
  res.emit('close')
  await pending
  const next = Readable.from([Buffer.alloc(44)]); next.headers = headers
  const nextResponse = response(); await separate(next, nextResponse)
  assert.equal(nextResponse.status, 400)
})


test('stem CPU thread defaults are bounded and preserve explicit operator settings', () => {
  assert.deepEqual(stemProcessEnvironment({TORCH_HOME:'/tmp/test-models'}, 10), {
    TORCH_HOME:'/tmp/test-models', OMP_NUM_THREADS:'4', MKL_NUM_THREADS:'4',
  })
  assert.equal(stemProcessEnvironment({}, 2).OMP_NUM_THREADS,'2')
  assert.deepEqual(stemProcessEnvironment({OMP_NUM_THREADS:'6', MKL_NUM_THREADS:'2'}, 10), {
    OMP_NUM_THREADS:'6', MKL_NUM_THREADS:'2',
  })
})
