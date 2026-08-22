/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   BODEGA — dos pantallas. Eran cuatro; las otras dos no se usan (ver abajo).

   Bodega NO es inventario de venta: es control de repuestos por orden de
   trabajo, y solo opera sobre vehículos que están en la torre. La razón es de
   negocio y se dio en la reunión: *"se obliga al bodeguero a cargar sí o sí
   mientras el auto está en el taller, porque yo no puedo facturar teniendo un
   pendiente"*.

   | Pantalla del original            | Estado hoy                          |
   |----------------------------------|-------------------------------------|
   | Check-list Repuestos Presupuestos| ✅ funciona                          |
   | Seguimiento Repuestos            | ✅ 102 filas, 14 columnas           |
   | Costos de Reparación             | ✅ 98 filas                          |
   | Valorizar TOT                    | ❌ cuelga el navegador               |

   🔴 CORRECCIÓN NUESTRA (16-08-2026). Este archivo decía que el check-list del
   original "no devuelve nada" y que "hoy no sirve". **Es falso y el error fue
   de nosotros, no del sistema del cliente.** La pantalla
   `?ver=mostrar-repuestos` usa `idp` —el identificador de la OR— y no `id`; se
   probó pasándole el número de OT, que devuelve la página vacía. Está anotado
   en `01 Levantamiento\SISTEMA-ACTUAL-INVENTARIO`, que ya lo había corregido:
   *"se marcó rota por este motivo antes de verificar el parámetro; era error
   de quien levantaba"*.

   Se corrige acá porque esto se dice en una reunión: llegar a decirle al
   cliente que su pantalla está rota cuando la rota era nuestra prueba cuesta
   la credibilidad de todo lo demás que sí encontramos.

   Lo que SÍ es cierto y sigue en pie: allá los dos hitos son **casillas
   sí/no** (`ok_bodega` y `entregado`), y por eso el sistema actual no puede
   responder cuánto demoró un repuesto. Acá son dos fechas. Eso es la mejora,
   y no hace falta exagerar nada para sostenerla.

   ⚠️ `Valorizar TOT` NO se construye. Cuelga el navegador en los dos intentos
   y no se pudo ver qué hace. Construir a ciegas la pantalla que alimenta
   `Venta ToT` —una de las tres líneas de venta del Histórico— sería inventar.
   Es la pregunta 5, sin confirmar.
   ──────────────────────────────────────────────────────────────────────── */

/* 🔶 BODEGA ENTRA POR UN MENÚ DE OPCIONES, COMO RECEPCIÓN (16-08-2026).

   Las cuatro pantallas ya estaban; lo que cambió es cómo se llega. Estaban
   como pestañas chicas en el encabezado y el sistema real las muestra como
   cuatro opciones grandes, igual que Recepción. Marco: "es muy parecido a las
   visuales y al front que tenemos en Recepción".

   No es decoración: en el mesón y en bodega se trabaja con el dedo sobre una
   pantalla, y cuatro botones grandes con su nombre completo se aciertan a la
   primera. Una pestaña de doce píxeles, no.

   Los nombres son los del sistema actual, con sus mayúsculas y todo: quien
   sabe usar el de hoy tiene que reconocerlos sin que nadie le explique. */
const BODEGA_PANTALLAS = [
  { id: 'checklist',   n: 'Check-list Repuestos Presupuestos', icono: 'documento',
    desc: 'Qué repuestos pide cada presupuesto y cuáles ya se cargaron' },
  { id: 'seguimiento', n: 'Seguimiento Repuestos', icono: 'repuesto',
    desc: 'Pedido, llegada a bodega y entrega al área, con sus fechas' },
];

/* 🔶 SE FUERON COSTOS DE REPARACIÓN Y VALORIZAR TOT (16-08-2026, Marco).

   No es que no se alcanzaran: **no se usan**. `Costos de Reparación` el taller
   no lo ocupa hoy —va en la misma línea de la decisión del 13-08 de sacar
   costos y utilidad por orden, porque el taller no los lleva— y
   `Valorizar TOT` **en el sistema real ni siquiera abre**: cuelga el
   navegador, verificado en dos intentos independientes.

   Replicar una pantalla que nadie usa cuesta lo mismo que una que sí, y además
   ensucia: el que entra a Bodega tiene que ver las dos cosas que hace, no
   cuatro de las que dos no llevan a ninguna parte. Si el taller dice que las
   necesita, están en el historial de git y vuelven. */

function bodegaEstado() {
  // Se entra por el menú, no por una pantalla cualquiera. Igual que Recepción.
  ui.bodega = ui.bodega || { pantalla: 'menu', patente: '', otId: null, busqueda: '', presupuestoId: null };
  return ui.bodega;
}

