import { useState, type FormEvent } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { useAuth } from '../lib/auth'

export default function LoginPage() {
  const { user, available, signInWithEmail, signInWithGoogle } = useAuth()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={params.get('next') ?? '/'} replace />

  async function onEmail(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await signInWithEmail(email.trim())
    setBusy(false)
    if (err) setError(err)
    else setSent(true)
  }

  async function onGoogle() {
    setError(null)
    const err = await signInWithGoogle()
    if (err) setError(err)
  }

  return (
    <section className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold">登入</h1>
        <p className="mt-2 text-ink-soft">登入後可以收藏單字和句子，手機和電腦都能接著複習。</p>
      </div>
      {!available && <p className="text-alert">登入功能還沒設定好。</p>}

      {sent ? (
        <p className="rounded-lg border border-rule bg-sheet p-4">
          登入連結已經寄到 <strong>{email}</strong>，到信箱點連結就會回到這裡並完成登入。
        </p>
      ) : (
        <form onSubmit={onEmail} className="space-y-3">
          <label htmlFor="email" className="block font-medium">
            用 Email 登入
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-md border border-rule bg-sheet px-3 py-2.5 outline-none focus:border-ink"
          />
          <button
            type="submit"
            disabled={busy || !available}
            className="w-full rounded-md bg-ink px-5 py-2.5 font-medium text-white hover:bg-ink-soft disabled:opacity-50"
          >
            {busy ? '寄送中…' : '寄登入連結給我'}
          </button>
        </form>
      )}

      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="h-px flex-1 bg-rule" />或<span className="h-px flex-1 bg-rule" />
      </div>
      <button
        type="button"
        onClick={onGoogle}
        disabled={!available}
        className="w-full rounded-md border border-ink px-5 py-2.5 font-medium hover:bg-sheet disabled:opacity-50"
      >
        用 Google 帳號登入
      </button>
      {error && <p className="text-sm text-alert">{error}</p>}
    </section>
  )
}
