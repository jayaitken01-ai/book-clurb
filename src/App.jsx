import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/AuthContext.jsx'
import { isConfigured } from './lib/supabase.js'
import { Spinner } from './components/ui.jsx'
import Icon from './components/Icon.jsx'

import Auth from './pages/Auth.jsx'
import Home from './pages/Home.jsx'
import Polls from './pages/Polls.jsx'
import Calendar from './pages/Calendar.jsx'
import Theories from './pages/Theories.jsx'
import Library from './pages/Library.jsx'
import BookPage from './pages/BookPage.jsx'
import Profile from './pages/Profile.jsx'
import Members from './pages/Members.jsx'
import MemberProfile from './pages/MemberProfile.jsx'

const TABS = [
  { to: '/',         icon: 'home',    label: 'Home' },
  { to: '/theories', icon: 'thought',  label: 'Theories' },
  { to: '/calendar', icon: 'calendar', label: 'Calendar' },
  { to: '/library',  icon: 'books',   label: 'Library' },
  { to: '/profile',  icon: 'ribbon',  label: 'Me' },
]

export default function App() {
  const { session, loading } = useAuth()

  if (!isConfigured) {
    return (
      <div className="page">
        <div className="card">
          <h2>Almost there</h2>
          <p>
            All Booked Up can’t find your Supabase keys. Create a file called <code>.env</code> in
            the project folder with:
          </p>
          <pre style={{ background: '#fff', padding: 12, borderRadius: 12, overflowX: 'auto' }}>
{`VITE_SUPABASE_URL=https://yourproject.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
          </pre>
          <p className="muted">Then stop and restart <code>npm run dev</code>.</p>
        </div>
      </div>
    )
  }

  if (loading) return <Spinner />

  if (!session) return <Auth />

  return (
    <div className="app">
      <nav className="tabbar">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) => `tab${isActive ? ' active' : ''}`}
          >
            <Icon name={t.icon} size={21} />
            {t.label}
          </NavLink>
        ))}
      </nav>

      <Routes>
        <Route path="/"          element={<Home />} />
        <Route path="/theories"  element={<Theories />} />
        <Route path="/polls"     element={<Polls />} />
        <Route path="/calendar"  element={<Calendar />} />
        <Route path="/library"   element={<Library />} />
        <Route path="/book/:id"  element={<BookPage />} />
        <Route path="/profile"   element={<Profile />} />
        <Route path="/members"    element={<Members />} />
        <Route path="/member/:id" element={<MemberProfile />} />
        <Route path="*"          element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
