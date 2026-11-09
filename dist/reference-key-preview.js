/**
 * @param {Pick<ReturnType<import('./reference-player.js').mountReferencePlayer>, 'previewKey'|'stopKeyPreview'>} player
 * @param {{stop:()=>void}} progression
 * @param {{matching:boolean,keyRetry:boolean,root:number}} view
 */
export function createKeyPreview(player, progression, view) {
  let request = 0
  function stop() {
    request++
    view.matching = false
    view.keyRetry = false
    player.stopKeyPreview()
  }
  function toggle() {
    if (view.matching) {
      stop()
      return
    }
    progression.stop()
    view.matching = true
    view.keyRetry = false
    const current = ++request
    void player.previewKey(view.root).catch(() => {
      if (current !== request) return
      stop()
      view.keyRetry = true
    })
  }
  return {stop, toggle}
}
