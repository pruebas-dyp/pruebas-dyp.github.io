/* 🔴 LA VENTA DEL HISTÓRICO NO LA VE CUALQUIERA (30-08-2026).

   Marco, del dueño: «no quiere que nadie tenga acceso a ver venta en el
   histórico, por lo tanto todo lo que es venta en el histórico no lo debería
   poder ver nadie. Salvo administrador y el perfil de Gabriel Díaz Moreno y
   Gabriel Díaz Hernández».

   Es la ÚNICA excepción a la regla de que un módulo se da completo, y por eso
   está escrita acá arriba y no escondida en una celda: el Histórico se le da a
   casi todo el mundo —es la memoria del taller— pero las cuatro columnas de
   plata son otra cosa.

   `historico.montos` es un permiso RESERVADO: no lo da ningún módulo ni ningún
   rol, ni siquiera uno de acceso total. Va con nombre y apellido desde Personal.

   Las columnas no se vacían: DESAPARECEN. Una columna «Venta Total» con un
   guión adentro invita a preguntar por qué, y quien pregunta insiste. */
const verVentaHistorico = () => Modelo.puede('historico.montos');

/* Los doce años completos, de una. Son 35.410 documentos y unos 8 MB: se piden
   SOLO cuando alguien aprieta «Ver todos», y una vez por sesión. */
let historiaCompletaLista = false;
let historiaCompletaCargando = false;

async function traerTodaLaHistoria() {
  if (typeof Base === 'undefined' || !Base.conectada()) return;
  if (historiaCompletaLista || historiaCompletaCargando) return;
  historiaCompletaCargando = true;
  estadoHistorico = 'Trayendo los doce años…';
  if (typeof render === 'function') render();
  try {
    const t = await Base.historicoCompleto((n) => {
      estadoHistorico = 'Trayendo los doce años… ' + n.toLocaleString('es-CL') + ' órdenes';
    });
    Modelo.mezclarNube(t);
    historiaCompletaLista = true;
    estadoHistorico = '';
  } catch (e) {
    estadoHistorico = 'No se pudieron traer todas: ' + ((e && e.message) || 'sin conexión');
  }
  historiaCompletaCargando = false;
  if (typeof render === 'function') render();
}
let estadoHistorico = '';

/* ═══════════════════════════════════════════════════════════════════════════
   BUSCAR EN LOS DOCE AÑOS.

   En memoria viven las 92 órdenes activas. Las otras 15.442 están en Firestore
   y no se bajan «por si acaso»: bajarlas todas serían 15.442 lecturas cada vez
   que alguien abre esta pantalla, y el 99 % de las veces se busca UNA.

   Así que esta pantalla pregunta. Lo que vuelve se mezcla en el modelo y a
   partir de ahí es una orden como cualquier otra: se abre, se imprime, se ven
   sus fotos. La pantalla se repinta sola cuando llega.
   ═══════════════════════════════════════════════════════════════════════════ */
let historicoBuscando = false;
let historicoUltimaBusqueda = '';

async function traerDeLosDoceAnios(h) {
  if (typeof Base === 'undefined' || !Base.conectada()) return;

  /* La firma de lo que se está buscando. Sin esto, cada repintado —y repinta
     por cualquier cosa, hasta por cambiar de página— volvía a preguntarle a
     Firestore lo mismo, y cada vuelta cuesta lecturas. */
  const firma = JSON.stringify([h.patente, h.compania_id, h.estado, h.todos]);
  if (historicoBuscando || firma === historicoUltimaBusqueda) return;
  historicoBuscando = true;
  historicoUltimaBusqueda = firma;

  try {
    const q = String(h.patente || '').trim();
    const criterio = {};
    /* El mismo cuadro busca patente, número de OT y siniestro — que es como en
       el taller se nombra un trabajo, según de quién venga la llamada. Se
       decide por la forma: sólo dígitos y del largo de una OT es una OT; un
       número largo es un siniestro; lo demás, patente. */
    if (/^\d{1,6}$/.test(q))       criterio.numero_ot = q;
    else if (/^\d{7,}$/.test(q))   criterio.siniestro = q;
    else if (q)                    criterio.patente = q;
    if (h.compania_id) criterio.compania_id = h.compania_id;
    if (h.estado)      criterio.estado = h.estado;
    if (!q && !h.compania_id && !h.estado) criterio.limite = 200;

    const r = await Base.buscarOrdenes(criterio);
    if (r.ordenes.length) {
      /* Y los clientes de esas órdenes, o la columna sale sin nombre. */
      const t = { orden_trabajo: r.ordenes, vehiculo: r.vehiculos };
      /* Personas y presupuestos se piden A LA VEZ: son consultas
         independientes y en serie la pantalla tardaba el doble. */
      const [exp, plata] = await Promise.all([
        Base.personasDe(r.ordenes),
        Base.presupuestosDe(r.ordenes).catch(() => ({ presupuesto: [], presupuesto_linea: [], ot_estadia: [] }))
      ]);
      if (exp.length) t.persona = exp;
      t.presupuesto = plata.presupuesto;
      t.presupuesto_linea = plata.presupuesto_linea;
      t.ot_estadia = plata.ot_estadia || [];
      Modelo.mezclarNube(t);
    }
  } catch (e) {
    /* Sin nube el Histórico muestra lo que tenga en memoria. No se cae. */
  }
  historicoBuscando = false;
  if (typeof render === 'function') render();
}

/* HISTÓRICO Y CONSOLIDADO.

   El histórico es un BUSCADOR, no un listado: sin filtro no muestra nada, igual que el
   original. El consolidado suma por compañía y por mes.

   Detalle y decisiones: 00 Documentacion/DECISIONES.md · js/vistas/historico.js */

/* Lo que se está mostrando, para que el botón de PDF imprima EXACTAMENTE eso
   y no vuelva a filtrar por su cuenta. Si volviera a filtrar, el papel y la
   pantalla podrían no decir lo mismo, que en un reporte es el peor defecto. */
let ultimoListadoHistorico = [];

