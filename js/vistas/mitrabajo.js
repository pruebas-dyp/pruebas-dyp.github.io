/* MI TRABAJO — la pantalla del que está en el piso.

   Él ve las cuatro que tiene que pintar, no las 102 del taller.

   ⚠️ Esto NO existe en el sistema actual: ninguna de las 39 pantallas tiene una vista por
   puesto de trabajo. Es desarrollo nuevo y se cotiza aparte.

   Detalle y decisiones: 00 Documentacion/DECISIONES.md · js/vistas/mitrabajo.js */



/* ══ LA BANDEJA DEL QUE VALIDA ═════════════════════════════════════════
   Pedido de Marco el 22-08-2026: *"el jefe de taller o el que revisa debe
   poder validar el termino, aceptarlo"*.

   Es la contraparte exacta de la tarjeta del operario. Va arriba de todo en la
   pantalla del jefe porque es lo unico que BLOQUEA: mientras no la revise, el
   vehiculo no avanza aunque el trabajo este hecho. Un auto listo hace tres
   dias que nadie mira es plata detenida en el patio.

   Dos salidas, y las dos a la vista: aceptar o devolver. Un revisor que solo
   puede aceptar no esta revisando, esta firmando. */
function vPorValidar() {
  /* Módulo propio desde el 22-08-2026. Se llega por el menú —sólo lo ve quien
     valida— y también por `#vista=porvalidar`. Si alguien llega acá sin el
     permiso NO se le muestra una pantalla en blanco: se le dice de quién es
     esta pantalla. Una pantalla vacía sin explicación se lee como que el
     sistema se rompió. */
  if (!Modelo.puede('etapa.validar')) {
    return `
    <div class="panel">
      <div class="cab"><div><h2>${ico('check', 'g')}Terminadas esperando visto bueno</h2>
        <div class="desc">Esta pantalla es de quien revisa el trabajo terminado —la jefatura
          de taller—. Tu cuenta no tiene ese permiso, así que no hay nada que aceptar
          desde acá</div></div></div>
    </div>`;
  }
  const filas = Modelo.porValidar();
  if (!filas.length) {
    return `
    <div class="panel">
      <div class="cab"><div><h2>${ico('check', 'g')}Terminadas esperando tu visto bueno</h2>
        <div class="desc">Nadie tiene trabajo esperando revisión</div></div>
        <span class="et verde">al día</span></div>
    </div>`;
  }
  const esperaLarga = filas.filter((x) => x.diasEsperando >= 2).length;
  return `
  <div class="panel destacado">
    <div class="cab"><div><h2>${ico('check', 'g')}Terminadas esperando tu visto bueno</h2>
      <div class="desc">Hasta que las aceptes, el vehículo no avanza. La que lleva más
        esperando va primero</div></div>
      <span class="et ${esperaLarga ? 'roja' : 'ambar'}">${filas.length} por revisar</span></div>
    <div class="cuerpo">
      <div class="tareas">${filas.map((x) => `
        <article class="tarea validar${x.diasEsperando >= 2 ? ' esperando' : ''}">
          <div class="franja" style="background:${esc(x.color || 'var(--acento)')}"></div>
          <div class="tarea-cuerpo">
            <div class="tarea-alto">
              <span class="etapa"><i class="punto" style="background:${esc(x.color)}"></i>${esc(x.etapa)}</span>
              <span class="plazo ${x.diasEsperando >= 2 ? 'tarde' : 'espera'}">${x.diasEsperando === 0
                ? 'terminada hoy'
                : 'espera ' + x.diasEsperando + (x.diasEsperando === 1 ? ' día' : ' días')}</span>
            </div>
            <div class="tarea-auto">
              <span class="patente">${esc(x.patente)}</span>
              <span class="veh">${esc([x.marca, x.modelo].filter(Boolean).join(' ') || '')}</span>
              <span class="ot">OT ${x.numeroOT}</span>
            </div>
            <div class="tarea-pie">
              <span>La terminó <strong>${esc(x.quienTermino || 'sin encargado')}</strong>
                el ${fFecha(x.terminadaAt)}</span>
              ${x.diasDeLaEtapa !== null
                ? '<span>' + x.diasDeLaEtapa + (x.diasDeLaEtapa === 1 ? ' día' : ' días') + ' en la etapa</span>'
                : ''}
              ${x.asignadaPor ? '<span>La asignó ' + esc(x.asignadaPor) + '</span>' : ''}
              ${x.devoluciones ? '<span class="et roja">ya se devolvió ' +
                (x.devoluciones === 1 ? 'una vez' : x.devoluciones + ' veces') + '</span>' : ''}
            </div>
            <div class="tarea-botones">
              <button class="btn" data-mt-validar="${esc(x.ot_id)}|${esc(x.etapaCodigo)}">Aceptar</button>
              <button class="btn secundario" data-mt-devolver="${esc(x.ot_id)}|${esc(x.etapaCodigo)}">Devolver</button>
              <button class="btn secundario" data-mt-abrir="${esc(x.numeroOT)}">Ver orden</button>
            </div>
          </div>
        </article>`).join('')}</div>
    </div>
  </div>`;
}