function vBodegaMenu() {
  return `
  <div class="panel">
    <div class="cab"><div><h2>${ico('bodega', 'g')}Bodega - DyP</h2>
      <div class="desc">Las cuatro del sistema actual, con sus mismos nombres</div></div></div>
    <div class="cuerpo">
      <div class="opciones-rec">${BODEGA_PANTALLAS.map((x) =>
        '<button class="opcion-rec" data-bod-opcion="' + x.id + '">' +
        '<span class="circulo">' + ico(x.icono, 'g') + '</span>' +
        '<span class="rot">' + esc(x.n) + '</span>' +
        '<span class="desc">' + esc(x.desc) + '</span></button>').join('')}</div>
    </div>
  </div>`;
}

function vBodega() {
  const b = bodegaEstado();
  if (b.pantalla === 'menu') return vBodegaMenu();

  const opcion = BODEGA_PANTALLAS.find((x) => x.id === b.pantalla) || BODEGA_PANTALLAS[0];
  const cuerpo = { checklist: bodegaChecklist, seguimiento: bodegaSeguimiento }[opcion.id]();
  return `
  <button class="btn volver" id="bod-menu"><span class="flecha-atras">&#8592;</span>
    Volver a las opciones de Bodega</button>
  <div class="panel">
    <div class="cab">
      <div><h2>${ico(opcion.icono, 'g')}${esc(opcion.n)}</h2>
        <div class="desc">${esc(opcion.desc)}</div></div>
      <div class="chips">${BODEGA_PANTALLAS.map((x) => '<button class="chip' +
        (b.pantalla === x.id ? ' activo' : '') + '" data-bod="' + x.id + '">' + esc(x.n) + '</button>').join('')}</div>
    </div>
    <div class="cuerpo">${cuerpo}</div>
  </div>`;
}

/* ── Check-list · la que está rota en el original ──────────────────────── */

