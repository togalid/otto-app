/** @typedef {import('./progression.js').Section} Section */

/**
 * Convert legacy independent sections to a chronological whole-song score.
 * @param {Section[]} sections
 */
export function migrateSongSections(sections) {
  if (sections.length === 0) return []
  if (sections.every(section => section.startBar !== undefined && section.endBar !== undefined)) {
    return shareScore(sections, sections[0])
  }

  const slots = /** @type {string[]} */ ([])
  const beatSlots = /** @type {(string|null)[][]} */ ([])
  const modulation = /** @type {number[]} */ ([])
  const ranges = sections.map(section => {
    const startBar = slots.length
    const count = section.barCount ?? section.slots.length
    for (let bar = 0; bar < count; bar++) {
      slots.push(section.slots[bar])
      beatSlots.push([...(section.beatSlots[bar] ?? [null, null, null, null])])
      if ((slots.length - 1) % 2 === 0) modulation.push(section.modulation[Math.floor(bar / 2)] ?? 0)
    }
    return {...section, startBar, endBar: slots.length}
  })
  if (slots.length % 2) {
    slots.push(slots.at(-1) ?? 'C')
    beatSlots.push([null, null, null, null])
    ranges[ranges.length - 1].endBar++
  }
  return shareScore(ranges, {slots, beatSlots, modulation})
}

/**
 * @param {Section[]} sections
 * @param {Pick<Section, 'slots' | 'beatSlots' | 'modulation' | 'barCount'>} score
 */
function shareScore(sections, {slots, beatSlots, modulation, barCount = slots.length}) {
  return sections.map(section => ({...section, slots, beatSlots, modulation, barCount, advance:false}))
}

/**
 * Use the restored global part controls for sections from files that lack part settings.
 * @param {Section[]} sections
 * @param {NonNullable<Section['partSettings']>} fallbackParts
 */
export function restoreSongSections(sections, fallbackParts) {
  return migrateSongSections(sections).map(section => {
    section.partSettings ??= {...fallbackParts}
    return section
  })
}