function historicoEstado() {
  ui.historico = ui.historico || {};
  const h = ui.historico;
  if (h.patente === undefined) {
    h.patente = ''; h.cliente = ''; h.compania_id = ''; h.estado = '';
    h.marca_id = ''; h.modelo_id = '';
    h.desde = ''; h.hasta = ''; h.pagina = 1; h.porPagina = 30; h.buscado = false;
    /* Los dos botones que el sistema actual tiene al lado del buscador y que
       acá faltaban. `todos` lista sin filtrar; `vista` cambia a la hoja de
       reportes. Van en el estado y no en una variable suelta para que el panel
       vuelva donde estaba después de cualquier repintado. */
    h.todos = false; h.vista = 'buscador';
  }
  return h;
}

/* La venta abierta por proceso: mano de obra, repuestos y ToT. Son las tres
   columnas de dinero que quedan del Histórico real. */
function plataDe(o) {
  const z = { ventaMO: 0, ventaRep: 0, ventaToT: 0 };

  /* 🔴 SI LOS PRESUPUESTOS NO ESTAN EN MEMORIA, SE USA LA VENTA GUARDADA.

     Con «Ver todos» hay 15.534 órdenes en pantalla y sus presupuestos son
     333.554 documentos más: no se bajan. Al migrar se calculó la venta de cada
     orden con `Reglas.totalesPresupuesto` —la misma función que corre unas
     líneas más abajo— y quedó guardada en la propia orden.

     El orden importa: si los presupuestos ESTAN, mandan ellos, porque pueden
     tener cambios de hoy que la copia guardada no conoce. La copia es para
     cuando no hay nada mejor, no para ahorrarse la cuenta. */
  if (!o.presupuestos.length && o.ventaGuardada) {
    return { ventaMO: o.ventaGuardada.mo, ventaRep: o.ventaGuardada.rep,
      ventaToT: o.ventaGuardada.tot,
      ventaTotal: o.ventaGuardada.mo + o.ventaGuardada.rep + o.ventaGuardada.tot };
  }
  /* Los tres montos salen de `totales`, que es la MISMA cuenta del documento:
     mano de obra = horas × tempario en las tres columnas; repuestos, sólo los
     que puso el taller; T.O.T., los trabajos externos. Antes acá se sumaba
     `cantidad × precio_unitario` por proceso, que con la fórmula nueva daba
     cero en mano de obra —no hay precio escrito, hay horas— y cobraba de más
     los repuestos que aporta la compañía. Dos sumas parecidas para el mismo
     dato es cómo un informe y una pantalla terminan diciendo cosas distintas. */
  o.presupuestos.forEach((p) => {
    const t = p.totales;
    if (!t) return;
    z.ventaMO += t.manoObra;
    z.ventaRep += t.repuestos;
    z.ventaToT += t.tot;
  });
  z.ventaTotal = z.ventaMO + z.ventaRep + z.ventaToT;
  return z;
}

/* ── Por qué no encontró nada ──────────────────────────────────────────
   🔴 EL PROBLEMA QUE ESTO RESUELVE (17-08-2026). Marco buscó la patente
   BGBB82, le salió «Sin resultados» y concluyó, con razón desde donde estaba
   mirando: «el Histórico está mal, no encuentra absolutamente nada».

   El buscador funcionaba. La BGBB82 está EN EL TALLER, y el Histórico sólo
   tiene las órdenes entregadas — así es el sistema actual y así se replica.
   Pero «Sin resultados» no dice ninguna de esas dos cosas: es cierto y es
   inútil, y ante un vacío sin explicación lo razonable es pensar que el
   sistema está roto.

   Acá se averigua POR QUÉ no hay nada y se dice, con el camino para llegar a
   lo que la persona estaba buscando. Un vacío que se explica no es un vacío:
   es una respuesta. */
// aaaa-mm-dd —lo que guarda un <input type="date">— a dd-mm-aaaa.
function fechaCorta(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? m[3] + '-' + m[2] + '-' + m[1] : (iso || '—');
}

function sinResultados(h) {
  const q = String(h.patente || '').trim();
  const caja = (titulo, texto, acciones) =>
    '<div class="vacio"><div class="titulo">' + titulo + '</div>' +
    '<div class="texto">' + texto + '</div>' +
    (acciones ? '<div style="margin-top:9px;display:flex;gap:6px;justify-content:center;' +
      'flex-wrap:wrap">' + acciones + '</div>' : '') + '</div>';

  if (q) {
    /* ¿Está en el taller? Es el caso de Marco, y el más frecuente: se busca por
       una patente que se acaba de ver en la torre. */
    const viva = Modelo.torre().find((o) =>
      [o.patente, o.numeroOT, (o.presupuestos[0] || {}).numeroOR]
        .some((v) => String(v == null ? '' : v).toUpperCase().indexOf(q.toUpperCase()) >= 0));
    if (viva) {
      return caja('No está en el Histórico porque todavía no se entrega',
        '<strong>' + esc(viva.patente) + '</strong> — OT ' + esc(viva.numeroOT) + ', ' +
        esc(viva.cliente) + ' — está <strong>en el taller</strong>, en ' +
        esc(viva.etapaNombre || 'sin etapa asignada') + '. El Histórico sólo guarda las órdenes ' +
        '<strong>entregadas</strong>: igual que el sistema actual. Mientras el vehículo esté ' +
        'adentro se sigue desde la Torre de control.',
        '<button class="btn" data-h-ficha="' + esc(viva.numeroOT) + '">Abrir la OT ' +
          esc(viva.numeroOT) + '</button>' +
        '<button class="btn secundario" data-h-torre="1">Ir a la Torre de control</button>');
    }

    /* ¿Está entregada, pero el rango de fechas la dejó fuera? Es el otro
       vacío que se lee como falla: el dato existe y la pantalla no lo muestra. */
    if (h.desde || h.hasta) {
      const sinFecha = Modelo.historico({ patente: q });
      if (sinFecha.length) {
        const o = sinFecha[0];
        return caja('Sí está, pero fuera del rango de fechas',
          '<strong>' + esc(o.patente) + '</strong> — OT ' + esc(o.numeroOT) + ' — se entregó el ' +
          '<strong>' + fFechaHora(o.fechaEntrega) + '</strong>, y el rango que está puesto va ' +
          // Los campos de fecha guardan aaaa-mm-dd, que es lo que el navegador
          // entrega. En pantalla todo va dd-mm-aaaa, acá también.
          'del ' + esc(fechaCorta(h.desde)) + ' al ' + esc(fechaCorta(h.hasta)) + '. ' +
          'El rango filtra por <strong>fecha de entrega</strong>.',
          '<button class="btn" data-h-sinfechas="1">Buscar sin el rango de fechas</button>');
      }
    }

    return caja('No aparece en ninguna parte',
      'No hay ninguna orden —entregada ni en el taller— cuya patente, OT, OR o número de ' +
      'siniestro contenga <strong>' + esc(q) + '</strong>. El cuadro busca por las cuatro, ' +
      'y por parte del texto: ' +
      'con escribir <span class="cod">' + esc(q.slice(0, 3)) + '</span> basta.');
  }

  return caja('Sin resultados',
    'Ninguna orden <strong>entregada</strong> cumple con lo que está filtrado. ' +
    'El Histórico no muestra los vehículos que están en el taller: para esos, la Torre de control.',
    '<button class="btn secundario" data-h-torre="1">Ir a la Torre de control</button>');
}

