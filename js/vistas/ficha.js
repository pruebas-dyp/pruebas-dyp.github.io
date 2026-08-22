/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   LA FICHA DE LA ORDEN — el centro del sistema.

   Es la única pantalla que reúne todo: del original cuelgan OCHO pantallas y
   ninguna otra las junta. Por eso vale la pena que tenga dirección propia:
   se le manda el enlace de una orden a quien sea en vez de explicarle dónde
   buscarla.

   La cabecera copia los diez campos del original, en sus dos bloques y en su
   orden — incluido `Fecha de salida`, que allá es un campo muerto.

   🔴 `Fecha de salida` está VACÍA en el sistema actual incluso en órdenes ya
      entregadas. Es el dato que falta para reconstruir el ciclo de salida y
      reingreso, y por eso el contador de días se puede reiniciar sin que nadie
      lo note. Acá sale de `ot_estadia` y por eso siempre está.
   ──────────────────────────────────────────────────────────────────────── */

/* Las pestañas de la ficha, cada una con el permiso que pide. Sin permiso no
   se dibuja: no está gris ni avisa al apretarla, no está.

   `ficha` y `etapas` no piden nada porque son el mínimo para trabajar el auto
   —qué vehículo es y en qué va—, pero lo que MUESTRAN cambia según el rol: sin
   `ficha.completa` la pestaña Ficha no trae ni al cliente ni a la compañía ni
   el siniestro. */
const FICHA_TABS = [
  { id: 'ficha',      n: 'Ficha' },
  { id: 'etapas',     n: 'Etapas' },
  { id: 'historial',  n: 'Historial',    permiso: 'ficha.completa' },
  { id: 'bitacora',   n: 'Bitácora',     permiso: 'ficha.completa' },
  { id: 'repuestos',  n: 'Repuestos',    permiso: 'repuesto.ver' },
  { id: 'fotos',      n: 'Fotografías',  permiso: 'foto.ver' }
];

const tabsVisibles = () => FICHA_TABS.filter((t) => !t.permiso || Modelo.puede(t.permiso));

function fichaEstado() {
  if (!ui.ficha) {
    ui.ficha = {
      tab: 'ficha', modoEtapas: null,
      // Los dos arrancan sin elegir, como el original: `Seleccionar`.
      bitacora: { asunto: null, destinatario: null, mensaje: '' }
    };
  }
  // Si la cuenta no alcanza la pestaña donde quedó —se cambió de sesión en la
  // misma pestaña del navegador— vuelve a la primera que sí puede ver.
  if (!tabsVisibles().some((t) => t.id === ui.ficha.tab)) ui.ficha.tab = 'ficha';
  return ui.ficha;
}

/* Lo que la DIRECCIÓN pide: en qué pestaña abrir la orden y en qué modo dentro
   de ella. Es como el listado de Taller manda a asignar etapas —su botón dice
   `Asignar etapas` y tiene que abrir eso, tenga la orden etapas o no—.

   Se aplica al ABRIR la orden y no en cada repintado: si no, apretar cualquier
   otra pestaña rebotaría a Etapas para siempre, porque el ancla sigue diciendo
   lo mismo. */
function fichaAplicarDireccion() {
  const f = fichaEstado();
  const tab = typeof PARAM_TAB === 'function' ? PARAM_TAB() : null;
  const modo = typeof PARAM_MODO === 'function' ? PARAM_MODO() : null;
  if (tab && FICHA_TABS.some((t) => t.id === tab)) f.tab = tab;
  if (modo === 'asignar' || modo === 'finalizar') f.modoEtapas = modo;
  return f;
}

function refrescarFicha() {
  if (ui.registroOT) modoRegistro(ui.registroOT); else render();
}

/* Las OCHO pantallas que cuelgan de la ficha en el sistema actual, con su
   rótulo literal. Las que todavía no se construyen se rotulan como tales:
   un botón que no hace nada y no lo dice es peor que no tenerlo. */
const FICHA_ENLACES = [
  { rot: 'Ver recepción',                   imprimir: 'recepcion', permiso: 'ficha.completa' },
  // El impreso del presupuesto es el documento comercial —cliente, RUT y
  // valores—, así que pide `presupuesto.montos`. Quien solo tiene
  // `presupuesto.ver` lee las líneas sin precio en la ficha.
  { rot: 'Ver Presupuesto',                 imprimir: 'presupuesto', permiso: 'presupuesto.montos' },
  { rot: 'Ver repuestos',                   tab: 'repuestos', permiso: 'repuesto.ver' },
  { rot: 'Ver/Subir Documentos o imágenes', vista: 'documentos', permiso: 'documento.ver' },
  { rot: 'Ver Fotografías',                 tab: 'fotos', permiso: 'foto.ver' },
  { rot: 'Editar Recepción',                tab: null, tanda: 8, permiso: 'ot.editar',
    nota: 'la recepción se edita desde su propia pantalla; editar una ya guardada exige política de versiones' },
  { rot: 'Agregar OR',                      vista: 'presupuesto', permiso: 'presupuesto.crear' },
  { rot: 'Bodega de esta orden',            vista: 'bodega', permiso: 'repuesto.cargar' },
  { rot: 'Bitácora',                        tab: 'bitacora', permiso: 'ficha.completa' }
];

