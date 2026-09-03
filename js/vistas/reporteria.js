/* REPORTERÍA — la tercera hoja del Histórico.

   Los gráficos se dibujan a mano en SVG: sin librerías, porque el modelo tiene que
   abrirse en el taller sin internet.

   Detalle y decisiones: 00 Documentacion/DECISIONES.md · js/vistas/reporteria.js */

/* 🔴 LA REPORTERÍA ARRANCA CON UN PERÍODO, Y ANTES NO (31-08-2026).

   Venía con las fechas en blanco, o sea «todo lo que haya en memoria». Y al
   arrancar, en memoria están sólo las 92 órdenes vivas — que no son entregadas,
   así que el informe quedaba hecho sobre el puñado que se entregó mientras
   alguien probaba. Se veían dos meses en un gráfico de doce años y nada decía
   que faltaba el resto.

   Doce meses es lo que se mira en una reunión, y además acota lo que hay que
   pedirle a la nube. Se puede cambiar en pantalla como siempre. */
function repDoceMeses() {
  /* ⚠️ `hoyEnChile()` devuelve TEXTO `AAAA-MM-DD`, no un Date — es lo que
     explica el bloque de `aMedianoche` en reglas.js, el mismo que costó que las
     92 órdenes mostraran un día menos. Los campos de fecha de esta pantalla
     también son texto, así que se resta el año sobre los tres números y no se
     construye ningún Date que pueda caer en la medianoche de Greenwich. */
  const hoy = (Reglas.hoyEnChile ? Reglas.hoyEnChile() : '') || '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(hoy);
  if (!m) return { desde: '', hasta: '' };
  return { desde: (Number(m[1]) - 1) + '-' + m[2] + '-' + m[3], hasta: hoy };
}

function repEstado() {
  if (!ui.reporteria) {
    const p = repDoceMeses();
    ui.reporteria = {
      desde: p.desde, hasta: p.hasta, compania_id: '',
      // La tabla dinámica: qué agrupa, qué abre y qué se suma.
      filas: 'compania', columnas: '', medida: 'ordenes'
    };
  }
  return ui.reporteria;
}

/* ═══ TRAER LO QUE EL PERÍODO NECESITA ══════════════════════════════════════

   Dos cosas que la pantalla no tiene al abrirse:

     1. LAS ÓRDENES ENTREGADAS. En memoria están las vivas. El histórico se baja
        una vez por sesión, igual que con «Ver todos».
     2. SUS ETAPAS. `ot_etapa` no la trae nadie —ver `etapasDe` en base.js— y sin
        ella los dos gráficos que abren la reparación etapa por etapa salen en
        blanco aunque el dato exista.

   ⚠️ EL TOPE SE DICE. Si el período abarca más órdenes de las que tiene sentido
   pedir, se avisa en pantalla. Un tope callado se lee como «esto es todo». */
const REP_TOPE_ETAPAS = 3000;
let repEstadoCarga = '';
let repPeriodoCargado = null;
let repHistoriaLista = false;
let repCargando = false;
let repDejadasFuera = 0;

function repAvisoDeCarga() { return repEstadoCarga; }
function repOrdenesSinEtapas() { return repDejadasFuera; }

async function repTraerLoDelPeriodo() {
  if (typeof Base === 'undefined' || !Base.conectada() || repCargando) return;
  const r = repEstado();
  const marca = r.desde + '|' + r.hasta + '|' + r.compania_id;
  if (repPeriodoCargado === marca) return;
  repCargando = true;
  try {
    if (!repHistoriaLista) {
      repEstadoCarga = 'Trayendo las órdenes entregadas…';
      if (typeof render === 'function') render();
      const t = await Base.historicoCompleto((n) => {
        repEstadoCarga = 'Trayendo las órdenes entregadas… ' + n.toLocaleString('es-CL');
      });
      Modelo.mezclarNube(t);
      repHistoriaLista = true;
    }
    /* Ahora sí: las del período, que es sobre lo que se va a informar. */
    const lista = repUniverso();
    const sinEtapas = lista.filter((o) => !(o.etapasAsignadas || []).length);
    repDejadasFuera = Math.max(0, sinEtapas.length - REP_TOPE_ETAPAS);
    const pide = sinEtapas.slice(0, REP_TOPE_ETAPAS);
    if (pide.length) {
      repEstadoCarga = 'Trayendo las etapas de ' + pide.length.toLocaleString('es-CL') + ' órdenes…';
      if (typeof render === 'function') render();
      const ot_etapa = await Base.etapasDe(pide);
      Modelo.mezclarNube({ ot_etapa });
    }
    repPeriodoCargado = marca;
    repEstadoCarga = '';
  } catch (e) {
    repEstadoCarga = 'No se pudieron traer los datos del período: ' +
      ((e && e.message) || 'sin conexión');
  }
  repCargando = false;
  if (typeof render === 'function') render();
}

const REP_DIMENSIONES = [
  { id: 'compania', rot: 'Compañía',       de: (o) => o.compania === '—' ? 'Particular' : o.compania },
  { id: 'marca',    rot: 'Marca',          de: (o) => o.marca || 'Sin marca' },
  { id: 'modelo',   rot: 'Modelo',         de: (o) => o.modelo || 'Sin modelo' },
  { id: 'estado',   rot: 'Estado de cierre', de: (o) => o.estadoNombre },
  { id: 'tipo',     rot: 'Tipo de ingreso', de: (o) => o.origenIngresoNombre || 'Sin tipo' },
  { id: 'cliente',  rot: 'Cliente',        de: (o) => o.cliente },
  { id: 'mes',      rot: 'Mes de entrega', de: (o) => repMes(o.fechaEntrega) },
  { id: 'meta',     rot: 'Cumplió la meta', de: (o) =>
      o.diasReparacion <= Modelo.metricas().metaDias ? 'Dentro de la meta' : 'Sobre la meta' }
];

/* ⚠️ Los formatos van ENVUELTOS en una función, no puestos por referencia.
   `fmt: fMonto` parece más limpio y revienta: `fMonto` vive en `app.js`, que se
   carga al final —tiene que ser el último, porque al cargar ya pinta—, así que
   al evaluar esta constante todavía no existe. El error se come el resto del
   archivo y la pantalla queda en blanco sin decir por qué. Envuelto, la
   búsqueda del nombre ocurre recién cuando se usa. */
const REP_MEDIDAS = [
  { id: 'ordenes',  rot: 'Órdenes',              valor: () => 1,                         fmt: (n) => String(n),  suma: true },
  { id: 'venta',    rot: 'Venta total',          valor: (o) => plataDe(o).ventaTotal,    fmt: (n) => fMonto(n),  suma: true },
  { id: 'ventaProm', rot: 'Venta promedio',      valor: (o) => plataDe(o).ventaTotal,    fmt: (n) => fMonto(n),  suma: false },
  { id: 'dias',     rot: 'Días totales (prom.)', valor: (o) => o.diasTotales,            fmt: (n) => Math.round(n) + ' d', suma: false },
  { id: 'reparacion', rot: 'Días de reparación (prom.)', valor: (o) => o.diasReparacion, fmt: (n) => Math.round(n) + ' d', suma: false }
];