function vHistorico() {
  const h = historicoEstado();
  if (h.vista === 'estadisticas') return vHistoricoEstadisticas();
  // La reportería vive en `reporteria.js`: son gráficos y tabla dinámica, y no
  // tienen por qué compartir archivo con el buscador.
  if (h.vista === 'reporteria') return vReporteria();
  const hayFiltro = !!(h.patente || h.cliente || h.compania_id || h.estado || h.desde || h.hasta ||
    h.marca_id || h.modelo_id);
  const universo = Modelo.historico({ todo: true });

  const filtro = { patente: h.patente, cliente: h.cliente, compania_id: h.compania_id,
    estado: h.estado };
  if (h.desde) { const [a, m, d] = h.desde.split('-').map(Number); filtro.desde = new Date(a, m - 1, d); }
  if (h.hasta) { const [a, m, d] = h.hasta.split('-').map(Number); filtro.hasta = new Date(a, m - 1, d, 23, 59); }

  /* Marca y modelo se filtran acá y no en `Modelo.historico`: son datos del
     vehículo y el motor filtra por orden. Ponerlos allá obligaba a tocar el
     modelo para una comodidad de esta pantalla. */
  const nom = (tabla, id) => (Modelo.catalogo(tabla).find((x) => x.id === id) || {}).nombre;
  const marca = h.marca_id ? nom('marca', h.marca_id) : '';
  const modelo = h.modelo_id ? nom('modelo', h.modelo_id) : '';
  /* ⚠️ `Modelo.historico` devuelve vacío si no recibe NINGUNO de sus propios
     campos, y marca y modelo no son suyos. Buscando sólo por marca salían cero
     órdenes con el filtro puesto — parecía que esa marca no había entrado nunca
     al taller. Cuando lo único filtrado es del vehículo se le pide el universo
     y el recorte lo hace esta pantalla. */
  const delMotor = ['patente', 'cliente', 'compania_id', 'estado', 'desde', 'hasta']
    .some((k) => filtro[k]);
  const base = h.todos ? universo
    : (delMotor ? Modelo.historico(filtro) : (hayFiltro ? universo : []));
  const todas = base
    .filter((o) => !marca || o.marca === marca)
    .filter((o) => !modelo || o.modelo === modelo);
  // "Todas" llega como 0, y cortar de a 0 devuelve una tabla vacía.
  const porPagina = tamanoEfectivo(h.porPagina, todas.length);
  const totalPag = Math.max(1, Math.ceil(todas.length / porPagina));
  if (h.pagina > totalPag) h.pagina = totalPag;
  const desde = (h.pagina - 1) * porPagina;
  const pagina = todas.slice(desde, desde + porPagina);

  ultimoListadoHistorico = todas;
  const suma = todas.reduce((s, o) => ({ venta: s.venta + plataDe(o).ventaTotal }), { venta: 0 });

  return `
  <div class="panel">
    <div class="cab"><div><h2>${ico('historico', 'g')}Registro Histórico DyP</h2>
      <div class="desc">${h.todos
        ? 'Todas las órdenes entregadas, sin filtrar'
        : 'Es un buscador: sin filtro no muestra nada, igual que el original'}</div></div>
      <div style="display:flex;gap:8px">
        <button class="btn${h.todos ? '' : ' secundario'}" id="h-todos">Ver todos</button>
        <button class="btn secundario" id="h-estadisticas">Ver estadísticas</button>
        ${/* El botón sólo se dibuja para quien puede entrar. Que no se dibuje NO
             es lo que protege la pantalla —eso lo hace `vReporteria` por su
             cuenta— pero un botón que rebota enseña a desconfiar del sistema. */''}
        ${Modelo.puede('reporteria.ver')
          ? '<button class="btn secundario" id="h-reporteria">' + ico('consolidado') + 'Reportería</button>'
          : ''}
      </div></div>
    <div class="cuerpo">
      <div class="desc" style="margin-bottom:9px">Cada parámetro es independiente de los otros,
        salvo <strong>marca</strong> y <strong>modelo</strong>: el modelo se ofrece según la marca elegida.</div>
      <div class="rejilla-campos">
        <div class="campo"><label>Patente, OT, OR o siniestro</label><input id="h-patente" value="${esc(h.patente)}" placeholder="Cualquiera de los cuatro"></div>
        <div class="campo"><label>Cliente</label><input id="h-cliente" value="${esc(h.cliente)}"
          placeholder="Todos" autocomplete="off" list="h-clientes">
          <datalist id="h-clientes">${[...new Set(universo.map((o) => o.cliente))].sort()
            .map((c) => '<option value="' + esc(c) + '"></option>').join('')}</datalist></div>
        <div class="campo"><label>Marca</label>
          <select id="h-marca"><option value="">Todas</option>${Modelo.catalogo('marca').map((m) =>
            '<option value="' + esc(m.id) + '"' + (h.marca_id === m.id ? ' selected' : '') + '>' +
            esc(m.nombre) + '</option>').join('')}</select></div>
        <div class="campo"><label>Modelo</label>
          <select id="h-modelo"><option value="">Todos</option>${Modelo.catalogo('modelo')
            .filter((m) => !h.marca_id || m.marca_id === h.marca_id)
            .map((m) => '<option value="' + esc(m.id) + '"' + (h.modelo_id === m.id ? ' selected' : '') + '>' +
            esc(m.nombre) + '</option>').join('')}</select></div>
        <div class="campo"><label>Compañía</label>
          <select id="h-compania"><option value="">Todas</option>${Modelo.catalogo('compania').map((c) =>
            '<option value="' + esc(c.id) + '"' + (h.compania_id === c.id ? ' selected' : '') + '>' +
            esc(c.nombre) + '</option>').join('')}</select></div>
        <div class="campo"><label>Estado</label>
          <select id="h-estado"><option value="">Todos</option>${Modelo.catalogo('estado')
            .filter((e) => e.es_final).map((e) => '<option value="' + esc(e.codigo) + '"' +
            (h.estado === e.codigo ? ' selected' : '') + '>' + esc(e.nombre) + '</option>').join('')}</select>
          <span class="ayuda">Los cinco marcados "Estado final", igual que el original</span></div>
        <div class="campo"><label>Desde</label><input type="date" id="h-desde" value="${esc(h.desde)}"></div>
        <div class="campo"><label>Hasta</label><input type="date" id="h-hasta" value="${esc(h.hasta)}"></div>
        <div class="campo"><label>&nbsp;</label>
          <span style="display:flex;gap:6px"><button class="btn" id="h-buscar">Buscar</button>
          <button class="btn secundario" id="h-limpiar">Limpiar</button>
          <button class="btn secundario" id="h-pdf">${ico('imprimir')}PDF</button></span></div>
      </div>
    </div>

    <div class="grid-envoltorio"><table class="grid">
      <thead><tr>
        <th>OT</th><th title="Cantidad de repuestos">Qty Rep</th><th>Patente</th><th>Cliente</th>
        <th>Marca</th><th>Modelo</th><th>Color</th><th>Fecha de Ingreso</th><th>Tipo</th><th>Estado</th>
        <th>Fecha de Entrega</th>
        <th title="El original NO tiene esta columna: al entregar, el contador desaparece">Días tot.</th>
        <th title="Tampoco existe allá">Reparación</th>
        ${verVentaHistorico() ? '<th>Venta MO</th><th>Venta Rep</th>' +
          '<th title="Deducción: trabajos a terceros. Pregunta 5">Venta ToT</th>' +
          '<th>Venta Total</th>' : ''}
        <th>Observación</th><th title="La inicial del asunto de cada mensaje de bitácora">Alerta</th>
      </tr></thead>
      <tbody>${pagina.length ? pagina.map((o) => {
        const z = plataDe(o);
        return '<tr class="fila" data-ot="' + esc(o.numeroOT) + '"><td class="num"><strong>' + o.numeroOT + '</strong></td>' +
          '<td class="num">' + o.repuestos.length + '</td>' +
          '<td><span class="patente">' + esc(o.patente) + '</span></td>' +
          '<td>' + esc(o.cliente) + '</td>' +
          '<td>' + esc(o.marca || '—') + '</td><td>' + esc(o.modelo || '—') + '</td>' +
          '<td>' + esc(o.color || '—') + '</td>' +
          '<td class="num">' + fFechaHora(o.fechaIngreso) + '</td>' +
          '<td>' + esc(o.origenIngresoNombre || '—') + '</td>' +
          '<td><span class="et ' + esc(o.estadoClase) + '">' + esc(o.estadoNombre) + '</span></td>' +
          '<td class="num">' + fFechaHora(o.fechaEntrega) + '</td>' +
          '<td class="num"><strong>' + o.diasTotales + '</strong></td>' +
          '<td class="num" style="color:' + (o.diasReparacion > Modelo.metricas().metaDias ? 'var(--ambar)' : 'inherit') + '">' +
            o.diasReparacion + '</td>' +
          (verVentaHistorico()
            ? '<td class="num">' + fMonto(z.ventaMO) + '</td><td class="num">' + fMonto(z.ventaRep) + '</td>' +
              '<td class="num">' + fMonto(z.ventaToT) + '</td>' +
              '<td class="num"><strong>' + fMonto(z.ventaTotal) + '</strong></td>'
            : '') +
          '<td>' + esc(((o.recepcion || {}).observaciones || '').slice(0, 90) ||
            '—') + '</td>' +
          '<td>' + chipsAlerta(o) + '</td></tr>';
      }).join('') : '<tr><td colspan="' + (verVentaHistorico() ? 19 : 15) + '">' +
        (hayFiltro || h.todos ? sinResultados(h) :
          '<div class="vacio"><div class="titulo">Escribe un filtro y aprieta Buscar</div>' +
          '<div class="texto">El Histórico es un buscador, no un listado. ' +
          'Así es el sistema actual y así se replica — y para verlo entero está <strong>Ver todos</strong>.</div></div>') +
        '</td></tr>'}</tbody>
      ${todas.length && verVentaHistorico()
        ? '<tfoot><tr><td colspan="16" style="text-align:right">Venta de las ' +
          todas.length + ' órdenes filtradas</td>' +
          '<td class="num"><strong>' + fMonto(suma.venta) + '</strong></td></tr></tfoot>' : ''}
    </table></div>
    ${/* El pie aparece cuando hay más filas que la opción más chica, no cuando
          hay más que la página actual: con «Todas» puesto y 214 órdenes a la
          vista, el pie desaparecía y no quedaba forma de volver a 100. */''}
    ${todas.length > TAMANOS_PAGINA[0] ? `<div class="pie-grid">
      <div class="info">Mostrando ${desde + 1}–${Math.min(desde + porPagina, todas.length)} de ${todas.length}</div>
      <div class="ctrl">
        ${selectorTamano('h-tam', h.porPagina)}
        ${h.pagina > 1 ? '<button class="btn secundario" id="h-ant">Anterior</button>' : ''}
        ${totalPag > 1 ? '<span class="info">Página ' + h.pagina + ' de ' + totalPag + '</span>' : ''}
        ${h.pagina < totalPag ? '<button class="btn secundario" id="h-sig">Siguiente</button>' : ''}
      </div></div>` : ''}
  </div>
`;
}