function vFichaOT(o) {
  const f = fichaEstado();
  const completa = Modelo.puede('ficha.completa');
  const campoCab = (k, v) => '<div class="dato"><span class="k">' + esc(k) + '</span><span class="v">' + v + '</span></div>';

  const cuerpo = {
    ficha: fichaResumen, etapas: vEtapas, historial: fichaHistorial,
    bitacora: fichaBitacora, repuestos: fichaRepuestos, fotos: fichaFotos
  }[f.tab](o);

  const enlaces = FICHA_ENLACES.filter((l) => !l.permiso || Modelo.puede(l.permiso));

  return `
  <div class="panel">
    <div class="cab">
      <div><h2>${ico('auto', 'g')}Orden N° ${o.numeroOT} · <span class="patente">${esc(o.patente)}</span></h2>
        <div class="desc">${esc([o.marca, o.modelo].filter(Boolean).join(' '))}${o.anio ? ' · ' + o.anio : ''}</div></div>
      <span class="et ${esc(o.estadoClase)}">${esc(o.estadoNombre)}</span>
    </div>
    <div class="cuerpo">
      <div class="ficha-rejilla">
        <fieldset class="bloque"><legend>${completa ? 'Recepción' : 'El vehículo'}</legend>
          ${campoCab('Fecha de Ingreso', fFechaHora(o.fechaIngreso))}
          ${campoCab('Fecha de Salida', o.fechaSalida
            ? fFechaHora(o.fechaSalida) + ' <span class="et verde">registrada</span>'
            : (o.enTaller ? '<span style="color:var(--gris-2)">el vehículo está adentro</span>'
                          : '<span class="et roja">sin registrar</span>'))}
          ${campoCab('Patente', '<span class="patente">' + esc(o.patente) + '</span>')}
          ${completa ? campoCab('Tipo de ingreso', esc(o.origenIngresoNombre || '—')) : ''}
          ${completa ? campoCab('N° de Siniestro', esc(o.siniestro || '—')) : ''}
          ${completa ? campoCab('Nombre Cliente', esc(o.cliente)) : campoCab('Color', esc(o.color || '—'))}
          ${campoCab('Marca/Modelo', esc([o.marca, o.modelo].filter(Boolean).join(' / ') || '—'))}
        </fieldset>
        <fieldset class="bloque"><legend>Situación</legend>
          ${campoCab('Estado del vehículo', '<span class="et ' + esc(o.estadoClase) + '">' + esc(o.estadoNombre) + '</span>')}
          ${campoCab('Etapa actual', o.etapa
            ? '<i class="punto" style="background:' + etapaPorCodigo(o.etapa).color + '"></i>' + esc(o.etapaNombre)
            : '<span class="et gris">Pendiente</span>')}
          ${campoCab('Encargado actual', o.asignado ? esc(o.asignado) : '<span class="et gris">Sin Asignar</span>')}
          ${completa ? campoCab('Alerta', o.alertas.length
            ? o.alertas.map((a) => '<span class="et gris" title="' + esc(a.asunto) + '">' + esc(a.letra) + '</span>').join(' ')
            : '<span style="color:var(--gris-2)">—</span>') : ''}
        </fieldset>
      </div>

      ${enlaces.length ? `<div class="acciones-ficha" style="margin-top:10px">
        ${enlaces.map((l) => {
          if (l.tab) return '<button class="btn secundario" data-fichatab="' + l.tab + '">' + esc(l.rot) + '</button>';
          if (l.imprimir) return '<button class="btn secundario" data-imprimir="' + l.imprimir +
            '">' + ico('imprimir') + esc(l.rot) + '</button>';
          if (l.vista) return '<button class="btn secundario" data-irvista="' + l.vista +
            '" data-irot="' + esc(o.numeroOT) + '">' + esc(l.rot) + '</button>';
          return '<button class="btn secundario" data-pendiente="' + esc(l.rot) + '|' + l.tanda +
            (l.nota ? '|' + esc(l.nota) : '') + '" style="opacity:.65">' + esc(l.rot) +
            ' <span class="et gris">pendiente</span></button>';
        }).join('')}
      </div>` : ''}
    </div>
  </div>

  <div class="tabs" style="margin-bottom:10px">
    ${tabsVisibles().map((t) => '<button type="button" class="' + (t.id === f.tab ? 'activo' : '') +
      '" data-fichatab="' + t.id + '">' + esc(t.n) + '</button>').join('')}
  </div>

  ${cuerpo}
`;
}

/* ── Pestaña · Ficha completa ──────────────────────────────────────────── */

/* Lo que se autorizó reparar, sin un solo peso a la vista. Es lo que el
   operario necesita y lo único del presupuesto que le corresponde: saber si
   la puerta se cambia o se repara, y cuántas. Sin esto el permiso
   `presupuesto.ver` no tenía dónde ejercerse —el módulo de presupuestos pide
   `presupuesto.crear`— y era letra muerta. */
const PROCESO_LINEA = { cambio: 'Cambio de pieza', reparar: 'Reparación', externo: 'Servicio externo' };

