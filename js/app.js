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

/* ───────────────── Navegación ───────────────── */

// La "Agenda del día" salió del menú: el agendamiento automático NO existe en
// ninguna de las 39 pantallas del sistema actual. Está modelado y documentado
// en DECISIONES-REPLICA, y se cotiza aparte. No se muestra como si existiera.
const MENU = [
  /* 🔶 EL MENÚ SON LOS DIEZ DEL SISTEMA ACTUAL Y NADA MÁS (16-08-2026, Marco:
     "ojo deja solo estos"). Salieron cuatro:

       · **Mi trabajo** — nuestro. Es la pantalla del operario: sus vehículos y
         sus etapas. El sistema actual no tiene nada por persona.
       · **Repuestos** — ya vive DENTRO de Bodega, que es donde el taller lo
         busca. Era la misma pantalla en dos puertas.
       · **Esperas** — nuestro. Las detenciones con su motivo.
       · **Expediente** — nuestro. El historial completo del vehículo.

     Las cuatro vistas SIGUEN EXISTIENDO y se llega por dirección
     (`#vista=expediente`). Sacar algo del menú no es motivo para romper un
     enlace guardado, y tampoco para borrar trabajo que el taller todavía no
     ha visto. Se conserva la agrupación en tres bloques: diez íconos en una
     fila plana se leen peor que diez repartidos por para qué sirven. */
  { grupo: 'Operación diaria' },
  { id: 'recepcion', nombre: 'Recepción',      icono: 'recepcion' },
  { id: 'torre',     nombre: 'Torre de control', icono: 'torre',   cuenta: () => Modelo.torre().length },
  { id: 'taller',    nombre: 'Taller',         icono: 'taller' },
  /* 🔶 ENTREGA SALIÓ DEL MENÚ (15-08-2026, pedido de Marco): "ya lo tenemos en
     Recepción". Entregar Unidad es una de las cuatro opciones de Recepción y
     tenerlo además como módulo aparte era el mismo trabajo en dos puertas — de
     esas dos, una siempre queda desactualizada.

     La VISTA sigue existiendo y `#vista=entrega` sigue llevando ahí: sacarla
     del menú no es motivo para romper un enlace que alguien pudo dejar
     guardado. Lo que cambió es de dónde se llega. */
  { grupo: 'Seguimiento' },
  { id: 'presupuesto', nombre: 'Presupuesto', icono: 'presupuesto' },
  { id: 'bodega',      nombre: 'Bodega',      icono: 'bodega' },
  { id: 'documentos',  nombre: 'Documentos',  icono: 'documento' },
  // El Histórico es un BUSCADOR, no un listado: sin filtro no muestra nada.
  // Por eso no lleva contador — mostrarlo sugeriría que hay una tabla detrás.
  { id: 'historico',   nombre: 'Histórico',   icono: 'historico' },
  { grupo: 'Administración' },
  { id: 'personal',      nombre: 'Personal',      icono: 'personal', cuenta: () => Modelo.personal().filter((p) => p.activo).length },
  { id: 'consolidado',   nombre: 'Consolidado',   icono: 'consolidado' },
  { id: 'configuracion', nombre: 'Configuración', icono: 'config' }
];

/* Cada módulo declara su ruta y los botones de su barra de herramientas.
   Formato: [icono, rótulo, acción, tecla]. **Todos hacen algo.**

   Antes había una fila de botones decorativos "para que se viera como un ERP".
   Se apretaron en la primera prueba y no pasó nada. Con razón: así no sirve. Un botón
   que no hace nada enseña a no confiar en la pantalla. Los que no se pueden
   construir todavía no se dibujan; los que sí, funcionan. */
const MODULOS = {
  mitrabajo:   { ruta: ['Operación diaria', 'Mi trabajo'],
                 acciones: [['refrescar', 'Actualizar', 'refrescar', 'F5']] },
  /* `Ingresar recepción` se llama igual que el botón del paso Verificar: es la
     misma operación y no puede tener dos nombres. Desde cualquier otro paso
     lleva a Verificar si está todo completo, y si no, dice qué falta.
     `Agregar fotos` lleva al paso Estado descriptivo, que es donde viven las
     fotos desde el 15-08-2026 — no abre una pantalla que ya no existe. */
  recepcion:   { ruta: ['Operación diaria', 'Recepción'],
                 acciones: [['guardar', 'Ingresar recepción', 'guardar', 'F2'],
                            ['camara', 'Agregar fotos', 'fotos'],
                            ['refrescar', 'Descartar borrador', 'limpiar']] },
  torre:       { ruta: ['Operación diaria', 'Torre de control'],
                 acciones: [['refrescar', 'Actualizar', 'refrescar', 'F5'],
                            ['nuevo', 'Nuevo ingreso', 'nuevo'],
                            ['editar', 'Abrir la orden', 'abrir'],
                            ['exportar', 'Exportar', 'exportar'],
                            ['imprimir', 'Imprimir', 'imprimir']] },
  taller:      { ruta: ['Operación diaria', 'Taller'],
                 acciones: [['refrescar', 'Actualizar', 'refrescar', 'F5'],
                            ['exportar', 'Exportar', 'exportar']] },
  entrega:     { ruta: ['Recepción', 'Entregar Unidad'],
                 acciones: [['buscar', 'Buscar patente', 'buscar'],
                            ['refrescar', 'Actualizar', 'refrescar', 'F5']] },
  repuestos:   { ruta: ['Seguimiento', 'Repuestos'],
                 acciones: [['buscar', 'Buscar patente', 'buscar'],
                            ['refrescar', 'Actualizar', 'refrescar', 'F5'],
                            ['exportar', 'Exportar', 'exportar'],
                            ['imprimir', 'Imprimir', 'imprimir']] },
  detenidos:   { ruta: ['Seguimiento', 'Esperas'],
                 acciones: [['refrescar', 'Actualizar', 'refrescar', 'F5'],
                            ['exportar', 'Exportar', 'exportar']] },
  presupuesto: { ruta: ['Seguimiento', 'Presupuesto'],
                 acciones: [['refrescar', 'Actualizar', 'refrescar', 'F5'],
                            ['exportar', 'Exportar', 'exportar'],
                            ['imprimir', 'Imprimir', 'imprimir']] },
  bodega:      { ruta: ['Seguimiento', 'Bodega'],
                 acciones: [['buscar', 'Buscar patente', 'buscar'],
                            ['refrescar', 'Actualizar', 'refrescar', 'F5'],
                            ['exportar', 'Exportar', 'exportar']] },
  documentos:  { ruta: ['Seguimiento', 'Documentos'],
                 acciones: [['refrescar', 'Actualizar', 'refrescar', 'F5'],
                            ['exportar', 'Exportar', 'exportar']] },
  historico:   { ruta: ['Seguimiento', 'Histórico'],
                 acciones: [['buscar', 'Buscar', 'buscar'],
                            ['refrescar', 'Limpiar el filtro', 'limpiar'],
                            ['exportar', 'Exportar', 'exportar'],
                            ['imprimir', 'Imprimir', 'imprimir']] },
  expediente:  { ruta: ['Seguimiento', 'Expediente del vehículo'],
                 acciones: [['buscar', 'Buscar', 'buscar'],
                            ['imprimir', 'Imprimir el expediente', 'imprimir']] },
  personal:    { ruta: ['Administración', 'Personal'],
                 acciones: [['nuevo', 'Nuevo trabajador', 'nuevo'],
                            ['refrescar', 'Actualizar', 'refrescar', 'F5'],
                            ['exportar', 'Exportar', 'exportar']] },
  consolidado: { ruta: ['Administración', 'Consolidado'],
                 acciones: [['refrescar', 'Actualizar', 'refrescar', 'F5'],
                            ['exportar', 'Exportar', 'exportar'],
                            ['imprimir', 'Imprimir', 'imprimir']] },
  configuracion: { ruta: ['Administración', 'Configuración'],
                 acciones: [['deshacer', 'Deshacer', 'deshacer', 'Ctrl+Z'],
                            ['refrescar', 'Actualizar', 'refrescar', 'F5'],
                            ['exportar', 'Exportar el catálogo', 'exportar']] }
};

/* El botón de Deshacer dice QUÉ va a deshacer, no solo "deshacer": tocar los
   catálogos mueve cosas que no se ven en pantalla, y hay que poder leer la
   marcha atrás antes de apretarla. Cuando la pila está vacía sigue vivo y lo
   explica, como todos los demás. */
function rotuloDeshacer() {
  const q = Modelo.proximoDeshacer();
  return q ? 'Deshacer ' + q : 'Deshacer';
}

/* ── ¿A qué módulo entra quien está mirando? ───────────────────────────
   🔷 17-08-2026. Andrés Guzmán entregó la lista de quién usa la web hoy y a qué
   módulo entra cada uno. Esa lista es la AUTORIDAD para entrar, y no los
   permisos que nosotros habíamos colgado del rol: al cruzarlas, nueve de las
   trece cuentas quedaban viendo menos de lo que ven hoy —Iván sin Presupuesto,
   Andrés sin Consolidado, seis personas sin Histórico—. Un sistema nuevo que
   le quita pantallas al que hoy las usa no se puede defender, y además no era
   una decisión: era el efecto de haber inventado los roles antes de tener la
   lista.

   Entonces:

     · Si la persona TIENE lista de módulos —las trece cuentas del cliente—,
       manda la lista. Entra a lo que entra hoy.
     · Si NO la tiene —las cuentas de puesto: desabolladura, pintura—, manda el
       permiso del rol, que es como funcionaba antes.

   Lo que el ROL sigue gobernando es lo que se puede HACER adentro: ver los
   montos de un presupuesto, aprobarlo, cargar un repuesto. Eso su sistema no
   lo tiene —allá el que entra a una pantalla puede todo lo que la pantalla
   ofrece— y hay que confirmarlo cargo por cargo antes de la puesta en marcha.
   Está anotado en la ficha de cada cuenta, en Personal. */
function entraAlModulo(id) {
  if (Modelo.modulosDe((Modelo.personaActual() || {}).id)) return Modelo.veModulo(id);
  const pide = PERMISO_DE_MODULO[id];
  return !pide || Modelo.puede(pide);
}

function pintarMenu() {
  const nav = document.getElementById('nav');
  const visible = (m) => entraAlModulo(m.id);

  // Un grupo que se quedó sin módulos visibles tampoco se dibuja: un rótulo
  // solo, sin nada debajo, se lee como que algo se rompió.
  const conContenido = MENU.filter((m, i) => {
    if (!m.grupo) return visible(m);
    for (let k = i + 1; k < MENU.length && !MENU[k].grupo; k++) if (visible(MENU[k])) return true;
    return false;
  });

  nav.innerHTML = conContenido.map((m) => {
    if (m.grupo) return '<div class="grupo">' + esc(m.grupo) + '</div>';
    const n = m.cuenta ? m.cuenta() : null;
    const c = (n === null || n === undefined) ? '' : '<span class="cuenta">' + n + '</span>';
    /* El nombre va en `.rot` y el `title` lleva el mismo texto: con la barra
       plegada a iconos el rótulo se esconde y el globo es lo único que queda
       para saber a qué módulo se entra. */
    return '<a data-vista="' + m.id + '" class="' + (m.pendiente ? 'pendiente' : '') +
           '" tabindex="0" title="' + esc(m.nombre) + (n ? ' · ' + n : '') + '">' +
           ico(m.icono) + '<span class="rot">' + esc(m.nombre) + '</span>' + c + '</a>';
  }).join('');
  nav.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => ir(a.dataset.vista));
    a.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ir(a.dataset.vista); } });
  });

  pintarLogo();
  /* La esquina del usuario la dibuja `montarRol()`, y SOLO ella. Acá había un
     `innerHTML` que escribía el nombre a secas, y como `pintarMenu()` corre
     después de `montarRol()` al recargar con la sesión guardada, se comía los
     botones de «Cambiar mi clave» y «Cerrar sesión». Al entrar por el
     formulario no se notaba —ahí el orden es al revés— y por eso pasó. */
  montarRol();
}

/* Quién está mirando la pantalla. Decía "Administrador" fijo en tres lugares
   —la esquina, la barra de estado y la ventana de una OT—, y con cuentas de
   verdad eso es sencillamente falso: el pintor veía su nombre arriba y
   "Administrador" abajo. */
function quienMira() {
  const p = Modelo.personaActual();
  if (p) return [p.nombres, p.apellidos].filter(Boolean).join(' ');
  return Modelo.rolActual().nombre || '—';
}

// Usa el logo del taller si está presente. Si el archivo no existe,
// cae a texto: nunca se dibuja una imitación del logo.
function pintarLogo() {
  const cont = document.getElementById('prod');
  const texto = () => { cont.innerHTML = ico('auto', 'g') + 'Automotora DyP · Control de Taller'; };
  texto();
  const img = new Image();
  img.onload = () => {
    cont.innerHTML = '';
    img.className = 'logo';
    img.alt = 'Automotora DyP';
    cont.appendChild(img);
    const t = document.createElement('span');
    t.textContent = 'Control de Taller';
    cont.appendChild(t);
  };
  img.onerror = texto;
  img.src = 'img/logo-dyp.png';
}

/* La segunda hoja del Histórico es Reportería, y desde que se abre derecho
   desde el menú Reportes (16-08-2026) el encabezado tiene que decirlo: si al
   apretar «Reportería» la pantalla se titulara «Histórico», el menú estaría
   mintiendo sobre dónde dejó al usuario. Es la única sub-pantalla con nombre
   propio en el menú, por eso está acá y no es un mecanismo general. */
function enReporteria() {
  return ui.vista === 'historico' && typeof historicoEstado === 'function' &&
    historicoEstado().vista === 'reporteria';
}

function pintarShell() {
  const m = MODULOS[ui.vista] || { ruta: [], acciones: [] };
  const ruta = enReporteria() ? m.ruta.slice(0, -1).concat('Reportería') : m.ruta;

  document.getElementById('ruta').innerHTML =
    ruta.map((r, i) => (i ? ico('chevron') : '') + '<span>' + esc(r) + '</span>').join('');

  // Las pestañas del encabezado se eliminaron: cada módulo pinta las suyas
  // dentro del contenido, donde sí cambian algo.
  document.getElementById('tabs').innerHTML = '';

  const h = document.getElementById('herramientas');
  h.innerHTML = (m.acciones || []).map(([icono, txt, accion, tecla], k) =>
      '<button class="hbtn' + (k === 0 ? ' primario' : '') + '" type="button" data-hacc="' +
      esc(accion) + '">' + ico(icono) +
      esc(accion === 'deshacer' ? rotuloDeshacer() : txt) +
      (tecla ? '<span class="tecla">' + esc(tecla) + '</span>' : '') + '</button>').join('') +
    /* El rótulo pasó a ser un botón el 16-08-2026, cuando se sacaron los menús
       Procesos y Ayuda: las herramientas de la demostración —adelantar el
       calendario, correr las pruebas, comprobar las cifras, la guía— viven acá
       abajo. Es el único cartel de la pantalla que ya decía que esto es una
       demostración, así que es donde alguien las va a buscar. */
    '<button class="hbtn der" type="button" data-hacc="demostracion" ' +
    'title="Las herramientas de la demostración: la guía, las pruebas y el calendario">' +
    ico('base') + 'Datos de demostración</button>';
  h.style.display = 'flex';

  h.querySelectorAll('[data-hacc]').forEach((b) =>
    b.addEventListener('click', () => accionModulo(b.dataset.hacc)));
}

/* ── Las herramientas de la demostración ──────────────────────────────────
   Lo que antes eran los menús Procesos y Ayuda. Ninguna acción se perdió: la
   lista es la misma y cada botón llama exactamente al mismo despachador que
   llamaba el menú. */