/* ═══════════ REPORTES Y ESTADÍSTICAS ═══════════
   La segunda hoja del Histórico del sistema actual, que acá faltaba entera.
   Son cinco bloques y ninguno es un invento nuestro: están los mismos que
   muestra `miembros.php?ver=estadisticas`, con los mismos títulos.

   Todo sale del modelo en el momento de mirarlo. No hay una tabla de
   estadísticas que alguien tenga que refrescar: el número que se ve es el que
   hay, y por eso no puede quedar viejo. */
function datosEstadisticas() {
  const cerradas = Modelo.historico({ todo: true });
  const abiertas = Modelo.torre();
  const todas = cerradas.concat(abiertas);

  const contar = (lista, llave, extra) => {
    const m = new Map();
    lista.forEach((o) => {
      const k = llave(o);
      if (!k) return;
      const f = m.get(k) || Object.assign({ k, n: 0 }, extra ? extra(o) : {});
      f.n++; m.set(k, f);
    });
    return [...m.values()].sort((a, b) => b.n - a.n);
  };

  const presupuestos = todas.reduce((s, o) => s + o.presupuestos.length, 0);
  const sinPresupuesto = abiertas.filter((o) => !o.presupuestos.length)
    .sort((a, b) => b.fechaIngreso - a.fechaIngreso);

  return {
    entregados: cerradas.length,
    tiempoMedio: cerradas.length
      ? Math.round(cerradas.reduce((s, o) => s + o.diasTotales, 0) / cerradas.length) : 0,
    reparacionMedia: cerradas.length
      ? Math.round(cerradas.reduce((s, o) => s + o.diasReparacion, 0) / cerradas.length) : 0,
    presupuestos,
    abiertasSinPresupuesto: sinPresupuesto.length,
    ultimasSinPresupuesto: sinPresupuesto.slice(0, 20),
    clientes: contar(todas, (o) => o.cliente, (o) => ({ rut: o.rut })).slice(0, 10),
    modelos: contar(todas, (o) => (o.modelo ? o.marca + ' · ' + o.modelo : null),
      (o) => ({ marca: o.marca, modelo: o.modelo })).slice(0, 10)
  };
}

