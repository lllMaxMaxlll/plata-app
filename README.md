# EN MANO — Tu plata, en claro

EN MANO es una aplicación web progresiva (PWA) de finanzas personales diseñada especialmente para el contexto financiero argentino. Permite consolidar y gestionar de manera unificada cuentas en pesos (ARS) y dólares (USD), registrar transacciones, simular trading de acciones en mercados reales y realizar un control exhaustivo de vehículos y sus gastos.

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
- **Registro por Telegram:** Un bot al que le escribís el gasto en una línea — *"30 lucas super carrefour galicia"* — y lo registra en el momento, contestándote qué guardó y cómo quedó el saldo de esa cuenta. Entiende `lucas`, `palos` y `k`, y si no queda claro con qué cuenta fue, pregunta con botones en vez de adivinar. Sólo registra gastos: no borra, no edita y no consulta.
- **Portafolio de Inversiones (Stocks):** Simulación de trading en tiempo real utilizando cotizaciones reales y seguimiento del rendimiento del portafolio (ganancias y pérdidas acumuladas).
- **Seguridad e Identidad:** Autenticación con Supabase Auth: registro e inicio de sesión con correo y contraseña, verificación de email, recuperación y cambio seguro de contraseña.
- **Sincronización en Tiempo Real:** Base de datos Postgres gestionada por Supabase, con Row Level Security y Realtime.
- **Anotar en una línea:** El botón del medio (o ⌘K en escritorio) abre una barra donde escribís como hablás — *"nafta 52k mp ayer"* — con el mismo parser que el bot de Telegram. Muestra cómo lo entendió (monto, cuenta, categoría, día) antes de guardar, y si el texto empieza con *"cuánto"* o *"qué"* lo trata como pregunta y busca en el historial.
- **Cuatro pestañas, nada escondido:** *Hoy* (saldo en ARS/USD con la cotización a la vista, ritmo de gasto de la semana contra tu promedio y lo que vence), *Plata* (dónde está tu plata, acciones, vehículos, en qué se va y metas), *Agenda* (vencimientos y services del vehículo en una sola línea de tiempo, con pago directo) y *Yo*.
- **Diseño papel y tinta:** Bordes de tinta, sombras duras y un acento lima. Tema claro, oscuro o el del sistema, a elección y sin parpadeo al cargar.

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

### 6. Bot de Telegram (opcional)

El bot corre dentro del mismo Worker que la app, en `/api/telegram`. No necesita
servidor propio ni puertos abiertos.

