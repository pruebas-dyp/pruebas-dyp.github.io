/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   ORDENAR, PAGINAR Y ENSANCHAR COLUMNAS

   Lo que hace que CUALQUIER tabla del sistema se pueda ordenar, paginar y
   ensanchar sin que cada panel tenga que programarlo.

   Salio de `app.js` el 22-08-2026 (COD-7), que llego a 3.249 lineas — por
   encima del punto donde la casa midio que un archivo ya no se puede revisar
   en un pull request. No se movio ni una linea de logica: es corte y pegue.
   ─────────────────────────────────────────────────────────────────────── */

/* ═══════════ ORDENAR Y ENSANCHAR CUALQUIER COLUMNA ═══════════
   Pedido de Marco el 15-08-2026: que en todos los paneles las columnas se
   puedan ordenar y se puedan ensanchar o achicar, **y que no se vea ningún
   texto que lo explique**. Por eso no hay globos de ayuda ni rótulos: la
   columna ordenada se marca con una flecha chica y el que quiera ensanchar
   encuentra el cursor de arrastre en el borde. Se descubre solo, como en
   cualquier planilla.

   Va acá y no en cada vista, por la misma razón que `Media.pintar()`: son
   catorce paneles y los que vengan. Se aplica después de pintar, sobre el DOM
   ya armado, así que también alcanza a la columna de la flecha que
   `dobleClicPorFilas` inserta a mano.

   Lo que se ordena son las filas que ya están en pantalla. La TORRE queda
   fuera: ordena en el modelo —sus 17 columnas, sobre las 102 órdenes— y eso es
   mejor que ordenar lo pintado. Ahí sólo se agrega el ensanchado. */
const ordenPorTabla = {};
const anchoPorTabla = {};
/* 🔴 DÓNDE ESTABA CORRIDA LA TABLA (28-08-2026).

   Cada `render()` vuelve a escribir el HTML entero, y una caja recién creada
   nace en `scrollLeft: 0`. En el escritorio casi no se nota; en un teléfono,
   donde la torre son 21 columnas y hay que deslizar 878 px para llegar a
   «Encargado», se nota en cada tecla: se desliza hasta la columna que se quiere
   mirar, se escribe UNA letra en el buscador y la tabla vuelve sola a la
   columna 1.

   Medido: `scrollLeft` 400 antes de teclear, 0 después. Se guarda por tabla —la
   misma llave que usan el orden y los anchos— y se repone al repintar. */
const ladoPorTabla = {};

function llaveTabla(tabla, i) { return ui.vista + '#' + i; }

/* De texto de celda a algo comparable. Reconoce lo que estas tablas muestran:
   plata con puntos de miles, fechas chilenas, días, y todo lo demás como
   texto. Sin esto `$1.000.000` quedaba antes que `$90.000` — el orden
   alfabético sobre un número es una respuesta equivocada con cara de
   respuesta. */
