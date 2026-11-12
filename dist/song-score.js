/** Convert legacy independent sections to a chronological whole-song score.
 * @param {import('./progression.js').Section[]} sections
 */
export function migrateSongSections(sections) {
  if (sections.every(section => section.startBar !== undefined && section.endBar !== undefined)) {
    const score=sections[0]
    return sections.map(section=>({...section,slots:score.slots,beatSlots:score.beatSlots,modulation:score.modulation,barCount:score.barCount ?? score.slots.length,advance:false}))
  }
  const slots=/** @type {string[]} */([]), beatSlots=/** @type {(string|null)[][]} */([]), modulation=/** @type {number[]} */([])
  const ranges=sections.map(section=>{
    const startBar=slots.length, count=section.barCount ?? section.slots.length
    for(let bar=0;bar<count;bar++) {
      slots.push(section.slots[bar]);beatSlots.push([...(section.beatSlots[bar] ?? [null,null,null,null])])
      if((slots.length-1)%2===0)modulation.push(section.modulation[Math.floor(bar/2)] ?? 0)
    }
    return {...section,startBar,endBar:slots.length}
  })
  if(slots.length%2){slots.push(slots.at(-1) ?? 'C');beatSlots.push([null,null,null,null]);ranges[ranges.length-1].endBar++}
  return ranges.map(section=>({...section,slots,beatSlots,modulation,barCount:slots.length,advance:false}))
}
