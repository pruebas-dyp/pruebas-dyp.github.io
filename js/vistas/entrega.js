/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   SALIDA, REINGRESO Y ENTREGA — el cierre del ciclo.

   Tres cosas distintas que el sistema actual mezcla en una sola:

   1 · SALIDA. El vehículo se inspecciona, se presupuesta y **se devuelve al
       cliente** mientras llegan los repuestos. En el original esto no se
       registra: el campo `Fecha de salida` de la ficha existe y está vacío
       incluso en órdenes ya entregadas.

   2 · REINGRESO. Vuelve cuando llegan las piezas. En el original el único
       rastro es un `Cambio de estado: 'Recibido' a 'Recibido'` que además
       **reinicia el contador de días** — medido al día exacto en ocho
       órdenes.

   3 · ENTREGA. Cierra la orden. Acá sí existe pantalla, busca por patente y
       pide fecha obligatoria, observación y tipo de entrega.

   Acá las tres son hechos con fecha sobre `ot_estadia`, y por eso los relojes
   no se pueden reiniciar regrabando nada.
   ──────────────────────────────────────────────────────────────────────── */

function entregaEstado() {
  ui.entrega = ui.entrega || { patente: '', otId: null, obs: '', estado: null };
  return ui.entrega;
}

/* ── Qué significa "listo para entregar" ───────────────────────────────
   El cliente pidió el 15-08-2026 que al escribir aparezcan los vehículos que
   están listos para entregar. Listo no es una bandera del sistema: se deduce, y
   son tres condiciones a la vez.

   Se ofrecen TODAS las órdenes vivas igual, no sólo las listas. Ocultar las que
   no cumplen dejaría al recepcionista buscando una patente que sí está en el
   taller, sin saber por qué no aparece — y hay casos legítimos de entregar un
   auto con algo pendiente. Aparecen todas, marcadas. */
function listoParaEntregar(o) {
  const calidad = (o.etapasAsignadas || []).find((x) => x.codigo === 'calidad');
  return {
    enTaller: !!o.enTaller,
    calidadOk: !calidad || calidad.finalizada,
    sinPendientes: !o.repuestos.some((r) => !r.fechaBodega)
  };
}
const estaListo = (o) => { const c = listoParaEntregar(o); return c.enTaller && c.calidadOk && c.sinPendientes; };

function motivoNoListo(o) {
  const c = listoParaEntregar(o);
  const faltas = [];
  if (!c.enTaller) faltas.push('está fuera del taller');
  if (!c.calidadOk) faltas.push('control de calidad abierto');
  if (!c.sinPendientes) faltas.push(o.repuestos.filter((r) => !r.fechaBodega).length + ' repuestos por llegar');
  return faltas.join(' · ');
}