/* ══ LO QUE VE EL ASIGNADO ═════════════════════════════════════════════
   Pedido de Marco el 22-08-2026: *"donde ve el asignado quiero que quede
   super claro para el"*.

   Antes esto era una tabla de nueve columnas. Una tabla sirve para COMPARAR
   filas; el que esta en pintura no compara nada: mira lo suyo, elige cual
   agarra ahora y lo cierra — en un celular, con las manos sucias, entre dos
   autos. Por eso son tarjetas.

   ⚠️ Y NO es una agenda por horario. Marco lo corrigio explicito: *"no es que
   tenga un horario y todo, sino que es como la trazabilidad de cuando se le
   asigno nomas"*, y tampoco hay tope de cuantos autos puede tener alguien a
   la vez. Lo que se agrupa es el ESTADO DEL CICLO, no el reloj:

     · Por hacer                  — asignada, todavia no la termina
     · Terminada, esperando visto — el jefe todavia no la acepta

   Ese segundo grupo es el que hace que el sistema no mienta: «terminado» por
   el operario no es lo mismo que «revisado». */

/* Una tarjeta de trabajo. `mia` distingue lo que la persona ya tiene entre
   manos de lo que todavia no le asignaron. */
function tarjetaTrabajo(x, mia, reparteElJefe) {
  const esperando = !!x.esperandoValidacion;
  /* 🔴 UNA ETAPA DEVUELTA NO SE VE COMO UNA NUEVA. Cuando el jefe la
     rechazaba, al encargado le reaparecia la misma tarjeta —mismo rotulo,
     misma fecha de asignacion— sin una palabra de que su trabajo habia sido
     rechazado ni de que rehacer. El motivo quedaba en la bitacora de la orden,
     que nadie abre. Va acá, arriba y con el nombre de quien la devolvio. */
  const devuelta = mia && x.devueltaPendiente;
  return '<article class="tarea' + (esperando ? ' esperando' : '') +
    (devuelta ? ' devuelta' : '') + '">' +
    '<div class="franja" style="background:' + esc(devuelta ? 'var(--rojo, #c0392b)' : (x.color || 'var(--acento)')) + '"></div>' +
    '<div class="tarea-cuerpo">' +
      '<div class="tarea-alto">' +
        '<span class="etapa"><i class="punto" style="background:' + esc(x.color) + '"></i>' +
          esc(x.etapa) + '</span>' +
        (esperando ? '<span class="plazo espera">esperando visto bueno</span>' : '') +
        (devuelta ? '<span class="plazo tarde">te la devolvieron</span>' : '') +
      '</div>' +
      (devuelta
        ? '<div class="motivo-devuelta">' +
            '<strong>' + esc(x.devueltaPor || 'El jefe de taller') + '</strong> la devolvió' +
            (x.devueltaAt ? ' el ' + fFecha(x.devueltaAt) : '') + ': ' +
            '<em>' + esc(x.devueltaMotivo || 'sin motivo registrado') + '</em>' +
            (x.devoluciones > 1 ? ' <span class="et roja">' + x.devoluciones + '.ª vez</span>' : '') +
          '</div>'
        : '') +
      '<div class="tarea-auto">' +
        '<span class="patente">' + esc(x.patente) + '</span>' +
        '<span class="veh">' + esc([x.marca, x.modelo].filter(Boolean).join(' ') || '') + '</span>' +
        '<span class="ot">OT ' + x.numeroOT + '</span>' +
      '</div>' +
      '<div class="tarea-pie">' +
        (mia && x.asignadaPor
          ? '<span>Te la asignó <strong>' + esc(x.asignadaPor) + '</strong>' +
            (x.desde ? ' el ' + fFecha(x.desde) : '') + '</span>'
          : '<span>Sin encargado todavía</span>') +
        (mia && x.diasDesdeAsignada !== null
          ? '<span>' + x.diasDesdeAsignada + (x.diasDesdeAsignada === 1 ? ' día' : ' días') + ' conmigo</span>' : '') +
        (esperando && x.terminadaAt
          ? '<span>Terminada el ' + fFecha(x.terminadaAt) + '</span>' : '') +
        (x.repuestosPendientes
          ? '<span class="et ambar">' + x.repuestosPendientes + ' repuesto' +
            (x.repuestosPendientes === 1 ? '' : 's') + ' por llegar</span>' : '') +
        (!x.enTaller ? '<span class="et gris">el auto está afuera</span>' : '') +
      '</div>' +
      '<div class="tarea-botones">' +
        (mia
          ? (esperando
              /* Terminada y esperando: no hay boton de cerrar, porque cerrar
                 ya no depende de esta persona. Se dice de quien depende. */
              ? '<span class="espera">La revisa el jefe de taller</span>' +
                '<button class="btn secundario" data-mt-abrir="' + esc(x.numeroOT) + '">Ver orden</button>'
              : '<button class="btn" data-mt-cerrar="' + esc(x.ot_id) + '|' + esc(x.etapaCodigo) + '">Terminé</button>' +
                '<button class="btn secundario" data-mt-soltar="' + esc(x.ot_id) + '|' + esc(x.etapaCodigo) + '">Soltar</button>' +
                '<button class="btn secundario" data-mt-abrir="' + esc(x.numeroOT) + '">Ver orden</button>')
          : (reparteElJefe
              ? '<span class="espera">La asigna el jefe de taller</span>'
              : '<button class="btn secundario" data-mt-tomar="' + esc(x.ot_id) + '|' + esc(x.etapaCodigo) + '">Tomar</button>')) +
      '</div>' +
    '</div></article>';
}

