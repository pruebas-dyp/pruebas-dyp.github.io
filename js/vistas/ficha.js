/* LA FICHA DE LA ORDEN — el centro del sistema.

   Los 10 campos de la cabecera en sus dos bloques, y las 8 pantallas que cuelgan de ella.
   Es la única que las reúne.

   Detalle y decisiones: 00 Documentacion/DECISIONES.md · js/vistas/ficha.js */

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

/* 🔴 EDITAR LOS CAMPOS DE LA OR (26-08-2026, Marco: «deben siempre poder
   editar los campos de una OR, pero con los campos que ya llenaron en su
   momento»).

   Lo segundo es la mitad que importa y por eso el formulario nace RELLENO con
   lo que hay: se abre para corregir un dato, no para volver a escribir los
   cinco. El caso de todos los días es el número de siniestro, que llega días
   después del ingreso. */
function dialogoEditarOR(o) {
  const comps = Modelo.catalogo('compania').filter((x) => x.vigente !== false);
  const tipos = Modelo.catalogo('tipo_ingreso').filter((x) => x.vigente !== false);
  const velo = document.createElement('div');
  velo.className = 'velo';
  velo.innerHTML = `
    <div class="modal" style="max-width:660px">
      <div class="modal-cab">
        <h2>OR ${esc(o.numeroOR || '—')} · ${esc(o.patente)}</h2>
        <button class="cerrar" type="button" data-cerrar="1" aria-label="Cerrar">&times;</button>
      </div>
      <div class="modal-cuerpo" style="padding:16px 18px;overflow:auto">
        <p class="ayuda" style="margin-top:0">Se corrige y queda anotado en la bitácora: qué campo,
          qué decía antes y qué dice ahora.</p>
        <div class="rejilla-2">
          <div class="campo"><label for="or-siniestro">N° de siniestro</label>
            <input id="or-siniestro" value="${esc(o.siniestro || '')}"
              placeholder="Cuando la compañía lo abra"></div>
          <div class="campo"><label for="or-compania">Compañía</label>
            <select id="or-compania"><option value="">Particular / sin compañía</option>
              ${comps.map((x) => '<option value="' + esc(x.id) + '"' +
                (x.id === o.companiaId ? ' selected' : '') + '>' + esc(x.nombre) + '</option>').join('')}
            </select></div>
          <div class="campo"><label for="or-tipo">Tipo de ingreso</label>
            <select id="or-tipo">
              ${tipos.map((x) => '<option value="' + esc(x.id) + '"' +
                (x.id === o.tipoIngresoId ? ' selected' : '') + '>' + esc(x.nombre) + '</option>').join('')}
            </select></div>
          <div class="campo"><label for="or-deducible">Deducible</label>
            <input id="or-deducible" value="${o.deducible || 0}" inputmode="numeric"></div>
          <div class="campo"><label for="or-liquidador">Liquidador</label>
            <input id="or-liquidador" value="${esc(o.liquidador || '')}"></div>
        </div>
        <div class="campo"><label for="or-danos">Descripción de daños</label>
          <textarea id="or-danos" rows="3">${esc(o.descripcionDanos || '')}</textarea></div>
      </div>
      <div class="modal-pie" style="padding:12px 18px;display:flex;gap:8px;
        justify-content:space-between;flex-wrap:wrap">
        ${/* 🔴 «En editar OR debemos poder crear una nueva» (26-08-2026, Marco).
             Va acá y no en otro botón del menú porque es donde se está mirando
             la OR: se abre para corregir el siniestro, se descubre que en
             realidad son dos siniestros, y se abre la segunda sin salir. */''}
        ${Modelo.puede('ot.crear')
          ? '<button class="btn secundario" type="button" id="or-nueva" ' +
            'title="Abre otra orden de reparación sobre este mismo vehículo, con los datos ' +
            'que estén escritos arriba. Comparten la recepción.">Crear OR nueva</button>'
          : '<span></span>'}
        <span style="display:flex;gap:8px">
          <button class="btn secundario" type="button" data-cerrar="1">Cancelar</button>
          <button class="btn" type="button" id="or-guardar">Guardar</button>
        </span>
      </div>
    </div>`;
  document.body.appendChild(velo);

  const cerrar = () => velo.remove();
  velo.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', cerrar));
  velo.addEventListener('click', (ev) => { if (ev.target === velo) cerrar(); });
  const primero = document.getElementById('or-siniestro');
  if (primero) primero.focus();

  const nueva = document.getElementById('or-nueva');
  if (nueva) nueva.addEventListener('click', () => {
    const v = (id) => (document.getElementById(id) || {}).value || '';
    const r = ejecutar(() => Modelo.abrir_or_nueva(o.id, {
      siniestro: v('or-siniestro'), compania_id: v('or-compania'),
      tipo_ingreso_id: v('or-tipo'), deducible: v('or-deducible'),
      liquidador: v('or-liquidador'), descripcion_danos: v('or-danos')
    }), 'OR nueva abierta.');
    if (!r || r.ok === false) return;
    cerrar();
    /* Se abre en su propia pestaña, que es donde se va a trabajar. La de acá
       queda con la OR original, que es lo que el usuario estaba mirando. */
    abrirFicha(r.numero_ot);
  });

  document.getElementById('or-guardar').addEventListener('click', () => {
    const v = (id) => (document.getElementById(id) || {}).value || '';
    const r = ejecutar(() => Modelo.editar_orden(o.id, {
      siniestro: v('or-siniestro'),
      compania_id: v('or-compania'),
      tipo_ingreso_id: v('or-tipo'),
      deducible: v('or-deducible'),
      liquidador: v('or-liquidador'),
      descripcion_danos: v('or-danos')
    }), 'OR actualizada.');
    if (r && r.ok === false) return;
    cerrar();
    refrescarFicha();
  });
}

