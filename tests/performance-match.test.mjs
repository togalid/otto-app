import test from 'node:test'
import assert from 'node:assert/strict'
import { performanceMatch } from '../dist/buddy.js'
import { swungBassBeat } from '../dist/groove.js'
test('manual performance rewards harmony and timing independently',()=>{
 const chord='x:0:maj:maj7:0'
 assert.equal(performanceMatch(60,chord,0,0,120,0),1)
 assert.ok(performanceMatch(60,chord,0,.06,120,0)<.8)
 assert.ok(performanceMatch(61,chord,0,0,120,0)<.8)
 assert.equal(performanceMatch(60,chord,0,Infinity,120,0),0)
 assert.equal(performanceMatch(36,chord,0,0,120,0),1)
 assert.equal(performanceMatch(62,chord,2,0,120,0),1)
})
test('swung sixteenths are treated as aligned',()=>{
 assert.equal(performanceMatch(60,'x:0:maj:maj7:0',0,swungBassBeat(.5,100)*.5,120,100),1)
})