function bodegaChecklist() {
  const b = bodegaEstado();
  /* Con un presupuesto elegido se pasa a su hoja de repuestos; si no, al
     buscador. Es el mismo camino del sistema actual: patente → presupuesto →
     repuestos de ESE presupuesto. */
  if (b.presupuestoId) {
    const o = Modelo.torre().find((x) => x.presupuestos.some((p) => p.id === b.presupuestoId));
    const p = o && o.presupuestos.find((x) => x.id === b.presupuestoId);
    if (o && p) return bodegaRepuestosPresupuesto(o, p);
  }

  const q = String(b.patente || '').trim().toUpperCase();
  const encontradas = q ? Modelo.torre().filter((o) =>
    o.patente.indexOf(q) >= 0 || String(o.numeroOT).indexOf(q) >= 0) : [];

  // Una fila POR PRESUPUESTO, no por vehículo: una OT puede tener varias OR y
  // cada una pide sus propios repuestos.
  const filas = [];
  /* Recotizar CONSERVA la OR: la versión nueva y la anterior llevan el mismo
     número. En pantalla eso salían como dos filas idénticas, una con repuestos
     y otra sin ellos, y se leía como un dato duplicado o como una
     contradicción. No se esconde ninguna —la versión anterior sigue diciendo lo
     que decía cuando se mandó, que es de lo que se trata versionar— pero la que
     ya no manda queda rotulada. No es traer de vuelta el «v1/v2» que se sacó:
     el identificador sigue siendo la OR; esto sólo responde por qué hay dos. */
  const ultimaVersion = {};
  encontradas.forEach((o) => o.presupuestos.forEach((p) => {
    const k = o.id + '|' + p.numeroOR;
    ultimaVersion[k] = Math.max(ultimaVersion[k] || 0, Number(p.version) || 1);
  }));

  encontradas.forEach((o) => o.presupuestos.forEach((p) => {
    // La cuenta es la de ESE presupuesto: antes iba `o.repuestos.length` y las
    // dos versiones de una misma OT mostraban el mismo número.
    const ids = {};
    (p.lineas || []).forEach((l) => { ids[l.id] = true; });
    const suyos = o.repuestos.filter((r) => r.presupuestoLineaId && ids[r.presupuestoLineaId]);
    const vieja = (Number(p.version) || 1) < ultimaVersion[o.id + '|' + p.numeroOR];
    filas.push({ o, p, suyos, vieja, nPend: suyos.filter((r) => !r.fechaBodega).length });
  }));

  /* 🔷 EL TEXTO, NO LA CANTIDAD (17-08-2026, Marco: "debiese salir el detalle
     del repuesto, el texto que se digitó").

     Acá iba un «2». Un número hay que traducirlo cada vez —¿dos de qué?— y para
     saberlo había que abrir el presupuesto. La descripción es la que se digitó
     en la OR y es con la que se habla en el taller: nadie pide "el repuesto 2",
     pide el paragolpes. Es la misma corrección que ya se hizo en el Consolidado
     el 16-08-2026.

     Lo que falta va en rojo, que es la pregunta que trae a alguien a esta
     pantalla: qué estamos esperando. La cantidad sólo aparece cuando es más de
     uno, y la fecha de llegada queda en el globo. */
  const textoRepuestos = (suyos) => (suyos.length
    ? suyos.map((r) => '<span' + (r.fechaBodega ? '' : ' style="color:var(--rojo)"') +
        ' title="' + (r.fechaBodega
          ? 'Llegó a bodega el ' + esc(fFechaHora(r.fechaBodega))
          : 'Todavía no llega a bodega') + '">' +
        (r.cantidad > 1 ? r.cantidad + ' × ' : '') + esc(r.descripcion) + '</span>').join(', ')
    : '<span style="color:var(--gris-2)">Sin repuestos: es sólo mano de obra</span>');

  const tabla = `
    <h3 style="font-size:13px;margin:14px 0 6px">Resultados de la patente &ldquo;${esc(q)}&rdquo;</h3>
    <div class="grid-envoltorio"><table class="grid">
      <thead><tr><th>OT</th><th>Patente</th><th>Presupuesto</th><th>Reparación</th>
        <th style="min-width:240px">Repuestos que pide</th><th>Acción</th></tr></thead>
      <tbody>${filas.map(({ o, p, suyos, vieja, nPend }) => '<tr><td class="num">' + o.numeroOT + '</td>' +
        '<td><span class="patente">' + esc(o.patente) + '</span></td>' +
        '<td class="cod">' + esc(p.numeroOR) +
          (vieja ? ' <span class="et gris" title="Esta OR se recotizó: la que manda es la de ' +
            'abajo, con el mismo número">versión anterior</span>' : '') + '</td>' +
        '<td class="num">' + esc(p.idReparacion || '—') + '</td>' +
        '<td>' + textoRepuestos(suyos) +
          (nPend ? ' <span class="et roja" title="' + nPend +
            (nPend === 1 ? ' sin llegar' : ' sin llegar') + '">' +
            (nPend === 1 ? '1 pendiente' : nPend + ' pendientes') + '</span>' : '') + '</td>' +
        '<td><button class="btn secundario" data-bod-presu="' + esc(p.id) + '">' +
          'Ver Repuestos de Presupuesto</button></td></tr>').join('')}
      </tbody></table></div>`;

  const vacio = (t, x) => '<div class="vacio"><div class="titulo">' + t + '</div>' +
    (x ? '<div class="texto">' + x + '</div>' : '') + '</div>';

  return `
  <div class="rejilla-campos">
    <div class="campo"><label>Buscar unidad para ver los repuestos del presupuesto</label>
      <input id="bod-patente" value="${esc(b.patente)}" placeholder="Patente u OT" autocomplete="off"></div>
    <div class="campo"><label>&nbsp;</label><button class="btn" id="bod-buscar">Buscar por patente</button></div>
  </div>

  ${!q ? vacio('Escribe una patente', 'Bodega solo muestra vehículos que están en la torre: es a ' +
      'propósito, para que nadie cargue un repuesto olvidado después de cerrada la OT.')
    : (!encontradas.length ? vacio('Sin resultados para &ldquo;' + esc(q) + '&rdquo;')
      : (!filas.length ? vacio('Esa unidad todavía no tiene presupuesto',
          'Los repuestos salen de la OR. Se abre en Recepción → Agregar OR y la valoriza el evaluador.')
        : tabla))}`;
}

/* ── La hoja de repuestos de UN presupuesto ────────────────────────────
   Las piezas que se digitaron en el presupuesto, con su código, su proveedor y
   las dos casillas que marca bodega: **OK Bodega** cuando la pieza llegó y
   **Entregado** cuando se la llevó el área.

   Las dos casillas son los dos hitos CON FECHA que el motor ya tenía: marcar
   escribe la fecha de hoy y deja el hecho con su autor. En el original son un
   sí/no, y por eso allá no se puede responder cuánto demoró un repuesto — que
   es la mitad de la conversación con la compañía.

   Entregado no se puede marcar antes que OK Bodega: no se entrega lo que no ha
   llegado. La casilla viene deshabilitada y dice por qué. */
