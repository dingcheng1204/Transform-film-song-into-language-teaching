import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './lib/auth.tsx'
import HomePage from './pages/HomePage.tsx'
import DemoPage from './pages/DemoPage.tsx'
import LessonPage from './pages/LessonPage.tsx'
import LoginPage from './pages/LoginPage.tsx'
import ReviewPage from './pages/ReviewPage.tsx'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'lesson/:youtubeId', element: <LessonPage /> },
      { path: 'demo/:lang', element: <DemoPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'review', element: <ReviewPage /> },
    ],
  },
])

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
