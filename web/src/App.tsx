import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from './lib/auth'
import { useDueCount } from './lib/savedApi'

export default function App() {
  const { user, available, signOut } = useAuth()
  const due = useDueCount()
  const location = useLocation()
  const next = encodeURIComponent(location.pathname + location.search)

  return (
    <div className="min-h-screen">
      <header className="border-b border-rule">
        <nav className="mx-auto flex max-w-6xl items-center gap-5 px-4 py-4">
          <Link to="/" className="mr-auto text-lg font-bold">
            一句一句唱
          </Link>
          {available && (
            <>
              <NavLink to="/review" className={({ isActive }) => (isActive ? 'font-bold' : 'text-ink-soft hover:text-ink')}>
                複習
                {user && !!due.data && (
                  <span className="ml-1.5 rounded-full bg-ink px-2 py-0.5 text-xs tabular-nums text-white">{due.data}</span>
                )}
              </NavLink>
              {user ? (
                <button type="button" onClick={() => signOut()} className="text-sm text-muted hover:text-ink" title={user.email ?? ''}>
                  登出
                </button>
              ) : (
                <Link to={`/login?next=${next}`} className="rounded-md border border-ink px-3 py-1 text-sm hover:bg-sheet">
                  登入
                </Link>
              )}
            </>
          )}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10">
        <Outlet />
      </main>
    </div>
  )
}
