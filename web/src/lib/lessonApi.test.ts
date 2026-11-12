import { afterEach, describe, expect, it, vi } from 'vitest'
import { createJob, errorMessage, JobRequestError, stageLabel } from './lessonApi'

afterEach(() => vi.unstubAllGlobals())

describe('createJob', () => {
  it('returns the job', async () => {
    const job = { id: 'j', youtube_id: 'M7lc1UVf-VE', source_lang: 'ja', status: 'pending', stage: null, progress: 0, error: null }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ job }), { status: 200 })))
    expect(await createJob('M7lc1UVf-VE', 'ja')).toEqual(job)
  })

  it('throws the server error code', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'too_long' }), { status: 422 })))
    await expect(createJob('M7lc1UVf-VE', 'ja')).rejects.toEqual(new JobRequestError('too_long'))
  })
})

describe('labels', () => {
  it('pending vs processing stage', () => {
    expect(stageLabel({ status: 'pending', stage: null })).toContain('排隊')
    expect(stageLabel({ status: 'processing', stage: 'separate' })).toContain('分離人聲')
    expect(stageLabel({ status: 'processing', stage: 'lessons' })).toContain('教學')
    expect(stageLabel({ status: 'processing', stage: 'weird' })).toBe('處理中')
  })

  it('error messages', () => {
    expect(errorMessage('too_long')).toContain('6 分鐘')
    expect(errorMessage('internal: KeyError')).toContain('內部錯誤')
    expect(errorMessage('???')).toContain('再試')
    expect(errorMessage(null)).toBe('處理失敗。')
  })
})