function vEntrega() {
  const e = entregaEstado();
  const o = e.otId ? Modelo.otPorId(e.otId) : null;
  const vivas = Modelo.torre();
  const listos = vivas.filter(estaListo);
  /* 🔶 SIN LISTA: ACÁ SE BUSCA POR PATENTE Y NADA MÁS (15-08-2026, pedido de
     Marco, y es el tercer ajuste sobre lo mismo).

     Pasó por las tres formas: primero un `datalist` que sólo aparecía al
     teclear, después la lista completa de las listas para entregar desplegada
     al entrar, y ahora ninguna. La razón es la del sistema actual y es buena:
     el auto está adelante y lo que se sabe es la patente. Una tabla de
     cincuenta y tres autos abierta en la pantalla que CIERRA órdenes es una
     fila de más para equivocarse — se entrega el que se buscó, no el que
     quedó cerca del dedo.

     La cuenta de arriba se queda: es un número, no una lista, y responde
     "¿cuántos hay listos?" sin poner ninguno al alcance del clic. */
  const coincidencias = e.patente
    ? vivas.filter((x) => x.patente.indexOf(e.patente) >= 0 ||
        String(x.numeroOT).indexOf(e.patente) >= 0)
    : [];

  /* El paso atrás, porque Entrega dejó de ser un módulo del menú el 15-08-2026
     —"ya lo tenemos en Recepción"— y sin esto se llega acá y no hay por dónde
     salir salvo el menú lateral. Es el mismo botón de las otras opciones de
     Recepción, en el mismo lugar. */
  return `
  <button class="btn volver" id="ent-volver"><span class="flecha-atras">&#8592;</span>
    Volver a las opciones de Recepción</button>
  <div class="panel">
    <div class="cab"><div><h2>${ico('check', 'g')}Buscar unidad para entrega</h2>
      <div class="desc">El cierre del ciclo. Se escribe la patente del vehículo que se va a entregar</div></div>
      <span class="et ${listos.length ? 'verde' : 'gris'}">${listos.length} listas para entregar</span></div>
    <div class="cuerpo">
      <div class="rejilla-campos">
        <div class="campo"><label>Patente u OT</label>
          <input id="ent-patente" autocomplete="off"
            value="${esc(e.patente)}" placeholder="Patente o número de OT">
          <span class="ayuda">Se busca entre las órdenes vivas. Si el vehículo todavía no está
            listo aparece igual, marcado con lo que le falta</span></div>
        <div class="campo"><label>&nbsp;</label><button class="btn" id="ent-buscar">Buscar patente</button></div>
      </div>

      ${!e.patente
        ? '<div class="vacio"><div class="titulo">Escribe la patente</div>' +
          '<div class="texto">Hay <strong>' + listos.length + '</strong> unidades listas para ' +
          'entregar. No se listan acá a propósito: ésta es la pantalla que cierra órdenes, y se ' +
          'entrega el vehículo que se buscó.</div></div>'
        : ''}

      ${e.patente && !coincidencias.length
        ? '<div class="vacio"><div class="titulo">Sin resultados para “' + esc(e.patente) + '”</div>' +
          '<div class="texto">Solo se ofrecen órdenes vivas: una orden ya cerrada no se vuelve a entregar.</div></div>'
        : ''}

      ${coincidencias.length ? `
      <h3 style="font-size:13px;margin:14px 0 4px">Resultados de la patente
        &ldquo;${esc(e.patente)}&rdquo;</h3>
      <div class="ayuda" style="margin:0 0 7px">La flecha de la izquierda abre el detalle.
        Con fecha de hoy el botón <strong>entrega</strong> y cierra la orden; con una fecha
        más adelante cambia a <strong>Programar</strong>, que compromete el día y deja la orden abierta</div>
      <div class="grid-envoltorio"><table class="grid">
        <thead><tr>
          <th>OT</th><th>Patente</th><th style="width:170px">Fecha de Entrega</th>
          <th style="width:200px">Tipo de entrega</th><th>Observaciones</th><th style="width:104px"></th>
        </tr></thead>
        <tbody>${coincidencias.map((x) => filaEntrega(x, e)).join('')}</tbody>
      </table></div>` : ''}

      ${o ? vEntregaFicha(o) : ''}
    </div>
  </div>`;
}

/* La fila de entrega, con los mismos campos que el sistema actual: OT, patente,
   fecha con hora, tipo de entrega, observaciones y el botón. Se entrega desde
   la propia fila — no hay que abrir nada más, que es como trabaja el
   recepcionista hoy.

   Lo que se agrega, y no estorba: si al vehículo le falta algo para estar listo
   se dice EN la fila. El original deja entregar igual y sin avisar; acá se
   avisa y se deja entregar igual, porque hay casos legítimos —un cliente que se
   lleva el auto a medias— y quien decide es el taller, no el sistema. */
