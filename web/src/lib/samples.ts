import en from '../../../schema/examples/sample-en.timeline.json'
import ja from '../../../schema/examples/sample-ja.timeline.json'
import ko from '../../../schema/examples/sample-ko.timeline.json'
import type { Song, Timeline } from '../types/timeline'

export type Lang = Song['sourceLang']

// Demo timelines (original lines over the YouTube IFrame API demo video) until P2 produces real ones.
export const SAMPLES: Record<Lang, Timeline> = {
  ja: ja as Timeline,
  en: en as Timeline,
  ko: ko as Timeline,
}

export const LANG_LABEL: Record<Lang, string> = { ja: '日文', en: '英文', ko: '韓文' }
