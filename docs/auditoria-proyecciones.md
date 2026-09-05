# Auditoría de la página de Proyecciones

**Fecha:** 2026-09-05
**Alcance:** `app/dashboard/proyecciones/page.tsx`, `components/finance/projections-view.tsx`, `projection-controls.tsx`, `projection-chart.tsx`, `projection-kpis.tsx`, `goal-modal.tsx`, `lib/simulation-engine.ts`, `supabase/migrations/*`.

> **Estado: implementado.** Los pasos 1 a 6 del plan del §6 están hechos. Queda
> pendiente una sola cosa, la del §7: guardar y comparar escenarios con nombre.
> Este documento conserva el diagnóstico original —con la evidencia que lo
> respalda— y marca contra cada hallazgo qué se hizo.
>
> **La migración `20260905120000_plata_projections.sql` ya está aplicada** al
> proyecto hosteado (región sa-east-1), el 2026-09-05. Queda registrada en
> `supabase_migrations.schema_migrations`.

---

## 1. Respuesta corta a la pregunta principal

> **¿Se guardan mis proyecciones en la base de datos?**

**No.** Prácticamente nada de lo que configurás en esa pantalla persiste.

| Dato | ¿Se guarda? | Dónde |
|---|---|---|
| Metas secuenciales (nombre, monto, moneda, tipo, prioridad) | ❌ **No** | Sólo `useState` en memoria |
| Ahorro mensual ARS / USD | ❌ **No** | Sólo `useState` |
| Patrimonio inicial manual | ❌ **No** | Sólo `useState` |
| Horizonte (12/24/36/60) | ❌ **No** | Sólo `useState` |
| Moneda de visualización | ❌ **No** | Sólo `useState` |
| Switch "ajustar por inflación" | ❌ **No** | Sólo `useState` |
| Switch "sincronizar cuentas" | ❌ **No** | Sólo `useState` |
| Escenarios/resultados de la simulación | ❌ **No** | Se recalcula en cada render |
| Inflación / devaluación / retorno / TC | ✅ Sí | `public.user_settings` |
| Cotizaciones (`rates`) | ✅ Sí | `public.user_settings.rates` |

No existe ninguna tabla `goals`, `projections`, `scenarios` ni equivalente en `supabase/migrations/`. Las tablas son: `accounts`, `vehicles`, `transactions`, `categories`, `vehicle_logs`, `due_items`, `stock_trades`, `watchlist`, `user_settings`, `push_tokens`.

**Consecuencia práctica:** cada vez que recargás la página o navegás a otra sección y volvés, tus metas se borran y reaparecen las dos metas hardcodeadas de demo (`DEFAULT_GOALS`: "Fondo de Reserva $2.000 USD" y "Compra de Moto 0km $7.000.000"), y el ahorro mensual vuelve a los valores inventados de 300.000 ARS / 500 USD. El toast dice *"Nueva meta agregada a la secuencia"*, lo que da a entender que se guardó — es engañoso.

Ver `components/finance/projections-view.tsx:36-53` (metas de demo) y `:66-82` (todo el estado local).

---

## 2. Bugs críticos

### 2.1 🔴 Cada visita a la página pisa tus supuestos macro guardados

`projections-view.tsx:101-105`:

```ts
useEffect(() => {
  if (!macroSettings.lastUpdated) {
    syncMacroFromApi()
  }
}, [])   // <- array vacío: corre al montar
```

Al montar, `macroSettings` todavía es `DEFAULT_MACRO_SETTINGS` (con `lastUpdated: ""`) porque `loadSettings()` del provider es asíncrono y aún no resolvió. La condición **siempre** da verdadera → se dispara `syncMacroFromApi()` en cada montaje.

Y `syncMacroFromApi` (`finance-provider.tsx:1017-1036`) no trae sólo la cotización: `/api/macro` devuelve inflación/devaluación/retorno leídos de **variables de entorno del servidor** con fallback `45/40/12` (`app/api/macro/route.ts:56-58`), y el provider hace `updateMacroSettings(next)` con todo eso → **upsert a `user_settings`**.

