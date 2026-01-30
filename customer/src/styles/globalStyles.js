import { createGlobalStyle } from "styled-components";

const GlobalStyles = createGlobalStyle`
  *, *::before, *::after {
    box-sizing: border-box;
  }

  :root {
    --color-primary: #f97316;
  }

  body {
    margin: 0;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    background: #fff;
    color: #1f2933;
  }

  button {
    font-family: inherit;
  }
`;

export default GlobalStyles;
