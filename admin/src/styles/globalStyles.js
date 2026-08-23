import { createGlobalStyle } from "styled-components";

const GlobalStyles = createGlobalStyle`
  *, *::before, *::after {
    box-sizing: border-box;
  }

  :root,
  [data-theme="light"] {
    color-scheme: light;
    --bg: #ffffff;
    --bg-glow: #ffffff;
    --surface: #ffffff;
    --surface-2: #f7f4ef;
    --surface-3: #efeae2;
    --border: rgba(87, 83, 78, 0.16);
    --border-strong: rgba(87, 83, 78, 0.3);
    --text: #1c1917;
    --text-muted: #7a726b;
    --text-soft: #e65c00;
    --primary: #ff6600;
    --primary-strong: #ff7700;
    --primary-muted: rgba(255, 102, 0, 0.12);
    --success: #16a34a;
    --warning: #eab308;
    --danger: #dc2626;
    --shadow-sm: 0 1px 2px rgba(28, 25, 23, 0.05), 0 6px 18px rgba(28, 25, 23, 0.05);
    --shadow-lg: 0 16px 40px rgba(28, 25, 23, 0.1);
    --radius-lg: 16px;
    --radius-md: 12px;
    --radius-sm: 8px;
    --sidebar-bg: linear-gradient(180deg, #ffffff 0%, #fffbf7 100%);
    --sidebar-text: #1c1917;
    --sidebar-text-active: #ffffff;
    --sidebar-orange: #ff6600;
    --sidebar-border: rgba(0, 0, 0, 0.06);
    --orders-bg: #ffffff;
    --orders-text: #1c1917;
    --menu-editor-bg: #ffffff;
    --menu-editor-text: #1c1917;
    --analytics-bg: #ffffff;
    --analytics-text: #1c1917;
    --tables-bg: #ffffff;
    --tables-text: #1c1917;
    --settings-bg: #ffffff;
    --settings-text: #1c1917;
    --card-bg: #ffffff;
    --card-accent-indigo: rgba(255, 102, 0, 0.08);
    --card-accent-sky: rgba(255, 102, 0, 0.06);
    --card-accent-emerald: rgba(22, 163, 74, 0.08);
    --card-accent-rose: rgba(255, 102, 0, 0.1);
    --chart-card-bg: #ffffff;
    --button-overlay: #f3efe8;
    --hover-overlay: rgba(255, 102, 0, 0.08);
    --active-overlay: rgba(255, 102, 0, 0.14);
    --accent-border: rgba(255, 102, 0, 0.25);
    --accent-border-strong: rgba(255, 102, 0, 0.45);
    --container-border: rgba(87, 83, 78, 0.18);
    --container-border-subtle: rgba(87, 83, 78, 0.1);
    --container-border-strong: rgba(87, 83, 78, 0.28);
    --orders-container-border: #e6e0d7;
    --tooltip-bg: rgba(28, 25, 23, 0.95);
    --tooltip-text: #fafaf9;
  }

  [data-theme="dark"] {
    color-scheme: dark;
    --bg: #1c1917;
    --bg-glow: #292524;
    --surface: #292524;
    --surface-2: #44403c;
    --surface-3: #57534e;
    --border: rgba(255, 102, 0, 0.2);
    --border-strong: rgba(255, 102, 0, 0.4);
    --text: #fafaf9;
    --text-muted: #a8a29e;
    --text-soft: #fdba74;
    --primary: #ff6600;
    --primary-strong: #ff7700;
    --primary-muted: rgba(255, 102, 0, 0.15);
    --success: #22c55e;
    --warning: #eab308;
    --danger: #ef4444;
    --shadow-sm: 0 4px 20px rgba(0, 0, 0, 0.3);
    --shadow-lg: 0 10px 40px rgba(0, 0, 0, 0.4);
    --sidebar-bg: linear-gradient(180deg, #292524 0%, #1c1917 100%);
    --sidebar-text: #fafaf9;
    --sidebar-text-active: #ffffff;
    --sidebar-orange: #ff6600;
    --sidebar-border: rgba(255, 255, 255, 0.06);
    --orders-bg: #292524;
    --orders-text: #fafaf9;
    --menu-editor-bg: #292524;
    --menu-editor-text: #fafaf9;
    --analytics-bg: #292524;
    --analytics-text: #fafaf9;
    --tables-bg: #292524;
    --tables-text: #fafaf9;
    --settings-bg: #292524;
    --settings-text: #fafaf9;
    --card-bg: #292524;
    --card-accent-indigo: rgba(255, 102, 0, 0.15);
    --card-accent-sky: rgba(255, 102, 0, 0.12);
    --card-accent-emerald: rgba(34, 197, 94, 0.15);
    --card-accent-rose: rgba(255, 102, 0, 0.12);
    --chart-card-bg: #292524;
    --button-overlay: rgba(68, 64, 60, 0.8);
    --hover-overlay: rgba(255, 102, 0, 0.12);
    --active-overlay: rgba(255, 102, 0, 0.2);
    --accent-border: rgba(255, 102, 0, 0.3);
    --accent-border-strong: rgba(255, 102, 0, 0.5);
    --container-border: rgba(168, 162, 158, 0.25);
    --container-border-subtle: rgba(168, 162, 158, 0.15);
    --container-border-strong: rgba(168, 162, 158, 0.4);
    --orders-container-border: #57534e;
    --tooltip-bg: rgba(41, 37, 36, 0.98);
    --tooltip-text: #fafaf9;
  }

  body {
    margin: 0;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  [data-theme="dark"] body {
    background: var(--bg);
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
    background: var(--surface-2);
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
    box-shadow: none;
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