const REP_MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function repMes(f) {
  if (!f) return 'Sin fecha';
  return f.getFullYear() + '-' + String(f.getMonth() + 1).padStart(2, '0');
}
const repMesCorto = (clave) => {
  const p = String(clave).split('-');
  return p.length === 2 ? REP_MESES[Number(p[1]) - 1] + ' ' + p[0].slice(2) : clave;
};

/* Plata abreviada para los ejes. `fMonto` escribe "$29.199.800", que en el eje
   de un gráfico se monta con el número de al lado y deja de leerse. Acá el eje
   dice "$29,2M" y el valor exacto vive en el globo al pasar el mouse: se pierde
   precisión donde estorba y se conserva donde se necesita. */
function repPlataCorta(n) {
  const v = Number(n) || 0;
  const signo = v < 0 ? '-' : '';
  const a = Math.abs(v);
  /* Un decimal hasta los cien millones. Con el corte en diez, la fórmula de la
     venta salía «$15M + $9,9M + $1,5M = $26.392.000» y ese $15M contra un
     $14.907.000 se lee como un error de suma. La gracia de mostrar la fórmula
     es que cuadre a ojo. */
  if (a >= 1000000) return signo + '$' + (a / 1000000).toFixed(a >= 100000000 ? 0 : 1).replace('.', ',') + 'M';
  if (a >= 1000) return signo + '$' + Math.round(a / 1000) + 'k';
  return signo + '$' + Math.round(a);
}
const repMiles = (n) => Math.round(Number(n) || 0).toLocaleString('es-CL');

/* El universo del panel: las órdenes ya entregadas, recortadas por el período
   y la compañía. Se usa el mismo `Modelo.historico` que el buscador para que
   los dos digan lo mismo. */
let repCacheLlave = null;
let repCacheLista = null;

function repUniverso() {
  const r = repEstado();
  /* La llave: la versión de los datos más lo que define el período. Si no
     cambió ninguna, la lista es la misma y no hay nada que recalcular. */
  const llave = (Modelo.versionMemo ? Modelo.versionMemo() : 0) + '|' +
    r.desde + '|' + r.hasta + '|' + r.compania_id;
  if (repCacheLlave === llave && repCacheLista) return repCacheLista;
  /* Las fechas van al modelo, no sólo al filtro de acá abajo: allá recortan
     ANTES de armar la vista de cada orden, que es la parte cara. El filtro de
     abajo se queda igual — es el que decide de verdad, y no depende de que el
     modelo entienda el período. */
  const desde = r.desde
    ? (function () { const [a, m, d] = r.desde.split('-').map(Number); return new Date(a, m - 1, d); })()
    : null;
  const hasta = r.hasta
    ? (function () { const [a, m, d] = r.hasta.split('-').map(Number); return new Date(a, m - 1, d, 23, 59, 59); })()
    : null;
  const f = { todo: true, entregada_desde: desde, entregada_hasta: hasta };
  let lista = Modelo.historico(f);
  if (desde) lista = lista.filter((o) => o.fechaEntrega && o.fechaEntrega >= desde);
  if (hasta) lista = lista.filter((o) => o.fechaEntrega && o.fechaEntrega <= hasta);
  if (r.compania_id) lista = lista.filter((o) => o.companiaId === r.compania_id);
  repCacheLlave = llave; repCacheLista = lista;
  return lista;
}

/* ═══════════ LOS GRÁFICOS, EN SVG ═══════════

   ⚠️ SIN `preserveAspectRatio="none"`, y ésa era la falla original.

   Con `none` el navegador estira el dibujo hasta llenar el ancho disponible, y
   estira TODO con él: la tipografía queda deformada, la línea de la meta se
   engorda y las barras se vuelven bloques. En una pantalla de 1600 px el SVG
   de 720 se estiraba más del doble a lo ancho y nada a lo alto.

   El `viewBox` sale en la proporción en que se va a ver y el escalado es
   proporcional —el que trae el SVG por omisión—, con `height:auto` en el CSS.
   El alto cambia con el ancho, que es exactamente lo que uno quiere de un
   gráfico que vive en una pantalla que se puede achicar.

   ⚠️ Y CADA DEGRADADO NECESITA UN `id` PROPIO. Los `id` de un SVG son globales
   al documento, no locales al dibujo: dos gráficos con `id="area"` hacen que
   el segundo pinte con el degradado del primero. Con seis gráficos en la misma
   pantalla eso se ve como colores que "se contagian" y cuesta muchísimo de
   diagnosticar. `repId()` lleva un contador y no se repite nunca. */
let repSecuenciaId = 0;
const repId = (p) => 'rep-' + p + '-' + (++repSecuenciaId);

const repRedondo = (n) => Math.round(Number(n) * 10) / 10;

/* Curva suave por los puntos (Catmull-Rom convertido a Bézier cúbica). Los
   puntos de control se recortan contra el marco del gráfico: sin recortar, una
   subida brusca hace que la curva se pase para abajo del cero y dibuje días
   negativos, que en un gráfico de días es una mentira lisa y llana. */
function repCurva(pts, arriba, abajo) {
  if (!pts.length) return '';
  if (pts.length === 1) return 'M' + repRedondo(pts[0][0]) + ' ' + repRedondo(pts[0][1]);
  const limitar = (y) => Math.min(abajo, Math.max(arriba, y));
  let d = 'M' + repRedondo(pts[0][0]) + ' ' + repRedondo(pts[0][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || pts[i + 1];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, limitar(p1[1] + (p2[1] - p0[1]) / 6)];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, limitar(p2[1] - (p3[1] - p1[1]) / 6)];
    d += ' C' + repRedondo(c1[0]) + ' ' + repRedondo(c1[1]) + ',' +
         repRedondo(c2[0]) + ' ' + repRedondo(c2[1]) + ',' +
         repRedondo(p2[0]) + ' ' + repRedondo(p2[1]);
  }
  return d;
}

/* La escala del eje vertical, con cortes redondos. Un eje que dice 0 · 17,5 ·
   35 · 52,5 se lee peor que uno que dice 0 · 20 · 40 · 60, aunque el segundo
   deje más aire arriba. */
function repEscala(max) {
  const m = Math.max(1, max);
  const bruto = m / 4;
  const exp = Math.pow(10, Math.floor(Math.log(bruto) / Math.LN10));
  const paso = [1, 2, 2.5, 5, 10].map((x) => x * exp).find((x) => x >= bruto) || exp * 10;
  return { tope: Math.ceil(m / paso) * paso, paso };
}

/* ── El gráfico de área ────────────────────────────────────────────────
   Serie de tiempo con relleno degradado, curva suave, puntos, banda de meta y
   eje con cortes. Es el que reemplazó a las barras del "días por mes": una
   serie mensual es una TENDENCIA, y una tendencia se lee en una línea. */
/* ⚠️ `compacto` NO ES UN ESTILO, ES LEGIBILIDAD. El texto de un SVG se mide en
   unidades del `viewBox`, así que un gráfico de 1200 unidades metido en un
   panel de media pantalla —unos 560 píxeles— encoge TODO a menos de la mitad:
   los 10,5 px del valor sobre la barra terminaban en 5 px reales y el eje de
   la venta no se podía leer. Con el viewBox a la mitad, la misma tipografía
   vuelve a su tamaño. Va en los paneles de dos columnas. */
