import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        glow: "0 20px 60px rgba(15, 23, 42, 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
