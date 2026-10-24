"""Explora tres claros para EN MANO; conserva Tinta suave en oscuro."""
from pathlib import Path
import json
import runpy

OUT = Path(__file__).parent
base = runpy.run_path(str(OUT / 'generate.py'))
palette = base['palette']
dark = base['PROPOSALS'][0]['dark']
proposals = [
    dict(id='en-mano-perla', title='Perla', tag='Mi recomendación',
         idea='Un claro más limpio y neutro, con apenas un matiz mineral.',
         light=palette('#f1f3ef','#fcfdfb','#e4e9df','#20271e','#5c6657','#c4cebe','#d4ff3a','#ff9479','#b3d6e8','#d0c2e7','#21643b','#b03221'),
         dark=dark,
         why='El fondo perla reemplaza el beige del papel. Las tarjetas son casi blancas, los controles tienen un matiz gris verdoso y el lima sigue dando identidad. El resultado se vincula con el carbón vegetal de Tinta suave.',
         trade='Mi elección para EN MANO: más fresco que el papel actual, sin llevar el blanco hacia el azul ni teñir demasiado toda la app.'),
    dict(id='en-mano-salvia', title='Salvia', tag='Más natural',
         idea='Un blanco verdoso que acompaña el lima de la marca.',
         light=palette('#eaf0e4','#f9fcf5','#dbe6d2','#20291c','#56654c','#bbcdb0','#d4ff3a','#f4aa91','#b6d8df','#d2c7e5','#285f30','#ab3424'),
         dark=dark,
         why='El verde se nota más en el fondo, los controles y los divisores. Las tarjetas claras conservan la legibilidad y el lima continúa destacando las acciones. Coral y cielo equilibran el conjunto.',
         trade='Tiene más personalidad y acompaña muy bien al oscuro elegido. Puede sentirse demasiado verde si lo que buscás es un blanco más neutro.'),
    dict(id='en-mano-bruma', title='Bruma', tag='Más fría',
         idea='Un claro gris azulado, con sensación de aire y precisión.',
         light=palette('#edf2f5','#fcfdff','#dfe8ee','#202831','#566570','#bfcdd5','#d4ff3a','#f4aa96','#a8cee6','#cdc4e9','#21643e','#b13224'),
         dark=dark,
         why='El fondo pasa del beige a un gris azulado suave. Las tarjetas se ven más blancas por contraste y el cielo encaja de forma natural en los detalles. La estructura y el lima siguen siendo los de EN MANO.',
         trade='La alternativa más distinta al papel actual. Se siente más tecnológica y tiene menos continuidad de temperatura con el oscuro vegetal.'),
]

css = base['CSS'] + '''
.proposal-nav{grid-template-columns:repeat(3,minmax(0,1fr))}
.app-brand{font-size:25px;letter-spacing:-.8px}.device{min-height:780px}
.hero{padding-top:40px}.hero h1{font-size:clamp(42px,5vw,68px)}
.tone-notes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;margin:36px 0 50px}
.tone-notes article{border-top:2px solid #263020;padding-top:12px}.tone-notes p{font-size:14px;color:#59614f}
body.current .device[data-mode=dark] .balance{border-width:1px;box-shadow:none}
@media(max-width:700px){.proposal-nav{grid-template-columns:1fr}.proposal-nav button:last-child{grid-column:auto}.tone-notes{grid-template-columns:1fr;gap:14px}.hero h1{font-size:45px}.app-brand{font-size:24px}}
'''

