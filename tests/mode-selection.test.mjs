import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

// Isolated DOM: previews must not navigate or mutate a user's musical session.
const dom = new JSDOM('<!doctype html><body><main></main></body>', {url:'http://localhost/'})
for (const name of ['window','document','Element','HTMLElement','SVGElement']) {
  globalThis[name] = name === 'window' ? dom.window : name === 'document' ? dom.window.document : dom.window[name]
}
const { mountSelectionStage } = await import('../dist/melody-view.js')
const { nextTick } = await import('../dist/vendor/vue.runtime.esm-browser.prod.js')

test('mode preview only enters the selected available mode after explicit confirmation', async () => {
  const entered = []
  const host = document.querySelector('main')
  const choices = [
    {id:'tutorial', title:'練習', subtitle:'練習する', description:'お手本から始める', badge:'10', icon:'keys'},
    {id:'free', title:'自由', subtitle:'自由に弾く', description:'セッションを楽しむ', badge:'自由', icon:'session'},
    {id:'future', title:'準備中の楽器', subtitle:'', description:'', badge:'', icon:'keys', disabled:true},
  ]
  const unmount = mountSelectionStage(host, choices, id => entered.push(id))
  const buttons = [...host.querySelectorAll('.selection-choice')]
  assert.equal(buttons[0].getAttribute('aria-pressed'), 'true')
  assert.equal(buttons[2].disabled, true)
  buttons[1].click()
  await nextTick()
  assert.deepEqual(entered, [])
  assert.equal(buttons[0].getAttribute('aria-pressed'), 'false')
  assert.equal(buttons[1].getAttribute('aria-pressed'), 'true')
  assert.match(host.querySelector('.selection-detail').textContent, /セッションを楽しむ/)
  buttons[2].click()
  await nextTick()
  assert.equal(buttons[1].getAttribute('aria-pressed'), 'true')
  host.querySelector('.selection-start').click()
  assert.deepEqual(entered, ['free'])
  buttons[0].click()
  await nextTick()
  host.querySelector('.selection-start').click()
  assert.deepEqual(entered, ['free','tutorial'])
  unmount()
  assert.equal(host.childElementCount, 0)
})
