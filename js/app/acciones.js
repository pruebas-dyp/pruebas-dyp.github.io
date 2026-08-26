/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   LAS ACCIONES DE LA BARRA

   El despachador de la barra de herramientas: exportar, imprimir, las pruebas,
   la sala, el aviso de version y los cuadros de dialogo.

   Salio de `app.js` el 22-08-2026 (COD-7), que llego a 3.249 lineas — por
   encima del punto donde la casa midio que un archivo ya no se puede revisar
   en un pull request. No se movio ni una linea de logica: es corte y pegue.
   ─────────────────────────────────────────────────────────────────────── */

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

    /* ⚠️ SIN BOTÓN QUE LA LLAME desde el 16-08-2026: `Agregar fotos` se sacó de
       la barra de Recepción y ningún otro módulo declara esta acción. Se deja
       porque las fotos siguen estando en el paso 4 y si el botón vuelve, esto
       es lo que tiene que hacer. Si pasa otra tanda sin volver, se borra. */
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
  /* 🔴 «Conectado» significaba sólo que el servidor de archivos responde, y con
     la lucecita verde al lado cualquiera entiende que hay un sistema central
     detrás. No lo hay: el modelo borrador guarda TODO en el almacenamiento de
     este navegador. El 22-08-2026 se creó una orden desde un celular y no
     apareció en el computador — con razón, son dos copias distintas, pero el
     sistema no lo decía en ninguna parte. Ahora lo dice donde se mira. */
  /* La sala compartida decide qué dice esta celda. Apagada, el borrador es lo
     que siempre fue: cada equipo con su copia. Encendida, el celular y el
     computador miran el mismo estado. Si se cae internet lo dice, en vez de
     seguir mostrando un verde que no significa nada. */
  const sala = (typeof Sala !== 'undefined') ? Sala.estado()
             : { encendida: false, error: null, rotulo: 'Datos en este equipo' };
  const tituloSala = !sala.encendida
    ? 'La sala compartida está apagada: lo que se carga acá queda en ESTE equipo. ' +
      'Se enciende en Archivo → Datos de demostración.'
    : sala.error
      ? 'La sala está encendida pero ahora mismo no hay conexión (' + sala.error + '). ' +
        'El sistema sigue funcionando con los datos de este equipo y vuelve a intentar solo.'
      : 'Sala compartida: el celular y el computador ven el mismo estado. ' +
        'SOLO datos de demostración — acá no van datos de personas reales.';
  document.getElementById('estado-barra').innerHTML =
    '<span class="celda' + (sala.encendida && !sala.error ? ' sala-viva' : '') +
      '" title="' + esc(tituloSala) + '">' +
      ico('base') + esc(sala.rotulo) + '</span>' +
    '<span class="celda">' + ico('usuario') + esc(quienMira()) + '</span>' +
    '<span class="celda">Automotora DyP</span>' +
    /* 🔷 EL CRÉDITO DE LA CASA (SIS-3, 23-08-2026). No existía: cero
       apariciones de arttmize.com en todo el sistema publicado.

       Va discreto y va acá abajo a propósito. La marca del sitio es la del
       cliente —el índigo, el logo, el nombre— y este crédito no le compite:
       es una línea en la barra de estado, del tamaño de las demás. */
    '<span class="celda"><a href="https://arttmize.com" target="_blank" rel="noopener noreferrer" ' +
      'title="Sistema desarrollado por Arttmize SpA">Por Arttmize</a></span>' +
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
    { texto: 'Reportería (gráficos)', icono: 'consolidado', accion: 'reporteria', permiso: 'reporteria.ver' }
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
  /* Un ítem con `permiso` sólo se dibuja para quien lo tiene. Es el mismo
     criterio que el botón de la Reportería en el Histórico: la pantalla se
     defiende sola, pero una opción que rebota enseña a desconfiar del menú. */
  caja.innerHTML = items.filter((i) => !i.permiso || Modelo.puede(i.permiso)).map((i) =>
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
    /* Rebota acá además de en la pantalla. Son dos puertas distintas: ésta
       evita que el Histórico quede con `vista = 'reporteria'` guardado en el
       estado, que es lo que haría que el panel se abriera solo la próxima vez
       que la cuenta entre al Histórico. */
    if (!Modelo.puede('reporteria.ver')) {
      return avisar({ ok: false, motivo: 'La Reportería está reservada: muestra la venta y la ' +
        'rentabilidad del taller. Se habilita cuenta por cuenta en Personal.' });
    }
    historicoEstado().vista = 'reporteria';
    return ir('historico');
  }

  /* Encender o apagar la sala compartida. Al encenderla se trae lo que ya hay
     allá —la sala manda sobre el equipo—, así que se avisa con todas las
     letras: si alguien tenía media recepción cargada acá y en la sala hay otra
     cosa, es mejor que lo sepa antes y no después. */
  if (accion === 'reponer-sala') {
    if (typeof Sala === 'undefined') return;
    const encendida = Sala.estado().encendida;
    const aviso = encendida
      ? 'Este equipo vuelve a los datos de demostración y los SUBE a la sala, pisando lo que haya.'
        + '\n\n' + 'Los demás dispositivos conectados van a ver lo mismo en unos segundos.'
      : 'Este equipo vuelve a los datos de demostración.'
        + '\n\n' + 'La sala está apagada, así que no sube nada.';
    if (!confirm(aviso + '\n\n' + '¿Continuar?')) return;
    Sala.reponer();
    ir('torre');
    return dialogo('Sala repuesta',
      '<p>El sistema volvió a la semilla: ' + Modelo.metricas().enTorre + ' vehículos en la torre.' +
      (encendida ? ' Se está subiendo a la sala.' : ' La sala está apagada: no se subió nada.') +
      '</p>');
  }

  if (accion === 'sala') {
    if (typeof Sala === 'undefined') return avisar({ ok: false, motivo: 'La sala no está disponible.' });
    const s = Sala.estado();
    if (!s.encendida &&
        !confirm('Al encender la sala compartida, este equipo pasa a mostrar el estado que ya está ' +
                 'en la sala.\n\nSi acá tenías datos cargados y en la sala hay otros, los de la sala ' +
                 'mandan.\n\n¿Encender?')) return;
    const ahora = Sala.alternar();
    render();
    return avisar({ ok: true, motivo: '' }, ahora
      ? 'Sala compartida encendida. El celular y el computador ven el mismo estado — sólo datos de demostración.'
      : 'Sala apagada. Los datos vuelven a quedar sólo en este equipo.');
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
    render();
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

  /* 🔶 LOS ARNESES NO VIAJAN CON EL SISTEMA (COD-5, 22-08-2026).

     `pruebas.js` y `flujo.js` estaban declarados en `index.html` como cualquier
     otro archivo: 162 KB —el 11% de todo lo que baja el navegador— que el
     cliente descargaba en cada carga y no usaba nunca.

     Y no era solo peso. Esos dos archivos le entregan al cliente el detalle de
     cada error que arreglamos, con nombre y fecha. Es cierto todo lo que dicen
     y esta corregido, pero no es algo que tenga que encontrar leyendo el fuente
     de su propia demostracion.

     Se cargan cuando alguien los pide, desde el menu Archivo. Con `node` siguen
     corriendo igual: el arnes los nombra a mano.

     El sello sale de la etiqueta de `app.js` y no se escribe a mano: lo pone el
     script de publicar, y sin el mismo sello el navegador serviria una copia
     vieja de los arneses contra el codigo nuevo. */
  const arnesCargado = () => typeof Pruebas !== 'undefined' && typeof Flujo !== 'undefined';
  let arnesEnCamino = null;

  function cargarArneses() {
    if (arnesCargado()) return Promise.resolve(true);
    if (arnesEnCamino) return arnesEnCamino;
    const et = document.querySelector('script[src*="js/app.js"]');
    const m = et && et.getAttribute('src').match(/[?&]v=([^&"]+)/);
    const sello = m ? '?v=' + m[1] : '';
    const uno = (ruta) => new Promise((listo, falla) => {
      const s = document.createElement('script');
      s.src = ruta + sello;
      s.onload = () => listo(true);
      s.onerror = () => falla(new Error('No se pudo cargar ' + ruta));
      document.head.appendChild(s);
    });
    arnesEnCamino = uno('js/pruebas.js').then(() => uno('js/flujo.js'));
    return arnesEnCamino;
  }

  /* Se pide el arnes y se vuelve a entrar por la misma puerta. Si no carga se
     DICE: un boton del menu que no hace nada es peor que no tenerlo. */
  function conArnes(cual) {
    cargarArneses().then(() => ejecutarAccion(cual)).catch((e) => {
      avisar({ ok: false, motivo: 'No se pudieron cargar las pruebas: ' + (e && e.message) +
        '. Se abren solo con conexion al servidor del modelo.' });
    });
  }

  if (['pruebas', 'flujo', 'cifras'].indexOf(accion) >= 0 && !arnesCargado())
    return conArnes(accion);

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

  /* El flujo operacional. Se agrupa por VIAJE —de qué pantalla a qué
     pantalla— porque lo que se está comprobando no es una regla suelta sino
     que la información llegue a quien tiene que enterarse. */
  if (accion === 'flujo') {
    const r = Flujo.correr();
    const pasaron = r.filter((x) => x.paso).length;
    let grupo = null;
    const filas = r.map((x) => {
      const cabeza = x.grupo !== grupo
        ? (grupo = x.grupo, '<tr><td colspan="4" style="background:var(--fondo-2);font-weight:700;' +
           'color:var(--azul)">' + esc(x.grupo) + '</td></tr>')
        : '';
      return cabeza +
        '<tr><td>' + (x.paso ? '<span class="et verde">OK</span>' : '<span class="et roja">Falló</span>') +
        '</td><td><strong>' + esc(x.nombre) + '</strong></td>' +
        '<td style="color:var(--gris)">' + esc(x.viaje) + '</td>' +
        '<td>' + esc(x.detalle) + '</td></tr>';
    }).join('');
    return dialogo('Flujo operacional · ' + pasaron + ' de ' + r.length + ' comprobaciones',
      '<p class="pie-nota" style="margin:0 0 10px">No se comprueba acá si el sistema rechaza lo ' +
      'prohibido —para eso están las reglas— sino que <strong>lo que se carga en una pantalla ' +
      'le llegue a la que tiene que enterarse</strong>: el repuesto al bodeguero, la etapa a quien ' +
      'la va a hacer, el vehículo entregado al histórico. Corre sobre una copia aislada.</p>' +
      '<div class="grid-envoltorio"><table class="grid"><thead><tr>' +
      '<th style="width:26px"></th><th>Qué tiene que pasar</th><th>El viaje</th>' +
      '<th>Qué pasó</th></tr></thead><tbody>' + filas + '</tbody></table></div>');
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

/* ───────────────── El doble clic no cuenta dos veces ─────────────────
   SIS-3, 23-08-2026.

   🔴 EL PROBLEMA, COMPROBADO Y NO SUPUESTO. Se probó en el navegador sobre la
   orden 23267: dos llamadas seguidas a escribir bitácora dejaban DOS
   anotaciones idénticas, y dos a crear presupuesto dejaban DOS OR. La regla 15
   —«doble clic en cualquier botón que cree algo no crea dos»— estaba escrita
   desde el principio y enchufada en UN solo lugar, la recepción.

   Dónde se ataja cada cosa, que son dos problemas distintos:

   · Cuando el contenido identifica la intención —el mismo mensaje, en la misma
     orden, del mismo asunto— la llave se arma con los argumentos y el atajo
     vive en el motor (`conLlave`, en `js/modelo.js`). Vale venga de donde
     venga la llamada.

   · Cuando la misma acción repetida es LEGÍTIMA —dos OR sobre la misma orden lo
     son, textual del cliente— el motor no puede distinguir un doble clic de
     una decisión. Ahí lo único que sabe la diferencia es el reloj del clic, y
     por eso se ataja acá.

   ⚠️ NO deshabilita ningún botón, que es regla de la casa. El botón sigue
   respondiendo; lo que se descarta es el segundo disparo del MISMO botón dentro
   de la ventana. Para quien mira, apretó y salió bien. */
const VENTANA_REPIQUE = 600;   // ms
const ultimoDisparo = new Map();

/* ⚠️ SE INDEXA POR EL NOMBRE DEL BOTÓN, NO POR EL NODO, y esto no es un detalle:
   el primer intento usó un `WeakMap` con el elemento de llave y NO ATAJABA NADA.
   Cada acción llama a `render()`, que vuelve a armar el HTML entero, así que el
   botón que recibe el segundo clic es un nodo NUEVO y el mapa no lo conocía.

   Se descubrió probándolo en el navegador —tres clics seguidos en «Agregar OR»
   creaban tres OR— y no se podía descubrir de otra forma: el arnés de consola
   no tiene DOM y ahí el guardia se veía perfecto. */
const nombreDeBoton = (b) => b.id || b.getAttribute('data-crea') || b.textContent.trim();

document.addEventListener('click', (ev) => {
  const b = ev.target && ev.target.closest && ev.target.closest('button');
  if (!b) return;
  /* Sólo los que hacen algo irreversible. Un botón de filtro, de pestaña o de
     abrir un panel se puede apretar veinte veces seguidas sin que pase nada
     malo, y atajarlo se sentiría como que la pantalla no responde. */
  if (!b.matches('[data-crea]')) return;

  const ahora = Date.now();
  const llave = nombreDeBoton(b);
  const previo = ultimoDisparo.get(llave) || 0;
  if (ahora - previo < VENTANA_REPIQUE) {
    ev.stopImmediatePropagation();
    ev.preventDefault();
    return;
  }
  ultimoDisparo.set(llave, ahora);
  // El mapa no crece para siempre: se botan las entradas fuera de la ventana.
  ultimoDisparo.forEach((t, k) => { if (ahora - t > VENTANA_REPIQUE) ultimoDisparo.delete(k); });
}, true);   // en captura: hay que llegar ANTES que el oyente del botón

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
  /* Y se dice en voz alta. El `role="status"` de arriba no alcanza por sí solo:
     el nodo se crea YA con su texto adentro, y varios lectores de pantalla no
     anuncian el contenido de una región que aparece completa — anuncian lo que
     cambia dentro de una que ya estaba. Por eso el anuncio va a una región fija
     que vive desde el arranque. (SIS-3, 23-08-2026: el sistema tenía cero.) */
  Acceso.anunciar(resultado.ok ? (textoOk || 'Listo.') : resultado.motivo, !resultado.ok);
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
    render();
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
