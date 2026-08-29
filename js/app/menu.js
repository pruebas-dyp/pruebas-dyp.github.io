/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   EL MENU LATERAL Y LAS HERRAMIENTAS

   Que modulos existen, cuales ve cada cuenta, y como se dibuja la barra de la
   izquierda. Incluye las herramientas de la demostracion del menu Archivo.

   Salio de `app.js` el 22-08-2026 (COD-7), que llego a 3.249 lineas — por
   encima del punto donde la casa midio que un archivo ya no se puede revisar
   en un pull request. No se movio ni una linea de logica: es corte y pegue.
   ─────────────────────────────────────────────────────────────────────── */

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
  /* 🔷 LAS DOS PUERTAS DEL CICLO DE ASIGNACIÓN (22-08-2026). Son nuestras, no
     están entre los diez del cliente, y por eso cada una se le muestra SÓLO a
     quien la usa — el resto del taller sigue viendo el menú de siempre:

       · **Mi trabajo** — sólo si la ficha de la persona declara etapas. El que
         pinta aterriza acá al entrar; sin la puerta, apretaba «Taller» una vez
         y ya no tenía cómo volver. Recepción y administración no la ven: para
         ellas está vacía siempre.
       · **Por validar** — sólo con `etapa.validar`. Es lo único que nadie más
         puede hacer, y hasta que se aprieta el vehículo no avanza. El jefe de
         taller aterriza en la Torre, así que sin esta puerta no llegaba. */
  { id: 'mitrabajo',  nombre: 'Mi trabajo',  icono: 'taller',
    verSi: () => Modelo.tieneEtapas(),
    /* El contador cuenta lo que HAY QUE HACER, no todo lo que está a mi
       nombre: lo que ya entregué y espera el visto bueno no me toca a mí, y
       si lo sumara el número no bajaría nunca al terminar una etapa. */
    cuenta: () => {
      const yo = Modelo.personaActual();
      if (!yo) return null;
      return Modelo.miTrabajo(yo.id).mias.filter((x) => !x.esperandoValidacion).length;
    } },
  { id: 'porvalidar', nombre: 'Por validar', icono: 'check',
    verSi: () => Modelo.puede('etapa.validar'),
    cuenta: () => Modelo.porValidar().length },
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
  porvalidar:  { ruta: ['Operación diaria', 'Por validar'],
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
/* 🔷 CON UNA EXCEPCION, Y HAY QUE DECIRLA (22-08-2026).

   La lista de modulos de cada persona la armo Andres mirando las 39 pantallas
   del sistema ACTUAL. Por construccion no puede nombrar una pantalla que ese
   sistema no tiene. Si la lista gobernara tambien lo nuestro, todo lo que
   agregamos quedaria invisible para las trece cuentas del cliente — y el jefe
   de taller, que tiene lista escrita, se quedaria sin la bandeja donde valida
   el trabajo terminado, que es justo lo que vinimos a agregar.

   Entonces: para lo del cliente manda su lista; para lo nuestro manda el rol.
   Cuando el cliente revise cuenta por cuenta antes de la puesta en marcha, lo
   nuestro entra a la lista y esta excepcion se puede borrar. */
const MODULOS_NUESTROS = ['mitrabajo', 'porvalidar', 'repuestos', 'detenidos', 'expediente'];

function entraAlModulo(id) {
  const pide = PERMISO_DE_MODULO[id];
  const porRol = !pide || Modelo.puede(pide);
  if (MODULOS_NUESTROS.indexOf(id) >= 0) return porRol;
  if (Modelo.modulosDe((Modelo.personaActual() || {}).id)) return Modelo.veModulo(id);
  return porRol;
}

/* Qué módulos le ofrece el menú a quien está adentro, sin tocar el DOM.

   Está separado de `pintarMenu` para que se pueda PREGUNTAR sin un navegador
   —lo usa la prueba de que el jefe de taller llega a su bandeja—. El ciclo de
   validación se construyó, se probó y se publicó con el motor funcionando y
   sin ninguna puerta en el menú: todo daba verde y en la pantalla no había por
   dónde entrar. Una pregunta que sólo se puede hacer con el dedo no la hace
   nadie dos veces.

   Dos condiciones, y las dos tienen que dar: `entraAlModulo` responde si la
   cuenta TIENE PERMISO, y `verSi` —cuando la entrada lo declara— si la
   pantalla tiene algo que mostrarle. Ofrecer una puerta que se abre a una
   pantalla vacía enseña a desconfiar del menú. */
function menuVisible(m) {
  return entraAlModulo(m.id) && (!m.verSi || m.verSi());
}

function modulosDelMenu() {
  return MENU.filter((m) => !m.grupo && menuVisible(m)).map((m) => m.id);
}

/* A dónde cae alguien cuando la pantalla que pidió no es suya, y con qué se
   abre el sistema. Lo primero que su propio menú le ofrece; si el menú le
   quedó vacío, su trabajo — que no pide permiso porque sólo muestra lo suyo. */
function primerModuloPermitido() {
  return modulosDelMenu()[0] || 'mitrabajo';
}

function pintarMenu() {
  const nav = document.getElementById('nav');
  const visible = menuVisible;

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

  avisarQueHayMasModulos();
  pintarLogo();
  /* La esquina del usuario la dibuja `montarRol()`, y SOLO ella. Acá había un
     `innerHTML` que escribía el nombre a secas, y como `pintarMenu()` corre
     después de `montarRol()` al recargar con la sesión guardada, se comía los
     botones de «Cambiar mi clave» y «Cerrar sesión». Al entrar por el
     formulario no se notaba —ahí el orden es al revés— y por eso pasó. */
  montarRol();
}

/* Los números del menú, al día después de cada acción.

   El menú se dibuja una vez al entrar y `render()` no lo volvía a tocar, así
   que sus contadores se congelaban: el jefe de taller aceptaba una etapa, la
   bandeja pasaba a tener tres, y al lado seguía diciendo cuatro. Un número
   que miente al lado de la lista que lo desmiente es peor que no ponerlo.

   Se actualiza el TEXTO del contador, no se redibuja el menú: rehacer el
   `innerHTML` en cada render tira los listeners, parpadea y manda la tira del
   celular de vuelta al principio. Qué módulos se ven no cambia dentro de una
   sesión —depende del permiso y de las etapas de la ficha—; lo que cambia son
   los números. */
function refrescarContadoresDelMenu() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  MENU.forEach((m) => {
    if (m.grupo || !m.cuenta) return;
    const a = nav.querySelector('a[data-vista="' + m.id + '"]');
    if (!a) return;
    let n;
    try { n = m.cuenta(); } catch (e) { return; }
    const span = a.querySelector('.cuenta');
    if (n === null || n === undefined) { if (span) span.remove(); return; }
    if (span) span.textContent = n;
    else a.insertAdjacentHTML('beforeend', '<span class="cuenta">' + n + '</span>');
    a.setAttribute('title', m.nombre + (n ? ' · ' + n : ''));
  });
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

  /* 🔴 ACÁ HABÍA UN `h.style.display = 'flex'` (28-08-2026, quitado).

     Era redundante —el elemento nace limpio en el index y `.herramientas` ya
     es `display: flex` en el CSS— y además hacía daño: un estilo EN LÍNEA le
     gana a cualquier regla de hoja, así que la regla que esconde la barra con
     el teclado arriba (`:root.con-teclado .herramientas`) no tenía efecto.

     Marco, con una foto de su iPhone en Presupuesto: se escondían el menú y la
     barra de estado, pero la barra de herramientas seguía ahí comiéndose
     49 px justo cuando quedaban 101 para escribir. Nada la volvía a mostrar por
     JavaScript, así que sacarla no apaga nada: la barra sigue apareciendo por
     CSS como siempre. */

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
  { texto: 'Probar el flujo operacional', icono: 'refrescar', accion: 'flujo',
    pie: 'Que lo cargado en una pantalla le llegue a la que tiene que enterarse' },
  { texto: 'Comprobar cifras de la demostración', icono: 'consolidado', accion: 'cifras',
    pie: 'Que los datos inventados sigan cuadrando con lo medido en el sistema real' },
  { texto: 'Adelantar la fecha del sistema 7 días', icono: 'reloj', accion: 'adelantar',
    pie: 'Lo que hace visibles los tres relojes' },
  { texto: 'Volver la fecha a hoy', icono: 'refrescar', accion: 'fecha-hoy',
    pie: 'Deja el calendario donde estaba' },
  { texto: 'Acerca del sistema', icono: 'info', accion: 'acerca',
    pie: 'Qué es esto y qué no es' },
  /* El interruptor de la sala. Se pone al final y no arriba a propósito: no es
     una función del taller, es una comodidad para mostrar el sistema en dos
     pantallas a la vez. El rótulo dice en qué estado va a quedar, no en cuál
     está: un botón que dice «Sala compartida» cuando ya está encendida obliga
     a adivinar qué pasa al apretarlo. */
  { texto: 'sala', icono: 'base', accion: 'sala', pie: 'sala' },
  /* La salida de emergencia de la sala. La sala se escribe sin identificarse,
     asi que puede quedar adentro algo que no sirve; hasta el 22-08-2026 la
     unica forma de salir era abrir la consola del navegador, que en medio de
     una reunion no es una salida. */
  { texto: 'Reponer la sala con los datos de demostración', icono: 'refrescar',
    accion: 'reponer-sala',
    pie: 'Deja este equipo como recién sembrado y pisa lo que haya en la sala' }
];

