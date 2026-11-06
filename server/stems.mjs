import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const run = promisify(execFile)
const stemNames = ['vocals', 'drums', 'bass', 'other']
export function createStemHandler({ execute = run } = {}) {
  let separating = false
  return async function separate(request, response) {
    const host = request.headers.host
    const local = ['localhost:4175', '127.0.0.1:4175', '[::1]:4175'].includes(host)
    if (!local || request.headers.origin !== 'http://' + host || request.headers['content-type'] !== 'audio/wav') {
      response.writeHead(403).end()
      return
    }
    const limit = 20 * 1024 * 1024
    const size = Number(request.headers['content-length'])
    if (!Number.isInteger(size) || size < 44 || size > limit) {
      response.writeHead(413).end()
      return
    }
    if (separating) { response.writeHead(429).end('分離処理が実行中です。'); return }
    separating = true
    let folder
    const controller = new AbortController()
    const cancel = () => { if (!response.writableEnded) controller.abort() }
    response.on('close', cancel)
    request.on('aborted', cancel)
    try {
      const chunks = []
      let received = 0
      for await (const chunk of request) {
        received += chunk.length
        if (received > limit) throw new Error('Audio exceeds size limit')
        chunks.push(chunk)
      }
      const wav = Buffer.concat(chunks)
      if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
        response.writeHead(400).end('音声形式を確認してください。')
        return
      }
      folder = await mkdtemp(join(tmpdir(), 'oto-stems-'))
      const input = join(folder, 'clip.wav')
      await writeFile(input, wav)
      await execute(process.env.OTO_DEMUCS || 'demucs', ['-n', 'htdemucs', '-d', 'cpu', '--shifts', '0', '--float32', '--clip-mode', 'clamp', '-o', folder, input], {timeout: 300000, signal: controller.signal})
      const stems = await Promise.all(stemNames.map(name => readFile(join(folder, 'htdemucs', 'clip', name + '.wav'))))
      response.writeHead(200, {'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store'})
      for (const stem of stems) {
        const header = Buffer.alloc(4)
        header.writeUInt32LE(stem.length)
        response.write(header)
        response.write(stem)
      }
      response.end()
    } catch (error) {
      if (controller.signal.aborted || response.destroyed) return
      console.error('Stem separation failed:', error.stderr || error.message)
      response.writeHead(503, {'Content-Type': 'text/plain; charset=utf-8'}).end(
        error.code === 'ENOENT' ? 'Demucsを起動できません。サーバーの設定を確認してください。' : '音源を分離できませんでした。サーバーのログを確認してください。')
    } finally {
      response.off('close', cancel)
      request.off('aborted', cancel)
      separating = false
      if (folder) await rm(folder, {recursive:true, force:true}).catch(console.error)
    }
  }

}
