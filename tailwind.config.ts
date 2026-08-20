import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        festival: {
          ongoing: "#22C55E",
          upcoming: "#EAB308",
          ended: "#9CA3AF",
        },
      },
    },
  },
  plugins: [],
};

export default config;