/* El rótulo del interruptor se arma al abrir el cuadro, porque depende de cómo
   esté la sala en ese momento. */
function rotuloSala() {
  const s = (typeof Sala !== 'undefined') ? Sala.estado() : { encendida: false };
  return s.encendida
    ? { texto: 'Apagar la sala compartida',
        pie: 'Vuelve a dejar los datos guardados sólo en este equipo' }
    : { texto: 'Encender la sala compartida',
        pie: 'El celular y el computador pasan a ver el mismo estado' };
}

function dialogoDemostracion() {
  dialogo('Datos de demostración', '<p class="pie-nota" style="margin:0 0 10px">' +
    'Los datos de esta pantalla son inventados y están rotulados como tales. ' +
    'Para volver a dejarlos como venían: <strong>Archivo → Reiniciar a datos de demostración</strong>.</p>' +
    /* La pregunta que se hizo desde un celular el 22-08-2026: se creó una orden
       en el teléfono y no apareció en el computador. Va acá, en el cuadro que
       explica qué es esta demostración, y no como una alerta: no es una falla
       que haya que arreglar, es lo que el modelo borrador es. */
    '<p class="pie-nota" style="margin:0 0 12px">' +
    '<strong>Y lo que se carga acá queda en este equipo.</strong> El modelo borrador no tiene ' +
    'servidor ni base de datos: guarda todo en el almacenamiento de este navegador. Una orden ' +
    'creada en el teléfono <strong>no aparece</strong> en el computador, y al revés tampoco — cada ' +
    'dispositivo abre su propia copia de los datos de demostración. Que la información se vea en ' +
    'todas partes a la vez es justamente lo que trae el sistema definitivo con su base de datos.</p>' +
    '<div class="ir-lista">' + HERRAMIENTAS_DEMO.map((x) => {
      // El de la sala se rotula en el momento, según cómo esté.
      const r = x.accion === 'sala' ? rotuloSala() : x;
      return '<button type="button" class="ir-item" data-demo="' + esc(x.accion) + '">' + ico(x.icono) +
      '<span class="nom">' + esc(r.texto) +
      '<span class="gru" style="display:block;font-weight:400">' + esc(r.pie) + '</span></span>' +
      '</button>'; }).join('') +
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

/* ── LA TIRA DE MÓDULOS DEL CELULAR AVISA QUE SIGUE ─────────────────────
   Trece módulos no caben en 375 px, así que la tira se desliza. El problema de
   una fila que se desliza es que no parece una fila que se desliza: se ve como
   si el sistema tuviera cinco módulos y punto, y nadie va a arrastrar para
   buscar lo que no sabe que existe.

   Se MIDE, no se adivina —igual que el aviso de las columnas de la tabla, que
   es el mismo problema y ya estaba resuelto así—: el degradado del borde sólo
   aparece si de verdad queda algo a la derecha, y desaparece al llegar al
   final. En el escritorio, donde la barra es vertical, no aparece nunca. */
function avisarQueHayMasModulos() {
  const s = document.getElementById('sidebar');
  if (!s) return;
  // 4 px de margen: un par de píxeles son redondeo del navegador, no un módulo.
  s.classList.toggle('hay-mas-modulos', s.scrollLeft + s.clientWidth < s.scrollWidth - 4);
}

/* El módulo abierto tiene que estar A LA VISTA. Sin esto, entrar a
   Configuración —que es el último— dejaba la píldora marcada fuera de la
   pantalla: la tira se veía entera sin nada iluminado, o sea mintiendo sobre
   dónde estamos parados. */
function traerModuloALaVista() {
  const a = document.querySelector('#nav a.activo');
  const s = document.getElementById('sidebar');
  if (!a || !s || s.scrollWidth <= s.clientWidth + 4) return;
  /* `nearest` y no `center`: centrar mueve la tira incluso cuando el modulo
     ya se veia, y entrar a la Torre —que es el segundo— escondia el primero
     sin motivo. Con `nearest` solo se mueve lo justo para que aparezca. */
  if (a.scrollIntoView) a.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  avisarQueHayMasModulos();
}

(function () {
  const s = document.getElementById('sidebar');
  if (!s) return;
  s.addEventListener('scroll', avisarQueHayMasModulos, { passive: true });
  window.addEventListener('resize', avisarQueHayMasModulos);
})();