function filaEntrega(x, e) {
  const finales = Modelo.catalogo('estado').filter((s) => (s.alcanzable_en || []).indexOf('entrega') >= 0);
  const listo = estaListo(x);
  const falta = listo ? '' : motivoNoListo(x);

  return '<tr class="fila" data-ot="' + esc(x.numeroOT) + '">' +
    '<td class="num"><strong>' + x.numeroOT + '</strong></td>' +
    '<td><span class="patente">' + esc(x.patente) + '</span>' +
      (listo ? ' <span class="et verde">lista</span>'
             : ' <span class="et ambar" title="' + esc(falta) + '">pendiente</span>') +
      // La fecha ya comprometida se ve en la fila: es lo primero que pregunta
      // el cliente cuando llama, y sin esto había que abrir la orden. Sólo si
      // es de más adelante: una fecha probable ya vencida no es un compromiso
      // vigente, y con 53 filas sería una etiqueta en todas que no dice nada.
      (esFutura(x.fechaCompromiso) ? ' <span class="et azul">programada ' +
        esc(fFechaHora(x.fechaCompromiso)) + '</span>' : '') +
      '<div class="ayuda" style="margin:2px 0 0">' + esc(x.cliente) +
      (falta ? ' — ' + esc(falta) : '') + '</div></td>' +
    // La fecha lleva HORA, igual que el original: un taller entrega varios
    // autos el mismo día y el orden importa cuando hay un reclamo.
    /* Parte SIEMPRE en hoy, aunque la orden ya tenga una fecha comprometida
       más adelante. Se probó al revés —prellenar el compromiso— y quedaban 22
       de 53 filas con el botón en «Programar» en la pantalla que se llama
       Entregar Unidad: el cliente que llega al mostrador a buscar su auto es
       el caso de todos los días, y programar es el que se decide. */
    '<td><input type="datetime-local" data-ent-campo="fecha" data-ot="' + esc(x.id) + '" ' +
      'value="' + esc(isoFechaHora(HOY)) + '"></td>' +
    '<td><select data-ent-campo="estado" data-ot="' + esc(x.id) + '">' +
      '<option value="">Seleccionar</option>' +
      finales.map((s) => '<option value="' + esc(s.codigo) + '">' + esc(s.nombre) + '</option>').join('') +
      '</select></td>' +
    '<td><textarea rows="2" data-ent-campo="obs" data-ot="' + esc(x.id) + '" ' +
      'placeholder="Observaciones de la entrega"></textarea></td>' +
    '<td><button class="btn" data-ent-entregar="' + esc(x.id) + '">Entregar</button></td></tr>';
}

/* ── Entregar hoy o programar para después ─────────────────────────────
   Pedido del cliente el 15-08-2026: poder poner una fecha de entrega futura.

   No se resuelve dejando escribir cualquier fecha en el mismo botón, porque
   entregar es un HECHO —cierra la orden, manda el auto al histórico y detiene
   los relojes— y un hecho no se puede registrar antes de que pase. Lo que se
   agenda para el jueves es un COMPROMISO, y eso es otra cosa.

   Entonces el botón lee la fecha: si es de hoy o de antes, entrega; si es de
   un día más adelante, programa. Un solo campo, dos actos bien separados.

   Se compara por DÍA, no por hora: la casilla viene con la hora actual y con
   una comparación al minuto el botón parpadearía entre un modo y otro sin que
   nadie haya tocado nada. */
function esFutura(d) {
  if (!d) return false;
  const soloDia = (f) => new Date(f.getFullYear(), f.getMonth(), f.getDate()).getTime();
  return soloDia(d) > soloDia(HOY);
}

/* De `AAAA-MM-DDTHH:MM` a Date. A mano y no con `new Date(texto)`: ese
   constructor interpreta la cadena con zona horaria y en Chile devuelve el día
   anterior, que en una fecha de entrega es exactamente el error que no se puede
   cometer. */
function fechaDelCampo(v) {
  if (!v) return null;
  const [f, h] = String(v).split('T');
  const [a, m, d] = String(f).split('-').map(Number);
  if (!a || !m || !d) return null;
  const [hh, mm] = String(h || '00:00').split(':').map(Number);
  return new Date(a, m - 1, d, hh || 0, mm || 0);
}

/* `datetime-local` necesita `AAAA-MM-DDTHH:MM` en hora local. Con toISOString()
   sale en UTC y en Chile el campo aparece con horas de diferencia. */
function isoFechaHora(d) {
  const p = (n) => String(n).padStart(2, '0');
  const ahora = new Date();
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
    'T' + p(ahora.getHours()) + ':' + p(ahora.getMinutes());
}

