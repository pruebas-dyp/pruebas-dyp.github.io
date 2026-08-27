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

  return `
  <div class="etapas-con-historial">
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
  ${/* 🔴 EL HISTORIAL, AL LADO (26-08-2026, Marco: «acuérdate lo que te pedí con
       Etapas: si lo estamos sacando, debería abrir otro lado»).

       Al sacar las pestañas de la ficha, esta pantalla dejó de ser una pestaña
       y pasó a abrirse sola — y sola le faltaba la mitad. En el sistema que
       usan, «Asignar etapas» tiene el HISTORIAL a la derecha, y no es adorno:
       se reparte una etapa mirando quién hizo la anterior y cuándo la cerró.

       Es el MISMO panel del historial, no una copia: se pinta con
       `fichaHistorial`. Dos copias de la misma tabla se despegan sin que nadie
       lo note. */''}
  ${/* 🔶 LA BITÁCORA VA DEBAJO, como en el sistema actual (15-08-2026).

       En el original la pantalla de asignar etapas termina en `Bitácora de
       observaciones`, con su destinatario, su asunto y su casilla de mensaje.
       No es decoración: se reparten las etapas y ahí mismo se le avisa a
       bodega que faltan repuestos, sin cambiar de pantalla ni perder de vista
       la orden que se está mirando.

       Es el MISMO panel de la pestaña Bitácora, no una copia: se pinta con
       `fichaBitacora` y se cablea con `pFichaBitacora`. Dos copias del mismo
       formulario se despegan sin que nadie lo note. */''}
  ${Modelo.puede('ficha.completa') ? fichaHistorial(o) : ''}
  </div>
  ${Modelo.puede('ficha.completa') ? fichaBitacora(o) : ''}`;
}

/* ── Asignar ───────────────────────────────────────────────────────────── */

