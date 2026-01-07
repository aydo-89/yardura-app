import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
    },
    extend: {
      fontFamily: {
        heading: [
          "Plus Jakarta Sans",
          "DM Sans",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        sans: [
          "DM Sans",
          "Plus Jakarta Sans",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      borderRadius: {
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        "brand-coral": "#F3645B",
        "brand-coral-ink": "#C43D37",
        "brand-coral-light": "#FF7A70",
        "brand-mint": "hsl(var(--brand-mint) / <alpha-value>)",
        "brand-mint-soft": "hsl(var(--brand-mint-soft) / <alpha-value>)",
        brand: {
          50: "#FFF1DA",
          100: "#FDE6D2",
          200: "#F9CBBB",
          300: "#F4AE9D",
          400: "#EF8A7C",
          500: "#F3645B",
          600: "#C43D37",
          700: "#9E2F2B",
          800: "#76221F",
          900: "#591915",
        },
        coral: {
          DEFAULT: "#F3645B",
          ink: "#C43D37",
          light: "#FF7A70",
        },
        evergreen: {
          50: "#F0F5F2",
          100: "#D9E9E0",
          200: "#AED2C1",
          300: "#7CB89E",
          400: "#469177",
          500: "#204B36",
          600: "#18392A",
          700: "#122C21",
          800: "#0C1F17",
          900: "#07140F",
        },
        mint: {
          50: "#EFFCFB",
          100: "#D4F7F1",
          200: "#AEEDE3",
          300: "#7FE1D4",
          400: "#4BD3C5",
          500: "#19B4A3",
          600: "#149589",
          700: "#0F786F",
          800: "#0B5B54",
          900: "#084641",
        },
        gold: "#FFC24D",
        cream: {
          DEFAULT: "#F9EEDD",
          soft: "#FAF7F1",
          porcelain: "#FAF7F1",
          vanilla: "#FFF1DA",
        },
        graphite: {
          DEFAULT: "#1B1E23",
          soft: "#292D33",
        },
        cocoa: "#3B2F2A",
        sunset: {
          DEFAULT: "#FF7A45",
          soft: "#FFD2BE",
        },
        "accent-soft": "#FAF7F1",
        ink: "#1B1E23",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      boxShadow: {
        soft: "0 10px 30px -12px rgba(0,0,0,.15)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
