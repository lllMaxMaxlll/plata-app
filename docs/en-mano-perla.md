# EN MANO · Perla y Tinta suave

Dirección elegida: nombre **EN MANO**, lema **Tu plata, en claro**,
modo claro **Perla** y modo oscuro **Tinta suave**.

| Uso | Perla | Tinta suave |
| --- | --- | --- |
| Fondo | `#F1F3EF` | `#181A18` |
| Tarjeta y diálogo | `#FCFDFB` | `#232622` |
| Superficie secundaria | `#E4E9DF` | `#30352E` |
| Texto | `#20271E` | `#F2F0E8` |
| Texto secundario | `#5C6657` | `#B6BBAE` |
| Borde estructural | `#C4CEBE` | `#51594D` |
| Lima de acción | `#D4FF3A` | `#C6E76B` |
| Coral de categoría | `#FF9479` | `#F0AA95` |
| Cielo | `#B3D6E8` | `#ACCBDF` |
| Uva | `#D0C2E7` | `#C6B9E2` |
| Ingreso / éxito | `#21643B` | `#A5D4AE` |
| Error | `#B03221` | `#FFB29D` |

Los bordes usan `border-border`, no `border-foreground`. Los inputs tienen
un contorno más visible y el foco usa `ring`. Las grandes tarjetas resumen
usan superficies neutras; el lima señala acciones y selección. Los acentos
claros llevan texto en tinta en ambos temas.

Los colores del navegador y del manifest siguen el fondo del tema.
La moneda se conserva y sus PNG se regeneraron desde `public/icon.svg`.
Las claves de preferencias, sesión y caché anteriores se conservan para
evitar perder ajustes o datos locales durante el cambio de marca.

## Presentaciones

`design/colores/en-mano-claro.html` compara los tonos explorados.
`design/colores/en-mano-perla.html` abre la variante aprobada. Las maquetas
son independientes y usan datos ficticios.

## Comprobación manual en iPhone

1. Abrir la app instalada con internet para actualizar sus recursos.
2. En Yo, alternar Claro, Oscuro y Sistema; revisar la barra del navegador.
3. Abrir ANOTAR y escribir sin guardar. Confirmar que input y vista previa
   quedan accesibles sobre el teclado y que se puede desplazar el contenido.
4. Cerrar el teclado y comprobar que el diálogo recupera su altura.
5. Sin conexión, volver a abrir y consultar las pantallas con datos locales.

El modo offline permite consultar la última copia guardada. Registrar
movimientos y sincronizar pendientes sin conexión no forma parte del cambio.
La validación de navegador con viewport reducido no sustituye la prueba del
teclado real de Safari ni la actualización del nombre de un ícono ya instalado.
