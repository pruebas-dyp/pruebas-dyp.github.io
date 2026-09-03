/* ETAPAS — asignar y finalizar, EN UNA SOLA PANTALLA.

   🔴 27-08-2026, Marco: «para que sea más fácil, el asignar y el finalizar
   etapas debe quedar todo en uno».

   Eran dos, porque en el sistema que usan son dos y así se replicó. Pero para
   avanzar un auto hay que hacer las dos cosas en la misma visita —«la mecánica
   sí aplica, y de paso el desarme ya está listo»— y con el conmutador eso eran
   dos guardados, en dos pantallas, sobre la MISMA tabla de nueve filas.

   Ahora es una tabla con dos casillas por fila y un solo Guardar:

     APLICA  — declara que la etapa va en este vehículo. Se apaga en cuanto
              queda asignada: sacarla es «Quitar», que pregunta.
     TERMINAR — boton por fila. Cierra la etapa al apretarlo, sin pasar por
              Guardar. Solo aparece si esta asignada, abierta y es suya.

   ⚠️ Y EL ENCARGADO PASÓ A SER UNO SOLO POR FILA. Antes había dos desplegables
   para la misma pregunta —uno en Asignar y otro en Finalizar— y podían
   contestar distinto: se asignaba a Felipe y se cerraba a nombre de Carlos sin
   que nada lo dijera. Uno por fila, con el que la tiene ya seleccionado.

   ⚠️ Asignar y cerrar siguen siendo PERMISOS DISTINTOS: quien no reparte no ve
   la columna Aplica ni el desplegable, y sólo puede cerrar lo suyo.

   El ciclo completo —quién asigna, quién termina y quién da el visto bueno— NO
   existe en el sistema actual: allá cerrar una etapa la cierra y se acabó. Es
   desarrollo nuevo y se cotiza aparte (C-43).

   Detalle y decisiones: 00 Documentacion/DECISIONES.md · js/vistas/etapas.js */

function vEtapas(o) {
  return `
  <div class="etapas-con-historial">
  <div class="panel">
    <div class="cab">
      <div><h2>${ico('taller', 'g')}Etapas OR ${esc(o.numeroOR || o.numeroOT)}</h2>
        <div class="desc">Qué etapas aplican a este vehículo y cuáles ya están cerradas.
          Se marca y se guarda una sola vez.</div></div>
    </div>
    <div class="cuerpo">${vEtapasTabla(o)}</div>
  </div>
  ${/* 🔴 EL HISTORIAL, AL LADO (26-08-2026, Marco: «acuérdate lo que te pedí con
       Etapas: si lo estamos sacando, debería abrir otro lado»).

       En el sistema que usan, esta pantalla tiene el HISTORIAL a la derecha, y
       no es adorno: se reparte una etapa mirando quién hizo la anterior y
       cuándo la cerró.

       Es el MISMO panel del historial, no una copia: se pinta con
       `fichaHistorial`. Dos copias de la misma tabla se despegan sin que nadie
       lo note. */''}
  ${Modelo.puede('ficha.completa') ? fichaHistorial(o) : ''}
  </div>
  ${/* 🔶 LA BITÁCORA VA DEBAJO, como en el sistema actual (15-08-2026). Se
       reparten las etapas y ahí mismo se le avisa a bodega que faltan
       repuestos, sin cambiar de pantalla. Mismo panel, no una copia. */''}
  ${Modelo.puede('ficha.completa') ? fichaBitacora(o) : ''}`;
}