function svgSerie(datos, op) {
  const o = op || {};
  const idA = repId('area'), idL = repId('linea'), idC = repId('rec');
  const W = o.compacto ? 620 : 1200, H = o.compacto ? 300 : 340;
  const IZQ = o.compacto ? 52 : 62, DER = 18, TOP = 26, PIE = 34;
  const base = H - PIE, techo = TOP;
  const fmt = o.fmt || ((v) => repMiles(v));

  if (!datos.length) return '<svg class="graf" viewBox="0 0 ' + W + ' ' + H + '"></svg>';

  const esc0 = repEscala(Math.max(o.meta || 0, ...datos.map((d) => d.v)) * 1.12);
  const y = (v) => base - (base - techo) * (v / (esc0.tope || 1));
  const n = datos.length;
  const x = (i) => n === 1 ? (IZQ + (W - DER - IZQ) / 2)
    : IZQ + (W - DER - IZQ) * (i / (n - 1));
  const pts = datos.map((d, i) => [x(i), y(d.v)]);
  const curva = repCurva(pts, techo - 4, base);

  const cortes = [];
  for (let v = 0; v <= esc0.tope + 0.0001; v += esc0.paso) cortes.push(v);
  // El color de la línea sigue a la meta: donde el mes se pasa, el morado vira
  // a vino. Un stop por punto, y dos stops pegados en el cruce para que el
  // cambio se vea como un corte y no como un degradado sucio.
  const sobre = (v) => !!(o.meta && v > o.meta);
  const clsDe = (v) => sobre(v) ? 'sobre' : 'bajo';
  const off = (i) => n === 1 ? 0 : (i / (n - 1)) * 100;
  const stopsLinea = (() => {
    if (!o.meta) return '<stop offset="0%" class="ini"/><stop offset="100%" class="fin"/>';
    let s = '';
    for (let i = 0; i < n; i++) {
      if (i > 0 && sobre(datos[i - 1].v) !== sobre(datos[i].v)) {
        // Cruce entre dos puntos: interpolo dónde la recta corta la meta y
        // pongo el corte de color justo ahí.
        const a = datos[i - 1].v, b = datos[i].v;
        const t = (o.meta - a) / (b - a);
        const oc = (off(i - 1) + (off(i) - off(i - 1)) * t).toFixed(2);
        s += '<stop offset="' + oc + '%" class="' + clsDe(a) + '"/>' +
             '<stop offset="' + oc + '%" class="' + clsDe(b) + '"/>';
      }
      s += '<stop offset="' + off(i).toFixed(2) + '%" class="' + clsDe(datos[i].v) + '"/>';
    }
    return s;
  })();

  /* ── EL RELLENO TAMBIÉN CAMBIA EN LA META ─────────────────────────────
     Pedido de Marco el 21-08-2026: *"el fondo del gráfico, si pasa los 15
     días, que quede rojito, no tan agresivo"*. La línea ya viraba a vino; lo
     que faltaba era el área.

     ⚠️ El degradado va en `userSpaceOnUse` y NO en el sistema por omisión.
     Con el de omisión —`objectBoundingBox`— los porcentajes se miden sobre la
     caja del PATH, que es sólo el área pintada y cambia de alto con los datos:
     el corte de color quedaría en una altura distinta en cada gráfico y nunca
     sobre la meta. En coordenadas del SVG, la fracción se calcula una vez
     contra la misma escala del eje y cae exactamente en la línea.

     Dos stops pegados en la misma fracción hacen el corte limpio; con uno solo
     el vino se desvanecería sobre el morado y se vería como una mancha. */
  const fMeta = o.meta
    ? Math.min(0.999, Math.max(0.001, (y(o.meta) - techo) / (base - techo)))
    : 0;
  const gradArea = o.meta
    ? ' gradientUnits="userSpaceOnUse" x1="0" y1="' + techo + '" x2="0" y2="' + base + '">' +
      '<stop offset="0" class="areaAlta"/>' +
      '<stop offset="' + fMeta.toFixed(4) + '" class="areaAltaFin"/>' +
      '<stop offset="' + fMeta.toFixed(4) + '" class="areaTope"/>' +
      '<stop offset="1" class="fondo"/>'
    : ' x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" class="tope"/><stop offset="100%" class="fondo"/>';

  return '<svg class="graf serie" viewBox="0 0 ' + W + ' ' + H + '">' +
    '<defs>' +
      '<linearGradient id="' + idA + '"' + gradArea + '</linearGradient>' +
      '<linearGradient id="' + idL + '" x1="0" y1="0" x2="1" y2="0">' +
        stopsLinea + '</linearGradient>' +
      '<clipPath id="' + idC + '"><rect x="' + IZQ + '" y="' + (techo - 6) +
        '" width="' + (W - DER - IZQ) + '" height="' + (base - techo + 6) + '"/></clipPath>' +
    '</defs>' +

    // La banda de la meta: todo lo que está POR DEBAJO es cumplir. Una banda
    // dice "esta zona está bien" mejor que una línea suelta.
    (o.meta ? '<rect x="' + IZQ + '" y="' + y(o.meta) + '" width="' + (W - DER - IZQ) +
      '" height="' + Math.max(0, base - y(o.meta)) + '" class="graf-banda"/>' : '') +

    // Cortes del eje, con su número a la izquierda.
    cortes.map((v) => '<line x1="' + IZQ + '" x2="' + (W - DER) + '" y1="' + y(v) +
      '" y2="' + y(v) + '" class="graf-guia"/>' +
      '<text x="' + (IZQ - 9) + '" y="' + (y(v) + 3.5) + '" class="graf-eje-y">' +
      esc(fmt(v)) + '</text>').join('') +

    '<g clip-path="url(#' + idC + ')">' +
      '<path d="' + curva + ' L' + repRedondo(pts[n - 1][0]) + ' ' + base +
        ' L' + repRedondo(pts[0][0]) + ' ' + base + ' Z" fill="url(#' + idA + ')" class="graf-area"/>' +
      '<path d="' + curva + '" stroke="url(#' + idL + ')" class="graf-linea"/>' +
    '</g>' +

    (o.meta ? '<line x1="' + IZQ + '" x2="' + (W - DER) + '" y1="' + y(o.meta) + '" y2="' +
      y(o.meta) + '" class="graf-meta"/>' +
      '<text x="' + (W - DER - 4) + '" y="' + (y(o.meta) - 7) +
      '" class="graf-meta-rot" text-anchor="end">meta ' + esc(String(o.meta)) +
      (o.metaRot ? ' ' + esc(o.metaRot) : '') + '</text>' : '') +

    // Los puntos. El que se pasó de la meta queda rojo: se ve el mes malo sin
    // tener que leer el eje.
    datos.map((d, i) => {
      const malo = o.meta && d.v > o.meta;
      return '<circle cx="' + repRedondo(x(i)) + '" cy="' + repRedondo(y(d.v)) +
        '" r="' + (n > 18 ? 3 : 4.5) + '" class="graf-punto' + (malo ? ' alerta' : '') +
        '" data-tip="' + esc(d.etiqueta + ' · ' + d.rot) + '"><title>' +
        esc(d.etiqueta + ': ' + d.rot) + '</title></circle>' +
        (n <= 16 ? '<text x="' + repRedondo(x(i)) + '" y="' + repRedondo(y(d.v) - 13) +
          '" class="graf-valor">' + esc(d.corto != null ? d.corto : d.rot) + '</text>' : '');
    }).join('') +

    datos.map((d, i) => (n <= 26 || i % 2 === 0)
      ? '<text x="' + repRedondo(x(i)) + '" y="' + (H - 11) + '" class="graf-eje">' +
        esc(d.etiqueta || d.k) + '</text>' : '').join('') +
    '</svg>';
}