function bodegaRepuestosPresupuesto(o, p) {
  const pagos = Modelo.catalogo('responsable_pago');
  /* Los de ESTA OR. Una orden puede tener varias versiones del presupuesto y
     antes la hoja mostraba los repuestos de todas juntas bajo el título de
     una sola. Los que bodega cargó a mano no tienen línea: se muestran igual,
     porque están en el taller y alguien los tiene que marcar. */
  const idsLinea = {};
  (p.lineas || []).forEach((l) => { idsLinea[l.id] = true; });
  const repuestos = o.repuestos.filter((r) =>
    !r.presupuestoLineaId || idsLinea[r.presupuestoLineaId]);
  const llegados = repuestos.filter((r) => r.fechaBodega).length;

  const fila = (r) => '<tr>' +
    '<td><input data-cod="' + esc(r.id) + '" value="' + esc(r.codigoInterno || '') +
      '" placeholder="El de bodega"></td>' +
    // Deshabilitado a propósito: en el sistema actual está gris y vacío. No se
    // inventa un dato que allá nadie llena.
    '<td><input value="' + esc(r.codigoExterno || '') + '" disabled ' +
      'title="En el sistema actual esta casilla está deshabilitada y vacía"></td>' +
    '<td class="num">' + r.cantidad + '</td>' +
    '<td>' + esc(r.descripcion) + '</td>' +
    '<td><select data-pago="' + esc(r.id) + '">' + pagos.map((x) =>
      '<option value="' + esc(x.id) + '"' + (x.nombre === r.responsablePago ? ' selected' : '') +
      '>' + esc(x.nombre) + '</option>').join('') + '</select></td>' +
    '<td style="text-align:center"><input type="checkbox" data-ok="' + esc(r.id) + '"' +
      (r.fechaBodega ? ' checked' : '') + ' title="' +
      (r.fechaBodega ? 'Llegó el ' + esc(fFechaHora(r.fechaBodega)) : 'Marcar cuando llegue') + '"></td>' +
    /* Entregado pide DOS cosas antes: que la pieza haya llegado y que esté
       cargado el vale de retiro. La segunda la pidió el cliente —es lo que
       comprueba quién se llevó el repuesto— y el motor la exige igual. La
       casilla lo dice ANTES de apretarla en vez de rebotar después: un botón
       que se puede apretar y siempre falla enseña a no confiar en la
       pantalla. El vale se sube en la ficha de abajo. */
    '<td style="text-align:center"><input type="checkbox" data-ent="' + esc(r.id) + '"' +
      (r.fechaEntregaArea ? ' checked' : '') +
      (r.fechaBodega && (r.valeMediaId || r.fechaEntregaArea) ? '' : ' disabled') + ' title="' +
      (r.fechaEntregaArea ? 'Entregado el ' + esc(fFechaHora(r.fechaEntregaArea))
        : (!r.fechaBodega ? 'No se puede entregar lo que todavía no llegó'
          : (!r.valeMediaId ? 'Falta subir el vale de retiro, abajo en la ficha'
            : 'Marcar al entregarlo al área'))) + '"></td>' +
    /* 🔶 LA COLUMNA QUE EL ORIGINAL NO TIENE (16-08-2026, Marco): el vale de
       retiro y la DEVOLUCIÓN, en la misma pantalla donde se marca que llegó.

       Devolver no es "desmarcar": el ciclo que se cierra queda guardado entero
       —cuándo llegó, cuándo se entregó, con qué vale— y el repuesto vuelve a
       quedar pendiente con el pedido corriendo de nuevo desde hoy. Por eso la
       fila muestra en qué VUELTA va. Y por eso el motivo es obligatorio: sin
       él, el expediente no puede explicar después por qué el vehículo estuvo
       detenido dos semanas más. */
    '<td>' + accionesRepuesto(r) + '</td></tr>';

  return `
  <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:9px">
    <h3 style="margin:0;font-size:15px">Repuestos Presupuesto Orden N° ${esc(p.numeroOR)}</h3>
    <button class="btn secundario" id="bod-a-buscar">Volver a Bodega de Repuestos</button>
  </div>

  <div class="panel">
    <div class="cab"><div><h2>Repuestos</h2>
      <div class="desc">OT ${o.numeroOT} · ${esc(o.patente)} · ${esc(o.cliente)}</div></div>
      <span class="et ${llegados === repuestos.length ? 'verde' : 'ambar'}">${llegados} de
        ${repuestos.length} en bodega</span></div>
    <div class="grid-envoltorio"><table class="grid">
      <thead><tr><th>Código interno</th><th>Código externo</th><th class="num" style="width:70px">Cantidad</th>
        <th>Descripción</th><th style="width:160px">Proveedor</th>
        <th style="width:90px">OK Bodega</th><th style="width:90px">Entregado</th>
        <th>Vale y devolución</th></tr></thead>
      <tbody>${repuestos.length ? repuestos.map(fila).join('')
        : '<tr><td colspan="8"><div class="vacio"><div class="titulo">Este presupuesto no generó ' +
          'repuestos</div><div class="texto">Los repuestos salen de las líneas de proceso ' +
          '<strong>Cambio</strong>. Si el presupuesto es sólo mano de obra, no hay nada que pedir.' +
          '</div></div></td></tr>'}</tbody>
    </table></div>
    <div class="cuerpo">
      <div class="nota">Las casillas guardan al marcarlas —cada una escribe su fecha y queda en el
        expediente con quién la marcó—, así que ahí <strong>no hay que apretar Guardar</strong>.
        El código interno sí: se escribe y se guarda.</div>
      <div style="margin-top:9px"><button class="btn" id="bod-guardar-cod">Guardar</button></div>
    </div>
  </div>`;
}