/* Las tarjetas agrupadas por estado del ciclo. El grupo vacio no se dibuja: un
   rotulo sobre nada se lee como que algo fallo. */
function gruposDeTrabajo(lista, mia, reparteElJefe) {
  /* 🔴 ERAN DOS GRUPOS (27-08-2026, Marco: «el sistema no tiene validaciones
     de etapas»). El segundo —«Terminadas, esperando el visto bueno»— agrupaba
     un estado que ya no existe: terminar una etapa la cierra, y una etapa
     cerrada no está en Mi trabajo. Quedaba un rótulo que no iba a tener nunca
     nada debajo. */
  const grupos = [
    { tit: mia ? 'Por hacer' : '', dice: '', suyas: lista }
  ];
  return grupos.map((g) => {
    if (!g.suyas.length) return '';
    return '<div class="grupo-tareas">' +
      (g.tit ? '<h3 class="tit-grupo">' + esc(g.tit) +
        '<span class="cuantas">' + g.suyas.length + '</span>' +
        (g.dice ? '<span class="dice">' + esc(g.dice) + '</span>' : '') + '</h3>' : '') +
      '<div class="tareas">' + g.suyas.map((x) => tarjetaTrabajo(x, mia, reparteElJefe)).join('') + '</div>' +
    '</div>';
  }).join('');
}