function valorDeCelda(td) {
  const t = (td ? td.textContent : '').trim();
  if (!t) return { n: null, t: '' };

  /* Fecha: 12-08-2026, 12/08/2026, 12/08 y —desde que las columnas de ingreso
     y de entrega llevan hora— 12-08-2026 09:30. Se compara como número
     AAAAMMDDhhmm. Sin la hora en la llave, dos autos recibidos el mismo día
     quedaban en cualquier orden, que es justo lo que la hora vino a resolver;
     y sin este ramo la celda caía al ramo numérico y ordenaba por el DÍA del
     mes, con lo que enero de 2027 quedaba antes que agosto de 2026. */
  const f = t.match(/^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (f) {
    const a = f[3] ? (f[3].length === 2 ? 2000 + Number(f[3]) : Number(f[3])) : 0;
    const dia = a * 10000 + Number(f[2]) * 100 + Number(f[1]);
    return { n: dia * 10000 + Number(f[4] || 0) * 100 + Number(f[5] || 0), t: t.toLowerCase() };
  }

  // Número: $1.234.567, 1.234, 12,5, 45 d, -3
  const limpio = t.replace(/[$\s]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const m = limpio.match(/^-?\d+(\.\d+)?/);
  if (m && /\d/.test(t)) return { n: Number(m[0]), t: t.toLowerCase() };

  return { n: null, t: t.toLowerCase() };
}

/* 🔴 CUÁNTO SE VE DE ANCHO (28-08-2026).

   Lo necesita el CSS que deja fija la primera fila de cada tabla: la cabecera
   del panel se pega al borde izquierdo con este ancho. No sirve `100vw` porque
   en el escritorio la barra lateral se lleva 208 px y `#contenido` es más
   angosto que la ventana —y en el teléfono, el relleno—.

   Se escribe después de cada pintada y al cambiar el tamaño de la ventana, que
   son los dos momentos en que puede cambiar. */
function anchoUtilDeLaPantalla() {
  const c = document.getElementById('contenido');
  if (!c || !document.documentElement) return;
  document.documentElement.style.setProperty('--ancho-util', c.clientWidth + 'px');
}
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('resize', anchoUtilDeLaPantalla);
}

function mejorarTablas() {
  anchoUtilDeLaPantalla();
  document.querySelectorAll('#contenido table.grid').forEach((tabla, i) => {
    // Las tablas anidadas del desplegable no: son cuatro filas dentro de una
    // fila, y ordenarlas por su cuenta confunde más de lo que ayuda.
    if (tabla.classList.contains('anidada')) return;
    const encab = tabla.querySelector('thead tr');
    const cuerpo = tabla.querySelector('tbody');
    if (!encab || !cuerpo) return;

    const llave = llaveTabla(tabla, i);
    const propia = !!encab.querySelector('th[data-orden]');   // la torre
    /* Una tabla con `colspan` en el cuerpo trae totales o subtítulos. Esas no
       se ordenan —el total terminaría en la fila 14— y por eso tampoco se
       marcan como ordenables: una columna que parece que se puede apretar y
       no hace nada es peor que una que no lo parece. */
    const conTotales = !!tabla.querySelector('tbody td[colspan]');
    const ths = [...encab.children];

    aplicarAnchos(tabla, ths, llave);
    ths.forEach((th, col) => {
      agregarTirador(tabla, ths, th, col, llave);
      if (propia || conTotales || th.classList.contains('flecha-col')) return;
      // Un encabezado en blanco es la columna de los botones: no se ordena.
      if (!th.textContent.trim()) return;
      ordenable(tabla, cuerpo, th, col, llave);
    });

    const guardado = ordenPorTabla[llave];
    if (!propia && guardado) ordenarFilas(tabla, cuerpo, guardado.col, guardado.desc, ths);

    /* Después de ordenar, no antes: la página 1 son las primeras filas del
       orden que quedó, no las del orden con el que vinieron. */
    if (!paginaSola(tabla)) paginarTabla(tabla, cuerpo, llave);

    /* La caja que se desliza vuelve a donde estaba. Se repone DESPUÉS de
       ordenar y paginar, que son los dos que cambian el ancho del contenido: si
       se repusiera antes, el navegador lo recortaría al ancho viejo. */
    const caja = cajaDe(tabla);
    if (caja && caja.classList.contains('grid-envoltorio')) {
      const guardado = ladoPorTabla[llave];
      if (guardado) caja.scrollLeft = guardado;
      caja.addEventListener('scroll', () => { ladoPorTabla[llave] = caja.scrollLeft; }, { passive: true });
    }
  });

  avisarQueHayMasColumnas();
}

/* ── «Hay más columnas a la derecha» ───────────────────────────────────
   🔴 EL PROBLEMA QUE ESTO RESUELVE (21-08-2026). La torre tiene diecisiete
   columnas y en un celular entran cuatro. La tabla se desliza —siempre se
   deslizó—, pero nada lo decía: el borde derecho corta limpio, sin sombra ni
   media columna asomada, y se lee como que la tabla TERMINA ahí.

   Eso no se ve como un problema de diseño, se ve como un dato que falta. La
   frase que llega después es «el sistema no muestra la compañía», y uno se
   pone a buscar un error que no existe.

   El aviso se calcula midiendo, no adivinando: sólo aparece si el contenido de
   verdad no cabe. En el escritorio, donde cabe, no aparece nunca. */
function avisarQueHayMasColumnas() {
  document.querySelectorAll('#contenido .grid-envoltorio').forEach((env) => {
    const previo = env.nextElementSibling;
    if (previo && previo.classList && previo.classList.contains('pista-desliza')) previo.remove();
    /* 🔴 SE MIDE CONTRA LO QUE SE VE, NO CONTRA LA CAJA (28-08-2026).

       Antes se comparaba el contenido del envoltorio contra el propio
       envoltorio. Desde que la caja dejó de desplazar —para que la cabecera de
       la tabla se pueda pegar— esa comparación da siempre igual: la caja mide
       exactamente lo que mide su tabla. La pista dejaba de aparecer justo
       cuando más falta hace.

       Lo que hay que comparar es la TABLA contra el hueco visible, que es
       `#contenido`. 4 px de margen: un par de píxeles son redondeo del
       navegador, no una columna escondida. */
    const visible = document.getElementById('contenido');
    const hueco = visible ? visible.clientWidth : env.clientWidth;
    const anchoTabla = Math.max(env.scrollWidth, env.firstElementChild
      ? env.firstElementChild.getBoundingClientRect().width : 0);
    if (anchoTabla <= hueco + 4) return;
    const pista = document.createElement('div');
    pista.className = 'pista-desliza';
    pista.textContent = 'Desliza la tabla para ver las demás columnas';
    env.insertAdjacentElement('afterend', pista);
  });
}

/* ── Ordenar ─────────────────────────────────────────────────────────── */
function ordenable(tabla, cuerpo, th, col, llave) {
  th.classList.add('ordenable');
  const g = ordenPorTabla[llave];
  if (g && g.col === col) {
    th.classList.add('ordenando');
    th.dataset.sentido = g.desc ? 'desc' : 'asc';
  }
  th.addEventListener('click', (ev) => {
    if (ev.target.classList.contains('tirador-col')) return;
    const actual = ordenPorTabla[llave];
    const desc = !!(actual && actual.col === col && !actual.desc);
    ordenPorTabla[llave] = { col, desc };
    /* Se vuelve a la primera página: al cambiar el orden cambia QUÉ filas son
       las de la página 3, así que quedarse ahí muestra otras sin haber pedido
       moverse. */
    if (paginaPorTabla[llave]) paginaPorTabla[llave].pag = 1;
    render();
  });
}

function ordenarFilas(tabla, cuerpo, col, desc, ths) {
  /* Una fila de totales o de subtítulo lleva una celda con `colspan`: si se
     ordenara se iría al medio de la tabla y dejaría de significar lo que
     significa. Esas tablas no se ordenan, y es mejor eso que un total
     flotando en la fila 14. */
  if (cuerpo.querySelector('td[colspan]')) return;

  const filas = [...cuerpo.children].filter((tr) => !tr.classList.contains('detalle'));
  if (filas.length < 2) return;

  // El desplegable abierto viaja pegado a su fila.
  const detalleDe = new Map();
  filas.forEach((tr) => {
    const sig = tr.nextElementSibling;
    if (sig && sig.classList.contains('detalle')) detalleDe.set(tr, sig);
  });

  const clave = (tr) => valorDeCelda(tr.children[col]);
  const orden = filas.map((tr, i) => ({ tr, i, v: clave(tr) }));
  orden.sort((a, b) => {
    const x = a.v, y = b.v;
    let r;
    if (x.n !== null && y.n !== null) r = x.n - y.n;
    else if (x.n !== null) r = -1;          // los números antes que el texto
    else if (y.n !== null) r = 1;
    else r = x.t.localeCompare(y.t, 'es');
    // Empate: se conserva el orden con el que venían. Sin esto, dos filas
    // iguales bailan cada vez que se repinta.
    return (r || (a.i - b.i)) * (desc ? -1 : 1);
  });

  const trozo = document.createDocumentFragment();
  orden.forEach((o) => {
    trozo.appendChild(o.tr);
    const d = detalleDe.get(o.tr);
    if (d) trozo.appendChild(d);
  });
  cuerpo.appendChild(trozo);
}

/* ── Paginar ─────────────────────────────────────────────────────────────
   Le pone a cada tabla el mismo pie que ya tenían la Torre y el Histórico:
   cuántas filas se muestran, en qué tramo va y los pasos para moverse.

   🔴 LO QUE NO SE HACE ACÁ. La Torre y el Histórico paginan EN EL MODELO —cortan
   la lista antes de pintarla— y traen su propio pie. A esas dos no se les
   agrega este paginado encima: se les puso el selector en el pie que ya
   tenían. Paginar dos veces la misma tabla, una en el modelo y otra sobre el
   DOM, es la forma exacta del error que costó dos correcciones esta semana:
   dos lugares haciendo lo mismo por caminos distintos, y ninguno de los dos
   equivocado por su cuenta. Se reconocen porque su envoltorio ya viene seguido
   de un `.pie-grid`.

   Las filas que quedan fuera de la página se ESCONDEN, no se sacan del
   documento: así Exportar sigue entregando la tabla completa —lo filtrado, no
   lo que alcanzó a caber en la pantalla— y en papel salen todas. Ver
   `CSS_IMPRIMIR_VISTA`.

   El pie aparece recién cuando hay más filas que la opción más chica. Con ocho
   filas no hay nada que decidir, y un selector que no cambia nada es un botón
   muerto en pantalla. */
const paginaPorTabla = {};

function paginarTabla(tabla, cuerpo, llave) {
  const filas = [...cuerpo.children].filter((tr) => !tr.classList.contains('detalle'));

  /* Un total o un subtítulo no puede quedar fuera de la página: la tabla
     perdería su cierre y el número de abajo dejaría de cuadrar con lo de
     arriba. Esas no se paginan, por la misma razón por la que no se ordenan. */
  const conTotales = filas.some((tr) => tr.querySelector('td[colspan]'));
  if (conTotales || filas.length <= TAMANOS_PAGINA[0]) return soltarPagina(tabla, filas);

  const e = paginaPorTabla[llave] || (paginaPorTabla[llave] = { tam: TAMANO_PAGINA, pag: 1 });
  const tam = tamanoEfectivo(e.tam, filas.length);
  const paginas = Math.max(1, Math.ceil(filas.length / tam));
  e.pag = Math.min(Math.max(1, e.pag), paginas);
  const desde = (e.pag - 1) * tam;
  const hasta = Math.min(desde + tam, filas.length);

  let vistas = 0;
  filas.forEach((tr, i) => {
    const dentro = i >= desde && i < hasta;
    verFila(tr, dentro);
    tr.classList.remove('zebra-si', 'zebra-no');
    if (!dentro || !tr.classList.contains('fila')) return;
    /* La franja gris la reparte `nth-child`, que sigue contando las filas
       escondidas: en la página 2 arrancaba corrida y eso se lee como tabla mal
       pintada. Acá se numera sobre las que se ven. */
    tr.classList.add(vistas % 2 ? 'zebra-si' : 'zebra-no');
    vistas++;
  });

  pintarPiePaginas(tabla, llave, e, { total: filas.length, desde, hasta, paginas });
}

// El desplegable abierto viaja pegado a su fila, acá igual que al ordenar.
function verFila(tr, dentro) {
  tr.classList.toggle('fuera-de-pagina', !dentro);
  const sig = tr.nextElementSibling;
  if (sig && sig.classList.contains('detalle')) sig.classList.toggle('fuera-de-pagina', !dentro);
}

/* La tabla dejó de necesitar página —se filtró y quedaron doce filas—: se
   muestran todas y se saca el pie. Si no, quedaba un «Página 1 de 1» colgado
   abajo de una tabla que ya no paginaba. */
function soltarPagina(tabla, filas) {
  filas.forEach((tr) => { verFila(tr, true); tr.classList.remove('zebra-si', 'zebra-no'); });
  const pie = piePaginasDe(tabla);
  if (pie) pie.remove();
}

const cajaDe = (tabla) => tabla.closest('.grid-envoltorio') || tabla;

/* Los pies que ya vienen pegados abajo de la tabla, en orden. Puede haber uno
   de la pantalla —Personal dice cuántas cuentas hay— y el de páginas. */
function piesDe(tabla) {
  const pies = [];
  let n = cajaDe(tabla).nextElementSibling;
  /* 🔴 LA PISTA «DESLIZA LA TABLA» SE METE EN EL MEDIO, Y ESTE RECORRIDO SE
     DETENÍA AHÍ (28-08-2026).

     `avisarQueHayMasColumnas` inserta la pista JUSTO DESPUÉS de la caja de la
     tabla. Este bucle avanzaba «mientras la clase sea `pie-grid`», así que con
     la pista al medio se cortaba en el primer paso y devolvía una lista vacía.
     `piePaginasDe` daba `null`, `pintarPiePaginas` creía un pie NUEVO, y al
     repintar volvía a crear otro.

     Medido en Documentos a 390 px: un toque en «Siguiente» dejaba DOS pies de
     paginado, uno debajo del otro, cada uno diciendo una página distinta. Y
     sólo pasa en el teléfono, porque en el escritorio la tabla cabe y la pista
     no se pinta.

     Ahora la pista se salta y el recorrido sigue. No se la trata como pie —no
     entra a la lista—: sólo se la deja pasar. */
  while (n && n.classList &&
    (n.classList.contains('pie-grid') || n.classList.contains('pista-desliza'))) {
    if (n.classList.contains('pie-grid')) pies.push(n);
    n = n.nextElementSibling;
  }
  return pies;
}

function piePaginasDe(tabla) {
  return piesDe(tabla).find((p) => p.classList.contains('pie-paginas')) || null;
}

/* 🔴 SE RECONOCE POR EL SELECTOR, no por tener pie. Cuatro paneles —Bodega,
   Documentos, Presupuesto y el Consolidado— traían un pie que decía «Mostrando
   60 de 102» y una tabla cortada en 60 sin ninguna forma de ver el resto. Eso
   no es paginar: es esconder 42 órdenes con cara de estar informando. Se les
   sacó el corte y este paginado se hace cargo. Si el guard fuera «tiene pie»,
   habrían quedado exactamente como estaban. */
function paginaSola(tabla) {
  return piesDe(tabla).some((p) => !p.classList.contains('pie-paginas') && p.querySelector('select'));
}

function pintarPiePaginas(tabla, llave, e, n) {
  let pie = piePaginasDe(tabla);
  if (!pie) {
    pie = document.createElement('div');
    pie.className = 'pie-grid pie-paginas';
    // Debajo del pie que la pantalla ya traía, si trae uno: primero lo que la
    // pantalla dice de su tabla, después de a cuántas se está mirando.
    const pies = piesDe(tabla);
    (pies.length ? pies[pies.length - 1] : cajaDe(tabla)).insertAdjacentElement('afterend', pie);
  }

  /* Sólo se pinta el paso que lleva a alguna parte: en la primera página no hay
     «Anterior» que apretar. Un botón apagado ocupa el mismo lugar y no hace
     nada, que es lo que acá no se quiere. */
  const pasos =
    (e.pag > 1 ? '<button type="button" class="btn secundario" data-paso="-1">Anterior</button>' : '') +
    (n.paginas > 1 ? '<span class="info">Página ' + e.pag + ' de ' + n.paginas + '</span>' : '') +
    (e.pag < n.paginas ? '<button type="button" class="btn secundario" data-paso="1">Siguiente</button>' : '');

  pie.innerHTML =
    '<div class="info">' + (e.tam
      ? 'Mostrando ' + fMiles(n.desde + 1) + '–' + fMiles(n.hasta) + ' de ' + fMiles(n.total)
      : 'Mostrando las ' + fMiles(n.total) + ' filas') + '</div>' +
    '<div class="ctrl">' + selectorTamano('', e.tam) + pasos + '</div>';

  // Se vuelve a paginar en el lugar, sin repintar la pantalla entera: lo único
  // que cambia son las filas que se ven y este mismo pie.
  const rehacer = () => paginarTabla(tabla, tabla.querySelector('tbody'), llave);

  pie.querySelector('select').addEventListener('change', (ev) => {
    e.tam = Number(ev.target.value) || 0;
    e.pag = 1;
    rehacer();
  });
  pie.querySelectorAll('[data-paso]').forEach((b) => b.addEventListener('click', () => {
    e.pag += Number(b.dataset.paso);
    rehacer();
    /* Los pasos están abajo de la tabla: sin esto, al apretar Siguiente la
       página nueva arranca fuera de la pantalla y parece que no pasó nada. */
    cajaDe(tabla).scrollIntoView({ block: 'start' });
  }));
}

/* ── Ensanchar ───────────────────────────────────────────────────────── */
function aplicarAnchos(tabla, ths, llave) {
  const anchos = anchoPorTabla[llave];
  if (!anchos) return;
  // `table-layout: fixed` es lo que hace que un ancho puesto a mano se
  // respete de verdad; con el automático el navegador lo trata como sugerencia
  // y una columna nunca achica bajo su contenido. Se enciende recién cuando
  // alguien arrastra, y ahí se fijan TODAS las columnas con el ancho que
  // tenían: así la tabla no se redistribuye sola al mover una sola.
  tabla.classList.add('anchos-fijos');
  ths.forEach((th, col) => {
    if (anchos[col]) th.style.width = anchos[col] + 'px';
  });
}

function agregarTirador(tabla, ths, th, col, llave) {
  if (th.querySelector('.tirador-col')) return;
  const t = document.createElement('span');
  t.className = 'tirador-col';
  th.appendChild(t);

  t.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    // Se congelan los anchos actuales antes de mover uno: si no, al pasar a
    // layout fijo las demás columnas se reparten el espacio en partes iguales
    // y la tabla salta.
    if (!anchoPorTabla[llave]) {
      anchoPorTabla[llave] = ths.map((x) => Math.round(x.getBoundingClientRect().width));
      aplicarAnchos(tabla, ths, llave);
    }
    const x0 = ev.clientX;
    const w0 = anchoPorTabla[llave][col] || Math.round(th.getBoundingClientRect().width);
    document.body.classList.add('arrastrando-col');
    try { t.setPointerCapture(ev.pointerId); } catch (e) { /* no siempre se puede */ }

    const mover = (e2) => {
      const w = Math.max(38, w0 + (e2.clientX - x0));
      anchoPorTabla[llave][col] = w;
      th.style.width = w + 'px';
    };
    const soltar = () => {
      document.body.classList.remove('arrastrando-col');
      t.removeEventListener('pointermove', mover);
      t.removeEventListener('pointerup', soltar);
      t.removeEventListener('pointercancel', soltar);
    };
    t.addEventListener('pointermove', mover);
    t.addEventListener('pointerup', soltar);
    t.addEventListener('pointercancel', soltar);
  });
}

