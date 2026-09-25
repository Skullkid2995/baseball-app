import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRecognitionDelay } from './recognitionDelay'

describe('handwriting pause', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('does not read a lifted stroke until 2.5 seconds have passed', () => {
    const read = vi.fn()
    createRecognitionDelay(read).schedule(['first line'])
    vi.advanceTimersByTime(2499)
    expect(read).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(read).toHaveBeenCalledExactlyOnceWith(['first line'])
  })

  it('waits through a long second stroke and reads all lines together', () => {
    const read = vi.fn()
    const delay = createRecognitionDelay(read)
    delay.schedule(['first line'])
    vi.advanceTimersByTime(2000)
    delay.cancel() // Finger goes down again, before lifting to commit the next line.
    vi.advanceTimersByTime(6000)
    expect(read).not.toHaveBeenCalled()
    delay.schedule(['first line', 'second line'])
    vi.advanceTimersByTime(2499)
    expect(read).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(read).toHaveBeenCalledExactlyOnceWith(['first line', 'second line'])
  })

  it('restarts the wait for edited ink and discards the stale read', () => {
    const read = vi.fn()
    const delay = createRecognitionDelay(read)
    delay.schedule(['old ink'])
    vi.advanceTimersByTime(2000)
    delay.schedule(['new ink'])
    vi.advanceTimersByTime(2000)
    expect(read).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2000)
    expect(read).toHaveBeenCalledExactlyOnceWith(['new ink'])
  })

  it('does not recognize cleared ink or an editor that has closed', () => {
    const read = vi.fn()
    const delay = createRecognitionDelay(read)
    delay.schedule(['unfinished ink'])
    delay.cancel()
    vi.runAllTimers()
    expect(read).not.toHaveBeenCalled()
  })
})
