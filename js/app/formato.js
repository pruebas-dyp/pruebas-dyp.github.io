/* Automotora DyP — Modelo Borrador · Arttmize SpA
   Router y render de las vistas. Sin framework, sin build, sin CDN.

   NINGUNA VISTA LEE UN ARREGLO CRUDO. Todo sale de `Modelo`, que es el
   repositorio: guarda las tablas normalizadas y arma las vistas al leer.
   Toda escritura pasa por un procedimiento de `Modelo` que consulta `Reglas`.
   Ver modelo.js y reglas.js. */

// El repositorio se levanta antes que nada: los catálogos de abajo salen de él.
Modelo.iniciar();

/* ───────────────── Catálogos ─────────────────
   Vienen del repositorio, no están escritos acá.

   Y desde que Configuración los edita de verdad, NO pueden ser una copia
   tomada al cargar la página: quedarían viejos en cuanto alguien agregue una
   etapa. Van como propiedades de solo lectura que consultan el repositorio
   cada vez, así el resto del código las sigue usando como si fueran arreglos. */

['ETAPAS', 'TIPOS_DANO', 'ZONAS_DANO', 'INVENTARIO_ITEMS', 'COMPANIAS', 'META_DIAS_REPARACION']
  .forEach((nombre, i) => Object.defineProperty(window, nombre, {
    get: [() => Modelo.etapas(), () => Modelo.tiposDano(), () => Modelo.zonasDano(),
          () => Modelo.inventarioItems(), () => Modelo.companias(),
          () => Modelo.metricas().metaDias][i]
  }));

const etapaPorCodigo = (c) => ETAPAS.find((e) => e.codigo === c) || ETAPAS[0];
const totalOT = (o) => Modelo.totalOT(o);
const tieneRepuestoPendiente = (o) => Modelo.tieneRepuestoPendiente(o);

/* ───────────────── Utilidades ───────────────── */

