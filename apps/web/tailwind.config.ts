import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#D32F2F',
        secondary: '#FFFFFF',
        accent: '#FFCDD2',
        background: '#F8F8F8',
        surface: '#FFFFFF',
        text: '#212121',
        textSecondary: '#757575',
        border: '#E0E0E0',
        success: '#2E7D32',
        warning: '#B7791F',
        error: '#C62828',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
      boxShadow: {
        'glow-primary': '0 0 20px rgba(211, 47, 47, 0.4)',
        'inner-glow': 'inset 0 0 10px rgba(211, 47, 47, 0.2)',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(211, 47, 47, 0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(211, 47, 47, 0.6)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'pulse-glow': 'pulseGlow 2s infinite ease-in-out',
        float: 'float 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
