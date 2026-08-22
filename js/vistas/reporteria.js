/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   REPORTERÍA — la tercera hoja del Histórico.

   Pedido de Marco el 16-08-2026: *"me falta un panel de reportería BI, que se
   vean gráficos, estadísticas, tablas dinámicas"*. Y el 19-08-2026, mirándola
   ya funcionando: *"que los gráficos fueran como más tecnología, que la data
   fuera mejor, que la visual básicamente quede mucho mejor"*.

   Cinco cosas que conviene tener claras antes de mirarlo:

   1 · **Los gráficos están dibujados acá, en SVG.** Sin Chart.js, sin D3 y sin
       CDN. No es purismo: el modelo borrador tiene que abrirse en el mesón del
       taller aunque no haya internet, y una librería traída de afuera lo
       rompe justo el día de la demostración. Áreas con degradado, anillos,
       barras y chispas — todas escritas a mano, unos 400 caracteres de path
       cada una, sin nada que descargar.

   2 · **La tabla dinámica es de verdad dinámica**: se elige qué agrupa las
       filas, qué abre las columnas y qué se suma adentro. No es una tabla fija
       con nombre bonito.

   3 · **Todo sale del mismo dato que el resto del sistema.** No hay una base
       de reportes aparte que alguien tenga que refrescar de noche: se calcula
       al mirarlo. Por eso no puede quedar viejo, y por eso también es honesto
       decir que con 2.100 órdenes al año esto se calcula rápido, pero que si
       algún día son 50.000 hay que precalcular.

   4 · **Un solo lugar hace las cuentas**: `repAgregados`. La pantalla y el PDF
       lo llaman a él. Si cada uno sumara por su cuenta, el día que se toque
       una fórmula el papel y la pantalla empezarían a decir cosas distintas —
       y en un reporte ése es el peor defecto posible.

   🔶 Para qué sirve de verdad, y es lo que hay que mostrarle al dueño, son
      dos vistas que el sistema actual **no puede tener**:

      · **Dónde se van los días.** El desglose de la reparación etapa por
        etapa. Responde la única pregunta que importa cuando un auto lleva
        sesenta días adentro: ¿en cuál se quedó pegado? Su sistema guarda la
        etapa actual y nada más, así que no puede restar dos fechas que no
        tiene.

      · **Días de reparación por mes contra la meta.** Al entregar, el sistema
        actual pierde el contador — el defecto central que encontramos.
   ──────────────────────────────────────────────────────────────────────── */

