# Auditoría de Vehículos y navegación móvil

Revisión del 31/10/2026 con la sesión autenticada del usuario. Las pruebas de
interfaz abren formularios pero no guardan, eliminan ni marcan servicios reales.

## Errores corregidos

1. **Alerta sin acción:** la tarjeta vencida sólo mostraba texto. Ahora ofrece
   Registrar service realizado y Editar programación. El primer botón abre un
   registro nuevo en categoría Service con el vehículo correcto; el segundo
   permite corregir el registro que originó el aviso.
2. **Recorrido incompleto desde Hoy/Agenda:** el botón llevaba al garaje sin
   seleccionar vehículo ni abrir el formulario. Ahora lleva a un enlace con
   vehículo y acción, que abre directamente el registro de service. Cerrar el
   formulario retira la acción de la URL para que no se vuelva a abrir sola.
3. **Fechas desplazadas por UTC:** una fecha guardada para el día 30 aparecía
   como día 29. Los eventos y próximas fechas de service se presentan como
   fechas de calendario, también para registros antiguos guardados a medianoche.
4. **Alertas duplicadas e históricas:** Vehículos revisaba cada service viejo y
   usaba un umbral distinto a Agenda. Las pantallas comparten ahora el mismo
   cálculo. El último service configura el próximo plan; si se guarda sin
   próxima fecha/km, no se rescata un aviso anterior. Comprar repuestos no
   completa un service.
5. **Edición no atómica:** el cliente borraba el registro y después lo creaba en
   otra solicitud. Un fallo podía dejarlo eliminado. La nueva RPC
   `update_vehicle_log` hace ambas operaciones en una transacción, conserva el
   identificador y restaura registro, gasto, saldo y odómetro ante un error.
   Es SECURITY INVOKER, conserva RLS y sólo permite ejecución autenticada.
6. **Validación y teclado decimal:** se rechazan kilometrajes negativos o
   fraccionarios, costos inválidos, litros no positivos y un próximo kilometraje
   que no supere al del registro. Los campos decimales admiten coma. La fecha
   futura no puede guardarse como un mantenimiento ya realizado.
7. **Monedas mezcladas:** la bitácora trataba todos los importes como pesos,
   aunque el gasto estuviera vinculado a una cuenta en USD. Se conserva la
   moneda del movimiento, se muestran importes originales y sólo se consolida
   con una cotización disponible, indicando que es actual y no histórica.
8. **Costo por km sin recorrido registrado:** se dividía por todo el odómetro
   cuando faltaba un intervalo. Ahora se muestra sin estimación hasta que hay
   kilómetros efectivamente registrados. Indumentaria sigue fuera del costo
   directo por km.
9. **Acceso móvil poco visible:** las páginas estaban distribuidas entre enlaces
   de resumen. Se agregó Secciones en el encabezado móvil, disponible en todas
   las páginas autenticadas, con las 12 rutas canónicas. Comparte el mapa de
   navegación con el sidebar de escritorio y reserva espacio para el área
   segura del iPhone.

## Verificación

- Tests de fechas, relevo de recordatorios, compras de repuestos, monedas,
  validación numérica y cobertura de rutas.
- Pruebas SQL con usuarios y registros sintéticos dentro de una transacción
  que termina en ROLLBACK: edición, id estable, gasto único, saldo, conservación
  ante descubierto, odómetro, RLS y rechazo de una sesión sin uid.
- Migración registrada en Supabase; advisors sin hallazgos de seguridad sobre
  la nueva función. Existe un aviso previo de Auth sobre protección contra
  contraseñas filtradas deshabilitada, fuera del módulo de vehículos.
- Verificación en navegador móvil de los formularios y enlaces, sin guardar
  datos reales; compilación de Next y prueba del Worker antes del despliegue.

## Alcance del recordatorio

El modelo actual tiene un único próximo plan de service por vehículo, definido
por el último registro de categoría Service. No mantiene agendas independientes
para aceite, neumáticos, válvulas, etc. Si se necesita ese detalle, hace falta
modelar tareas de mantenimiento separadas. La auditoría no cambia fechas ni
kilometrajes de registros existentes y no interpreta una compra de aceite como
un cambio de aceite realizado.
