/* TORRE DE CONTROL — la pantalla de entrada y la que más se mira.

   Las 17 columnas del sistema actual, en su orden. Un clic despliega el expandible;
   doble clic abre la orden.

   Detalle y decisiones: 00 Documentacion/DECISIONES.md · js/vistas/torre.js */

/* ───────────────── Orden de la torre ─────────────────
   El cliente pidió el 15-08-2026 que la torre esté SIEMPRE ordenada por
   correlativo. Antes el orden era fijo por fecha de ingreso descendente y no
   se podía cambiar; ahora el correlativo es el que manda al entrar y las demás
   columnas quedan disponibles para reordenar.

   Cada columna declara de dónde sale su valor. Las que no tienen sentido
   ordenar —la lupa, la alerta— simplemente no entran a este mapa y su
   encabezado no se vuelve clicable. */
const ORDEN_TORRE = {
  ot:         (o) => Number(o.numeroOT) || 0,
  or:         (o) => (o.presupuestos[0] || {}).numeroOR || '',
  patente:    (o) => o.patente || '',
  siniestro:  (o) => o.siniestro || '',
  cliente:    (o) => o.cliente || '',
  compania:   (o) => (o.compania === '—' ? '' : o.compania || ''),
  marca:      (o) => o.marca || '',
  modelo:     (o) => o.modelo || '',
  color:      (o) => o.color || '',
  ingreso:    (o) => +o.fechaIngreso || 0,
  tipo:       (o) => o.origenIngresoNombre || '',
  dias:       (o) => (o.fueraDeTaller ? 0 : Number(o.diasKpi) || 0),
  diastot:    (o) => Number(o.diasTotales) || 0,
  estado:     (o) => o.estadoNombre || '',
  etapa:      (o) => (o.etapa ? (etapaPorCodigo(o.etapa) || {}).nombre || '' : ''),
  encargado:  (o) => o.asignado || '',
  entrega:    (o) => +o.fechaCompromiso || 0
};

/* Compara sin importar si el valor es número, fecha o texto. El texto va con
   localeCompare en es-CL para que las tildes y la ñ queden donde corresponde:
   con un `<` a secas, "Ñuñoa" cae después de "Zapata". */
function compararOrden(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'es-CL', { numeric: true, sensitivity: 'base' });
}

/* Encabezado clicable. La flecha usa las mismas entidades que el expandible de
   la fila (&#9656;), no un emoji. La columna activa se marca en el propio
   encabezado: si no se ve cuál manda, el usuario no sabe qué está mirando. */
function thOrden(clave, rotulo, titulo) {
  const f = ui.torre;
  const activa = f.orden === clave;
  const flecha = activa ? '<span class="flechita">' + (f.desc ? '&#9662;' : '&#9652;') + '</span>' : '';
  /* Sin globo que diga "clic para ordenar" (15-08-2026, pedido de Marco: que
     no se vea ningún texto de ordenar). Queda el `title` sólo cuando la
     columna trae una explicación PROPIA —qué mide, no cómo se usa—; la flecha
     ya dice por dónde va el orden y el cursor dice que se puede apretar. */
  return '<th class="orden' + (activa ? ' activa' : '') + '" data-orden="' + esc(clave) + '"' +
    (titulo ? ' title="' + esc(titulo) + '"' : '') + '>' + esc(rotulo) + flecha + '</th>';
}

/* Cada situacion, con SU regla, en un solo lugar. Antes la regla vivia dentro
   del filtro y la cuenta la daba `Modelo.metricas()` por otro camino: dos
   caminos para el mismo numero terminan diciendo cosas distintas. Con los
   chips mostrando la cuenta, un chip que dice 53 y al apretarlo lista 46 es
   peor que no mostrar nada. */
const SITUACION_TORRE = {
  piso:      () => true,
  taller:    (o) => o.enTaller,
  fuera:     (o) => o.fueraDeTaller,
  repuesto:  (o) => tieneRepuestoPendiente(o),
  sinetapa:  (o) => !o.etapasAsignadas.length,
  sobremeta: (o) => o.enTaller && o.sobreMeta
};

/* Cuantas ordenes vera el usuario si aprieta cada chip, respetando los demas
   filtros que tenga puestos. Con una busqueda activa, la cuenta del chip es
   la de ESA busqueda: prometer 41 y mostrar 3 es mentir dos veces. */