function fichaTrabajoAutorizado(o) {
  const lineas = o.presupuestos.reduce((a, p) => a.concat(p.lineas || []), []);
  if (!o.presupuestos.length) {
    return '<fieldset class="bloque"><legend>Trabajo autorizado</legend>' +
      '<div class="pie-nota">Este vehículo todavía no tiene presupuesto. ' +
      'Hasta que lo tenga, no hay trabajo autorizado que hacer.</div></fieldset>';
  }
  return '<fieldset class="bloque"><legend>Trabajo autorizado</legend>' +
    '<div class="grid-envoltorio"><table class="grid">' +
    '<thead><tr><th style="width:56px">Cant.</th><th>Qué hay que hacer</th><th style="width:34%">Proceso</th></tr></thead>' +
    '<tbody>' + (lineas.length ? lineas.map((l) =>
      '<tr><td class="num">' + (l.cantidad || 1) + '</td>' +
      '<td>' + esc(l.descripcion || '—') + '</td>' +
      '<td><span class="et gris">' + esc(PROCESO_LINEA[l.proceso] || l.proceso || '—') + '</span></td></tr>').join('')
      : '<tr><td colspan="3"><div class="vacio"><div class="titulo">El presupuesto está sin líneas</div></div></td></tr>') +
    '</tbody></table></div>' +
    '<div class="pie-nota">Los valores no se muestran en este perfil.</div></fieldset>';
}

/* El desglose del checklist en una línea. Solo aparecen los estados que tienen
   algo: un "0 dañados" ocupa lugar y no dice nada. Si el inventario viene vacío
   —una OT creada desde otra pantalla— se dice, no se muestra un cero. */
/* Las piezas que quedaron rayadas en el croquis, sin repetir. Desde el
   15-08-2026 el daño no lleva tipo —se raya y se cuenta todo en una sola
   observación— así que lo que la ficha puede decir es DÓNDE, que es el dato que
   el croquis clasifica solo. */
function fichaPiezasMarcadas(danos) {
  const piezas = [];
  danos.forEach((d) => {
    const n = d.zonaNombre || 'Sin zona';
    if (piezas.indexOf(n) < 0) piezas.push(n);
  });
  return piezas.join(' · ');
}

function fichaInventario(inv) {
  if (!inv || !inv.length) return '<span class="et gris">Sin datos</span>';
  const partes = Modelo.inventarioEstados().map((e) => {
    const n = inv.filter((i) => i.estado === e.codigo).length;
    return n ? '<span class="et ' + e.clase + '">' + n + ' ' + esc(e.nombre.toLowerCase()) + '</span>' : '';
  }).filter(Boolean);
  return partes.join(' ') + ' <span class="et gris">de ' + inv.length + '</span>';
}

