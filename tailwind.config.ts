import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0f",
        s1: "#111118",
        s2: "#16161f",
        s3: "#1c1c27",
        s4: "#22222f",
        b1: "rgba(255,255,255,0.08)",
        b2: "rgba(255,255,255,0.05)",
        b3: "rgba(255,255,255,0.03)",
        accent: {
          blue: "#4f8ef7",
          "blue-light": "#7aaef9",
          cyan: "#22d3ee",
          green: "#34d399",
          amber: "#fbbf24",
          red: "#f87171",
          purple: "#a78bfa",
          gold: "#f59e0b",
        },
        t1: "#f0f0fa",
        t2: "#9898b8",
        t3: "#5c5c7a",
        t4: "#3a3a52",
      },
      fontFamily: {
        ui: ["'DM Sans'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
        display: ["'Instrument Sans'", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "8px",
        md: "14px",
        lg: "18px",
        xl: "24px",
        pill: "999px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,.4), 0 4px 16px rgba(0,0,0,.3)",
        glow: "0 0 0 1px rgba(79,142,247,.18), 0 4px 24px rgba(79,142,247,.08)",
        "glow-red":
          "0 0 0 1px rgba(248,113,113,.18), 0 4px 24px rgba(248,113,113,.08)",
        "glow-amber":
          "0 0 0 1px rgba(251,191,36,.14), 0 4px 16px rgba(251,191,36,.06)",
        "glow-green":
          "0 0 0 1px rgba(52,211,153,.14), 0 4px 16px rgba(52,211,153,.06)",
      },
      backgroundImage: {
        "gradient-card":
          "linear-gradient(135deg, #13131e 0%, #0f0f1a 60%, #141420 100%)",
        "gradient-hero":
          "linear-gradient(135deg, #0f0f1c 0%, #13131e 60%, #0d0d18 100%)",
        "gradient-bar": "linear-gradient(90deg, #4f8ef7 0%, #22d3ee 100%)",
        "gradient-danger": "linear-gradient(90deg, #f87171 0%, #fbbf24 100%)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
        "progress-fill": "progressFill 1.4s cubic-bezier(.16,1,.3,1)",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "count-up": "countUp 1s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        progressFill: {
          "0%": { width: "0%" },
        },
        countUp: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
