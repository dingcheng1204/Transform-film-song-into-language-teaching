import { Link, Outlet } from 'react-router'

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-4">
          <Link to="/" className="text-lg font-bold">
            一句一句唱
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10">
        <Outlet />
      </main>
    </div>
  )
}