function fichaResumen(o) {
  const dato = (k, v) => '<div class="dato"><span class="k">' + esc(k) + '</span><span class="v">' + v + '</span></div>';
  const pend = o.repuestos.filter((r) => !r.fechaBodega);
  const fuera = o.fueraDeTaller;
  const completa = Modelo.puede('ficha.completa');
  const montos = Modelo.puede('presupuesto.montos');

  /* La ficha recortada: el vehículo, los relojes, lo que falta de bodega y lo
     que se autorizó reparar. Ni cliente, ni compañía, ni siniestro, ni pesos.
     Es todo lo que hace falta para trabajar el auto — y ni un dato más, que es
     justamente lo que se pidió corregir. */
  if (!completa) {
    return `
    <div class="panel"><div class="cuerpo"><div class="ficha-rejilla">
      <fieldset class="bloque"><legend>Vehículo</legend>
        ${dato('Patente', '<span class="patente">' + esc(o.patente) + '</span>')}
        ${dato('Marca y modelo', esc([o.marca, o.modelo].filter(Boolean).join(' ') || '—'))}
        ${dato('Año', o.anio || '—')}
        ${dato('Color', esc(o.color || '—'))}
        ${dato('Piezas marcadas', o.danos.length
          ? esc(fichaPiezasMarcadas(o.danos))
          : '<span style="color:var(--gris-2)">ninguna</span>')}
      </fieldset>

      <fieldset class="bloque"><legend>Cómo va</legend>
        ${dato('Etapa actual', o.etapa
          ? '<i class="punto" style="background:' + etapaPorCodigo(o.etapa).color + '"></i>' + esc(o.etapaNombre)
          : '<span class="et gris">Pendiente</span>')}
        ${dato('Encargado', o.asignado ? esc(o.asignado) : '<span class="et gris">Sin asignar</span>')}
        ${dato('Días en reparación', o.diasKpi + ' de ' + META_DIAS_REPARACION +
          (o.sobreMeta ? ' <span class="et roja">sobre la meta</span>' : ''))}
        ${dato('Dónde está', fuera
          ? '<span class="et ambar">fuera de taller</span>'
          : '<span class="et verde">en taller</span>')}
        ${dato('Repuestos', pend.length
          ? '<span class="et ambar">faltan ' + pend.length + ' de ' + o.repuestos.length + '</span>'
          : (o.repuestos.length ? '<span class="et verde">todos llegaron</span>' : 'no requiere'))}
      </fieldset>
    </div>
    <div style="margin-top:11px">${Modelo.puede('presupuesto.ver') ? fichaTrabajoAutorizado(o) : ''}</div>
    </div></div>`;
  }

  const hitos = ETAPAS.map((et) => {
    const a = o.etapasAsignadas.find((x) => x.codigo === et.codigo);
    const cls = !a ? '' : a.finalizada ? 'hecho' : 'actual';
    return '<div class="hito ' + cls + '" title="' + esc(et.nombre) +
      (a ? (a.finalizada ? ' · cerrada' : ' · abierta') : ' · no asignada') + '"></div>';
  }).join('');

  return `
  <div class="panel"><div class="cuerpo"><div class="ficha-rejilla">
    <fieldset class="bloque"><legend>Vehículo</legend>
      ${dato('Patente', '<span class="patente">' + esc(o.patente) + '</span>')}
      ${dato('Marca y modelo', esc([o.marca, o.modelo].filter(Boolean).join(' ') || '—'))}
      ${dato('Año', o.anio || '—')}
      ${dato('Color', esc(o.color || '—'))}
      ${/* El VIN es obligatorio en la recepción desde el 16-08-2026: se sacó la
           casilla «No viene a la vista» y con ella el estado «pendiente» que
           esta ficha mostraba. Un vehículo sin VIN sólo puede venir de antes. */''}
      ${dato('VIN', esc(o.vin || '—'))}
      ${dato('Kilometraje', fKm(o.recepcion && o.recepcion.km))}
      ${dato('Combustible', fComb(o.recepcion && o.recepcion.combustible))}
      ${dato('Daños marcados', o.danos.length + (o.danos.length ? ' <span class="et gris">del vehículo, no de la orden</span>' : ''))}
      ${/* 🔶 EL INVENTARIO, DESGLOSADO (15-08-2026). Decía "24 de 28 ítems", que
           con cuatro estados no dice nada: mezclaba en un solo número lo que
           está, lo que no está, lo que llegó roto y lo que nadie alcanzó a
           mirar. **"Dañado" y "no presente" son reclamos distintos**, y el que
           quedó sin verificar no es ninguno de los dos. */''}
      ${dato('Inventario', fichaInventario(o.inventario))}
    </fieldset>

    <fieldset class="bloque"><legend>Cliente y siniestro</legend>
      ${dato('Cliente', esc(o.cliente))}
      ${dato('RUT', '<span title="' + (Modelo.puede('datos.rut_completo')
        ? 'Se ve completo porque el rol tiene el permiso'
        : 'Enmascarado por rol: se garantiza en la base, no acá') + '">' +
        esc(Modelo.velar(o.rut, 'datos.rut_completo')) + '</span>')}
      ${dato('Teléfono', esc(Modelo.velar(o.telefono, 'datos.rut_completo')))}
      ${dato('Dirección', '<span title="Enmascarado por rol">' +
        esc(Modelo.velar(o.direccion, 'datos.rut_completo', 'todo')) + '</span>')}
      ${dato('Viene por', esc(o.origenIngresoNombre || '—'))}
      ${o.siniestro ? dato('Compañía', esc(o.compania)) + dato('Siniestro', esc(o.siniestro)) +
        dato('Deducible', fMonto(o.deducible)) + dato('Liquidador', esc(o.liquidador || '—')) : ''}
      ${dato('Prioridad', o.prioridad === 'express'
        ? '<span class="et roja">Express</span>' : '<span class="et gris">Normal</span>')}
    </fieldset>

    <fieldset class="bloque"><legend>Los tres relojes</legend>
      ${dato('Días desde el ingreso', '<strong>' + o.diasTotales + '</strong> · nunca se reinicia')}
      ${dato('Reparación acumulada', o.diasReparacion + ' · se reanuda al reingresar')}
      ${dato('Estadía actual', fuera
        ? '<span style="color:var(--gris)">0 · detenido</span>'
        : o.diasEstadiaActual + ' · vuelve a cero al reingresar')}
      ${dato('Contra la meta', o.sobreMeta
        ? '<span style="color:var(--ambar)">' + o.diasKpi + ' de ' + META_DIAS_REPARACION + ' · sobre la meta</span>'
        : o.diasKpi + ' de ' + META_DIAS_REPARACION)}
      ${fuera ? dato('Fuera de taller hace', '<span style="color:var(--ambar)">' + o.diasFuera + ' días</span>') : ''}
      ${dato('Fecha de Ingreso', fFechaHora(o.fechaIngreso))}
      ${dato('Fecha de Entrega probable', fFechaHora(o.fechaCompromiso))}
      ${o.fechaEntrega ? dato('Fecha de Entrega real', fFechaHora(o.fechaEntrega)) : ''}
      <div class="linea-tiempo">${hitos}</div>
    </fieldset>

    <fieldset class="bloque"><legend>Repuestos y presupuestos</legend>
      ${dato('Repuestos pendientes', pend.length
        ? '<span style="color:var(--rojo)">' + pend.length + ' de ' + o.repuestos.length + '</span>'
        : (o.repuestos.length ? 'Todos recibidos' : 'No requiere'))}
      ${o.presupuestos.map((p) => '<div class="dato"><span class="k">OR ' + esc(p.numeroOR) + '</span>' +
        '<span class="v">' + (montos ? fMonto(p.total) : '<span class="et gris">sin monto</span>') +
        ' <span class="et ' + ESTADO_PRESUPUESTO[p.estado].clase +
        '">' + esc(ESTADO_PRESUPUESTO[p.estado].txt) + '</span></span></div>').join('')}
      ${montos
        ? dato('Total de la OT', '<strong>' + fMonto(totalOT(o)) + '</strong>')
        : dato('Total de la OT', '<span class="et gris">no visible en este perfil</span>')}
    </fieldset>
  </div></div></div>`;
}