/* ── Barras verticales ─────────────────────────────────────────────────
   Para conteos por período, donde cada barra es una cosa aparte y no una
   tendencia. Con eje, degradado y tope redondeado. `op.marca` pone una línea
   de referencia (la usa el histograma para marcar la meta). */
function svgBarras(datos, op) {
  const o = op || {};
  const idB = repId('barra'), idAl = repId('barra-al');
  const W = o.compacto ? 620 : 1200, H = o.compacto ? 300 : 320;
  const IZQ = o.compacto ? 52 : 62, DER = 18, TOP = 26, PIE = 34;
  const base = H - PIE, techo = TOP;
  const fmt = o.fmt || ((v) => repMiles(v));
  if (!datos.length) return '<svg class="graf" viewBox="0 0 ' + W + ' ' + H + '"></svg>';

  const esc0 = repEscala(Math.max(o.meta || 0, ...datos.map((d) => d.v)) * 1.12);
  const y = (v) => base - (base - techo) * (v / (esc0.tope || 1));
  const n = datos.length;
  const paso = (W - DER - IZQ) / n;
  const w = Math.min(paso * 0.62, 74);
  const radio = Math.min(4, w / 2);
  const cortes = [];
  for (let v = 0; v <= esc0.tope + 0.0001; v += esc0.paso) cortes.push(v);

  return '<svg class="graf" viewBox="0 0 ' + W + ' ' + H + '">' +
    '<defs>' +
      '<linearGradient id="' + idB + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" class="tope"/><stop offset="100%" class="fondo"/></linearGradient>' +
      '<linearGradient id="' + idAl + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" class="tope"/><stop offset="100%" class="fondo"/></linearGradient>' +
    '</defs>' +
    cortes.map((v) => '<line x1="' + IZQ + '" x2="' + (W - DER) + '" y1="' + y(v) +
      '" y2="' + y(v) + '" class="graf-guia"/>' +
      '<text x="' + (IZQ - 9) + '" y="' + (y(v) + 3.5) + '" class="graf-eje-y">' +
      esc(fmt(v)) + '</text>').join('') +
    datos.map((d, i) => {
      const cx = IZQ + paso * i + paso / 2;
      const yy = y(d.v);
      const h = Math.max(base - yy, 1.5);
      return '<rect x="' + repRedondo(cx - w / 2) + '" y="' + repRedondo(yy) + '" width="' + repRedondo(w) +
        '" height="' + repRedondo(h) + '" rx="' + radio + '" fill="url(#' + (d.alerta ? idAl : idB) +
        ')" class="graf-barra' + (d.alerta ? ' alerta' : '') +
        '" data-tip="' + esc(d.etiqueta + ' · ' + d.rot) + '"><title>' +
        esc((d.etiqueta || d.k) + ': ' + d.rot) + '</title></rect>' +
        (n <= 20 ? '<text x="' + repRedondo(cx) + '" y="' + repRedondo(yy - 6) +
          '" class="graf-valor">' + esc(d.corto != null ? d.corto : d.rot) + '</text>' : '') +
        (n <= 30 ? '<text x="' + repRedondo(cx) + '" y="' + (H - 11) + '" class="graf-eje">' +
          esc(d.etiqueta || d.k) + '</text>' : '');
    }).join('') +
    /* El rótulo de la meta va al EXTREMO DERECHO. A la izquierda se montaba
       encima del número de la primera barra —se leía "meta 15 dí15"— y un
       gráfico que se lee mal miente igual que un dato equivocado. */
    (o.meta ? '<line x1="' + IZQ + '" x2="' + (W - DER) + '" y1="' + y(o.meta) + '" y2="' +
      y(o.meta) + '" class="graf-meta"/>' +
      '<text x="' + (W - DER - 4) + '" y="' + (y(o.meta) - 7) +
      '" class="graf-meta-rot" text-anchor="end">meta ' + esc(String(o.meta)) +
      (o.metaRot ? ' ' + esc(o.metaRot) : '') + '</text>' : '') +
    (o.marcaX != null ? '<line x1="' + repRedondo(IZQ + paso * o.marcaX) + '" x2="' +
      repRedondo(IZQ + paso * o.marcaX) + '" y1="' + techo + '" y2="' + base + '" class="graf-meta"/>' +
      '<text x="' + repRedondo(IZQ + paso * o.marcaX + 6) + '" y="' + (techo + 10) +
      '" class="graf-meta-rot">' + esc(o.marcaRot || '') + '</text>' : '') +
    '</svg>';
}

/* ── El anillo ─────────────────────────────────────────────────────────
   Composición: tres o cuatro partes de un total, con el total al centro. Se usa
   sólo donde las partes SUMAN el total — un anillo cuyas partes no suman es el
   gráfico más mentiroso que hay. */
function svgAnillo(partes, op) {
  const o = op || {};
  const vivas = partes.filter((p) => p.v > 0);
  const total = vivas.reduce((s, p) => s + p.v, 0);
  const R = 82, r = 54, C = 96;
  const fmt = o.fmt || ((v) => repMiles(v));

  const arco = (desde, hasta, clase, tip) => {
    const a0 = -Math.PI / 2 + Math.PI * 2 * desde;
    const a1 = -Math.PI / 2 + Math.PI * 2 * hasta;
    const grande = (hasta - desde) > 0.5 ? 1 : 0;
    const p = (a, rad) => repRedondo(C + rad * Math.cos(a)) + ' ' + repRedondo(C + rad * Math.sin(a));
    return '<path d="M' + p(a0, R) + ' A' + R + ' ' + R + ' 0 ' + grande + ' 1 ' + p(a1, R) +
      ' L' + p(a1, r) + ' A' + r + ' ' + r + ' 0 ' + grande + ' 0 ' + p(a0, r) + ' Z" class="' + clase +
      '" data-tip="' + esc(tip) + '"><title>' + esc(tip) + '</title></path>';
  };

  let acumulado = 0;
  const trozos = !total ? ''
    : vivas.length === 1
      /* Una sola parte es un anillo completo, y un arco de 360° empieza y
         termina en el mismo punto: el navegador dibuja NADA. Se parte en dos
         medios arcos. */
      ? arco(0, 0.5, 'anillo-' + vivas[0].tono, vivas[0].k + ': ' + fmt(vivas[0].v)) +
        arco(0.5, 1, 'anillo-' + vivas[0].tono, vivas[0].k + ': ' + fmt(vivas[0].v))
      : vivas.map((p) => {
          const desde = acumulado / total;
          acumulado += p.v;
          return arco(desde, acumulado / total, 'anillo-' + p.tono,
            p.k + ': ' + fmt(p.v) + ' · ' + Math.round((p.v / total) * 100) + '%');
        }).join('');

  return '<div class="anillo-caja">' +
    '<svg class="graf anillo" viewBox="0 0 192 192">' +
      '<circle cx="' + C + '" cy="' + C + '" r="' + ((R + r) / 2) + '" class="anillo-pista" ' +
        'stroke-width="' + (R - r) + '" fill="none"/>' + trozos +
      '<text x="' + C + '" y="' + (C - 3) + '" class="anillo-total">' + esc(o.centro || fmt(total)) + '</text>' +
      '<text x="' + C + '" y="' + (C + 14) + '" class="anillo-rot">' + esc(o.centroRot || 'total') + '</text>' +
    '</svg>' +
    '<div class="anillo-leyenda">' + partes.map((p) => '<div class="ley">' +
      '<span class="punto ' + p.tono + '"></span>' +
      '<span class="nom">' + esc(p.k) + '</span>' +
      '<span class="cif">' + esc(fmt(p.v)) + '</span>' +
      '<span class="pct">' + (total ? Math.round((p.v / total) * 100) : 0) + '%</span></div>').join('') +
    '</div></div>';
}

