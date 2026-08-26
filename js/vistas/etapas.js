/* ETAPAS — asignar y finalizar. Son DOS pantallas en el original y acá también.

   ⚠️ El ciclo completo —quién asigna, quién termina y quién da el visto bueno— NO existe
   en el sistema actual: allá cerrar una etapa la cierra y se acabó. Es desarrollo nuevo
   y se cotiza aparte (C-43).

   Detalle y decisiones: 00 Documentacion/DECISIONES.md · js/vistas/etapas.js */

/* La regla de enrutamiento del original, tal cual. */
const modoEtapasPorDefecto = (o) => (o.etapasAsignadas.length ? 'finalizar' : 'asignar');

function vEtapas(o) {
  /* Asignar y finalizar son permisos distintos, y acá se nota: quien reparte
     el trabajo declara qué etapas aplican; quien lo hace, las cierra. Sin
     `etapa.asignar` no se ofrece el conmutador ni se puede caer en esa
     pantalla —el operario entraba y tenía a mano las nueve casillas—. */
  const puedeAsignar = Modelo.puede('etapa.asignar');
  const modo = puedeAsignar ? (ui.ficha.modoEtapas || modoEtapasPorDefecto(o)) : 'finalizar';
  const cuerpo = modo === 'asignar' ? vAsignarEtapas(o) : vFinalizarEtapas(o);

  /* 🔶 DOS COLUMNAS CUANDO ES PANTALLA PROPIA (26-08-2026): las etapas a la
     izquierda y el historial de la orden a la derecha, como el original. Quien
     reparte el trabajo mira las dos cosas a la vez — qué falta y qué ya pasó—
     sin cambiar de pestaña.

     Dentro de la ficha NO se pone: ahí el historial ya tiene su propia
     pestaña, y repetirlo al lado sería el mismo dato dos veces en la misma
     pantalla. */
  const solo = ui.ficha && ui.ficha.soloEtapas;
  const conHistorial = solo && Modelo.puede('ficha.completa');

  return `
  <div class="${conHistorial ? 'pantalla-etapas' : ''}">
  <div class="panel">
    <div class="cab">
      <div><h2>${ico('taller', 'g')}${modo === 'asignar' ? 'Asignar etapas' : 'Finalizar etapas'}
        OR ${esc(o.presupuestos.length ? o.presupuestos[0].numeroOR : o.numeroOT)}</h2>
        <div class="desc">${modo === 'asignar'
          ? 'Qué etapas aplican a este vehículo. No todas aplican a todos.'
          : 'Cerrar etapas y fijar la entrega probable. Se pueden cerrar varias de una vez.'}</div></div>
      ${puedeAsignar ? `<div class="chips">
        <button class="chip${modo === 'asignar' ? ' activo' : ''}" data-modoetapa="asignar">Asignar</button>
        <button class="chip${modo === 'finalizar' ? ' activo' : ''}" data-modoetapa="finalizar">Finalizar</button>
      </div>` : ''}
    </div>
    <div class="cuerpo">${cuerpo}</div>
  </div>
  ${/* El historial, tal cual lo pinta su pestaña. Es la MISMA función, no una
       copia: dos marcados del mismo dato se despegan sin que nadie lo note. */''}
  ${conHistorial ? fichaHistorial(o) : ''}
  </div>
  ${/* 🔶 LA BITÁCORA VA DEBAJO, como en el sistema actual (15-08-2026).

       En el original la pantalla de asignar etapas termina en `Bitácora de
       observaciones`, con su destinatario, su asunto y su casilla de mensaje.
       No es decoración: se reparten las etapas y ahí mismo se le avisa a
       bodega que faltan repuestos, sin cambiar de pantalla ni perder de vista
       la orden que se está mirando.

       Es el MISMO panel de la pestaña Bitácora, no una copia: se pinta con
       `fichaBitacora` y se cablea con `pFichaBitacora`. Dos copias del mismo
       formulario se despegan sin que nadie lo note. */''}
  ${Modelo.puede('ficha.completa') ? fichaBitacora(o) : ''}`;
}

/* ── Asignar ───────────────────────────────────────────────────────────── */

