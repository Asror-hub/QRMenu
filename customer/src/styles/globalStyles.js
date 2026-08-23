import { createGlobalStyle } from "styled-components";

const GlobalStyles = createGlobalStyle`
  *, *::before, *::after {
    box-sizing: border-box;
  }

  :root {
    --color-primary: #f97316;
    --color-primary-hover: #ea580c;
    --color-primary-soft: rgba(249, 115, 22, 0.12);
    --color-ink: #0f172a;
    --color-ink-muted: #64748b;
    --color-ink-faint: #94a3b8;
    --color-surface: #ffffff;
    --color-surface-muted: #f1f5f9;
    --color-border: #e2e8f0;
    --color-border-soft: #eef2f7;
    --color-page: #fafbfc;
    --color-success: #16a34a;
    --color-danger: #dc2626;
    --radius-sm: 10px;
    --radius-md: 14px;
    --radius-lg: 20px;
    --radius-pill: 999px;
    --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.04);
    --shadow-md: 0 8px 24px rgba(15, 23, 42, 0.08);
    --shadow-lg: 0 16px 40px rgba(15, 23, 42, 0.12);
    --font-sans: "Outfit", "Segoe UI", system-ui, -apple-system, sans-serif;
    --font-display: "Fraunces", "Georgia", serif;
    --safe-bottom: env(safe-area-inset-bottom, 0px);
    --safe-top: env(safe-area-inset-top, 0px);
  }

  html {
    -webkit-text-size-adjust: 100%;
  }

  body {
    margin: 0;
    font-family: var(--font-sans);
    background-color: var(--color-page);
    background-image: radial-gradient(rgba(15, 23, 42, 0.008) 0.7px, transparent 0.7px);
    background-size: 3px 3px;
    color: var(--color-ink);
    min-height: 100dvh;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  button,
  input,
  select,
  textarea {
    font-family: inherit;
  }

  button {
    -webkit-tap-highlight-color: transparent;
  }

  img {
    max-width: 100%;
  }

  ::selection {
    background: var(--color-primary-soft);
    color: var(--color-ink);
  }

  @media print {
    body * {
      visibility: hidden !important;
    }

    #reservation-ticket,
    #reservation-ticket * {
      visibility: visible !important;
    }

    #reservation-ticket {
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      width: 100% !important;
      box-shadow: none !important;
      border: 1px solid #cbd5e1 !important;
    }
  }
`;

export default GlobalStyles;