function vEtapasTabla(o) {
  const asignadas = o.etapasAsignadas;
  const enc = (c) => asignadas.find((x) => x.codigo === c);
  const reparte = Modelo.puede('etapa.asignar');
  const yo = Modelo.personaActual();
  const carga = Modelo.cargaDelEquipo();
  const cuantoTiene = (id) => (carga.get(id) || { abiertas: 0 }).abiertas;

  /* Quien reparte cierra cualquier etapa; quien la hace con las manos cierra
     LA SUYA. Es la misma regla de antes, movida de pantalla. */
  const esMia = (a) => {
    if (reparte) return true;
    const etapa = Modelo.base().etapa.find((x) => x.codigo === a.codigo) || {};
    const oe = Modelo.base().ot_etapa.find((x) => x.ot_id === o.id && x.etapa_id === etapa.id && !x.salio_at);
    return !!(yo && oe && oe.persona_id === yo.id);
  };

  const gentePara = (codigo) => {
    const etapa = Modelo.base().etapa.find((x) => x.codigo === codigo) || {};
    return Modelo.personasParaEtapa(etapa.id);
  };

  /* ENTREGA no se asigna a nadie: es el cierre, no un trabajo. Va en la lista
     igual que en su sistema, sin casillas. */
  const SIN_ASIGNAR = ['entrega'];
  const huerfanas = ETAPAS.filter((e) => SIN_ASIGNAR.indexOf(e.codigo) < 0 &&
    !enc(e.codigo) && !gentePara(e.codigo).length);
  const abiertasMias = asignadas.filter((a) => !a.finalizada && esMia(a));

  const fila = (e) => {
    const a = enc(e.codigo);
    const noSeAsigna = SIN_ASIGNAR.indexOf(e.codigo) >= 0;
    const gente = gentePara(e.codigo);
    const mia = a ? esMia(a) : false;

    /* ── Aplica ── */
    let aplica = '';
    if (noSeAsigna) aplica = '';
    else if (a) aplica = '<input type="checkbox" checked disabled ' +
      'title="Ya asignada. Para sacarla, Quitar">';
    else if (reparte) aplica = '<input type="checkbox" data-asignar="' + esc(e.codigo) + '">';
    else aplica = '<span style="color:var(--gris-2)" title="Repartir etapas es del jefe de taller">—</span>';

    /* ── Encargado: UN desplegable por fila ── */
    let quien;
    if (noSeAsigna) quien = '<span style="color:var(--gris-2)">—</span>';
    else if (a && a.finalizada) quien = '<span>' + esc(a.responsable || '—') + '</span>';
    else if (!reparte) {
      quien = a
        ? (mia ? '<span>' + esc(nombreCuenta(yo)) + '</span>'
               : '<span style="color:var(--gris-2)">' + esc(a.responsable || 'de otra persona') + '</span>')
        : '<span style="color:var(--gris-2)">—</span>';
    } else if (gente.length) {
      /* ⚠️ El que la tiene va SELECCIONADO. Y si ya no figura entre los
         habilitados —cambió el reparto en Personal después de asignarla— se
         agrega igual: guardar no puede cambiarle el responsable a una etapa
         sin que nadie lo haya pedido. */
      const suyo = a && a.responsableId;
      const extra = suyo && !gente.some((p) => p.id === suyo)
        ? '<option value="' + esc(suyo) + '" selected>' + esc(a.responsable || 'el que la tiene') +
          ' · ya no habilitado</option>' : '';
      quien = '<select data-resp="' + esc(e.codigo) + '">' +
        (a ? '' : '<option value="">Seleccionar encargado</option>') + extra +
        /* 🔴 EL NUMERO SALIO DE LA LISTA (30-08-2026, Marco).

           Cada nombre terminaba en «(7)»: las etapas abiertas que ya tiene esa
           persona, para repartir mirando quien esta cargado. La intencion era
           buena y la forma no: un parentesis pegado al apellido se lee como
           parte del nombre —mas todavia en «carlos (Beto) Rodriguez (7)», que
           llevaba dos—.

           El dato no se pierde: queda en el globo que sale al posar el mouse
           sobre la opcion. La lista muestra nombres, que es lo que se elige. */
        gente.map((p) => '<option value="' + esc(p.id) + '"' +
          (suyo === p.id ? ' selected' : '') +
          ' title="' + esc(p.nombre) + ' tiene ' + cuantoTiene(p.id) +
          (cuantoTiene(p.id) === 1 ? ' etapa abierta' : ' etapas abiertas') + '">' +
          esc(p.nombre) + '</option>').join('') + '</select>';
    } else {
      quien = '<span class="et ambar" title="Se habilita en Personal, en la ficha de cada persona">' +
        'Nadie habilitado</span>';
    }

    /* 🔴 «CERRAR» ERA UNA CASILLA SIN ROTULO (30-08-2026, Marco: «no queda claro
       como se finalizan, como se van marcando que estan hechas; hazlo mas
       simple»).

       Habia una columna CERRAR con un cuadradito vacio, y para que sirviera de
       algo habia que ademas bajar y apretar Guardar. Nadie adivina eso. La
       columna se fue entera y en su lugar hay un boton que dice **Terminar** y
       termina: un clic, y la fila pasa a «Terminada» con su fecha.

       Asignar sigue siendo por casillas y un Guardar —ahi se eligen varias
       cosas a la vez y conviene revisarlas juntas—, pero terminar es un acto
       suelto, del que la hizo, y en el momento en que la hizo. */
    let estado;
    if (!a) estado = noSeAsigna
      ? '<span style="color:var(--gris-2)">—</span>'
      : '<span class="et gris">No aplica todavía</span>';
    else if (a.finalizada) estado = '<span class="et verde">Terminada</span>';
    else estado = '<span class="et azul">En curso</span>';

    const acciones = (a && !a.finalizada && mia)
      ? '<button class="btn" data-terminar="' + esc(a.codigo) + '" ' +
        'title="Dar esta etapa por terminada. Queda con tu nombre y la hora.">Terminar</button>'
      : '';

    return '<tr' + (a ? ' class="ya"' : '') + '>' +
      '<td class="num">' + aplica + '</td>' +
      '<td><i class="punto" style="background:' + esc(e.color) + '"></i>' + esc(e.nombre) +
      /* 🔴 ACÁ IBA LA ETIQUETA «no siempre» DE MECÁNICA (27-08-2026, Marco:
         «sácale lo que dice a Mecánica el no siempre»). Era verdad —un
         tapabarro no pasa por mecánica— pero es verdad de TODAS: por eso
         existe la columna Aplica. Un cartel al lado de una sola etapa hace
         pensar que las otras ocho sí son obligatorias. */
      '</td>' +
      '<td>' + quien + '</td>' +
      '<td>' + estado +
        (a && a.finalizadaAt
          ? ' <span class="cod" style="color:var(--gris)">' + fFechaHora(a.finalizadaAt) + '</span>' : '') +
        '</td>' +
      '<td class="acciones-etapa">' + acciones +
        (a && !a.finalizada && reparte
          ? ' <button class="btn secundario" data-quitaretapa="' + esc(e.codigo) +
            '" title="Sacar esta etapa de la orden">Quitar</button>' : '') + '</td></tr>';
  };

  return `
  <div class="asignar-tabla">
    ${huerfanas.length ? '<div class="aviso-etapas">' + ico('alerta', 'g') +
      '<div><strong>' + huerfanas.length + ' de estas etapas no las puede hacer ninguna cuenta: ' +
      esc(huerfanas.map((e) => e.nombre).join(', ')) + '.</strong> ' +
      'Se pueden marcar igual y quedan sin encargado, pero entonces el sistema no va a poder decir ' +
      'quién las hizo. Se habilita en <em>Personal</em>, en la ficha de cada persona.</div></div>' : ''}

    <div class="grid-envoltorio"><table class="grid">
      <thead><tr>
        <th style="width:54px" title="La etapa va en este vehículo">Aplica</th>
        <th>Etapa</th><th style="width:30%">Encargado</th>
        <th style="width:170px">Estado</th>
        <th style="width:150px"></th>
      </tr></thead>
      <tbody>${ETAPAS.map(fila).join('')}</tbody>
    </table></div>

    ${Modelo.puede('foto.cargar') ? `<fieldset class="bloque" style="margin-top:12px"><legend>Fotografía del avance</legend>
      ${zonaFotos({ id: 'etapafoto', fotos: Modelo.mediaDe(o.id, 'proceso'),
        titulo: 'Agregar fotos del avance' })}
    </fieldset>` : ''}

    ${reparte ? `<div class="rejilla-campos" style="margin-top:12px">
      <div class="campo"><label>Fecha probable de entrega</label>
        ${/* Con hora, igual que la columna Fecha de Entrega que la muestra. Era
             sólo fecha y el compromiso aparecía a las 00:00 en la torre. */''}
        <input type="datetime-local" id="f-compromiso"
          value="${o.fechaCompromiso ? isoConHora(o.fechaCompromiso) : ''}">
        <span class="ayuda">${o.compromisos && o.compromisos.length > 1
          ? 'Se ha movido ' + (o.compromisos.length - 1) +
            (o.compromisos.length === 2 ? ' vez' : ' veces') + '. Cada cambio queda guardado'
          : 'Cambiarla queda guardado: la primera fecha es la que se le prometió al cliente'}</span></div>
    </div>` : ''}

    <div class="pie-asignar">
      ${/* 🔴 MARCAR TODAS (27-08-2026, Marco: «nos falta un botón de asignar
           todas las etapas»). El caso normal es que el auto pase por casi
           todas: marcar ocho casillas a mano, una por una, para desmarcar una
           es trabajo que el sistema puede hacer.

           ⚠️ MARCA, NO GUARDA. Deja las casillas puestas y el encargado por
           elegir; guardar sigue siendo un acto aparte. Un botón que asignara
           las nueve de una vez, sin encargado y sin revisar, sería más rápido
           de apretar y más caro de deshacer. */''}
      ${reparte ? '<button class="btn secundario" id="btn-etapas-todas">Marcar todas</button>' : ''}
      <button class="btn" id="btn-etapas-guardar">Guardar</button>
      <button class="btn secundario" id="btn-cancelar-etapas">Cancelar</button>
      <span class="pie-nota" style="margin:0">Marca <strong>Aplica</strong>, elige el
        encargado y guarda. Para dar una etapa por terminada, aprieta
        <strong>Terminar</strong> en su fila: eso no pasa por Guardar.
        ${abiertasMias.length
          ? 'Abiertas ahora: <strong>' + esc(abiertasMias.map((a) => a.nombre).join(', ')) + '</strong>.'
          : 'Ninguna etapa abierta a tu nombre.'}
        Queda registrado quién y cuándo; una etapa cerrada no se desmarca.</span>
    </div>
  </div>`;
}