/* ── La barra apilada ──────────────────────────────────────────────────
   En HTML y no en SVG a propósito: los rótulos son texto largo que tiene que
   poder cortarse solo cuando la pantalla se angosta, y eso el texto de un SVG
   no lo hace. Se usa para el desglose de días por etapa y para el corte de los
   tres relojes. */
function repApilada(partes, op) {
  const o = op || {};
  const total = partes.reduce((s, p) => s + p.v, 0) || 1;
  return '<div class="apilada">' +
    '<div class="pista">' + partes.map((p) => {
      const pct = (p.v / total) * 100;
      return '<span class="tramo ' + (p.tono || '') + '" style="width:' + repRedondo(pct) + '%' +
        (p.color ? ';background:' + esc(p.color) : '') + '" title="' + esc(p.k + ': ' + (o.fmt ? o.fmt(p.v) : p.v)) +
        '" data-tip="' + esc(p.k + ' · ' + (o.fmt ? o.fmt(p.v) : p.v) + ' · ' + Math.round(pct) + '%') + '">' +
        (pct >= 7 ? '<span class="dentro">' + esc(o.fmt ? o.fmt(p.v) : String(p.v)) + '</span>' : '') +
        '</span>';
    }).join('') + '</div>' +
    '<div class="apilada-leyenda">' + partes.map((p) => '<span class="ley">' +
      '<span class="punto ' + (p.tono || '') + '"' + (p.color ? ' style="background:' + esc(p.color) + '"' : '') +
      '></span>' + esc(p.k) + ' <b>' + esc(o.fmt ? o.fmt(p.v) : String(p.v)) + '</b>' +
      ' <i>' + Math.round((p.v / total) * 100) + '%</i></span>').join('') + '</div></div>';
}

/* Barras horizontales: para rankings, donde el rótulo es largo y el número
   importa tanto como la comparación. Lleva el puesto adelante — en un ranking
   el orden es la mitad de la información. */
function svgBarrasH(datos, op) {
  const o = op || {};
  const max = Math.max(1, ...datos.map((d) => d.v));
  if (!datos.length) return '<div class="vacio-chico">Sin datos en el período</div>';
  return '<div class="barrasH">' + datos.map((d, i) => {
    const p = Math.max(1.5, (d.v / max) * 100);
    /* ⚠️ UN SOLO atributo `style`. Escrito en dos —uno para el ancho y otro
       para el color— el navegador se queda con el primero y descarta el
       segundo sin avisar: las barras salían todas del mismo color y no había
       ningún error en la consola que lo delatara. */
    const estilo = 'width:' + repRedondo(p) + '%' + (d.color ? ';background:' + esc(d.color) : '');
    return '<div class="fila-barra' + (o.destacar && i === 0 ? ' primero' : '') + '">' +
      '<span class="puesto">' + (i + 1) + '</span>' +
      '<span class="rot" title="' + esc(d.k) + '">' + esc(d.k) + '</span>' +
      '<span class="pista"><span class="relleno" style="' + estilo + '"' +
        ' data-tip="' + esc(d.k + ' · ' + d.rot) + '"></span></span>' +
      '<span class="val">' + esc(d.rot) + '</span></div>';
  }).join('') + '</div>';
}

/* La chispa de las tarjetas: la serie del mes a mes, del porte de una palabra.
   No lleva eje ni números — no es para leer valores, es para ver la forma. */
function svgChispa(vals, op) {
  const o = op || {};
  if (!vals || vals.length < 2) return '<svg class="chispa" viewBox="0 0 120 30"></svg>';
  const idA = repId('chispa');
  const max = Math.max(...vals), min = Math.min(...vals);
  const rango = (max - min) || 1;
  const W = 120, H = 30, M = 3;
  const x = (i) => (W * i) / (vals.length - 1);
  const y = (v) => H - M - (H - M * 2) * ((v - min) / rango);
  const pts = vals.map((v, i) => [x(i), y(v)]);
  const curva = repCurva(pts, M, H - M);
  return '<svg class="chispa ' + (o.tono || '') + '" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
    '<defs><linearGradient id="' + idA + '" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" class="tope"/><stop offset="100%" class="fondo"/></linearGradient></defs>' +
    '<path d="' + curva + ' L' + repRedondo(W) + ' ' + H + ' L0 ' + H + ' Z" fill="url(#' + idA + ')"/>' +
    '<path d="' + curva + '" class="chispa-linea"/>' +
    '<circle cx="' + repRedondo(x(vals.length - 1)) + '" cy="' + repRedondo(y(vals[vals.length - 1])) +
    '" r="2.6" class="chispa-punto"/></svg>';
}

/* ── LA FÓRMULA, NO LA EXPLICACIÓN ─────────────────────────────────────
   Pedido de Marco el 21-08-2026, mirando la cinta que decía «el último mes va
   en curso: lleva 12 de 31 días, su barra es más baja porque el mes no
   terminó»: *"en vez de este tipo de textos colocar el cómo se calculó /
   fórmula"*. Y agregó: *"resumido, preciso"*.

   Tiene razón, y es más que estética. Un párrafo explicando un número PIDE que
   le crean; una fórmula con sus números adentro SE VERIFICA con una
   calculadora. En una reunión donde la primera pregunta es «¿de dónde sale ese
   número?», lo segundo es lo único que sirve.

   Cada fila es UNA línea: qué se calcula, la expresión, la expresión con los
   números de este período, y el resultado. Nada de prosa — si hace falta un
   párrafo para justificar un número, el número está mal elegido. */
function repFormulas(filas, op) {
  const o = op || {};
  return '<div class="formulas' + (o.clase ? ' ' + o.clase : '') + '">' +
    '<div class="tit-f">' + esc(o.titulo || 'Cómo se calcula') + '</div>' +
    filas.filter(Boolean).map((f) => '<div class="f">' +
      '<span class="que">' + esc(f.que) + '</span>' +
      '<span class="exp">' + esc(f.exp) + '</span>' +
      '<span class="num">' + esc(f.num) + '</span>' +
      '</div>').join('') + '</div>';
}

/* La flecha del delta. Dibujada, no un emoji: el sistema entero está sin
   emoji y además un carácter de emoji se imprime distinto en cada
   computador. */
function repFlecha(sube) {
  return '<svg class="flecha-delta" viewBox="0 0 10 10" aria-hidden="true">' +
    (sube ? '<path d="M5 1 L9 7 H1 Z"/>' : '<path d="M5 9 L1 3 H9 Z"/>') + '</svg>';
}