function refrescarFicha() {
  render();
}

/* Las OCHO pantallas que cuelgan de la ficha en el sistema actual, con su
   rótulo literal. Las que todavía no se construyen se rotulan como tales:
   un botón que no hace nada y no lo dice es peor que no tenerlo. */
/* 🔴 CADA UNO CON SU ICONO (26-08-2026). En el sistema que usan, estos accesos
   son botones grandes con un icono redondo, y es lo que la gente reconoce de un
   vistazo sin leer. Se copia esa forma. */
const FICHA_ENLACES = [
  { rot: 'Ver recepción',                   imprimir: 'recepcion', permiso: 'ficha.completa', ico: 'recepcion' },
  // El impreso del presupuesto es el documento comercial —cliente, RUT y
  // valores—, así que pide `presupuesto.montos`. Quien solo tiene
  // `presupuesto.ver` lee las líneas sin precio en la ficha.
  { rot: 'Ver Presupuesto',                 imprimir: 'presupuesto', permiso: 'presupuesto.montos', ico: 'presupuesto' },
  { rot: 'Ver repuestos',                   tab: 'repuestos', permiso: 'repuesto.ver', ico: 'repuesto' },
  { rot: 'Ver/Subir Documentos o imágenes', vista: 'documentos', permiso: 'documento.ver', ico: 'documento' },
  { rot: 'Ver Fotografías',                 tab: 'fotos', permiso: 'foto.ver', ico: 'camara' },
  /* 🔴 YA NO ESTÁ PENDIENTE (26-08-2026, Marco: «agrega editar recepción»).

     Salía apagado y con el rótulo «pendiente», y la nota decía que «la
     recepción se edita desde su propia pantalla». Era cierto y era inútil: la
     pantalla existe hace rato —se llega desde Recepción— y desde acá había que
     salir, buscar la orden de nuevo y recién ahí entrar. Ahora este acceso
     abre esa misma pantalla, ya parada en esta orden. */
  { rot: 'Editar Recepción',                editarRecepcion: true, permiso: 'ot.editar', ico: 'editar' },
  { rot: 'Agregar OR',                      vista: 'presupuesto', permiso: 'presupuesto.crear', ico: 'nuevo' },
  { rot: 'Bodega de esta orden',            vista: 'bodega', permiso: 'repuesto.cargar', ico: 'bodega' },
  { rot: 'Bitácora',                        tab: 'bitacora', permiso: 'ficha.completa', ico: 'info' }
];