function vMiTrabajo() {
  const yo = Modelo.personaActual();

  if (!yo) {
    return `
    <div class="panel"><div class="cuerpo"><div class="vacio">
      ${ico('personal')}
      <div class="titulo">Estás mirando el sistema completo</div>
      <div class="texto">Esta pantalla muestra lo que le toca a <strong>una cuenta</strong>.
      Para verla, hay que entrar con una de las del taller:</div>
      <div class="lista">${Modelo.sesionesPosibles().map((p) =>
        '<li><strong>' + esc(p.nombre) + '</strong> — ' + esc(p.cargo) +
        (p.etapas.length ? ' · ' + esc(p.etapas.join(', ')) : ' · sin etapas asignadas') + '</li>').join('')}</div>
    </div></div></div>`;
  }

  const t = Modelo.miTrabajo(yo.id);
  /* ¿En este taller el trabajo se toma o se reparte? Es un parametro, y cambia
     lo que esta pantalla OFRECE, no solo lo que dice. */
  const reparteElJefe = !Reglas.autoAsignacion(Modelo.base()) && !Modelo.puede('etapa.asignar');

  const verCliente = Modelo.puede('ficha.completa');
  const puedePresupuestar = Modelo.puede('presupuesto.crear');

  /* Recepción y administración no tienen NINGUNA etapa declarada en su ficha:
     no pintan ni desabollan. Para ellas los dos paneles de etapas están vacíos
     siempre, no solo hoy, y un panel que nunca va a tener nada es ruido.
     Se dibujan únicamente si la cuenta sabe hacer algo con las manos. */
  const conEtapas = Modelo.tieneEtapas(yo.id);

  /* La tira de arriba: lo primero que la persona tiene que saber al abrir el
     telefono es cuanto tiene y cuanto ya entrego. */
  const porHacer = t.mias.length;
  const resumen = conEtapas ? `
  <div class="tira-agenda">
    <div class="dato ${porHacer ? 'aviso' : ''}">
      <span class="cifra">${porHacer}</span><span class="rot">por hacer</span></div>
    <div class="dato">
      <span class="cifra">${t.disponibles.length}</span><span class="rot">${reparteElJefe
        ? 'sin asignar' : 'para tomar'}</span></div>
    <div class="dato">
      <span class="cifra">${t.aCargo.length}</span><span class="rot">a mi cargo</span></div>
  </div>` : '';

  /* La bandeja del que valida NO se dibuja acá. Tiene módulo propio —«Por
     validar»— desde el 22-08-2026, porque el jefe de taller no aterriza en
     esta pantalla y se quedaba sin puerta para llegar a lo único que sólo él
     puede hacer. Y porque dibujarla en dos lugares es exactamente el error
     que se repite en este proyecto: dos pantallas mostrando lo mismo, una de
     las dos siempre queda vieja. */
  return `
  ${t.aCargo.length ? `
  <div class="panel">
    <div class="cab"><div><h2>${ico('auto', 'g')}Vehículos a mi cargo</h2>
      <div class="desc">${puedePresupuestar
        ? 'Me los traspasaron en la recepción. Respondo por ellos hasta la entrega'
        : 'Los recibí yo. Respondo por ellos hasta la entrega, aunque la OR la arme el taller'}</div></div></div>
    <div class="grid-envoltorio"><table class="grid">
      <thead><tr><th>OT</th><th>Patente</th>${verCliente ? '<th>Cliente</th><th>Compañía</th>' : '<th>Vehículo</th>'}<th>Estado</th>
        <th>Etapa</th><th>Días</th><th>Presupuesto</th><th style="min-width:210px">Acción</th></tr></thead>
      <tbody>${t.aCargo.map((x) =>
        '<tr class="fila' + (x.sobreMeta ? ' alerta' : '') + '">' +
        '<td class="num"><strong>' + x.numeroOT + '</strong></td>' +
        '<td><span class="patente">' + esc(x.patente) + '</span></td>' +
        (verCliente
          ? '<td>' + esc(x.cliente) + '</td><td>' + esc(x.compania) + '</td>'
          : '<td>' + esc([x.marca, x.modelo].filter(Boolean).join(' ') || '—') + '</td>') +
        '<td><span class="et ' + esc(x.estadoClase) + '">' + esc(x.estado) + '</span></td>' +
        '<td>' + esc(x.etapa) + '</td>' +
        '<td class="num">' + x.dias + (x.sobreMeta ? ' <span class="et roja">sobre la meta</span>' : '') + '</td>' +
        '<td>' + (x.conPresupuesto
          ? '<span class="et verde">hecho</span>'
          : '<span class="et ambar">falta</span>') + '</td>' +
        '<td style="white-space:nowrap">' +
          (puedePresupuestar
            ? '<button class="btn' + (x.conPresupuesto ? ' secundario' : '') + '" data-mt-presu="' + esc(x.ot_id) + '">' +
              (x.conPresupuesto ? 'Ver presupuesto' : 'Presupuestar') + '</button> '
            : '') +
          '<button class="btn secundario" data-mt-abrir="' + esc(x.numeroOT) + '">Ver orden</button>' +
        '</td></tr>').join('')}</tbody>
    </table></div>
  </div>` : ''}

  ${conEtapas ? `
  ${resumen}
  <div class="panel destacado">
    <div class="cab"><div><h2>${ico('taller', 'g')}Mi trabajo</h2>
      <div class="desc">Lo que me asignaron. Al terminar una etapa queda cerrada</div></div>
      <span class="et ${porHacer ? 'azul' : 'verde'}">${porHacer
        ? porHacer + (porHacer === 1 ? ' etapa abierta' : ' etapas abiertas') : 'nada pendiente'}</span></div>
    <div class="cuerpo">
      ${t.mias.length
        ? gruposDeTrabajo(t.mias, true, reparteElJefe)
        : '<div class="vacio">' + ico('check') + '<div class="titulo">No tienes nada asignado</div>' +
          '<div class="texto">' + (reparteElJefe
            ? 'Cuando el jefe de taller te asigne una etapa, aparece acá con quién te la dio y cuándo.'
            : 'Abajo está lo que puedes tomar según las etapas que tienes habilitadas.') +
          '</div></div>'}
    </div>
    ${t.mias.length && Modelo.puede('foto.cargar') ? `
    <div class="cuerpo">
      <fieldset class="bloque"><legend>Foto del avance</legend>
        <div class="rejilla-campos" style="margin-bottom:9px">
          <div class="campo"><label>¿De cuál de tus órdenes?</label>
            <select id="mt-foto-ot">${t.mias.map((x) =>
              '<option value="' + esc(x.ot_id) + '">OT ' + x.numeroOT + ' · ' + esc(x.patente) +
              ' · ' + esc(x.etapa) + '</option>').join('')}</select></div>
        </div>
        ${zonaFotos({ id: 'mtfoto', fotos: [], titulo: 'Agregar fotos de cómo va el trabajo' })}
      </fieldset>
    </div>` : ''}
  </div>

  <div class="panel">
    <div class="cab"><div><h2>${ico('nuevo', 'g')}${reparteElJefe
      ? 'Lo que viene' : 'Disponible para tomar'}</h2>
      <div class="desc">${reparteElJefe
        ? 'Etapas abiertas de las que sabes hacer, todavía sin encargado. En este taller las reparte ' +
          'el jefe: están acá para saber qué viene, no para agarrarlas'
        : 'Etapas abiertas que nadie tomó, de las que sabes hacer'}</div></div></div>
    <div class="cuerpo">
      ${t.disponibles.length
        ? gruposDeTrabajo(t.disponibles, false, reparteElJefe)
        : '<div class="vacio">' + ico('auto') + '<div class="titulo">' +
          (reparteElJefe ? 'Nada esperando asignación' : 'Nada disponible ahora') + '</div>' +
          '<div class="texto">Cuando entre un vehículo que pase por tus etapas, aparece acá.</div></div>'}
    </div>
  </div>` : ''}

  ${!conEtapas && !t.aCargo.length ? `
  <div class="panel"><div class="cuerpo"><div class="vacio">${ico('auto')}
    <div class="titulo">Nada a tu nombre ahora</div>
    <div class="texto">Acá aparecen los vehículos que recibiste o que te traspasaron.</div>
  </div></div></div>` : ''}`;
}