**Resultado:** si ajustaste inflación a 120%, entrás a Proyecciones y sale de nuevo en 45%, con escritura a la base incluida. Silenciosamente.

### 2.2 🔴 Las líneas "Pesimista" y "Optimista" se cruzan en la vista ARS

`simulation-engine.ts:352-377`: el escenario pesimista multiplica inflación **y devaluación** por 1.2; el optimista por 0.85. Pero más devaluación *aumenta* el patrimonio nominal medido en ARS de alguien con dólares.

Verificado numéricamente con los valores por defecto (5M ARS + 10k USD, 300k+US$500/mes, 45/40/12, 36 meses, vista ARS **nominal**):

```
pes  nominal $153.044.309
neu  nominal $142.018.401
opt  nominal $134.488.432   <- el "optimista" es el MÁS BAJO
```

El área roja queda por encima de la verde. El gráfico dice literalmente lo contrario de lo que el usuario lee.

### 2.3 🔴 El ajuste "en términos reales" descuenta dólares por inflación argentina

`simulation-engine.ts:311-315`:

```ts
const discountFactor = Math.pow(1 + iMonthly, -m)
```

`iMonthly` sale siempre de `annualInflationRate` (inflación en pesos), y se aplica al patrimonio **cualquiera sea `displayCurrency`**. Con la configuración por defecto de la página (**USD + "Ajustar por Inflación Real" activado**, es decir, la vista que ve el usuario al entrar):

```
neu  nominal US$41.405  ->  "real" US$13.581
```

Descontar dólares al 45% anual no tiene sentido económico: implica que el dólar pierde poder adquisitivo al ritmo del peso. La vista por defecto de la app muestra que ahorrar US$500/mes durante 3 años te deja con menos plata de la que pusiste.

### 2.4 🔴 Los montos de las metas nunca se inflacionan → fechas absurdamente optimistas

`simulation-engine.ts:227-231`: el costo de la meta se toma nominal fijo y se convierte al **tipo de cambio futuro**:

```ts
const goalCostUSD = activeGoal.currency === "USD" ? activeGoal.amount : activeGoal.amount / fxRate
```

Una moto de $7.000.000 hoy vale US$5.600. A 36 meses, con fx proyectado 3.430, el motor la considera de **US$2.041**. La meta se abarata sola al ritmo de la devaluación. Debería inflacionarse (`amount * (1+inflación)^(m/12)` para metas en ARS).

### 2.5 🔴 Las metas se comparan contra el patrimonio total, no contra el ahorro disponible

`simulation-engine.ts:233-238`: el chequeo es `netWorthUSD - lockedReserveUSD >= goalCostUSD`, donde `netWorthUSD` incluye **todo** (cuentas + cartera de acciones ilíquida).

Simulación con los valores por defecto (que ya trae la página):

```
m1: Reserva alcanzada  (costo US$2.000)
m1: Moto alcanzada     (costo US$5.445)
```

**Las dos metas se cumplen en el mes 1.** La "Línea de Tiempo de Metas Secuenciales (En Cascada)" —la feature central de la página— no muestra ninguna cascada: muestra todo verde inmediatamente. El texto "Al cumplir una, tus ahorros libres se reorientan automáticamente a la siguiente" describe algo que el motor no hace.

Además, la meta de tipo `purchase` se **valida** contra el patrimonio total (incluyendo acciones) pero se **descuenta** de los saldos líquidos ARS/USD — inconsistente.

### 2.6 🟠 Tormenta de escrituras a la base al mover un slider

`projections-view.tsx:420-439`: cada `onChange` llama a `updateMacroSettings`, que hace un `upsert` a `user_settings` **sin debounce**. `components/ui/slider.tsx` es un `<input type="range">` nativo: arrastrar inflación de 45 a 120 dispara ~75 upserts. Lo mismo por cada tecla en los inputs numéricos de TC/inflación/devaluación/retorno.

### 2.7 🟠 Un valor de 0 no se puede guardar

`projections-view.tsx:93-98`:

```ts
if (macroSettings.annualInflation) setAnnualInflation(macroSettings.annualInflation)
```