function vAsignarEtapas(o) {
  const asignadas = o.etapasAsignadas;
  const enc = (c) => asignadas.find((x) => x.codigo === c);

  /* 🔴 LA TABLA DEL SISTEMA ACTUAL (26-08-2026, Marco, con la captura al lado).

     Esto eran tarjetas: un bloque «Ya asignadas» arriba y otro «Agregar etapas»
     abajo, cada etapa en su propia caja de color. Se veía bien y no se parecía
     en nada a lo que ellos usan todos los días — y esta pantalla la abre el
     jefe de taller veinte veces al día.

     En su sistema es UNA tabla: N° · Etapa · Responsable, las nueve etapas
     siempre a la vista y en su orden, una casilla por fila, y Guardar y
     Cancelar abajo. Las que ya están asignadas salen marcadas; no hay dos
     listas que cruzar con la vista.

     ⚠️ LOS GANCHOS NO CAMBIAN: `data-asignar` en la casilla, `data-respasignar`
     en el desplegable, `#btn-asignar` para guardar y `data-quitaretapa` para
     sacar una. `pEtapas` sigue igual, sin tocar una línea. Es la forma, no la
     función.

     ENTREGA queda como en su sistema: en la lista, sin casilla y sin
     desplegable. No se asigna a nadie — es el cierre, no un trabajo. */
  const gentePara = (codigo) => {
    const etapa = Modelo.base().etapa.find((x) => x.codigo === codigo) || {};
    return Modelo.personasParaEtapa(etapa.id);
  };
  const carga = Modelo.cargaDelEquipo();
  const cuantoTiene = (id) => (carga.get(id) || { abiertas: 0 }).abiertas;

  const SIN_ASIGNAR = ['entrega'];
  const huerfanas = ETAPAS.filter((e) => SIN_ASIGNAR.indexOf(e.codigo) < 0 &&
    !enc(e.codigo) && !gentePara(e.codigo).length);

  const fila = (e, i) => {
    const a = enc(e.codigo);
    const noSeAsigna = SIN_ASIGNAR.indexOf(e.codigo) >= 0;
    const gente = gentePara(e.codigo);

    const casilla = noSeAsigna ? ''
      : '<input type="checkbox" data-asignar="' + esc(e.codigo) + '"' +
        (a ? ' checked' : '') + (a ? ' disabled title="Ya asignada"' : '') + '>';

    let responsable;
    if (noSeAsigna) {
      responsable = '<span style="color:var(--gris-2)">—</span>';
    } else if (a) {
      responsable = (a.responsable ? '<strong>' + esc(a.responsable) + '</strong>'
        : '<em style="color:var(--gris)">sin encargado</em>') +
        ' <span class="et ' + (a.finalizada ? 'verde' : (a.esperandoValidacion ? 'ambar' : 'gris')) + '">' +
        (a.finalizada ? 'cerrada' : (a.esperandoValidacion ? 'esperando visto bueno' : 'en curso')) + '</span>' +
        (!a.finalizada ? ' <button class="btn secundario" data-quitaretapa="' + esc(e.codigo) +
          '" title="Sacar esta etapa de la orden">Quitar</button>' : '');
    } else if (gente.length) {
      responsable = '<select data-respasignar="' + esc(e.codigo) + '">' +
        '<option value="">Seleccionar encargado</option>' +
        gente.map((per) => '<option value="' + esc(per.id) + '">' + esc(per.nombre) +
          ' (' + cuantoTiene(per.id) + ')</option>').join('') + '</select>';
    } else {
      responsable = '<span class="et ambar" title="Se habilita en Personal, en la ficha de cada persona">' +
        'Nadie habilitado</span>';
    }

    return '<tr' + (a ? ' class="ya"' : '') + '>' +
      '<td class="num">' + casilla + '</td>' +
      '<td><i class="punto" style="background:' + esc(e.color) + '"></i>' + esc(e.nombre) +
        (e.opcional ? ' <span class="et gris" title="Un tapabarro o un espejo no pasa por mecánica">no siempre</span>' : '') +
      '</td>' +
      '<td>' + responsable + '</td></tr>';
  };

  return `
  <div class="asignar-tabla">
    ${huerfanas.length ? '<div class="aviso-etapas">' + ico('alerta', 'g') +
      '<div><strong>' + huerfanas.length + ' de estas etapas no las puede hacer ninguna cuenta: ' +
      esc(huerfanas.map((e) => e.nombre).join(', ')) + '.</strong> ' +
      'Se pueden marcar igual y quedan sin encargado, pero entonces el sistema no va a poder decir ' +
      'quién las hizo. Se habilita en <em>Personal</em>, en la ficha de cada persona.</div></div>' : ''}

    <div class="grid-envoltorio"><table class="grid">
      <thead><tr><th style="width:52px">N°</th><th>Etapa</th><th>Responsable</th></tr></thead>
      <tbody>${ETAPAS.map(fila).join('')}</tbody>
    </table></div>

    <div class="pie-asignar">
      <button class="btn" id="btn-asignar">Guardar</button>
      <button class="btn secundario" id="btn-cancelar-etapas">Cancelar</button>
      <span class="pie-nota" style="margin:0">Queda registrado quién asignó y cuándo.
        Una etapa ya cerrada no se puede desmarcar: el historial no se edita.</span>
    </div>
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

  /* El desplegable del encargado ya NO se esconde: en la tarjeta vive siempre
     a la vista, debajo del nombre de la etapa, con la carga de cada persona al
     lado. Lo unico que queda es llevar el foco: al marcar la etapa, lo
     siguiente que hay que contestar es quien la hace. */
  document.querySelectorAll('[data-asignar]').forEach((c) => {
    const tarjeta = c.closest('.tarea');
    if (!tarjeta) return;
    c.addEventListener('change', () => {
      const sel = tarjeta.querySelector('select');
      if (c.checked && sel) sel.focus();
    });
  });

  const asignar = document.getElementById('btn-asignar');
  if (asignar) asignar.addEventListener('click', () => {
    const yaAsignadas = o.etapasAsignadas.map((x) => x.codigo);
    const codigos = Array.from(document.querySelectorAll('[data-asignar]:checked'))
      .map((c) => c.dataset.asignar)
      .filter((c) => yaAsignadas.indexOf(c) < 0);
    if (!codigos.length)
      return avisar({ ok: false, motivo: 'No hay ninguna etapa nueva marcada. Las que ya estaban asignadas no se vuelven a asignar.' });
    const ids = codigos.map((c) => (Modelo.base().etapa.find((e) => e.codigo === c) || {}).id);

    /* El encargado que se eligió en cada fila, por id de etapa. Va junto con
       la asignación y no en un segundo paso: es un solo gesto en el original
       —se marca la casilla, se elige la persona, se guarda— y partirlo en dos
       dejaría etapas asignadas sin dueño esperando que alguien vuelva. */
    const responsables = {};
    codigos.forEach((c, i) => {
      const sel = document.querySelector('[data-respasignar="' + c + '"]');
      if (sel && sel.value) responsables[ids[i]] = sel.value;
    });

    ejecutar(() => Modelo.asignar_etapas(o.id, ids, responsables),
      plural(codigos.length, 'etapa asignada', 'etapas asignadas') + '.');
  });

  document.querySelectorAll('[data-quitaretapa]').forEach((b) => b.addEventListener('click', () =>
    ejecutar(() => Modelo.quitar_etapa(o.id, b.dataset.quitaretapa), 'Etapa quitada.')));

  /* «Cancelar» está en su sistema al lado de «Guardar». Acá no borra nada —no
     hay nada guardado todavía— : deshace lo marcado y devuelve la pantalla a
     Finalizar, que es de donde se entra a repartir. */
  const cancelar = document.getElementById('btn-cancelar-etapas');
  if (cancelar) cancelar.addEventListener('click', () => {
    ui.ficha.modoEtapas = 'finalizar';
    refrescarFicha();
  });

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
