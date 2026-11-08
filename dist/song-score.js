/** Convert legacy independent sections to a chronological whole-song score.
 * @param {import('./progression.js').Section[]} sections
 */
export function migrateSongSections(sections) {
  if (sections.every(section => section.startBar !== undefined && section.endBar !== undefined)) {
    const score=sections[0]
    return sections.map((section,index)=>({...section,name:section.name ?? String.fromCharCode(65+index),slots:score.slots,beatSlots:score.beatSlots,modulation:score.modulation,barCount:score.barCount ?? score.slots.length,advance:false}))
  }
  const slots=/** @type {string[]} */([]), beatSlots=/** @type {(string|null)[][]} */([]), modulation=/** @type {number[]} */([])
  const ranges=sections.map((section,index)=>{
    const startBar=slots.length, count=section.barCount ?? section.slots.length
    for(let bar=0;bar<count;bar++) {
      slots.push(section.slots[bar]);beatSlots.push([...(section.beatSlots[bar] ?? [null,null,null,null])])
      if((slots.length-1)%2===0)modulation.push(section.modulation[Math.floor(bar/2)] ?? 0)
    }
    return {...section,name:section.name ?? String.fromCharCode(65+index),startBar,endBar:slots.length}
  })
  if(slots.length%2){slots.push(slots.at(-1) ?? 'C');beatSlots.push([null,null,null,null]);ranges[ranges.length-1].endBar++}
  return ranges.map(section=>({...section,slots,beatSlots,modulation,barCount:slots.length,advance:false}))
}

/** Split a section, copying its arrangement settings and retaining every chord.
 * @param {import('./progression.js').Section[]} sections @param {number} index */
export function splitSongSection(sections,index) {
 const source=sections[index]
 if(!source || sections.length>=32 || (source.endBar ?? 0)-(source.startBar ?? 0)<2)return false
 const end=source.endBar ?? 0, middle=(source.startBar ?? 0)+Math.floor((end-(source.startBar ?? 0))/2)
 source.endBar=middle
 const name=Array.from({length:32},(_,i)=>i<26?String.fromCharCode(65+i):`S${i+1}`).find(name=>!sections.some(section=>section.name===name)) ?? '新規'
 sections.splice(index+1,0,{...source,name,startBar:middle,endBar:end,partSettings:{...source.partSettings},backingSteps:source.backingSteps?.map(step=>({...step}))})
 return true
}
/** Remove a range boundary; chords are preserved in the neighbouring section.
 * @param {import('./progression.js').Section[]} sections @param {number} index */
export function removeSongSection(sections,index) {
 if(sections.length<=1||!sections[index])return false
 const removed=sections[index]
 if(index>0)sections[index-1].endBar=removed.endBar
 else sections[1].startBar=0
 sections.splice(index,1);return true
}
/** Move a complete section with its chords, beat changes and arrangement settings.
 * @param {import('./progression.js').Section[]} sections @param {number} index @param {number} direction */
export function moveSongSection(sections,index,direction) {
 const target=index+direction
 if(!sections[index]||!sections[target]||![-1,1].includes(direction))return false
 const blocks=sections.map(section=>({section,slots:section.slots.slice(section.startBar,section.endBar),beats:section.beatSlots.slice(section.startBar,section.endBar),keys:section.slots.slice(section.startBar,section.endBar).map((_,i)=>section.modulation[Math.floor(((section.startBar ?? 0)+i)/2)] ?? 0)}))
 const [block]=blocks.splice(index,1);blocks.splice(target,0,block)
 const slots=blocks.flatMap(block=>block.slots),beatSlots=blocks.flatMap(block=>block.beats),keys=blocks.flatMap(block=>block.keys)
 // Pair-based modulation cannot represent a change inside a pair; reject without mutation.
 if(keys.some((key,index)=>index%2===1 && key!==keys[index-1]))return false
 const modulation=Array.from({length:Math.ceil(slots.length/2)},(_,pair)=>keys[pair*2])
 let start=0
 sections.splice(0,sections.length,...blocks.map(block=>{const startBar=start;start+=block.slots.length;return {...block.section,startBar,endBar:start,slots,beatSlots,modulation}}))
 return true
}
