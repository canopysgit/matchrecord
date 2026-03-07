import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Results from './pages/Results'
import Stats from './pages/Stats'
import WinRate from './pages/WinRate'
import Login from './pages/Login'
import MatchSignup from './pages/MatchSignup'
import MatchRecord from './pages/MatchRecord'
import Archive from './pages/Archive'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="results" element={<Results />} />
        <Route path="stats" element={<Stats />} />
        <Route path="winrate" element={<WinRate />} />
        <Route path="archive" element={<Archive />} />
        <Route path="login" element={<Login />} />
        <Route path="admin/signup" element={<MatchSignup />} />
        <Route path="admin/record" element={<MatchRecord />} />
      </Route>
    </Routes>
  )
}