const HERRAMIENTAS_DEMO = [
  { texto: 'Qué se puede probar acá', icono: 'check', accion: 'guia',
    pie: 'El recorrido corto: qué mostrar y en qué orden' },
  { texto: 'Probar reglas de negocio', icono: 'check', accion: 'pruebas',
    pie: 'Cada prueba intenta algo prohibido y falla por la regla, con el motivo' },
  { texto: 'Comprobar cifras de la demostración', icono: 'consolidado', accion: 'cifras',
    pie: 'Que los datos inventados sigan cuadrando con lo medido en el sistema real' },
  { texto: 'Adelantar la fecha del sistema 7 días', icono: 'reloj', accion: 'adelantar',
    pie: 'Lo que hace visibles los tres relojes' },
  { texto: 'Volver la fecha a hoy', icono: 'refrescar', accion: 'fecha-hoy',
    pie: 'Deja el calendario donde estaba' },
  { texto: 'Acerca del sistema', icono: 'info', accion: 'acerca',
    pie: 'Qué es esto y qué no es' }
];

function dialogoDemostracion() {
  dialogo('Datos de demostración', '<p class="pie-nota" style="margin:0 0 10px">' +
    'Los datos de esta pantalla son inventados y están rotulados como tales. ' +
    'Para volver a dejarlos como venían: <strong>Archivo → Reiniciar a datos de demostración</strong>.</p>' +
    '<div class="ir-lista">' + HERRAMIENTAS_DEMO.map((x) =>
      '<button type="button" class="ir-item" data-demo="' + esc(x.accion) + '">' + ico(x.icono) +
      '<span class="nom">' + esc(x.texto) +
      '<span class="gru" style="display:block;font-weight:400">' + esc(x.pie) + '</span></span>' +
      '</button>').join('') +
    '</div>');

  dialogo.ultimo.querySelectorAll('[data-demo]').forEach((b) =>
    b.addEventListener('click', () => {
      const a = b.dataset.demo;
      dialogo.cerrar();
      // Las que abren su propio cuadro tienen que encontrar el anterior ya
      // cerrado: `dialogo()` borra el velo que haya, así que el orden importa.
      ejecutarAccion(a);
    }));
}

/* ───────────────── Las acciones de la barra ─────────────────
   Un despachador único. Cada acción hace algo de verdad en el módulo que está
   a la vista, o dice por qué no puede. */

function accionModulo(accion) {
  /* Recibe varios candidatos porque un mismo módulo puede tener distintos
     buscadores según la sub-pantalla: Bodega busca por patente en el
     check-list y por texto libre en el seguimiento. Se toma el primero que
     esté a la vista; si no hay ninguno, se dice en vez de no hacer nada. */
  const foco = (...ids) => {
    for (const id of ids) {
      const e = document.getElementById(id);
      if (e) { e.focus(); e.select && e.select(); return true; }
    }
    return false;
  };

  switch (accion) {
    case 'refrescar':
      render();
      return avisar({ ok: true, motivo: '' }, 'Pantalla actualizada.');

    // El rótulo de arriba a la derecha: lo que antes eran Procesos y Ayuda.
    case 'demostracion':
      return dialogoDemostracion();

    case 'nuevo':
      if (ui.vista === 'personal') { const b = document.getElementById('per-nuevo'); if (b) b.click(); return; }
      // El botón dice "Nuevo ingreso", así que entra derecho al formulario y no
      // al menú de opciones: el usuario ya eligió al apretarlo.
      recEntrarAlFormulario();
      return ir('recepcion');

    case 'abrir': {
      const id = ui.torre.abierta;
      const o = id ? Modelo.torre().find((x) => x.id === id) : filtrarTorre()[0];
      if (!o) return avisar({ ok: false, motivo: 'No hay ninguna orden a la vista para abrir.' });
      return abrirFicha(o.numeroOT);
    }

    case 'buscar': {
      const donde = {
        historico:   ['h-patente'],
        bodega:      ['bod-patente', 'bod-q'],
        entrega:     ['ent-patente'],
        presupuesto: ['q-presu'],
        documentos:  ['doc-q'],
        personal:    ['per-q'],
        repuestos:   ['rep-q']
      }[ui.vista] || ['q-torre'];
      if (foco.apply(null, donde)) return;
      /* Costos adicionales y Valorizar TOT no tienen buscador. Apretar "Buscar
         patente" ahí es querer buscar, así que se lleva al check-list, que es
         donde se busca por patente, en vez de no hacer nada. */
      if (ui.vista === 'bodega') {
        bodegaEstado().pantalla = 'checklist';
        render();
        foco('bod-patente');
        return avisar({ ok: true, motivo: '' }, 'La búsqueda por patente está en el check-list de repuestos.');
      }
      return avisar({ ok: false, motivo: 'Esta pantalla no tiene buscador.' });
    }

    case 'limpiar':
      if (ui.vista === 'historico') { const b = document.getElementById('h-limpiar'); if (b) b.click(); return; }
      if (ui.vista === 'recepcion') {
        const b = document.getElementById('rec-limpiar');
        if (b) return b.click();
        // Desde el menú no hay botón a la vista: se entra al formulario, que es
        // donde vive el borrador, en vez de no hacer nada.
        recEntrarAlFormulario(); render();
        const b2 = document.getElementById('rec-limpiar');
        if (b2) b2.click();
        return;
      }
      return;

    case 'guardar':
      if (ui.vista === 'recepcion') {
        const b = document.getElementById('rec-guardar');
        if (b) return b.click();
        // Todavía no se llegó al paso Verificar: se llega, o se dice qué falta.
        return recIrAVerificar();
      }
      return avisar({ ok: false, motivo: 'En esta pantalla los cambios se guardan en cada tabla, no con un botón global.' });

    case 'fotos': {
      const r = rec();
      // Las fotos viven dentro del formulario: si estamos en el menú, se entra.
      if (r.pantalla !== 'nuevo' || r.paso !== 'danos') {
        recEntrarAlFormulario('danos'); guardarBorrador(); render();
      }
      const z = document.getElementById('recfoto-zona');
      if (z) z.scrollIntoView({ block: 'center' });
      return;
    }

    case 'deshacer': {
      const r = Modelo.deshacer();
      if (!r.ok) return avisar(r);
      render();
      return avisar({ ok: true, motivo: '' }, 'Se deshizo ' + r.rotulo + '.');
    }

    case 'exportar':  return exportarVistaCSV();
    case 'imprimir':  return imprimirVista();
  }
}

/* ── Exportar de verdad ────────────────────────────────────────────────
   El original tiene botón Exportar en Torre, Taller, padrón de clientes y
   nómina, y un clic entrega la tabla completa con los datos personales de
   todos. Acá es un permiso aparte —requisito B-5— y lo que sale es lo que
   está a la vista, con lo enmascarado enmascarado. */