Chequeo *truthy*: `0` es falsy. Si guardás retorno = 0% (o devaluación = 0%), al recargar la página el valor de la base se ignora y se muestra el default 12% / 40%, mientras la base dice 0. La UI miente sobre lo que hay guardado.

### 2.8 🟠 "Quitar meta" del panel derecho borra TODAS las metas

`projections-view.tsx:441` pasa `onRemoveGoal={() => setGoals([])}` a la tarjeta legacy "Meta de Compra Grande". Sin confirmación y sin deshacer. Hoy está latente porque `bigPurchaseGoal` nunca se pasa (ver §4), pero es una bomba con la mecha puesta.

### 2.9 🟠 El gráfico no funciona con el dedo

`projection-chart.tsx:382-395`: las bandas de interacción sólo tienen `onMouseEnter`. En una PWA usada mayormente en el teléfono, **el tooltip nunca se puede abrir**. Faltan `onTouchStart` / `onTouchMove` / `onPointerDown`.

---

## 3. Problemas del modelo financiero (no son bugs, son supuestos malos)

1. **Un solo `annualReturn` para pesos y dólares.** `simulation-engine.ts:171-175` aplica `rMonthly` idéntico a `balanceARS` y `balanceUSD`. Un plazo fijo en pesos y un ETF en dólares no rinden lo mismo ni de cerca. Deberían ser dos parámetros.

2. **`totalReturns` está mal calculado.** `simulation-engine.ts:410-416`: `final - inicial - totalSaved`, pero `final` es *después* de descontar las compras de metas → subestima los rendimientos. Y `totalSavedInDisplayCurrency` (`:157-162`) suma aportes en USD convertidos al TC **de cada mes futuro**, mezclando pesos de distintos poderes adquisitivos: es una suma sin significado. Hoy no se muestra en pantalla (ver §4), pero está listo para mostrar un número inventado.

3. **`coveragePercent` es el mismo para todas las metas.** `simulation-engine.ts:452-453` usa `nSim.points[0].netWorthWithoutGoal` (patrimonio actual total) contra el costo de *cada* meta, ignorando la reserva bloqueada y las metas anteriores. Con los defaults da 100% para todo. El KPI "Cobertura Actual: 100%" es decorativo.

4. **`costInDisplayCurrency` usa el TC inicial** (`:447-450`) para una meta que se logra dentro de 30 meses.

5. **Los aportes se suman antes de aplicar el rendimiento** (`:163-175`): el ahorro del mes cobra un mes entero de interés. Sesgo optimista sistemático. Debería ser mitad de mes o aporte al final.

6. **`Math.max(0, ...)` sobre el patrimonio** (`:326-329`) esconde la insolvencia: si el plan te deja en rojo, el gráfico dibuja una línea plana en cero en vez de avisarte.

7. **El patrimonio no es neto.** `projections-view.tsx:66-67` suma cuentas + cartera, pero **no resta las deudas** de `due_items`. Se llama "patrimonio neto" en toda la UI.

8. **`portfolioTotalValue` se asume en USD** sin conversión explícita (`:67`).

9. **`"Más de 5 años"`** es el texto por defecto (`:456`) aunque el horizonte elegido sea de 12 meses. Debería decir "no se alcanza en el horizonte de N meses".

10. **`nextGoal` cae en la última meta si están todas cumplidas** (`:472`), así que el KPI muestra "Próximo Objetivo" señalando algo ya logrado.

11. **Escenarios sin base.** Los multiplicadores 1.2 / 0.85 / 0.7 / 1.25 son mágicos y no están documentados ni son configurables.

---

## 4. Código muerto y UI fantasma

El motor tiene una feature entera —`bigPurchaseGoal` / `goalViability`— que **nunca se activa**, porque ningún componente le pasa la prop:

