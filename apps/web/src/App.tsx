import { Route, Routes, useLocation } from 'react-router-dom';
import { Footer } from './components/Footer.js';
import { Header } from './components/Header.js';
import { ParticlesBackground } from './components/ParticlesBackground.js';
import { ComparePage } from './pages/ComparePage.js';
import { HomePage } from './pages/HomePage.js';

export const App = () => {
  const location = useLocation();
  const showParticles = location.pathname === '/';

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      {showParticles ? <ParticlesBackground /> : null}
      <Header />
      <main className="relative z-10 flex-grow">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
};
