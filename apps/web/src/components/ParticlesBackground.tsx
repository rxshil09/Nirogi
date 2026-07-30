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
      className="absolute inset-0 z-0"
      options={{
        background: { color: { value: '#F8F8F8' } },
        fpsLimit: 60,
        interactivity: {
          events: { onHover: { enable: true, mode: 'repulse' }, resize: true },
          modes: { repulse: { distance: 100, duration: 0.4 } },
        },
        particles: {
          color: { value: ['#D32F2F', '#FFCDD2', '#E0E0E0'] },
          links: { color: '#E0E0E0', distance: 150, enable: true, opacity: 0.4, width: 1 },
          move: { enable: true, outModes: { default: 'bounce' }, speed: 1 },
          number: { density: { enable: true, area: 800 }, value: 60 },
          opacity: { value: 0.7 },
          shape: { type: 'square' },
          size: { value: { min: 1, max: 5 } },
        },
        detectRetina: true,
      }}
    />
  );
};