/* Lo que se ve al abrir la flecha en esta pantalla. El cliente pidió tres
   cosas y ninguna más: cuándo entró el auto, qué repuestos tiene y quién es el
   dueño. Por eso no se usa el desplegable general —que además trae los
   presupuestos y las OR—: entregando no se está mirando plata, se está
   confirmando que el auto que se lleva el señor es el suyo y está completo. */
function detalleEntrega(clave) {
  const o = ordenPorNumeroOId(clave);
  if (!o) return '<div class="vacio"><div class="texto">No se pudo leer esta orden.</div></div>';

  const dato = (k, v) => '<div class="dato"><span class="k">' + esc(k) + '</span><span class="v">' + v + '</span></div>';
  const pend = o.repuestos.filter((r) => !r.fechaBodega);

  const ingreso = '<div class="rejilla-datos">' +
    dato('Fecha de Ingreso', o.fechaIngreso
      ? esc(fFechaHora(o.fechaIngreso)) + ' <span style="color:var(--gris-2);font-weight:400">· ' +
        o.diasTotales + ' días</span>'
      : '<span style="color:var(--gris-2)">sin dato</span>') +
    dato('Fecha de Entrega', o.fechaCompromiso
      ? esc(fFechaHora(o.fechaCompromiso)) + ' <span style="color:var(--gris-2);font-weight:400">· programada</span>'
      : '<span style="color:var(--gris-2)">sin comprometer</span>') +
    '</div>';

  // El RUT, el teléfono y la dirección van enmascarados salvo que el rol tenga
  // `datos.rut_completo`, igual que en la ficha. Que la pantalla sea otra no
  // cambia quién puede ver un dato personal.
  const cliente = '<div class="rejilla-datos">' +
    dato('Cliente', esc(o.cliente)) +
    dato('RUT', esc(Modelo.velar(o.rut, 'datos.rut_completo'))) +
    dato('Teléfono', esc(Modelo.velar(o.telefono, 'datos.rut_completo') || '—')) +
    dato('Dirección', esc(Modelo.velar(o.direccion, 'datos.rut_completo', 'todo') || '—')) +
    '</div>';

  const repuestos = o.repuestos.length
    ? '<table class="grid anidada"><thead><tr>' +
        '<th>Repuesto</th><th class="num">Cant.</th><th>Paga</th><th>Pedido</th>' +
        '<th>En bodega</th><th>Entregado al área</th></tr></thead><tbody>' +
      o.repuestos.map((r) =>
        '<tr><td>' + esc(r.descripcion) + '</td>' +
        '<td class="num">' + (r.cantidad || 1) + '</td>' +
        '<td>' + esc(r.responsablePago || '—') + '</td>' +
        '<td class="num">' + (r.fechaSolicitud ? esc(fFechaHora(r.fechaSolicitud)) : '—') + '</td>' +
        '<td class="num">' + (r.fechaBodega ? esc(fFechaHora(r.fechaBodega))
          : '<span style="color:var(--rojo)">por llegar</span>') + '</td>' +
        '<td class="num">' + (r.fechaEntregaArea ? esc(fFechaHora(r.fechaEntregaArea)) : '—') + '</td></tr>').join('') +
      '</tbody></table>'
    : '<div class="texto" style="color:var(--gris-2)">Esta orden no lleva repuestos.</div>';

  return '<div class="detalle-ot">' +
    '<div class="bloque"><h4>Ingreso</h4>' + ingreso + '</div>' +
    '<div class="bloque"><h4>Cliente</h4>' + cliente + '</div>' +
    '<div class="bloque"><h4>Repuestos' +
      (pend.length ? ' <span class="et roja">' + pend.length + ' por llegar</span>' : '') +
      '</h4>' + repuestos + '</div>' +
    '</div>';
}