function exportarVistaCSV() {
  if (!Modelo.puede('exportar')) {
    return avisar({ ok: false, motivo: 'El rol ' + Modelo.rolActual().nombre +
      ' no tiene permiso para exportar. En el sistema actual cualquiera puede, y un clic entrega ' +
      'el padrón completo con RUT y domicilio. Acá es un permiso aparte.' });
  }
  /* TODAS las tablas de la pantalla, no la primera.
     El presupuesto tiene tres —líneas, repuestos y totales— y exportaba solo
     la de arriba: salía la mano de obra sola y parecía que faltaba la mitad
     del panel. Cada tabla va con el rótulo de su sección delante para que en
     Excel se entienda dónde empieza cada una. */
  const tablas = Array.from(document.querySelectorAll('#contenido table.grid'));
  if (!tablas.length) return avisar({ ok: false, motivo: 'Esta pantalla no tiene una tabla que exportar.' });

  const limpiar = (t) => '"' + String(t).replace(/\s+/g, ' ').trim().replace(/"/g, '""') + '"';

  // El rótulo sale del encabezado del panel o del fieldset que la contiene.
  const rotuloDe = (tabla) => {
    const caja = tabla.closest('.panel, fieldset.bloque');
    if (!caja) return '';
    const t = caja.querySelector('h2, legend');
    return t ? t.textContent.replace(/\s+/g, ' ').trim() : '';
  };

  const filas = [];
  let datos = 0;
  tablas.forEach((tabla, i) => {
    const rot = rotuloDe(tabla);
    if (tablas.length > 1) {
      if (i) filas.push('');
      filas.push(limpiar(rot || 'Tabla ' + (i + 1)));
    }
    tabla.querySelectorAll('thead tr').forEach((tr) =>
      filas.push(Array.from(tr.cells).map((c) => limpiar(c.textContent)).join(';')));
    tabla.querySelectorAll('tbody tr, tfoot tr').forEach((tr) => {
      if (tr.classList.contains('detalle') || !tr.cells.length) return;
      filas.push(Array.from(tr.cells).map((c) => limpiar(c.textContent)).join(';'));
      datos++;
    });
  });
  if (!datos) return avisar({ ok: false, motivo: 'Las tablas están vacías: no hay nada que exportar.' });

  // BOM para que Excel en español abra las tildes bien.
  const blob = new Blob(['﻿' + filas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dyp-' + ui.vista + '-' +
    HOY.getFullYear() + String(HOY.getMonth() + 1).padStart(2, '0') + String(HOY.getDate()).padStart(2, '0') + '.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);

  /* El paginado esconde filas, no las saca del documento, así que en el archivo
     salen todas. Se dice, porque si en pantalla se ven 100 y el CSV trae 214 el
     que lo abre piensa que exportó otra cosa. */
  const escondidas = document.querySelectorAll('#contenido tbody tr.fuera-de-pagina:not(.detalle)').length;

  avisar({ ok: true, motivo: '' }, 'Exportadas ' + datos + ' filas' +
    (tablas.length > 1 ? ' de ' + tablas.length + ' tablas' : '') + ' a ' + a.download +
    (escondidas ? ' — la tabla completa, incluidas las ' + escondidas +
      ' filas que el paginado no tiene a la vista' : '') +
    '. Queda en la traza: quién exportó, qué y cuándo.');
}

/* ── Imprimir de verdad ─────────────────────────────────────────────── */

const CSS_IMPRIMIR_VISTA = `@media print{
  /* En papel el fondo va blanco: con el tema oscuro puesto, la página salía
     con la tinta clara sobre negro y gastando tóner en una franja que no dice
     nada. Mismo criterio que los cuatro documentos. */
  html,body{background:#fff !important;color:#111 !important}
  .barra-menu,.sidebar,.herramientas,.barra-estado,.avisos,.tabs{display:none !important}
  .marco,.principal,.app{display:block !important;overflow:visible !important}
  .contenido{overflow:visible !important;height:auto !important}
  .panel{break-inside:avoid;box-shadow:none}
  table.grid th{position:static !important}
  /* Las filas que el paginado escondió vuelven a salir: el que imprime quiere
     el listado que filtró, y de a cuántas lo mira es una comodidad de la
     pantalla. Ojo: en la Torre y en el Histórico el corte lo hace el modelo
     —esas filas no están en el documento— y ahí sí sale sólo la página que se
     está viendo. El pie no se imprime: en papel no hay dónde apretar. */
  tr.fuera-de-pagina{display:table-row !important}
  .pie-grid{display:none !important}
  @page{size:A4 landscape;margin:10mm}
}`;

function imprimirVista() {
  if (!document.getElementById('css-imprimir-vista')) {
    const s = document.createElement('style');
    s.id = 'css-imprimir-vista'; s.textContent = CSS_IMPRIMIR_VISTA;
    document.head.appendChild(s);
  }
  const previo = document.title;
  // TITULOS pasó a ser texto plano: sacarle `[0]` devolvía una sola letra y el
  // PDF se guardaba como "DyP - N".
  document.title = 'DyP - ' + (TITULOS[ui.vista] || ui.vista);
  setTimeout(() => { window.print(); document.title = previo; }, 120);
}

/* 🔶 DE QUÉ PUBLICACIÓN ES ESTA PANTALLA (15-08-2026).

   El navegador se guarda `index.html` y GitHub Pages la da por buena diez
   minutos. En esos diez minutos el modelo sigue pidiendo el `?v=` anterior —y
   ese código también está en caché—, así que al mirarlo justo después de
   publicar se ve la versión vieja y parece que el cambio nunca se hizo. Ya
   pasó tres veces y las tres se fue el tiempo en averiguar si el problema era
   la publicación o el navegador.

   Con el sello a la vista se distingue en dos segundos: si el número no es el
   de la última publicación, es la caché y se arregla con Ctrl+F5.

   Se lee del sello que la publicación ya le pone al CSS. No hay un número
   aparte que alguien tenga que acordarse de subir: no existe la forma de que
   este cartel mienta. En desarrollo no hay sello y dice «sin publicar». */
function selloVersion() {
  const l = document.querySelector('link[rel="stylesheet"]');
  const m = l && /\?v=(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(l.getAttribute('href') || '');
  if (!m) return 'sin publicar';
  return m[3] + '-' + m[2] + '-' + m[1] + ' ' + m[4] + ':' + m[5];
}

/* ── El aviso de versión nueva ─────────────────────────────────────────
   🔴 EL PROBLEMA QUE ESTO RESUELVE (16-08-2026). Marco: "no veo los cambios
   cuando actualizo el link". Y tenía razón en lo que veía, aunque lo publicado
   estuviera bien: GitHub Pages sirve el `index.html` con `Cache-Control:
   max-age=600`, así que **durante diez minutos el navegador sigue mostrando el
   index viejo**, que apunta a los archivos con el sello viejo, que también
   están en su caché. Se publica, se recarga, y no pasa nada.

   El sello en la barra de estado ya dejaba comprobarlo a mano — pero hay que
   saber contra qué compararlo. Esto lo hace solo: al entrar, y cada cinco
   minutos, se pide el `index.html` SIN caché y se compara su sello con el que
   está corriendo. Si hay uno más nuevo, aparece una barra arriba con un botón
   que recarga saltándose la caché.

   No recarga solo a propósito: si alguien está a medio llenar una recepción,
   una recarga sorpresa le borra el trabajo. Avisa y espera. */
const SELLO_CORRIENDO = (() => {
  const l = document.querySelector('link[rel="stylesheet"]');
  const m = l && /\?v=(\d{12})/.exec(l.getAttribute('href') || '');
  return m ? m[1] : null;
})();

function revisarVersionPublicada() {
  // En `file://` no hay servidor al que preguntarle, y en localhost el propio
  // `serve.ps1` manda `no-store`: el problema no existe ahí.
  if (!SELLO_CORRIENDO || location.protocol === 'file:') return;

  fetch('index.html?ping=' + new Date().getTime(), { cache: 'no-store' })
    .then((r) => (r.ok ? r.text() : null))
    .then((html) => {
      if (!html) return;
      const m = /\?v=(\d{12})/.exec(html);
      if (!m || m[1] <= SELLO_CORRIENDO) return;
      mostrarAvisoVersion(m[1]);
    })
    .catch(() => null);   // sin conexión no es un error que valga la pena contar
}

function mostrarAvisoVersion(sello) {
  if (document.getElementById('aviso-version')) return;
  const f = (s) => s.slice(6, 8) + '-' + s.slice(4, 6) + ' ' + s.slice(8, 10) + ':' + s.slice(10, 12);
  const barra = document.createElement('div');
  barra.id = 'aviso-version';
  barra.className = 'aviso-version';
  barra.innerHTML = '<span>Hay una versión más nueva publicada (' + esc(f(sello)) +
    '). La que estás viendo es del ' + esc(f(SELLO_CORRIENDO)) + '.</span>' +
    '<button class="btn" id="aviso-version-btn">Actualizar</button>';
  document.body.appendChild(barra);
  document.getElementById('aviso-version-btn').addEventListener('click', () => {
    // Con el parámetro cambiado, el navegador no puede servir su copia.
    location.replace(location.pathname + '?r=' + new Date().getTime() + location.hash);
  });
}

function pintarBarraEstado(extra) {
  // El indicador de datos modificados importa: si el estado se movió de la
  // semilla, antes de una demostración hay que reiniciar.
  const mod = Modelo.estaModificado()
    ? '<span class="celda modificado" title="El estado se movió de los datos de demostración. ' +
      'Archivo → Reiniciar a datos de demostración.">' + ico('alerta') + 'Datos modificados</span>'
    : '';
  document.getElementById('estado-barra').innerHTML =
    '<span class="celda"><span class="luz"></span>Conectado</span>' +
    '<span class="celda">' + ico('usuario') + esc(quienMira()) + '</span>' +
    '<span class="celda">Automotora DyP</span>' +
    '<span class="celda" title="Sello de la publicación que estás viendo. Si no es el ' +
      'de la última, el navegador tiene la copia vieja: Ctrl+F5.">' +
      'Versión ' + esc(selloVersion()) + '</span>' +
    (extra ? '<span class="celda">' + extra + '</span>' : '') + mod;
}

/* ───────────────── Barra de menú ─────────────────
   Los cuatro menús hacen algo. Antes había seis y cuatro de ellos estaban
   inertes "para que se viera como un ERP", y eso enseña a no confiar en la
   pantalla.

   🔷 PROCESOS Y AYUDA SE SACARON (16-08-2026, Marco). Eran las dos únicas
   entradas de la barra que hablaban de la DEMOSTRACIÓN y no del taller:
   adelantar el calendario, correr las pruebas, comprobar las cifras, la guía.
   En una barra que imita la del sistema real, eso se lee como si el taller
   tuviera un menú para viajar en el tiempo.

   No se borraron: las seis acciones viven ahora detrás del rótulo «Datos de
   demostración», arriba a la derecha de cada panel — que es exactamente lo que
   son y ya decía su nombre. Ver `dialogoDemostracion`. */

const MENUS = {
  Archivo: [
    { texto: 'Nuevo ingreso de vehículo', icono: 'recepcion', accion: 'ir:recepcion' },
    { texto: 'Exportar lo que está a la vista', icono: 'exportar', accion: 'exportar' },
    { texto: 'Imprimir la pantalla', icono: 'imprimir', accion: 'imprimir' },
    { texto: 'Reiniciar a datos de demostración', icono: 'refrescar', accion: 'reiniciar' },
    { texto: 'Volver a la torre de control', icono: 'torre', accion: 'inicio' }
  ],
  Edición: [
    { texto: 'Ir a un módulo', icono: 'buscar', accion: 'ir-modulo' }
  ],
  Ver: [
    { texto: 'Cambiar entre tema claro y oscuro', icono: 'config', accion: 'tema' },
    { texto: 'Torre de control', icono: 'torre', accion: 'ir:torre' },
    { texto: 'Taller', icono: 'taller', accion: 'ir:taller' },
    { texto: 'Configuración', icono: 'config', accion: 'ir:configuracion' }
  ],
  /* Los tres reportes, y sólo esos (16-08-2026, Marco). «Venta parada por
     presupuestos» y «Repuestos pendientes» salieron: no eran reportes, eran
     atajos a dos paneles operativos que ya están en la barra lateral, y con
     otro nombre — el mismo lugar llamado de dos formas distintas. */
  Reportes: [
    { texto: 'Consolidado', icono: 'consolidado', accion: 'ir:consolidado' },
    { texto: 'Histórico', icono: 'historico', accion: 'ir:historico' },
    { texto: 'Reportería (gráficos)', icono: 'consolidado', accion: 'reporteria' }
  ]
};

function montarBarraMenu() {
  document.querySelectorAll('.barra-menu .mnu').forEach((m) => {
    const items = MENUS[m.textContent.trim()];
    // Si algún día se agrega un menú sin acciones, se saca del HTML antes que
    // dejarlo puesto sin hacer nada.
    if (!items) { m.remove(); return; }
    m.classList.add('con-menu');
    m.addEventListener('click', (ev) => { ev.stopPropagation(); abrirMenu(m, items); });
  });
  document.addEventListener('click', cerrarMenus);
}

function cerrarMenus() {
  document.querySelectorAll('.desplegable').forEach((d) => d.remove());
  document.querySelectorAll('.barra-menu .mnu.abierto').forEach((m) => m.classList.remove('abierto'));
}

function abrirMenu(elemento, items) {
  const yaAbierto = elemento.classList.contains('abierto');
  cerrarMenus();
  if (yaAbierto) return;
  elemento.classList.add('abierto');
  const caja = document.createElement('div');
  caja.className = 'desplegable';
  caja.style.left = Math.round(elemento.getBoundingClientRect().left) + 'px';
  caja.style.top = Math.round(elemento.getBoundingClientRect().bottom) + 'px';
  caja.innerHTML = items.map((i) =>
    '<button type="button" data-accion="' + i.accion + '">' + ico(i.icono) + esc(i.texto) + '</button>').join('');
  document.body.appendChild(caja);
  caja.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-accion]');
    if (!b) return;
    cerrarMenus();
    ejecutarAccion(b.dataset.accion);
  });
}

function ejecutarAccion(accion) {
  if (accion === 'inicio') return ir('torre');
  if (accion.indexOf('ir:') === 0) return ir(accion.slice(3));
  if (['exportar', 'imprimir', 'buscar', 'refrescar'].includes(accion)) return accionModulo(accion);
  if (accion === 'tema') return aplicarTema(document.documentElement.dataset.tema === 'oscuro' ? 'claro' : 'oscuro');
  if (accion === 'ir-modulo') return dialogoIrAModulo();

  /* Reportería no es un módulo de la barra lateral: es la segunda hoja del
     Histórico —la misma que en el sistema actual abre «Ver estadísticas»—, y
     por eso se llega poniendo al Histórico en esa hoja y yendo ahí. Si algún
     día pasa a ser un módulo propio, esto es una línea menos, no una línea
     distinta. */
  if (accion === 'reporteria') {
    historicoEstado().vista = 'reporteria';
    return ir('historico');
  }

  if (accion === 'acerca') {
    return dialogo('Automotora DyP · Control de Taller', `
      <p>Esto <strong>no es el sistema</strong>: es un modelo para probar cómo debería funcionar,
      con datos inventados y rotulados como tales. Corre entero en este computador, sin internet y
      sin base de datos.</p>
      <p>Está construido sobre el levantamiento del sistema actual —<strong>39 pantallas revisadas
      una por una</strong>— y la auditoría. Cada pantalla dice qué se copió igual, qué se corrigió y
      qué no se replica.</p>
      <p class="pie-nota">Arttmize SpA · La documentación completa está en la carpeta del proyecto:
      el levantamiento, la auditoría y <span class="cod">DECISIONES-REPLICA</span>, que es el
      documento que responde <em>"¿y por qué esto no es igual?"</em>.</p>`);
  }

  if (accion === 'guia') {
    return dialogo('Qué se puede probar acá', `
      <p class="pie-nota" style="margin:0 0 10px">La guía completa —para qué sirve cada pantalla, qué
      alimenta y qué probar— está en <span class="cod">Capacitación\Guía de uso y prueba.pdf</span>.
      Esto es el resumen de lo que vale la pena mostrar.</p>
      <div class="grid-envoltorio"><table class="grid"><thead><tr>
        <th>Dónde</th><th>Qué demuestra</th></tr></thead><tbody>
        <tr><td><strong>Configuración → Etapas</strong></td><td>Agregar una décima etapa sin
          programador. Es literalmente lo que se pidió al decir "escalable".</td></tr>
        <tr><td><strong>Recepción</strong></td><td>Un ingreso con <strong>dos siniestros</strong>
          genera dos OT. Y las fotos se comprimen solas: se ve el peso antes y después.</td></tr>
        <tr><td><strong>Datos de demostración → Adelantar la fecha</strong></td><td>Los <strong>tres
          relojes</strong>: el de reparación se detiene cuando el auto sale y se reanuda al volver.</td></tr>
        <tr><td><strong>Ficha → Acciones</strong></td><td>Regrabar el mismo estado
          <strong>no mueve ningún contador</strong>. Es el defecto central del sistema actual.</td></tr>
        <tr><td><strong>Presupuesto</strong></td><td>Cuánta <strong>venta hay parada</strong> en el
          taller y cuánta espera aprobación de la compañía.</td></tr>
        <tr><td><strong>Selector de rol</strong> (arriba)</td><td>El operario ve las líneas del
          presupuesto pero no los valores.</td></tr>
        <tr><td><strong>Presupuesto → una OR</strong></td><td>El <strong>tempario</strong> por las
          horas de DM, Reparar y Pintar. Una pieza puede reparar <em>y</em> pintar, y el repuesto
          que pone la compañía no se cobra. Los repuestos bajan solos a Bodega al aprobar.</td></tr>
        <tr><td><strong>Datos de demostración → Probar reglas</strong></td><td>Cada prueba intenta algo
          prohibido y falla <em>por la regla</em>, con el motivo explicado. Una compara la
          aritmética contra el PDF real de la OR 23505-18401-001.</td></tr>
      </tbody></table></div>`);
  }

  /* Adelantar el calendario es lo que hace demostrables los tres relojes: sin
     esto no se puede ver que la reparación se detiene al salir y se reanuda
     al volver. Funciona porque NINGÚN contador está guardado — todos se
     derivan de `ot_estadia`. Es el paso 14 del guion. */
  if (accion === 'adelantar' || accion === 'fecha-hoy') {
    HOY = accion === 'adelantar'
      ? new Date(HOY.getTime() + 7 * 86400000)
      : new Date(HOY_ORIGINAL.getTime());
    Modelo.fijar_rol_actual(Modelo.rolActual().id);   // invalida los memos
    if (ui.registroOT) modoRegistro(ui.registroOT); else render();
    return avisar({ ok: true, motivo: '' }, 'La fecha del sistema es ahora ' + fFechaHora(HOY) +
      '. Los tres relojes se recalcularon solos: ninguno está guardado.');
  }

  if (accion === 'reiniciar') {
    if (!confirm('Se van a borrar los cambios y el sistema vuelve a los datos de demostración.\n\n¿Continuar?')) return;
    Modelo.reiniciar();
    ir('torre');
    return dialogo('Datos de demostración restaurados',
      '<p>El sistema volvió a la semilla: ' + Modelo.metricas().enTorre + ' vehículos en la torre, ' +
      Modelo.metricas().conRepuestoPendiente + ' con repuesto pendiente.</p>');
  }

  if (accion === 'pruebas') {
    const r = Pruebas.correr();
    const pasaron = r.filter((x) => x.paso).length;
    return dialogo('Reglas de negocio · ' + pasaron + ' de ' + r.length + ' pruebas pasaron',
      '<p class="pie-nota" style="margin:0 0 10px">Cada prueba intenta algo que el negocio prohíbe. ' +
      'Tiene que fallar <strong>por la regla</strong> y con un motivo explicado, no por un botón ' +
      'deshabilitado. Corren sobre una copia aislada: no tocan tus datos.</p>' +
      '<div class="grid-envoltorio"><table class="grid"><thead><tr>' +
      '<th style="width:26px"></th><th>Regla</th><th>Intento</th><th>Resultado</th></tr></thead><tbody>' +
      r.map((x) => '<tr><td>' + (x.paso ? '<span class="et verde">OK</span>' : '<span class="et roja">Falló</span>') +
        '</td><td><strong>' + esc(x.nombre) + '</strong></td>' +
        '<td style="color:var(--gris)">' + esc(x.intento) + '</td>' +
        '<td>' + esc(x.detalle) + '</td></tr>').join('') +
      '</tbody></table></div>');
  }

  if (accion === 'cifras') {
    const c = Pruebas.comprobarCifras();
    return dialogo('Cifras de la demostración',
      '<p class="pie-nota" style="margin:0 0 10px">Control de que los datos de demostración siguen ' +
      'cuadrando con lo que se declaró en la reunión.</p>' +
      '<div class="grid-envoltorio"><table class="grid"><thead><tr>' +
      '<th style="width:26px"></th><th>Cifra</th><th class="num">En el sistema</th>' +
      '<th class="num">Declarado</th></tr></thead><tbody>' +
      c.map((x) => '<tr><td>' + (x.paso ? '<span class="et verde">OK</span>' : '<span class="et roja">≠</span>') +
        '</td><td>' + esc(x.nombre) + '</td><td class="num">' + x.real + '</td>' +
        '<td class="num">' + x.referencia + '</td></tr>').join('') +
      '</tbody></table></div>');
  }
}

/* ───────────────── Aviso de resultado ─────────────────
   Es donde las reglas se vuelven visibles. Cuando una rechaza, el usuario ve
   POR QUÉ. Nunca deshabilitamos el botón: se aprieta, y si no corresponde se
   explica. */

function avisar(resultado, textoOk, opciones) {
  const caja = document.getElementById('avisos') || (function () {
    const c = document.createElement('div');
    c.id = 'avisos'; c.className = 'avisos';
    document.body.appendChild(c);
    return c;
  })();
  const a = document.createElement('div');
  a.className = 'aviso ' + (resultado.ok ? 'ok' : 'rechazo');
  a.setAttribute('role', 'status');
  a.innerHTML = ico(resultado.ok ? 'check' : 'alerta') +
    '<span>' + esc(resultado.ok ? (textoOk || 'Listo.') : resultado.motivo) + '</span>' +
    '<button class="cerrar" type="button" aria-label="Cerrar">&times;</button>';
  caja.appendChild(a);
  const quitar = () => a.remove();
  a.querySelector('.cerrar').addEventListener('click', quitar);
  /* Los rechazos se quedan más rato: hay que poder leerlos. Y `persistente` no
     se va solo: es para lo que hay que leer sí o sí —por ejemplo, que los datos
     de demostración se volvieron a cargar—. Con 3,5 segundos, el que estaba
     mirando otra cosa se lo pierde y después no entiende por qué la pantalla
     cambió sola. Se cierra con la ×. */
  if (!(opciones && opciones.persistente)) setTimeout(quitar, resultado.ok ? 3500 : 9000);
  return resultado.ok;
}

/* Ejecuta un procedimiento del repositorio y refresca la pantalla actual.
   Ojo: la ficha de una OT se puede estar mostrando por dirección (`#ot=`) o
   porque alguien la abrió desde adentro. Hay que refrescar la que está a la
   vista, no la que dice la dirección. */
/* `textoOk` puede ser una FUNCIÓN que recibe el resultado. Sirve cuando el
   mensaje depende de lo que pasó y no sólo de que haya pasado: "se pidieron 3
   repuestos a bodega" no se puede escribir antes de saber cuántos fueron, y
   contarlo es justo lo que evita que alguien los vaya a escribir de nuevo a
   mano. */
function ejecutar(fn, textoOk, despues) {
  const r = fn();
  avisar(r, typeof textoOk === 'function' ? textoOk(r) : textoOk);
  if (r.ok) {
    if (ui.registroOT) modoRegistro(ui.registroOT); else render();
    if (despues) despues(r);
  }
  return r;
}

/* Diálogo simple para mostrar resultados. */
function dialogo(titulo, cuerpoHTML) {
  document.querySelectorAll('.velo').forEach((v) => v.remove());
  const velo = document.createElement('div');
  velo.className = 'velo';
  velo.innerHTML =
    '<div class="modal" role="dialog" aria-modal="true">' +
      '<div class="modal-cab"><h2>' + esc(titulo) + '</h2>' +
      '<button class="cerrar" type="button" aria-label="Cerrar">&times;</button></div>' +
      '<div class="modal-cuerpo">' + cuerpoHTML + '</div>' +
    '</div>';
  document.body.appendChild(velo);
  const cerrar = () => velo.remove();
  /* Se guardan el cuadro y su cierre para poder enganchar sus botones desde
     afuera: sin esto, un dialogo con opciones era uno que solo sabia
     mostrar texto. */
  dialogo.ultimo = velo;
  dialogo.cerrar = cerrar;
  velo.querySelector('.cerrar').addEventListener('click', cerrar);
  velo.addEventListener('click', (ev) => { if (ev.target === velo) cerrar(); });
  document.addEventListener('keydown', function esc_(ev) {
    if (ev.key === 'Escape') { cerrar(); document.removeEventListener('keydown', esc_); }
  });
}

/* ───────────────── Ir a un módulo ─────────────────
   Se escribe el nombre y lleva ahí. Con trece paneles repartidos en tres
   grupos, buscar por nombre es más rápido que recorrer el menú con el mouse,
   y sirve igual cuando se está en la ficha de una OT, que no tiene menú.

   Busca también por el grupo y por como se le dice de verdad a cada pantalla:
   nadie pregunta por "Detenciones", pregunta por los autos parados. */
const APODOS = {
  mitrabajo:     'lo mio pendientes tareas que me toca pintar reparar',
  recepcion:     'ingreso nuevo vehiculo auto recibir entrada',
  torre:         'ordenes ot listado principal inicio',
  taller:        'etapas tablero piso boxes',
  entrega:       'entregar salida cierre devolver',
  repuestos:     'piezas pedidos proveedor',
  detenidos:     'esperas detenidos parados atrasados fuera de taller',
  presupuesto:   'or venta cotizacion valorizar',
  bodega:        'repuestos checklist recepcion de piezas',
  documentos:    'guias facturas ordenes de compra archivos',
  historico:     'cerradas entregadas buscar antiguas',
  expediente:    'historia trazabilidad registro completo vehiculo compañia respaldo auditoria',
  personal:      'trabajadores gente maestros nomina',
  consolidado:   'reporte totales gerencia',
  configuracion: 'catalogos maestros parametros etapas estados roles'
};

function dialogoIrAModulo() {
  // El grupo de cada módulo sale del propio menú lateral, para no repetirlo.
  const grupos = {};
  let actual = '';
  MENU.forEach((m) => { if (m.grupo) actual = m.grupo; else grupos[m.id] = actual; });
  const modulos = MENU.filter((m) => m.id);

  const sinTildes = (t) => String(t).toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u');

  dialogo('Ir a un módulo', `
    <div class="campo" style="margin-bottom:10px">
      <input type="search" id="ir-q" autocomplete="off"
             placeholder="Escribe el nombre del módulo: torre, repuestos, bodega…">
    </div>
    <div class="ir-lista" id="ir-lista"></div>`);

  const caja = document.getElementById('ir-q');
  const lista = document.getElementById('ir-lista');

  const coinciden = () => {
    const t = sinTildes(caja.value.trim());
    if (!t) return modulos;
    return modulos.filter((m) =>
      sinTildes(m.nombre + ' ' + grupos[m.id] + ' ' + (APODOS[m.id] || '')).indexOf(t) >= 0);
  };

  const pintar = () => {
    const hay = coinciden();
    lista.innerHTML = hay.length
      ? hay.map((m, i) => '<button type="button" class="ir-item' + (i === 0 ? ' primero' : '') +
          '" data-ira="' + esc(m.id) + '">' + ico(m.icono) +
          '<span class="nom">' + esc(m.nombre) + '</span>' +
          '<span class="gru">' + esc(grupos[m.id]) + '</span></button>').join('')
      : '<div class="vacio" style="padding:22px"><div class="texto">Ningún módulo se llama así. ' +
        'Prueba con <strong>torre</strong>, <strong>repuestos</strong> o <strong>bodega</strong>.</div></div>';
    lista.querySelectorAll('[data-ira]').forEach((b) => b.addEventListener('click', () => {
      cerrarDialogos();
      ir(b.dataset.ira);
    }));
  };

  caja.addEventListener('input', pintar);
  caja.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    const primero = coinciden()[0];
    if (!primero) return;
    ev.preventDefault();
    cerrarDialogos();
    ir(primero.id);
  });

  pintar();
  caja.focus();
}