function vAsignarEtapas(o) {
  const asignadas = o.etapasAsignadas;
  const enc = (c) => asignadas.find((x) => x.codigo === c);

  /* 🔶 UNA TABLA, COMO EL ORIGINAL (26-08-2026, pedido del cliente).

     Antes eran dos grupos de tarjetas: «Ya asignadas» arriba y «Agregar
     etapas» abajo. Mostraban lo mismo, pero repartido en dos listas y con dos
     formas distintas — había que leer las dos para saber cómo estaba la orden.
     Ahora son las nueve etapas en una sola tabla, en su orden, con su estado en
     una columna. Es el formato del sistema real.

     🔴 SE COPIA EL FORMATO, NO EL DEFECTO. El original muestra las nueve
     casillas EN BLANCO aunque la orden ya tenga etapas cerradas —es el hallazgo
     C-9 / C-15 / FUN-6 de la auditoría y una de las correcciones que se le
     vendieron al cliente—. Acá las asignadas llegan marcadas, las cerradas se
     ven cerradas con su fecha, y solo se puede desmarcar lo que sigue abierto.

     El desplegable de responsable aparece SOLO en la fila marcada, como allá.
     Y ofrece solo a quien tiene esa etapa habilitada en su ficha de Personal,
     que es el único modelo de permisos real que tiene el sistema actual. */
  const gentePara = (codigo) => {
    const etapa = Modelo.base().etapa.find((x) => x.codigo === codigo) || {};
    return Modelo.personasParaEtapa(etapa.id);
  };

  /* La carga de cada persona AHORA, para que el que reparte no reparta a
     ciegas. No es un tope —Marco fue explícito en que no hay límite de autos
     por persona—: es información para decidir. */
  const carga = Modelo.cargaDelEquipo();
  const cuantoTiene = (id) => (carga.get(id) || { abiertas: 0 }).abiertas;

  const fila = (e, i) => {
    const a = enc(e.codigo);
    const gente = gentePara(e.codigo);
    const cerrada = !!(a && a.finalizada);

    const estado = cerrada
      ? '<span class="et verde">Cerrada</span> <span class="pie-nota" style="margin:0">' +
        esc(a.finalizadaAt ? fFecha(a.finalizadaAt) : '') + '</span>'
      : a
        ? (a.esperandoValidacion
            ? '<span class="et ambar">Esperando visto bueno</span>'
            : '<span class="et azul">En curso</span>')
        : '<span style="color:var(--gris-2)">Sin asignar</span>';

    /* En una etapa cerrada el encargado es un HECHO, no una elección: se
       muestra como texto. Cambiarlo sería reescribir quién hizo el trabajo. */
    const responsable = cerrada
      ? '<span>' + esc(a.responsable || a.terminadaPor || '—') + '</span>'
      : gente.length
        ? '<span class="resp-etapa"' + (a ? '' : ' hidden') + '>' +
          '<select data-respasignar="' + esc(e.codigo) + '">' +
          '<option value="">Seleccionar encargado</option>' +
          gente.map((per) => '<option value="' + esc(per.id) + '"' +
            (a && a.responsableId === per.id ? ' selected' : '') + '>' +
            esc(per.nombre) + ' (' + cuantoTiene(per.id) + ')</option>').join('') +
          '</select></span>'
        : '<span class="et ambar" title="Se habilita en la ficha de cada persona">' +
          'Nadie habilitado</span>';

    return '<tr' + (cerrada ? ' class="etapa-cerrada"' : '') + '>' +
      '<td class="num">' + (i + 1) + '</td>' +
      '<td><label class="etapa-casilla">' +
        '<input type="checkbox" data-asignar="' + esc(e.codigo) + '"' +
        (a ? ' checked' : '') + (cerrada ? ' data-cerrada="1"' : '') + '>' +
        '<i class="punto" style="background:' + esc(e.color) + '"></i>' + esc(e.nombre) +
        (e.opcional ? ' <span class="pie-nota" style="margin:0" ' +
          'title="Un tapabarro o un espejo no pasa por mecánica">no siempre</span>' : '') +
      '</label></td>' +
      '<td>' + estado + '</td>' +
      '<td>' + responsable + '</td></tr>';
  };

  /* 🔴 LAS ETAPAS QUE NADIE PUEDE HACER, DICHAS DE UNA VEZ (22-08-2026).
     Con la nómina que entregó Andrés —los usuarios de la web de hoy— cuatro de
     las nueve etapas no las tiene habilitada ninguna cuenta: quien pinta y
     quien desabolla no tiene cuenta en el sistema. Hoy da igual porque el
     sistema actual no registra quién hizo qué; con el visto bueno del jefe deja
     de dar igual, porque estaría asignando a nadie. */
  const huerfanas = ETAPAS.filter((e) => !enc(e.codigo) && !gentePara(e.codigo).length);

  return `
  <div class="grid-envoltorio"><table class="grid tabla-etapas">
    <thead><tr><th style="width:38px">N°</th><th>Etapa</th><th>Estado</th><th>Responsable</th></tr></thead>
    <tbody>${ETAPAS.map(fila).join('')}</tbody>
  </table></div>

  ${huerfanas.length ? '<div class="aviso-etapas">' + ico('alerta', 'g') +
    '<div><strong>' + huerfanas.length + ' de estas etapas no las puede hacer ninguna cuenta: ' +
    esc(huerfanas.map((e) => e.nombre).join(', ')) + '.</strong> ' +
    'Se pueden asignar igual y quedan sin encargado, pero entonces el sistema no va a poder ' +
    'decir quién las hizo. Se habilita en <em>Personal</em>, en la ficha de cada persona — ' +
    'y si quien hace ese trabajo todavía no tiene cuenta, hay que creársela.</div></div>' : ''}

  <div class="pie-asignar">
    ${/* 🔴 `Guardar` se aprieta SIEMPRE. Si no hay nada que cambiar, se rechaza
         y se dice — ninguna regla de este sistema se enseña apagando un botón. */''}
    <button class="btn" id="btn-asignar">Guardar</button>
    <button class="btn secundario" id="btn-etapas-cancelar">Cancelar</button>
    <span class="pie-nota" style="margin:0">Queda registrado quién asignó y cuándo.
      Una etapa ya cerrada no se puede desmarcar: el historial no se edita.</span>
  </div>`;
}