/* Una tarjeta de indicador: cifra grande, chispa del mes a mes y el cambio
   contra el mes anterior. `bueno` dice para qué lado es bueno que se mueva —
   sin eso, "reparación promedio +12%" se pintaría de verde. */
function repTarjeta(t) {
  const hayDelta = t.delta != null && isFinite(t.delta) && t.serie && t.serie.length >= 2;
  const sube = t.delta > 0;
  const bien = t.bueno === 'bajo' ? !sube : sube;
  const clase = !hayDelta || Math.abs(t.delta) < 0.5 ? 'neutro' : (bien ? 'bien' : 'mal');
  return '<div class="tarjeta-kpi' + (t.clase ? ' ' + t.clase : '') + '">' +
    '<div class="rot">' + esc(t.rot) + '</div>' +
    '<div class="val' + (t.chico ? ' chico' : '') + '">' + esc(t.val) + '</div>' +
    '<div class="sub">' + esc(t.sub) + '</div>' +
    '<div class="pie-kpi">' +
      (hayDelta ? '<span class="delta ' + clase + '">' + repFlecha(sube) +
        Math.abs(Math.round(t.delta)) + '%</span><span class="delta-rot">' +
        esc(t.rotDelta || 'vs. mes anterior') + '</span>'
        : '<span class="delta-rot">' + esc(t.notaDelta || 'sin mes anterior con que comparar') + '</span>') +
    '</div>' +
    '<div class="chispa-caja">' + svgChispa(t.serie, { tono: t.tono }) + '</div>' +
    '</div>';
}

/* ═══════════ LA TABLA DINÁMICA ═══════════
   Agrupa por una dimensión, opcionalmente abre por otra, y suma o promedia la
   medida elegida. Los totales van en el margen, como en cualquier planilla. */
function repDinamica(lista) {
  const r = repEstado();
  const dimF = REP_DIMENSIONES.find((d) => d.id === r.filas) || REP_DIMENSIONES[0];
  const dimC = r.columnas ? REP_DIMENSIONES.find((d) => d.id === r.columnas) : null;
  const med = REP_MEDIDAS.find((m) => m.id === r.medida) || REP_MEDIDAS[0];

  const celdas = new Map();   // "fila|columna" → { s: suma, n: cuenta }
  const filas = new Map(), columnas = new Map();
  const acumular = (mapa, k, v) => {
    const c = mapa.get(k) || { s: 0, n: 0 };
    c.s += v; c.n++; mapa.set(k, c);
  };

  lista.forEach((o) => {
    const f = dimF.de(o);
    const c = dimC ? dimC.de(o) : '—';
    const v = med.valor(o);
    acumular(celdas, f + '|' + c, v);
    acumular(filas, f, v);
    acumular(columnas, c, v);
  });

  const valor = (c) => (!c || !c.n) ? null : (med.suma ? c.s : c.s / c.n);
  const orden = (m) => [...m.entries()].sort((a, b) => {
    // Los meses se ordenan por fecha; el resto, por el valor de mayor a menor.
    if (dimF.id === 'mes' || dimC && dimC.id === 'mes') return String(a[0]).localeCompare(String(b[0]));
    return (valor(b[1]) || 0) - (valor(a[1]) || 0);
  });

  const todasLasFilas = orden(filas);
  const todasLasCols = dimC ? orden(columnas) : [['—', null]];
  return { dimF, dimC, med, celdas, valor,
    /* Cuántas HABÍA antes de cortar: la pantalla lo necesita para poder decir
       que está cortada en vez de mostrar cuarenta filas como si fueran todas. */
    cuantasFilas: todasLasFilas.length, cuantasColumnas: todasLasCols.length,
    filasOrd: todasLasFilas.slice(0, 40), columnasOrd: dimC ? todasLasCols.slice(0, 12) : [['—', null]],
    totalGeneral: valor([...lista].reduce((acc, o) => {
      acc.s += med.valor(o); acc.n++; return acc;
    }, { s: 0, n: 0 })) };
}

/* ═══════════ LOS AGREGADOS ═══════════
   Todas las cuentas del panel, en un solo lugar. Los usan la PANTALLA y el PDF:
   si cada uno los calculara por su cuenta, el día que se toque uno el papel y
   la pantalla empezarían a decir cosas distintas — y en un reporte ése es el
   peor defecto posible. */