body = '''
<header><div class="top"><span class="mini-brand"><span class="coin">$</span>EN MANO</span><span class="eyebrow">Tinta suave · nueva dirección<br>Tres tonos para el modo claro</span></div></header>
<main>
<section class="hero"><div><div class="eyebrow">Tu plata, en claro.</div><h1>EN MANO.<br>El claro, <em>a tu tono.</em></h1><p class="lead">Tres alternativas al papel beige. Todas mantienen el oscuro Tinta suave que elegiste, la moneda y el acento lima.</p></div><div class="note"><b>Mi elección: Perla.</b><p>Un fondo más limpio, gris verdoso muy sutil y tarjetas casi blancas. Combina con el carbón del modo oscuro sin que toda la app se sienta verde.</p><small>Maquetas con datos ficticios. Sin conexión con tu cuenta.</small></div></section>
<section aria-label="Comparador de tonos claros">
<div class="proposal-nav" id="proposal-nav" aria-label="Tonos claros"></div>
<div class="controls">
<div class="group" aria-label="Apariencia"><button data-display="both" aria-pressed="true">Ambos</button><button data-display="light" aria-pressed="false">Claro</button><button data-display="dark" aria-pressed="false">Oscuro</button></div>
<div class="group" aria-label="Pantalla"><button data-view="home" aria-pressed="true">Hoy</button><button data-view="entry" aria-pressed="false">Anotar</button></div>
<div class="group" aria-label="Comparación del modo claro"><button data-source="proposal" aria-pressed="true">Nuevo claro</button><button data-source="current" aria-pressed="false">Papel original</button></div>
<label>Marca <select id="brand-name"><option value="EN MANO">EN MANO</option></select></label>
</div>
<div class="detail"><div><div class="eyebrow" id="proposal-counter"></div><h2 id="proposal-title"></h2><p id="proposal-idea"></p></div><span class="recommend" id="proposal-tag"></span></div>
<p class="view-note"><span class="proposed-label">Nuevo tono para el modo claro. </span><span class="baseline-label">Comparación con el papel beige original. </span>El modo oscuro permanece en Tinta suave en las tres variantes. Los importes son ficticios.</p>
<div class="showcase" id="showcase"></div>
<p id="proposal-why" class="lead"></p><p id="proposal-trade" class="view-note"></p>
</section>
<section class="tone-notes" aria-label="Qué cambia en cada tono"><article><div class="eyebrow">01 · Perla</div><h3>Más neutro.</h3><p>Fondo #F1F3EF · tarjeta #FCFDFB. El verde está apenas insinuado. Es el equilibrio que recomiendo para uso diario.</p></article><article><div class="eyebrow">02 · Salvia</div><h3>Más natural.</h3><p>Fondo #EAF0E4 · tarjeta #F9FCF5. El verde se ve más y la personalidad de la marca gana calidez.</p></article><article><div class="eyebrow">03 · Bruma</div><h3>Más fresco.</h3><p>Fondo #EDF2F5 · tarjeta #FCFDFF. Un gris azulado que hace que las tarjetas se sientan más blancas.</p></article></section>
<section><h2>Abrir cada tono.</h2><div class="files" id="files"></div></section>
</main><footer>EN MANO · exploración visual. Ningún cambio aplicado al producto ni a tus movimientos. Los contrastes corresponden a los pares de texto evaluados en estas maquetas. Tipografía Bricolage Grotesque del proyecto.</footer>
'''

js = base['JS'].replace("brand='lucas'", "brand='EN MANO'")
js = js.replace('/ 05', '/ 03')
js = js.replace("${mode==='light'?'01 / MODO CLARO':'02 / MODO OSCURO'}", "${mode==='light'?'01 / MODO CLARO':'02 / TINTA SUAVE'}")
js = js.replace("${source==='current'?'ACTUAL':p.title.toUpperCase()}", "${mode==='dark'?'OSCURO ELEGIDO':source==='current'?'PAPEL ORIGINAL':p.title.toUpperCase()}")
js = js.replace('href="index.html">Comparador general', 'href="en-mano-claro.html">Comparar los tres tonos')
for initial, filename in [(0,'en-mano-claro.html')] + [(i,p['id']+'.html') for i,p in enumerate(proposals)]:
    data = 'const PROPOSALS='+json.dumps(proposals,ensure_ascii=False)+';const CURRENT_DARK='+json.dumps(dark)+';const CURRENT_LIGHT='+json.dumps(base['CURRENT_LIGHT'])+f';const INITIAL={initial};'
    title = 'Tres tonos claros' if filename=='en-mano-claro.html' else proposals[initial]['title']
    html = f'<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EN MANO — {title}</title><style>{base["FONT"]}{css}</style></head><body>{body}<script>{data}{js}</script></body></html>'
    (OUT / filename).write_text(html)
print('Generados comparador y tres tonos claros de EN MANO.')
