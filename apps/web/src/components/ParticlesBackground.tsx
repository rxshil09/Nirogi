import { useCallback } from 'react';
import Particles from 'react-tsparticles';
import { loadFull } from 'tsparticles';

export const ParticlesBackground = () => {
  const particlesInit = useCallback(async (engine: Parameters<typeof loadFull>[0]) => {
    await loadFull(engine);
  }, []);

  return (
    <Particles
      id="nirogi-particles"
      init={particlesInit}
      className="absolute inset-0 z-0 pointer-events-none"
      options={{
        background: { color: { value: '#F8FAFC' } },
        fpsLimit: 60,
        interactivity: {
          events: { onHover: { enable: true, mode: 'repulse' }, resize: true },
          modes: { repulse: { distance: 120, duration: 0.4 } },
        },
        particles: {
          color: { value: ['#E11D48', '#F43F5E', '#94A3B8'] },
          links: { color: '#CBD5E1', distance: 140, enable: true, opacity: 0.45, width: 1 },
          move: { enable: true, outModes: { default: 'bounce' }, speed: 1.2 },
          number: { density: { enable: true, area: 800 }, value: 55 },
          opacity: { value: { min: 0.3, max: 0.7 } },
          shape: { type: 'circle' },
          size: { value: { min: 1.5, max: 4 } },
        },
        detectRetina: true,
      }}
    />
  );
};