const cerrarDialogos = () => document.querySelectorAll('.velo').forEach((v) => v.remove());

function ir(vista) {
  /* El menú ya esconde lo que la cuenta no puede ver, pero al módulo se llega
     por más caminos que el menú: la dirección `#vista=historico`, "Ir a un
     módulo" (Ctrl+G), un botón que salta de una pantalla a otra. Si el permiso
     solo se revisara al pintar el menú, bastaba con escribir la dirección.
     Se revisa acá, que es por donde pasan todos. */
  /* El motivo distingue las dos formas de quedar afuera, porque se arreglan en
     lugares distintos: la lista de módulos vive en la ficha de la cuenta, en
     Personal, y el permiso del rol en Configuración. */
  if (!entraAlModulo(vista)) {
    const p = Modelo.personaActual();
    const conLista = !!Modelo.modulosDe(p && p.id);
    avisar({ ok: false, motivo: conLista
      ? 'La cuenta de ' + [p.nombres, p.apellidos].filter(Boolean).join(' ') + ' no tiene «' +
        (TITULOS[vista] || vista) + '» entre sus módulos. Se cambia en Personal, en la ficha de ' +
        'la cuenta.'
      : 'El rol ' + (Modelo.rolActual().nombre || '—') + ' no tiene acceso a «' +
        (TITULOS[vista] || vista) + '». Se administra en Configuración → Roles y permisos.' });
    /* Se repinta SIEMPRE, no sólo cuando hay que caer a otra pantalla. Un
       rebote que no repinta deja el marco como estaba antes, y así la barra de
       estado se quedó diciendo «Dueño» con Andrés Guzmán ya adentro: la
       navegación falló, nadie volvió a dibujar, y lo viejo quedó a la vista. */
    if (!MODULOS[ui.vista]) ui.vista = 'mitrabajo';
    render();
    return;
  }

  /* Si veníamos de la ventana de una OT hay que devolver el marco completo:
     esa ventana esconde el menú lateral y nunca lo dibujó. Sin esto, "Ir a un
     módulo" desde una ficha deja la pantalla sin menú. */
  if (ui.registroOT) {
    ui.registroOT = null;
    document.body.classList.remove('ventana-registro');
    document.title = 'Automotora DyP · Control de Taller';
    if (window.location.hash.indexOf('ot=') >= 0) window.location.hash = 'vista=' + vista;
    pintarMenu();
    montarRol();
  }
  /* 🔶 SALIR DE RECEPCIÓN DESCARTA EL INGRESO A MEDIO LLENAR (15-08-2026,
     pedido del cliente): *"si uno sale del proceso que se borre lo que habían
     registrado a medias"*.

     Antes el borrador sobrevivía y el menú lo anunciaba con un cartel. El
     problema no era guardarlo: era que nadie sabía de QUÉ auto era. Un ingreso
     a medias sin dueño reaparece días después y hay que abrirlo para
     descubrirlo, y mientras tanto ensucia el menú.

     ⚠️ La contracara, y hay que decirla: si alguien está llenando una recepción
     y se va a la Torre a mirar algo, al volver empieza de nuevo. Es lo pedido,
     y es la razón por la que `Descartar borrador` sigue existiendo aparte —
     ahora es explícito, no la única salida. */
  if (ui.vista === 'recepcion' && vista !== 'recepcion' && typeof limpiarBorrador === 'function') {
    limpiarBorrador();
  }

  ui.vista = vista;
  /* Entrega ya no tiene ítem propio en el menú: se llega desde Recepción, así
     que estando ahí el que se ilumina es Recepción. Sin esto el menú queda sin
     nada marcado y uno no sabe en qué parte del sistema está. */
  const marcado = vista === 'entrega' ? 'recepcion' : vista;
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('activo', a.dataset.vista === marcado));
  const c = document.getElementById('contenido');
  if (c) c.scrollTop = 0;
  render();
}

/* ───────────────── Render principal ───────────────── */

/* Solo el nombre del módulo. La bajada que explicaba qué hacía cada pantalla
   se sacó (decisión del 13-08-2026): quien opera el sistema ya lo sabe, y
   ocupaba la franja más visible con texto que nadie vuelve a leer. Lo que
   había ahí vive ahora en el manual de la carpeta Capacitación. */
const TITULOS = {
  mitrabajo:     'Mi trabajo',
  recepcion:     'Nuevo ingreso',
  torre:         'Torre de control',
  taller:        'Taller',
  repuestos:     'Repuestos',
  detenidos:     'Detenciones',
  presupuesto:   'Presupuesto',
  historico:     'Histórico',
  expediente:    'Expediente del vehículo',
  configuracion: 'Configuración',
  entrega:       'Entrega',
  bodega:        'Bodega',
  documentos:    'Documentos',
  personal:      'Personal',
  consolidado:   'Consolidado'
};

// Qué muestra la barra de estado en cada módulo. Un ERP siempre dice cuántos
// registros tiene a la vista: es lo primero que mira el que opera.
const ESTADO_BARRA = {
  torre:     () => '<strong>' + filtrarTorre().length + '</strong> de ' + Modelo.torre().length + ' órdenes',
  taller:    () => '<strong>' + Modelo.metricas().enTaller + '</strong> vehículos en taller',
  repuestos: () => '<strong>' + Modelo.metricas().repuestosPendientes + '</strong> repuestos pendientes',
  detenidos: () => '<strong>' + Modelo.metricas().conRepuestoPendiente + '</strong> vehículos esperando',
  historico: () => '<strong>' + Modelo.historico({ todo: true }).length + '</strong> vehículos entregados',
  recepcion: () => {
    const r = rec();
    // En el menú de opciones todavía no hay nada que contar.
    if (r.pantalla === 'menu') return '<strong>' + RECEPCION_OPCIONES.length + '</strong> opciones';
    if (r.pantalla === 'editar' || r.pantalla === 'or') return 'Buscar por patente';
    // Cuántos ítems del checklist se revisaron de verdad. Contar "presentes"
    // escondía que la mayoría podía estar sin mirar.
    const total = Modelo.catalogo('inventario_item').length;
    const vistos = Object.keys(r.inventario)
      .filter((k) => r.inventario[k] && r.inventario[k] !== 'sin_verificar').length;
    return '<strong>' + r.bloques.length + '</strong> ' + (r.bloques.length === 1 ? 'orden' : 'órdenes') +
      ' · ' + r.danos.length + ' daños · ' + vistos + '/' + total + ' ítems verificados · ' +
      r.fotos.length + ' fotos';
  },
  configuracion: () => {
    const s = CONFIG_SECCIONES.find((x) => x.id === cfg().seccion) || {};
    const n = (Modelo.base()[cfg().seccion] || []).length;
    return '<strong>' + esc(s.nombre || '') + '</strong>' + (n ? ' · ' + n + ' registros' : '');
  },
  personal:    () => '<strong>' + Modelo.personal().filter((p) => p.activo).length + '</strong> trabajadores activos',
  consolidado: () => '<strong>' + Modelo.torre().length + '</strong> órdenes vivas',
  bodega:      () => '<strong>' + Modelo.metricas().repuestosPendientes + '</strong> piezas sin llegar',
  documentos:  () => '<strong>' + Modelo.torre().length + '</strong> órdenes con documentos posibles',
  entrega:     () => '<strong>' + Modelo.metricas().enTaller + '</strong> vehículos en condiciones de entrega'
};

function render() {
  const m = MENU.find((x) => x.id === ui.vista);
  document.getElementById('titulo').innerHTML =
    (m ? ico(m.icono, 'g') : '') +
    esc(enReporteria() ? 'Reportería' : (TITULOS[ui.vista] || ''));
  document.getElementById('bajada').textContent = '';

  pintarShell();

  const c = document.getElementById('contenido');
  const fn = {
    mitrabajo: vMiTrabajo, recepcion: vRecepcion, torre: vTorre, taller: vTaller, entrega: vEntrega,
    repuestos: vRepuestos, detenidos: vDetenidos, presupuesto: vPresupuesto,
    bodega: vBodega, documentos: vDocumentos, historico: vHistorico,
    expediente: vExpediente,
    personal: vPersonal, consolidado: vConsolidado, configuracion: vConfiguracion
  }[ui.vista];
  c.innerHTML = fn ? fn() : vSinLevantar(ui.vista);
  if (fn) {
    const p = { mitrabajo: pMiTrabajo, recepcion: pRecepcion, torre: pTorre, taller: pTaller, entrega: pEntrega,
      repuestos: pRepuestos, detenidos: pDetenidos, presupuesto: pPresupuesto, bodega: pBodega,
      documentos: pDocumentos, historico: pHistorico, expediente: pExpediente,
      personal: pPersonal,
      consolidado: pConsolidado, configuracion: pConfiguracion }[ui.vista];
    if (p) p();
  }

  /* Las imágenes se resuelven ACÁ, después de cada render, y no en cada
     pantalla por su cuenta.

     El HTML trae `<img data-media="id">` sin `src`: los bytes viven en
     IndexedDB y hay que ir a buscarlos. Eso lo hace `Media.pintar()`, que
     estaba llamado a mano en cuatro pantallas —torre, recepción, ficha y la
     zona de fotos— y en las demás no. Por eso en Documentos las fotos de la
     recepción salían como recuadros rotos con el nombre del archivo: nadie las
     había pintado. Puesto en el render vale para las catorce y para las que
     vengan, que es lo que se pidió: al pasar de un panel a otro tiene que
     verse bien siempre. */
  Media.pintar(c);

  // Misma razón que Media.pintar: acá vale para todos los paneles y para los
  // que vengan, en vez de tener que acordarse de llamarlo en cada vista.
  marcarEtiquetas();
  mejorarTablas();

  const f = ESTADO_BARRA[ui.vista];
  pintarBarraEstado(f ? f() : '');
}

/* --- Vistas en archivos aparte ---
   Agenda del dia: ELIMINADA. El agendamiento automatico no existe en
                   ninguna de las 39 pantallas del sistema actual.
                   Ver DECISIONES-REPLICA_2026-08-12.md
   Recepcion:      js/vistas/recepcion.js
   Torre:          js/vistas/torre.js
   Silueta:        js/vistas/silueta.js  (recepcion y ficha la comparten)
   Configuracion:  js/vistas/configuracion.js                          */

/* ───────────────── Vista · Taller ─────────────────
   Se mudó a js/vistas/taller.js el 15-08-2026, cuando pasó a tener dos
   apartados —el listado de órdenes y el tablero por etapa—. Era la única
   pantalla que seguía viviendo acá; ahora se cumple la regla de la casa de
   una vista por archivo. */

/* ───────────────── Vista · Repuestos ───────────────── */

/* El buscador de esta pantalla. Bodega busca por patente en su check-list y la
   torre en la suya; acá no había ninguno, y buscar por patente es exactamente
   lo que se hace cuando el cliente llama preguntando por su repuesto. Busca
   por patente, número de OT y descripción de la pieza: son las tres formas en
   que uno llega a un repuesto. */
function repuestosEstado() {
  ui.repuestos = ui.repuestos || { busqueda: '' };
  return ui.repuestos;
}

function vRepuestos() {
  const e = repuestosEstado();
  const q = e.busqueda.trim().toLowerCase();
  const todas = [];
  Modelo.torre().forEach((o) => o.repuestos.filter((r) => r.estado !== 'recibido').forEach((r) => todas.push({ o, r })));

  const filas = todas.filter(({ o, r }) => !q ||
    [o.patente, o.numeroOT, r.descripcion].join(' ').toLowerCase().includes(q));
  filas.sort((a, b) => (a.r.fechaPedido && b.r.fechaPedido ? a.r.fechaPedido - b.r.fechaPedido : 0));


  return `
  <div class="panel">
    <div class="cab"><div><h2>Repuestos pendientes</h2>
      <div class="desc">Los operarios marcan la recepción acá. Ordenado por antigüedad del pedido.</div></div>
      <div class="filtros"><input type="search" id="rep-q" placeholder="Patente, OT o repuesto"
        value="${esc(e.busqueda)}"></div></div>
    ${q && !filas.length ? `<div class="cuerpo"><div class="vacio">${ico('buscar')}
      <div class="titulo">Ningún repuesto pendiente para «${esc(e.busqueda)}»</div>
      <div class="texto">Puede que ya haya llegado: los recibidos salen de esta lista.
      En la ficha de la orden están todos, con su fecha de llegada.</div></div></div>` : ''}
    <div class="grid-envoltorio"><table class="grid">
      <thead><tr><th>OT</th><th>Patente</th><th>Repuesto</th><th>Cant.</th><th>Paga</th><th>Pedido</th>
        <th>Días</th><th>Estado</th><th>Vehículo</th><th>Observación</th><th></th></tr></thead>
      <tbody>${filas.slice(0, 40).map(({ o, r }) => {
        const dentro = o.enTaller;
        const dp = r.fechaPedido ? nDias(r.fechaPedido) : null;
        /* Se sacaron PROVEEDOR y EST. LLEGADA. No es un ajuste de estilo: los
           dos campos están en `null` en el modelo porque el sistema actual no
           los guarda —ver `vistaOT`—, así que eran dos columnas condenadas a
           salir vacías siempre. Un repuesto recién generado desde el
           presupuesto se veía a medias por eso.

           En su lugar van CANTIDAD y PAGA, que sí vienen con el dato y son lo
           que hay que saber: cuántas piezas y de quién es la plata. El
           responsable de pago fue un punto explícito del levantamiento —"es
           plata del taller"— y no se estaba mostrando en ninguna parte. */
        return '<tr class="fila" data-ot="' + esc(o.numeroOT) + '"><td class="num">' + o.numeroOT + '</td>' +
          '<td><span class="patente">' + esc(o.patente) + '</span></td>' +
          '<td>' + esc(r.descripcion) + '</td>' +
          '<td class="num">' + (r.cantidad || 1) + '</td>' +
          '<td>' + (r.responsablePago
            ? '<span class="et ' + (r.pagaTaller ? 'roja' : 'gris') + '">' + esc(r.responsablePago) + '</span>'
            : '<span class="et roja">sin declarar</span>') + '</td>' +
          '<td class="num">' + (r.fechaPedido ? fFechaHora(r.fechaPedido) : '—') + '</td>' +
          '<td class="num">' + (dp === null ? '—' : (dp > 20 ? '<span style="color:var(--rojo);font-weight:700">' + dp + '</span>' : dp)) + '</td>' +
          '<td><span class="et ' + ESTADO_REPUESTO[r.estado].clase + '">' + esc(ESTADO_REPUESTO[r.estado].txt) + '</span></td>' +
          '<td>' + (dentro ? '<span class="et roja">En taller</span>' : '<span class="et ambar">Fuera</span>') + '</td>' +
          '<td>' + (r.observacion ? '<span class="et gris">' + esc(r.observacion) + '</span>' : '') + '</td>' +
          '<td><button class="btn secundario" data-recibido="' + esc(r.id) + '">Marcar recibido</button></td></tr>';
      }).join('')}</tbody>
    </table></div>
    <div class="pie-grid"><div class="info">Mostrando ${Math.min(40, filas.length)} de ${filas.length}${
      q ? ' · filtrado de ' + todas.length : ' · los más antiguos primero'}.</div></div>
  </div>`;
}

