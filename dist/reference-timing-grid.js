/** @param {number} beatsPerBar @param {number} bars @param {number} page */
export function timingGrid(beatsPerBar, bars, page) {
  const beats = beatsPerBar * bars
  const grid = []
  for (let tick = Math.ceil(-0.12 * beats * 4); tick <= beats * 4; tick++) {
    const beat = tick / 4,
      x = (beat / beats + 0.12) * 1000
    if (x < 0 || x > 1000) continue
    const barLine = tick % (beatsPerBar * 4) === 0
    const beatLine = tick % 4 === 0
    grid.push({
      x,
      height: barLine ? 100 : beatLine ? 50 : tick % 2 === 0 ? 5 : 3,
      kind: barLine
        ? tick === 0
          ? 'bar-grid first-beat-grid'
          : 'bar-grid'
        : beatLine
          ? 'beat-grid'
          : 'ruler-tick',
      bar: barLine
        ? Math.round(page + beat / beatsPerBar) + 1
        : 0,
    })
  }
  return grid
}