function bodegaFichaRepuestos(o) {
  const pagos = Modelo.catalogo('responsable_pago');
  return `
  <div class="panel" style="margin-top:11px">
    <div class="cab"><div><h2>OT ${o.numeroOT} · ${esc(o.patente)}</h2>
      <div class="desc">${esc(o.cliente)} · ${esc(o.compania)} · ${o.enTaller ? 'en taller' : 'fuera de taller'}</div></div>
      <span class="et ${o.repuestos.some((r) => !r.fechaBodega) ? 'ambar' : 'verde'}">
        ${o.repuestos.filter((r) => r.fechaBodega).length} de ${o.repuestos.length} recibidos</span></div>
    <div class="grid-envoltorio"><table class="grid">
      <thead><tr><th>Cant.</th><th>Descripción</th><th>Quién paga</th><th>Solicitado</th>
        <th>Llegó a bodega</th><th>Entregado al área</th><th>Demoró</th><th>Acción</th></tr></thead>
      <tbody>${o.repuestos.length ? o.repuestos.map((r) =>
        '<tr><td class="num">' + r.cantidad + '</td><td>' + esc(r.descripcion) + '</td>' +
        '<td><select data-pago="' + esc(r.id) + '">' +
          pagos.map((x) => '<option value="' + esc(x.id) + '"' +
            (x.nombre === r.responsablePago ? ' selected' : '') + '>' + esc(x.nombre) + '</option>').join('') +
          '</select></td>' +
        '<td class="num">' + (r.fechaSolicitud ? fFechaHora(r.fechaSolicitud) : '—') + '</td>' +
        '<td class="num">' + (r.fechaBodega ? fFechaHora(r.fechaBodega) : '<span class="et ambar">pendiente</span>') + '</td>' +
        '<td class="num">' + (r.fechaEntregaArea ? fFechaHora(r.fechaEntregaArea) : '—') + '</td>' +
        '<td class="num">' + (r.diasEnLlegar === null ? '—' : r.diasEnLlegar + ' d') + '</td>' +
        // El ciclo del repuesto, en el orden que lo describió el cliente:
        // llega → se sube el vale de quien lo retira → bodega marca entregado.
        // Y si se devuelve, vuelve a correr entero desde el pedido.
        '<td>' + accionesRepuesto(r) + '</td></tr>').join('')
        : '<tr><td colspan="8"><div class="vacio"><div class="titulo">Sin repuestos en el presupuesto</div></div></td></tr>'}</tbody>
    </table></div>
    <div class="cuerpo">
      <fieldset class="bloque"><legend>Cargar un repuesto que no venía en el presupuesto</legend>
        <div class="rejilla-campos">
          <div class="campo"><label>Descripción</label><input id="bod-desc" placeholder="Como se escribe: sin código"></div>
          <div class="campo"><label>Cantidad</label><input type="number" id="bod-cant" value="1" min="1"></div>
          <div class="campo"><label>Quién paga</label><select id="bod-pago">${pagos.map((x) =>
            '<option value="' + esc(x.id) + '">' + esc(x.nombre) + '</option>').join('')}</select></div>
          <div class="campo"><label>&nbsp;</label><button class="btn" id="bod-cargar">Cargar</button></div>
        </div>
      </fieldset>
    </div>
  </div>`;
}

/* ── Seguimiento · 14 columnas ─────────────────────────────────────────── */