function pRepuestos() {
  // Doble clic abre la orden en pestaña nueva, igual que en la torre.
  dobleClicPorFilas();
  const e = repuestosEstado();
  const q = document.getElementById('rep-q');
  if (q) q.addEventListener('input', () => {
    e.busqueda = q.value; render();
    // El render rehace el input, así que hay que devolverle el foco y el cursor
    // al final. Sin esto se escribe una letra y el teclado se pierde.
    const n = document.getElementById('rep-q');
    if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
  });

  document.querySelectorAll('[data-recibido]').forEach((b) => b.addEventListener('click', () =>
    ejecutar(() => Modelo.recibir_repuesto(b.dataset.recibido), 'Repuesto recibido en bodega.')));
}

/* ───────────────── Vista · Detenciones ───────────────── */

/* "Ver cuáles" lleva a la Torre con ese mismo grupo filtrado. Una cifra de
   espera sin poder llegar a los autos que la componen no sirve para actuar. */
function pDetenidos() {
  // Doble clic abre la orden en pestaña nueva, igual que en la torre.
  dobleClicPorFilas();
  document.querySelectorAll('[data-espera-ver]').forEach((b) => b.addEventListener('click', () => {
    ui.torre.situacion = b.dataset.esperaVer;
    ui.torre.pagina = 1; ui.torre.abierta = null; ui.torre.busqueda = '';
    ir('torre');
  }));
}

function vDetenidos() {
  const maxDias = Math.max(...Modelo.corteEspera().map((d) => d.diasAcumulados), 1);
  const fuera = Modelo.torre().filter((o) => o.fueraDeTaller).sort((a, b) => b.diasFuera - a.diasFuera);

  return `
  <div class="panel">
    <div class="cab"><div><h2>¿Por qué no avanza?</h2>
      <div class="desc">Los tres motivos, con los días acumulados <strong>al ${fFechaHora(HOY)}</strong>.
        Cada día que pasa sin resolverse, estos números suben solos</div></div></div>
    <div class="grid-envoltorio"><table class="grid">
      <thead><tr><th>Situación</th><th>Qué significa</th><th>Vehículos</th>
        <th title="Suma de los días que lleva esperando cada vehículo de este grupo, contados hasta hoy">Días acumulados</th>
        <th title="Días acumulados dividido por la cantidad de vehículos">Promedio</th>
        <th style="width:150px">Peso</th><th>Valor detenido</th><th></th></tr></thead>
      <tbody>${Modelo.corteEspera().map((d) =>
        '<tr><td><strong>' + esc(d.grupo) + '</strong></td>' +
        '<td style="color:var(--gris);font-size:12.5px;max-width:300px">' + esc(d.detalle) + '</td>' +
        '<td class="num">' + d.vehiculos + '</td><td class="num"><strong>' + d.diasAcumulados + '</strong></td>' +
        '<td class="num">' + (d.vehiculos ? Math.round(d.diasAcumulados / d.vehiculos) : 0) + ' d</td>' +
        '<td><div class="barra-fondo"><div class="barra-relleno" style="width:' +
        Math.round((d.diasAcumulados / maxDias) * 100) + '%"></div></div></td>' +
        '<td class="num">' + fMonto(d.valor) + '</td>' +
        '<td>' + (d.filtro
          ? '<button class="btn secundario" data-espera-ver="' + esc(d.filtro) + '">Ver cuáles</button>'
          : '') + '</td></tr>').join('')}</tbody>
      <tfoot><tr><td colspan="3" style="text-align:right">Total detenido al ${fFechaHora(HOY)}</td>
        <td class="num"><strong>${Modelo.corteEspera().reduce((s, d) => s + d.diasAcumulados, 0)}</strong></td>
        <td colspan="2"></td>
        <td class="num"><strong>${fMonto(Modelo.corteEspera().reduce((s, d) => s + d.valor, 0))}</strong></td>
        <td></td></tr></tfoot>
    </table></div>
  </div>

  <div class="panel">
    <div class="cab"><div><h2>Vehículos fuera de taller</h2>
      <div class="desc">Están con el cliente. El que más lleva esperando va primero.</div></div></div>
    <div class="grid-envoltorio"><table class="grid">
      <thead><tr><th>OT</th><th>Patente</th><th>Cliente</th><th>Compañía</th>
        <th>Fuera hace</th><th>Desde el ingreso</th><th>Repuestos por llegar</th><th>Valor</th></tr></thead>
      <tbody>${fuera.map((o) => {
        const pend = o.repuestos.filter((r) => r.estado !== 'recibido').length;
        return '<tr class="fila" data-ot="' + esc(o.numeroOT) + '"><td class="num">' + o.numeroOT + '</td>' +
          '<td><span class="patente">' + esc(o.patente) + '</span></td>' +
          '<td>' + esc(o.cliente) + '</td>' +
          '<td><span class="et ' + (o.compania === 'SURA' ? 'azul' : 'violeta') + '">' + esc(o.compania) + '</span></td>' +
          '<td class="num"><strong style="color:' + (o.diasFuera > 30 ? 'var(--rojo)' : 'var(--ambar)') + '">' +
            o.diasFuera + ' días</strong></td>' +
          '<td class="num">' + o.diasTotales + ' días</td>' +
          '<td class="num">' + (pend || '<span style="color:var(--verde)">listo para volver</span>') + '</td>' +
          '<td class="num">' + fMonto(totalOT(o)) + '</td></tr>';
      }).join('')}</tbody>
    </table></div>
  </div>
`;
}

/* Presupuesto -> js/vistas/presupuesto.js
   Historico y Consolidado -> js/vistas/historico.js                    */

/* ───────────────── Vista · paneles sin levantar ───────────────── */

const SIN_LEVANTAR = {
  personal: {
    titulo: 'Personal',
    texto: 'Este panel existe en el sistema actual, pero no se levantó qué hace. Sin eso, cualquier pantalla que dibujemos sería inventada.',
    preguntas: ['¿Es asignación de operarios a órdenes de trabajo, o control de asistencia?',
      '¿Mide productividad o rendimiento por operario?', '¿Se pagan tratos o comisiones por trabajo terminado?',
      '¿Quién puede ver la información de cada persona?']
  },
  documentos: {
    titulo: 'Documentos',
    texto: 'Panel del sistema actual sin definición levantada.',
    preguntas: ['¿Qué documentos se guardan: órdenes de reparación, actas de entrega, fotos, facturas?',
      '¿Quién los sube y quién los puede ver?', '¿Alguno tiene vencimiento o requiere firma?',
      '¿Se envían a la aseguradora desde el sistema?']
  },
  bodega: {
    titulo: 'Bodega',
    texto: 'Panel del sistema actual sin definición levantada, y el que más riesgo tiene para el presupuesto del proyecto.',
    preguntas: ['El sitio de Automotora DyP vende repuestos (aceites, mecánica y motor, marcas Peugeot, Chevrolet, Opel y Toyota). ¿Bodega es inventario de venta, o solo repuestos de las órdenes de trabajo?',
      'Si es inventario de venta, es un módulo completo aparte: stock, costos, precios, proveedores y salidas.',
      '¿Hay control de stock mínimo, o se pide contra cada orden?',
      '¿Se factura repuesto al cliente directo, además de a la aseguradora?'],
    critico: true
  },
  consolidado: {
    titulo: 'Consolidado',
    texto: 'Panel del sistema actual sin definición levantada.',
    preguntas: ['¿Es un reporte de gestión, un cierre de mes, o la liquidación contra las aseguradoras?',
      '¿Qué cifras tiene que mostrar y a quién?', '¿Con qué periodicidad se revisa?',
      '¿Se exporta a Excel o se imprime?']
  },
  configuracion: {
    titulo: 'Configuración',
    texto: 'Parcialmente cubierto por el diseño: catálogos de etapas, compañías, motivos e ítems de inventario, más roles y permisos. Falta el resto.',
    preguntas: ['¿Qué más se configura hoy desde este panel?', '¿Quién tiene acceso a cambiarlo?',
      '¿Hay parámetros de numeración de OT u OR que dependan de la aseguradora?']
  }
};

function vSinLevantar(id) {
  const p = SIN_LEVANTAR[id];
  if (!p) return '<div class="vacio"><div class="titulo">Sin datos</div></div>';
  return `
  <div class="panel">
    <div class="cuerpo">
      <div class="vacio">
        ${ico('candado')}
        <div class="titulo">Módulo pendiente de construir</div>
        <div class="texto">${esc(p.texto)}</div>
        <ul class="lista">${p.preguntas.map((q) => '<li>' + esc(q) + '</li>').join('')}</ul>
      </div>
    </div>
  </div>
`;
}

/* ───────────────── Ventana de registro: una OT en su propia pestaña ─────────────────
   Es como funciona el sistema actual: el dueño hace doble clic sobre la fila y se
   abre una pestaña nueva con esa orden sola. La ventaja de fondo es que cada OT
   pasa a tener su propia dirección, así que se puede enviar el enlace de una orden
   a quien sea en vez de explicarle dónde buscarla. */

// Se acepta tanto `?ot=24223` como `#ot=24223`. El ancla es la que se usa para
// abrir, porque funciona igual sirviendo el sistema desde el servidor local que
// abriendo el archivo directo con doble clic, y ahí la parte `?` se pierde.
const PARAM_OT = (function () {
  try {
    const q = new URLSearchParams(window.location.search).get('ot');
    if (q) return q;
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    // `#vista=bodega&ot=23330` NO es la ventana de una orden: es un módulo que
    // se abre parado en esa orden. Solo `#ot=` sola abre la ficha aislada.
    if (h.get('vista')) return null;
    return h.get('ot');
  } catch (e) { return null; }
})();

// En qué pestaña de la orden abrir, si la dirección lo pide (`#ot=N&tab=etapas`),
// y en qué modo dentro de ella (`&modo=asignar`), que es lo que usa el listado
// de Taller: su botón dice `Asignar etapas` y tiene que abrir eso, no otra cosa.
/* Se leen CADA VEZ, no una sola al cargar. `PARAM_OT` puede ser una constante
   porque la ventana de una orden nace con su número; el `tab` no: el enlace se
   comparte, y quien lo recibe puede tener el sistema YA ABIERTO. Ahí el
   navegador no recarga nada —solo cambia el ancla— y una constante calculada
   al arrancar habría quedado con el valor de la dirección anterior, mandando a
   la pestaña equivocada sin ningún error a la vista. */
function paramDelAncla(clave) {
  try {
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (h.get('vista')) return null;
    return h.get(clave);
  } catch (e) { return null; }
}

const PARAM_TAB = () => paramDelAncla('tab');
const PARAM_MODO = () => paramDelAncla('modo');

// Busca en TODAS las órdenes, no solo en la torre y el histórico: una orden
// rechazada o dada por pérdida total también tiene que poder abrirse.
const buscarOT = (n) => Modelo.otPorNumero(n);

/* La dirección puede pedir además EN QUÉ PESTAÑA abrir la orden.

   Lo necesita el listado de Taller: `Asignar etapas` tiene que caer en las
   etapas de esa OT, no en su ficha para que después alguien busque la
   pestaña. Es el mismo gesto del sistema actual, donde el enlace de la lista
   va derecho a `taller-habilitar-etapas&id=23506`.

   Va en la dirección y no en una variable porque la orden se abre en una
   ventana NUEVA: lo que esta pestaña tenga en memoria no la acompaña. */
const urlFicha = (numero, tab, modo) => 'index.html#ot=' + encodeURIComponent(numero) +
  (tab ? '&tab=' + encodeURIComponent(tab) : '') +
  (modo ? '&modo=' + encodeURIComponent(modo) : '');

function abrirFicha(numero, tab, modo) {
  window.open(urlFicha(numero, tab, modo), '_blank', 'noopener');
}

/* ───────────── Doble clic para abrir la orden ─────────────
   El cliente pidió el 15-08-2026 que el doble clic abra la orden desde TODOS
   los paneles, no sólo desde la torre y el histórico.

   Y hay una trampa que costó encontrar la primera vez, así que vive acá una
   sola vez y no repetida en cada panel: cuando el clic simple vuelve a dibujar
   la tabla, la fila se reemplaza y el navegador ya no puede emitir `dblclick`
   —los dos clics caen sobre elementos distintos—. Por eso el doble clic se
   cuenta a mano, con la hora del clic anterior. El `dblclick` nativo se deja
   igual, para los paneles que no repintan.

   `alSimple` es opcional: en los paneles que no despliegan nada, la fila sólo
   responde al doble clic. */
const VENTANA_DOBLE_CLIC = 450;
const memoriaClic = { clave: null, t: 0 };

/* `abridor` acota DESDE DÓNDE se puede abrir con doble clic. Sin él, el gesto
   vive en todo `el` —la fila entera—, que es lo que hacía que seleccionar
   texto de cualquier celda terminara abriendo una pestaña. Con él, el clic
   simple sigue funcionando en toda la fila y el doble clic sólo cuenta sobre
   esa celda. */
function conDobleClic(el, clave, alDoble, alSimple, abridor) {
  const abre = (ev) => !abridor || (ev.target && abridor.contains(ev.target));

  el.addEventListener('click', (ev) => {
    const ahora = new Date().getTime();
    if (memoriaClic.clave === clave && ahora - memoriaClic.t < VENTANA_DOBLE_CLIC && abre(ev)) {
      memoriaClic.clave = null; memoriaClic.t = 0;
      if (alDoble() !== false) return;
    }
    memoriaClic.clave = clave; memoriaClic.t = ahora;
    if (alSimple) alSimple();
  });
  el.addEventListener('dblclick', (ev) => {
    if (!abre(ev)) return;
    ev.preventDefault(); alDoble();
  });

  if (abridor) {
    abridor.classList.add('abre-ot');
    abridor.title = 'Doble clic abre la orden en otra pestaña';
  }
  /* Sin `title`. Lo tenia, y el globo del navegador se montaba encima de la
     etiqueta de datos —que dice bastante mas que el globo— y tapaba la fila de
     abajo. El gesto ya esta explicado en el subtitulo del panel. */
}