function vEntregaFicha(o) {
  const e = entregaEstado();
  const finales = Modelo.catalogo('estado').filter((x) => (x.alcanzable_en || []).indexOf('entrega') >= 0);
  const noOfrecidos = Modelo.catalogo('estado').filter((x) => x.es_final &&
    !(x.alcanzable_en || []).length);
  const pend = o.repuestos.filter((r) => !r.fechaBodega);

  return `
  <div class="panel" style="margin-top:11px">
    <div class="cab"><div><h2>OT ${o.numeroOT} · ${esc(o.patente)}</h2>
      <div class="desc">${esc(o.cliente)} · ${esc(o.compania)}</div></div>
      <span class="et ${esc(o.estadoClase)}">${esc(o.estadoNombre)}</span></div>
    <div class="cuerpo">
      <div class="ficha-rejilla">
        <fieldset class="bloque"><legend>1 · Salida y reingreso</legend>
          <div class="dato"><span class="k">Situación</span><span class="v">${o.enTaller
            ? '<span class="et verde">En el taller</span>' : '<span class="et ambar">Fuera del taller</span>'}</span></div>
          <div class="dato"><span class="k">Fecha de Salida</span><span class="v">${o.fechaSalida
            ? fFechaHora(o.fechaSalida) : '<span style="color:var(--gris-2)">todavía no salió</span>'}</span></div>
          <div class="dato"><span class="k">Días totales</span><span class="v"><strong>${o.diasTotales}</strong></span></div>
          <div class="dato"><span class="k">Reparación acumulada</span><span class="v">${o.diasReparacion}</span></div>
          <div class="dato"><span class="k">Estadía actual</span><span class="v">${o.diasEstadiaActual}</span></div>
          <div class="dato"><span class="k">Fuera del taller</span><span class="v">${o.diasFuera} días</span></div>
          <div style="margin-top:9px;display:flex;gap:8px">
            ${o.enTaller
              ? '<button class="btn secundario" data-ent-acc="salida">Sacar del taller</button>'
              : '<button class="btn" data-ent-acc="reingreso">Registrar reingreso</button>'}
          </div>
        </fieldset>

        <fieldset class="bloque"><legend>2 · Entrega</legend>
          <div class="rejilla-campos">
            <div class="campo"><label>Fecha de entrega <span style="color:var(--rojo)">*</span></label>
              <input type="date" id="ent-fecha" value="${isoFecha(HOY)}"></div>
            <div class="campo"><label>Tipo de entrega</label>
              <select id="ent-estado">${finales.map((x) => '<option value="' + esc(x.codigo) + '">' +
                esc(x.nombre) + '</option>').join('')}</select></div>
            <div class="campo" style="grid-column:1/-1"><label>Observaciones</label>
              <textarea rows="2" id="ent-obs">${esc(e.obs)}</textarea></div>
          </div>
          ${pend.length ? '<div class="nota" style="margin-top:8px">Esta orden tiene <strong>' +
            plural(pend.length, 'repuesto', 'repuestos') + ' sin llegar</strong>. Se puede entregar ' +
            'igual, pero conviene saberlo antes de facturar.</div>' : ''}
          <div style="margin-top:9px"><button class="btn" data-ent-acc="entregar">Entregar</button></div>
        </fieldset>
      </div>
    </div>
  </div>`;
}

