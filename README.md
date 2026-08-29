# PLATA — Finanzas Personales ARS & USD

PLATA es una aplicación web progresiva (PWA) de finanzas personales diseñada especialmente para el contexto financiero argentino. Permite consolidar y gestionar de manera unificada cuentas en pesos (ARS) y dólares (USD), registrar transacciones, simular trading de acciones en mercados reales y realizar un control exhaustivo de vehículos y sus gastos.

---

## Características Principales

- **Gestión Multi-Moneda (ARS & USD):** Cuentas separadas con cálculo automático y dinámico del saldo consolidado.
- **Registro de Actividad:** Seguimiento detallado de ingresos, gastos y transferencias directas entre cuentas, incluyendo soporte para adjuntar comprobantes.
- **Módulo de Gestión Vehicular:** 
  - Registro y administración de múltiples vehículos (autos, motos, camiones, etc.).
  - Historial detallado de gastos categorizados en: *combustible*, *mantenimiento (service)*, *repuestos*, *seguro/patentes*, e *indumentaria*.
  - Estadísticas de consumo inteligente: cálculo de kilómetros por litro promedio (km/L) entre tanques llenos y estimación de costo directo por kilómetro recorrido.
  - Alertas automáticas y dinámicas de servicios vencidos o próximos a vencer en base al kilometraje (odómetro) y fechas cargadas.
- **Categorización Automática de Movimientos:** Al escribir la nota de un gasto o ingreso, la app propone la categoría sola. Resuelve primero con reglas locales (comercios argentinos frecuentes: YPF, Carrefour, Edenor…), que son instantáneas y funcionan sin conexión, y sólo consulta a **Cloudflare Workers AI** cuando no reconoce la descripción. La sugerencia se aplica sola pero cualquier elección manual la desactiva, y si el modelo no responde el formulario sigue funcionando igual.
- **Búsqueda Inteligente del Historial:** Una barra donde preguntás en tus palabras — *“cuánto gasté en el auto el verano pasado”* — y devuelve la lista real de movimientos con su suma real. El **qué** se resuelve por similitud semántica (embeddings en Cloudflare Vectorize) y el **cuándo** con un parser determinístico de fechas en castellano, con las estaciones del hemisferio sur. El modelo ordena por relevancia; no escribe la respuesta ni calcula los totales.
- **Portafolio de Inversiones (Stocks):** Simulación de trading en tiempo real utilizando cotizaciones reales y seguimiento del rendimiento del portafolio (ganancias y pérdidas acumuladas).
- **Seguridad e Identidad:** Autenticación con Supabase Auth: registro e inicio de sesión con correo y contraseña, verificación de email, recuperación y cambio seguro de contraseña.
- **Sincronización en Tiempo Real:** Base de datos Postgres gestionada por Supabase, con Row Level Security y Realtime.
- **Diseño Moderno e Inmersivo (Glassmorphism):** Interfaz fluida optimizada tanto para móviles como para computadoras de escritorio, con un diseño oscuro pulido, colores HSL armonizados y micro-animaciones dinámicas.

---

## Stack Tecnológico

- **Frontend:** [Next.js](https://nextjs.org/) (versión 16+ con App Router, React 19 y Turbopack)
- **Lenguaje:** TypeScript
- **Estilos:** Tailwind CSS v4 & Iconos por Lucide React
- **Base de Datos & Auth:** Supabase (Postgres + Auth, vía `@supabase/ssr`)
- **IA:** Cloudflare Workers AI a través del binding `AI` declarado en `wrangler.jsonc` — `@cf/meta/llama-3.1-8b-instruct-fast` para categorizar y `@cf/baai/bge-m3` para los embeddings. No necesita API key propia: se factura por neurons contra la cuenta del Worker.
- **Índice vectorial:** Cloudflare Vectorize (binding `TRANSACTIONS_INDEX`).
- **Entorno y Gestor de Paquetes:** [Bun](https://bun.sh/) (gestor rápido y moderno)

---

## Requisitos Previos

- Tener instalado [Bun](https://bun.sh/).
- Un proyecto de Supabase (Postgres + Auth).
- Una API Key de Finnhub (para cotizaciones de mercado en tiempo real).

---

## Configuración y Despliegue Local

### 1. Clonar el repositorio
```bash
git clone <url-del-repositorio>
cd personal-finance-pwa
```

### 2. Configurar Variables de Entorno
Copia el archivo de ejemplo `.env.example` y renómbralo a `.env.local`:
```bash
cp .env.example .env.local
```
Completa las claves necesarias en `.env.local`:
- `FINNHUB_API_KEY`: API Key para obtener cotizaciones de mercado en tiempo real.
- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: las credenciales públicas de tu proyecto de Supabase.

### 3. Instalar Dependencias
Utiliza `bun` para una instalación rápida y eficiente:
```bash
bun install
```

### 4. Iniciar Servidor de Desarrollo
```bash
bun dev
```
La aplicación estará disponible localmente en [http://localhost:3000](http://localhost:3000).

### 5. Crear el índice de Vectorize (una sola vez)
La búsqueda inteligente necesita un índice vectorial en tu cuenta de Cloudflare. El binding ya está declarado en `wrangler.jsonc`, pero el índice hay que crearlo con la CLI:

```bash
npx wrangler vectorize create plata-transactions --dimensions=1024 --metric=cosine
```

Y el índice de metadata, sin el cual el filtro por usuario no funciona:

```bash
npx wrangler vectorize create-metadata-index plata-transactions --property-name=userId --type=string
```

Las 1024 dimensiones son las que devuelve `@cf/baai/bge-m3`; si cambiás de modelo de embeddings hay que recrear el índice con las dimensiones del nuevo.

> Vectorize requiere un plan pago de Workers. Sin el índice la app funciona igual: la pantalla de búsqueda avisa que no está configurada y el resto no se entera.

En local, los bindings de Cloudflare necesitan credenciales (`npx wrangler login` o `CLOUDFLARE_API_TOKEN`). Sin eso `next dev` arranca normalmente y sólo se apagan las features que dependen de ellos.

### 6. Compilar para Producción
Para validar y generar una compilación optimizada:
```bash
bun run build
bun start
```

---

## Estructura del Proyecto

- `app/`: Rutas, layouts y controladores de API de Next.js (App Router).
- `components/`: Componentes modulares de React.
  - `finance/`: Toda la lógica visual, paneles y formularios de la aplicación (cuentas, transacciones, stocks, vehículos, búsqueda, seguridad).
  - `ui/`: Componentes base y de diseño reutilizables (shadcn/base-ui).
- `lib/`: Utilidades generales, tipos de dominio, conectores y formateadores de datos.
- `public/`: Assets estáticos, íconos y manifiesto de PWA.

---

## Licencia

Este proyecto es privado. Todos los derechos reservados.

