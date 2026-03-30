import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import ProjectPage from './pages/ProjectPage';
import AssetPage from './pages/AssetPage';
import EditorPage from './pages/EditorPage';
function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <button
      className="btn-theme-toggle"
      onClick={() => setDark(d => !d)}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? '☀' : '☾'}
    </button>
  );
}

function AppShell() {
  const location = useLocation();
  const isEditor = location.pathname.startsWith('/project/') && location.pathname.endsWith('/edit');

  return (
    <>
      {!isEditor && (
        <nav className="app-nav">
          <NavLink to="/project" className={({ isActive }) => isActive ? 'active' : ''}>Project</NavLink>
          <NavLink to="/asset" className={({ isActive }) => isActive ? 'active' : ''}>Asset</NavLink>
          <span className="nav-spacer" />
          <ThemeToggle />
        </nav>
      )}
      <Routes>
        <Route path="/project/:id/edit" element={<EditorPage />} />
        <Route path="/project" element={<main className="app-main"><ProjectPage /></main>} />
        <Route path="/asset" element={<main className="app-main"><AssetPage /></main>} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

