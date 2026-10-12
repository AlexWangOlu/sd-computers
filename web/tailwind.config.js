/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './admin.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Design tokens. Every colour is a CSS variable set on .os-root by
      // src/os/theme.ts, so dark/light + the user's accent switch live without a rebuild.
      colors: {
        win: 'var(--win-bg)', // window / Mica base
        layer: 'var(--layer)', // content layer inside a window
        card: 'var(--card)', // card / list row
        'card-hover': 'var(--card-hover)',
        control: 'var(--control)', // buttons, inputs
        'control-hover': 'var(--control-hover)',
        'control-press': 'var(--control-press)',
        subtle: 'var(--subtle-hover)', // subtle (transparent) button hover
        stroke: 'var(--stroke)',
        'stroke-strong': 'var(--stroke-strong)',
        flyout: 'var(--flyout)',
        t1: 'var(--text-1)',
        t2: 'var(--text-2)',
        t3: 'var(--text-3)',
        tdis: 'var(--text-dis)',
        accent: 'var(--accent-fill)', // accent fill (buttons, selection pill)
        'accent-hover': 'var(--accent-fill-hover)',
        'accent-on': 'var(--accent-on)', // text on an accent fill
        'accent-text': 'var(--accent-text)', // accent-coloured text/links
        success: 'var(--success)',
        caution: 'var(--caution)',
        critical: 'var(--critical)',
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'], // the admin panel's font-sans (src/admin)
        ui: ['"Inter Variable"', 'system-ui', 'sans-serif'],
        display: ['"Inter Variable"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', '"Courier New"', 'monospace'],
      },
      fontSize: {
        caption: ['12px', '16px'],
        body: ['14px', '20px'],
        subtitle: ['20px', '28px'],
        title: ['28px', '36px'],
        hero: ['40px', '52px'],
      },
      borderRadius: {
        ctl: '4px', // controls
        win: '8px', // windows, flyouts, cards
      },
      boxShadow: {
        win: '0 0 0 1px var(--stroke-strong), 0 16px 48px rgba(0,0,0,0.42)',
        'win-inactive': '0 0 0 1px var(--stroke), 0 8px 24px rgba(0,0,0,0.30)',
        flyout: '0 0 0 1px var(--stroke-strong), 0 12px 40px rgba(0,0,0,0.40)',
        card: '0 1px 2px rgba(0,0,0,0.10)',
      },
    },
  },
  plugins: [],
};
