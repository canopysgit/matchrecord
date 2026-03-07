import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Home, Trophy, BarChart3, Percent, LogIn, LogOut, Menu, X, ClipboardList, FileEdit, Archive } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const publicLinks = [
  { to: '/', label: '首页', icon: Home },
  { to: '/results', label: '比赛结果', icon: Trophy },
  { to: '/stats', label: '球员统计', icon: BarChart3 },
  { to: '/winrate', label: '胜率统计', icon: Percent },
  { to: '/archive', label: '历史赛季', icon: Archive },
]

const adminLinks = [
  { to: '/admin/signup', label: '比赛报名', icon: ClipboardList },
  { to: '/admin/record', label: '比赛记录', icon: FileEdit },
]

export default function Layout() {
  const { session, signOut } = useAuth()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen flex flex-col">
      {/* Desktop nav */}
      <nav className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="text-lg font-bold tracking-wide">
              丛莱梅蔬果足球队
            </Link>

            {/* Desktop links */}
            <div className="hidden md:flex items-center gap-1">
              {publicLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    isActive(link.to)
                      ? 'bg-white/20 text-white'
                      : 'text-blue-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {session && adminLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    isActive(link.to)
                      ? 'bg-amber-500 text-white'
                      : 'text-amber-200 hover:bg-amber-500/30 hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {session ? (
                <button
                  onClick={signOut}
                  className="ml-2 px-3 py-2 rounded-lg text-sm text-blue-100 hover:bg-white/10 hover:text-white transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              ) : (
                <Link
                  to="/login"
                  className="ml-2 px-3 py-2 rounded-lg text-sm text-blue-100 hover:bg-white/10 hover:text-white transition"
                >
                  <LogIn className="w-4 h-4" />
                </Link>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-blue-500/30 pb-3">
            {publicLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 text-sm ${
                  isActive(link.to) ? 'bg-white/20 text-white' : 'text-blue-100'
                }`}
              >
                <link.icon className="w-5 h-5" />
                {link.label}
              </Link>
            ))}
            {session && adminLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 text-sm ${
                  isActive(link.to) ? 'bg-amber-500/30 text-white' : 'text-amber-200'
                }`}
              >
                <link.icon className="w-5 h-5" />
                {link.label}
              </Link>
            ))}
            {session ? (
              <button
                onClick={() => { signOut(); setMobileMenuOpen(false) }}
                className="flex items-center gap-3 px-4 py-3 text-sm text-blue-100 w-full"
              >
                <LogOut className="w-5 h-5" /> 退出登录
              </button>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm text-blue-100"
              >
                <LogIn className="w-5 h-5" /> 管理员登录
              </Link>
            )}
          </div>
        )}
      </nav>

      {/* Main content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="flex justify-around py-1">
          {publicLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`flex flex-col items-center py-2 px-3 text-xs ${
                isActive(link.to) ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              <link.icon className="w-5 h-5 mb-0.5" />
              {link.label.replace('统计', '')}
            </Link>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <footer className="hidden md:block bg-gray-800 text-gray-400 text-center py-4 text-sm">
        &copy; 2013-2026 丛莱梅蔬果足球队
      </footer>

      {/* Spacer for mobile bottom nav */}
      <div className="md:hidden h-16" />
    </div>
  )
}