function vHistoricoEstadisticas() {
  const d = datosEstadisticas();
  const fila = (a, b) => '<tr><td>' + a + '</td><td class="num">' + b + '</td></tr>';

  return `
  <button class="btn volver" id="h-volver"><span class="flecha-atras">&#8592;</span>
    Volver al buscador del histórico</button>
  <div class="panel">
    <div class="cab"><div><h2>${ico('consolidado', 'g')}Reportes y Estadísticas DyP</h2>
      <div class="desc">Los mismos cinco bloques del sistema actual, calculados al mirarlos</div></div>
      <button class="btn secundario" id="h-pdf-est">${ico('imprimir')}PDF</button></div>
    <div class="cuerpo">
      <div class="ficha-rejilla">

        <fieldset class="bloque"><legend>Indicadores Históricos</legend>
          <table class="grid anidada"><tbody>
            ${fila('Número de Vehículos Entregados', '<strong>' + d.entregados + '</strong>')}
            ${fila('Tiempo Medio en Taller', d.tiempoMedio + ' días')}
            ${fila('<span title="El original pierde este dato al entregar">Reparación media ' +
              '<span class="et gris">no está en el original</span></span>', d.reparacionMedia + ' días')}
          </tbody></table>
        </fieldset>

        <fieldset class="bloque"><legend>Indicadores de Presupuesto</legend>
          <table class="grid anidada"><tbody>
            ${fila('Número total de Presupuestos', '<strong>' + d.presupuestos + '</strong>')}
            ${fila('Cantidad de Órdenes Abiertas sin Presupuesto',
              '<strong style="color:var(--rojo)">' + d.abiertasSinPresupuesto + '</strong>')}
          </tbody></table>
        </fieldset>

        <fieldset class="bloque" style="grid-column:1/-1"><legend>Clientes con más Vehículos</legend>
          <div class="grid-envoltorio"><table class="grid">
            <thead><tr><th style="width:150px">RUT Cliente</th><th>Nombre Cliente</th>
              <th class="num" style="width:150px">Cantidad de Vehículos</th></tr></thead>
            <tbody>${d.clientes.map((c) => '<tr><td class="cod">' +
              esc(Modelo.velar(c.rut, 'datos.rut_completo')) + '</td><td>' + esc(c.k) +
              '</td><td class="num"><strong>' + c.n + '</strong></td></tr>').join('')}</tbody>
          </table></div>
        </fieldset>

        <fieldset class="bloque" style="grid-column:1/-1"><legend>Modelo con Más Vehículos Siniestrados</legend>
          <div class="grid-envoltorio"><table class="grid">
            <thead><tr><th>Modelo</th><th>Marca</th><th class="num" style="width:110px">Total</th></tr></thead>
            <tbody>${d.modelos.map((m) => '<tr><td>' + esc(m.modelo) + '</td><td>' + esc(m.marca) +
              '</td><td class="num"><strong>' + m.n + '</strong></td></tr>').join('')}</tbody>
          </table></div>
        </fieldset>

        <fieldset class="bloque" style="grid-column:1/-1">
          ${/* «sin presupuesto», no «sin OR» (27-08-2026): la lista sale de
               `ultimasSinPresupuesto` —el nombre ya lo decía— y todas tienen OR. */''}
          <legend>Últimas ${d.ultimasSinPresupuesto.length} órdenes sin presupuesto</legend>
          <div class="grid-envoltorio"><table class="grid">
            <thead><tr><th style="width:80px">OT</th><th style="width:100px">Patente</th><th>Cliente</th>
              <th style="width:120px">Fecha</th><th style="width:90px"></th></tr></thead>
            <tbody>${d.ultimasSinPresupuesto.length
              ? d.ultimasSinPresupuesto.map((o) => '<tr><td class="num">' + o.numeroOT + '</td>' +
                '<td><span class="patente">' + esc(o.patente) + '</span></td>' +
                '<td>' + esc(o.cliente) + '</td>' +
                '<td class="num">' + fFechaHora(o.fechaIngreso) + '</td>' +
                '<td><button class="btn secundario" data-ver-ot="' + esc(o.numeroOT) + '">Ver OT</button></td></tr>').join('')
              : '<tr><td colspan="5"><div class="vacio"><div class="titulo">Ninguna</div>' +
                '<div class="texto">Todas las órdenes abiertas tienen presupuesto.</div></div></td></tr>'}
            </tbody>
          </table></div>
        </fieldset>

      </div>
    </div>
  </div>`;
}

