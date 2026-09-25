import { expect, it } from 'vitest'
import { confidentNotation } from './paperRecognition'
it('only prefills clear baseball notation',()=>{
  expect(confidentNotation([{symbol:'K',score:0.97},{symbol:'BB',score:0.6}])).toBe('K')
  expect(confidentNotation([{symbol:'1B',score:0.93},{symbol:'HR',score:0.9}])).toBeNull()
  expect(confidentNotation([{symbol:'K',score:0.6}])).toBeNull()
  expect(confidentNotation([])).toBeNull()
})