function pEntrega() {
  /* Acá el desplegable se abre SÓLO con la flecha de la izquierda, y no hay
     doble clic que abra la orden en otra pestaña. Las dos cosas las pidió el
     cliente el 15-08-2026 y las dos son por lo mismo: esta tabla tiene campos
     en las celdas. Elegir el tipo de entrega desplegaba y contraía la fila, y
     al terminar de llenar los campos uno se iba a otra pestaña sin querer. La
     entrega se hace acá, en la fila, sin salir a ninguna parte. */
  dobleClicPorFilas('tr.fila[data-ot]', { soloFlecha: true, detalle: detalleEntrega });
  const e = entregaEstado();

  const volver = document.getElementById('ent-volver');
  if (volver) volver.addEventListener('click', () => {
    e.patente = ''; e.otId = null;
    rec().pantalla = 'menu';
    ir('recepcion');
  });

  const campo = document.getElementById('ent-patente');
  const buscar = () => { e.patente = campo.value.trim().toUpperCase(); e.otId = null; render(); };
  const btn = document.getElementById('ent-buscar');
  if (btn) btn.addEventListener('click', buscar);
  if (campo) campo.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') buscar(); });

  document.querySelectorAll('[data-ent-ot]').forEach((b) => b.addEventListener('click', () => {
    e.otId = b.dataset.entOt; render();
  }));

  /* El botón dice lo que va a hacer, y lo decide la fecha de su propia fila.
     Se recalcula al pintar y a cada cambio: si el recepcionista corre la fecha
     al jueves, el botón pasa a Programar antes de que lo apriete. */
  const sincronizar = (campoFecha) => {
    const b = document.querySelector('[data-ent-entregar="' + campoFecha.dataset.ot + '"]');
    if (!b) return;
    const futura = esFutura(fechaDelCampo(campoFecha.value));
    b.textContent = futura ? 'Programar' : 'Entregar';
    b.classList.toggle('secundario', futura);
  };
  document.querySelectorAll('[data-ent-campo="fecha"]').forEach((c) => {
    sincronizar(c);
    c.addEventListener('input', () => sincronizar(c));
    c.addEventListener('change', () => sincronizar(c));
  });

  /* Entregar —o programar— desde la propia fila. Los tres campos se leen de la
     fila del botón, no de un formulario aparte: pueden verse varias unidades a
     la vez y hay que entregar la que se apretó, no la última que se tocó. */
  document.querySelectorAll('[data-ent-entregar]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.entEntregar;
    const dame = (c) => {
      const el = document.querySelector('[data-ent-campo="' + c + '"][data-ot="' + id + '"]');
      return el ? el.value : '';
    };
    const cuando = fechaDelCampo(dame('fecha'));
    if (!cuando) return avisar({ ok: false, motivo: 'La fecha de entrega es obligatoria.' });

    /* Fecha de más adelante: se compromete, no se entrega. No se pide tipo de
       entrega porque no se está cerrando nada — el estado final se elige el
       día que el auto se va, que es cuando se sabe cómo se fue. */
    if (esFutura(cuando)) {
      return ejecutar(() => Modelo.programar_entrega(id, cuando, dame('obs')),
        'Entrega programada para el ' + fFechaHora(cuando) + '. La orden sigue abierta y el ' +
        'vehículo sigue en la torre: comprometer una fecha no es haber entregado.',
        () => render());
    }

    const tipo = dame('estado');
    if (!tipo) return avisar({ ok: false, motivo: 'Falta elegir el tipo de entrega. ' +
      'No es un detalle: define con qué estado se cierra la orden, y un estado final no se corrige después.' });

    ejecutar(() => Modelo.registrar_entrega(id, {
      estado: tipo, fecha: cuando, observacion: dame('obs')
    }), 'Unidad entregada. La orden quedó cerrada y el vehículo salió de la torre.',
      () => { e.otId = null; e.patente = ''; render(); });
  }));

  const obs = document.getElementById('ent-obs');
  if (obs) obs.addEventListener('input', () => { e.obs = obs.value; });

  document.querySelectorAll('[data-ent-acc]').forEach((b) => b.addEventListener('click', () => {
    const v = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    switch (b.dataset.entAcc) {
      case 'salida':
        return ejecutar(() => Modelo.registrar_salida(e.otId, 'espera_repuesto'),
          'Salida registrada con fecha. El reloj de reparación quedó detenido.');
      case 'reingreso':
        return ejecutar(() => Modelo.registrar_reingreso(e.otId),
          'Reingreso registrado. La reparación se reanudó; la estadía actual partió de cero.');
      case 'entregar': {
        const f = v('ent-fecha');
        if (!f) return avisar({ ok: false, motivo: 'La fecha de entrega es obligatoria.' });
        const [a, m, d] = f.split('-').map(Number);
        return ejecutar(() => Modelo.registrar_entrega(e.otId, {
          estado: v('ent-estado'), fecha: new Date(a, m - 1, d), observacion: v('ent-obs')
        }), 'Orden entregada. Fecha de salida escrita y los relojes conservados en el Histórico.',
          () => { e.otId = null; e.obs = ''; render(); });
      }
    }
  }));
}