/* ── Pestaña · Historial ───────────────────────────────────────────────── */

const TIPO_EVENTO = {
  etapa:        { txt: 'Completado',   clase: 'verde' },
  estado:       { txt: 'Cambio Estado', clase: 'azul' },
  modificacion: { txt: 'Modificación', clase: 'gris' },
  salida:       { txt: 'Salida',       clase: 'ambar' },
  reingreso:    { txt: 'Reingreso',    clase: 'verde' }
};

function fichaHistorial(o) {
  const eventos = Modelo.historialDe(o.id);
  return `
  <div class="panel">
    <div class="cab"><div><h2>${ico('reloj', 'g')}Historial <span class="patente">${esc(o.patente)}</span></h2>
      <div class="desc">Qué pasó, cuándo y quién. Al segundo, igual que el original</div></div>
      <span class="et gris">${plural(eventos.length, 'evento', 'eventos')}</span></div>
    <div class="grid-envoltorio"><table class="grid">
      <thead><tr><th>Fecha</th><th>Etapa</th><th>Estado</th><th>Encargado</th><th>Usuario</th></tr></thead>
      <tbody>${eventos.length ? eventos.map((e) => {
        const t = TIPO_EVENTO[e.tipo] || { txt: e.tipo, clase: 'gris' };
        return '<tr><td class="num">' + fFechaHora(e.fecha) + '</td>' +
          '<td>' + esc(e.tipo === 'etapa' ? e.etapa : e.detalle) + '</td>' +
          '<td><span class="et ' + t.clase + '">' + esc(t.txt) + '</span></td>' +
          '<td>' + esc(e.usuario) + '</td><td>' + esc(e.usuario) + '</td></tr>';
      }).join('') : '<tr><td colspan="5"><div class="vacio"><div class="titulo">Sin eventos todavía</div></div></td></tr>'}</tbody>
    </table></div>
  </div>`;
}

/* ── Pestaña · Bitácora ──────────────────────────────────────────────────
   Se pinta en su pestaña y también **debajo de la pantalla de etapas**, que es
   donde la tiene el sistema actual: se asignan las etapas y ahí mismo se le
   escribe a bodega que faltan repuestos, sin cambiar de pantalla. Es el mismo
   panel, no una copia. */

function pFichaBitacora(o) {
  const f = fichaEstado();
  const enviar = document.getElementById('bit-enviar');
  if (enviar) enviar.addEventListener('click', () => {
    const asunto = document.getElementById('bit-asunto').value;
    const dest = document.getElementById('bit-dest').value;
    const msg = document.getElementById('bit-mensaje').value;

    /* Los dos desplegables arrancan en `Seleccionar`, así que hay que decir
       cuál falta. Sin esto el mensaje se iba a quien quedara primero en la
       lista —y el primero de 24 destinatarios no es una elección de nadie. */
    if (!dest) return avisar({ ok: false, motivo: 'Falta el destinatario. La bitácora le escribe A alguien: ' +
      'es lo que enciende la bandera en la pantalla de esa persona.' });
    if (!asunto) return avisar({ ok: false, motivo: 'Falta el asunto. Es la letra que se enciende en la ' +
      'columna Alerta de la Torre, así que sin él el mensaje no avisa nada.' });

    f.bitacora.asunto = asunto;
    ejecutar(() => Modelo.escribir_bitacora(o.id, { asunto_id: asunto, mensaje: msg, destinatario_id: dest }),
      'Mensaje escrito. La bandera ya está encendida en la Torre.');
  });
  document.querySelectorAll('[data-apagar]').forEach((b) => b.addEventListener('click', () =>
    ejecutar(() => Modelo.apagar_alerta(b.dataset.apagar), 'Alerta apagada.')));
}

