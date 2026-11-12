import {randomUUID} from 'node:crypto'
import {readFile, rename, rm, writeFile} from 'node:fs/promises'
import {genres} from '../dist/groove.js'
import {melodyPresets} from '../dist/melody-presets.js'
import {readMidi} from './read-midi.mjs'

try {
  const [style, input, ...extra] = process.argv.slice(2)
  const genre = genres.find(genre => genre.id === style)
  if (!genre || !input || extra.length) throw new Error('npm run melody:preset -- <スタイルID> <MIDIファイル | --clear>')
  if (input === '--clear') delete melodyPresets[style]
  else {
    const bytes = await readFile(input)
    if (bytes.length > 4 * 1024 * 1024) throw new Error('MIDIは4 MiBまで登録できます。')
    melodyPresets[style] = readMidi(bytes)
  }
  const target = new URL('../dist/melody-presets.js', import.meta.url)
  const marker = /^export const melodyPresets = .*; \/\/ melody-presets$/m
  const source = await readFile(target, 'utf8')
  if (!marker.test(source)) throw new Error('登録先が見つかりません。')
  const temporary = new URL(target.href + '.' + randomUUID() + '.tmp')
  const updated = source.replace(marker, () => `export const melodyPresets = ${JSON.stringify(melodyPresets)}; // melody-presets`)
  try {
    await writeFile(temporary, updated, {flag: 'wx'})
    await rename(temporary, target)
  } finally {
    await rm(temporary, {force: true})
  }
  console.log(`${genre.label}のプリセット: ${melodyPresets[style]?.length ?? 0}音`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