function cuentasSituacion() {
  const f = ui.torre;
  const q = f.busqueda.trim().toLowerCase();
  const base = Modelo.torre().filter((o) => {
    if (f.compania !== 'todas' && o.compania !== f.compania) return false;
    if (f.etapa !== 'todas' && o.etapa !== f.etapa) return false;
    if (q) {
      const ors = o.presupuestos.map((p) => p.numeroOR).join(' ');
      const heno = [o.numeroOT, ors, o.patente, o.siniestro, o.cliente, o.marca, o.modelo]
        .join(' ').toLowerCase();
      if (!heno.includes(q)) return false;
    }
    return true;
  });
  const c = {};
  Object.keys(SITUACION_TORRE).forEach((k) => { c[k] = base.filter(SITUACION_TORRE[k]).length; });
  return c;
}

function filtrarTorre() {
  const f = ui.torre;
  const q = f.busqueda.trim().toLowerCase();
  const sacar = ORDEN_TORRE[f.orden] || ORDEN_TORRE.ot;
  const situacion = SITUACION_TORRE[f.situacion] || SITUACION_TORRE.piso;
  return Modelo.torre().filter((o) => {
    if (f.compania !== 'todas' && o.compania !== f.compania) return false;
    if (f.etapa !== 'todas' && o.etapa !== f.etapa) return false;
    if (!situacion(o)) return false;
    if (q) {
      const ors = o.presupuestos.map((p) => p.numeroOR).join(' ');
      const heno = [o.numeroOT, ors, o.patente, o.siniestro, o.cliente, o.marca, o.modelo].join(' ').toLowerCase();
      if (!heno.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => {
    const c = compararOrden(sacar(a), sacar(b));
    // Empate: se desempata por correlativo, para que el orden no baile entre
    // repintados. Sin esto, dos órdenes con el mismo estado cambian de lugar
    // cada vez que se refresca la pantalla.
    if (c === 0) return Number(b.numeroOT) - Number(a.numeroOT);
    return f.desc ? -c : c;
  });
}

function vTorre() {
  const f = ui.torre;
  const m = Modelo.metricas();
  const todas = filtrarTorre();
  // `porPagina` puede venir en 0 —"Todas"—: `tamanoEfectivo` lo traduce al
  // largo de la lista, porque cortar de a 0 devuelve una tabla vacía.
  const porPagina = tamanoEfectivo(f.porPagina, todas.length);
  const totalPag = Math.max(1, Math.ceil(todas.length / porPagina));
  if (f.pagina > totalPag) f.pagina = totalPag;
  const desde = (f.pagina - 1) * porPagina;
  const pagina = todas.slice(desde, desde + porPagina);

  const kpiNombre = m.kpi === 'estadia_actual' ? 'estadía actual' : 'reparación acumulada';
  const cuentas = cuentasSituacion();

  return `
  <div class="panel">
    <div class="cab">
      <div><h2>${ico('torre', 'g')}Torre de control</h2>
        <div class="desc">Las 17 columnas del sistema actual. Un clic despliega el expandible; doble clic abre la orden</div></div>
      <div class="filtros">
        <input type="search" id="q-torre" placeholder="OT, OR, patente, siniestro o cliente" value="${esc(f.busqueda)}">
        <select id="s-compania"><option value="todas">Todas las compañías</option>
          ${COMPANIAS.map((c) => '<option value="' + esc(c.codigo) + '"' + (f.compania === c.codigo ? ' selected' : '') + '>' + esc(c.nombre) + '</option>').join('')}</select>
        <select id="s-etapa"><option value="todas">Todas las etapas</option>
          ${ETAPAS.map((e) => '<option value="' + esc(e.codigo) + '"' + (f.etapa === e.codigo ? ' selected' : '') + '>' + esc(e.nombre) + '</option>').join('')}</select>
      </div>
    </div>
    <div class="cuerpo" style="padding-bottom:0">
      ${/* Las cinco tarjetas que había arriba se sacaron el 16-08-2026: ocupaban
           el alto que la tabla necesita. Sus NÚMEROS no se perdieron — pasaron
           acá, a los chips, que ya eran exactamente las mismas categorías y
           además filtran. Antes había que leer la tarjeta y después apretar el
           chip; ahora es lo mismo en un solo lugar. */''}
      <div class="chips" id="chips-sit">
        ${[['piso', 'Todos'], ['taller', 'En taller'], ['fuera', 'Fuera de taller'],
           ['repuesto', 'Con repuesto pendiente'], ['sinetapa', 'Sin etapa asignada'],
           ['sobremeta', 'Sobre los ' + m.metaDias + ' días']]
          .map(([k, n]) => [k, n, cuentas[k]])
          .map(([k, n, c]) => '<button class="chip' + (f.situacion === k ? ' activo' : '') +
            '" data-sit="' + k + '">' + esc(n) +
            '<span class="cuenta">' + c + '</span></button>').join('')}
      </div>
    </div>
    <div class="grid-envoltorio">
      <table class="grid">
        <thead><tr>
          <th style="width:26px"></th>
          ${thOrden('ot', 'OT')}${thOrden('or', 'OR')}${thOrden('patente', 'Patente')}
          ${thOrden('siniestro', 'N° Siniestro')}${thOrden('cliente', 'Cliente')}
          ${thOrden('compania', 'Compañia')}${thOrden('marca', 'Marca')}${thOrden('modelo', 'Modelo')}
          ${thOrden('color', 'Color')}${thOrden('ingreso', 'Fecha de Ingreso')}${thOrden('tipo', 'Tipo')}
          ${thOrden('dias', 'Días', 'El reloj elegido en Configuración: ' + kpiNombre + '. En el original hay uno solo y se reinicia al regrabar el estado.')}
          ${thOrden('diastot', 'Días tot.', 'Días desde el ingreso. Nunca se reinicia.')}
          ${thOrden('estado', 'Estado')}${thOrden('etapa', 'Etapa')}${thOrden('encargado', 'Encargado')}
          ${thOrden('entrega', 'Fecha de Entrega')}
          <th title="La inicial del asunto de cada mensaje de bitácora">Alerta</th>
        </tr></thead>
        <tbody>${pagina.length ? pagina.map(filaTorre).join('') :
          '<tr><td colspan="19"><div class="vacio"><div class="titulo">Sin resultados</div>' +
          '<div class="texto">Ninguna orden coincide con el filtro.</div></div></td></tr>'}</tbody>
      </table>
    </div>
    <div class="pie-grid">
      <div class="info">Mostrando ${todas.length ? desde + 1 : 0}–${Math.min(desde + porPagina, todas.length)} de ${todas.length}</div>
      <div class="ctrl">
        ${/* Sólo el paso que lleva a alguna parte, igual que en el resto de las
              tablas: en la primera página no hay «Anterior» que apretar, y un
              botón apagado ocupa el mismo lugar sin hacer nada. */''}
        ${selectorTamano('tam-torre', f.porPagina)}
        ${f.pagina > 1 ? '<button class="btn secundario" id="pag-ant">Anterior</button>' : ''}
        ${totalPag > 1 ? '<span class="info">Página ' + f.pagina + ' de ' + totalPag + '</span>' : ''}
        ${f.pagina < totalPag ? '<button class="btn secundario" id="pag-sig">Siguiente</button>' : ''}
      </div>
    </div>
  </div>
`;
}

/* La columna Alerta. Cada mensaje de bitácora enciende la bandera de su
   asunto; la letra es su inicial y las seis son distintas entre sí, así que
   no hay colisión. Se muestran en el orden del catálogo — en el original el
   orden varía entre filas y no significa nada. */
function chipsAlerta(o) {
  if (!o.alertas.length) return '<span style="color:var(--gris-2)">—</span>';
  return o.alertas.map((a) =>
    '<span class="cod" title="' + esc(a.asunto) + '" style="display:inline-block;width:15px;height:15px;' +
    'line-height:15px;text-align:center;border:1px solid var(--borde-fuerte);border-radius:2px;' +
    'margin-right:2px;font-size:10px">' + esc(a.letra) + '</span>').join('');
}

function filaTorre(o) {
  const e = o.etapa ? etapaPorCodigo(o.etapa) : null;
  const fuera = o.fueraDeTaller;
  const pend = o.repuestos.filter((r) => !r.fechaBodega).length;
  const sobreMeta = !fuera && o.sobreMeta;
  const abierta = ui.torre.abierta === o.id;

  // La OR es "el apellido" de la OT y la genera cada presupuesto: puede haber
  // varias, y por eso el original muestra la cantidad en esta columna.
  const ors = o.presupuestos.map((p) => p.numeroOR);

  let html = '<tr class="fila' + (abierta ? ' abierta' : '') + '" data-ot="' + esc(o.id) + '">' +
    '<td><span class="flecha">&#9656;</span></td>' +
    '<td class="num"><strong>' + o.numeroOT + '</strong></td>' +
    // El mouse sobre la OR muestra el detalle de ese presupuesto sin abrir la
    // orden: es lo que pidió el cliente el 15-08-2026.
    '<td class="num">' + (ors[0]
      ? '<span data-or="' + esc(ors[0]) + '">' + esc(ors[0]) + '</span>'
      : '—') +
      (ors.length > 1 ? ' <span class="et gris" title="' + esc(ors.join(' · ')) +
        '">+' + (ors.length - 1) + '</span>' : '') + '</td>' +
    '<td><span class="patente">' + esc(o.patente) + '</span></td>' +
    '<td class="num">' + (o.siniestro ? esc(o.siniestro) : '<span style="color:var(--gris-2)">—</span>') + '</td>' +
    '<td>' + esc(o.cliente) +
      (o.prioridad === 'express' ? ' <span class="et roja">Express</span>' : '') + '</td>' +
    '<td>' + (o.compania === '—' ? '<span style="color:var(--gris-2)">—</span>'
      : '<span class="et ' + (o.compania === 'SURA' ? 'azul' : 'violeta') + '">' + esc(o.compania) + '</span>') + '</td>' +
    '<td>' + esc(o.marca || '—') + '</td>' +
    '<td>' + esc(o.modelo || '—') + '</td>' +
    '<td>' + esc(o.color || '—') + '</td>' +
    '<td class="num">' + fFechaHora(o.fechaIngreso) + '</td>' +
    '<td>' + esc(o.origenIngresoNombre || '—') + '</td>' +
    '<td class="num">' + (fuera ? '<span style="color:var(--gris)">0</span>'
      : (sobreMeta ? '<strong style="color:var(--ambar)">' + o.diasKpi + '</strong>' : o.diasKpi)) + '</td>' +
    '<td class="num" style="color:var(--gris)">' + o.diasTotales + '</td>' +
    '<td><span class="et ' + esc(o.estadoClase) + '">' + esc(o.estadoNombre) + '</span></td>' +
    // "Pendiente" no es una etapa del maestro: es lo que muestra el listado
    // cuando la OT no tiene ninguna asignada. Hoy son 53 de 102.
    '<td>' + (e ? '<i class="punto" style="background:' + e.color + '"></i>' + esc(e.nombre)
      : '<span class="et gris">Pendiente</span>') + '</td>' +
    '<td>' + (o.asignado ? esc(o.asignado) : '<span class="et gris">Sin Asignar</span>') + '</td>' +
    '<td class="num">' + (o.fechaCompromiso ? fFechaHora(o.fechaCompromiso) : '—') + '</td>' +
    '<td>' + chipsAlerta(o) + (pend ? ' <span class="et roja" title="' + pend +
      ' repuestos por llegar">' + pend + '</span>' : '') + '</td></tr>';

  if (abierta) html += '<tr class="detalle"><td colspan="19">' + detalleOT(o) + '</td></tr>';
  return html;
}

/* 🔶 DOS PANELES, NO CUATRO (26-08-2026, pedido del cliente).

   Se fueron «Los tres relojes» y «Repuestos, presupuestos y fotos». La mayor
   parte de lo que mostraban NO se pierde: se mudó, y por eso sobraban acá.

   | Lo que salía             | Dónde sigue estando                          |
   |--------------------------|----------------------------------------------|
   | Repuestos, OR, fotos     | Los botones grandes de la rejilla de abajo   |
   | Situación en taller      | Columna ESTADO y las pestañas del panel      |
   | Etapa y encargado        | Columnas ETAPA y ENCARGADO                   |
   | Fecha de entrega         | Columna FECHA DE ENTREGA                     |
   | Días y días totales      | Columnas DÍAS y DÍAS TOT.                    |

   🔴 Lo único que SÍ desaparece de la Torre son los tres relojes EXPLICADOS
   —«nunca se reinicia», «se reanuda al reingresar», «vuelve a cero»— y el aviso
   ámbar de sobre la meta. Siguen completos en la ficha de la OT, y la pestaña
   «Sobre los 15 días» sigue filtrando las que se pasaron. Es una decisión
   tomada y no un descuido: los tres relojes son la corrección C-1, el argumento
   central del proyecto. Anotado en C-49.

   Con los paneles se fueron `e`, `pend`, `fuera`, `hitos`, `fotos` y la llamada
   a `totalOT(o)`: calcular algo que nadie mira es lo que después hace creer que
   una función sigue viva. */
function detalleOT(o) {
  const dato = (k, v) => '<div class="dato"><span class="k">' + esc(k) + '</span><span class="v">' + v + '</span></div>';

  return '<div class="ficha-detalle"><div class="ficha-rejilla detalle-torre">' +
    '<fieldset class="bloque"><legend>Vehículo</legend>' +
      dato('Patente', '<span class="patente">' + esc(o.patente) + '</span>') +
      dato('Marca y modelo', esc([o.marca, o.modelo].filter(Boolean).join(' ') || '—')) +
      dato('Año', o.anio || '—') + dato('Color', esc(o.color || '—')) +
      dato('VIN', esc(o.vin || '—')) +
      dato('Kilometraje', fKm(o.recepcion && o.recepcion.km)) +
      dato('Combustible', fComb(o.recepcion && o.recepcion.combustible)) +
      /* 🔴 LA FECHA DE INGRESO SE QUEDA, y se muda acá. Vivía en el panel de los
         relojes, que se fue. Va con hora y no solo con día —`fFechaHora`—
         porque el original la guarda al segundo y es el ORIGEN de los tres
         contadores: sin la hora, un auto que entró a las 18:40 y otro que entró
         a las 08:10 del mismo día se leen igual. */
      dato('Fecha de Ingreso', fFechaHora(o.fechaIngreso)) + '</fieldset>' +

    '<fieldset class="bloque"><legend>Cliente y siniestro</legend>' +
      dato('Cliente', esc(o.cliente)) +
      // 🔴 El RUT y el domicilio se enmascaran por rol. Acá está MODELADO;
      // se garantiza en la base con RLS, no en el navegador.
      dato('RUT', '<span title="Enmascarado por rol">' + esc(String(o.rut || '').replace(/\d(?=.{4})/g, '•')) + '</span>') +
      dato('Teléfono', esc(o.telefono || '—')) +
      dato('Viene por', esc(o.origenIngresoNombre || '—')) +
      (o.siniestro ? dato('Compañía', esc(o.compania)) + dato('Siniestro', esc(o.siniestro)) +
        dato('Deducible', fMonto(o.deducible)) + dato('Liquidador', esc(o.liquidador || '—')) : '') +
      dato('Prioridad', o.prioridad === 'express'
        ? '<span class="et roja">Express</span>' : '<span class="et gris">Normal</span>') + '</fieldset>' +

    '</div>' +

    /* 🔶 LA REJILLA DE LAS PANTALLAS DE LA ORDEN (16-08-2026, pedido del
       cliente). Reemplaza a `Ver repuestos` y `Ver presupuesto`, que eran dos
       botones de texto sueltos: ahora están las ocho pantallas que cuelgan de
       la orden en el sistema real, con su icono y su rótulo literal.

       Salen de `PANTALLAS_OT`, la MISMA lista que usa la ficha — ver
       `js/vistas/pantallas-ot.js` y por qué no está copiada acá.

       ⚠️ `Abrir en pestaña nueva` y `Ver en Taller` quedan ARRIBA y como
       botones de texto, fuera de la rejilla. No son pantallas de la orden:
       uno es otra forma de abrir la misma orden —el gesto que el dueño usa
       todos los días— y el otro es un módulo. Meterlos entre los ocho haría
       creer que son lo mismo. */
    '<div class="acciones-ficha">' +
      '<button class="btn" data-abrir="' + o.numeroOT + '">Abrir en pestaña nueva</button>' +
      '<button class="btn secundario" data-ver="taller">Ver en Taller</button>' +
    '</div>' +
    rejillaPantallasOT(o) + '</div>';
}

function pTorre() {
  const q = document.getElementById('q-torre');
  if (q) {
    q.addEventListener('input', () => {
      ui.torre.busqueda = q.value; ui.torre.pagina = 1; ui.torre.abierta = null;
      render();
      const nq = document.getElementById('q-torre');
      nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length);
    });
  }
  const sc = document.getElementById('s-compania');
  if (sc) sc.addEventListener('change', () => { ui.torre.compania = sc.value; ui.torre.pagina = 1; render(); });
  const se = document.getElementById('s-etapa');
  if (se) se.addEventListener('change', () => { ui.torre.etapa = se.value; ui.torre.pagina = 1; render(); });

  /* Cuántas filas por página. Vuelve a la primera: quedarse en la página 3 con
     otro tamaño muestra otras órdenes sin que nadie haya pedido moverse. */
  const st = document.getElementById('tam-torre');
  if (st) st.addEventListener('change', () => {
    ui.torre.porPagina = Number(st.value) || 0; ui.torre.pagina = 1; ui.torre.abierta = null; render();
  });

  document.querySelectorAll('[data-sit]').forEach((b) => b.addEventListener('click', () => {
    ui.torre.situacion = b.dataset.sit; ui.torre.pagina = 1; ui.torre.abierta = null; render();
  }));

  /* Reordenar por columna. Clic en otra columna: se ordena por ella, y arranca
     descendente porque en esta pantalla lo que interesa es lo más reciente y lo
     más alto. Clic en la que ya está activa: invierte. */
  document.querySelectorAll('[data-orden]').forEach((th) => th.addEventListener('click', () => {
    const clave = th.dataset.orden;
    if (ui.torre.orden === clave) ui.torre.desc = !ui.torre.desc;
    else { ui.torre.orden = clave; ui.torre.desc = true; }
    ui.torre.pagina = 1; ui.torre.abierta = null;
    render();
  }));
  /* Un clic despliega la fila; DOBLE clic abre la OT en una pestaña nueva, que
     es como se trabaja hoy. El mecanismo —y la trampa del redibujo que lo tenía
     roto— vive en `conDobleClic`, en app.js: desde el 15-08-2026 lo usan todos
     los paneles, así que no puede estar escrito acá.

     Ojo: en esta pantalla `data-ot` trae el ID de la orden, no su número,
     porque el expandible se abre por ID. Por eso no sirve `dobleClicPorFilas`
     y se resuelve el número antes de abrir. */
  const abrirPorFila = (tr) => {
    const o = Modelo.torre().find((x) => x.id === tr.dataset.ot);
    if (!o) return false;
    abrirFicha(o.numeroOT);
    return true;
  };

  document.querySelectorAll('tr.fila').forEach((tr) => {
    /* 🔴 SÓLO DESDE LA COLUMNA OT (16-08-2026, Marco: «pongo doble clic en el
       nombre de cliente y me abre otra pestaña»). El gesto estaba en la FILA,
       así que cualquier doble clic —seleccionar un cliente, una patente, una
       descripción— abría una pestaña.

       Acá la OT es la SEGUNDA celda: la primera es la flecha del expandible.
       Se toma por posición y no por contenido porque esta tabla escribe el ID
       en `data-ot` y el número sólo está en la celda. */
    const celdaOT = tr.children[1] || null;
    conDobleClic(tr, 'torre-' + tr.dataset.ot,
      () => abrirPorFila(tr),
      () => {
        ui.torre.abierta = ui.torre.abierta === tr.dataset.ot ? null : tr.dataset.ot;
        render();
      }, celdaOT);
  });
  document.querySelectorAll('[data-ver]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation(); ir(b.dataset.ver);
  }));
  document.querySelectorAll('[data-abrir]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation(); abrirFicha(b.dataset.abrir);
  }));
  pRejillaPantallasOT();

  const ant = document.getElementById('pag-ant'), sig = document.getElementById('pag-sig');
  if (ant) ant.addEventListener('click', () => { ui.torre.pagina--; ui.torre.abierta = null; render(); });
  if (sig) sig.addEventListener('click', () => { ui.torre.pagina++; ui.torre.abierta = null; render(); });

  Media.pintar();
}