**1.** Creá el bot con [@BotFather](https://t.me/BotFather) y guardá el token.

**2.** Pedile tu chat id a [@userinfobot](https://t.me/userinfobot).

**3.** Inventá un secreto para el webhook (`openssl rand -hex 32` sirve).

**4.** Cargá los cinco secrets en el Worker:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put TELEGRAM_ALLOWED_CHAT_ID
npx wrangler secret put TELEGRAM_BOT_SUPABASE_EMAIL
npx wrangler secret put TELEGRAM_BOT_SUPABASE_PASSWORD
```

**5.** Registrá el webhook, una sola vez:

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://<tu-dominio>/api/telegram",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>",
    "allowed_updates": ["message", "callback_query"]
  }'
```

Tres cosas del diseño que conviene tener presentes:

- **El bot escribe como vos, no como root.** Se autentica con Supabase Auth y
  llama al mismo `create_transaction` que la web, así que las RLS y el control
  de descubierto siguen aplicando. Con la service role key pasaría al revés:
  saltearía las RLS y `auth.uid()` quedaría en null, que es justo el `user_id`
  que el RPC necesita.
- **Sólo contesta a un chat.** Cualquiera puede encontrar el bot y escribirle;
  el `secret_token` filtra a quien no sea Telegram y `TELEGRAM_ALLOWED_CHAT_ID`
  filtra a todos los demás. Al resto no se le contesta nada.
- **Sin `TELEGRAM_WEBHOOK_SECRET` la ruta responde 403 a todo.** Es lo que
  mantiene el bot apagado mientras no lo configures.

Un gasto cargado por Telegram aparece en la búsqueda semántica recién la próxima
vez que abrís la app, que es cuando el cliente indexa lo que falta.

### 7. Compilar para Producción
Para validar y generar una compilación optimizada:
```bash
bun run build
bun start
```

Para validar el destino de producción en Cloudflare, ejecutá también:

```bash
bun run check:cloudflare
```

Este comando genera el bundle de OpenNext y prueba su arranque en `workerd`,
consultando inicio, perfil, agenda, manifest y una ruta dinámica sin escribir
datos. Un build de Next o una preview de Vercel no comprueban la compatibilidad
con Workers. Después de cambiar Next, OpenNext o Wrangler, esta verificación
debe pasar antes del deploy.

Next 16.4 necesita un adaptador que incluya `server/preview-props.json` en el
bundle: OpenNext 1.20.12 corrigió esta carga. El proyecto fija OpenNext 1.20.13
y Wrangler 4.152.0, compatible con sus dependencias declaradas.

### 8. Radar de mercado (acciones de EE. UU.)

La pantalla **Acciones → Radar de mercado** permite guardar hasta 10 símbolos,
incluso posiciones reales mantenidas fuera de la simulación de la app. El
Worker revisa las reglas aunque la PWA esté cerrada. Es una adaptación de
`trader-alerts` y `trader-analyst` de
[day-trader-skill](https://github.com/Jakeschincariol/day-trader-skill), con
licencia conservada en `THIRD_PARTY_NOTICES.md`. Los scripts Python de la skill
no se ejecutan dentro del Worker: sus reglas se adaptaron a TypeScript.

**Qué hace:**

- Resumen a las **08:00 de Nueva York** y **5 minutos después del cierre**,
  con ventanas de reintento de una hora. Respeta DST, feriados y cierres de
  13:00 de NYSE para 2026–2027. En años desconocidos se detiene y exige
  actualizar el calendario.
- Cron cada **5 minutos**, de **04:00 a 20:00 Nueva York** en días bursátiles.
  Quotes Finnhub con cache de 4 minutos, noticias de 15 y calendario de una hora.
- Avisos cuando el precio llega al stop de referencia o al objetivo, o cae el
  porcentaje configurado frente al cierre anterior. No evalúa precios con
  más de 15 minutos de antigüedad, ausentes, inválidos o futuros.
- Recordatorio diario de resultados a tres días calendario o menos; fechas
  estimadas por Finnhub, que deben confirmarse en Relaciones con Inversores.
- Noticias con enlace y hora: alerta sobre los últimos titulares de la última
  hora, posteriores a la última configuración guardada, incluso sin clasificar
  su impacto. No interpreta titulares como guidance confirmado.
- Opcionalmente, ingresos y EPS diluido publicados en SEC EDGAR, comparación
  interanual sobre períodos comparables y aviso de datos XBRL rezagados.
  No deriva Q4, no procesa transcripciones ni resume automáticamente EX-99.1.
- Push cifrado `aes128gcm` + VAPID, incluyendo Apple. Si ningún proveedor push
  acepta el envío, usa Telegram cuando el usuario activó el respaldo.

**Configuración del servidor:**

1. Autenticar Wrangler (`bunx wrangler login` o `CLOUDFLARE_API_TOKEN`). Crear
   el namespace y copiar su ID en la entrada existente `MARKET_MONITOR` de
   `wrangler.jsonc` (no agregar dos bindings con el mismo nombre):

   ```bash
   bunx wrangler kv namespace create plata-market-monitor
   ```

   ```jsonc
   "kv_namespaces": [{ "binding": "MARKET_MONITOR", "id": "ID_REAL" }]
   ```

   Sin ID, KV se puede emular en desarrollo; no implica que esté aprovisionado
   en producción. El cron sólo corre en el Worker desplegado, no en `next dev`.

2. Generar el par VAPID una sola vez:

   ```bash
   node scripts/generate-vapid.mjs
   ```

   El archivo `.secrets/market-vapid.env` está ignorado por Git y tiene permisos
   `0600`; no se imprime la clave privada. Copiar sus valores a `.env.local`
   para desarrollo y cargarlos como secrets del Worker. No rotar sin planificar
   volver a suscribir los dispositivos.

   ```bash
   bunx wrangler secret put VAPID_PUBLIC_KEY
   bunx wrangler secret put VAPID_PRIVATE_KEY
   bunx wrangler secret put VAPID_SUBJECT
   bunx wrangler secret put FINNHUB_API_KEY
   ```

   `VAPID_SUBJECT` debe ser una URL `mailto:` con un correo real de contacto.
   Confirmar que el plan Finnhub permite **quote**, **company-news** y
   **calendar/earnings** para los símbolos elegidos. Los errores se muestran;
   no se sustituyen por cotizaciones de ejemplo. Si el plan no permite un
   endpoint, esa parte del análisis queda incompleta.

3. Para SEC EDGAR, cargar `SEC_USER_AGENT` con nombre y correo reales:

   ```bash
   bunx wrangler secret put SEC_USER_AGENT
   ```

   Se consultan `company_tickers.json`, company facts y submissions. Se
   almacenan métricas normalizadas durante una hora, no los archivos completos.
   La comparación se limita a hechos USD / USD por acción, de US GAAP en
   10-Q/10-K; compañías extranjeras u otras taxonomías pueden no tener datos.

4. Para Telegram, reutilizar `TELEGRAM_BOT_TOKEN` y
   `TELEGRAM_ALLOWED_CHAT_ID` del bot. Configurar además el **UUID de Supabase
   Auth del dueño de ese chat**, nunca el número de chat:

   ```bash
   bunx wrangler secret put MARKET_TELEGRAM_USER_ID
   ```

   No requiere contraseña de Supabase para enviar alertas. Sólo el usuario
   vinculado puede activar ese respaldo. Debe haber iniciado previamente el
   chat con el bot. El resto de usuarios utiliza sus propias suscripciones push.

5. Validar y desplegar con el flujo habitual (`bun run check:cloudflare`,
   `bun run deploy`). `worker.mjs` conserva `fetch` y los exports de OpenNext
   y agrega `scheduled`; no cambiar `main` a `.open-next/worker.js`, porque se
   perdería el cron. No es necesario migrar Postgres.

**Activación en el teléfono:** abrir la PWA instalada en iPhone con iOS 16.4 o
posterior → Acciones → Activar push en este dispositivo → conceder permiso →
cargar símbolos y niveles → activar vigilancia y, si está disponible, respaldo
Telegram → Guardar vigilancia → Enviar prueba. Actualizar análisis consulta los
símbolos ya guardados y no envía notificaciones. Quitar un símbolo no modifica
la tenencia ni las operaciones. Los cambios sólo se aplican al guardarlos.

**Operación y límites:**

- Se persisten configuración y reporte por usuario autenticado en KV. No se
  expone el listado de suscripciones ni las claves privadas a la interfaz.
- El panel muestra última revisión y último intento de envío. Un proveedor que
  acepta un push no confirma recepción/lectura en el iPhone. Telegram no se
  activa por silencio del dispositivo si el proveedor ya aceptó el push.
- Stop/objetivo/caída: como máximo un aviso por nivel y día en condiciones
  normales. Los envíos fallidos se reintentan en el siguiente ciclo. KV tiene
  consistencia eventual: pueden aparecer duplicados ante solapamientos o
  fallos después de enviar; no se promete entrega exactamente una vez.
- La vigilancia usa consultas periódicas, no un feed en streaming. Una caída
  puede ocurrir entre revisiones o fuera de horario; las cuotas del proveedor,
  red, permisos y Focus de iOS también afectan los avisos. Noticias anteriores
  a la ventana de una hora no se reenvían al recuperarse de una interrupción.
- Diseñado para una cartera personal pequeña. Más usuarios requieren cola,
  presupuesto compartido de API y deduplicación transaccional. Verificar costo
  y cuotas de Workers/KV/Finnhub antes de escalar.
- No coloca órdenes, no fija un stop en el broker ni aconseja comprar o vender.
  Incluso un stop real puede ejecutarse por debajo de su nivel ante un gap.
  Los botones de trading de esta app siguen siendo una simulación.

Documento de uso: [`docs/radar-de-mercado.html`](docs/radar-de-mercado.html).

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