/* ───────────── El expandible, en todos los paneles ─────────────
   Pedido del cliente el 15-08-2026: la torre despliega la fila con un clic y
   los demás paneles no. Ahora lo hacen todos, y con el mismo gesto —clic
   despliega, doble clic abre en pestaña nueva—, que es lo que evita tener que
   aprender una interacción distinta por pantalla.

   La fila de detalle se INSERTA en el DOM después de pintar, en vez de armarla
   dentro del HTML de cada vista. Así vale para los seis paneles y para los que
   vengan, sin tocar seis archivos ni repetir el mismo bloque seis veces.

   Cuál está abierta se guarda por panel: abrir una en Presupuesto no tiene por
   qué desplegar nada en Bodega. */
const abiertoPorPanel = {};

/* Abrir o cerrar el detalle de una fila desde AFUERA de la flecha —un botón
   «Ver», por ejemplo—. Existe para que ese botón no se arme su propio estado:
   el Presupuesto tenía el suyo (`p.abierta`) además de éste, y con los dos
   abiertos la fila pintaba la lista DOS VECES. Un solo dueño del estado. */
function alternarDetalle(clave) {
  const v = ui.vista;
  abiertoPorPanel[v] = (abiertoPorPanel[v] === String(clave)) ? null : String(clave);
  render();
}

/* `opciones` es opcional y los seis paneles siguen llamándolo sin nada:

   · soloFlecha  — despliega SÓLO la flecha de la izquierda, no la fila entera,
                   y se olvida del doble clic. Es para las tablas cuyas celdas
                   llevan campos: en Entregar Unidad, elegir el tipo de entrega
                   desplegaba y contraía la fila, porque el clic del desplegable
                   también era un clic en la fila. Pedido del 15-08-2026.
   · detalle     — qué se ve al abrir. Por omisión la ficha completa; el que
                   pasa la suya muestra otra cosa. */
function dobleClicPorFilas(selector, opciones) {
  const op = opciones || {};
  const armarDetalle = op.detalle || detalleDeOT;
  const vista = ui.vista;
  const abierta = abiertoPorPanel[vista] || null;

  document.querySelectorAll(selector || 'tr.fila[data-ot]').forEach((tr) => {
    const n = tr.dataset.ot;
    if (!n) return;

    const alternar = () => {
      abiertoPorPanel[vista] = (abiertoPorPanel[vista] === n) ? null : n;
      render();
    };

    /* La celda de la OT: es la que muestra el mismo número que `data-ot`. Se
       busca por CONTENIDO y no por posición, porque las tablas no tienen la OT
       en la misma columna y esta función además les inserta la flecha adelante.
       Ojo: `data-ot` no siempre es el número —la torre pone el ID—, así que se
       resuelve el número antes de comparar. */
    const orden = Modelo.otPorId(n) || Modelo.otPorNumero(n);
    const numero = orden ? String(orden.numeroOT) : String(n);
    const celdaOT = [...tr.children].find((td) => {
      const t = td.textContent.trim().replace(/\s+/g, ' ');
      return t === numero || t === String(n);
    }) || null;

    /* 🔷 SIN DESPLEGABLE. Bodega lo pidió el 16-08-2026 y Documentos el 17:
       son paneles donde el expandible no aporta —lo que hay que mirar está en
       la ficha, a un doble clic— y lo único que hace es mover la tabla debajo
       del dedo. Acá no se pinta la flecha, no se agrega su columna y el clic
       simple no hace nada; el doble clic en la OT se mantiene, que es el gesto
       con el que se trabaja.

       Va como opción del ayudante compartido y no como un handler propio de
       cada panel: Bodega ya tenía el suyo copiado a mano, y dos copias del
       mismo gesto es como se termina con dos comportamientos distintos. */
    if (op.sinDetalle) {
      conDobleClic(tr, 'ot-' + n, () => { abrirFicha(n); return true; }, null, celdaOT);
      tr.classList.add('solo-flecha');   // el cursor deja de ofrecer la fila como botón
      return;
    }

    /* La flecha va en su PROPIA columna, a la izquierda del número, igual que
       en la torre — que la tiene entre sus 17 columnas. Se inserta acá, junto
       con su encabezado, en vez de agregarle una columna a mano a las seis
       tablas: el que escribe una pantalla nueva no tiene que acordarse. */
    // OJO: no usar 'desplegable' a secas — esa clase ya existe para el menú de
    // la barra superior y es position:fixed. Puesta en un <tr>, lo saca del
    // flujo y la tabla entera colapsa: las filas quedan en el DOM sin verse.
    tr.classList.add('fila-desplegable');
    let flecha = tr.querySelector('td.flecha-col');
    if (!flecha) {
      flecha = document.createElement('td');
      flecha.className = 'flecha-col';
      flecha.innerHTML = '<span class="flecha">&#9656;</span>';
      tr.insertBefore(flecha, tr.firstChild);

      const tabla = tr.closest('table');
      const encab = tabla && tabla.querySelector('thead tr');
      if (encab && !encab.querySelector('th.flecha-col')) {
        const th = document.createElement('th');
        th.className = 'flecha-col';
        encab.insertBefore(th, encab.firstChild);
      }
    }

    if (op.soloFlecha) {
      // La fila deja de ser un botón: el cursor tampoco la ofrece como tal.
      tr.classList.add('solo-flecha');
      flecha.addEventListener('click', (ev) => { ev.stopPropagation(); alternar(); });
    } else {
      /* 🔴 EL DOBLE CLIC ABRE SÓLO DESDE LA COLUMNA OT (16-08-2026, Marco:
         «en casi todos los paneles me deja clickear y abrir otra pantalla y
         no quiero eso»). Estaba enganchado a la FILA entera, así que un doble
         clic para seleccionar una descripción, una patente o un cliente
         abría una pestaña que nadie pidió — y en una tabla de diecinueve
         columnas eso pasa todo el rato.

         La celda de la OT se busca por su CONTENIDO: es la que dice el mismo
         número que `data-ot` de la fila. Buscarla por posición fallaba, porque
         las seis tablas no tienen la OT en la misma columna y esta función
         además les inserta la flecha adelante. Si no se encuentra —una tabla
         que no muestra la OT—, el clic simple sigue desplegando y no queda
         ningún doble clic suelto. */
      /* Ojo: `data-ot` NO siempre es el número. La torre pone el ID de la
         orden —«ot-23339»— y los demás paneles ponen el número. Buscar la
         celda por `data-ot` a secas no encontraba nada en la torre, y sin
         celda el gesto se quedaba en la fila entera: seguía abriendo pestañas
         desde el nombre del cliente. Así que se busca por el NÚMERO, que es
         lo que la columna muestra. */
      conDobleClic(tr, 'ot-' + n,
        () => { abrirFicha(n); return true; }, alternar, celdaOT);
    }

    if (n !== abierta) return;
    tr.classList.add('abierta');
    const fila = document.createElement('tr');
    fila.className = 'detalle';
    const td = document.createElement('td');
    td.colSpan = tr.children.length;
    td.innerHTML = armarDetalle(n);
    fila.appendChild(td);
    tr.parentNode.insertBefore(fila, tr.nextSibling);
  });
}

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

function mejorarTablas() {
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
    // 4 px de margen: un par de píxeles de diferencia son redondeo del
    // navegador, no una columna escondida.
    if (env.scrollWidth <= env.clientWidth + 4) return;
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
  while (n && n.classList.contains('pie-grid')) { pies.push(n); n = n.nextElementSibling; }
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

/* ───────────── Etiqueta de datos ─────────────
   Pedido del cliente el 15-08-2026, en dos partes que son la misma cosa:
   pararse sobre la PATENTE y ver en qué etapa va, cuánto lleva presupuestado y
   si está o no en el taller; y pararse sobre la OR y ver el detalle de ese
   presupuesto sin abrir la orden. Su frase: "que el usuario tenga el detalle
   ahí mismo y no tenga que estar abriendo la OT".

   Por eso hay UNA sola etiqueta y no dos. Y todo lo que muestra sale del
   modelo, nunca del texto de la fila: si mañana se mueve una columna, la
   etiqueta sigue diciendo la verdad. */

/* Acepta el NÚMERO de la orden o su ID. No es capricho: la torre necesita el
   id en `data-ot` porque el expandible se abre por id, y el resto de los
   paneles usa el número. En vez de obligar a que todos digan lo mismo, se
   resuelven los dos acá. */
function ordenPorNumeroOId(clave) {
  const porNumero = buscarOT(clave);
  if (porNumero) return porNumero;
  return Modelo.torre().find((o) => o.id === clave) ||
         Modelo.historico({ todo: true }).find((o) => o.id === clave) || null;
}

function tarjetaDeOT(clave) {
  const o = ordenPorNumeroOId(clave);
  if (!o) return null;
  const e = o.etapa ? etapaPorCodigo(o.etapa) : null;
  const neto = o.presupuestos.reduce((s, p) => s + p.neto, 0);
  const pend = o.repuestos.filter((r) => !r.fechaBodega).length;

  const donde = o.fueraDeTaller
    ? '<span class="et ambar">Fuera del taller</span>'
    : '<span class="et verde">En el taller</span>';

  return {
    titulo: '<span class="patente">' + esc(o.patente) + '</span> &middot; OT ' + esc(o.numeroOT),
    filas: [
      ['Etapa', e ? '<i class="punto" style="background:' + e.color + '"></i>' + esc(e.nombre)
                  : '<span class="et gris">Pendiente</span>'],
      ['Dónde está', donde],
      ['Presupuestado', o.presupuestos.length
        ? fMonto(neto) + ' <span style="color:var(--gris-2)">neto · ' +
          o.presupuestos.length + (o.presupuestos.length === 1 ? ' OR' : ' OR') + '</span>'
        : '<span style="color:var(--gris-2)">Sin OR</span>'],
      ['Estado', '<span class="et ' + esc(o.estadoClase) + '">' + esc(o.estadoNombre) + '</span>'],
      ['Cliente', esc(o.cliente)],
      ['Compañía', o.compania === '—' ? '<span style="color:var(--gris-2)">Particular</span>'
                                      : esc(o.compania)],
      ['Días', o.diasKpi + ' de reparación <span style="color:var(--gris-2)">· ' +
        o.diasTotales + ' totales</span>'],
      ['Repuestos', pend ? '<span style="color:var(--rojo)">' + pend + ' por llegar</span>'
        : (o.repuestos.length ? 'Todos recibidos' : 'No requiere')]
    ]
  };
}

/* La clave puede ser el NÚMERO de OR o el id de un presupuesto concreto.
   Hace falta lo segundo desde que la fila desplegada muestra las versiones
   una debajo de otra: las versiones CONSERVAN la OR —es el mismo trabajo
   discutido de nuevo—, así que buscar por número devolvía siempre la v1 y el
   globo de la v2 mostraba los montos de la v1. Justo en la pantalla donde se
   elige qué documento abrir. */
function tarjetaDeOR(clave) {
  let orden = null, presu = null;
  Modelo.torre().concat(Modelo.historico({ todo: true })).some((o) => {
    const p = o.presupuestos.find((x) => x.id === clave) ||
              o.presupuestos.find((x) => String(x.numeroOR) === String(clave));
    if (p) { orden = o; presu = p; return true; }
    return false;
  });
  if (!presu) return null;

  /* Las piezas de ESTE presupuesto: las que nacieron de sus filas del bloque
     Repuestos. Se cruza por el id de la línea, que es el vínculo que bodega
     usa — no por descripción, que se repite entre versiones. */
  const suyas = {};
  (presu.lineas || []).forEach((l) => { if (l.bloque === 'repuesto') suyas[l.id] = true; });
  const pedidos = orden.repuestos.filter((r) => r.presupuestoLineaId && suyas[r.presupuestoLineaId]);
  const porLlegar = pedidos.filter((r) => !r.fechaBodega).length;

  return {
    titulo: 'OR ' + esc(presu.numeroOR),
    filas: [
      ['Vehículo', '<span class="patente">' + esc(orden.patente) + '</span> ' + esc(orden.marca || '')],
      ['Estado', '<span class="et">' + esc(presu.estado) + '</span>'],
      ['Neto', fMonto(presu.neto)],
      ['Total', '<strong>' + fMonto(presu.total) + '</strong>'],
      /* 🔶 REPUESTOS EN VEZ DE LÍNEAS Y FECHAS (16-08-2026, Marco). Las
         líneas y las dos fechas no cambian ninguna decisión al pasar el
         mouse; lo que sí la cambia es si ese trabajo depende de una pieza
         que todavía no llega. La cuenta sale de las filas del bloque
         Repuestos de ESTA OR, que son las que bajaron a bodega. */
      ['¿Necesita repuestos?', pedidos.length
        ? '<strong>Sí</strong>' : '<span style="color:var(--gris-2)">No</span>'],
      ['Repuestos solicitados', pedidos.length
        ? pedidos.length + (porLlegar ? ' <span class="et roja">' + porLlegar +
            ' por llegar</span>' : ' <span class="et verde">todos llegaron</span>')
        : '<span style="color:var(--gris-2)">—</span>']
    ],
    pie: 'Clic para abrir la OT ' + esc(orden.numeroOT),
    ot: orden.numeroOT
  };
}

/* La etiqueta es una sola y vive pegada al body: si se dibujara dentro de la
   tabla, el `overflow` del envoltorio la cortaría. */
function cajaEtiqueta() {
  let caja = document.getElementById('etiqueta-datos');
  if (!caja) {
    caja = document.createElement('div');
    caja.id = 'etiqueta-datos';
    caja.className = 'etiqueta-datos';
    document.body.appendChild(caja);
  }
  return caja;
}

function mostrarEtiqueta(el) {
  const dato = el.dataset.tip || '';
  const corte = dato.indexOf(':');
  if (corte < 0) return;
  const tipo = dato.slice(0, corte), clave = dato.slice(corte + 1);
  const t = tipo === 'or' ? tarjetaDeOR(clave) : tarjetaDeOT(clave);
  if (!t) return;

  const caja = cajaEtiqueta();
  caja.innerHTML = '<div class="tit">' + t.titulo + '</div>' +
    t.filas.map(([k, v]) => '<div class="fila"><span class="k">' + esc(k) +
      '</span><span class="v">' + v + '</span></div>').join('') +
    (t.pie ? '<div class="pie">' + esc(t.pie) + '</div>' : '');
  caja.classList.add('visible');

  // Se ubica al lado del elemento, y se corrige si se sale por el borde: en la
  // última columna de la tabla, una etiqueta fija se saldría de la pantalla.
  const r = el.getBoundingClientRect();
  const ancho = caja.offsetWidth, alto = caja.offsetHeight;
  let x = r.left, y = r.bottom + 6;
  if (x + ancho > window.innerWidth - 8) x = window.innerWidth - ancho - 8;
  if (y + alto > window.innerHeight - 8) y = r.top - alto - 6;
  caja.style.left = Math.max(8, x) + 'px';
  caja.style.top = Math.max(8, y) + 'px';
}

function ocultarEtiqueta() {
  const caja = document.getElementById('etiqueta-datos');
  if (caja) caja.classList.remove('visible');
}

/* Delegación: se engancha UNA vez al documento y sirve para todo lo que se
   pinte después, sin volver a cablear en cada render. */
let etiquetasEnchufadas = false;
function activarEtiquetas() {
  if (etiquetasEnchufadas) return;
  etiquetasEnchufadas = true;
  document.addEventListener('mouseover', (ev) => {
    const el = ev.target.closest('[data-tip]');
    if (el) mostrarEtiqueta(el);
  });
  document.addEventListener('mouseout', (ev) => {
    if (ev.target.closest('[data-tip]')) ocultarEtiqueta();
  });
  // Al desplazar la tabla la etiqueta quedaría flotando sobre otra fila.
  document.addEventListener('scroll', ocultarEtiqueta, true);
}

/* Marca lo que ya está pintado. Las patentes toman el número de OT de su
   propia fila —que salió del modelo al pintarla, no del texto— y las celdas de
   OR se marcan donde el panel las haya rotulado con `data-or`. */
function marcarEtiquetas() {
  activarEtiquetas();
  document.querySelectorAll('[data-ot] .patente').forEach((p) => {
    const fila = p.closest('[data-ot]');
    if (fila && fila.dataset.ot) p.dataset.tip = 'ot:' + fila.dataset.ot;
  });
  document.querySelectorAll('[data-or]').forEach((c) => {
    if (!c.dataset.or) return;
    c.dataset.tip = 'or:' + c.dataset.or;
    /* "Desde ahí se puede pinchar para ir al detalle". El clic va a la orden
       dueña de esa OR y no propaga: si propagara, la fila de abajo desplegaría
       su expandible al mismo tiempo. */
    if (c.dataset.orEnchufada) return;
    c.dataset.orEnchufada = '1';
    c.addEventListener('click', (ev) => {
      const t = tarjetaDeOR(c.dataset.or);
      if (!t) return;
      ev.stopPropagation();
      ocultarEtiqueta();
      abrirFicha(t.ot);
    });
  });
}

function modoRegistro(numero) {
  ui.registroOT = String(numero);
  document.body.classList.add('ventana-registro');
  pintarLogo();
  document.getElementById('usr').innerHTML = ico('usuario') + esc(quienMira());

  const o = buscarOT(numero);

  if (!o) {
    /* Dos motivos distintos para no poder abrirla, y hay que decir cuál es.
       "No existe" cuando alguien pega mal el número; "no es tuya" cuando la
       orden está pero el alcance del rol no la alcanza. Callarlo sería más
       cómodo y dejaría al pintor pensando que el sistema se rompió. */
    const ajena = Modelo.otFueraDeAlcance(numero);
    document.title = (ajena ? 'OT fuera de tu alcance' : 'OT no encontrada') + ' · Automotora DyP';
    document.getElementById('ruta').innerHTML = '<span>Torre de control</span>';
    document.getElementById('titulo').innerHTML = ico(ajena ? 'candado' : 'alerta', 'g') +
      (ajena ? 'Esta orden no está asignada a ti' : 'Orden de trabajo no encontrada');
    document.getElementById('bajada').textContent = '';
    document.getElementById('tabs').innerHTML = '';
    document.getElementById('herramientas').innerHTML =
      '<a class="hbtn primario" href="index.html">' + ico('torre') + 'Volver al sistema</a>';
    document.getElementById('contenido').innerHTML =
      '<div class="panel"><div class="cuerpo"><div class="vacio">' + ico(ajena ? 'candado' : 'buscar') +
      (ajena
        ? '<div class="titulo">La OT ' + esc(numero) + ' existe, pero no es tuya</div>' +
          '<div class="texto">El rol <strong>' + esc(Modelo.rolActual().nombre || '—') +
          '</strong> solo abre las órdenes que tiene tomadas o a su cargo. ' +
          'Si tienes que trabajar este vehículo, el jefe de taller te asigna la etapa y aparece en <strong>Mi trabajo</strong>.</div>'
        : '<div class="titulo">No existe la OT ' + esc(numero) + '</div>' +
          '<div class="texto">Puede que el número esté mal escrito o que la orden no esté en esta demostración.</div>') +
      '</div></div></div>';
    document.getElementById('estado-barra').innerHTML =
      '<span class="celda"><span class="luz"></span>Conectado</span><span class="celda">Automotora DyP</span>';
    return;
  }

  document.title = 'OT ' + o.numeroOT + ' · ' + o.patente + ' · Automotora DyP';
  document.getElementById('ruta').innerHTML =
    '<span>Operación diaria</span>' + ico('chevron') + '<span>Torre de control</span>' +
    ico('chevron') + '<span>OT ' + o.numeroOT + '</span>';
  document.getElementById('titulo').innerHTML = ico('torre', 'g') + 'Ficha de la orden de trabajo';
  document.getElementById('bajada').textContent =
    'Toda la información de esta orden en una sola pantalla. Esta pestaña tiene su propia dirección: se puede compartir.';
  // Las pestañas las pinta la ficha, que es la que sabe en cuál está.
  document.getElementById('tabs').innerHTML = '';

  // Nada de botones inertes: o llevan a alguna parte, o dicen en qué tanda se
  // construyen. Un botón que no hace nada y no lo dice es peor que no tenerlo.
  /* La barra se arma con lo que la cuenta puede hacer. Antes salían los diez
     botones siempre, y el pintor apretaba "Acta de entrega" para descubrir que
     no era para él. */
  const puede = (c) => Modelo.puede(c);
  const barra = ['<a class="hbtn primario" href="index.html">' + ico('torre') + 'Volver al sistema</a>',
    '<span class="sep"></span>',
    '<button class="hbtn" type="button" data-fichatab="etapas">' + ico('taller') + 'Etapas</button>'];
  if (puede('ficha.completa')) barra.push('<button class="hbtn" type="button" data-fichatab="bitacora">' + ico('info') + 'Bitácora</button>');
  if (puede('foto.ver')) barra.push('<button class="hbtn" type="button" data-fichatab="fotos">' + ico('camara') + 'Fotos</button>');
  const impresos = [];
  if (puede('ficha.completa')) impresos.push(['recepcion', 'Comprobante']);
  // El impreso del presupuesto lleva cliente, RUT y valores: pide `montos`,
  // no `ver`. Con `ver` se leen las líneas sin precio, en la ficha.
  if (puede('presupuesto.montos')) impresos.push(['presupuesto', 'Presupuesto']);
  if (puede('ficha.completa')) impresos.push(['ficha', 'Ficha completa'], ['entrega', 'Acta de entrega']);
  if (impresos.length) {
    barra.push('<span class="sep"></span>');
    impresos.forEach(([k, rot]) => barra.push('<button class="hbtn" type="button" data-imprimir="' + k + '">' +
      ico('imprimir') + rot + '</button>'));
  }
  // La ficha arma su propia barra: el rótulo va igual que en los paneles, y
  // desde el 16-08-2026 también abre las herramientas de la demostración.
  barra.push('<button class="hbtn der" type="button" data-demo-abrir="1" ' +
    'title="Las herramientas de la demostración: la guía, las pruebas y el calendario">' +
    ico('base') + 'Datos de demostración</button>');
  document.getElementById('herramientas').innerHTML = barra.join('');

  document.querySelectorAll('#herramientas [data-imprimir]').forEach((b) =>
    b.addEventListener('click', () => abrirImpreso(b.dataset.imprimir, o.id)));
  document.querySelectorAll('#herramientas [data-demo-abrir]').forEach((b) =>
    b.addEventListener('click', dialogoDemostracion));

  document.getElementById('contenido').innerHTML = vFichaOT(o);
  pFichaOT(o);
  pintarBarraEstado('OT <strong>' + o.numeroOT + '</strong> · ' + esc(o.patente));
}

/* La ficha de la orden, sus pestanas y sus acciones viven en
   js/vistas/ficha.js, y las dos pantallas de etapas en js/vistas/etapas.js */

/* ───────────────── Tema ───────────────── */

function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  const b = document.getElementById('btn-tema');
  /* Dos rótulos, uno largo y uno corto, y el CSS elige cuál se ve. En un
     celular «Tema oscuro» + «Cambiar mi clave» + «Cerrar sesión» no caben en
     la barra, y esconder un botón no es una opción: la regla de la casa es que
     ninguno se apaga. Se acorta. */
  if (b) b.innerHTML = '<span class="largo">' + (tema === 'oscuro' ? 'Tema oscuro' : 'Tema claro') +
    '</span><span class="corto">' + (tema === 'oscuro' ? 'Oscuro' : 'Claro') + '</span>';
  try { localStorage.setItem('dyp-tema', tema); } catch (e) { /* file:// sin almacenamiento */ }
  // Las marcas de daño se dibujan por JS: hay que repintarlas al cambiar de tema.
  if (ui.vista === 'recepcion') pintarDanos();
}

