/**
 * Fuente única de los nombres de pantalla: el sidebar, la barra inferior, el
 * encabezado de escritorio y el <h1> de cada vista salen de acá, así una misma
 * pantalla no se llama distinto según dónde se mire.
 */
export interface AppRoute {
  href: string
  label: string
  /**
   * En mobile, a dónde vuelve el botón "Volver". Las pantallas de la barra
   * inferior no tienen: se llega a ellas con la barra misma.
   */
  parent?: string
}

export const ROUTES = {
  home: { href: "/", label: "Inicio" },
  accounts: { href: "/accounts", label: "Cuentas" },
  activity: { href: "/activity", label: "Actividad" },
  more: { href: "/more", label: "Más" },
  search: { href: "/search", label: "Búsqueda", parent: "/more" },
  analytics: { href: "/analytics", label: "Análisis", parent: "/more" },
  projections: { href: "/dashboard/proyecciones", label: "Proyecciones", parent: "/more" },
  stocks: { href: "/stocks", label: "Portafolio", parent: "/more" },
  vehicles: { href: "/vehicles", label: "Vehículos", parent: "/more" },
  dueItems: { href: "/dashboard/vencimientos", label: "Vencimientos", parent: "/more" },
  profile: { href: "/profile", label: "Perfil", parent: "/more" },
} as const satisfies Record<string, AppRoute>

export type RouteKey = keyof typeof ROUTES

const ALL_ROUTES: readonly AppRoute[] = Object.values(ROUTES)

export function findRoute(pathname: string): AppRoute | undefined {
  return ALL_ROUTES.find((route) => route.href === pathname)
}
