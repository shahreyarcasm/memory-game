import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAppStore } from './store/app';
import { useEffect } from 'react';
import Layout from './components/Layout';
import Home from './pages/Home';
import GameLibrary from './pages/GameLibrary';
import Stats from './pages/Stats';
import Profile from './pages/Profile';
import GamePlay from './pages/GamePlay';

export default function App() {
  const darkMode = useAppStore((s) => s.darkMode);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/games" element={<GameLibrary />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/game/:gameId" element={<GamePlay />} />
        </Routes>
      </Layout>
    </Router>
  );
}