/* ── Finalizar ─────────────────────────────────────────────────────────── */

function vFinalizarEtapas(o) {
  const asignadas = o.etapasAsignadas;
  if (!asignadas.length) {
    return '<div class="vacio"><div class="titulo">Esta orden no tiene etapas asignadas</div>' +
      '<div class="texto">Primero hay que declarar qué etapas aplican a este vehículo, ' +
      'en la pestaña <strong>Asignar</strong>.</div></div>';
  }

  const abiertas = asignadas.filter((x) => !x.finalizada);

  /* Quien reparte el trabajo cierra cualquier etapa y elige a nombre de quién.
     Quien lo hace con las manos cierra LA SUYA y a su nombre: no hay lista de
     personas que desplegar, porque no está eligiendo por nadie. */
  const reparte = Modelo.puede('etapa.asignar');
  const yo = Modelo.personaActual();
  const esMia = (a) => {
    if (reparte) return true;
    const etapa = Modelo.base().etapa.find((x) => x.codigo === a.codigo) || {};
    const oe = Modelo.base().ot_etapa.find((x) => x.ot_id === o.id && x.etapa_id === etapa.id && !x.salio_at);
    return !!(yo && oe && oe.persona_id === yo.id);
  };
  const mias = abiertas.filter(esMia);

  return `
  <div class="grid-envoltorio"><table class="grid">
    <thead><tr><th style="width:34px"></th><th>Estado</th><th>Etapa</th><th style="width:34%">Responsable</th><th>Cerrada</th></tr></thead>
    <tbody>${asignadas.map((a) => {
      const etapa = Modelo.base().etapa.find((x) => x.codigo === a.codigo) || {};
      const gente = Modelo.personasParaEtapa(etapa.id);
      const mia = esMia(a);
      return '<tr><td style="text-align:center">' +
        // La etapa cerrada PIERDE la casilla. En el original, `Desarme` la
        // conserva: es un error de renderizado que no se replica.
        (a.finalizada || !mia ? '' : '<input type="checkbox" data-cerrar="' + esc(a.codigo) + '">') + '</td>' +
        '<td>' + (a.finalizada
          ? '<span class="et verde">Completado</span>'
          : '<span class="et gris">Pendiente</span>') + '</td>' +
        '<td><i class="punto" style="background:' + a.color + '"></i><strong>' + esc(a.nombre) + '</strong></td>' +
        '<td>' + (a.finalizada
          ? '<span>' + esc(a.responsable || '—') + '</span>'
          : !reparte
            ? (mia ? '<span>' + esc(nombreCuenta(yo)) + '</span>'
                   : '<span style="color:var(--gris-2)">' + esc(a.responsable || 'de otra persona') + '</span>')
            : '<select data-resp="' + esc(a.codigo) + '">' +
              (gente.length
                ? gente.map((p) => '<option value="' + esc(p.id) + '">' + esc(p.nombre) + '</option>').join('')
                : '<option value="">Nadie habilitado para esta etapa</option>') + '</select>') + '</td>' +
        '<td class="num">' + (a.finalizadaAt ? fFechaHora(a.finalizadaAt) : '—') + '</td></tr>';
    }).join('')}</tbody>
  </table></div>

  ${Modelo.puede('foto.cargar') ? `<fieldset class="bloque" style="margin-top:12px"><legend>Fotografía del avance</legend>
    ${zonaFotos({ id: 'etapafoto', fotos: Modelo.mediaDe(o.id, 'proceso'),
      titulo: 'Agregar fotos del avance' })}
  </fieldset>` : ''}

  ${reparte ? `<div class="rejilla-campos" style="margin-top:12px">
    <div class="campo"><label>Fecha probable de entrega</label>
      ${/* Con hora, igual que la columna Fecha de Entrega que la muestra y que
           el panel de Entregar Unidad que la escribe. Era sólo fecha y el
           compromiso aparecía a las 00:00 en la torre: una hora que nadie
           comprometió. */''}
      <input type="datetime-local" id="f-compromiso"
        value="${o.fechaCompromiso ? isoConHora(o.fechaCompromiso) : ''}">
      <span class="ayuda">Día y hora. En el original el calendario está en inglés y no lleva hora</span></div>
    <div class="campo"><label>&nbsp;</label>
      <button class="btn secundario" id="btn-compromiso">Guardar la fecha</button></div>
  </div>` : ''}

  <div style="margin-top:11px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
    <button class="btn" id="btn-finalizar" ${mias.length ? '' : 'disabled'}>Finalizar las marcadas</button>
    <span class="pie-nota" style="margin:0">
      ${mias.length
        ? (reparte ? 'Abiertas ahora: ' : 'Tuyas y abiertas: ') + '<strong>' +
          mias.map((a) => esc(a.nombre)).join(', ') + '</strong>. ' +
          'Se pueden cerrar varias en un mismo guardado.'
        : abiertas.length
          ? 'Las etapas abiertas de esta orden las tiene otra persona.'
          : 'Todas las etapas asignadas están cerradas.'}
    </span>
  </div>
`;
}

