/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   IR A UN MODULO, RENDER Y LAS VISTAS PROPIAS

   El render principal, las tres vistas que viven aca -Taller, Repuestos y
   Detenciones- y la ventana de una OT en su propia pestaña.

   Salio de `app.js` el 22-08-2026 (COD-7), que llego a 3.249 lineas — por
   encima del punto donde la casa midio que un archivo ya no se puede revisar
   en un pull request. No se movio ni una linea de logica: es corte y pegue.
   ─────────────────────────────────────────────────────────────────────── */

/* ───────────────── Ir a un módulo ─────────────────
   Se escribe el nombre y lleva ahí. Con trece paneles repartidos en tres
   grupos, buscar por nombre es más rápido que recorrer el menú con el mouse,
   y sirve igual cuando se está en la ficha de una OT, que no tiene menú.

   Busca también por el grupo y por como se le dice de verdad a cada pantalla:
   nadie pregunta por "Detenciones", pregunta por los autos parados. */
const APODOS = {
  mitrabajo:     'lo mio pendientes tareas que me toca pintar reparar',
  porvalidar:    'validar aceptar revisar visto bueno terminadas aprobar cerrar etapa',
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
    /* 🔴 Y SE REBOTA A UNA PANTALLA QUE LA CUENTA SÍ ALCANCE (22-08-2026).
       Acá decía «si la vista actual no es un módulo conocido, mitrabajo», y esa
       condición no cubría el caso que importa: al arrancar con sesión guardada
       `ui.vista` vale `torre`, que SÍ es un módulo conocido. Resultado: se
       rechazaba la entrada, se avisaba que no tenía acceso… y se repintaba la
       Torre igual. El operario de desabolladura terminó viendo la Torre de
       control con nombres de clientes y compañía. El rebote tiene que mirar si
       la cuenta alcanza el destino, no si el destino existe. */
    if (!MODULOS[ui.vista] || !entraAlModulo(ui.vista)) ui.vista = primerModuloPermitido();
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
  porvalidar:    'Por validar',
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

/* 🔴 `render()` NO PUEDE PINTAR ENCIMA DE UNA FICHA (26-08-2026, Marco).

   «Hago doble clic para visualizar la info de esa OT y me vuelve a la Torre de
   control y más encima me saca el panel lateral.»

   La ventana de una OT no la dibuja `render()`: la dibuja `modoRegistro`.
   `render()` pinta `ui.vista`, que en esa ventana vale «torre» —nadie la cambió,
   no hace falta—, así que llamarlo ahí BORRA LA FICHA Y PINTA LA TORRE, y sin
   barra lateral, porque el menú ya estaba escondido.

   El cuidado existía, pero como una línea copiada CUATRO veces en los sitios
   que se acordaron: app.js, acciones.js dos veces, ficha.js. `sala.js` se
   escribió después y tiene dos repintados que no se enteraron —y la sala
   repinta sola, cada latido—. Con la sala encendida la ficha duraba un
   segundo. Apagada no pasaba nunca, y por eso no se vio al publicar.

   ⚠️ Por eso el guardia vive ACÁ ADENTRO y no en los que llaman. Un repintado
   que se olvide de mirar si hay una ficha abierta no puede existir: no hay
   dónde olvidarlo. El primer intento fue una función aparte, `repintar()`, que
   cada sitio tenía que acordarse de usar — o sea, el mismo error con otro
   nombre. Se probó: devolviendo `render()` al latido de la sala, ninguna
   prueba se caía.

   No hay recursión: `modoRegistro` pinta la ficha derecho y no vuelve por
   acá. Y `ir()` limpia `ui.registroOT` ANTES de repintar, que es como se sale
   de la ficha hacia un módulo. */
function render() {
  if (ui.registroOT && typeof modoRegistro === 'function') return modoRegistro(ui.registroOT);

  const m = MENU.find((x) => x.id === ui.vista);
  document.getElementById('titulo').innerHTML =
    (m ? ico(m.icono, 'g') : '') +
    esc(enReporteria() ? 'Reportería' : (TITULOS[ui.vista] || ''));
  document.getElementById('bajada').textContent = '';

  pintarShell();
  refrescarContadoresDelMenu();

  const c = document.getElementById('contenido');
  const fn = {
    mitrabajo: vMiTrabajo, porvalidar: vPorValidar, recepcion: vRecepcion, torre: vTorre, taller: vTaller, entrega: vEntrega,
    repuestos: vRepuestos, detenidos: vDetenidos, presupuesto: vPresupuesto,
    bodega: vBodega, documentos: vDocumentos, historico: vHistorico,
    expediente: vExpediente,
    personal: vPersonal, consolidado: vConsolidado, configuracion: vConfiguracion
  }[ui.vista];
  c.innerHTML = fn ? fn() : vSinLevantar(ui.vista);
  if (fn) {
    const p = { mitrabajo: pMiTrabajo, porvalidar: pPorValidar, recepcion: pRecepcion, torre: pTorre, taller: pTaller, entrega: pEntrega,
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
  /* Y por la misma razón otra vez: amarrar cada `<label>` con su campo vale
     para las quince pantallas y para las que vengan. Se pasa `document` y no
     `c` porque los campos de la barra y de los diálogos viven fuera del
     contenido. Son 118 controles: cuesta menos que pintar la tabla. */
  Acceso.etiquetar(document);

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

/* 🔴 ABRIR UNA PESTAÑA NUESTRA NO PUEDE ECHAR A NADIE (23-08-2026, Marco).

   Esto decía `window.open(url, '_blank', 'noopener')` y cerraba la sesión: el
   doble clic en una orden abría la ficha pidiendo entrar de nuevo.

   El porqué exacto, que no se adivina: desde COD-1 la sesión vive en
   `sessionStorage`, y el navegador **le da una copia** del `sessionStorage` a
   la pestaña que abre… **salvo con `noopener`**. Con esa bandera la pestaña
   nueva nace en otro grupo de contextos y su almacenamiento arranca VACÍO.
   O sea que la bandera que uno pone «por seguridad» era la que echaba al
   usuario.

   `noopener` existe para que un destino ajeno no pueda tocar `window.opener`.
   Acá el destino es nuestra propia página, en el mismo origen: no hay tercero
   del que protegerse. Se mantiene, y con razón, en el enlace a arttmize.com de
   la barra de estado, que sí sale del sitio.

   ⚠️ Cualquier `window.open` que se agregue a este sistema tiene que pasar por
   acá. Hay una prueba que recorre el código y falla si aparece otro suelto. */
/* ⚠️ Y NADA MÁS QUE ESO, a propósito.

   La primera versión agregaba `w.opener = null` después de abrir, para cortar
   el puntero de vuelta sin perder la copia del `sessionStorage`. En teoría es
   seguro —el navegador ya copió el almacenamiento al crear la pestaña— pero
   toca justo el mecanismo que se está arreglando, y no se pudo comprobar en un
   navegador de verdad. En este proyecto «en teoría» ya salió caro varias veces.
   Se saca: el destino es nuestra propia página, así que no hay tercero del que
   proteger el `opener`. */
function abrirNuestra(url) {
  dejarPase();
  return window.open(url, '_blank');
}

/* ───────── El pase: la sesión viaja con la pestaña ─────────
   🔴 26-08-2026. Sacar `noopener` —acá arriba— hizo que Chrome de escritorio
   le copiara el `sessionStorage` a la pestaña nueva, y ahí se dio el asunto por
   cerrado. No estaba cerrado: esa copia es una cortesía del navegador, no una
   garantía. No la hace con `noopener`, no la hace si el enlace se abre a mano,
   y en el teléfono depende de cuál sea. Cada vez que no la hace, la pestaña
   nueva arranca SIN SESIÓN, y el arranque pinta la Torre de control con el
   ingreso encima. Es exactamente lo que Marco vio, panel por panel: «se me
   abre una pestaña pero luego me devuelve a la Torre de control».

   El pase no le pide nada al navegador: antes de abrir, la pestaña que abre
   deja el id de quien tiene la sesión, y la pestaña nueva lo levanta al
   arrancar. Tres candados, porque esto vuelve a dejar una sesión en el
   almacenamiento del navegador entero —y eso es justo lo que COD-1 sacó de
   ahí—:

     · DE UN SOLO USO. Quien lo lee lo borra, le haya servido o no.
     · DIEZ SEGUNDOS, con la hora guardada adentro. Cerrar y volver a abrir el
       navegador no lo estira: se compara contra el reloj, no contra la vida de
       la pestaña.
     · Y LA PESTAÑA QUE LO DEJÓ LO BORRA IGUAL a los diez segundos, por si la
       pestaña nueva nunca llegó a arrancar.

   Lo que queda expuesto, dicho derecho: si alguien mata el navegador dentro de
   esos diez segundos y otra persona lo abre antes de que se cumplan, entra sin
   clave. No es una sesión guardada —es una ventana de diez segundos que hay
   que acertar—, y la alternativa era que el sistema echara a la gente cada vez
   que abre una orden. */
const CLAVE_PASE = 'dyp-pase';
const PASE_VIVE = 10000;

function dejarPase() {
  const p = Modelo.personaActual();
  if (!p) return;
  try {
    localStorage.setItem(CLAVE_PASE, JSON.stringify({ id: p.id, t: new Date().getTime() }));
    setTimeout(() => { try { localStorage.removeItem(CLAVE_PASE); } catch (e) { /* nada */ } }, PASE_VIVE);
  } catch (e) { /* sin almacenamiento: la pestaña nueva pedirá entrar, y está bien */ }
}

function tomarPase() {
  let d = null;
  try {
    d = JSON.parse(localStorage.getItem(CLAVE_PASE) || 'null');
    localStorage.removeItem(CLAVE_PASE);
  } catch (e) { return null; }
  if (!d || !d.id || !d.t) return null;
  if (new Date().getTime() - d.t > PASE_VIVE) return null;
  return d.id;
}

/* De dónde saca la sesión una pestaña recién abierta, en orden:

     1. de la suya, si el navegador se la copió —es el camino normal—;
     2. de la pestaña que la abrió, leyendo su almacenamiento directo. Es el
        mismo origen, así que se puede. `window.opener.Modelo` NO se puede:
        `Modelo` es una constante léxica y no vive en `window`;
     3. del pase, que es el único que sirve cuando `opener` viene vacío.

   Devuelve si esta pestaña quedó con sesión. */
function sesionDeEstaPestana() {
  if (Modelo.retomar_sesion()) return true;

  let delQueAbrio = null;
  try {
    if (window.opener && window.opener.sessionStorage)
      delQueAbrio = window.opener.sessionStorage.getItem(Modelo.CLAVE_SESION);
  } catch (e) { delQueAbrio = null; }   // otro origen: no es asunto nuestro

  return Modelo.adoptar_sesion(delQueAbrio) || Modelo.adoptar_sesion(tomarPase());
}

function abrirFicha(numero, tab, modo) {
  abrirNuestra(urlFicha(numero, tab, modo));
}

/* ───────────── Doble clic para abrir la orden ─────────────
   El cliente pidió el 15-08-2026 que el doble clic abra la orden desde TODOS
   los paneles, no sólo desde la torre y el histórico.

   `alSimple` es opcional: en los paneles que no despliegan nada, la fila sólo
   responde al doble clic. */
/* 🔴 EL PRIMER CLIC NO PUEDE MOVER LA FILA (26-08-2026, Marco).

   Lo que estaba escrito acá contaba el doble clic a mano porque el redibujo
   del primer clic reemplaza la fila y el navegador ya no puede emitir
   `dblclick`. Eso era cierto, pero atacaba el síntoma. El problema es el
   redibujo mismo:

     el primer clic despliega la fila → la tabla se rearma → LA FILA QUE SE
     ESTABA APUNTANDO SE CORRE → el segundo clic cae en otra parte.

   Medido en Chrome con una orden ya desplegada arriba: la fila de destino
   saltó de y=384 a y=643. Doscientos cincuenta y nueve píxeles bajo el dedo,
   entre un clic y el otro. Por eso «actualmente tiene que contraer primero
   todo para después doble clic y abrir»: con todo contraído nada se mueve y el
   gesto acierta. No era una manía del usuario, era la única forma de que
   funcionara.

   Ahora el clic sobre la celda de la OT NO ACTÚA AL TIRO: espera la ventana
   del doble clic. Si llega un segundo clic, es doble y abre la pestaña; si no
   llega, recién ahí despliega. Entre los dos clics el DOM no cambia, así que
   la fila no se mueve y el segundo clic cae donde el primero.

   La demora se paga SÓLO en la celda de la OT. El resto de la fila —y la
   flecha— siguen desplegando al instante, que es como se usa la tabla el
   noventa por ciento del tiempo.

   ⚠️ Y SE VA EL `dblclick` NATIVO. Ahora que la fila sobrevive entre los dos
   clics, el navegador SÍ lo emite, y con los dos caminos vivos un solo doble
   clic llamaba a `alDoble()` dos veces — dos `window.open`, dos pestañas. En
   los paneles sin desplegable (Bodega, Documentos) eso ya estaba pasando. Un
   gesto, un camino. */
const VENTANA_DOBLE_CLIC = 500;
const memoriaClic = { clave: null, t: 0, pendiente: null };

/* El clic aplazado que está esperando su ventana. Si llega OTRO clic que no es
   su doble —otra fila, otra celda—, no se bota: se ejecuta al tiro y recién
   después se atiende el nuevo. Botarlo era perder un clic del usuario. */
function resolverPendiente(claveNueva) {
  const p = memoriaClic.pendiente;
  if (!p) return;
  clearTimeout(p.temporizador);
  memoriaClic.pendiente = null;
  if (p.clave !== claveNueva) p.accion();
  // El de la MISMA clave no se ejecuta: el clic nuevo lo reemplaza o lo
  // convierte en doble, y en ambos casos correrlo además sería duplicarlo.
}

function conDobleClic(el, clave, alDoble, alSimple, abridor) {
  const abre = (ev) => !abridor || (ev.target && abridor.contains(ev.target));

  el.addEventListener('click', (ev) => {
    /* Fuera de la celda que abre no hay doble clic que esperar: despliega al
       instante, como siempre. */
    if (!abre(ev)) {
      resolverPendiente(clave);
      memoriaClic.clave = null; memoriaClic.t = 0;
      if (alSimple) alSimple();
      return;
    }

    const ahora = new Date().getTime();
    if (memoriaClic.clave === clave && ahora - memoriaClic.t < VENTANA_DOBLE_CLIC) {
      resolverPendiente(clave);
      memoriaClic.clave = null; memoriaClic.t = 0;
      /* `alDoble` devuelve `false` cuando no pudo abrir —la torre, si no
         encuentra la orden de esa fila—. Ahí el gesto cae al clic simple en
         vez de quedarse en nada. */
      if (alDoble() !== false) return;
      if (alSimple) alSimple();
      return;
    }

    resolverPendiente(clave);
    memoriaClic.clave = clave; memoriaClic.t = ahora;
    if (!alSimple) return;                       // nada que aplazar
    const pendiente = { clave, accion: alSimple, temporizador: 0 };
    pendiente.temporizador = setTimeout(() => {
      if (memoriaClic.pendiente === pendiente) memoriaClic.pendiente = null;
      alSimple();
    }, VENTANA_DOBLE_CLIC);
    memoriaClic.pendiente = pendiente;
  });

  if (abridor) {
    abridor.classList.add('abre-ot');
    abridor.title = 'Doble clic abre la orden en otra pestaña';
  }
  /* Sin `title` en la fila entera. Lo tenía, y el globo del navegador se
     montaba encima de la etiqueta de datos —que dice bastante más que el
     globo— y tapaba la fila de abajo. */
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
