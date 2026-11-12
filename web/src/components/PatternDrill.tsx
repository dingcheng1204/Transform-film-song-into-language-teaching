import { useState } from 'react'
import type { Pattern, Song } from '../types/timeline'

interface Props {
  patterns: Pattern[]
  lang: Song['sourceLang']
  canSpeak: boolean
  onSpeak: (text: string) => void
}

type Mode = 'listen' | 'recall'

// Sentence-pattern drill: hear and repeat substituted sentences, or see the Chinese,
// try saying it, then reveal and listen.
export default function PatternDrill({ patterns, lang, canSpeak, onSpeak }: Props) {
  const [mode, setMode] = useState<Mode>('listen')
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  if (!patterns.length) return null

  function reveal(key: string, text: string) {
    setRevealed((r) => new Set(r).add(key))
    if (canSpeak) onSpeak(text)
  }

  return (
    <section aria-label="句型練習" className="mt-6 border-t border-rule pt-5">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-bold text-ink">句型練習</h3>
        <div role="tablist" className="flex rounded-md border border-rule p-0.5 text-sm">
          {(
            [
              ['listen', '聽著跟念'],
              ['recall', '看中文說說看'],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m)
                setRevealed(new Set())
              }}
              className={`rounded px-3 py-1 ${mode === m ? 'bg-ink text-white' : 'text-ink-soft hover:bg-paper'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {patterns.map((p, pi) => (
        <div key={pi} className="space-y-3">
          <p className="text-xl font-medium" lang={lang}>
            {p.pattern}
          </p>
          {p.explanation && <p className="text-[15px] text-ink-soft">{p.explanation}</p>}
          <ol className="space-y-2">
            {p.examples.map((ex, ei) => {
              const key = `${pi}-${ei}`
              const hidden = mode === 'recall' && !revealed.has(key)
              return (
                <li key={key} className="flex flex-wrap items-start gap-x-4 gap-y-1 rounded-md bg-paper px-3 py-2">
                  <div className="min-w-0 flex-1">
                    {hidden ? (
                      <p className="text-lg" lang="zh-Hant">
                        {ex.translation}
                        {ex.swap && <span className="ml-2 text-sm text-muted">提示：{ex.swap}</span>}
                      </p>
                    ) : (
                      <>
                        <p className="text-lg font-medium" lang={lang}>
                          {ex.text}
                        </p>
                        {(ex.reading || ex.romanization) && (
                          <p className="text-sm text-muted">
                            {ex.reading && ex.reading !== ex.text && <span lang={lang}>{ex.reading}</span>}
                            {ex.reading && ex.reading !== ex.text && ex.romanization && ' · '}
                            {ex.romanization}
                          </p>
                        )}
                        <p className="text-ink-soft" lang="zh-Hant">
                          {ex.translation}
                          {ex.swap && mode === 'listen' && <span className="ml-2 text-sm text-muted">（{ex.swap}）</span>}
                        </p>
                      </>
                    )}
                  </div>
                  {hidden ? (
                    <button
                      type="button"
                      onClick={() => reveal(key, ex.text)}
                      className="rounded-md border border-ink px-3 py-1 text-sm hover:bg-sheet"
                    >
                      說完了，看答案
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSpeak(ex.text)}
                      disabled={!canSpeak}
                      aria-label={`朗讀：${ex.text}`}
                      className="rounded-md border border-ink px-3 py-1 text-sm hover:bg-sheet disabled:opacity-50"
                    >
                      念給我聽
                    </button>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      ))}
      <p className="mt-3 text-sm text-muted">
        {mode === 'listen'
          ? '聽一次、跟著念一次，再換下一句。'
          : '先看中文自己說說看，說完再看答案、聽正確念法。'}
      </p>
    </section>
  )
}