function montarTema() {
  const b = document.getElementById('btn-tema');
  if (!b) return;
  aplicarTema(document.documentElement.dataset.tema === 'claro' ? 'claro' : 'oscuro');
  b.addEventListener('click', () => {
    aplicarTema(document.documentElement.dataset.tema === 'oscuro' ? 'claro' : 'oscuro');
  });
}

/* ───────────────── Rol con el que se mira ─────────────────
   Cambiar de rol acá es lo que hace demostrable el enmascaramiento: el mismo
   dato desaparece o aparece según quién mire. Es el paso 26 del guion.

   ⚠️ Y hay que repetirlo cada vez: esto está MODELADO. En el navegador el
   dato igual llegó. La garantía es RLS en PostgreSQL. */

/* El selector de arriba a la derecha es la SESIÓN: con quién se entra al
   sistema. Cada persona trae su rol, y con el rol sus permisos y su menú.

   Antes era un selector de roles sueltos. Con eso se podía mostrar que el
   operario no ve los montos, pero no se podía mostrar lo importante: que el
   pintor entra y ve sus autos. Un rol no tiene autos; una persona sí. */
/* Arriba a la derecha va QUIÉN está usando el sistema, con su cargo, y la
   salida. Antes acá había un desplegable que cambiaba de persona sin pedir
   nada: con el ingreso ya construido eso sería una puerta trasera, así que
   para cambiar de usuario hay que cerrar sesión y volver a entrar. En una
   demostración cuesta dos clics, y a cambio lo que se muestra es cierto. */
function montarRol() {
  const cont = document.getElementById('usr');
  if (!cont) return;
  const yo = Modelo.personaActual();

  if (!yo) {
    cont.innerHTML = ico('usuario') + '<span style="font-size:11px;color:var(--gris)">Sin sesión</span>';
    return;
  }

  cont.innerHTML = ico('usuario') +
    '<span style="font-size:11px"><strong>' + esc((yo.nombres + ' ' + (yo.apellidos || '')).trim()) + '</strong>' +
    '<span style="color:var(--gris)"> · ' + esc(yo.cargo || Modelo.rolActual().nombre) + '</span></span>' +
    '<button type="button" id="btn-clave" style="margin-left:8px">' +
      '<span class="largo">Cambiar mi clave</span><span class="corto">Clave</span></button>' +
    '<button type="button" id="btn-salir" style="margin-left:6px">' +
      '<span class="largo">Cerrar sesión</span><span class="corto">Salir</span></button>';

  document.getElementById('btn-clave').addEventListener('click', dialogoMiClave);

  document.getElementById('btn-salir').addEventListener('click', () => {
    Modelo.cerrar_sesion();
    document.querySelectorAll('.velo, .velo-impreso, .desplegable').forEach((v) => v.remove());
    montarRol();
    pintarMenu();
    ir('torre');
    pantallaIngreso();
  });
}

/* Cambiar la propia clave, desde donde sea y con cualquier cuenta.

   Estaba solo dentro de Personal, que pide `personal.ver` — un permiso que hoy
   tienen dos de las seis cuentas. Y sin embargo el sistema le decía a todas, al
   entrar con la clave inicial, «conviene cambiarla en Personal → su ficha»:
   una instrucción imposible para la recepcionista, el pintor y bodega, que son
   justamente los que más la necesitan.

   La clave de uno no es un dato de administración: es de uno. Se pide la
   actual, así que nadie cambia la de otro ni aunque deje la sesión abierta. */
function dialogoMiClave() {
  const yo = Modelo.personaActual();
  if (!yo) return avisar({ ok: false, motivo: 'No hay ninguna sesión abierta.' });
  cerrarDialogos();

  const velo = document.createElement('div');
  velo.className = 'velo';
  velo.innerHTML =
    '<div class="dialogo" style="max-width:420px">' +
      '<div class="cab"><h2>' + ico('candado', 'g') + 'Cambiar mi clave</h2></div>' +
      '<div class="cuerpo">' +
        '<div class="dato"><span class="k">Cuenta</span><span class="v"><span class="cod">' +
          esc(yo.usuario || '—') + '</span></span></div>' +
        '<div class="dato"><span class="k">También sirve</span><span class="v">la ficha ' +
          esc(yo.ficha) + '</span></div>' +
        (yo.clave_inicial ? '<div class="nota" style="margin-top:9px">' + ico('alerta') +
          '<span>Esta cuenta todavía tiene la <strong>clave inicial</strong>, que está a la vista ' +
          'en la pantalla de ingreso.</span></div>' : '') +
        '<div class="rejilla-campos" style="margin-top:11px">' +
          '<div class="campo" style="grid-column:1/-1"><label>Clave actual</label>' +
            '<input type="password" id="mc-actual" autocomplete="current-password"></div>' +
          '<div class="campo" style="grid-column:1/-1"><label>Clave nueva</label>' +
            '<input type="password" id="mc-nueva" autocomplete="new-password">' +
            '<span class="ayuda">Mínimo 6 caracteres</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="pie">' +
        '<button class="btn secundario" id="mc-cancelar">Cancelar</button>' +
        '<button class="btn" id="mc-guardar">Cambiar la clave</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(velo);

  const cerrar = () => velo.remove();
  velo.addEventListener('click', (ev) => { if (ev.target === velo) cerrar(); });
  document.getElementById('mc-cancelar').addEventListener('click', cerrar);
  const campo = document.getElementById('mc-actual');
  campo.focus();

  document.getElementById('mc-guardar').addEventListener('click', () => {
    const r = Modelo.cambiar_clave(yo.id,
      document.getElementById('mc-actual').value,
      document.getElementById('mc-nueva').value);
    if (!r.ok) return avisar(r);
    cerrar();
    montarRol();
    avisar({ ok: true, motivo: '' }, 'Clave cambiada. La próxima vez entras con la nueva.');
  });
}

/* Qué permiso pide cada módulo para aparecer en el menú. Un operario que ve
   "Configuración" y al entrar no puede tocar nada aprende que el sistema le
   miente; mejor no ofrecérselo. Lo que no está acá lo ve cualquiera. */
const PERMISO_DE_MODULO = {
  // `mitrabajo` es el único sin permiso, y a propósito: solo muestra lo de
  // quien entró. Todo lo demás declara qué pide. Antes cinco pantallas no
  // declaraban nada y las veía cualquiera — un operario entraba al histórico
  // completo con los datos de todos los clientes.
  recepcion:     'ot.crear',
  torre:         'torre.ver',
  taller:        'taller.ver',
  entrega:       'entrega.registrar',
  repuestos:     'repuesto.ver',
  detenidos:     'espera.ver',
  // El MÓDULO de presupuesto es para quien los arma. Ver las líneas dentro de
  // una orden es otra cosa y la gobierna `presupuesto.ver`, que el operario sí
  // tiene: ve qué hay que hacerle al auto, sin los valores.
  presupuesto:   'presupuesto.crear',
  bodega:        'repuesto.cargar',
  documentos:    'documento.ver',
  // El archivo de lo ya cerrado tiene permiso propio, aparte de la torre: es
  // donde están los datos de todos los clientes que pasaron por el taller, y
  // para trabajar el día de hoy no hace falta. Solo administración.
  historico:     'historico.ver',
  // El expediente muestra TODO de una orden: cliente, montos, bitácora y
  // archivos. Es exactamente lo que describe `ficha.completa`, así que pide ese
  // permiso y no uno nuevo. El pintor no lo tiene, y con razón: para cerrar su
  // etapa no necesita el historial de comunicaciones con la compañía.
  expediente:    'ficha.completa',
  personal:      'personal.ver',
  consolidado:   'consolidado.ver',
  configuracion: 'configuracion'
};

/* ───────────────── Arranque ───────────────── */

montarTema();
montarBarraMenu();
montarRol();

/* 🔷 SI LOS DATOS DE DEMOSTRACIÓN SE VOLVIERON A CARGAR, SE DICE (18-08-2026).
   Antes esto sólo salía por la consola del navegador, y ahí no lo lee nadie:
   la pantalla cambiaba sola —o peor, no cambiaba— sin ninguna explicación.
   Marco pasó un día viendo siete cuentas cuando el sistema ya traía
   diecinueve. El aviso va con retardo porque en este punto todavía no hay
   dónde pintarlo. */
setTimeout(() => {
  const porQue = Modelo.porQueSeResembro();
  if (porQue) avisar({ ok: true, motivo: '' }, porQue, { persistente: true });
}, 900);

/* Sin sesión no se ve nada. Se retoma la de antes —un F5 no puede echar a la
   recepcionista con el formulario a medio llenar— y si no hay, se pide entrar. */
const HAY_SESION = Modelo.retomar_sesion();