function repAgregados(lista, meta) {
  const dimDe = (id) => REP_DIMENSIONES.find((d) => d.id === id);
  const MS_DIA = 86400000;

  /* Un solo recorrido junta todo lo del mes: cuántas salieron, cuántos días
     tardaron, cuánta plata, cuántas cumplieron. Con esto se arman la serie de
     días, la de entregas, la de venta, la de ticket y la de cumplimiento sin
     volver a barrer la lista cinco veces. */
  const porMes = new Map();
  lista.forEach((o) => {
    const k = repMes(o.fechaEntrega);
    const c = porMes.get(k) || { n: 0, dias: 0, venta: 0, dentro: 0 };
    c.n++; c.dias += o.diasReparacion; c.venta += plataDe(o).ventaTotal;
    if (o.diasReparacion <= meta) c.dentro++;
    porMes.set(k, c);
  });
  const meses = [...porMes.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))).slice(-12);

  /* 🔴 EL MES EN CURSO NO SE COMPARA CONTRA UN MES COMPLETO.

     Se vio en la primera versión del panel y era vergonzoso: las tarjetas
     decían «−65% vs. mes anterior» en órdenes, «−61%» en venta y «−100%» en
     cumplimiento. No había pasado nada — agosto llevaba veinte días de treinta
     y uno, y se estaba comparando veinte días contra un mes entero.

     Un indicador que grita una caída inventada quema la credibilidad de todo
     el panel: la primera vez el dueño se asusta, y la segunda ya no le cree a
     ninguna cifra. Las series y los deltas usan MESES CERRADOS. El mes en
     curso sigue estando en los gráficos y en los totales —es dato de verdad—,
     pero rotulado, para que su bajón no se lea como una tendencia. */
  const mesEnCurso = repMes(HOY);
  const hayMesEnCurso = meses.some(([k]) => k === mesEnCurso);
  const cerrados = meses.filter(([k]) => k !== mesEnCurso);

  const serie = (saca) => cerrados.map(([, c]) => saca(c));
  const delta = (vals) => {
    if (vals.length < 2) return null;
    const b = vals[vals.length - 2], a = vals[vals.length - 1];
    if (!b) return null;
    return ((a - b) / Math.abs(b)) * 100;
  };
  // Cuántos días lleva el mes en curso, para poder decirlo sin estimar nada.
  const diasDelMes = new Date(HOY.getFullYear(), HOY.getMonth() + 1, 0).getDate();
  const notaMesEnCurso = hayMesEnCurso
    ? repMesCorto(mesEnCurso) + ' en curso: ' + HOY.getDate() + '/' + diasDelMes + ' d'
    : '';

  const top = (dim, n) => {
    const m = new Map();
    lista.forEach((o) => { const k = dim.de(o); m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
      .map(([k, v]) => ({ k, v, rot: v + (v === 1 ? ' orden' : ' órdenes') }));
  };

  const ventaPorCompania = (() => {
    const m = new Map();
    lista.forEach((o) => {
      const k = dimDe('compania').de(o);
      m.set(k, (m.get(k) || 0) + plataDe(o).ventaTotal);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ k, v, rot: fMonto(v) }));
  })();

  /* ── 🔶 DÓNDE SE VAN LOS DÍAS ──────────────────────────────────────
     El desglose de la reparación etapa por etapa. Cada etapa guarda cuándo se
     asignó y cuándo se cerró; la resta de esas dos fechas es lo que el
     vehículo estuvo ahí, y no hay que reconstruir ninguna cadena para saberlo.

     ⚠️ Sólo entran las etapas CERRADAS. Una etapa abierta no tiene todavía un
     tiempo: contarla como si hubiera terminado hoy metería en el promedio un
     número que mañana es otro. Se dice cuántas quedaron fuera. */
  /* 🔴 UNA ETAPA DURA DESDE QUE CERRO LA ANTERIOR (31-08-2026). El bloque de
     arriba explica por que: en las 276 ordenes medidas, las 276 tenian todas
     sus etapas asignadas el mismo dia, asi que `cierre − asignacion` era un
     acumulado desde el ingreso y no lo que duro la etapa. */
  const tramosDeLaOrden = (o) => {
    const cerradas = (o.etapasAsignadas || [])
      .filter((e) => e.finalizada && e.finalizadaAt)
      .slice()
      /* Por FECHA DE CIERRE, no por el orden del catalogo: la secuencia que
         importa es la que ocurrio, no la que estaba prevista. */
      .sort((a, b) => a.finalizadaAt - b.finalizadaAt);
    let previo = o.fechaIngreso || (cerradas.length ? cerradas[0].asignadaAt : null);
    return cerradas.map((e) => {
      const desde = previo || e.asignadaAt || e.finalizadaAt;
      previo = e.finalizadaAt;
      return { e, dias: Math.max(0, (e.finalizadaAt - desde) / MS_DIA) };
    });
  };

  const porEtapa = (() => {
    const m = new Map();
    let abiertas = 0;
    lista.forEach((o) => {
      (o.etapasAsignadas || []).forEach((e) => {
        if (!e.finalizada || !e.finalizadaAt) abiertas++;
      });
      tramosDeLaOrden(o).forEach(({ e, dias }) => {
        const c = m.get(e.nombre) || { n: 0, dias: 0, orden: e.orden, color: e.color };
        c.n++; c.dias += dias; m.set(e.nombre, c);
      });
    });
    const filas = [...m.entries()]
      .map(([k, c]) => ({ k, orden: c.orden, color: c.color, n: c.n,
        v: c.n ? c.dias / c.n : 0, dias: c.dias }))
      .sort((a, b) => a.orden - b.orden);
    return { filas, abiertas, cubiertas: filas.reduce((s, f) => s + f.n, 0) };
  })();

  /* La composición de la venta. Suma exactamente el total: son las tres
     columnas del mismo documento. */
  const composicion = (() => {
    const z = { mo: 0, rep: 0, tot: 0 };
    lista.forEach((o) => { const p = plataDe(o); z.mo += p.ventaMO; z.rep += p.ventaRep; z.tot += p.ventaToT; });
    /* ⚠️ Los tres tonos tienen que distinguirse EN EL ANILLO, no en la lista.
       La primera versión usaba acento y violeta para mano de obra y repuestos:
       en la leyenda se leían distintos, pero en el anillo son dos morados
       vecinos y las porciones se veían como una sola. El verde no significa
       «bueno» acá — significa «esta porción no es la otra». */
    return [
      { k: 'Mano de obra', v: z.mo, tono: 'acento' },
      { k: 'Repuestos', v: z.rep, tono: 'verde' },
      { k: 'T.O.T. (trabajos externos)', v: z.tot, tono: 'ambar' }
    ];
  })();

  /* Los tres relojes, promediados. Es la corrección central del sistema puesta
     en un gráfico: días totales = reparación + fuera de taller, y el sistema
     actual sólo sabe contar uno de los tres.

     ⚠️ El promedio sobre TODAS las órdenes aguada el mensaje: si una de cada
     cuatro se fue y volvió, el promedio general muestra una franja delgada y
     parece un detalle. El número que muerde es el de ESAS órdenes, y por eso
     se calcula aparte. */
  const relojes = (() => {
    const n = lista.length || 1;
    const rep = lista.reduce((s, o) => s + o.diasReparacion, 0) / n;
    const fuera = lista.reduce((s, o) => s + o.diasFuera, 0) / n;
    const conSalida = lista.filter((o) => o.diasFuera > 0);
    return {
      partes: [
        { k: 'Reparación (el auto adentro)', v: rep, tono: 'acento' },
        { k: 'Fuera de taller (con el cliente)', v: fuera, tono: 'gris' }
      ],
      conSalida: conSalida.length,
      fueraDeEsas: conSalida.length
        ? conSalida.reduce((s, o) => s + o.diasFuera, 0) / conSalida.length : 0,
      totalDeEsas: conSalida.length
        ? conSalida.reduce((s, o) => s + o.diasTotales, 0) / conSalida.length : 0
    };
  })();

  /* La distribución: cuántas órdenes cayeron en cada tramo de días. El promedio
     solo esconde la forma — no es lo mismo un taller parejo en 60 días que uno
     que entrega la mitad en 20 y la otra mitad en 100. */
  const distribucion = (() => {
    const cortes = [7, 15, 30, 45, 60, 90, 120];
    const cajas = cortes.map((c, i) => ({
      k: (i === 0 ? '0' : String(cortes[i - 1] + 1)) + '-' + c,
      hasta: c, v: 0
    }));
    cajas.push({ k: 'más de ' + cortes[cortes.length - 1], hasta: Infinity, v: 0 });
    lista.forEach((o) => {
      const caja = cajas.find((c) => o.diasReparacion <= c.hasta);
      if (caja) caja.v++;
    });
    // Dónde poner la línea de la meta: entre qué dos tramos cae.
    const idx = cajas.findIndex((c) => meta <= c.hasta);
    return { cajas: cajas.map((c) => ({ k: c.k, v: c.v, etiqueta: c.k + ' d',
      rot: c.v + (c.v === 1 ? ' orden' : ' órdenes'), corto: String(c.v),
      alerta: c.hasta > meta })), marcaX: idx < 0 ? null : idx + 1 };
  })();

  /* 🔶 EL COMPROMISO. La recepción escribe una fecha de entrega cuando recibe
     el auto. Cumplirla o no es un dato que el sistema actual guarda y no mira
     nunca: no tiene dónde compararla contra la entrega real. Sólo entran las
     órdenes que TIENEN compromiso escrito; las otras se dicen aparte, porque
     un cumplimiento calculado sobre la mitad de la base no es cumplimiento. */
  const compromiso = (() => {
    const con = lista.filter((o) => o.fechaCompromiso && o.fechaEntrega);
    const aTiempo = con.filter((o) => o.fechaEntrega <= o.fechaCompromiso).length;
    const atraso = con.filter((o) => o.fechaEntrega > o.fechaCompromiso)
      .map((o) => Math.round((o.fechaEntrega - o.fechaCompromiso) / MS_DIA));
    return { con: con.length, sin: lista.length - con.length, aTiempo,
      pct: con.length ? Math.round((aTiempo / con.length) * 100) : null,
      atrasoProm: atraso.length ? Math.round(atraso.reduce((s, d) => s + d, 0) / atraso.length) : 0 };
  })();

  /* ── 🔶 QUIEN HACE QUE, Y CUANTO SE DEMORA CADA UNO ────────────────
     Marco, 22-08-2026: *"esta data nos va a permitir tener trazabilidad de
     quienes demoran menos, por vehiculo, en promedio, y mucha mas data que va
     a ser muy util para el dueno... este es el valor anadido que nosotros
     queremos darle"*.

     Sale de la cadena que ahora guarda cada etapa: quien la asigno y cuando,
     quien la termino y cuando, quien la valido y cuando. Con eso se pueden
     medir TRES tramos que hoy no existen en ninguna parte:

       · reparto   — del ingreso a que alguien la asigne  (mide al que asigna)
       · ejecucion — de la asignacion al termino          (mide al encargado)
       · revision  — del termino al visto bueno           (mide al que valida)

     El sistema del cliente no tiene ninguno de los tres: guarda la etapa
     actual y nada mas. */
  const porPersona = (() => {
    const MS = 86400000;
    const m = new Map();
    lista.forEach((o) => {
      /* 🔴 EL MISMO TRAMO QUE «DONDE SE VAN LOS DIAS», y por la misma razon.
         Con `terminada − asignada` esto ordenaba a las personas por donde cae
         su etapa en la ruta: quien hace Desarme salia primero por hacer
         Desarme. Un ranking con nombre y apellido no se publica midiendo eso. */
      tramosDeLaOrden(o).forEach(({ e, dias }) => {
        if (!e.terminadaPor) return;
        const c = m.get(e.terminadaPor) || { n: 0, dias: 0, dev: 0, etapas: new Set() };
        c.n++;
        c.dias += dias;
        /* Cuántas de las que cerró le habían sido devueltas antes. Es la
           contraparte de la velocidad y hace falta para no premiar al que va
           rápido rehaciendo: rápido y devuelto no es rápido. */
        c.dev += (e.devoluciones || 0);
        c.etapas.add(e.nombre);
        m.set(e.terminadaPor, c);
      });
    });
    return [...m.entries()]
      .map(([k, c]) => ({ k, v: c.n ? c.dias / c.n : 0, n: c.n, dev: c.dev,
        tasa: c.n ? (c.dev * 100) / c.n : 0,
        etapas: [...c.etapas].join(', ') }))
      .filter((x) => x.n >= 3)          // menos de tres etapas no es un promedio
      .sort((a, b) => a.v - b.v);       // el mas rapido primero
  })();

  /* 🔴 CUANTAS ETAPAS NO SE LE PUEDEN ATRIBUIR A NADIE.

     Es el numero que le falta al panel de arriba para no mentir: si mas de la
     mitad del trabajo no tiene encargado, un ranking de «quien demora menos»
     entre los pocos que si lo tienen se lee como si fuera el taller entero.
     Con la nomina de hoy pasa exactamente eso: quien pinta y quien desabolla
     no tiene cuenta, asi que sus etapas cierran sin nombre. */
  const sinEncargado = (() => {
    let sin = 0, con = 0;
    lista.forEach((o) => {
      (o.etapasAsignadas || []).forEach((e) => {
        if (!e.finalizada) return;
        if (e.terminadaPor) con++; else sin++;
      });
    });
    return { sin, con, total: sin + con };
  })();

  /* Los dos tramos en que el auto está quieto y nadie lo está trabajando.

     🔴 EL REPARTO SE MIDE HASTA LA PRIMERA ETAPA, no hasta cada una. Acá se
     promediaba `asignada − ingreso` de TODAS las etapas, y daba 31 días: pero
     que Pintura se asigne el día 40 no es una demora, es que primero venían
     Desarme y Desabolladura. Se estaba midiendo el largo del trabajo y
     rotulándolo «mide al que asigna». Lo que sí es tiempo muerto es el auto
     recibido que todavía no tiene NADA asignado — ahí no hay nadie
     trabajándolo y el reloj del cliente ya corre. */
  const tramos = (() => {
    const MS = 86400000;
    let reparto = 0, nRep = 0, revision = 0, nRev = 0;
    lista.forEach((o) => {
      const asignadas = (o.etapasAsignadas || []).filter((e) => e.asignadaAt);
      if (asignadas.length && o.fechaIngreso) {
        const primera = asignadas.reduce((min, e) => (e.asignadaAt < min ? e.asignadaAt : min),
          asignadas[0].asignadaAt);
        reparto += Math.max(0, (primera - o.fechaIngreso) / MS); nRep++;
      }
      (o.etapasAsignadas || []).forEach((e) => {
        if (e.validadaAt && e.terminadaAt) { revision += Math.max(0, (e.validadaAt - e.terminadaAt) / MS); nRev++; }
      });
    });
    return { reparto: nRep ? reparto / nRep : 0, nRep, revision: nRev ? revision / nRev : 0, nRev };
  })();

  const venta = lista.reduce((s, o) => s + plataDe(o).ventaTotal, 0);
  const dentro = lista.filter((o) => o.diasReparacion <= meta).length;

  /* Los sumatorios CRUDOS. Van al resultado porque la pantalla los muestra
     dentro de la fórmula —«6.120 ÷ 120 = 51 d»— y ese numerador tiene que ser
     el mismo que se dividió, no uno recalculado en otro lado. */
  const sumaDias = lista.reduce((s, o) => s + o.diasReparacion, 0);
  const sumaTotales = lista.reduce((s, o) => s + o.diasTotales, 0);

  return {
    dimDe, meses, top, ventaPorCompania, porEtapa, composicion, relojes, distribucion, compromiso,
    porPersona, tramos, sinEncargado,
    venta, dentro, delta, hayMesEnCurso, notaMesEnCurso, mesesCerrados: cerrados.length,
    mesEnCursoCorto: repMesCorto(mesEnCurso), diaDelMes: HOY.getDate(), diasDelMes,
    sumaDias, sumaTotales, sumaFuera: sumaTotales - sumaDias, n: lista.length,
    ticket: lista.length ? venta / lista.length : 0,
    promReparacion: lista.length ? sumaDias / lista.length : 0,
    promTotales: lista.length ? sumaTotales / lista.length : 0,
    // Las series del mes a mes, listas para la chispa de cada tarjeta.
    serieOrdenes: serie((c) => c.n),
    serieVenta: serie((c) => c.venta),
    serieTicket: serie((c) => (c.n ? c.venta / c.n : 0)),
    serieDias: serie((c) => (c.n ? c.dias / c.n : 0)),
    serieCumple: serie((c) => (c.n ? (c.dentro / c.n) * 100 : 0)),
    entregasMes: meses.map(([k, c]) => ({ k, v: c.n, rot: c.n + ' entregas',
      corto: String(c.n), etiqueta: repMesCorto(k) })),
    ventaMes: meses.map(([k, c]) => ({ k, v: c.venta, rot: fMonto(c.venta),
      corto: repPlataCorta(c.venta), etiqueta: repMesCorto(k) })),
    diasMes: meses.map(([k, c]) => {
      const d = Math.round(c.dias / c.n);
      return { k, v: d, rot: d + ' días', corto: String(d), etiqueta: repMesCorto(k), alerta: d > meta };
    })
  };
}
