// Native selects retain the version-1 IDs. Programmatic changes use the
// same musical command as user input, then notify the presentation layer.
export function createPartSettings() {
  /** @type {Map<HTMLSelectElement, () => void>} */
  const commands = new Map()
  /** @param {HTMLSelectElement} control @param {()=>void} command */
  function bind(control, command) {
    commands.set(control, command)
    control.addEventListener('change', command)
  }
  /** @param {HTMLSelectElement} control @param {string} value */
  function apply(control, value) {
    const command = commands.get(control)
    if (!command) return false
    control.value = value
    command()
    control.dispatchEvent(new Event('part-sync', {bubbles: true}))
    return true
  }
  /** @param {string[]} ids @param {Record<string,string>} settings */
  function restore(ids, settings) {
    for (const id of ids) {
      const control = /** @type {HTMLSelectElement} */ (document.getElementById(id))
      const value = settings[id]
      if (value !== undefined && control.value !== value) apply(control, value)
    }
  }
  return {bind, apply, restore}
}
