import { describe, expect, it } from 'vitest'
import { parseYouTubeId } from './youtube'

describe('parseYouTubeId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=M7lc1UVf-VE', 'M7lc1UVf-VE'],
    ['https://youtu.be/M7lc1UVf-VE?t=10', 'M7lc1UVf-VE'],
    ['https://m.youtube.com/watch?v=M7lc1UVf-VE&list=x', 'M7lc1UVf-VE'],
    ['https://music.youtube.com/watch?v=M7lc1UVf-VE', 'M7lc1UVf-VE'],
    ['https://www.youtube.com/embed/M7lc1UVf-VE', 'M7lc1UVf-VE'],
    ['https://www.youtube.com/shorts/M7lc1UVf-VE', 'M7lc1UVf-VE'],
    ['M7lc1UVf-VE', 'M7lc1UVf-VE'],
  ])('%s', (input, id) => {
    expect(parseYouTubeId(input)).toBe(id)
  })

  it.each(['', 'hello', 'https://vimeo.com/123', 'https://youtube.com/watch?v=short'])(
    'rejects %s',
    (input) => {
      expect(parseYouTubeId(input)).toBeNull()
    },
  )
})