function repEstado() {
  ui.reporteria = ui.reporteria || {
    desde: '', hasta: '', compania_id: '',
    // La tabla dinámica: qué agrupa, qué abre y qué se suma.
    filas: 'compania', columnas: '', medida: 'ordenes'
  };
  return ui.reporteria;
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
function repUniverso() {
  const r = repEstado();
  const f = { todo: true };
  let lista = Modelo.historico(f);
  if (r.desde) { const [a, m, d] = r.desde.split('-').map(Number); const x = new Date(a, m - 1, d);
    lista = lista.filter((o) => o.fechaEntrega && o.fechaEntrega >= x); }
  if (r.hasta) { const [a, m, d] = r.hasta.split('-').map(Number); const x = new Date(a, m - 1, d, 23, 59);
    lista = lista.filter((o) => o.fechaEntrega && o.fechaEntrega <= x); }
  if (r.compania_id) lista = lista.filter((o) => o.companiaId === r.compania_id);
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

  return { dimF, dimC, med, celdas, valor,
    filasOrd: orden(filas).slice(0, 40), columnasOrd: dimC ? orden(columnas).slice(0, 12) : [['—', null]],
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
  const porEtapa = (() => {
    const m = new Map();
    let abiertas = 0;
    lista.forEach((o) => {
      (o.etapasAsignadas || []).forEach((e) => {
        if (!e.finalizada || !e.asignadaAt || !e.finalizadaAt) { abiertas++; return; }
        const d = Math.max(0, Math.round((e.finalizadaAt - e.asignadaAt) / MS_DIA));
        const c = m.get(e.nombre) || { n: 0, dias: 0, orden: e.orden, color: e.color };
        c.n++; c.dias += d; m.set(e.nombre, c);
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

  const venta = lista.reduce((s, o) => s + plataDe(o).ventaTotal, 0);
  const dentro = lista.filter((o) => o.diasReparacion <= meta).length;

  /* Los sumatorios CRUDOS. Van al resultado porque la pantalla los muestra
     dentro de la fórmula —«6.120 ÷ 120 = 51 d»— y ese numerador tiene que ser
     el mismo que se dividió, no uno recalculado en otro lado. */
  const sumaDias = lista.reduce((s, o) => s + o.diasReparacion, 0);
  const sumaTotales = lista.reduce((s, o) => s + o.diasTotales, 0);

  return {
    dimDe, meses, top, ventaPorCompania, porEtapa, composicion, relojes, distribucion, compromiso,
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

function vReporteria() {
  const r = repEstado();
  const lista = repUniverso();
  const meta = Modelo.metricas().metaDias;
  const g = repAgregados(lista, meta);
  const { meses, entregasMes, diasMes, ventaMes, top, dimDe, ventaPorCompania, venta, dentro,
    porEtapa, composicion, relojes, distribucion, compromiso, ticket, delta } = g;
  const d = repDinamica(lista);
  const hay = lista.length > 0;

  /* 🔴 EN UN CELULAR HASTA EL GRÁFICO ANCHO ES ANGOSTO. El `viewBox` de 1.200
     unidades metido en los 374 px útiles de un teléfono encoge la tipografía a
     un tercio: los valores sobre los puntos quedan en tres píxeles y el eje no
     se lee. Es el mismo defecto que ya se había corregido en los paneles de
     dos columnas, sólo que en pantalla chica alcanza también al de una.

     Se decide al pintar y con el ancho de VERDAD de la ventana. Si alguien
     gira el teléfono, el gráfico conserva la proporción hasta el próximo
     repintado — preferible a forzar un `render()` en el giro, que en mitad de
     un formulario borraría lo que la persona lleva escrito. */
  const chico = typeof window !== 'undefined' && window.innerWidth > 0 && window.innerWidth <= 860;
  const selDim = (id, valorActual, conVacio) => '<select id="' + id + '">' +
    (conVacio ? '<option value="">Sin abrir</option>' : '') +
    REP_DIMENSIONES.map((x) => '<option value="' + x.id + '"' +
      (valorActual === x.id ? ' selected' : '') + '>' + esc(x.rot) + '</option>').join('') + '</select>';
  const vacio = (t) => '<div class="vacio"><div class="titulo">' + esc(t) + '</div></div>';
  const pct = (n, de) => (de ? Math.round((n / de) * 100) : 0);

  const etapasApiladas = porEtapa.filas.map((f) => ({ k: f.k, v: f.v, color: f.color }));
  const peor = porEtapa.filas.slice().sort((a, b) => b.v - a.v)[0];

  return `
  <button class="btn volver" id="rep-volver"><span class="flecha-atras">&#8592;</span>
    Volver al buscador del histórico</button>

  <div class="panel">
    <div class="cab"><div><h2>${ico('consolidado', 'g')}Reportería</h2>
      <div class="desc">Sobre las ${lista.length} órdenes entregadas del período. Todo se calcula
        al mirarlo: no hay un reporte que alguien tenga que refrescar</div></div>
      <button class="btn secundario" id="rep-pdf">${ico('imprimir')}PDF</button></div>
    <div class="cuerpo">
      <div class="rejilla-campos">
        <div class="campo"><label>Entregadas desde</label>
          <input type="date" id="rep-desde" value="${esc(r.desde)}"></div>
        <div class="campo"><label>Hasta</label>
          <input type="date" id="rep-hasta" value="${esc(r.hasta)}"></div>
        <div class="campo"><label>Compañía</label>
          <select id="rep-compania"><option value="">Todas</option>${Modelo.catalogo('compania')
            .map((c) => '<option value="' + esc(c.id) + '"' + (r.compania_id === c.id ? ' selected' : '') +
            '>' + esc(c.nombre) + '</option>').join('')}</select></div>
        <div class="campo"><label>&nbsp;</label>
          <button class="btn secundario" id="rep-limpiar">Todo el período</button></div>
      </div>
    </div>
  </div>

  ${!hay ? vacio('Sin órdenes entregadas en el período elegido') : `

  ${/* El rótulo del delta dice contra QUÉ se compara. Sin eso, un «−8%» al lado
       de una cifra es una afirmación sin sujeto: nadie sabe si es contra el mes
       pasado, contra el año pasado o contra la meta. */''}
  <div class="tira-kpi">
    ${[{ rot: 'Órdenes entregadas', val: repMiles(lista.length),
        sub: meses.length + (meses.length === 1 ? ' mes con entregas' : ' meses con entregas'),
        serie: g.serieOrdenes, bueno: 'alto', tono: 'acento' },
       { rot: 'Venta del período', val: fMonto(venta), chico: true,
        sub: 'facturación de las órdenes cerradas',
        serie: g.serieVenta, bueno: 'alto', tono: 'acento' },
       { rot: 'Ticket promedio', val: fMonto(ticket), chico: true,
        sub: 'por orden entregada',
        serie: g.serieTicket, bueno: 'alto', tono: 'violeta' },
       { rot: 'Reparación promedio', val: Math.round(g.promReparacion) + ' d',
        sub: 'contra una meta de ' + meta + ' días',
        clase: g.promReparacion > meta ? 'mal' : 'bien',
        serie: g.serieDias, bueno: 'bajo', tono: 'rojo' },
       { rot: 'Dentro de la meta', val: pct(dentro, lista.length) + '%',
        sub: repMiles(dentro) + ' de ' + repMiles(lista.length) + ' órdenes',
        clase: pct(dentro, lista.length) < 50 ? 'mal' : 'bien',
        serie: g.serieCumple, bueno: 'alto', tono: 'verde' }
      ].map((t) => repTarjeta(Object.assign(t, {
        delta: delta(t.serie),
        rotDelta: g.hayMesEnCurso ? 'entre meses cerrados' : 'vs. mes anterior',
        notaDelta: g.mesesCerrados < 2
          ? 'hace falta un segundo mes cerrado para comparar'
          : 'sin mes anterior con que comparar'
      }))).join('')}
  </div>
  ${repFormulas([
    { que: 'Órdenes entregadas', exp: 'órdenes con estado final y fecha de entrega en el período',
      num: '= ' + repMiles(lista.length) },
    { que: 'Venta', exp: 'mano de obra + repuestos + T.O.T., sin las OR anuladas',
      num: composicion.map((p) => repPlataCorta(p.v)).join(' + ') + ' = ' + fMonto(venta) },
    { que: 'Ticket promedio', exp: 'venta ÷ órdenes',
      num: repPlataCorta(venta) + ' ÷ ' + repMiles(lista.length) + ' = ' + fMonto(ticket) },
    { que: 'Reparación promedio', exp: 'Σ días de reparación ÷ órdenes',
      num: repMiles(g.sumaDias) + ' ÷ ' + repMiles(lista.length) + ' = ' +
        Math.round(g.promReparacion) + ' d' },
    { que: 'Dentro de la meta', exp: 'órdenes con reparación ≤ ' + meta + ' d ÷ órdenes',
      num: repMiles(dentro) + ' ÷ ' + repMiles(lista.length) + ' = ' + pct(dentro, lista.length) + '%' },
    { que: 'Variación', exp: '(último mes cerrado − el anterior) ÷ el anterior',
      num: g.hayMesEnCurso
        ? 'sobre ' + g.mesesCerrados + ' de ' + meses.length + ' meses · ' + g.notaMesEnCurso
        : 'sobre los ' + meses.length + ' meses del período' }
  ])}

  <div class="panel destacado" style="margin-top:11px">
    <div class="cab"><div><h2>${ico('reloj', 'g')}Dónde se van los días</h2>
      <div class="desc">Los ${Math.round(g.promTotales)} días que dura una orden, abiertos etapa
        por etapa. <strong>El sistema actual no puede mostrar esto</strong>: guarda la etapa en la
        que está el auto, no cuándo entró y salió de cada una, así que no hay dos fechas que
        restar</div></div>
      <span class="et ${peor && peor.v > 0 ? 'roja' : 'gris'}">${peor
        ? 'Se pierde más tiempo en ' + esc(peor.k) : 'Sin etapas cerradas'}</span></div>
    <div class="cuerpo">
      ${porEtapa.filas.length ? repApilada(etapasApiladas, { fmt: (v) => Math.round(v) + ' d' }) +
        '<div class="rejilla-2 sep">' +
          '<div>' + svgBarrasH(porEtapa.filas.map((f) => ({ k: f.k, v: f.v,
            rot: (Math.round(f.v * 10) / 10).toString().replace('.', ',') + ' días', color: f.color })),
            { destacar: false }) + '</div>' +
          '<div>' + repFormulas([
            { que: 'Días de una etapa', exp: 'cierre − asignación, en calendario', num: '' },
            peor ? { que: 'Promedio · ' + peor.k, exp: 'Σ días ÷ etapas cerradas',
              num: repMiles(Math.round(peor.dias)) + ' ÷ ' + repMiles(peor.n) + ' = ' +
                (Math.round(peor.v * 10) / 10).toString().replace('.', ',') + ' d' } : null,
            { que: 'Etapas consideradas', exp: porEtapa.abiertas
                ? 'cerradas ÷ asignadas · las abiertas no tienen tiempo todavía'
                : 'cerradas ÷ asignadas',
              num: repMiles(porEtapa.cubiertas) + ' ÷ ' +
                repMiles(porEtapa.cubiertas + porEtapa.abiertas) },
            { que: 'Auto donde el cliente', exp: 'se carga a la etapa que estaba abierta',
              num: '' }
          ]) +
          '<div class="nota-panel"><p class="dato-demo">Dato de demostración: los tiempos por etapa ' +
          'salen de la base sembrada. Con la base real de DyP se calcula igual.</p></div></div>' +
        '</div>'
        : vacio('Ninguna orden del período tiene etapas cerradas')}
    </div>
  </div>

  <div class="panel destacado" style="margin-top:11px">
    <div class="cab"><div><h2>Días de reparación por mes</h2>
      <div class="desc">La otra vista que el sistema actual no puede tener: al entregar pierde el
        contador. La franja verde de abajo es cumplir; todo lo que queda sobre la línea de la meta
        va en vino</div></div></div>
    <div class="cuerpo">${meses.length
      ? svgSerie(diasMes, { compacto: chico, meta, metaRot: 'días', fmt: (v) => Math.round(v) + ' d' }) +
        repFormulas([
          { que: 'Punto del mes', exp: 'Σ días de reparación ÷ entregas de ese mes',
            num: (() => { const u = diasMes[diasMes.length - 1];
              return u ? u.etiqueta + ' = ' + u.v + ' d' : ''; })() },
          { que: 'Meta', exp: 'parámetro del sistema (Configuración → Parámetros)',
            num: meta + ' días' },
          g.hayMesEnCurso ? { que: 'Último punto', exp: 'mes incompleto',
            num: g.notaMesEnCurso } : null
        ])
      : vacio('Sin entregas en el período')}</div>
  </div>

  <div class="rejilla-2" style="margin-top:11px">
    <div class="panel">
      <div class="cab"><div><h2>Entregas por mes</h2>
        <div class="desc">Cuántos vehículos salieron cada mes</div></div></div>
      <div class="cuerpo">${meses.length ? svgBarras(entregasMes, { compacto: true }) +
        repFormulas([
          { que: 'Barra del mes', exp: 'órdenes con fecha de entrega en ese mes',
            num: '= ' + repMiles(lista.length) + ' en total' },
          g.hayMesEnCurso ? { que: 'Última barra', exp: 'mes incompleto', num: g.notaMesEnCurso } : null
        ])
        : vacio('Sin entregas')}</div>
    </div>
    <div class="panel">
      <div class="cab"><div><h2>Venta por mes</h2>
        <div class="desc">Lo facturado en las órdenes que se cerraron ese mes</div></div></div>
      <div class="cuerpo">${meses.length
        ? svgSerie(ventaMes, { compacto: true, fmt: (v) => repPlataCorta(v) }) +
          repFormulas([
            { que: 'Punto del mes', exp: 'Σ venta de las órdenes entregadas ese mes',
              num: '= ' + fMonto(venta) + ' en total' },
            g.hayMesEnCurso ? { que: 'Último punto', exp: 'mes incompleto', num: g.notaMesEnCurso } : null
          ])
        : vacio('Sin entregas')}</div>
    </div>
  </div>

  <div class="rejilla-2" style="margin-top:11px">
    <div class="panel">
      <div class="cab"><div><h2>De dónde sale la venta</h2>
        <div class="desc">Las tres columnas del presupuesto. Suman el total exacto</div></div></div>
      <div class="cuerpo">${svgAnillo(composicion,
        { fmt: (v) => fMonto(v), centro: repPlataCorta(venta), centroRot: 'venta del período' })}
        ${repFormulas([
          { que: 'Mano de obra', exp: 'Σ horas × tempario',
            num: '= ' + fMonto(composicion[0].v) },
          { que: 'Repuestos', exp: 'sólo los que pone el taller',
            num: '= ' + fMonto(composicion[1].v) },
          { que: 'T.O.T.', exp: 'trabajos externos',
            num: '= ' + fMonto(composicion[2].v) },
          { que: 'Venta', exp: 'las tres columnas, sin las OR anuladas',
            num: composicion.map((p) => repPlataCorta(p.v)).join(' + ') + ' = ' + fMonto(venta) }
        ])}</div>
    </div>
    <div class="panel">
      <div class="cab"><div><h2>${ico('reloj', 'g')}Los tres relojes</h2>
        <div class="desc">Días totales = reparación + fuera de taller. El sistema actual cuenta
          uno solo, y por eso un auto que se fue y volvió aparece con el reloj en cero</div></div></div>
      <div class="cuerpo">
        ${repApilada(relojes.partes, { fmt: (v) => Math.round(v) + ' d' })}
        <div class="rejilla-campos sep">
          <div class="campo"><label>Días totales (promedio)</label>
            <div class="lectura">${Math.round(g.promTotales)} días</div></div>
          <div class="campo"><label>De reparación</label>
            <div class="lectura">${Math.round(g.promReparacion)} días</div></div>
          <div class="campo"><label>Fuera de taller</label>
            <div class="lectura">${Math.round(g.promTotales - g.promReparacion)} días</div></div>
        </div>
        ${repFormulas([
          { que: 'Días totales', exp: 'entrega − ingreso',
            num: repMiles(g.sumaTotales) + ' ÷ ' + repMiles(lista.length) + ' = ' +
              Math.round(g.promTotales) + ' d' },
          { que: 'De reparación', exp: 'Σ (salida − entrada) de cada estadía',
            num: repMiles(g.sumaDias) + ' ÷ ' + repMiles(lista.length) + ' = ' +
              Math.round(g.promReparacion) + ' d' },
          { que: 'Fuera de taller', exp: 'totales − reparación',
            num: Math.round(g.promTotales) + ' − ' + Math.round(g.promReparacion) + ' = ' +
              Math.round(g.promTotales - g.promReparacion) + ' d' },
          relojes.conSalida
            ? { que: 'Se fueron y volvieron', exp: 'órdenes con más de una estadía',
                num: repMiles(relojes.conSalida) + ' de ' + repMiles(lista.length) + ' · ' +
                  Math.round(relojes.fueraDeEsas) + ' d afuera de ' +
                  Math.round(relojes.totalDeEsas) + ' d totales' }
            : { que: 'Se fueron y volvieron', exp: 'órdenes con más de una estadía',
                num: 'ninguna · los dos relojes dan lo mismo' },
          relojes.conSalida
            ? { que: 'Lo que pierde su sistema', exp: 'reinicia el contador al regrabar el estado',
                num: Math.round(relojes.fueraDeEsas) + ' d por orden' }
            : null
        ])}
      </div>
    </div>
  </div>

  <div class="rejilla-2" style="margin-top:11px">
    <div class="panel">
      <div class="cab"><div><h2>Cómo se reparten los días</h2>
        <div class="desc">El promedio esconde la forma: no es lo mismo un taller parejo que uno
          que entrega la mitad rápido y la otra mitad muy lento</div></div></div>
      <div class="cuerpo">${svgBarras(distribucion.cajas,
        { compacto: true, marcaX: distribucion.marcaX, marcaRot: 'meta ' + meta + ' d' })}
        ${repFormulas([
          { que: 'Cada barra', exp: 'órdenes cuya reparación cae en el tramo', num: '' },
          { que: 'Barra azul', exp: 'tramo dentro de la meta de ' + meta + ' d',
            num: repMiles(dentro) + ' ÷ ' + repMiles(lista.length) + ' = ' +
              pct(dentro, lista.length) + '%' },
          { que: 'Promedio', exp: 'la cola larga lo arrastra sobre el tramo más alto',
            num: Math.round(g.promReparacion) + ' d' }
        ])}</div>
    </div>
    <div class="panel">
      <div class="cab"><div><h2>La fecha que se le prometió al cliente</h2>
        <div class="desc">Entrega real contra la fecha de compromiso que escribió recepción</div></div></div>
      <div class="cuerpo">
        ${compromiso.pct === null
          ? vacio('Ninguna orden del período tiene fecha de compromiso escrita')
          : repApilada([
              { k: 'Entregadas a tiempo', v: compromiso.aTiempo, tono: 'verde' },
              { k: 'Entregadas con atraso', v: compromiso.con - compromiso.aTiempo, tono: 'rojo' }
            ], { fmt: (v) => repMiles(v) }) +
            '<div class="rejilla-campos sep">' +
              '<div class="campo"><label>Cumplimiento</label>' +
                '<div class="lectura ' + (compromiso.pct < 50 ? 'malo' : 'bueno') + '">' +
                compromiso.pct + '%</div></div>' +
              '<div class="campo"><label>Atraso promedio</label>' +
                '<div class="lectura">' + compromiso.atrasoProm + ' días</div></div>' +
              '<div class="campo"><label>Sin compromiso escrito</label>' +
                '<div class="lectura">' + repMiles(compromiso.sin) + ' de ' +
                repMiles(lista.length) + '</div></div>' +
            '</div>' +
            repFormulas([
              { que: 'A tiempo', exp: 'fecha de entrega ≤ fecha de compromiso',
                num: '= ' + repMiles(compromiso.aTiempo) },
              { que: 'Cumplimiento', exp: 'a tiempo ÷ órdenes CON compromiso escrito',
                num: repMiles(compromiso.aTiempo) + ' ÷ ' + repMiles(compromiso.con) + ' = ' +
                  compromiso.pct + '%' },
              { que: 'Base del cálculo', exp: 'las que no tienen fecha escrita quedan fuera',
                num: repMiles(compromiso.con) + ' de ' + repMiles(lista.length) +
                  (compromiso.sin ? ' · ' + repMiles(compromiso.sin) + ' sin compromiso' : '') },
              { que: 'Atraso promedio', exp: 'Σ (entrega − compromiso) ÷ órdenes atrasadas',
                num: '= ' + compromiso.atrasoProm + ' d' }
            ])}
      </div>
    </div>
  </div>

  <div class="rejilla-2" style="margin-top:11px">
    <div class="panel">
      <div class="cab"><div><h2>Venta por compañía</h2></div></div>
      <div class="cuerpo">${svgBarrasH(ventaPorCompania, { destacar: true })}</div>
    </div>
    <div class="panel">
      <div class="cab"><div><h2>Modelos más siniestrados</h2></div></div>
      <div class="cuerpo">${svgBarrasH(top(dimDe('modelo'), 10), { destacar: true })}</div>
    </div>
    <div class="panel">
      <div class="cab"><div><h2>Clientes con más vehículos</h2></div></div>
      <div class="cuerpo">${svgBarrasH(top(dimDe('cliente'), 10), { destacar: true })}</div>
    </div>
    <div class="panel">
      <div class="cab"><div><h2>Marcas</h2></div></div>
      <div class="cuerpo">${svgBarrasH(top(dimDe('marca'), 10), { destacar: true })}</div>
    </div>
  </div>
  `}

  <div class="panel" style="margin-top:11px">
    <div class="cab"><div><h2>${ico('consolidado', 'g')}Tabla dinámica</h2>
      <div class="desc">Se elige qué agrupa las filas, qué abre las columnas y qué se suma adentro</div></div></div>
    <div class="cuerpo">
      <div class="rejilla-campos">
        <div class="campo"><label>Agrupar filas por</label>${selDim('rep-filas', r.filas)}</div>
        <div class="campo"><label>Abrir columnas por</label>${selDim('rep-columnas', r.columnas, true)}</div>
        <div class="campo"><label>Medida</label>
          <select id="rep-medida">${REP_MEDIDAS.map((m) => '<option value="' + m.id + '"' +
            (r.medida === m.id ? ' selected' : '') + '>' + esc(m.rot) + '</option>').join('')}</select>
          <span class="ayuda">${d.med.suma ? 'Se suma' : 'Se promedia'} dentro de cada celda</span></div>
      </div>
      ${repTablaDinamica(d)}
    </div>
  </div>

  <div class="globo-graf" id="rep-globo" hidden></div>`;
}

function repTablaDinamica(d) {
  if (!d.filasOrd.length) {
    return '<div class="vacio" style="margin-top:11px"><div class="titulo">Sin datos en el período</div></div>';
  }
  const cel = (f, c) => {
    const v = d.valor(d.celdas.get(f + '|' + c));
    return v === null ? '<span style="color:var(--gris-2)">—</span>' : d.med.fmt(v);
  };

  return '<div class="grid-envoltorio" style="margin-top:11px"><table class="grid">' +
    '<thead><tr><th>' + esc(d.dimF.rot) + '</th>' +
    (d.dimC ? d.columnasOrd.map(([c]) => '<th class="num">' +
      esc(d.dimC.id === 'mes' ? repMesCorto(c) : c) + '</th>').join('') : '') +
    '<th class="num">' + esc(d.med.rot) + '</th></tr></thead><tbody>' +
    d.filasOrd.map(([f, tot]) => '<tr><td>' +
      esc(d.dimF.id === 'mes' ? repMesCorto(f) : f) + '</td>' +
      (d.dimC ? d.columnasOrd.map(([c]) => '<td class="num">' + cel(f, c) + '</td>').join('') : '') +
      '<td class="num"><strong>' + d.med.fmt(d.valor(tot)) + '</strong></td></tr>').join('') +
    '</tbody><tfoot><tr><td><strong>Total</strong></td>' +
    (d.dimC ? d.columnasOrd.map(() => '<td></td>').join('') : '') +
    '<td class="num"><strong>' + (d.totalGeneral === null ? '—' : d.med.fmt(d.totalGeneral)) +
    '</strong></td></tr></tfoot></table></div>' +
    (d.med.suma ? '' : '<div class="pie-nota">Es un <strong>promedio</strong>: el total de abajo ' +
      'promedia todas las órdenes del período, no la suma de la columna. Sumar promedios da un ' +
      'número que no significa nada.</div>');
}

function pReporteria() {
  const r = repEstado();
  const volver = document.getElementById('rep-volver');
  if (volver) volver.addEventListener('click', () => {
    historicoEstado().vista = 'buscador'; render();
  });

  const leer = () => {
    r.desde = (document.getElementById('rep-desde') || {}).value || '';
    r.hasta = (document.getElementById('rep-hasta') || {}).value || '';
    r.compania_id = (document.getElementById('rep-compania') || {}).value || '';
    r.filas = (document.getElementById('rep-filas') || {}).value || 'compania';
    r.columnas = (document.getElementById('rep-columnas') || {}).value || '';
    r.medida = (document.getElementById('rep-medida') || {}).value || 'ordenes';
  };
  ['rep-desde', 'rep-hasta', 'rep-compania', 'rep-filas', 'rep-columnas', 'rep-medida']
    .forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => { leer(); render(); });
    });

  const limpiar = document.getElementById('rep-limpiar');
  if (limpiar) limpiar.addEventListener('click', () => {
    r.desde = r.hasta = r.compania_id = ''; render();
  });

  const pdf = document.getElementById('rep-pdf');
  if (pdf) pdf.addEventListener('click', () => mostrarImpreso(impresoReporteria(), 'Reportería'));

  repEngancharGlobo();
}

/* ── El globo del dato ─────────────────────────────────────────────────
   Un solo recuadro flotante para TODOS los gráficos, no uno por dibujo. Se
   engancha en el contenedor y pregunta al vuelo qué hay debajo del mouse
   (delegación): si se enganchara elemento por elemento habría que volver a
   recorrer cientos de figuras en cada repintado.

   Los `<title>` de cada figura se dejan puestos igual: son el globo del
   navegador, funcionan sin JavaScript y son los que salen al imprimir. */
function repEngancharGlobo() {
  const caja = document.getElementById('contenido');
  if (!caja) return;

  /* ⚠️ EL OYENTE SE ENGANCHA UNA SOLA VEZ EN LA VIDA DE LA PANTALLA.

     `#contenido` NO se reemplaza en cada repintado: se le cambia el `innerHTML`
     y el nodo es siempre el mismo. Enganchando sin marca, cada vez que alguien
     tocaba un filtro se sumaba otro `mousemove` sobre el mismo elemento, y
     después de veinte cambios de filtro había veinte funciones corriendo por
     cada píxel que el mouse recorre. No se ve —el globo dice lo mismo veinte
     veces— hasta que el panel se pone lento y nadie sabe por qué.

     La marca va en el nodo y no en una variable de módulo porque lo que hay
     que recordar es si ESE nodo ya está enganchado. */
  if (caja.dataset.globoEnganchado === '1') return;
  caja.dataset.globoEnganchado = '1';

  // El globo se busca en cada movimiento, no acá: el de ahora se va a ir con
  // el próximo repintado y el oyente tiene que encontrar el nuevo.
  const mostrar = (ev) => {
    const globo = document.getElementById('rep-globo');
    if (!globo) return;
    const el = ev.target && ev.target.closest ? ev.target.closest('[data-tip]') : null;
    if (!el) { globo.hidden = true; return; }
    globo.textContent = el.getAttribute('data-tip');
    globo.hidden = false;
    // Se corre solo para no salirse por el borde derecho de la ventana.
    const ancho = globo.offsetWidth || 160;
    const x = Math.min(ev.clientX + 14, (window.innerWidth || 1200) - ancho - 10);
    globo.style.left = Math.max(8, x) + 'px';
    globo.style.top = Math.max(8, ev.clientY - 34) + 'px';
  };
  caja.addEventListener('mousemove', mostrar);
  caja.addEventListener('mouseleave', () => {
    const globo = document.getElementById('rep-globo');
    if (globo) globo.hidden = true;
  });
}

/* El PDF de la reportería. Los gráficos van tal cual —son SVG, y el SVG se
   imprime nítido a cualquier tamaño, que es la otra razón para dibujarlos acá
   en vez de traer una librería que pinta sobre un lienzo de píxeles. */
function impresoReporteria() {
  const lista = repUniverso();
  const d = repDinamica(lista);
  const meta = Modelo.metricas().metaDias;
  const r = repEstado();
  // Los mismos agregados que la pantalla, calculados una sola vez y en un solo
  // lugar: el papel no puede decir algo distinto de lo que se está mirando.
  const g = repAgregados(lista, meta);
  const { meses, entregasMes, diasMes, top, dimDe, ventaPorCompania, venta, dentro,
    porEtapa, composicion, compromiso, ticket } = g;

  const periodo = (r.desde || r.hasta)
    ? (r.desde || 'el inicio') + ' a ' + (r.hasta || 'hoy')
    : 'Todo el período';

  const cel = (f, c) => {
    const v = d.valor(d.celdas.get(f + '|' + c));
    return v === null ? '—' : d.med.fmt(v);
  };

  // Una tabla de dos columnas para los rankings del papel.
  const tabla = (cabs, filas) => '<table><thead><tr>' +
    cabs.map((c, i) => '<th' + (i ? ' class="n"' : '') + '>' + esc(c) + '</th>').join('') +
    '</tr></thead><tbody>' + filas + '</tbody></table>';

  return `
  <div class="cab-doc">
    <div>${logoImpreso()}
      <div style="font-size:10px;color:#555">Desabolladura y pintura</div>
      <div style="margin-top:5px;font-size:13px;font-weight:700">Reportería</div></div>
    <div class="der"><div><strong>${lista.length} órdenes entregadas</strong></div>
      <div>${esc(periodo)}</div><div>Emitido ${fFechaHora(HOY)}</div></div>
  </div>

  <h2>Indicadores</h2>
  <div class="rej">
    ${campoImpreso('Órdenes entregadas', lista.length)}
    ${campoImpreso('Venta', fMonto(venta))}
    ${campoImpreso('Ticket promedio', fMonto(ticket))}
    ${campoImpreso('Reparación promedio', lista.length
      ? Math.round(g.promReparacion) + ' días' : '—')}
    ${campoImpreso('Dentro de la meta de ' + meta + ' días',
      (lista.length ? Math.round((dentro / lista.length) * 100) : 0) + '%')}
    ${campoImpreso('Entregadas en la fecha comprometida', compromiso.pct === null
      ? 'sin compromiso escrito'
      : compromiso.pct + '% (' + compromiso.aTiempo + ' de ' + compromiso.con + ')')}
  </div>

  ${/* 🔴 EL PDF LLEVA LOS GRÁFICOS, no sólo la tabla. Salía con una sola y era
       un reporte a medias: el gráfico de días contra la meta es justamente lo
       que se le muestra al dueño, y es lo que faltaba en el papel.

       Los SVG se imprimen tal cual —vectoriales, nítidos a cualquier tamaño—,
       que es la otra razón por la que estos gráficos se dibujaron a mano en
       vez de traer una librería que pinta sobre un lienzo de píxeles. */''}
  <h2>Dónde se van los días</h2>
  ${porEtapa.filas.length
    ? repFormulas([
        { que: 'Días de una etapa', exp: 'fecha de cierre - fecha de asignación',
          num: 'calendario, no horas trabajadas' },
        { que: 'Promedio de la etapa', exp: 'suma de días / etapas cerradas', num: 'ver la tabla' },
        { que: 'Etapas consideradas', exp: 'cerradas / asignadas',
          num: repMiles(porEtapa.cubiertas) + ' / ' +
            repMiles(porEtapa.cubiertas + porEtapa.abiertas) }
      ]) +
      tabla(['Etapa', 'Días promedio', 'Etapas cerradas'], porEtapa.filas
        .map((f) => '<tr><td>' + esc(f.k) + '</td><td class="n">' +
          (Math.round(f.v * 10) / 10).toString().replace('.', ',') + '</td><td class="n">' +
          f.n + '</td></tr>').join(''))
    : '<p>Ninguna orden del período tiene etapas cerradas.</p>'}

  ${/* Los tres relojes van en el papel porque es LA corrección del sistema. El
       gráfico no aporta —son dos números—, así que va como tabla y con la
       frase que explica qué se pierde. */''}
  <h2>Los tres relojes</h2>
  ${tabla(['Reloj', 'Promedio'], [
    ['Días totales (del ingreso a la entrega)', Math.round(g.promTotales)],
    ['De reparación (el vehículo en el taller)', Math.round(g.promReparacion)],
    ['Fuera de taller (con el cliente)', Math.round(g.promTotales - g.promReparacion)]
  ].map((f) => '<tr><td>' + esc(f[0]) + '</td><td class="n">' + f[1] + ' días</td></tr>').join(''))}
  ${repFormulas([
    { que: 'Días totales', exp: 'entrega - ingreso',
      num: repMiles(g.sumaTotales) + ' / ' + repMiles(lista.length) + ' = ' +
        Math.round(g.promTotales) + ' d' },
    { que: 'De reparación', exp: 'suma de (salida - entrada) de cada estadía',
      num: repMiles(g.sumaDias) + ' / ' + repMiles(lista.length) + ' = ' +
        Math.round(g.promReparacion) + ' d' },
    { que: 'Fuera de taller', exp: 'totales - reparación',
      num: Math.round(g.promTotales) + ' - ' + Math.round(g.promReparacion) + ' = ' +
        Math.round(g.promTotales - g.promReparacion) + ' d' },
    { que: 'Se fueron y volvieron', exp: 'órdenes con más de una estadía',
      num: g.relojes.conSalida
        ? repMiles(g.relojes.conSalida) + ' de ' + repMiles(lista.length) + ' · ' +
          Math.round(g.relojes.fueraDeEsas) + ' d afuera de ' +
          Math.round(g.relojes.totalDeEsas) + ' d totales'
        : 'ninguna · los dos relojes dan lo mismo' },
    g.relojes.conSalida
      ? { que: 'Lo que pierde su sistema', exp: 'el contador se reinicia al regrabar el estado',
          num: Math.round(g.relojes.fueraDeEsas) + ' d por orden' }
      : null
  ])}

  <h2>Días de reparación por mes</h2>
  ${meses.length ? svgSerie(diasMes, { meta, metaRot: 'días', fmt: (v) => Math.round(v) + ' d' })
    : '<p>Sin entregas en el período.</p>'}
  ${repFormulas([
    { que: 'Punto del mes', exp: 'suma de días de reparación / entregas de ese mes',
      num: 'meta ' + meta + ' días' },
    g.hayMesEnCurso ? { que: 'Último punto', exp: 'mes incompleto', num: g.notaMesEnCurso } : null
  ])}

  <h2>Entregas por mes</h2>
  ${meses.length ? svgBarras(entregasMes) : '<p>Sin entregas en el período.</p>'}

  <h2>De dónde sale la venta</h2>
  ${tabla(['Concepto', 'Monto'], composicion.map((p) => '<tr><td>' + esc(p.k) +
    '</td><td class="n">' + esc(fMonto(p.v)) + '</td></tr>').join('') +
    '<tr><td><strong>Total</strong></td><td class="n"><strong>' + esc(fMonto(venta)) +
    '</strong></td></tr>')}

  <h2>Modelos más siniestrados</h2>
  ${tabla(['Modelo', 'Órdenes'], top(dimDe('modelo'), 10)
    .map((x) => '<tr><td>' + esc(x.k) + '</td><td class="n">' + x.v + '</td></tr>').join(''))}

  <h2>Venta por compañía</h2>
  ${tabla(['Compañía', 'Venta'], ventaPorCompania
    .map((x) => '<tr><td>' + esc(x.k) + '</td><td class="n">' + esc(x.rot) + '</td></tr>').join(''))}

  <h2>Clientes con más vehículos</h2>
  ${tabla(['Cliente', 'Órdenes'], top(dimDe('cliente'), 10)
    .map((x) => '<tr><td>' + esc(x.k) + '</td><td class="n">' + x.v + '</td></tr>').join(''))}

  <h2>${esc(d.med.rot)} por ${esc(d.dimF.rot.toLowerCase())}${
    d.dimC ? ', abierto por ' + esc(d.dimC.rot.toLowerCase()) : ''}</h2>
  <table><thead><tr><th>${esc(d.dimF.rot)}</th>
    ${d.dimC ? d.columnasOrd.map(([c]) => '<th class="n">' +
      esc(d.dimC.id === 'mes' ? repMesCorto(c) : c) + '</th>').join('') : ''}
    <th class="n">${esc(d.med.rot)}</th></tr></thead><tbody>
    ${d.filasOrd.map(([f, tot]) => '<tr><td>' +
      esc(d.dimF.id === 'mes' ? repMesCorto(f) : f) + '</td>' +
      (d.dimC ? d.columnasOrd.map(([c]) => '<td class="n">' + cel(f, c) + '</td>').join('') : '') +
      '<td class="n"><strong>' + d.med.fmt(d.valor(tot)) + '</strong></td></tr>').join('')}
  </tbody></table>
  ${pieImpreso()}`;
}
