import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store/app';
import { useEffect } from 'react';
import Layout from './components/Layout';
import Home from './pages/Home';
import GameLibrary from './pages/GameLibrary';
import Stats from './pages/Stats';
import Profile from './pages/Profile';
import GamePlay from './pages/GamePlay';
import AdminPanel from './pages/AdminPanel';
import AdminLogin from './pages/AdminLogin';

/** Separate component — always reads fresh Zustand state, never stale closure */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const isAdmin = useAppStore(s => s.isAdmin);
  if (!isAdmin) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const darkMode = useAppStore((s) => s.darkMode);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  return (
    <Router>
      <Routes>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={
          <AdminRoute>
            <Layout><AdminPanel /></Layout>
          </AdminRoute>
        } />
        <Route path="/" element={<Layout><Home /></Layout>} />
        <Route path="/games" element={<Layout><GameLibrary /></Layout>} />
        <Route path="/stats" element={<Layout><Stats /></Layout>} />
        <Route path="/profile" element={<Layout><Profile /></Layout>} />
        <Route path="/game/:gameId" element={<Layout><GamePlay /></Layout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}