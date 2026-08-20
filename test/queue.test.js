import assert from 'node:assert/strict'
import test from 'node:test'
import { SerializedQueue } from '../src/queue.ts'

test('synchronous renderer failures reject and release the queue', async () => {
  const queue = new SerializedQueue(2)
  const failed = queue.enqueue(() => { throw new Error('Worker construction failed') })
  const next = queue.enqueue(async () => 'recovered')

  await assert.rejects(failed.result, /Worker construction failed/)
  assert.equal(await next.result, 'recovered')
  await Promise.resolve()
  assert.equal(queue.active, false)
  assert.equal(queue.pending, 0)
})
