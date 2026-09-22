export const HANDWRITING_DELAY_MS = 4000

/** A new stroke cancels the previous read; only a complete pause releases the ink. */
export function createRecognitionDelay<T>(onReady: (value: T) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined
  function cancel() {
    clearTimeout(timer)
    timer = undefined
  }
  return {
    cancel,
    schedule(value: T) {
      cancel()
      timer = setTimeout(() => {
        timer = undefined
        onReady(value)
      }, HANDWRITING_DELAY_MS)
    },
  }
}
