import { describe, expect, it } from 'vitest'
import { checkDictation } from './dictation'

describe('checkDictation', () => {
  it('english: word level, ignores case and punctuation', () => {
    const r = checkDictation({ text: 'Walk me out into the light' }, 'walk me out in the light!', 'en')
    expect(r.expected.map((m) => m.ok)).toEqual([true, true, true, false, true, true])
    expect(r.score).toBeCloseTo(5 / 6)
    expect(r.extra).toEqual(['in'])
  })

  it('english: apostrophes are normalized', () => {
    expect(checkDictation({ text: "I'm here" }, 'I’m here', 'en').score).toBe(1)
  })

  it('japanese: kana answer accepted for kanji via the reading', () => {
    const line = { text: '夜空に光る星', reading: 'よぞらにひかるほし' }
    const r = checkDictation(line, 'よぞらにひかるほし', 'ja')
    expect(r.score).toBe(1)
    expect(r.expected.map((m) => m.text).join('')).toBe('よぞらにひかるほし')
  })

  it('japanese: kanji answer checked against the lyric', () => {
    const line = { text: '夜空に光る星', reading: 'よぞらにひかるほし' }
    expect(checkDictation(line, '夜空に光る星', 'ja').score).toBe(1)
  })

  it('japanese: katakana and spaces are normalized, missed chars marked', () => {
    const r = checkDictation({ text: 'ココロ 届け' }, 'こころとどけ', 'ja')
    // reading not given → compares against the lyric; only the kanji 届 is missed
    expect(r.expected.map((m) => `${m.text}${m.ok ? '' : '✗'}`).join('')).toBe('こころ届✗け')
    expect(r.score).toBeCloseTo(4 / 5)
  })

  it('korean: eojeol level', () => {
    const r = checkDictation({ text: '같이 걸어갈까' }, '같이 걸어갈가', 'ko')
    expect(r.expected.map((m) => m.ok)).toEqual([true, false])
    expect(r.extra).toEqual(['걸어갈가'])
  })

  it('empty answer scores 0', () => {
    expect(checkDictation({ text: 'hello world' }, '', 'en').score).toBe(0)
  })
})