function bodegaSeguimiento() {
  const b = bodegaEstado();
  const q = b.busqueda.trim().toLowerCase();
  const filas = Modelo.torre().filter((o) => !q ||
    [o.numeroOT, o.patente, o.cliente, o.siniestro].join(' ').toLowerCase().includes(q));

  const lista = (o, pendientes) => o.repuestos.filter((r) => pendientes ? !r.fechaBodega : r.fechaBodega)
    .map((r) => (pendientes ? '<span style="color:var(--rojo)">' : '<span>') + esc(r.descripcion) +
      ' (' + esc((r.responsablePago || 's/d').toLowerCase()) + ')</span>')
    .join(', ') || '<span style="color:var(--gris-2)">—</span>';

  return `
  <div class="filtros" style="margin-bottom:8px">
    <input type="search" id="bod-q" placeholder="OT, patente, cliente o siniestro" value="${esc(b.busqueda)}">
    <button class="btn secundario" data-pendiente="DESCARGAR LISTADO TOTAL|6|la exportación es un permiso aparte y queda en la traza">Descargar listado total</button>
  </div>

  <div class="grid-envoltorio"><table class="grid">
    <thead><tr><th>OT</th><th>OR</th><th>Cliente</th><th>Compañia</th><th>Patente</th><th>Siniestro</th>
      <th>Marca</th><th>Modelo</th><th>Color</th><th>Fecha de Ingreso</th><th>Días</th><th>Alerta</th>
      <th>Rep Pend.</th><th>Rep OK.</th></tr></thead>
    ${/* Antes acá había un `slice(0, 60)`: la tabla mostraba sesenta filas de
          las que hubiera y el pie decía «Mostrando 60 de 102» sin ofrecer
          ninguna forma de ver las otras 42. Eso no es paginar, es esconder. Va
          entera y el paginado le pone el pie con el selector. */''}
    <tbody>${filas.map((o) =>
      '<tr class="fila" data-ot="' + esc(o.numeroOT) + '"><td class="num"><strong>' + o.numeroOT + '</strong></td>' +
      '<td class="num">' + esc(o.presupuestos.length ? o.presupuestos[0].numeroOR : '—') + '</td>' +
      '<td>' + esc(o.cliente) + '</td><td>' + esc(o.compania) + '</td>' +
      '<td><span class="patente">' + esc(o.patente) + '</span></td>' +
      '<td class="num">' + esc(o.siniestro || '—') + '</td>' +
      '<td>' + esc(o.marca || '—') + '</td><td>' + esc(o.modelo || '—') + '</td>' +
      '<td>' + esc(o.color || '—') + '</td>' +
      '<td class="num">' + fFechaHora(o.fechaIngreso) + '</td>' +
      '<td class="num">' + o.diasKpi + '</td>' +
      '<td>' + (o.alertas.length ? o.alertas.map((a) => '<span class="cod">' + esc(a.letra) + '</span>').join('') : '—') + '</td>' +
      '<td style="max-width:220px">' + lista(o, true) + '</td>' +
      '<td style="max-width:220px">' + lista(o, false) + '</td></tr>').join('')}</tbody>
  </table></div>
`;
}

/* ── Cableado ──────────────────────────────────────────────────────────── */


/* Los botones del repuesto, según dónde va en su ciclo. Punto 7 del cliente,
   15-08-2026, en sus palabras y en su orden:

     1. El repuesto se asocia a OT - patente - repuesto.
     2. Bodega marca cuando LLEGA.
     3. Se le entrega al desabollador, que va a buscarlo.
     4. El que lo recibe SUBE EL VALE: comprueba que fue y lo retiró.
     5. Bodega marca ENTREGADO, una vez que el vale está subido.
     6. Si se devuelve, el proceso vuelve a correr entero.

   El vale es la CONDICIÓN para marcar entregado, no un adjunto opcional: sin
   él, "entregado" es la palabra de bodega contra la del taller. Por eso el
   botón de entregar no aparece hasta que el vale está arriba — y el motor lo
   revisa igual, no sólo la pantalla. */
/* ── El ciclo del repuesto, en un solo lugar ───────────────────────────
   Llegó a bodega · se sube el vale de quien la retira · bodega marca
   entregada al área · y la devolución, que archiva el ciclo y lo hace correr
   de nuevo.

   Vivía dentro de `pBodega` y por eso el mismo ciclo no se podía operar desde
   la ficha de la orden, que es donde lo mira el desabollador. Marco lo pidió
   tres veces; la tercera fue con razón. Ahora las dos pantallas enganchan
   esto mismo, así que no pueden divergir.

   `otId` es a quién se le cuelga el vale: en Bodega es la unidad que se está
   mirando y en la ficha, la orden abierta. */
