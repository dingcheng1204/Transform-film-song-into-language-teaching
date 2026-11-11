// Guards the contract: every sample timeline must validate against the schema,
// and the generated TS type must accept it.
import Ajv2020 from 'ajv/dist/2020'
import { describe, expect, it } from 'vitest'
import schema from '../../../schema/timeline.schema.json'
import sampleEn from '../../../schema/examples/sample-en.timeline.json'
import sampleJa from '../../../schema/examples/sample-ja.timeline.json'
import sampleKo from '../../../schema/examples/sample-ko.timeline.json'
import type { Timeline } from './timeline'

const samples = { en: sampleEn, ja: sampleJa, ko: sampleKo }

describe('timeline schema', () => {
  const validate = new Ajv2020({ allErrors: true }).compile(schema)

  it.each(Object.entries(samples))('accepts the %s sample', (lang, sample) => {
    const ok = validate(sample)
    expect(validate.errors ?? []).toEqual([])
    expect(ok).toBe(true)
    const typed = sample as Timeline
    expect(typed.song.sourceLang).toBe(lang)
  })

  it('rejects songs longer than 6 minutes', () => {
    const tooLong = { ...sampleEn, song: { ...sampleEn.song, durationSec: 361 } }
    expect(validate(tooLong)).toBe(false)
  })

  it('rejects unsupported languages', () => {
    const zh = { ...sampleEn, song: { ...sampleEn.song, sourceLang: 'zh' } }
    expect(validate(zh)).toBe(false)
  })

  it('rejects a segment with more than 2 lines', () => {
    const seg = sampleEn.segments[0]
    const bad = { ...sampleEn, segments: [{ ...seg, lines: [...seg.lines, seg.lines[0]] }] }
    expect(validate(bad)).toBe(false)
  })
})