function fichaBitacora(o) {
  const f = fichaEstado();
  const msjs = Modelo.bitacoraDe(o.id);
  const asuntos = Modelo.catalogo('asunto_bitacora').filter((a) => a.vigente !== false);
  const gente = Modelo.destinatarios();

  return `
  <div class="panel">
    <div class="cab"><div><h2>${ico('info', 'g')}Bitácora de observaciones</h2>
      <div class="desc">Cada mensaje enciende la bandera de su asunto en la Torre</div></div>
      <span>${o.alertas.length
        ? o.alertas.map((a) => '<span class="et gris" title="' + esc(a.asunto) + '">' + esc(a.letra) + '</span>').join(' ')
        : '<span class="et gris">sin alertas</span>'}</span></div>
    <div class="cuerpo">
      <div class="rejilla-campos">
        ${/* `De` decía «Administrador» a secas, entrara quien entrara. Un
             mensaje de bitácora queda firmado, y firmarlo con un cargo que no
             es el tuyo es peor que no mostrarlo. */''}
        <div class="campo"><label>De</label><input value="${esc(quienMira())}" disabled></div>
        <div class="campo"><label>Para</label>
          <select id="bit-dest"><option value="">Seleccionar</option>${gente.map((p) =>
            '<option value="' + esc(p.id) + '"' + (f.bitacora.destinatario === p.id ? ' selected' : '') +
            '>' + esc(p.nombre) + '</option>').join('')}</select></div>
        <div class="campo"><label>Asunto</label>
          <select id="bit-asunto"><option value="">Seleccionar</option>${asuntos.map((a) =>
            '<option value="' + esc(a.id) + '"' +
            (f.bitacora.asunto === a.id ? ' selected' : '') + '>' + esc(a.nombre) +
            ' (' + esc(a.nombre.charAt(0).toUpperCase()) + ')</option>').join('')}</select>
          <span class="ayuda">Los seis, acá y en la pantalla de etapas</span></div>
        <div class="campo" style="grid-column:1/-1"><label>Mensaje</label>
          <textarea rows="2" id="bit-mensaje" placeholder="Llamada al cliente, respuesta del liquidador, lo que sea"></textarea></div>
        <div class="campo"><label>&nbsp;</label><button class="btn" id="bit-enviar">Escribir en la bitácora</button></div>
      </div>

      <div class="grid-envoltorio" style="margin-top:12px"><table class="grid">
        <thead><tr><th>Fecha</th><th>Destinatario</th><th>Asunto</th><th>Mensaje</th><th>Alerta</th><th></th></tr></thead>
        <tbody>${msjs.length ? msjs.map((m) =>
          '<tr><td class="num">' + fFechaHora(m.fecha) + '</td>' +
          '<td>' + esc(m.destinatario) + '</td>' +
          '<td><span class="et gris">' + esc(m.asunto) + '</span></td>' +
          '<td>' + esc(m.mensaje) + '</td>' +
          '<td>' + (m.apagada
            ? '<span style="color:var(--gris-2)">apagada</span>'
            : '<span class="cod">' + esc(String(m.asunto).charAt(0).toUpperCase()) + '</span>') + '</td>' +
          '<td>' + (m.apagada ? '' : '<button class="btn secundario" data-apagar="' + esc(m.id) + '">Apagar alerta</button>') +
          '</td></tr>').join('')
          : '<tr><td colspan="6"><div class="vacio"><div class="titulo">Sin mensajes</div></div></td></tr>'}</tbody>
      </table></div>
    </div>
  </div>`;
}

/* ── Pestaña · Repuestos ───────────────────────────────────────────────── */

function fichaRepuestos(o) {
  /* Quien puede mover los hitos es quien puede cargar repuestos: bodega y
     administración. El resto ve las fechas y no las casillas — que es lo que
     esta pestaña mostraba para todos hasta hoy. */
  const puedeBodega = Modelo.puede('repuesto.cargar');
  return `
  <div class="panel">
    <div class="cab"><div><h2>${ico('repuesto', 'g')}Repuestos Presupuesto Orden N° ${esc(o.presupuestos.length ? o.presupuestos[0].numeroOR : o.numeroOT)}</h2>
      <div class="desc">El ciclo completo de la pieza: llegó a bodega, se retira con vale,
        se entrega al área — y si no sirve, se devuelve y el pedido vuelve a correr</div></div></div>
    <div class="grid-envoltorio"><table class="grid">
      <thead><tr><th>Cant.</th><th>Descripción</th><th>Paga</th><th>Solicitado</th>
        <th style="width:88px">Llegó a bodega</th><th style="width:88px">Entregado</th>
        <th>Demoró</th><th>Vale y devolución</th></tr></thead>
      <tbody>${o.repuestos.length ? o.repuestos.map((r) =>
        '<tr><td class="num">' + r.cantidad + '</td>' +
        '<td>' + esc(r.descripcion) + '</td>' +
        '<td>' + (r.responsablePago
          ? '<span class="et ' + (r.pagaTaller ? 'roja' : 'gris') + '">' + esc(r.responsablePago) + '</span>'
          : '<span class="et roja">sin declarar</span>') + '</td>' +
        '<td class="num">' + (r.fechaSolicitud ? fFechaHora(r.fechaSolicitud) : '—') + '</td>' +
        /* 🔴 EL FLUJO SE OPERA DESDE ACÁ (16-08-2026, Marco, tercera vez que
           lo pide). Esta es la pestaña que mira el desabollador cuando va a
           buscar su pieza: leer la fecha no le sirve, necesita marcar que
           llegó y que se la llevó. Los mismos controles de Bodega y el mismo
           enganche, así que las dos pantallas no pueden divergir.

           «Entregado» sigue bloqueado hasta que esté el vale de retiro: es lo
           que comprueba quién se llevó la pieza, y lo dice en el globo antes
           de que la casilla se aprete. */
        '<td style="text-align:center">' + (puedeBodega
          ? '<input type="checkbox" data-ok="' + esc(r.id) + '"' + (r.fechaBodega ? ' checked' : '') +
            ' title="' + (r.fechaBodega ? 'Llegó el ' + esc(fFechaHora(r.fechaBodega))
                                        : 'Marcar cuando llegue') + '">'
          : (r.fechaBodega ? fFechaHora(r.fechaBodega) : '<span class="et ambar">pendiente</span>')) + '</td>' +
        '<td style="text-align:center">' + (puedeBodega
          ? '<input type="checkbox" data-ent="' + esc(r.id) + '"' +
            (r.fechaEntregaArea ? ' checked' : '') +
            (r.fechaBodega && (r.valeMediaId || r.fechaEntregaArea) ? '' : ' disabled') +
            ' title="' + (r.fechaEntregaArea ? 'Entregado el ' + esc(fFechaHora(r.fechaEntregaArea))
              : (!r.fechaBodega ? 'No se puede entregar lo que todavía no llegó'
                : (!r.valeMediaId ? 'Falta subir el vale de retiro'
                  : 'Marcar al entregarlo al área'))) + '">'
          : (r.fechaEntregaArea ? fFechaHora(r.fechaEntregaArea) : '—')) + '</td>' +
        '<td class="num">' + (r.diasEnLlegar === null ? '—' : plural(r.diasEnLlegar, 'día', 'días')) + '</td>' +
        '<td>' + (puedeBodega ? accionesRepuesto(r) : '') + '</td></tr>').join('')
        : '<tr><td colspan="8"><div class="vacio"><div class="titulo">Sin repuestos cargados</div></div></td></tr>'}</tbody>
    </table></div>
  </div>`;
}

