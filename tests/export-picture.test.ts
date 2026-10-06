import assert from 'node:assert/strict'
import test from 'node:test'
import { exportFrame, savePng, type SavePicker } from '../src/data/export-layout.ts'

test('image frame includes negative/offscreen nodes, edge labels, padding and summary', () => {
  const boxes = [{ x: -900, y: -300, width: 258, height: 145 }, { x: 5500, y: 12000, width: 830, height: 200 }, { x: 6400, y: 13000, width: 500, height: 28 }]
  const before = structuredClone(boxes), frame = exportFrame(boxes)
  for (const box of boxes) {
    assert.ok(box.x - frame.left >= 48)
    assert.ok(box.y - frame.top + 150 >= 198)
    assert.ok(box.x + box.width - frame.left <= frame.width - 48)
    assert.ok(box.y + box.height - frame.top + 150 <= frame.height - 48)
  }
  assert.deepEqual(boxes, before)
  assert.ok(frame.pixelWidth * frame.pixelHeight <= 48_000_000)
  assert.ok(frame.pixelWidth <= 16000 && frame.pixelHeight <= 16000)
  assert.ok(frame.reduced)
})

test('normal plans use double resolution while invalid or unreadable bounds fail clearly', () => {
  assert.equal(exportFrame([{ x: 0, y: 0, width: 258, height: 145 }]).scale, 2)
  for (const input of [[], [{ x: NaN, y: 0, width: 1, height: 1 }], [{ x: 0, y: 0, width: -1, height: 1 }], [{ x: 0, y: 0, width: 1e9, height: 1e9 }]]) assert.throws(() => exportFrame(input))
  assert.throws(() => exportFrame([{ x: 0, y: 0, width: 1, height: 1 }], Infinity))
})

test('picker opens before an async boundary and writes PNG only to the selected handle', async () => {
  const events: string[] = [], blob = new Blob(['png'], { type: 'image/png' })
  const picker: SavePicker = async options => {
    events.push('picker'); assert.equal(options.suggestedName, 'plan.png')
    assert.deepEqual(options.types[0].accept, { 'image/png': ['.png'] })
    return { createWritable: async () => ({ write: async value => { assert.equal(value, blob); events.push('write') }, close: async () => { events.push('close') } }) }
  }
  const pending = savePng(blob, 'plan.png', picker, () => assert.fail('Unexpected download'))
  assert.deepEqual(events, ['picker'])
  assert.equal(await pending, 'saved'); assert.deepEqual(events, ['picker', 'write', 'close'])
})

test('cancel never downloads; unsupported picker downloads once; write failure aborts and propagates', async () => {
  const blob = new Blob(['png']); let downloads = 0, aborted = false
  const download = () => { downloads++ }
  assert.equal(await savePng(blob, 'p.png', async () => { throw new DOMException('Canceled', 'AbortError') }, download), 'cancelled')
  assert.equal(downloads, 0)
  assert.equal(await savePng(blob, 'p.png', undefined, download), 'downloaded'); assert.equal(downloads, 1)
  await assert.rejects(savePng(blob, 'p.png', async () => ({ createWritable: async () => ({ write: async () => { throw Error('Disk full') }, close: async () => assert.fail('Must not close failed write'), abort: async () => { aborted = true } }) }), download), /Disk full/)
  assert.ok(aborted); assert.equal(downloads, 1)
  await assert.rejects(savePng(blob, 'p.png', async () => { throw new DOMException('Denied', 'SecurityError') }, download), /Denied/)
  assert.equal(downloads, 1)
})
