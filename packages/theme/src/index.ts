export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "proofline-theme";
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var k='proofline-theme';var p=localStorage.getItem(k)||'system';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.dataset.themePreference=p;}catch(e){}})();`;
