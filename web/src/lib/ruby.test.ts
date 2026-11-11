import { describe, expect, it } from 'vitest'
import { splitRuby } from './ruby'

describe('splitRuby', () => {
  it.each([
    ['光る', 'ひかる', [{ base: '光', rt: 'ひか' }, { base: 'る' }]],
    ['呼ぶ', 'よぶ', [{ base: '呼', rt: 'よ' }, { base: 'ぶ' }]],
    ['行こう', 'いこう', [{ base: '行', rt: 'い' }, { base: 'こう' }]],
    ['お茶', 'おちゃ', [{ base: 'お' }, { base: '茶', rt: 'ちゃ' }]],
    ['夜空', 'よぞら', [{ base: '夜空', rt: 'よぞら' }]],
    ['に', 'に', [{ base: 'に' }]],
    ['ココロ', 'こころ', [{ base: 'ココロ' }]],
    ['같이', '가치', [{ base: '같이', rt: '가치' }]],
    ['light', 'laɪt', [{ base: 'light', rt: 'laɪt' }]],
  ])('%s / %s', (text, reading, parts) => expect(splitRuby(text, reading)).toEqual(parts))

  it('no reading', () => expect(splitRuby('星', undefined)).toEqual([{ base: '星' }]))
})
