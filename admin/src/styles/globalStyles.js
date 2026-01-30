import { createGlobalStyle } from "styled-components";

const GlobalStyles = createGlobalStyle`
  *, *::before, *::after {
    box-sizing: border-box;
  }

  :root {
    color-scheme: dark;
    --bg: #0b1020;
    --bg-glow: #11162a;
    --surface: #111827;
    --surface-2: #151f36;
    --surface-3: #1c2742;
    --border: rgba(148, 163, 184, 0.18);
    --border-strong: rgba(148, 163, 184, 0.35);
    --text: #e5e7eb;
    --text-muted: #9aa4b2;
    --text-soft: #c7d2fe;
    --primary: #4f46e5;
    --primary-strong: #6366f1;
    --success: #22c55e;
    --warning: #f59e0b;
    --danger: #ef4444;
    --shadow-sm: 0 14px 30px rgba(0, 0, 0, 0.35);
    --shadow-lg: 0 24px 60px rgba(0, 0, 0, 0.45);
    --radius-lg: 18px;
    --radius-md: 14px;
    --radius-sm: 10px;
  }

  body {
    margin: 0;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    background: radial-gradient(circle at top, rgba(79, 70, 229, 0.18), transparent 55%),
      radial-gradient(circle at 20% 20%, rgba(56, 189, 248, 0.12), transparent 40%),
      var(--bg);
    color: var(--text);
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  a {
    color: var(--text-soft);
    text-decoration: none;
  }

  button {
    font-family: inherit;
  }

  input,
  select,
  textarea {
    font-family: inherit;
    background: var(--surface-3);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
    outline: none;
    transition: border 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  }

  input::placeholder,
  textarea::placeholder {
    color: var(--text-muted);
  }

  input:focus,
  select:focus,
  textarea:focus {
    border-color: rgba(99, 102, 241, 0.8);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  }

  button {
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    transition: transform 0.15s ease, box-shadow 0.2s ease, background 0.2s ease;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

export default GlobalStyles;