// El nombre para mostrar de una cuenta. Las cuentas de rol no tienen apellido.
const nombreCuenta = (p) => (p ? [p.nombres, p.apellidos].filter(Boolean).join(' ') : '—');

/* ── Cableado ──────────────────────────────────────────────────────────── */

function pEtapas(o) {
  document.querySelectorAll('[data-modoetapa]').forEach((b) => b.addEventListener('click', () => {
    ui.ficha.modoEtapas = b.dataset.modoetapa; refrescarFicha();
  }));

  /* 🔶 EL DESPLEGABLE APARECE AL MARCAR, como en el original (26-08-2026).
     La fila sin marcar no ofrece encargado: todavía no hay etapa a la cual
     asignarlo. Al marcarla aparece y se lleva el foco, porque lo siguiente que
     hay que contestar es quién la hace. */
  document.querySelectorAll('[data-asignar]').forEach((c) => {
    const fila = c.closest('tr');
    if (!fila) return;
    c.addEventListener('change', () => {
      /* 🔴 UNA ETAPA CERRADA NO SE DESMARCA. No se apaga la casilla —ninguna
         regla de este sistema se enseña con un control apagado—: se deja
         apretar, se vuelve atrás y se explica por qué. El historial no se
         edita. */
      if (c.dataset.cerrada && !c.checked) {
        c.checked = true;
        return avisar({ ok: false, motivo: 'Esa etapa ya está cerrada y no se puede desmarcar: ' +
          'el historial de la orden no se edita. Si se cerró por error, hay que dejarlo dicho en ' +
          'la bitácora — que queda firmada— y no borrarlo.' });
      }
      const caja = fila.querySelector('.resp-etapa');
      if (caja) caja.hidden = !c.checked;
      const sel = fila.querySelector('select');
      if (c.checked && sel) sel.focus();
    });
  });

  /* 🔶 `Guardar` GUARDA LA TABLA ENTERA, no solo lo que se agrega. Desde que
     las nueve etapas viven en una sola tabla con su estado, desmarcar una es
     una acción tan válida como marcarla — antes eso era un botón «Quitar» en
     otra tarjeta, y había que entender que las dos listas eran la misma cosa.

     Se comparan las casillas contra lo que hay guardado: lo que se marcó se
     asigna, lo que se desmarcó se quita, y las que ya estaban se dejan como
     están. Las cerradas no entran en la comparación: no se pueden desmarcar. */
  const asignar = document.getElementById('btn-asignar');
  if (asignar) asignar.addEventListener('click', () => {
    const guardadas = o.etapasAsignadas;
    const abierta = (c) => guardadas.find((x) => x.codigo === c && !x.finalizada);
    const marcadas = Array.from(document.querySelectorAll('[data-asignar]:checked'))
      .map((c) => c.dataset.asignar);

    const nuevas = marcadas.filter((c) => !guardadas.some((x) => x.codigo === c));
    const quitadas = guardadas.filter((x) => !x.finalizada && marcadas.indexOf(x.codigo) < 0)
      .map((x) => x.codigo);

    /* 🔴 Y EL ENCARGADO DE LAS QUE YA ESTABAN. Sin esto el desplegable de una
       etapa ya asignada era un adorno: se elegía a alguien, se guardaba, y no
       pasaba nada — el peor resultado posible, porque el que reparte se queda
       creyendo que la asignó. Va por `tomar_etapa`, que es el procedimiento que
       existe para eso y el que revisa las reglas: si la etapa ya la tomó otro,
       rechaza y dice quién. */
    const tomas = [];
    guardadas.filter((x) => !x.finalizada).forEach((x) => {
      if (marcadas.indexOf(x.codigo) < 0) return;         // se está quitando
      const sel = document.querySelector('[data-respasignar="' + x.codigo + '"]');
      if (!sel || !sel.value) return;
      if (sel.value === x.responsableId) return;          // no cambió
      tomas.push({ codigo: x.codigo, persona_id: sel.value });
    });

    if (!nuevas.length && !quitadas.length && !tomas.length)
      return avisar({ ok: false, motivo: 'No cambiaste ninguna etapa. Marca las que aplican a este ' +
        'vehículo, desmarca las que no o elige un encargado, y vuelve a guardar.' });

    /* El encargado que se eligió en cada fila, por id de etapa. Va junto con la
       asignación y no en un segundo paso: es un solo gesto en el original —se
       marca la casilla, se elige la persona, se guarda— y partirlo en dos
       dejaría etapas asignadas sin dueño esperando que alguien vuelva. */
    const idDe = (c) => (Modelo.base().etapa.find((e) => e.codigo === c) || {}).id;
    const ids = nuevas.map(idDe);
    const responsables = {};
    nuevas.forEach((c, i) => {
      const sel = document.querySelector('[data-respasignar="' + c + '"]');
      if (sel && sel.value) responsables[ids[i]] = sel.value;
    });

    /* Se quita primero y se asigna después, y cada paso se cuenta aparte: si
       uno de los dos rebota, el aviso tiene que decir cuál. */
    const fallos = [];
    let quitas = 0;
    quitadas.forEach((c) => {
      const r = Modelo.quitar_etapa(o.id, c);
      if (r.ok) quitas++; else fallos.push(r.motivo);
    });
    let puestas = 0;
    if (ids.length) {
      const r = Modelo.asignar_etapas(o.id, ids, responsables);
      if (r.ok) puestas = ids.length; else fallos.push(r.motivo);
      (r.avisos || []).forEach((a) => avisar({ ok: false, motivo: a }));
    }

    let tomadas = 0;
    tomas.forEach((t) => {
      const r = Modelo.tomar_etapa(o.id, t.codigo, t.persona_id);
      if (r.ok) tomadas++; else fallos.push(r.motivo);
    });

    if (fallos.length) avisar({ ok: false, motivo: fallos.join(' · ') });
    if (puestas || quitas || tomadas) {
      const dicho = [];
      if (puestas) dicho.push(plural(puestas, 'etapa asignada', 'etapas asignadas'));
      if (quitas) dicho.push(plural(quitas, 'etapa quitada', 'etapas quitadas'));
      if (tomadas) dicho.push(plural(tomadas, 'encargado puesto', 'encargados puestos'));
      avisar({ ok: true, motivo: '' }, dicho.join(' y ') + '.');
      refrescarFicha();
    }
  });

  /* 🔶 `Cancelar` devuelve al Taller, que es de donde se llega. `ir()` deshace
     además la ventana de la orden —le devuelve el menú lateral y el título—,
     así que nadie queda encerrado en una pantalla sin salida. */
  const cancelar = document.getElementById('btn-etapas-cancelar');
  if (cancelar) cancelar.addEventListener('click', () => ir('taller'));

  const finalizar = document.getElementById('btn-finalizar');
  if (finalizar) finalizar.addEventListener('click', () => {
    const yo = Modelo.personaActual();
    const asignaciones = Array.from(document.querySelectorAll('[data-cerrar]:checked')).map((c) => {
      const sel = document.querySelector('[data-resp="' + c.dataset.cerrar + '"]');
      // Sin lista de personas —el que solo cierra lo suyo— la etapa se cierra
      // a nombre de quien entró. Es su firma en el historial.
      return { codigo: c.dataset.cerrar,
        persona_id: sel && sel.value ? sel.value : (yo ? yo.id : null) };
    });
    if (!asignaciones.length)
      return avisar({ ok: false, motivo: 'No marcaste ninguna etapa para finalizar.' });
    ejecutar(() => Modelo.finalizar_etapas(o.id, asignaciones),
      plural(asignaciones.length, 'etapa finalizada', 'etapas finalizadas') + ' en un solo guardado.');
  });

  // Las fotos del avance se suben apenas se sueltan: son del trabajo, no del
  // guardado. Quien no tiene `foto.cargar` no ve el bloque y no hay nada que
  // cablear.
  if (Modelo.puede('foto.cargar')) montarZonaFotos({
    id: 'etapafoto', momento: 'proceso', ot_id: o.id,
    alSubir: (fichas) => {
      Modelo.adjuntar_media(null, [o.id], fichas.map((x) => Object.assign(x, { ot_id: o.id })));
      refrescarFicha();
    }
  });

  const guardarFecha = document.getElementById('btn-compromiso');
  if (guardarFecha) guardarFecha.addEventListener('click', () => {
    const v = document.getElementById('f-compromiso').value;
    if (!v) return avisar({ ok: false, motivo: 'Hay que elegir una fecha y una hora.' });
    /* El input entrega 'aaaa-mm-ddTHH:MM'; se arma la fecha local a mano. Con
       `new Date(texto)` se interpreta como UTC y en Chile se corre un día. */
    const [fecha, hora] = v.split('T');
    const [a, m, d] = fecha.split('-').map(Number);
    const [hh, mm] = String(hora || '00:00').split(':').map(Number);
    if (!a || !m || !d) return avisar({ ok: false, motivo: 'La fecha no se entiende.' });
    ejecutar(() => Modelo.fijar_fecha_compromiso(o.id, new Date(a, m - 1, d, hh || 0, mm || 0)),
      'Fecha probable guardada.');
  });
}

const isoFecha = (d) => d.getFullYear() + '-' +
  String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
/* Para `datetime-local`, con la hora QUE TIENE la fecha —no la del reloj—,
   porque acá se está editando un compromiso ya guardado. */
const isoConHora = (d) => isoFecha(d) + 'T' +
  String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
