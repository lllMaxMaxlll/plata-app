/**
 * Tema claro / oscuro / sistema.
 *
 * El tema efectivo vive en `<html data-theme="light|dark">`, que es lo que
 * miran los tokens de `globals.css`. Un script en el `<head>` lo fija antes del
 * primer pintado: si lo hiciera React después de hidratar, quien eligió oscuro
 * vería un destello de papel en cada carga.
 *
 * La preferencia es del dispositivo, no de la cuenta, y por eso no lleva el
 * prefijo de `user-storage`: cerrar sesión no tiene por qué cambiarte el tema.
 */

export type ThemePreference = "light" | "dark" | "system"
export type Theme = "light" | "dark"

export const THEME_KEY = "lucas:theme"

/** Color de la barra del navegador para cada tema: el fondo de la app. */
const THEME_COLORS: Record<Theme, string> = { light: "#f3eee3", dark: "#141414" }

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === "light" || stored === "dark") return stored
  } catch {}
  return "system"
}

export function resolveTheme(preference: ThemePreference): Theme {
  if (preference !== "system") return preference
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function applyTheme(preference: ThemePreference) {
  const theme = resolveTheme(preference)
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme
  // Las metas de `viewport.themeColor` vienen por media query del sistema; con
  // un tema elegido a mano tienen que seguirlo a él.
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute("content", THEME_COLORS[theme]))
}

export function storeThemePreference(preference: ThemePreference) {
  try {
    if (preference === "system") localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, preference)
  } catch {}
}

/**
 * Lo mismo que `readThemePreference` + `applyTheme`, en un string para
 * inyectar en el `<head>`. Se mantiene chico y sin dependencias a propósito.
 */
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(THEME_KEY)});var d=p==="dark"||(p!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);var t=d?"dark":"light";var r=document.documentElement;r.dataset.theme=t;r.style.colorScheme=t}catch(e){}})()`