/* ── Los dos reportes en PDF ───────────────────────────────────────────
   Pregunta de Marco: "queremos botones de reportería que generen distintos
   PDF. ¿Se puede?". Sí, y es lo mismo que ya hace el sistema con los cinco
   documentos: se arma la hoja y se manda a la impresora del navegador, que
   incluye «Guardar como PDF». Sin librerías, sin servidor y sin costo de
   licencia. Cada botón arma SU hoja: son reportes distintos, no el mismo. */
function impresoListadoHistorico(filas, rotulo) {
  const total = filas.reduce((s, o) => s + plataDe(o).ventaTotal, 0);
  return `
  <div class="cab-doc">
    <div>${logoImpreso()}
      <div style="font-size:10px;color:#555">Desabolladura y pintura</div>
      <div style="margin-top:5px;font-size:13px;font-weight:700">Registro Histórico</div></div>
    <div class="der"><div><strong>${filas.length} órdenes</strong></div>
      <div>${esc(rotulo)}</div><div>Emitido ${fFechaHora(HOY)}</div></div>
  </div>
  <table><thead><tr><th>OT</th><th>Patente</th><th>Cliente</th><th>Marca</th><th>Modelo</th>
    <th>Fecha de Ingreso</th><th>Fecha de Entrega</th><th>Estado</th><th class="n">Días</th>
    ${verVentaHistorico() ? '<th class="n">Venta</th>' : ''}
  </tr></thead><tbody>
    ${filas.map((o) => '<tr><td>' + o.numeroOT + '</td><td>' + esc(o.patente) + '</td>' +
      '<td>' + esc(o.cliente) + '</td><td>' + esc(o.marca || '—') + '</td>' +
      '<td>' + esc(o.modelo || '—') + '</td>' +
      '<td>' + fFechaHora(o.fechaIngreso) + '</td><td>' + fFechaHora(o.fechaEntrega) + '</td>' +
      '<td>' + esc(o.estadoNombre) + '</td><td class="n">' + o.diasTotales + '</td>' +
      (verVentaHistorico() ? '<td class="n">' + fMonto(plataDe(o).ventaTotal) + '</td>' : '') +
      '</tr>').join('')}
  </tbody>${verVentaHistorico()
    ? '<tfoot><tr><td colspan="9" style="text-align:right"><strong>Venta del listado</strong></td>' +
      '<td class="n"><strong>' + fMonto(total) + '</strong></td></tr></tfoot>' : ''}</table>
  ${pieImpreso()}`;
}

function impresoEstadisticas() {
  const d = datosEstadisticas();
  const tabla = (titulo, cabs, filas) => '<h2>' + esc(titulo) + '</h2><table><thead><tr>' +
    cabs.map((c) => '<th>' + esc(c) + '</th>').join('') + '</tr></thead><tbody>' + filas + '</tbody></table>';

  return `
  <div class="cab-doc">
    <div>${logoImpreso()}
      <div style="font-size:10px;color:#555">Desabolladura y pintura</div>
      <div style="margin-top:5px;font-size:13px;font-weight:700">Reportes y Estadísticas</div></div>
    <div class="der"><div>Emitido ${fFechaHora(HOY)}</div></div>
  </div>
  ${tabla('Indicadores', ['Indicador', 'Valor'],
    '<tr><td>Número de Vehículos Entregados</td><td>' + d.entregados + '</td></tr>' +
    '<tr><td>Tiempo Medio en Taller</td><td>' + d.tiempoMedio + ' días</td></tr>' +
    '<tr><td>Reparación media</td><td>' + d.reparacionMedia + ' días</td></tr>' +
    '<tr><td>Número total de Presupuestos</td><td>' + d.presupuestos + '</td></tr>' +
    '<tr><td>Órdenes Abiertas sin Presupuesto</td><td>' + d.abiertasSinPresupuesto + '</td></tr>')}
  ${tabla('Clientes con más Vehículos', ['RUT', 'Nombre', 'Vehículos'],
    d.clientes.map((c) => '<tr><td>' + esc(Modelo.velar(c.rut, 'datos.rut_completo')) + '</td><td>' +
      esc(c.k) + '</td><td>' + c.n + '</td></tr>').join(''))}
  ${tabla('Modelo con Más Vehículos Siniestrados', ['Modelo', 'Marca', 'Total'],
    d.modelos.map((m) => '<tr><td>' + esc(m.modelo) + '</td><td>' + esc(m.marca) + '</td><td>' +
      m.n + '</td></tr>').join(''))}
  ${tabla('Últimas órdenes sin presupuesto', ['OT', 'Patente', 'Cliente', 'Fecha'],
    d.ultimasSinPresupuesto.map((o) => '<tr><td>' + o.numeroOT + '</td><td>' + esc(o.patente) +
      '</td><td>' + esc(o.cliente) + '</td><td>' + fFechaHora(o.fechaIngreso) + '</td></tr>').join(''))}
  ${pieImpreso()}`;
}