- `simulation-engine.ts:495-580`: todo el bloque `if (bigPurchaseGoal)` que calcula `goalViability`, `statusBadge`, `findAchieveMonth`... **nunca corre**. `goalViability` es siempre `null`.
- `projection-kpis.tsx`: recibe `goalViability` y `bigPurchaseGoal`, define `getBadgeVariant`, `horizonYears`, `finalNetWorth` — **ninguno se usa**. La tarjeta sólo muestra "Próximo Objetivo". Los KPIs de patrimonio final, total ahorrado y rendimientos que el motor calcula **no se muestran en ninguna parte**.
- `projection-chart.tsx`: el marcador vertical de meta (`:296-318`), `minVal` (`:52-66`, calculado y descartado), `Eye`/`EyeOff`/`AlertTriangle`/`CheckCircle2` importados sin usar.
- `projection-controls.tsx`: la tarjeta completa **"Meta de Compra Grande"** (`:404-478`) siempre renderiza el estado vacío, y su botón "Añadir Meta" abre el mismo modal que las metas secuenciales. Son **tres** puntos de entrada para lo mismo (header, tarjeta de metas, panel derecho) con nombres distintos.

`npx eslint` sobre estos archivos: **35 warnings**, casi todos imports y props sin usar.

Otros detalles menores:
- `projection-controls.tsx:337-339`: la descripción dice *"Inflación 50%, Devaluación 45%, Retorno 12%"*; los defaults reales son **45 / 40 / 12**.
- El botón dice *"Sincronizar Cotización e Indicadores con **IA**"* — no hay IA: es `dolarapi.com` + variables de entorno.
- `projection-chart.tsx:245`: `getX(pt.month)` pasa un mes donde la función espera un índice. Hoy coincide porque `índice === mes`, pero se rompe apenas se cambie la granularidad.
- `formatShort` (`lib/finance-data.ts:91`) **no abrevia** (no produce "1,2M"). En vista ARS las etiquetas del eje Y son del tipo `$153.044.309` en 10px dentro de 57px de padding → se pisan.
- `big-purchase-modal.tsx:66`: `id: String(Date.now())` como identificador. Usar `crypto.randomUUID()`.
- `ProjectionsViewProps.isDesktop` declarado y nunca usado.
- La página no consulta `loading` del provider: en el primer render las cuentas están vacías → se ve un patrimonio de $0 y un gráfico plano que después salta. Falta skeleton.
- El header colapsable de "Ajustes Avanzados" usa `onClick` sobre el `CardHeader`: sin `role="button"`, sin `aria-expanded`, sin teclado.
- El SVG del gráfico no tiene `role="img"` ni descripción accesible ni tabla alternativa.

---

## 5. Qué se hizo

### Persistencia

Nueva migración **`supabase/migrations/20260905120000_plata_projections.sql`**:

- Tabla `public.goals` (`id text`, `user_id`, `name`, `amount`, `currency`, `kind`, `priority`, `achieved_at`), con RLS `own goals` siguiendo el patrón del esquema (`to authenticated` + `(select auth.uid())`), índice `goals_user_priority_idx (user_id, priority, created_at)` y grants para `authenticated`.
- Tipo `public.goal_kind`.
- Columnas nuevas en `user_settings`: horizonte, moneda de vista, términos reales, sincronizar cuentas, ahorro mensual ARS/USD, patrimonio manual ARS/USD y **dos rendimientos separados** (`annual_return_ars`, `annual_return_usd`), con sus `check`.
- `update public.user_settings set annual_return_usd = annual_return` para no cambiarle los supuestos por debajo a quien ya los tenía ajustados.

> Se apartó del plan en un punto: **no** lleva índice único en `(user_id, priority)`. Reordenar metas intercambia dos filas y un `unique` no diferible haría fallar el `UPDATE` del medio.

En el provider (`finance-provider.tsx`): estado `goals` + `addGoal` / `updateGoal` / `deleteGoal` / `reorderGoals` (optimista, con rollback), `projectionSettings` + `updateProjectionSettings`, y `settingsLoaded`. Mappers `toGoal` / `fromGoal` / `toProjectionSettings` / `fromProjectionSettings`.

`DEFAULT_GOALS` (las dos metas de demo hardcodeadas) ya no existe.

### Bugs

