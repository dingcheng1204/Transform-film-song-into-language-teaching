// Guards the contract: the sample timeline must validate against the schema,
// and the generated TS type must accept it.
import Ajv2020 from 'ajv/dist/2020'
import { describe, expect, it } from 'vitest'
import schema from '../../../schema/timeline.schema.json'
import sample from '../../../schema/examples/sample-en.timeline.json'
import type { Timeline } from './timeline'

describe('timeline schema', () => {
  const validate = new Ajv2020({ allErrors: true }).compile(schema)

  it('accepts the sample timeline', () => {
    const ok = validate(sample)
    expect(validate.errors ?? []).toEqual([])
    expect(ok).toBe(true)
    const typed: Timeline = sample as Timeline
    expect(typed.segments.length).toBeGreaterThan(0)
  })

  it('rejects songs longer than 6 minutes', () => {
    const tooLong = { ...sample, song: { ...sample.song, durationSec: 361 } }
    expect(validate(tooLong)).toBe(false)
  })

  it('rejects a segment with more than 2 lines', () => {
    const seg = sample.segments[0]
    const bad = { ...sample, segments: [{ ...seg, lines: [...seg.lines, seg.lines[0]] }] }
    expect(validate(bad)).toBe(false)
  })
})