/* Lo que se ve al desplegar. El bloque de PRESUPUESTOS es la tabla anidada que
   pidió el cliente: cuando una OT tiene varias OR, se abren bajo su fila con
   monto, estado y versión, sin abrir la orden. Su frase: "que el usuario tenga
   el detalle ahí mismo y no tenga que estar abriendo la OT". */
function detalleDeOT(clave) {
  const o = ordenPorNumeroOId(clave);
  if (!o) return '<div class="vacio"><div class="texto">No se pudo leer esta orden.</div></div>';

  const e = o.etapa ? etapaPorCodigo(o.etapa) : null;
  const pend = o.repuestos.filter((r) => !r.fechaBodega);
  const dato = (k, v) => '<div class="dato"><span class="k">' + esc(k) + '</span><span class="v">' + v + '</span></div>';

  const cabecera = '<div class="rejilla-datos">' +
    dato('Vehículo', esc([o.marca, o.modelo, o.color].filter(Boolean).join(' · ') || '—')) +
    dato('Cliente', esc(o.cliente)) +
    dato('Compañía', o.compania === '—' ? 'Particular' : esc(o.compania)) +
    dato('Siniestro', esc(o.siniestro || '—')) +
    dato('Etapa', e ? esc(e.nombre) : 'Pendiente') +
    dato('Encargado', esc(o.asignado || 'Sin asignar')) +
    dato('Dónde está', o.fueraDeTaller ? 'Fuera del taller' : 'En el taller') +
    dato('Días', o.diasKpi + ' de reparación · ' + o.diasTotales + ' totales') +
    '</div>';

  // Tabla anidada de OR. Una OT tiene una sola OT y puede tener varias OR.
  const presupuestos = o.presupuestos.length
    ? '<table class="grid anidada"><thead><tr>' +
        '<th>OR</th><th>Versión</th><th>Estado</th><th>Líneas</th>' +
        '<th class="num">Neto</th><th class="num">Total</th></tr></thead><tbody>' +
      o.presupuestos.map((p) =>
        '<tr><td class="num"><span data-or="' + esc(p.numeroOR) + '">' + esc(p.numeroOR) + '</span></td>' +
        '<td class="num">v' + p.version + '</td>' +
        '<td><span class="et">' + esc(p.estado) + '</span></td>' +
        '<td class="num">' + p.lineas.length + '</td>' +
        '<td class="num">' + fMonto(p.neto) + '</td>' +
        '<td class="num"><strong>' + fMonto(p.total) + '</strong></td></tr>').join('') +
      '</tbody></table>'
    : '<div class="texto" style="color:var(--gris-2)">Sin OR abierta todavía.</div>';

  const repuestos = o.repuestos.length
    ? '<table class="grid anidada"><thead><tr>' +
        '<th>Repuesto</th><th class="num">Cant.</th><th>Paga</th><th>Pedido</th>' +
        '<th>En bodega</th><th>Entregado</th></tr></thead><tbody>' +
      o.repuestos.map((r) =>
        '<tr><td>' + esc(r.descripcion) + '</td>' +
        '<td class="num">' + (r.cantidad || 1) + '</td>' +
        '<td>' + esc(r.responsablePago || '—') + '</td>' +
        '<td class="num">' + (r.fechaSolicitud ? fFechaHora(r.fechaSolicitud) : '—') + '</td>' +
        '<td class="num">' + (r.fechaBodega ? fFechaHora(r.fechaBodega)
          : '<span style="color:var(--rojo)">por llegar</span>') + '</td>' +
        '<td class="num">' + (r.fechaEntregaArea ? fFechaHora(r.fechaEntregaArea) : '—') + '</td></tr>').join('') +
      '</tbody></table>'
    : '<div class="texto" style="color:var(--gris-2)">No requiere repuestos.</div>';

  return '<div class="detalle-ot">' + cabecera +
    '<div class="bloque"><h4>Presupuestos y OR' +
      (o.presupuestos.length > 1 ? ' <span class="et gris">' + o.presupuestos.length + '</span>' : '') +
      '</h4>' + presupuestos + '</div>' +
    '<div class="bloque"><h4>Repuestos' +
      (pend.length ? ' <span class="et roja">' + pend.length + ' por llegar</span>' : '') +
      '</h4>' + repuestos + '</div>' +
    '<div class="pie-detalle">Doble clic en la fila abre la orden completa en una pestaña nueva</div>' +
    '</div>';
}