| # | Estado | Qué se hizo |
|---|---|---|
| 2.1 | ✅ | El auto-sync al montar ahora espera a `settingsLoaded` y corre una sola vez. Y `syncMacroFromApi` **sólo escribe cotización y `rates`**: la inflación, la devaluación y el rendimiento son del usuario y ya no se pisan. El botón dice "Actualizar cotización" (no había ninguna IA detrás). |
| 2.2 | ✅ | La devaluación dejó de ser eje de escenario. Verificado: **0 cruces en 5.000 simulaciones aleatorias** sin metas, y 0 en la trayectoria sin compras aun con metas. Antes, en ARS nominal, el pesimista daba $153 M contra $134 M del optimista; ahora $135 M / $147 M / $158 M. |
| 2.3 | ✅ | El descuento usa la inflación de la moneda que se muestra. En USD: 42.922 nominales → **39.857 reales** (antes 13.581). Parámetro `annualUsdInflationRate`, default 2,5%. |
| 2.4 | ✅ | El costo de cada meta se inflaciona mes a mes según la inflación de su moneda. |
| 2.5 | ✅ | Las metas se financian con **capital líquido**; la cartera va por `illiquidNetWorth`, suma al patrimonio y no paga metas. Las compras se descuentan de los saldos líquidos. |
| 2.6 | ✅ | Un solo `persistSettings` con **debounce de 600 ms**, más flush en `visibilitychange`/`pagehide` para no perder el último cambio. La fila se arma desde refs, así que dos cambios seguidos no se pisan. |
| 2.7 | ✅ | `Number.isFinite` en lugar de chequeos truthy: un 0 guardado ya se lee. |
| 2.8 | ✅ | La tarjeta "Meta de Compra Grande" y su `onRemoveGoal={() => setGoals([])}` no existen más. |
| 2.9 | ✅ | El gráfico usa eventos de puntero: anda con mouse y con el dedo. `touch-action: pan-y` deja que la página siga scrolleando por encima. |

### Modelo financiero

- **Rendimiento separado ARS/USD**, con dos sliders y su explicación ("plazo fijo o money market" / "acciones, ETFs o bonos").
- **Aportes de fin de mes**: el rendimiento se aplica al saldo de apertura. Antes el ahorro del mes cobraba un mes entero de interés.
- **`totalReturns` y `totalSaved` se acumulan mes a mes al tipo de cambio de hoy**, en vez de restar magnitudes de distintos momentos.
- **`coveragePercent`** mide contra el costo **acumulado** de la secuencia hasta esa meta.
- **`costInDisplayCurrency`** usa el TC y la inflación del mes en que la meta efectivamente se logra.
- **`estimatedDateLabel`** dice "No se alcanza en N meses" en vez de inventar "Más de 5 años".
- **`nextGoal`** es `null` cuando no queda ninguna pendiente, en vez de señalar una ya lograda.
- **Pasivos**: se descuenta del patrimonio inicial lo que ya está vencido o vence hoy (`sumOverdueLiabilities`). Los vencimientos futuros no, porque ya los absorbe el ahorro mensual y contarlos sería contarlos dos veces. Se muestra el monto descontado.
- **Ahorro mensual desde los movimientos reales** (`estimateMonthlySavings`): mediana de ingresos menos gastos de los últimos 6 meses **cerrados**, por moneda, sin transferencias. Botón "Usar mi promedio real" y la cifra a la vista. Era el número del que más depende toda la proyección y estaba hardcodeado en 300.000 / 500.

### Código muerto y UI

- Borrados del motor: `BigPurchaseGoal`, `GoalViability`, `goalViability`, `findAchieveMonth` y el bloque entero que nunca corría.
- `projection-kpis.tsx` reescrito: ahora muestra patrimonio final con su rango pesimista–optimista, aportes acumulados, rendimientos acumulados y próximo objetivo con barra de cobertura. Antes recibía cinco props que no usaba y no mostraba nada de lo que el motor calcula.
- `big-purchase-modal.tsx` → **`goal-modal.tsx`** (`GoalModal`). El guardado **espera de verdad** a la escritura: antes mostraba "meta agregada" tras un `setTimeout` de 300 ms y no llegaba nada a la base.
- Del gráfico: fuera el marcador de meta muerto, fuera `minVal` calculado y descartado, y el tick del eje X ya no pasa un mes donde se espera un índice.
- Un solo botón "Nueva meta" (más el CTA del estado vacío), en vez de tres.
- Copia corregida: los defaults reales, y sin "con IA".
- `0 warnings` de eslint en todos los archivos de la página.