// Todo texto libre se escapa antes de pintarlo. Regla de la casa, también en el borrador.
function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fFecha = (d) => (d ? d.getDate() + ' ' + MESES[d.getMonth()] + ' ' + d.getFullYear() : '—');
const fCorta = (d) => (d ? String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') : '—');
/* Fecha con hora, `dd-mm-aaaa HH:MM`, como la muestra el sistema actual.
   Pedido de Marco el 16-08-2026 para las columnas de ingreso y de entrega: en
   un taller que recibe y entrega varios autos el mismo día, la hora es la que
   ordena los hechos cuando hay un reclamo — y `12/08` a secas no ordena nada. */
const fFechaHora = (d) => (d
  ? String(d.getDate()).padStart(2, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') +
    '-' + d.getFullYear() + ' ' + String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0')
  : '—');
const fMonto = (n) => '$' + Math.round(n).toLocaleString('es-CL');
const fMiles = (n) => Math.round(Number(n) || 0).toLocaleString('es-CL');
const nDias = (d) => Math.max(0, Math.round((HOY - d) / 86400000));
const plural = (n, s, p) => n + ' ' + (n === 1 ? s : p);
// Tolerantes a nulo: una OT recien creada desde el calendario todavia no tiene
// kilometraje ni combustible, porque el evento de la aseguradora no los trae.
const fKm = (n) => (n === null || n === undefined || n === '' ? 'Sin registrar' : Number(n).toLocaleString('es-CL') + ' km');
const fComb = (n) => (n === null || n === undefined || n === '' ? 'Sin registrar' : n + '/8');

const ESTADO_REPUESTO = {
  por_pedir:     { txt: 'Por pedir',     clase: 'gris' },
  pedido:        { txt: 'Pedido',        clase: 'ambar' },
  en_transito:   { txt: 'En tránsito',   clase: 'azul' },
  recibido:      { txt: 'Recibido',      clase: 'verde' },
  no_disponible: { txt: 'No disponible', clase: 'roja' }
};
const ESTADO_PRESUPUESTO = {
  borrador:  { txt: 'Borrador',  clase: 'gris' },
  enviado:   { txt: 'Enviado',   clase: 'azul' },
  aprobado:  { txt: 'Aprobado',  clase: 'verde' },
  rechazado: { txt: 'Rechazado', clase: 'roja' },
  // `anulado` existía en el motor desde el principio y no tenía rótulo acá:
  // la etiqueta salía vacía. Es el estado que deja `Anular` del listado.
  anulado:   { txt: 'Anulado',   clase: 'gris' }
};

/* Los hechos de un expediente, agrupados por dia. Es como se lee una historia y
   es como se discute con una compañia ("el 12 paso esto").

   Vive acá porque lo usan DOS pantallas —el expediente y su impreso— y hasta el
   22-08-2026 estaba copiado en las dos. Ese es el que se corrige una vez y la
   otra copia queda atras. */
function hechosPorDia(hechos) {
  const porDia = [];
  (hechos || []).forEach((h) => {
    const clave = fCorta(h.fecha);
    const ultimo = porDia[porDia.length - 1];
    if (ultimo && ultimo.clave === clave) ultimo.hechos.push(h);
    else porDia.push({ clave, fecha: h.fecha, hechos: [h] });
  });
  return porDia;
}

/* ───────────────── Estado de la interfaz ───────────────── */

/* ── Cuántas filas mostrar ────────────────────────────────────────────
   Pedido de Marco (16-08-2026): "quiero que en las tablas uno pueda decidir de
   cuánta data mostrar, si de 1-100, 1-500, 1-1000, en todos los lugares que
   tenga tabla".

   Las opciones son una sola lista y se usan en las dos partes: acá arriba, en
   las dos pantallas que ya paginaban solas —Torre e Histórico—, y abajo en el
   paginado que se aplica sobre el DOM al resto de las tablas. Un solo lugar
   que diga cuáles son, o en tres meses una pantalla ofrece 500 y la otra no.

   El `0` es "Todas". Se guarda como número y no como texto para que el
   selector y la aritmética hablen el mismo idioma.

   El default es 100 —la primera opción que pidió Marco— y no las 35 de antes:
   la mesa del taller mira la torre completa, no de a 35. */
const TAMANOS_PAGINA = [50, 100, 500, 1000, 0];
const TAMANO_PAGINA = 100;

/* El selector. Devuelve HTML porque las dos pantallas que ya paginaban arman
   su pie como texto, y el paginado del DOM lo inserta igual. */
function selectorTamano(id, valor) {
  const v = Number(valor) || 0;
  return '<label class="cuantas">Mostrar ' +
    '<select' + (id ? ' id="' + esc(id) + '"' : '') + ' title="Cuántas filas se muestran por página">' +
    TAMANOS_PAGINA.map((t) => '<option value="' + t + '"' + (t === v ? ' selected' : '') + '>' +
      (t ? fMiles(t) + ' filas' : 'Todas') + '</option>').join('') +
    '</select></label>';
}

/* "Todas" es 0, y 0 no sirve para cortar una lista: `slice(0, 0)` devuelve
   vacío y `total / 0` es infinito. Se traduce acá, una vez, y no en cada
   pantalla que lo use. */
const tamanoEfectivo = (tam, total) => (Number(tam) || Math.max(1, Number(total) || 1));

const ui = {
  vista: 'torre',
  // `orden`/`desc`: pedido del cliente el 15-08-2026. La torre parte SIEMPRE
  // por correlativo descendente —lo último que entró, arriba— y desde ahí el
  // usuario reordena por la columna que quiera. Antes el orden era por fecha de
  // ingreso y no se podía cambiar.
  torre: { pagina: 1, porPagina: TAMANO_PAGINA, busqueda: '', compania: 'todas', situacion: 'piso', etapa: 'todas', abierta: null,
           orden: 'ot', desc: true },
  historico: { pagina: 1, porPagina: TAMANO_PAGINA, busqueda: '' },
  // Las vistas grandes arman su propio estado la primera vez que se pintan, y
  // lo restauran del borrador si hay uno. Ver recepcion.js y configuracion.js.
  recepcion: null,
  config: null,
  ficha: null,
  registroOT: null
};