/* ══ LOS BOTONES DE LA REVISIÓN ════════════════════════════════════════
   Están en dos pantallas —«Por validar», que es la bandeja del jefe, y «Mi
   trabajo» de quien además valida— así que se cablean UNA vez y las dos la
   llaman. Escribirlo dos veces es cómo se llega a que un botón funcione en
   una pantalla y en la otra no. */
function engancharRevision() {
  const par = (b, attr) => b.dataset[attr].split('|');

  document.querySelectorAll('[data-mt-validar]').forEach((b) => b.addEventListener('click', () => {
    const [ot, etapa] = par(b, 'mtValidar');
    ejecutar(() => Modelo.validar_etapa(ot, etapa),
      'Aceptada. La orden ya avanzó en la torre.');
  }));

  document.querySelectorAll('[data-mt-devolver]').forEach((b) => b.addEventListener('click', () => {
    const [ot, etapa] = par(b, 'mtDevolver');
    /* El motivo se PIDE, no es opcional: una devolucion sin motivo deja al
       encargado mirando la misma etapa otra vez sin saber que rehacer. La
       regla lo exige igual; esto es para no hacerle dar el viaje en vano. */
    const razon = prompt('¿Por qué se devuelve? El encargado tiene que saber qué rehacer.');
    if (razon === null) return;
    ejecutar(() => Modelo.devolver_etapa(ot, etapa, razon),
      'Devuelta al encargado con el motivo.');
  }));

  document.querySelectorAll('[data-mt-abrir]').forEach((b) => b.addEventListener('click', () =>
    abrirFicha(b.dataset.mtAbrir)));
}