// El nombre para mostrar de una cuenta. Las cuentas de rol no tienen apellido.
const nombreCuenta = (p) => (p ? [p.nombres, p.apellidos].filter(Boolean).join(' ') : '—');

/* ── Cableado ──────────────────────────────────────────────────────────── */

function pEtapas(o) {
  /* Al marcar «Aplica», lo siguiente que hay que contestar es quién la hace:
     se le lleva el foco al desplegable de la misma fila. */
  document.querySelectorAll('[data-asignar]').forEach((c) => {
    const fila = c.closest('tr');
    if (!fila) return;
    c.addEventListener('change', () => {
      const sel = fila.querySelector('select[data-resp]');
      if (c.checked && sel) sel.focus();
    });
  });

  const todas = document.getElementById('btn-etapas-todas');
  if (todas) todas.addEventListener('click', () => {
    const libres = Array.from(document.querySelectorAll('[data-asignar]')).filter((c) => !c.checked);
    if (!libres.length) return avisar({ ok: false, motivo: 'Todas las etapas que se pueden asignar ya están marcadas.' });
    libres.forEach((c) => { c.checked = true; });
    // El foco al primer encargado sin elegir: es lo que falta contestar.
    const sel = document.querySelector('select[data-resp]');
    if (sel) sel.focus();
    avisar({ ok: true, motivo: '' }, libres.length +
      (libres.length === 1 ? ' etapa marcada' : ' etapas marcadas') +
      '. Elige los encargados y aprieta Guardar.');
  });

  document.querySelectorAll('[data-quitaretapa]').forEach((b) => b.addEventListener('click', () =>
    ejecutar(() => Modelo.quitar_etapa(o.id, b.dataset.quitaretapa), 'Etapa quitada.')));

  /* 🔴 TERMINAR, EN UN CLIC (30-08-2026, Marco). El boton cierra SU etapa y
     nada mas: no toca lo que este marcado en Aplica ni la fecha de entrega,
     que siguen esperando a Guardar. Se cierra a nombre de quien la tiene —o de
     quien aprieta, si no hay desplegable, que es el caso del operario que solo
     cierra lo suyo—. */
  document.querySelectorAll('[data-terminar]').forEach((b) => b.addEventListener('click', () => {
    const codigo = b.dataset.terminar;
    const yo = Modelo.personaActual();
    const sel = document.querySelector('[data-resp="' + codigo + '"]');
    const quien = (sel && sel.value) ? sel.value : (yo ? yo.id : null);
    const etapa = (Modelo.base().etapa || []).find((e) => e.codigo === codigo) || {};
    ejecutar(() => Modelo.finalizar_etapas(o.id, [{ codigo, persona_id: quien }]),
      (etapa.nombre || 'La etapa') + ' quedó terminada.');
  }));

  /* 🔴 UN SOLO GUARDADO (27-08-2026, Marco: «todo en uno»). Asigna lo marcado
     en Aplica, cierra lo marcado en Cerrar y guarda la fecha si cambió, en ese
     orden —una etapa se puede asignar y cerrar en el mismo gesto—.

     ⚠️ LA FECHA SÓLO SI CAMBIÓ. Desde que cada fecha comprometida queda
     guardada con su número, escribirla igual en cada guardado llenaría la
     historia de fechas repetidas y el «se movió 3 veces» dejaría de significar
     algo. */
  const guardar = document.getElementById('btn-etapas-guardar');
  if (guardar) guardar.addEventListener('click', () => {
    const base = Modelo.base();
    const yaAsignadas = o.etapasAsignadas.map((x) => x.codigo);

    /* ⚠️ SE LEE TODA LA PANTALLA ANTES DE GUARDAR NADA, y no es un detalle de
       estilo:  repinta al terminar bien. Leyendo entre operación y
       operación —que fue la primera forma en que lo escribí— la asignación
       borraba las casillas de Cerrar antes de mirarlas, y guardar hacía UNA de
       las tres cosas marcadas sin decir que se había comido las otras dos. Lo
       vi en el navegador: se asignó Mecánica y ni se cerró Terminación ni se
       movió la fecha. */
    const aAsignar = Array.from(document.querySelectorAll('[data-asignar]:checked'))
      .map((c) => c.dataset.asignar)
      .filter((c) => yaAsignadas.indexOf(c) < 0);
    const respDe = (codigo) => {
      const sel = document.querySelector('[data-resp="' + codigo + '"]');
      return sel && sel.value ? sel.value : null;
    };
    const responsables = {};
    aAsignar.forEach((c) => {
      const id = (base.etapa.find((e) => e.codigo === c) || {}).id;
      const quien = respDe(c);
      if (id && quien) responsables[id] = quien;
    });
    const ids = aAsignar.map((c) => (base.etapa.find((e) => e.codigo === c) || {}).id);

    /* Cerrar etapas salio de aca el 30-08-2026: cada fila tiene su boton
       «Terminar» y actua sola. Guardar quedo para asignar y para la fecha. */
    const cierres = [];

    const campo = document.getElementById('f-compromiso');
    const actual = o.fechaCompromiso ? isoConHora(o.fechaCompromiso) : '';
    /* ⚠️ LA FECHA SÓLO SI CAMBIÓ. Desde que cada fecha comprometida queda
       guardada con su número, escribirla igual en cada guardado llenaría la
       historia de fechas repetidas y el «se movió 3 veces» dejaría de
       significar algo. */
    const fechaNueva = campo && campo.value && campo.value !== actual ? campo.value : null;

    if (!aAsignar.length && !fechaNueva)
      return avisar({ ok: false, motivo: 'No marcaste nada. Marca Aplica para asignar una etapa ' +
        'o cambia la fecha de entrega. Para terminar una etapa, usa el botón Terminar de su fila.' });

    /* Y recién ahora se guarda. Cada paso avisa si falla y corta: media
       asignación es mejor que una asignación a medias y en silencio. */
    const hechos = [];
    if (aAsignar.length) {
      const r = Modelo.asignar_etapas(o.id, ids, responsables);
      if (!r.ok) return avisar(r, '');
      hechos.push(plural(aAsignar.length, 'etapa asignada', 'etapas asignadas'));
    }
    if (cierres.length) {
      const r = Modelo.finalizar_etapas(o.id, cierres);
      if (!r.ok) { render(); return avisar(r, ''); }
      hechos.push(plural(cierres.length, 'etapa cerrada', 'etapas cerradas'));
    }
    if (fechaNueva) {
      const [fecha, hora] = fechaNueva.split('T');
      const [a, m, d] = fecha.split('-').map(Number);
      const [hh, mm] = String(hora || '00:00').split(':').map(Number);
      if (!a || !m || !d) { render(); return avisar({ ok: false, motivo: 'La fecha no se entiende.' }); }
      const r = Modelo.fijar_fecha_compromiso(o.id, new Date(a, m - 1, d, hh || 0, mm || 0));
      if (!r.ok) { render(); return avisar(r, ''); }
      hechos.push('fecha de entrega guardada');
    }

    avisar({ ok: true, motivo: '' }, hechos.join(' · ') + '.');
    render();
  });

  /* «Cancelar» no borra nada —no hay nada guardado todavía—: deshace lo
     marcado volviendo a pintar la pantalla. */
  const cancelar = document.getElementById('btn-cancelar-etapas');
  if (cancelar) cancelar.addEventListener('click', refrescarFicha);

  // Las fotos del avance se suben apenas se sueltan: son del trabajo, no del
  // guardado. Quien no tiene `foto.cargar` no ve el bloque.
  if (Modelo.puede('foto.cargar')) montarZonaFotos({
    id: 'etapafoto', momento: 'proceso', ot_id: o.id,
    alSubir: (fichas) => {
      Modelo.adjuntar_media(null, [o.id], fichas.map((x) => Object.assign(x, { ot_id: o.id })));
      refrescarFicha();
    }
  });
}

const isoFecha = (d) => d.getFullYear() + '-' +
  String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
/* Para `datetime-local`, con la hora QUE TIENE la fecha —no la del reloj—,
   porque acá se está editando un compromiso ya guardado. */
const isoConHora = (d) => isoFecha(d) + 'T' +
  String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
