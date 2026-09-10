import { useEffect, useState } from 'react'
import { NavLink, Link, Route, Routes, useLocation } from 'react-router-dom'
import { loadData } from './data.js'
import Home from './routes/Home.jsx'
import Subjects from './routes/Subjects.jsx'
import Subject from './routes/Subject.jsx'
import Manuscripts from './routes/Manuscripts.jsx'
import Manuscript from './routes/Manuscript.jsx'
import Figures from './routes/Figures.jsx'
import Figure from './routes/Figure.jsx'
import Search from './routes/Search.jsx'

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const location = useLocation()

  useEffect(() => {
    loadData().then(setData, (e) => setError(e))
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="shell">
      <header className="masthead">
        <div className="masthead-inner">
          <Link className="wordmark" to="/">
            Marginalia
          </Link>
          <nav>
            <NavLink to="/subjects">Motifs</NavLink>
            <NavLink to="/manuscripts">Manuscripts</NavLink>
            <NavLink to="/figures">Plates</NavLink>
            <NavLink to="/search">Search</NavLink>
          </nav>
        </div>
      </header>

      {error ? (
        <div className="leaf wide">
          <div className="column">
            <h1>The index could not be loaded</h1>
            <p className="lede">{error.message}</p>
            <p>Run <code>npm run prepare-data</code> to rebuild the files in <code>public/data</code>, then reload.</p>
          </div>
        </div>
      ) : !data ? (
        <div className="booting">Opening the index…</div>
      ) : (
        <Routes>
          <Route path="/" element={<Home data={data} />} />
          <Route path="/subjects" element={<Subjects data={data} />} />
          <Route path="/subject/:id" element={<Subject data={data} />} />
          <Route path="/manuscripts" element={<Manuscripts data={data} />} />
          <Route path="/manuscript/:id" element={<Manuscript data={data} />} />
          <Route path="/figures" element={<Figures data={data} />} />
          <Route path="/figure/:id" element={<Figure data={data} />} />
          <Route path="/search" element={<Search data={data} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      )}
    </div>
  )
}

function NotFound() {
  return (
    <div className="leaf wide">
      <div className="column">
        <h1>Nothing at this address</h1>
        <p className="lede">
          Start from the <Link to="/subjects">motifs</Link>, the <Link to="/manuscripts">manuscripts</Link>, or the{' '}
          <Link to="/figures">plates</Link>.
        </p>
      </div>
    </div>
  )
}