function pHistorico() {
  /* Al entrar, las últimas 200 cerradas: la pantalla no puede abrirse vacía
     cuando hay 15.442 órdenes guardadas. */
  if (typeof historicoEstado === 'function') traerDeLosDoceAnios(historicoEstado());
  const h = historicoEstado();

  // La hoja de reportes tiene sus propios botones y sale de acá derecho.
  if (h.vista === 'reporteria') return pReporteria();

  if (h.vista === 'estadisticas') {
    const volver = document.getElementById('h-volver');
    if (volver) volver.addEventListener('click', () => { h.vista = 'buscador'; render(); });
    const pdf = document.getElementById('h-pdf-est');
    if (pdf) pdf.addEventListener('click', () => mostrarImpreso(impresoEstadisticas(), 'Reportes y Estadísticas'));
    document.querySelectorAll('[data-ver-ot]').forEach((b) => b.addEventListener('click', () =>
      abrirFicha(b.dataset.verOt)));
    return;
  }

  const leer = () => {
    h.patente = (document.getElementById('h-patente') || {}).value || '';
    h.cliente = (document.getElementById('h-cliente') || {}).value || '';
    h.compania_id = (document.getElementById('h-compania') || {}).value || '';
    h.marca_id = (document.getElementById('h-marca') || {}).value || '';
    h.modelo_id = (document.getElementById('h-modelo') || {}).value || '';
    h.estado = (document.getElementById('h-estado') || {}).value || '';
    h.desde = (document.getElementById('h-desde') || {}).value || '';
    h.hasta = (document.getElementById('h-hasta') || {}).value || '';
    h.pagina = 1;
  };
  const buscar = document.getElementById('h-buscar');
  if (buscar) buscar.addEventListener('click', () => {
    leer(); h.todos = false;
    /* Primero se le pregunta a los doce años y después se pinta: si sólo se
       filtrara lo que hay en memoria, buscar una patente de 2019 devolvería
       cero — y cero se lee como «ese auto nunca entró». */
    traerDeLosDoceAnios(h);
    render();
  });
  const limpiar = document.getElementById('h-limpiar');
  if (limpiar) limpiar.addEventListener('click', () => {
    h.patente = h.cliente = h.compania_id = h.estado = h.desde = h.hasta = '';
    h.marca_id = h.modelo_id = '';
    h.todos = false; h.pagina = 1; render();
  });

  /* Elegir marca vuelve a pintar: el desplegable de modelo ofrece los de esa
     marca y no los sesenta. Es la única dependencia entre dos filtros, y el
     propio sistema actual la anuncia arriba del formulario. */
  const marca = document.getElementById('h-marca');
  if (marca) marca.addEventListener('change', () => {
    leer(); h.modelo_id = ''; render();
  });

  const todos = document.getElementById('h-todos');
  if (todos) todos.addEventListener('click', () => {
    h.todos = !h.todos; h.pagina = 1;
    /* «Ver todos» quiere decir TODOS: las 15.534 órdenes de doce años, no las
       200 que se trajeron al abrir la pantalla. Se piden una vez y quedan en
       memoria para el resto de la sesión. */
    if (h.todos) traerTodaLaHistoria();
    render();
  });
  const est = document.getElementById('h-estadisticas');
  if (est) est.addEventListener('click', () => { h.vista = 'estadisticas'; render(); });
  const rep = document.getElementById('h-reporteria');
  if (rep) rep.addEventListener('click', () => { h.vista = 'reporteria'; render(); });

  const pdf = document.getElementById('h-pdf');
  if (pdf) pdf.addEventListener('click', () => {
    const filas = ultimoListadoHistorico;
    if (!filas.length) return avisar({ ok: false, motivo: 'No hay nada que imprimir: primero busca ' +
      'o aprieta Ver todos.' });
    mostrarImpreso(impresoListadoHistorico(filas, h.todos ? 'Todas las entregadas' : 'Según el filtro'),
      'Registro Histórico');
  });
  ['h-patente', 'h-cliente'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { leer(); render(); } });
  });
  const ant = document.getElementById('h-ant'), sig = document.getElementById('h-sig');
  if (ant) ant.addEventListener('click', () => { h.pagina--; render(); });
  if (sig) sig.addEventListener('click', () => { h.pagina++; render(); });

  // Cuántas filas por página. Vuelve a la primera, por lo mismo que en la Torre.
  const tam = document.getElementById('h-tam');
  if (tam) tam.addEventListener('change', () => {
    h.porPagina = Number(tam.value) || 0; h.pagina = 1; render();
  });

  /* Los caminos que ofrece el mensaje cuando no hay resultados. Van acá porque
     ese mensaje se pinta dentro de la tabla y sus botones tienen que hacer algo
     de verdad: llevar a la orden, a la torre, o repetir la búsqueda sin el
     rango. Un cartel que explica y deja al usuario en el mismo lugar explica a
     medias. */
  document.querySelectorAll('[data-h-ficha]').forEach((b) =>
    b.addEventListener('click', () => abrirFicha(b.dataset.hFicha)));
  document.querySelectorAll('[data-h-torre]').forEach((b) =>
    b.addEventListener('click', () => {
      ui.torre.busqueda = h.patente; ui.torre.situacion = 'piso'; ui.torre.pagina = 1;
      ir('torre');
    }));
  document.querySelectorAll('[data-h-sinfechas]').forEach((b) =>
    b.addEventListener('click', () => { h.desde = ''; h.hasta = ''; h.pagina = 1; render(); }));

  // Antes esto leía el número desde el texto de la celda. Salía del DOM y no
  // del modelo: bastaba mover una columna para romperlo. Ahora va por `data-ot`
  // y usa el mismo mecanismo que el resto de los paneles.
  dobleClicPorFilas();
}

/* ── Consolidado ───────────────────────────────────────────────────────── */