### Accesibilidad y carga

- **Skeleton** mientras cargan cuentas y preferencias. Antes el primer render simulaba con patrimonio $0 y el gráfico pegaba un salto.
- SVG con `role="img"` y `aria-label`; **tabla alternativa** desplegable con los valores de las tres series y el TC por mes.
- El colapsable de ajustes avanzados es un `<button>` real con `aria-expanded` / `aria-controls`; los toggles de escenario llevan `aria-pressed`.
- **`formatCompact`** nuevo para el eje Y: `$153 M` en vez de `$153.044.309`, que no entraba en 57 px. `formatShort` queda intacto para el resto de la app.

### Tests

`npm test` (runner nativo de Node, sin dependencias nuevas). **31 tests, todos en verde.**

- `lib/simulation-engine.test.ts` (20): no cruce de escenarios en las cuatro vistas, invariancia de moneda contra el TC del mes, descuento real por moneda, aportes de fin de mes, inflación de metas, cascada por prioridad, reserva inmovilizada, cartera que no financia metas, metas fuera de horizonte, cobertura acumulada y casos borde.
- `lib/savings-capacity.test.ts` (11): neto por moneda, exclusión del mes en curso y de las transferencias, robustez de la mediana ante un mes atípico, moneda tomada de la cuenta, y el corte de vencidos.

> Un test encontró un bug que no estaba en la auditoría: `new Date("2026-08-01")` se parsea como medianoche UTC y en nuestro huso caía en **julio**, así que los movimientos del día 1 de cada mes se contaban en el mes anterior. Corregido leyendo el prefijo del texto.

---

## 6. Verificación

| Chequeo | Resultado |
|---|---|
| `npx tsc --noEmit` | limpio |
| `npx eslint` sobre los archivos de la página | 0 warnings |
| `npm test` | 31/31 |
| `npx next build` | compila; `/dashboard/proyecciones` prerenderiza |
| SQL de la migración | parseada con `pglast`: 8 sentencias, sin errores |
| Ordenamiento de escenarios | 5.000 simulaciones aleatorias, 0 cruces |
| Migración aplicada contra Postgres | sí — proyecto hosteado, vía pooler sa-east-1 |
| RLS de `goals` verificada en la base | inserta lo propio, bloquea lo ajeno, no ve lo de otros |
| Constraints verificadas en la base | rechaza nombre en blanco y monto negativo |
| Datos existentes | intactos: 6 cuentas, 215 movimientos, 1 vencimiento |

---

## 7. Corrección posterior: "no se alcanza" en metas cercanas

Reportado después de la primera entrega: una meta alcanzable en menos de 6 meses
aparecía como inalcanzable en 24 o más. **El motor calculaba bien; lo que le
llegaba estaba mal**, y además faltaban dos piezas del modelo.

### Qué le llegaba al motor

| Entrada | Guardado | Real |
|---|---|---|
| Patrimonio inicial ARS | **0** | $1.795.320 |
| Ahorro mensual ARS | 14.000 | ~265.238 (mediana de 3 meses cerrados) |

Con eso, "Fondo de reserva" de US$3.000 daba **no se alcanza en 36 meses**. Con
los valores reales da **4 meses**.

**Causa del 0:** al apagar el switch "sincronizar cuentas", el patrimonio manual
se sembraba desde los saldos reales con `?? `. Pero el skeleton sólo esperaba a
`settingsLoaded`, no a que cargaran las cuentas, así que el seeding podía correr
con `accounts` vacío y escribir 0. Y como `0 ?? x` es `0`, quedaba clavado. El
input lo remataba mostrando `""` en lugar de `0` (`value={initialARS || ""}`),
así que el campo se veía vacío y el error era invisible.

**Causa del ahorro:** los defaults quedaron en 0 y sólo se cambiaban a mano. Con
ahorro 0 el patrimonio no crece y **ninguna meta se alcanza jamás**.