/* ── Pestaña · Fotografías ─────────────────────────────────────────────── */

function fichaFotos(o) {
  const todas = Modelo.mediaDe(o.id);
  const porMomento = {};
  todas.forEach((m) => { (porMomento[m.momento] = porMomento[m.momento] || []).push(m); });
  const res = Media.resumen(todas.filter((m) => m.momento !== 'firma'));

  const ROTULOS = { ingreso: 'Imágenes de ingreso', proceso: 'Imágenes por etapa',
                    entrega: 'Imágenes de entrega', firma: 'Firma del cliente' };

  return `
  <div class="panel">
    <div class="cab"><div><h2>${ico('camara', 'g')}Recepción N° ${o.numeroOT}</h2>
      <div class="desc">Las fotos van por etapa, no solo al ingreso</div></div>
      ${res.cantidad ? '<span class="et gris">' + plural(res.cantidad, 'foto', 'fotos') + ' · ' +
        Media.fPeso(res.bytesOriginal) + ' → ' + Media.fPeso(res.bytes) + '</span>' : ''}</div>
    <div class="cuerpo">
      ${Modelo.puede('foto.cargar') ? `
      <fieldset class="bloque" style="margin-bottom:12px">
        <legend>Cargar fotografías a esta orden</legend>
        <div class="rejilla-campos" style="margin-bottom:9px">
          <div class="campo"><label>¿De qué momento son?</label>
            <select id="ficha-momento">
              <option value="ingreso">Ingreso del vehículo</option>
              <option value="proceso" selected>Avance en el taller</option>
              <option value="entrega">Entrega</option>
              <option value="documento">Documento (guía, factura, orden de compra)</option>
            </select>
            <span class="ayuda">Las fotos van por etapa, no solo al ingreso</span></div>
        </div>
        ${zonaFotos({ id: 'fichafoto', fotos: [], titulo: 'Soltar las fotos acá' })}
      </fieldset>` : ''}

      ${Object.keys(porMomento).length
        ? Object.keys(porMomento).map((k) => '<fieldset class="bloque" style="margin-bottom:10px">' +
            '<legend>' + esc(ROTULOS[k] || k) + ' (' + porMomento[k].length + ')</legend>' +
            '<div class="fotos-rejilla">' +
            porMomento[k].map((m) => '<figure class="foto-tarjeta">' +
              '<img data-media="' + esc(m.id) + '" alt="' + esc(m.nombre) + '">' +
              (Modelo.puede('foto.cargar')
                ? '<button class="quitar-foto" data-borrar-media="' + esc(m.id) + '" title="Quitar">&times;</button>' : '') +
              '<figcaption class="pie-foto"><b>' + esc(m.nombre) + '</b>' +
              '<span class="cod">' + (m.sin_comprimir
                ? Media.fPeso(m.bytes) + ' · sin comprimir'
                : Media.fPeso(m.bytes_original) + ' → ' + Media.fPeso(m.bytes)) + '</span>' +
              '</figcaption></figure>').join('') +
            '</div></fieldset>').join('')
        : '<div class="vacio"><div class="titulo">Esta orden no tiene imágenes todavía</div>' +
          '<div class="texto">' + (Modelo.puede('foto.cargar')
            ? 'Súbelas arriba. En el sistema real hay ~47 por orden.'
            : 'Este perfil no carga fotografías.') + '</div></div>'}
    </div>
  </div>`;
}