/* La pantalla «Por validar» no tiene nada más que los botones de la revisión:
   no hay etapas propias que tomar ni fotos que subir. */
function pPorValidar() { engancharRevision(); }

function pMiTrabajo() {
  const yo = Modelo.personaActual();
  if (!yo) return;

  const par = (b, attr) => b.dataset[attr].split('|');

  document.querySelectorAll('[data-mt-tomar]').forEach((b) => b.addEventListener('click', () => {
    const [ot, etapa] = par(b, 'mtTomar');
    ejecutar(() => Modelo.tomar_etapa(ot, etapa, yo.id), 'Tomaste esa etapa. Queda a tu nombre.');
  }));

  document.querySelectorAll('[data-mt-soltar]').forEach((b) => b.addEventListener('click', () => {
    const [ot, etapa] = par(b, 'mtSoltar');
    ejecutar(() => Modelo.soltar_etapa(ot, etapa), 'La devolviste a la lista.');
  }));

  /* "Termine" DECLARA terminado. Con la validación encendida no cierra la
     etapa: la deja esperando el visto bueno del jefe, y el aviso lo dice —si
     dijera "cerrada" el operario se iria creyendo que el auto avanzo—. Si
     quien aprieta es el propio revisor, se cierra en el acto. */
  document.querySelectorAll('[data-mt-cerrar]').forEach((b) => b.addEventListener('click', () => {
    const [ot, etapa] = par(b, 'mtCerrar');
    const cierraSolo = !Reglas.exigeValidacion(Modelo.base()) || Modelo.puede('etapa.validar');
    ejecutar(() => Modelo.finalizar_etapa(ot, etapa, yo.id),
      cierraSolo
        ? 'Etapa cerrada. La orden ya avanzó en la torre.'
        : 'Quedó terminada, esperando el visto bueno del jefe de taller.');
  }));

  engancharRevision();

  // El presupuesto de una orden a mi cargo, sin pasar por el listado.
  document.querySelectorAll('[data-mt-presu]').forEach((b) => b.addEventListener('click', () => {
    presuEstado().otId = b.dataset.mtPresu;
    presuEstado().presupuestoId = null;
    ir('presupuesto');
  }));

  /* Las fotos del avance se suben desde acá, que es donde está la persona
     trabajando. Antes había que ir a la ficha de la orden: dos pantallas de
     distancia para algo que se hace con el celular en la mano.

     Quien no tiene `foto.cargar` no ve el bloque, y por lo tanto tampoco hay
     nada que cablear: el pintor no sube fotos, cierra su etapa. */
  if (!Modelo.puede('foto.cargar')) return;
  montarZonaFotos({
    id: 'mtfoto', momento: 'proceso',
    ot_id: (document.getElementById('mt-foto-ot') || {}).value || null,
    alSubir: (fichas) => {
      const sel = document.getElementById('mt-foto-ot');
      const ot = sel ? sel.value : null;
      if (!ot) return;
      const r = Modelo.adjuntar_media(null, [ot], fichas);
      if (r && r.ok === false) return avisar(r);
      render();
    }
  });
}
