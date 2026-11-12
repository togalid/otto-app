import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>', {url:'http://localhost/'})
for (const name of ['window','document','Element','HTMLElement','HTMLInputElement','SVGElement','Event','MouseEvent','MutationObserver']) {
  globalThis[name] = name === 'window' ? dom.window : name === 'document' ? dom.window.document : dom.window[name]
}
window.matchMedia = () => ({matches:true})
dom.window.HTMLDialogElement.prototype.showModal = function() { this.setAttribute('open','') }
dom.window.HTMLDialogElement.prototype.close = function() { this.removeAttribute('open'); this.dispatchEvent(new Event('close')) }
const {bindTempoNumericEntry} = await import('../dist/main-controls.js')

function touch(input) {
  const event = new MouseEvent('pointerdown', {bubbles:true, cancelable:true, button:0})
  Object.defineProperty(event, 'pointerType', {value:'touch'})
  input.dispatchEvent(event)
}

test('phone tempo entry validates, confirms, cancels and ignores removed controls', () => {
  const input = document.createElement('input')
  input.type = 'range'; input.min = '40'; input.max = '180'; input.step = '1'; input.value = '80'
  document.body.append(input)
  bindTempoNumericEntry(input)
  let changes = 0
  input.addEventListener('input', () => changes++)
  touch(input)
  let dialog = document.querySelector('.tempo-entry-dialog')
  let field = dialog.querySelector('input')
  assert.equal(field.inputMode, 'numeric')
  field.value = '200'
  dialog.querySelector('form').dispatchEvent(new Event('submit', {bubbles:true,cancelable:true}))
  assert.equal(input.value, '80')
  assert.equal(dialog.open, true)
  field.value = '120'
  dialog.querySelector('form').dispatchEvent(new Event('submit', {bubbles:true,cancelable:true}))
  assert.equal(input.value, '120')
  assert.equal(changes, 1)
  assert.equal(document.querySelector('.tempo-entry-dialog'), null)
  touch(input)
  dialog = document.querySelector('.tempo-entry-dialog')
  dialog.querySelector('input').value = '130'
  dialog.querySelector('button').click()
  assert.equal(input.value, '120')
  assert.equal(changes, 1)
  touch(input)
  dialog = document.querySelector('.tempo-entry-dialog')
  field = dialog.querySelector('input')
  field.value = '140'
  input.remove()
  dialog.querySelector('form').dispatchEvent(new Event('submit', {bubbles:true,cancelable:true}))
  assert.equal(changes, 1)
  assert.equal(document.querySelector('.tempo-entry-dialog'), null)
})