if (!HAY_SESION) {
  pintarMenu();
  ir('torre');            // se dibuja el marco debajo, pero tapado
  pantallaIngreso();
} else if (PARAM_OT) {
  // La dirección trae una OT: esta pestaña es la ventana de ese registro.
  // Y puede pedir además en qué pestaña y en qué modo abrirla.
  fichaAplicarDireccion();
  modoRegistro(PARAM_OT);
} else {
  pintarMenu();
  // `#vista=bodega` abre el sistema directo en un módulo. Sirve para saltar
  // desde la ficha, que vive en su propia pestaña.
  const pedida = (function () {
    try { return new URLSearchParams(window.location.hash.replace(/^#/, '')).get('vista'); }
    catch (e) { return null; }
  })();
  ir(MENU.some((m) => m.id === pedida) ? pedida : 'torre');
  pararEnLaOrden(leerDelAncla('ot'));
}

/* Un documento tiene dirección propia: `#impreso=presupuesto&ot=23330` lo abre
   solo, sin pasar por la ficha. Sirve para mandarle el presupuesto a alguien
   por enlace, y sirve para generar el PDF sin abrir el sistema a mano. */
(function () {
  const tipo = leerDelAncla('impreso');
  const ot = leerDelAncla('ot');
  if (!tipo || !ot || !IMPRESOS[tipo]) return;
  const o = Modelo.otPorNumero(ot);
  if (!o) return;
  abrirImpreso(tipo, o.id);
})();

function leerDelAncla(clave) {
  try { return new URLSearchParams(window.location.hash.replace(/^#/, '')).get(clave); }
  catch (e) { return null; }
}

/* Deja el módulo recién abierto parado en una orden concreta. Es lo que hace
   que desde la ficha se llegue de un clic a su presupuesto, su bodega o sus
   documentos, en vez de aterrizar en el listado y volver a buscar la patente
   que uno ya tenía en la mano. */
function pararEnLaOrden(numeroOT) {
  if (!numeroOT) return;
  const o = Modelo.otPorNumero(numeroOT);
  if (!o) return;
  switch (ui.vista) {
    case 'presupuesto':
      presuEstado().otId = o.id; presuEstado().presupuestoId = null; break;
    case 'bodega': {
      const b = bodegaEstado();
      b.pantalla = 'checklist'; b.patente = o.patente; b.otId = o.id; break;
    }
    case 'documentos':
      documentosEstado().otId = o.id; break;
    case 'entrega':
      ui.entrega = ui.entrega || {}; ui.entrega.patente = o.patente; ui.entrega.otId = o.id; break;
    default: return;
  }
  render();
}

/* Las pestañas se enteran unas de otras.

   El sistema se usa con varias pestañas abiertas: la torre en una y dos o tres
   órdenes en las suyas. Cada una carga su copia al abrirse, así que un
   presupuesto cargado en la pestaña A no aparecía en la pestaña B hasta
   recargar a mano — y desde adentro parecía que el sistema no guardaba.

   El navegador avisa del cambio con el evento `storage`, que llega solo a las
   OTRAS pestañas. Se relee y se repinta lo que esté a la vista. */
window.addEventListener('storage', (ev) => {
  /* La SESIÓN también viaja entre pestañas, y esto faltaba.

     La sesión es una sola para todo el navegador, pero cada pestaña se queda
     con la que tenía al abrirse. Si en la torre se cierra sesión y entra otra
     persona, la pestaña de una orden abierta seguía mostrando —y dejando
     operar— como la anterior hasta que alguien la recargara a mano.

     Desde adentro eso se ve como "la información no viaja": se mira la misma
     orden desde dos pestañas con dos cuentas distintas, y una no la ve porque
     cada rol alcanza órdenes distintas. Y es peor que un problema de vista: la
     pestaña vieja conserva los permisos de quien ya se fue. */
  if (ev.key === Modelo.CLAVE_SESION) return realinearSesion();

  if (ev.key !== Modelo.CLAVE) return;
  if (!Modelo.recargarDeDisco()) return;
  if (ui.registroOT) modoRegistro(ui.registroOT); else render();
});

function realinearSesion() {
  if (Modelo.sesionAlDia()) return;

  // Cerraron sesión en otra pestaña: acá también se cierra.
  if (!Modelo.sesionGuardada()) {
    Modelo.cerrar_sesion();
    document.querySelectorAll('.velo, .velo-impreso, .desplegable').forEach((v) => v.remove());
    if (ui.registroOT) {
      // La ventana de una orden no tiene menú donde dibujar el ingreso: se
      // dice qué pasó y se ofrece volver, que es lo único que corresponde.
      document.getElementById('contenido').innerHTML =
        '<div class="panel"><div class="cuerpo"><div class="vacio">' + ico('candado') +
        '<div class="titulo">Se cerró la sesión</div>' +
        '<div class="texto">Cerraron la sesión en otra pestaña. Vuelve al sistema para entrar de nuevo.</div>' +
        '<a class="btn" href="index.html">Volver al sistema</a></div></div></div>';
      return;
    }
    pintarMenu(); ir('mitrabajo'); pantallaIngreso();
    return;
  }

  // Entró otra persona: esta pestaña se pone al día con ella.
  if (!Modelo.retomar_sesion()) return;
  const p = Modelo.personaActual();
  if (ui.registroOT) { modoRegistro(ui.registroOT); } else {
    pintarMenu();
    // Si la cuenta nueva no alcanza el módulo donde estábamos, `ir` lo rechaza
    // y explica; se parte de lo suyo, que es lo que corresponde al entrar.
    ir(PERMISO_DE_MODULO[ui.vista] && !Modelo.puede(PERMISO_DE_MODULO[ui.vista]) ? 'mitrabajo' : ui.vista);
  }
  avisar({ ok: true, motivo: '' }, 'Esta pestaña se puso al día: ahora está la sesión de ' +
    ((p || {}).cargo || Modelo.rolActual().nombre) + '.');
}

/* Las teclas que la barra de herramientas promete. Si el botón dice F2, F2
   tiene que hacerlo: un atajo rotulado que no responde es lo mismo que un
   botón muerto. F5 no se intercepta a propósito — recarga el navegador, y como
   los datos viven en el equipo la pantalla vuelve igual. */
document.addEventListener('keydown', (ev) => {
  // Ctrl+Z deshace en cualquier pantalla, no solo donde está el botón: es la
  // tecla que la gente aprieta por reflejo cuando se equivoca.
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') {
    const escribiendo = /^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || '');
    if (escribiendo) return;           // ahí Ctrl+Z es del campo de texto
    ev.preventDefault();
    return accionModulo('deshacer');
  }
  if (ev.key !== 'F2') return;
  const m = MODULOS[ui.vista];
  if (!m) return;
  const conF2 = m.acciones.find((a) => a[3] === 'F2');
  if (!conF2) return;
  ev.preventDefault();
  accionModulo(conF2[2]);
});

/* Pegar la dirección de una orden en una pestaña que ya está abierta tiene que
   funcionar igual que abrirla desde la torre. Cambiar solo el ancla no recarga
   la página, así que hay que escucharlo a mano — si no, el enlace compartido
   parece roto para quien lo recibe. */
window.addEventListener('hashchange', function () {
  const leer = (clave) => {
    try { return new URLSearchParams(window.location.hash.replace(/^#/, '')).get(clave); }
    catch (e) { return null; }
  };
  const vista = leer('vista');
  const ot = leer('ot');
  if (ot && !vista) {
    /* Pegar el enlace de una orden en una pestaña YA ABIERTA no recarga nada:
       solo cambia el ancla. Hay que atender igual la pestaña y el modo que ese
       enlace pide, o el que lo recibe cae en un lugar distinto del que le
       mandaron y no hay forma de que lo sepa. */
    fichaAplicarDireccion();
    if (String(ot) !== String(ui.registroOT)) return modoRegistro(ot);
    return refrescarFicha();
  }
  if (vista && MENU.some((m) => m.id === vista)) {
    // Se venía de una ventana de registro: hay que devolverle el menú lateral.
    if (ui.registroOT) { ui.registroOT = null; document.body.classList.remove('ventana-registro'); pintarMenu(); }
    ir(vista);
    pararEnLaOrden(leer('ot'));
  }
});

/* Se revisa al entrar y cada cinco minutos. Cinco es a propósito: en una
   demostración se publica un ajuste y se quiere que el que está mirando lo
   sepa sin que nadie se lo diga por teléfono. */
revisarVersionPublicada();
setInterval(revisarVersionPublicada, 5 * 60 * 1000);

/* ── La barra lateral: plegar y angostar ────────────────────────────────
   Pedido de Marco el 16-08-2026 mirando la Torre de control: en el sistema
   actual la tabla de 17 columnas entra completa a zoom 100% porque ese
   sistema NO tiene barra lateral —el menú va arriba, en una franja—. Acá la
   barra se come 208px que a la tabla le hacen falta.

   Dos salidas, y las dos las conserva el navegador:

   · PLEGAR a iconos (46px). Recupera 162px y no muere nada: los diez módulos
     siguen visibles y a un clic, con el nombre en el globo. Esconder el menú
     entero habría sido peor — para cambiar de pantalla habría que abrirlo.

   · ANGOSTAR con el tirador del borde, y SÓLO angostar: entre 132 y los 208
     de partida. Textual: "uno pueda medir el ancho, pero solo de achicarlo
     desde lo que ya esta". Ensanchar no resuelve nada acá.

   Va en `localStorage` y no en la base: es una preferencia de ESTE
   computador, no un dato del taller. El de recepción puede quererla plegada
   y el de gerencia no, y ninguno de los dos está equivocado. */
const LATERAL_MAX = 208;
const LATERAL_MIN = 132;
const LATERAL_CLAVE = 'dyp.lateral';

function guardarLateral(estado) {
  try { localStorage.setItem(LATERAL_CLAVE, JSON.stringify(estado)); } catch (e) { /* modo privado */ }
}
function leerLateral() {
  try { return JSON.parse(localStorage.getItem(LATERAL_CLAVE) || '{}') || {}; } catch (e) { return {}; }
}

/* UNA sola fuente para el ancho: esta variable, escrita en el `body`.
   Primero lo resolvía a medias el CSS —una regla `body.lateral-plegado` con
   su propio ancho— y a medias el JS con una variable en `<html>`. La clase se
   aplicaba, el rótulo se escondía… y la barra seguía midiendo 208. Dos
   dueños del mismo número siempre terminan así. */
const LATERAL_PLEGADA = 46;

function aplicarLateral(estado) {
  const ancho = Math.min(LATERAL_MAX, Math.max(LATERAL_MIN, Number(estado.ancho) || LATERAL_MAX));
  document.body.style.setProperty('--ancho-lateral',
    (estado.plegado ? LATERAL_PLEGADA : ancho) + 'px');
  document.body.classList.toggle('lateral-plegado', !!estado.plegado);
  const b = document.getElementById('btn-plegar');
  if (b) {
    b.innerHTML = ico('chevron') + '<span class="rot">Contraer la barra</span>';
    b.title = estado.plegado ? 'Mostrar los nombres de los módulos'
                             : 'Contraer la barra a iconos y darle el ancho a la tabla';
    b.setAttribute('aria-label', b.title);
    b.setAttribute('aria-expanded', estado.plegado ? 'false' : 'true');
  }
}

function montarLateral() {
  const estado = leerLateral();
  aplicarLateral(estado);

  const boton = document.getElementById('btn-plegar');
  if (boton) boton.addEventListener('click', () => {
    const e = leerLateral();
    e.plegado = !e.plegado;
    guardarLateral(e);
    aplicarLateral(e);
  });

  const tirador = document.getElementById('tirador-lateral');
  const sidebar = document.getElementById('sidebar');
  if (!tirador || !sidebar) return;

  let arrastrando = false;
  const mover = (ev) => {
    if (!arrastrando) return;
    // El ancho es la distancia entre el borde izquierdo de la barra y el
    // puntero: así el borde va pegado al mouse y no se va quedando atrás.
    const x = ev.clientX - sidebar.getBoundingClientRect().left;
    const ancho = Math.min(LATERAL_MAX, Math.max(LATERAL_MIN, Math.round(x)));
    document.body.style.setProperty('--ancho-lateral', ancho + 'px');
    ev.preventDefault();
  };
  const soltar = () => {
    if (!arrastrando) return;
    arrastrando = false;
    document.body.classList.remove('arrastrando-lateral');
    const e = leerLateral();
    e.ancho = parseInt(document.body.style.getPropertyValue('--ancho-lateral'), 10) || LATERAL_MAX;
    guardarLateral(e);
    // Las tablas miden su ancho al pintarse: al cambiar el del área hay que
    // dejarlas recalcular, o las columnas quedan con el ancho de antes.
    if (typeof mejorarTablas === 'function') mejorarTablas();
  };

  tirador.addEventListener('mousedown', (ev) => {
    arrastrando = true;
    document.body.classList.add('arrastrando-lateral');
    ev.preventDefault();
  });
  document.addEventListener('mousemove', mover);
  document.addEventListener('mouseup', soltar);

  /* Doble clic en el tirador: vuelve al ancho de fábrica. Es la salida para
     quien la angostó de más y no sabe cuánto medía. */
  tirador.addEventListener('dblclick', () => {
    const e = leerLateral();
    e.ancho = LATERAL_MAX;
    guardarLateral(e);
    aplicarLateral(e);
  });
}

montarLateral();

/* ── EL CAJÓN DE MÓDULOS EN PANTALLA CHICA ─────────────────────────────
   🔴 EL PROBLEMA QUE ESTO RESUELVE (21-08-2026). El CSS escondía la barra
   lateral bajo los 860 px con un `display:none` y nada la reemplazaba. En un
   celular —y en una tablet vertical, que son 768— el sistema quedaba con UN
   módulo: el que se abría al entrar, y de ahí no se salía. No es que se viera
   mal: no se podía usar.

   Ahora la misma barra, sin duplicar nada, se corre a un cajón. Tres formas de
   cerrarlo, que es lo mínimo para que nadie quede atrapado: tocar un módulo,
   tocar el velo de al lado, o Escape.

   ⚠️ Lo que se cierra es una CLASE en el `body`, no un estilo escrito a mano.
   Escrito a mano hay que acordarse de deshacerlo en cada camino de salida —y
   siempre queda uno afuera—; con la clase, el CSS decide y los tres caminos
   hacen exactamente lo mismo. */
function montarCajonModulos() {
  const boton = document.getElementById('btn-nav');
  const velo = document.getElementById('velo-nav');
  const nav = document.getElementById('nav');
  if (!boton || !velo) return;

  const abierto = () => document.body.classList.contains('nav-abierta');
  const poner = (v) => {
    document.body.classList.toggle('nav-abierta', v);
    velo.hidden = !v;
    boton.setAttribute('aria-expanded', v ? 'true' : 'false');
    boton.setAttribute('aria-label', v ? 'Cerrar el menú de módulos' : 'Abrir el menú de módulos');
    /* Con el cajón abierto, el fondo NO se desplaza: en un teléfono, arrastrar
       sobre el velo movía la tabla de atrás y daba la sensación de que la
       aplicación se había roto. */
    document.body.classList.toggle('sin-desplazar', v);
  };

  boton.addEventListener('click', () => poner(!abierto()));
  velo.addEventListener('click', () => poner(false));
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && abierto()) { poner(false); boton.focus(); }
  });
  // Elegir un módulo cierra el cajón. Va por delegación: la lista se repinta
  // en cada render y un oyente por enlace se perdería en el primer repintado.
  if (nav) nav.addEventListener('click', (ev) => {
    if (ev.target.closest && ev.target.closest('a')) poner(false);
  });
  /* Al pasar a una pantalla ancha el cajón deja de existir. Si quedara la
     clase puesta, el `body` seguiría sin poder desplazarse en el escritorio y
     nadie ataría ese síntoma con haber girado el teléfono. */
  const ancha = window.matchMedia('(min-width: 861px)');
  const alGirar = (e) => { if (e.matches) poner(false); };
  if (ancha.addEventListener) ancha.addEventListener('change', alGirar);
  else if (ancha.addListener) ancha.addListener(alGirar);   // navegadores viejos
}

montarCajonModulos();