/* 🔴 LA CABECERA DE LA ORDEN, UNA SOLA VEZ (27-08-2026, Marco: «el resumen
   ejecutivo de todo lo del auto debe estar arriba y ser reemplazado por lo que
   está ahí de Recepción y de Situación, ya que se repite con lo de abajo»).

   Arriba había dos recuadros —RECEPCIÓN y SITUACIÓN— y justo debajo los cuatro
   bloques de la ficha. Siete de los once campos de arriba estaban repetidos
   abajo, palabra por palabra:

     Fecha de Ingreso    → Los tres relojes      Tipo de ingreso → Viene por
     Patente             → Vehículo              N° de Siniestro → Siniestro
     Marca/Modelo        → Vehículo              Nombre Cliente  → Cliente
     Estado del vehículo → la etiqueta del título

   Repetir un dato no es sólo ruido: son dos lugares que hay que mantener de
   acuerdo, y el día que uno cambie va a haber una pantalla que diga dos cosas
   distintas del mismo auto.

   Los cuatro que NO estaban abajo —fecha de salida, etapa actual, encargado
   actual y alerta— no se perdieron: los tres últimos son la tira que ahora va
   al lado del título, y la fecha de salida bajó a Los tres relojes, que es
   donde viven las fechas. */
function cabFicha(o) {
  const completa = Modelo.puede('ficha.completa');
  const chip = '<span class="et ' + esc(o.estadoClase) + '">' + esc(o.estadoNombre) + '</span>';

  /* En la vista recortada del taller la etapa y el encargado ya salen en
     «Cómo va», dos centímetros más abajo. No se ponen dos veces. */
  const situacion = completa
    ? '<span class="ss"><span class="k">Etapa actual</span>' +
      (o.etapa
        ? '<i class="punto" style="background:' + etapaPorCodigo(o.etapa).color + '"></i>' + esc(o.etapaNombre)
        : '<span class="et gris">Pendiente</span>') + '</span>' +
      '<span class="ss"><span class="k">Encargado</span>' +
      (o.asignado ? esc(o.asignado) : '<span class="et gris">Sin asignar</span>') + '</span>' +
      (o.alertas.length
        ? '<span class="ss"><span class="k">Alerta</span>' + o.alertas.map((a) =>
            '<span class="et gris" title="' + esc(a.asunto) + '">' + esc(a.letra) + '</span>').join(' ') + '</span>'
        : '')
    : '';

  return `
    <div class="cab">
      <div><h2>${ico('auto', 'g')}Orden N° ${o.numeroOT} · <span class="patente">${esc(o.patente)}</span></h2>
        <div class="desc">${esc([o.marca, o.modelo].filter(Boolean).join(' '))}${o.anio ? ' · ' + o.anio : ''}</div></div>
      <div class="tira-situacion">${situacion}${chip}</div>
    </div>`;
}