/* 🔶 SIN el panel de ACCIONES (16-08-2026, Marco: «eliminar esto de
   acciones, no sirve»). Eran tres cosas que ya tienen su lugar propio:
   sacar del taller y entregar viven en Recepcion -> Entregar Unidad, y el
   estado se cambia desde la torre. Tenerlas tambien al pie de la ficha era
   un cuarto camino para lo mismo, y con un desplegable de entrega —
   «Despachada por Perdida Total»— asomando en una orden que recien entra. */

/* ── Cableado de la ficha ──────────────────────────────────────────────── */

function pFichaOT(o) {
  const f = fichaEstado();

  /* El ciclo del repuesto se opera desde la pestaña Repuestos, con los mismos
     controles y el mismo enganche que Bodega. Está declarado en `bodega.js`
     —una sola vez, para que las dos pantallas no puedan divergir— y acá se
     engancha pasándole la orden abierta, que es a quien se le cuelga el vale. */
  engancharRepuestos(o.id);

  document.querySelectorAll('[data-fichatab]').forEach((b) => b.addEventListener('click', () => {
    f.tab = b.dataset.fichatab;
    if (f.tab === 'etapas') f.modoEtapas = f.modoEtapas || modoEtapasPorDefecto(o);
    refrescarFicha();
  }));

  document.querySelectorAll('[data-pendiente]').forEach((b) => b.addEventListener('click', () => {
    const [rot, , nota] = b.dataset.pendiente.split('|');
    avisar({ ok: false, motivo: '"' + rot + '" todavía no se construye' +
      (nota ? ': ' + nota : '') + '. El botón lo dice en vez de no hacer nada.' });
  }));

  /* 🔴 CON VARIAS OR HAY QUE PREGUNTAR CUÁL (16-08-2026, Marco): «¿cómo
     identificará qué PDF quiero abrir si la OT tiene más de un presupuesto?».
     Abría el ÚLTIMO sin decirlo, que es la peor de las respuestas: el que
     imprime cree que tiene el documento que pidió. Con una sola OR se abre
     directo, que es el caso de todos los días. */
  document.querySelectorAll('#contenido [data-imprimir]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.imprimir !== 'presupuesto' || o.presupuestos.length <= 1)
      return abrirImpreso(b.dataset.imprimir, o.id);

    dialogo('¿Qué presupuesto quieres abrir?',
      '<p class="pie-nota" style="margin:0 0 10px">Esta orden tiene ' +
      o.presupuestos.length + ' documentos. Se abren en otra pestaña.</p>' +
      '<div class="grid-envoltorio"><table class="grid"><tbody>' +
      o.presupuestos.map((pr) => {
        const e = ESTADO_PRESUPUESTO[pr.estado] || { txt: pr.estado, clase: 'gris' };
        return '<tr><td><span class="cod">OR ' + esc(pr.numeroOR) + '</span></td>' +
          '<td><span class="et ' + esc(e.clase) + '">' + esc(e.txt) + '</span></td>' +
          '<td class="num">' + fMonto(pr.total) + '</td>' +
          '<td><button class="btn secundario chico" data-elegir-pr="' + esc(pr.id) + '">' +
          'Abrir</button></td></tr>';
      }).join('') + '</tbody></table></div>');

    (dialogo.ultimo || document).querySelectorAll('[data-elegir-pr]').forEach((x) =>
      x.addEventListener('click', () => {
        if (dialogo.cerrar) dialogo.cerrar();
        abrirImpreso('presupuesto', o.id, x.dataset.elegirPr);
      }));
  }));

  // Salir de la ficha hacia otro módulo: la ficha vive en su propia pestaña,
  // así que se abre el sistema completo en esa vista.
  /* El módulo se abre YA PARADO en esta orden. Antes llevaba al listado y
     había que volver a buscar la patente: dos clics para llegar al mismo
     lugar, con el número de la orden en la mano. */
  document.querySelectorAll('[data-irvista]').forEach((b) => b.addEventListener('click', () => {
    window.open('index.html#vista=' + encodeURIComponent(b.dataset.irvista) +
      '&ot=' + encodeURIComponent(b.dataset.irot || ''), '_blank', 'noopener');
  }));

  if (f.tab === 'etapas') pEtapas(o);

  // La bitácora se pinta en su pestaña Y debajo de las etapas, igual que en el
  // sistema actual, así que su cableado vive aparte y lo llaman las dos.
  if (f.tab === 'bitacora' || f.tab === 'etapas') pFichaBitacora(o);

  if (f.tab === 'fotos') {
    if (Modelo.puede('foto.cargar')) montarZonaFotos({
      id: 'fichafoto', ot_id: o.id,
      get momento() { const s = document.getElementById('ficha-momento'); return s ? s.value : 'proceso'; },
      alSubir: (fichas) => {
        const mom = (document.getElementById('ficha-momento') || {}).value || 'proceso';
        Modelo.adjuntar_media(null, [o.id],
          fichas.map((x) => Object.assign(x, { ot_id: o.id, momento: mom })));
        refrescarFicha();
      }
    });
    document.querySelectorAll('[data-borrar-media]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.borrarMedia;
      Media.eliminar(id).catch(() => null)
        .then(() => ejecutar(() => Modelo.eliminar_media(id), 'Imagen quitada.'));
    }));
  }

  Media.pintar();
}