### Arreglos

- `dataLoaded` en el provider: el skeleton espera a que carguen cuentas y
  movimientos, no sólo las preferencias.
- Al pasar a manual, el patrimonio se copia de los saldos reales **sin `?? `**.
- Los inputs muestran el 0 en vez de un campo vacío.
- Aviso en pantalla, con acción de un clic, cuando se simula con menos capital
  del que hay en las cuentas o con ahorro cero.
- Nueva columna `monthly_savings_source` (`auto` | `manual`, migración
  `20260905190000`): mientras el usuario no lo fije, el ahorro sale de sus
  movimientos y se recalcula solo. Al editar el campo pasa a `manual`.

### Dos errores de modelo que salieron en el camino

1. **El aporte mensual no acompañaba a la inflación.** El precio de la meta se
   inflacionaba y el sueldo que la paga quedaba clavado en pesos nominales: a 45%
   anual el aporte valía un tercio a los tres años y **toda meta en pesos a más
   de un año era inalcanzable por construcción**. Ahora el aporte se indexa por
   la inflación de su moneda.
2. **El saldo de una moneda podía irse a negativo sin límite.** Con un gasto neto
   en dólares de −US$40 al mes, el saldo llegaba a −US$1.549 y seguía componiendo
   al 12% anual como una deuda que no existía, restando de la plata disponible
   para las metas. Ahora el faltante de una moneda se cubre con la otra al tipo
   de cambio del mes, que es lo que hace una persona. Lo que quede en rojo tras
   vaciar ambas sí es déficit real y se deja a la vista.

### Y una mejora de lectura

Una meta que caía en el mes 39 con horizonte de 36 decía sólo "No se alcanza en
36 meses", que se lee como que la cuenta está mal. Ahora la proyección se estira
internamente hasta 120 meses para poder decir **"Fuera del horizonte: llegaría en
Diciembre 2029 (en 39 meses)"**.

### Verificado contra los datos reales

```
Fondo de reserva   -> Enero 2027 (en 4 meses)
Bajaj Dominar 400  -> Fuera del horizonte: llegaría en Diciembre 2029 (en 39 meses)
```

Los 39 meses de la moto son correctos: el fondo de US$3.000 va **adelante** en la
cascada y consume unos $4,6 M antes de que la moto empiece a juntar. Sola, la
moto entra en 16 meses. Si el orden no es el deseado, se reordena con las flechas.

38 tests, incluidos los de regresión de este caso.

---

## 8. Lo que queda

**Guardar escenarios con nombre y compararlos** ("Conservador", "Con aumento de sueldo"). Es la única cosa del plan original que no se hizo: es una feature nueva, no un arreglo, y necesita su propia tabla y su propia UI. La base para hacerla ya está: los parámetros de la simulación viven en un solo objeto (`ProjectionSettings`) y el motor es una función pura.

Dos cosas menores que quedaron anotadas y no tocadas a propósito:

- La columna `user_settings.annual_return` quedó sin uso (la reemplazan `annual_return_ars` / `annual_return_usd`). No se borró porque `drop column` es destructivo y conviene hacerlo en una migración aparte, una vez confirmado que todos los clientes están actualizados.
- `/api/macro` sigue devolviendo `annualInflation` / `annualDevaluation` / `annualReturn`. El cliente ya los ignora; limpiar el contrato del endpoint es un cambio aparte.

Y una observación que salió al verificar la migración, **anterior a este trabajo y
común a todo el esquema**: el rol `authenticated` tiene `TRUNCATE`, `REFERENCES` y
`TRIGGER` sobre todas las tablas de `public` —`accounts`, `transactions`,
`due_items`, `user_settings` y ahora también `goals`—, heredado de los privilegios
por defecto del proyecto Supabase. `TRUNCATE` **saltea las RLS**, así que en
teoría cualquier usuario autenticado podría vaciar una tabla entera. `goals` quedó
igual que el resto, no peor; pero si se quiere cerrar, es un
`revoke truncate, references, trigger on all tables in schema public from authenticated`
en su propia migración, no en esta.