function vFichaOT(o) {
  const f = fichaEstado();

  /* 🔴 SIN PESTAÑAS (26-08-2026, Marco: «debes sacar esos paneles de ahí; el
     único que me debes dejar es Ficha, que quiero que quede arriba y ojalá con
     un poco más de detalle»).

     La ficha tenía seis pestañas —Ficha, Etapas, Historial, Bitácora,
     Repuestos, Fotografías— y en el sistema que usan no hay ninguna: hay una
     pantalla con los datos, los accesos grandes, y abajo la bitácora y el
     historial, todo a la vista.

     Ahora el orden es el de ellos:

        1 · los datos de la orden, arriba y completos
        2 · los accesos, grandes
        3 · la bitácora de observaciones
        4 · el historial

     Los otros paneles no se borraron: se llega a ellos por su acceso, y desde
     ahí se vuelve. Es la misma navegación de su sistema —el icono te lleva a
     una pantalla y vuelves— y por eso los `data-fichatab` siguen intactos. */
  const enFicha = f.tab === 'ficha';
  const cuerpo = enFicha ? '' : {
    etapas: vEtapas, historial: fichaHistorial,
    bitacora: fichaBitacora, repuestos: fichaRepuestos, fotos: fichaFotos
  }[f.tab](o);

  const enlaces = FICHA_ENLACES.filter((l) => !l.permiso || Modelo.puede(l.permiso));

  /* 🔴 LOS ACCESOS VAN ABAJO, DESPUES DE LA FICHA (26-08-2026, Marco: «el
     unico que me debes dejar es Ficha, que quiero que quede ARRIBA... y abajo
     esto un poco mas grande»). Estaban dentro del panel de la cabecera, o sea
     entre los datos de la orden y su detalle. Ahora el orden es el de su
     sistema: primero se lee la orden entera, despues se decide a donde ir. */
  const accesos = enlaces.length ? `<div class="acciones-ficha" style="margin-top:10px">
        ${/* 🔴 TARJETAS CON ICONO, COMO EN SU SISTEMA (26-08-2026, Marco:
             «quiero hacerlo más intuitivo y quiero la visual que tienen
             actualmente en el sistema, ya que esto nos permitirá que a ellos
             también les sea más fácil ocuparlo»).

             Eran nueve botones chicos en una fila, todos del mismo color y del
             mismo tamaño: para encontrar «Ver Fotografías» había que leerlos
             uno por uno. En el sistema que usan hoy son tarjetas grandes con un
             icono redondo, y eso se reconoce sin leer.

             El CONTENIDO no cambia: los mismos accesos, los mismos permisos y
             los mismos manejadores —`data-fichatab`, `data-imprimir`,
             `data-irvista`, `data-pendiente`—. Es la forma, no la función. */''}
        ${enlaces.map((l) => {
          const cara = '<span class="ico-redondo">' + ico(l.ico || 'documento') + '</span>' +
            '<span class="rot-acceso">' + esc(l.rot) + '</span>';
          if (l.tab) return '<button class="acceso" type="button" data-fichatab="' + l.tab + '">' + cara + '</button>';
          if (l.imprimir) return '<button class="acceso" type="button" data-imprimir="' + l.imprimir + '">' + cara + '</button>';
          if (l.vista) return '<button class="acceso" type="button" data-irvista="' + l.vista +
            '" data-irot="' + esc(o.numeroOT) + '">' + cara + '</button>';
          if (l.editarRecepcion) return '<button class="acceso" type="button" data-editar-recepcion="' +
            esc(o.numeroOT) + '">' + cara + '</button>';
          return '<button class="acceso pendiente" type="button" data-pendiente="' + esc(l.rot) + '|' + l.tanda +
            (l.nota ? '|' + esc(l.nota) : '') + '">' + cara +
            '<span class="et gris">pendiente</span></button>';
        }).join('')}
    </div>` : '';

  return `
  ${enFicha
    ? /* La ficha completa arriba —con la cabecera adentro, no encima—, los
         accesos al medio, y la bitácora y el historial abajo. */
      fichaResumen(o) + accesos + fichaBitacora(o) + fichaHistorial(o)
    : /* Cualquier otro panel se abre solo. Se queda con la cabecera sola, que
         es lo único que dice de qué orden estamos hablando, y con la vuelta. */
      '<div class="panel">' + cabFicha(o) + '</div>' +
      '<div class="volver-ficha"><button class="btn secundario" type="button" data-fichatab="ficha">' +
      ico('chevron') + 'Volver a la ficha</button>' +
      '<span class="titulo-panel">' + esc((FICHA_TABS.find((t) => t.id === f.tab) || {}).n || '') + '</span>' +
      '</div>' + cuerpo}
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
    <div class="panel">${cabFicha(o)}<div class="cuerpo"><div class="ficha-rejilla">
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
        ${dato('Fecha de salida', o.fechaSalida ? fFechaHora(o.fechaSalida)
          : '<span style="color:var(--gris-2)">—</span>')}
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
  <div class="panel">${cabFicha(o)}<div class="cuerpo"><div class="ficha-rejilla">
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

    <fieldset class="bloque"><legend>Cliente y siniestro${Modelo.puede('ot.editar')
      ? ' <button class="btn secundario" type="button" id="or-editar" ' +
        'title="Corregir los datos de la reparación: siniestro, compañía, deducible, liquidador y descripción">' +
        'Editar la OR</button>'
      : ''}</legend>
      ${dato('Cliente', esc(o.cliente))}
      ${dato('RUT', '<span title="' + (Modelo.puede('datos.rut_completo')
        ? 'Se ve completo porque el rol tiene el permiso'
        : 'Enmascarado por rol: se garantiza en la base, no acá') + '">' +
        esc(Modelo.velar(o.rut, 'datos.rut_completo')) + '</span>')}
      ${dato('Teléfono', esc(Modelo.velar(o.telefono, 'datos.rut_completo')))}
      ${dato('Dirección', '<span title="Enmascarado por rol">' +
        esc(Modelo.velar(o.direccion, 'datos.rut_completo', 'todo')) + '</span>')}
      ${dato('Viene por', esc(o.origenIngresoNombre || '—'))}
      ${/* 🔴 ANTES ESTO ERA `o.siniestro ? … : ''` — el bloque entero desaparecía
            cuando no había número de siniestro. Y ese es EXACTAMENTE el caso que
            hay que atender: la compañía abre el siniestro días después del
            ingreso, así que la orden recién creada no lo tiene y el usuario se
            quedaba sin ver ni dónde anotarlo. Ahora se muestra siempre; lo que
            falta se dice que falta. */''}
      ${dato('Compañía', esc(o.compania && o.compania !== '—' ? o.compania : 'Particular'))}
      ${dato('Siniestro', o.siniestro ? esc(o.siniestro)
        : '<span style="color:var(--gris-2)">Todavía sin número</span>')}
      ${dato('Deducible', fMonto(o.deducible))}
      ${dato('Liquidador', esc(o.liquidador || '—'))}
      ${dato('Descripción de daños', esc(o.descripcionDanos || '—'))}
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
      ${/* Bajó de la cabecera, que se fue. Sale de `ot_estadia`, o sea de un
           hecho con fecha: es la última vez que el auto salió del taller, no la
           entrega. En el sistema que usan hoy este campo está vacío hasta en
           órdenes ya entregadas. */''}
      ${dato('Fecha de salida', o.fechaSalida ? fFechaHora(o.fechaSalida)
        : (o.enTaller ? '<span style="color:var(--gris-2)">el vehículo está adentro</span>'
                      : '<span style="color:var(--gris-2)">—</span>'))}
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

      ${/* 🔴 BAJAR EL SET COMPLETO (26-08-2026, Marco). En la visita se dijo tres
            veces: baja todas, borra las que no sirven y le manda el resto al
            liquidador. El botón grande baja TODO —que es el pedido— y cada
            bloque baja el suyo, porque a veces sólo hace falta el desarme. */''}
      ${/* `flex-wrap` y el botón que no se encoge: sin eso, en un celular el texto
            de ayuda se llevaba el ancho y el botón quedaba en 121 px con el
            rótulo partido en dos líneas. Medido a 375 px en la auditoría. */''}
      ${todas.length ? '<div style="display:flex;gap:8px;align-items:center;' +
        'flex-wrap:wrap;margin-bottom:12px">' +
        '<button class="btn" type="button" data-bajar-fotos="*" style="flex:0 0 auto">' +
        'Guardar las ' + todas.length + ' en una carpeta</button>' +
        '<span class="ayuda" style="flex:1 1 220px">Se baja un .zip con todas: ' +
        'recepción, presupuesto y etapas juntas</span>' +
        '</div>' : ''}

      ${Object.keys(porMomento).length
        ? Object.keys(porMomento).map((k) => '<fieldset class="bloque" style="margin-bottom:10px">' +
            '<legend>' + esc(ROTULOS[k] || k) + ' (' + porMomento[k].length + ')' +
            ' <button class="btn secundario" type="button" data-bajar-fotos="' + esc(k) + '" ' +
            'title="Baja sólo estas">Guardar estas</button></legend>' +
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
  /* 🔴 EDITAR RECEPCIÓN, DESDE ACÁ (26-08-2026). Deja la pantalla de Recepción
     ya cargada con ESTA orden. `editRecCargar` se llama una sola vez, al
     entrar: si se recargara en cada pintado, cada tecla que el usuario escribe
     se perdería con el render siguiente —está dicho en `recepcion-cableado.js`
     y vale igual acá. */
  document.querySelectorAll('[data-editar-recepcion]').forEach((b) => b.addEventListener('click', () => {
    const orden = Modelo.otPorNumero(b.dataset.editarRecepcion);
    if (!orden) return avisar({ ok: false, motivo: 'Esa orden ya no está abierta: la recepción de una orden cerrada no se corrige.' });
    if (typeof editRecCargar !== 'function' || typeof rec !== 'function')
      return avisar({ ok: false, motivo: 'La pantalla de recepción no está cargada.' });
    editRecCargar(orden);
    rec().pantalla = 'editar-ficha';
    /* Sale de la ventana de la orden al módulo: la edición de la recepción vive
       en Recepción y tiene su propio flujo de versiones. */
    ir('recepcion');
  }));

  const btnOR = document.getElementById('or-editar');
  if (btnOR) btnOR.addEventListener('click', () => dialogoEditarOR(o));

  /* Bajar las fotos. `todas` se vuelve a pedir acá y no se guarda del pintado:
     entre que se dibujó la pantalla y alguien aprieta el botón pueden haber
     entrado fotos nuevas, y bajar una lista vieja es de las cosas que nadie
     revisa hasta que falta una foto en el correo al liquidador. */
  document.querySelectorAll('[data-bajar-fotos]').forEach((b) => b.addEventListener('click', () => {
    const cual = b.dataset.bajarFotos;
    const todas = Modelo.mediaDe(o.id) || [];
    const set = cual === '*' ? todas : todas.filter((m) => m.momento === cual);
    if (!set.length) return avisar({ ok: false, motivo: 'No hay fotos que guardar.' });
    const rot = b.textContent;
    b.disabled = true; b.textContent = 'Armando…';
    Media.bajarCarpeta(set, 'Fotos ' + o.patente + ' OT ' + o.numeroOT +
      (cual === '*' ? '' : ' - ' + (ROTULOS[cual] || cual)))
      .then((n) => avisar({ ok: true, motivo: '' }, n + (n === 1 ? ' foto guardada' : ' fotos guardadas') + ' en una carpeta.'))
      .catch((e) => avisar({ ok: false, motivo: 'No se pudo armar la carpeta: ' + (e && e.message) }))
      .then(() => { b.disabled = false; b.textContent = rot; });
  }));

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
  /* Por `abrirNuestra` y no por `window.open` a secas: con `noopener` la
     pestaña nueva nacía sin sesión y había que entrar de nuevo. El porqué
     completo está en `js/app/render.js`, junto a la función. */
  document.querySelectorAll('[data-irvista]').forEach((b) => b.addEventListener('click', () => {
    abrirNuestra('index.html#vista=' + encodeURIComponent(b.dataset.irvista) +
      '&ot=' + encodeURIComponent(b.dataset.irot || ''));
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
