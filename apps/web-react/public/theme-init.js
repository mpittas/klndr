// Apply the saved (or OS) theme before first paint to avoid a flash of the wrong theme (see src/theme.tsx).
// The map lists every theme and whether it is a dark scheme; keep it in step with THEME_OPTIONS there.
// A plain, blocking file rather than an inline <script>, so the Content-Security-Policy can forbid inline scripts.
try {
  var schemes = { light: 0, dark: 1, lavender: 0, midnight: 1, forest: 1, rose: 0, sage: 0, sky: 0, plum: 1, graphite: 1 };
  var t = localStorage.getItem("klndr-theme");
  if (!Object.prototype.hasOwnProperty.call(schemes, t)) {
    t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.setAttribute("data-theme", t);
  if (schemes[t]) document.documentElement.classList.add("dark");
} catch (e) {}