function vConsolidado() {
  const filas = Modelo.torre();
  const suma = filas.reduce((s, o) => ({ venta: s.venta + plataDe(o).ventaTotal }), { venta: 0 });

  return `
  <div class="panel">
    <div class="cab"><div><h2>${ico('consolidado', 'g')}Consolidado</h2>
      <div class="desc">${verVentaHistorico()
        ? 'Las 17 columnas de la Torre más el dinero'
        : 'Las 17 columnas de la Torre, con el detalle de repuestos'}</div></div>
      <button class="btn secundario" data-pendiente="Exportar el consolidado|6|la exportación es un permiso aparte y queda en la traza">Exportar</button></div>
    <div class="grid-envoltorio"><table class="grid">
      <thead><tr><th>OT</th><th>OR</th><th>Patente</th><th>Siniestro</th><th>Cliente</th><th>Compañia</th>
        <th>Marca</th><th>Modelo</th><th>Fecha de Ingreso</th><th>Tipo</th><th>Días</th><th>Estado</th><th>Etapa</th>
        ${/* Ancho propio desde que la columna trae la lista de piezas: sin esto
              la tabla la dejaba en 90px, el texto se partía cada dos palabras y
              cada fila crecía a seis líneas. La tabla ya tiene su barra
              horizontal, y el ancho igual se puede arrastrar. */''}
        ${/* 🔴 LA VENTA TAMBIEN SE APAGA ACA (30-08-2026, Marco: «nadie ve nada de
             venta, salvo administrador y los dos Gabriel»).

             Esa regla ya estaba puesta en el Historico y se habia quedado corta:
             el Consolidado es «las 17 columnas de la Torre mas el dinero», y
             Andres Guzman lo tiene por su lista de modulos. Con la columna
             puesta, la regla no se cumplia — solo estaba escrita en otra
             pantalla.

             Conserva el modulo, que le sirve para seguir los repuestos y los
             dias; lo que se va es la plata. La columna DESAPARECE en vez de
             mostrar un guion: un guion invita a preguntar que dice ahi. */''}
        ${verVentaHistorico() ? '<th>Venta</th>' : ''}<th style="min-width:250px">Rep Pend.</th><th style="min-width:250px">Rep OK.</th>
        ${TH_LUPA}</tr></thead>
      ${/* Sin el `slice(0, 60)`: el pie de abajo decía «Mostrando 60 de 102»
            mientras el total del pie de tabla sumaba las 102. Dos números
            distintos de la misma cosa en la misma pantalla. */''}
      <tbody>${filas.map((o) => {
        const z = plataDe(o);
        const pendientes = o.repuestos.filter((r) => !r.fechaBodega);
        const llegados = o.repuestos.filter((r) => r.fechaBodega);
        return '<tr class="fila" data-ot="' + esc(o.numeroOT) + '"><td class="num"><strong>' + o.numeroOT + '</strong></td>' +
          '<td class="num">' + esc(o.presupuestos.length ? o.presupuestos[0].numeroOR : '—') + '</td>' +
          '<td><span class="patente">' + esc(o.patente) + '</span></td>' +
          '<td class="num">' + esc(o.siniestro || '—') + '</td>' +
          '<td>' + esc(o.cliente) + '</td><td>' + esc(o.compania) + '</td>' +
          '<td>' + esc(o.marca || '—') + '</td><td>' + esc(o.modelo || '—') + '</td>' +
          '<td class="num">' + fFechaHora(o.fechaIngreso) + '</td>' +
          '<td>' + esc(o.origenIngresoNombre || '—') + '</td>' +
          '<td class="num">' + o.diasKpi + '</td>' +
          '<td><span class="et ' + esc(o.estadoClase) + '">' + esc(o.estadoNombre) + '</span></td>' +
          '<td>' + esc(o.etapaNombre) + '</td>' +
          (verVentaHistorico() ? '<td class="num"><strong>' + fMonto(z.ventaTotal) + '</strong></td>' : '') +
          /* 🔶 TEXTO, NO CANTIDAD (16-08-2026, Marco): «debiese quedar el texto
             de repuesto pendiente, no la cantidad ya que así lo tiene en el
             sistema actual». Un «2» hay que traducirlo cada vez.

             🔷 Y LAS PIEZAS, EN LA MISMA FILA (18-08-2026). Al cotejar contra
             `cloud.webdyp.cl` con la cuenta del gerente resultó que allá esta
             columna trae la LISTA COMPLETA de repuestos, cada uno con su
             proveedor entre paréntesis, y se lee sin abrir nada. Nosotros las
             teníamos un nivel más abajo —en el globo y en el desplegable—, y
             quien usa el consolidado todos los días las lee de corrido.

             Marco: «déjalo como tienen ellos, pero no borres nuestro valor
             añadido». Así que van las dos cosas: la etiqueta que se lee de una
             ARRIBA, y debajo las piezas. El desplegable de la fila sigue
             intacto, con su estado y sus fechas. */
          '<td style="max-width:420px">' + (pendientes.length
            ? '<span class="et roja" title="' + pendientes.length +
              (pendientes.length === 1 ? ' pieza sin llegar' : ' piezas sin llegar') +
              '">Repuesto pendiente</span>' +
              '<div class="piezas-pend">' + pendientes.map((r) =>
                esc(r.descripcion) +
                /* El proveedor entre paréntesis, como allá: es lo que dice de
                   quién hay que ir a cobrar el atraso. En minúscula porque en
                   su sistema viene escrito de las cuatro formas. */
                (r.responsablePago
                  ? ' <span class="prov">(' + esc(String(r.responsablePago).toLowerCase()) + ')</span>'
                  : '')).join(', ') + '</div>'
            : '<span style="color:var(--gris-2)">—</span>') + '</td>' +
          /* 🔷 EL DETALLE, NO LA CANTIDAD (31-08-2026, Marco). Igual que la
             columna de al lado: la etiqueta que se lee de una arriba y las
             piezas debajo, con su proveedor. Un «4» obliga a abrir la fila
             para saber QUÉ llegó, teniendo justo al lado una columna que dice
             las que faltan por su nombre.

             La fecha va en el globo y no en la fila: es lo primero que se
             pregunta de una pieza que llegó, pero puestas todas en la celda
             tapan lo que se vino a leer. */
          '<td style="max-width:420px">' + (llegados.length
            ? '<span class="et verde" title="' + llegados.length +
              (llegados.length === 1 ? ' pieza en bodega' : ' piezas en bodega') +
              '">Repuesto en bodega</span>' +
              '<div class="piezas-pend">' + llegados.map((r) =>
                '<span title="' + (r.fechaBodega ? 'Llegó el ' + fFecha(r.fechaBodega) : 'Sin fecha de llegada') + '">' +
                esc(r.descripcion) +
                (r.responsablePago
                  ? ' <span class="prov">(' + esc(String(r.responsablePago).toLowerCase()) + ')</span>'
                  : '') + '</span>').join(', ') + '</div>'
            : '<span style="color:var(--gris-2)">—</span>') + '</td>' +
          CELDA_LUPA(o.numeroOT) + '</tr>';
      }).join('')}</tbody>
      ${/* El pie cierra 17 columnas: 13 + venta + las dos de repuestos + la lupa. */''}
      <tfoot><tr><td colspan="13" style="text-align:right">Venta parada en las ${filas.length} órdenes vivas</td>
        <td class="num"><strong>${fMonto(suma.venta)}</strong></td><td colspan="3"></td></tr></tfoot>
    </table></div>
  </div>`;
}

function pConsolidado() {
  document.querySelectorAll('[data-pendiente]').forEach((b) => b.addEventListener('click', () => {
    const [rot, tanda, nota] = b.dataset.pendiente.split('|');
    avisar({ ok: false, motivo: '"' + rot + '" se construye en la tanda ' + tanda + (nota ? ' — ' + nota : '') + '.' });
  }));
  dobleClicPorFilas();
}