function engancharRepuestos(otId) {
  document.querySelectorAll('[data-ok]').forEach((x) => x.addEventListener('change', () => {
    if (!x.checked) { render(); return avisar({ ok: false, motivo: 'La llegada a bodega no se ' +
      'desmarca: es un hecho con fecha. Si la pieza se va, se registra la devolución.' }); }
    ejecutar(() => Modelo.recibir_repuesto(x.dataset.ok, HOY), 'Repuesto recibido en bodega.');
  }));
  document.querySelectorAll('[data-ent]').forEach((x) => x.addEventListener('change', () => {
    if (!x.checked) { render(); return avisar({ ok: false, motivo: 'La entrega al área no se ' +
      'desmarca: es un hecho con fecha.' }); }
    ejecutar(() => Modelo.entregar_repuesto_area(x.dataset.ent, HOY), 'Repuesto entregado al área.');
  }));

  document.querySelectorAll('[data-recibir]').forEach((x) => x.addEventListener('click', () =>
    ejecutar(() => Modelo.recibir_repuesto(x.dataset.recibir), 'Repuesto recibido en bodega, con fecha.')));
  document.querySelectorAll('[data-entregararea]').forEach((x) => x.addEventListener('click', () =>
    ejecutar(() => Modelo.entregar_repuesto_area(x.dataset.entregararea), 'Entregado al área, con fecha.')));

  /* El vale. En el sistema real es la foto o el escaneo del papel que firma
     quien retira; acá se toma con el mismo camino que las demás fotos, así que
     el archivo queda en el expediente con su autor y su fecha. */
  document.querySelectorAll('[data-vale]').forEach((x) => x.addEventListener('click', () => {
    const id = x.dataset.vale;
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*,application/pdf';
    inp.addEventListener('change', () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      Media.guardar(f, { momento: 'documento', ot_id: otId })
        .then((ficha) => {
          Modelo.adjuntar_media(null, [otId], [ficha]);
          ejecutar(() => Modelo.adjuntar_vale_repuesto(id, ficha.id),
            'Vale cargado. Ahora se puede marcar entregado.');
        })
        .catch(() => avisar({ ok: false, motivo: 'No se pudo guardar el vale en este navegador.' }));
    });
    inp.click();
  }));

  /* La devolución NO borra el ciclo anterior: lo archiva con su motivo. Por eso
     el motivo es obligatorio — es lo que después explica en el expediente por
     qué el vehículo estuvo detenido. */
  document.querySelectorAll('[data-devolver]').forEach((x) => x.addEventListener('click', () => {
    // Sólo la pregunta (16-08-2026, Marco). Dónde queda registrado se
    // responde donde se ve —el globo de la vuelta, el historial y el
    // expediente—, no en el cuadro que interrumpe para escribir.
    const motivo = prompt('¿Por qué se devuelve el repuesto?');
    if (motivo === null) return;
    ejecutar(() => Modelo.devolver_repuesto(x.dataset.devolver, motivo),
      'Repuesto devuelto. Queda pendiente y el pedido vuelve a correr.');
  }));
}

function accionesRepuesto(r) {
  /* La vuelta, con EL MOTIVO de la última devolución en el globo. Marco
     preguntó dónde quedaba ese texto: queda en el historial de la orden y en
     el expediente —con su fecha y su autor—, pero acá, que es donde bodega
     mira la pieza, no se veía. Ahora se ve sin salir de la fila. */
  const vueltas = (r.devoluciones || []).length;
  const ultima = vueltas ? (r.devoluciones[vueltas - 1] || {}) : null;
  const marca = vueltas
    ? ' <span class="et ambar" title="' + esc('Devuelta ' + vueltas +
        (vueltas === 1 ? ' vez' : ' veces') +
        (ultima && ultima.motivo ? ' · última: ' + ultima.motivo : '')) +
      '">vuelta ' + (vueltas + 1) + '</span>'
    : '';

  if (!r.fechaBodega)
    return '<button class="btn secundario" data-recibir="' + esc(r.id) + '">Llegó a bodega</button>' + marca;

  if (!r.valeMediaId)
    return '<button class="btn secundario" data-vale="' + esc(r.id) + '">Subir el vale de retiro</button>' +
           ' <button class="btn secundario" data-devolver="' + esc(r.id) + '">Devolver</button>' + marca;

  if (!r.fechaEntregaArea)
    return '<button class="btn secundario" data-entregararea="' + esc(r.id) + '">Marcar entregado</button>' +
           ' <button class="btn secundario" data-devolver="' + esc(r.id) + '">Devolver</button>' + marca;

  return '<span class="et verde">completo</span>' +
         ' <button class="btn secundario" data-devolver="' + esc(r.id) + '">Devolver</button>' + marca;
}

