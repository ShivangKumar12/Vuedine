/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Brand: hot pink / magenta
        brand: {
          50:  '#FFF1F7',
          100: '#FFE0EC',
          200: '#FFC2D9',
          300: '#FF94BD',
          400: '#FF5C9C',
          500: '#EC1B7C', // primary
          600: '#D11270',
          700: '#A60C5C',
          800: '#7A0844',
          900: '#54052F',
        },
        // Warm accent (orange/coral)
        warm: {
          50:  '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
        },
        // Cool accent (teal)
        cool: {
          50:  '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0F766E',
        },
        // Sun (gold for highlights)
        sun: {
          50:  '#FEFCE8',
          100: '#FEF9C3',
          400: '#FACC15',
          500: '#EAB308',
        },
        // Light surfaces
        ink: {
          50:  '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
          950: '#020617',
        },
      },
      keyframes: {
        floaty: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        floaty2: {
          '0%,100%': { transform: 'translateY(0) rotate(-2deg)' },
          '50%': { transform: 'translateY(-14px) rotate(2deg)' },
        },
        spinSlow: { to: { transform: 'rotate(360deg)' } },
        shimmer: { to: { backgroundPosition: '200% center' } },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        pulseRing: {
          '0%': { transform: 'scale(.9)', opacity: '1' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        auroraFloat: {
          '0%': { transform: 'translate3d(0,0,0) rotate(0deg) scale(1)' },
          '50%': { transform: 'translate3d(2%,-3%,0) rotate(8deg) scale(1.05)' },
          '100%': { transform: 'translate3d(-2%,3%,0) rotate(-6deg) scale(1.02)' },
        },
        drawIn: { to: { strokeDashoffset: '0' } },
      },
      animation: {
        floaty: 'floaty 6s ease-in-out infinite',
        'floaty-2': 'floaty2 7.5s ease-in-out infinite',
        'spin-slow': 'spinSlow 30s linear infinite',
        shimmer: 'shimmer 3s linear infinite',
        marquee: 'marquee 40s linear infinite',
        'pulse-ring': 'pulseRing 2s ease-out infinite',
        'aurora-float': 'auroraFloat 22s ease-in-out infinite alternate',
        'draw-in': 'drawIn 3s cubic-bezier(.2,.8,.2,1) forwards',
      },
    },
  },
  plugins: [],
};
