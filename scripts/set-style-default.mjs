import {randomUUID} from 'node:crypto'
import {readFile, rename, rm, writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {arrangementControlIds, decodeArrangement, styleDefaultJson} from '../dist/arrangement-file.js'

const [input, ...flags] = process.argv.slice(2)
try {
  if (!input || flags.length > 1 || flags.some(flag => flag !== '--write')) {
    throw new Error('使い方: npm run style:default -- <編成JSON> [--write]')
  }

  const bytes = await readFile(input)
  if (bytes.length > 16 * 1024 * 1024) throw new Error('編成JSONが大きすぎます。')
  const json = bytes.toString('utf8')
  const arrangement = decodeArrangement(json, arrangementControlIds.map(id => ({id})))
  if ((arrangement.sections[0].style ?? arrangement.style) !== arrangement.style) {
    throw new Error('最初のセクションと選択中のスタイルを揃えてください。')
  }

  if (!flags.includes('--write')) {
    console.log('スタイルの既定の編成として登録できます。登録するには --write を付けてください。')
  } else {
    const target = fileURLToPath(new URL('../dist/arrangement-file.js', import.meta.url))
    const source = await readFile(target, 'utf8')
    const marker = /^export const styleDefaultJson = .*; \/\/ style-defaults$/mu
    if (!marker.test(source)) throw new Error('既定の編成の登録先が見つかりません。')
    const defaults = {...styleDefaultJson, [arrangement.style]: JSON.stringify(JSON.parse(json))}
    const literal = JSON.stringify(defaults).replace(/[\u2028\u2029]/gu, character =>
      '\\u' + character.charCodeAt(0).toString(16))
    const updated = source.replace(marker, () => `export const styleDefaultJson = ${literal}; // style-defaults`)
    const temporary = `${target}.${randomUUID()}.tmp`
    try {
      await writeFile(temporary, updated, {flag: 'wx'})
      await rename(temporary, target)
    } finally {
      await rm(temporary, {force: true})
    }
    console.log('スタイルの既定の編成を登録しました。スタジオを再読み込みしてください。')
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
