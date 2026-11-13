/** @param {Iterable<HTMLInputElement | HTMLSelectElement>} controls */
export function arrangementControlRules(controls) {
  return [...controls].map(el => {
    if (el instanceof HTMLSelectElement && el.id !== 'genre') {
      const options = Array.from(el.options, option => option.value)
      if (el.id === 'bass-pattern') options.push('')
      return {id: el.id, options}
    }
    if (el instanceof HTMLInputElement && (el.type === 'range' || el.type === 'number')) {
      return {id: el.id, range: /** @type {[number,number]} */ ([Number(el.min), Number(el.max)])}
    }
    return {id: el.id}
  })
}

/**
 * @param {HTMLInputElement | HTMLSelectElement} control
 * @param {{value:string,checked:boolean}} saved
 */
export function applySavedControl(control, {value, checked}) {
  control.value = value
  if (control instanceof HTMLInputElement) control.checked = checked
  const eventType = control.type === 'range' || control.type === 'number' ? 'input' : 'change'
  control.dispatchEvent(new Event(eventType, {bubbles:true}))
}