function pBodega() {
  // Doble clic abre la orden en pestaña nueva, igual que en la torre.
  /* SIN desplegable (16-08-2026, Marco: «no quiero que el apartado de Bodega
     tenga desplegable»). Acá no se estudia la orden: se marca que una pieza
     llegó y que se entregó.

     Pero el doble clic SÍ abre la orden en otra pestaña, y SÓLO sobre el
     número de OT — no sobre cualquier celda. Al sacar el desplegable me
     llevé las dos cosas; y el genérico enganchaba la fila entera, así que un
     doble clic al elegir texto de una descripción abría una pestaña que
     nadie pidió. */
  /* Esto estaba escrito acá a mano, enganchado a `td:first-child`. Desde el
     17-08-2026 lo hace el ayudante compartido con `sinDetalle`, que además
     encuentra la celda de la OT por su CONTENIDO y no por su posición: en esta
     tabla la OT va primera, pero en otra no, y una copia que sólo funciona por
     casualidad es la que después se comporta distinto. Documentos pidió lo
     mismo y ahora las dos pantallas usan el mismo gesto. */
  dobleClicPorFilas(null, { sinDetalle: true });
  const b = bodegaEstado();

  // El menú de entrada, y las pestañas de arriba una vez adentro: las dos
  // llevan a lo mismo, y el que ya sabe dónde va no tiene que volver al menú.
  document.querySelectorAll('[data-bod-opcion]').forEach((x) => x.addEventListener('click', () => {
    b.pantalla = x.dataset.bodOpcion; b.otId = null; b.patente = ''; b.presupuestoId = null; render();
  }));

  /* La hoja de repuestos de un presupuesto: entrar, volver, marcar las dos
     casillas y guardar los códigos. */
  document.querySelectorAll('[data-bod-presu]').forEach((x) => x.addEventListener('click', () => {
    b.presupuestoId = x.dataset.bodPresu; render();
  }));
  const aBuscar = document.getElementById('bod-a-buscar');
  if (aBuscar) aBuscar.addEventListener('click', () => { b.presupuestoId = null; render(); });

  const guardarCod = document.getElementById('bod-guardar-cod');
  if (guardarCod) guardarCod.addEventListener('click', () => {
    const campos = [...document.querySelectorAll('[data-cod]')];
    let n = 0, malo = null;
    campos.forEach((c) => {
      const r = Modelo.fijar_codigo_repuesto(c.dataset.cod, c.value);
      if (r.ok) n++;
      // "El código ya decía eso" no es un error que valga la pena mostrar.
      else if (!/ya decía/.test(r.motivo)) malo = r;
    });
    if (malo) return avisar(malo);
    render();
    avisar({ ok: true, motivo: '' }, n
      ? plural(n, 'código guardado', 'códigos guardados') + '.'
      : 'No había ningún código que cambiar.');
  });
  document.querySelectorAll('[data-bod]').forEach((x) => x.addEventListener('click', () => {
    b.pantalla = x.dataset.bod; b.otId = null; render();
  }));
  /* Ojo con el nombre: `bod-volver` ya existía para el "Volver al listado" de
     Costos. Dos elementos con el mismo id no dan error, dan algo peor —
     `getElementById` devuelve el primero y el otro botón queda muerto—. */
  const alMenu = document.getElementById('bod-menu');
  if (alMenu) alMenu.addEventListener('click', () => {
    b.pantalla = 'menu'; b.otId = null; b.patente = ''; render();
  });

  const buscar = document.getElementById('bod-buscar');
  const campo = document.getElementById('bod-patente');
  const hacerBusqueda = () => {
    b.patente = campo.value.trim().toUpperCase();
    // Bodega solo opera sobre órdenes vivas: es a propósito.
    const o = Modelo.torre().find((x) => x.patente === b.patente);
    b.otId = o ? o.id : null;
    render();
  };
  if (buscar) buscar.addEventListener('click', hacerBusqueda);
  if (campo) campo.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') hacerBusqueda(); });

  const q = document.getElementById('bod-q');
  if (q) q.addEventListener('input', () => {
    b.busqueda = q.value; render();
    const n = document.getElementById('bod-q');
    n.focus(); n.setSelectionRange(n.value.length, n.value.length);
  });

  engancharRepuestos(b.otId);

  document.querySelectorAll('[data-pago]').forEach((x) => x.addEventListener('change', () =>
    ejecutar(() => Modelo.fijar_responsable_pago(x.dataset.pago, x.value), 'Responsable de pago guardado.')));

  const cargar = document.getElementById('bod-cargar');
  if (cargar) cargar.addEventListener('click', () => ejecutar(() => Modelo.cargar_repuesto(b.otId, {
    descripcion: document.getElementById('bod-desc').value,
    cantidad: Number(document.getElementById('bod-cant').value) || 1,
    responsable_pago_id: document.getElementById('bod-pago').value
  }), 'Repuesto cargado.'));

  document.querySelectorAll('[data-costos-ot]').forEach((x) => x.addEventListener('click', () => {
    b.otId = x.dataset.costosOt; render();
  }));
  const volver = document.getElementById('bod-volver');
  if (volver) volver.addEventListener('click', () => { b.otId = null; render(); });

  const agregarCosto = document.getElementById('ca-agregar');
  if (agregarCosto) agregarCosto.addEventListener('click', () => ejecutar(() =>
    Modelo.agregar_costo_adicional(b.otId, {
      descripcion: document.getElementById('ca-desc').value,
      monto: document.getElementById('ca-monto').value,
      responsable_pago_id: document.getElementById('ca-pago').value
    }), 'Costo adicional cargado.'));

  document.querySelectorAll('[data-pendiente]').forEach((x) => x.addEventListener('click', () => {
    const [rot, tanda, nota] = x.dataset.pendiente.split('|');
    avisar({ ok: false, motivo: '"' + rot + '" se construye en la tanda ' + tanda + (nota ? ' — ' + nota : '') + '.' });
  }));
}
