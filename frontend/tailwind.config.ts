import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1a1240",            // headings, deep indigo
        brand: { DEFAULT: "#5b2bd9", dark: "#43199f", soft: "#efeaff", wash: "#f7f5ff" },
        royal: { DEFAULT: "#2f4de0", soft: "#e8ecff" },
        ok: "#12805c", bad: "#c4314b", warn: "#b86e00",
      },
      fontFamily: { sans: ["var(--font-jakarta)", "system-ui", "sans-serif"] },
      boxShadow: { card: "0 1px 2px rgba(26,18,64,.06), 0 8px 24px -12px rgba(67,25,159,.18)" },
    },
  },
  plugins: [],
};
export default config;
