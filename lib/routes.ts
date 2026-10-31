/**
 * Fuente única de los nombres de pantalla: el sidebar, la barra inferior, el
 * encabezado de escritorio y el <h1> de cada vista salen de acá, así una misma
 * pantalla no se llama distinto según dónde se mire.
 *
 * Las pestañas son cuatro (Hoy, Plata, Agenda, Yo) y Anotar va en el medio
 * como acción. Todo lo demás cuelga de una pestaña: no hay un "Más" donde
 * esconder módulos.
 */
export interface AppRoute {
  href: string
  label: string
  /**
   * La pestaña de la que cuelga la pantalla: a dónde vuelve el botón "Volver"
   * en mobile y qué pestaña queda marcada. Las pestañas no tienen.
   */
  parent?: string
}

export const ROUTES = {
  home: { href: "/", label: "Hoy" },
  plata: { href: "/plata", label: "Plata" },
  agenda: { href: "/agenda", label: "Agenda" },
  profile: { href: "/profile", label: "Yo" },

  activity: { href: "/activity", label: "Movimientos", parent: "/" },
  search: { href: "/search", label: "Búsqueda", parent: "/" },

  accounts: { href: "/accounts", label: "Cuentas", parent: "/plata" },
  analytics: { href: "/analytics", label: "En qué se va", parent: "/plata" },
  stocks: { href: "/stocks", label: "Acciones", parent: "/plata" },
  projections: { href: "/dashboard/proyecciones", label: "Metas", parent: "/plata" },
  vehicles: { href: "/vehicles", label: "Vehículos", parent: "/plata" },

  dueItems: { href: "/dashboard/vencimientos", label: "Vencimientos", parent: "/agenda" },
} as const satisfies Record<string, AppRoute>

export type RouteKey = keyof typeof ROUTES

/** Las pestañas, en el orden en que aparecen. Anotar va entre Plata y Agenda. */
export const TABS = ["home", "plata", "agenda", "profile"] as const satisfies readonly RouteKey[]

export const NAV_GROUPS: { tab: typeof TABS[number]; children: RouteKey[] }[] = [
  { tab: 'home', children: ['activity', 'search'] },
  { tab: 'plata', children: ['accounts', 'analytics', 'stocks', 'projections', 'vehicles'] },
  { tab: 'agenda', children: ['dueItems'] },
  { tab: 'profile', children: [] },
]
export function vehicleServiceHref(vehicleId: string) {
  return `${ROUTES.vehicles.href}?${new URLSearchParams({ vehicle: vehicleId, action: 'service' })}`
}

const ALL_ROUTES: readonly AppRoute[] = Object.values(ROUTES)

export function findRoute(pathname: string): AppRoute | undefined {
  return ALL_ROUTES.find((route) => route.href === pathname)
}

/** La pestaña que queda marcada en una pantalla: ella misma o de la que cuelga. */
export function activeTab(pathname: string): string | undefined {
  const route = findRoute(pathname)
  if (!route) return undefined
  return "parent" in route && route.parent ? route.parent : route.href
}
