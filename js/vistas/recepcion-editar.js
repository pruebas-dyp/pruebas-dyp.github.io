/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   EDITAR RECEPCIÓN — la cuarta opción del menú de Recepción.

   Era la única que no estaba construida, y no por tiempo: una recepción es lo
   que el cliente firmó. Marco la pidió el 15-08-2026 y se construyó con tres
   respuestas que quedan anotadas para que el taller las confirme —están
   escritas al lado de la operación, en `corregir_recepcion`—:

     · **se versiona**, no se pisa;
     · la hace **quien tiene `ot.editar`** —recepción y administración—;
     · el papel firmado no se toca: el **impreso dice qué versión es**.

   Se corrige con **las mismas pantallas del ingreso y en el mismo orden** —el
   pedido de Marco fue textual: "editar sobre lo creado y no editar sobre algo
   nuevo"—: datos del cliente, datos del vehículo y estado descriptivo, este
   último con su dibujo, su casilla única de observaciones, el tablero, las
   fotos y el inventario. Lo único que no se vuelve a pedir es la **firma**, y
   eso lo decide el taller, no nosotros.

   Vive en su propio archivo a propósito. `recepcion.js` lo está trabajando
   Benjamín en paralelo y dos manos en el mismo archivo terminan en conflicto;
   acá el enganche son cuatro líneas allá y todo lo demás está en éste.
   ──────────────────────────────────────────────────────────────────────── */

function editRec() {
  ui.editarRec = ui.editarRec || { otId: null, campos: null, inventario: {}, motivo: '', bloque: 'cliente' };
  return ui.editarRec;
}

/* Carga la orden en el formulario. Se hace UNA vez al entrar y no en cada
   pintado: si se recargara siempre, cada tecla que escribe el usuario se
   perdería con el siguiente render. */
function editRecCargar(o) {
  const e = editRec();
  e.otId = o.id;
  e.motivo = '';
  e.bloque = 'cliente';
  e.campos = {
    nombres: o.cliente || '', rut: o.rut || '', telefono: o.telefono || '',
    correo: o.correo || '', direccion: o.direccion || '',
    patente: o.patente || '', vin: o.vin || '', anio: o.anio || '',
    marca_id: o.marcaId || '', modelo_id: o.modeloId || '', color_id: o.colorId || '',
    km: (o.recepcion && o.recepcion.km) || '',
    combustible: (o.recepcion && o.recepcion.combustible != null) ? o.recepcion.combustible : '',
    observaciones: (o.recepcion && o.recepcion.observaciones) || ''
  };
  e.inventario = {};
  (o.inventario || []).forEach((i) => { if (i.itemId) e.inventario[i.itemId] = i.estado; });

  /* Copia de trabajo de los daños. Se COPIA y no se apunta a la del modelo:
     mientras el recepcionista raya y borra, la orden de verdad no se toca
     hasta que aprieta guardar — y si se arrepiente, «Descartar lo escrito»
     vuelve a la silueta que estaba firmada. */
  /* Las fotos del ingreso, como las trae el modelo. Van al mismo `zonaFotos`
     del formulario y por eso se ven igual. No son copia de trabajo: una foto
     se guarda al soltarla —es un adjunto, no un campo— y por eso se lee del
     modelo cada vez que se entra. */
  e.fotos = Modelo.mediaDe(o.id).filter((m) => m.momento === 'ingreso');

  e.danos = (o.danos || []).map((d) => ({
    vista: d.vista, zona: d.zona, zonaNombre: d.zonaNombre,
    severidad: d.severidad, x: d.x, y: d.y,
    descripcion: d.descripcion || '',
    trazo: d.trazo ? d.trazo.map((p) => ({ x: p.x, y: p.y })) : null
  }));
}

/* 🔶 LAS MISMAS PANTALLAS DEL INGRESO, CON LOS MISMOS NOMBRES (15-08-2026).

   Marco: "no debiese cambiar esa visual desde que él edita a cuando él lo
   ingresó por primera vez; la idea es editar sobre lo creado y no editar sobre
   algo nuevo". Tenía cinco pestañas inventadas —Cliente, Vehículo, Recepción,
   Checklist, Daños— y el ingreso tiene cinco pasos con otros nombres y otro
   reparto. Ahora son los mismos pasos del formulario:

     1 · Datos del cliente   2 · Datos del vehículo   4 · Estado descriptivo

   El paso 3 (Solicitud de reparación) no está: compañía, siniestro y tipo de
   ingreso son de la ORDEN, no de la recepción, y se cambian en la ficha. El 5
   es Verificar, que es para antes de crear.

   `Estado descriptivo` quedó tal cual el del ingreso: el dibujo a la
   izquierda, y a la derecha la casilla única de observaciones, el tablero
   —kilometraje y combustible— y las fotos, con el inventario abajo. No es
   parecido: es el mismo bloque, con las mismas clases y los mismos textos. */
const EDIT_REC_BLOQUES = [
  { id: 'cliente',  rot: '1 · Datos del cliente' },
  { id: 'vehiculo', rot: '2 · Datos del vehículo' },
  { id: 'estado',   rot: '4 · Estado descriptivo' }
];

function vRecepcionEditarFicha() {
  const e = editRec();
  // Las pestañas cambiaron de nombre el 15-08-2026: una sesión abierta desde
  // antes puede traer un bloque que ya no existe, y eso dejaba la pantalla en
  // blanco en vez de mostrar algo.
  if (!EDIT_REC_BLOQUES.some((b) => b.id === e.bloque)) e.bloque = 'cliente';
  const o = e.otId ? Modelo.otPorId(e.otId) : null;
  if (!o) {
    return '<div class="panel"><div class="cuerpo"><div class="vacio">' +
      '<div class="titulo">No se pudo abrir esa recepción</div>' +
      '<div class="texto">Vuelve a buscarla por patente.</div>' +
      '<div style="margin-top:9px"><button class="btn secundario" id="rec-volver">Volver</button></div>' +
      '</div></div></div>';
  }

  const correcciones = o.recepcion ? Modelo.correccionesDeRecepcion(o.recepcion.id) : [];
  const version = correcciones.length ? correcciones[0].version : 1;

  const pestana = (b) => '<button type="button" class="' + (e.bloque === b.id ? 'activo' : '') +
    '" data-edrec-bloque="' + b.id + '">' + esc(b.rot) + '</button>';

  return `
  <button class="btn volver" id="rec-volver"><span class="flecha-atras">&#8592;</span>
    Volver a buscar otra patente</button>
  <div class="panel">
    <div class="cab"><div><h2>${ico('documento', 'g')}Editar Recepción</h2>
      <div class="desc">OT ${o.numeroOT} · <span class="patente">${esc(o.patente)}</span> ·
        recibido el ${fFechaHora(o.fechaIngreso)}</div></div>
      <span class="et ${version > 1 ? 'azul' : 'gris'}">versión ${version}</span>
    </div>
    <div class="cuerpo">
      <div class="nota info">${ico('info')}
        <strong>Esto no borra lo anterior.</strong> La recepción se versiona, igual que el
        presupuesto: lo que estaba queda guardado con quién lo cambió, cuándo y por qué, y el
        comprobante impreso dice qué versión es. El papel que firmó el cliente sigue siendo el
        original — lo que se corrige es lo que el sistema dice de él.
      </div>

      <div class="tabs" style="margin:12px 0 10px">${EDIT_REC_BLOQUES.map(pestana).join('')}</div>

      ${e.bloque === 'estado' ? vEditRecEstado() : vEditRecCampos(e)}

      <div class="rejilla-campos" style="margin-top:12px">
        <div class="campo" style="grid-column:1/-1">
          <label>Motivo de la corrección <span style="color:var(--rojo)">*</span></label>
          <textarea rows="2" id="edrec-motivo"
            placeholder="Qué se equivocó y cómo se supo">${esc(e.motivo)}</textarea>
          <span class="ayuda">Obligatorio. Es lo único que separa una corrección de una
            alteración: sin motivo el registro dice qué se cambió, pero no por qué</span></div>
      </div>
      <div style="margin-top:9px;display:flex;gap:8px">
        <button class="btn" id="edrec-guardar">Guardar la corrección</button>
        <button class="btn secundario" id="edrec-deshacer">Descartar lo escrito</button>
      </div>

      ${correcciones.length ? `
      <h3 style="font-size:13px;margin:16px 0 6px">Correcciones anteriores</h3>
      <div class="grid-envoltorio"><table class="grid">
        <thead><tr><th style="width:70px">Versión</th><th style="width:110px">Fecha</th>
          <th style="width:150px">Quién</th><th>Qué cambió</th><th>Motivo</th></tr></thead>
        <tbody>${correcciones.map((c) => '<tr>' +
          '<td class="num">v' + c.version + '</td>' +
          '<td class="num">' + esc(fFechaHora(c.fecha)) + '</td>' +
          '<td>' + esc(c.quien) + '</td>' +
          '<td>' + c.cambios.map((x) => '<div class="ayuda" style="margin:0">' + esc(x.campo) +
            ': <s>' + esc(x.antes || '—') + '</s> → <strong>' + esc(x.despues || '—') +
            '</strong></div>').join('') + '</td>' +
          '<td>' + esc(c.motivo) + '</td></tr>').join('')}
        </tbody></table></div>` : ''}

      <div class="nota" style="margin-top:12px">
        <strong>La firma no se vuelve a pedir acá, y no es un pendiente técnico.</strong> Volver a
        firmar es tener al cliente otra vez adelante, y si hay que hacerlo o no es la pregunta que
        está sobre la mesa del taller: si el papel de la versión 1 sigue valiendo, o cada corrección
        se firma de nuevo. Mientras no se responda, la firma que hay es la de la versión 1 y el
        comprobante lo dice.
      </div>
    </div>
  </div>`;
}

/* Los tres bloques de campos. Se arman con la misma rejilla del ingreso para
   que sea la misma pantalla que el recepcionista ya conoce, no una nueva. */
function vEditRecCampos(e) {
  const c = e.campos;
  const campo = (clave, rot, extra) => '<div class="campo"><label>' + esc(rot) + '</label>' +
    '<input data-edrec="' + clave + '" value="' + esc(c[clave] == null ? '' : c[clave]) + '" ' +
    (extra || '') + '></div>';
  const cat = (clave, rot, tabla) => {
    let filas = Modelo.catalogo(tabla).filter((x) => x.activo !== false);
    // Los modelos son de una marca. Ofrecer los 60 con la marca ya elegida es
    // la forma más simple de que alguien guarde un Corolla marca Nissan.
    if (tabla === 'modelo' && c.marca_id) filas = filas.filter((x) => x.marca_id === c.marca_id);
    return '<div class="campo"><label>' + esc(rot) + '</label>' +
      '<select data-edrec="' + clave + '"><option value="">Sin definir</option>' +
      filas.map((f) => '<option value="' + esc(f.id) + '"' +
        (String(c[clave]) === String(f.id) ? ' selected' : '') + '>' + esc(f.nombre) + '</option>').join('') +
      '</select></div>';
  };

  if (e.bloque === 'cliente') {
    return '<div class="rejilla-campos" style="margin-top:11px">' +
      campo('nombres', 'Nombre del cliente') +
      campo('rut', 'RUT') +
      campo('telefono', 'Teléfono') +
      campo('correo', 'Correo') +
      '<div class="campo" style="grid-column:1/-1">' +
        '<label>Dirección</label><input data-edrec="direccion" value="' +
        esc(c.direccion || '') + '"></div>' +
      '</div>';
  }

  // Datos del vehículo, los mismos campos del paso 2 del ingreso.
  return '<div class="rejilla-campos" style="margin-top:11px">' +
    campo('patente', 'Patente', 'maxlength="' + PATENTE_LARGO + '" autocomplete="off"') +
    campo('vin', 'VIN', 'maxlength="' + VIN_LARGO + '" autocomplete="off"') +
    cat('marca_id', 'Marca', 'marca') +
    cat('modelo_id', 'Modelo', 'modelo') +
    cat('color_id', 'Color', 'color_vehiculo') +
    campo('anio', 'Año', 'type="number" min="1950" max="2035"') +
    '</div>';
}

/* El checklist, con los mismos cuatro estados que el ingreso. `sin_verificar`
   se ofrece igual: si un ítem se marcó por error, poder devolverlo a "nadie lo
   miró" es tan necesario como marcarlo. */
/* ── 4 · Estado descriptivo, el mismo del ingreso ──────────────────────
   Mismo `estado-descriptivo`, mismo `ed-dibujo`, mismo `ed-lado`, mismos
   rótulos y mismos pies de nota. Lo único que cambia son los `data-`: acá
   son `data-edrec*` porque el estado que se edita es el de esta pantalla y no
   el borrador del formulario. */
function vEditRecEstado() {
  const e = editRec();
  const items = Modelo.catalogo('inventario_item');

  return `
  <div class="estado-descriptivo" style="margin-top:11px">
    <div class="ed-dibujo">
      <div class="lienzo">${svgSilueta()}</div>
      <div class="ed-barra">
        <span class="ayuda">Raya sobre el auto con el dedo o el mouse. Cada trazo es un daño.</span>
        <span style="display:flex;gap:6px">
          <button class="btn secundario" id="edrec-dano-deshacer">Deshacer el último</button>
          <button class="btn secundario" id="edrec-dano-borrar">Borrar todo</button>
        </span>
      </div>
    </div>

    <div class="ed-lado">
      <div class="campo">
        <label>Observaciones</label>
        <textarea rows="5" data-edrec="observaciones"
          placeholder="Qué trae el vehículo: dónde está el daño, de qué tipo, si ya venía…">${
          esc(e.campos.observaciones || '')}</textarea>
        <span class="ayuda">Una sola casilla para todo lo marcado.</span>
      </div>

      <fieldset class="bloque" style="margin-top:12px"><legend>Tablero</legend>
        <div class="rejilla-campos">
          <div class="campo"><label>Kilometraje <span style="color:var(--rojo)">*</span></label>
            <input type="number" min="0" data-edrec="km" value="${esc(e.campos.km == null ? '' : e.campos.km)}">
            <span class="ayuda">Como se lee al recibirlo</span></div>
        </div>
        <h4 class="rot-chico" style="margin-top:10px">Nivel de combustible</h4>
        <div class="chips">
          ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => '<button class="chip' +
            (String(e.campos.combustible) === String(n) ? ' activo' : '') +
            '" data-edrec-comb="' + n + '">' + n + '/8' +
            (n === 8 ? ' lleno' : n === 0 ? ' vacío' : '') + '</button>').join('')}
        </div>
        <div class="pie-nota">Nueve posiciones, como el original. Nuestro diseño decía ocho.</div>
      </fieldset>

      <fieldset class="bloque" style="margin-top:12px"><legend>Fotografías de ingreso</legend>
        ${zonaFotos({ id: 'edrecfoto', fotos: e.fotos, titulo: 'Agregar fotografías' })}
        <div class="pie-nota">Las fotos se guardan al soltarlas y no esperan el botón de abajo: son
          adjuntos, no campos, y cada una queda registrada con quién la subió.</div>
      </fieldset>
    </div>
  </div>

  <fieldset class="bloque" style="margin-top:12px">
    <legend>Inventario del vehículo · los ${items.length} ítems</legend>
    ${vEditRecInventario()}
  </fieldset>`;
}

function vEditRecInventario() {
  const e = editRec();
  const estados = Modelo.inventarioEstados();
  const items = Modelo.catalogo('inventario_item');

  // Los mismos cuatro botones del ingreso, con las mismas clases y los mismos
  // iconos. Es el mismo gesto: si acá fuera otra cosa, habría que aprender dos.
  const fila = (it) => {
    const v = e.inventario[it.id] || 'sin_verificar';
    return '<tr><td>' + esc(it.nombre) +
      ' <span class="cod" style="font-size:10.5px;color:var(--gris-2)">' + esc(it.codigo) + '</span></td>' +
      '<td><span class="inv-botones">' +
        estados.map((s) => '<button type="button" class="inv-btn ' + s.clase +
          (v === s.codigo ? ' activo' : '') + '" data-edrec-inv="' + esc(it.id) +
          '" data-estado="' + esc(s.codigo) + '" title="' + esc(s.nombre) + '" ' +
          'aria-label="' + esc(it.nombre + ': ' + s.nombre) + '">' +
          ico(s.icono) + '</button>').join('') +
      '</span></td></tr>';
  };

  return '<div class="grid-envoltorio" style="margin-top:11px"><table class="grid">' +
    '<thead><tr><th>Elemento</th><th style="width:290px">Estado</th></tr></thead>' +
    '<tbody>' + items.map(fila).join('') + '</tbody></table></div>';
}

/* Redibuja las marcas dentro del SVG. Es la misma idea que `pintarDanos()` del
   ingreso, sobre la copia de trabajo de esta pantalla. */
function pintarDanosEditor() {
  const e = editRec();
  const g = document.getElementById('marcas');
  if (!g) return;
  g.innerHTML = e.danos.map((d, i) => {
    const p = (d.trazo && d.trazo.length) ? d.trazo : [siluetaPuntoDeZona(d.vista, d.zona)];
    return '<path class="trazo-dano" data-trazo="' + i + '" d="' + siluetaTrazoD(p) + '"></path>';
  }).join('');
  const n = document.getElementById('n-marcas-ed');
  if (n) n.textContent = e.danos.length ? plural(e.danos.length, 'marca', 'marcas') : 'sin marcas';
}

function pEditRecEstado() {
  const e = editRec();
  const svg = document.querySelector('.lienzo svg');
  if (!svg) return;
  const zonas = Modelo.zonasDano();

  /* El trazo se dibuja en vivo dentro del propio SVG y recién al soltar se
     convierte en una marca.

     ⚠️ Las coordenadas van de 0 a 1, NO en píxeles de la caja. Es la convención
     de `silueta.js` —`siluetaUbicar` y `siluetaTrazoD` multiplican ellos por
     `SILUETA_CAJA`— y es la correcta: la misma raya tiene que caer en la misma
     pieza en el computador del mesón y en el teléfono del jefe de taller.
     Escrito al revés la primera vez, la marca se dibujaba fuera de la lámina y
     `zonaNombre` volvía siempre nulo. */
  let puntos = null, vivo = null;
  const donde = (ev) => {
    const c = svg.getBoundingClientRect();
    return { x: Number(((ev.clientX - c.left) / c.width).toFixed(4)),
             y: Number(((ev.clientY - c.top) / c.height).toFixed(4)) };
  };

  svg.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    puntos = [donde(ev)];
    vivo = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    vivo.setAttribute('class', 'trazo-dano');
    svg.appendChild(vivo);
    if (svg.setPointerCapture) { try { svg.setPointerCapture(ev.pointerId); } catch (x) { /* nada */ } }
  });

  svg.addEventListener('pointermove', (ev) => {
    if (!puntos) return;
    puntos.push(donde(ev));
    if (vivo) vivo.setAttribute('d', siluetaTrazoD(puntos));
  });

  const soltar = () => {
    if (!puntos) return;
    const p = puntos;
    puntos = null;
    if (vivo && vivo.parentNode) vivo.parentNode.removeChild(vivo);
    vivo = null;
    // Un toque suelto no es una raya: sin esto, cualquier clic para mirar el
    // dibujo dejaba una marca en la recepción de un auto.
    if (p.length < 2) return pintarDanosEditor();

    // El centro del trazo decide la zona, con el promedio: una raya que cruza
    // dos piezas pertenece a la que más recorre.
    const cx = p.reduce((s, q) => s + q.x, 0) / p.length;
    const cy = p.reduce((s, q) => s + q.y, 0) / p.length;
    const u = siluetaUbicar(cx, cy);
    const z = u.zona ? zonas.find((x) => x.codigo === u.zona) : null;

    e.danos.push({
      vista: u.vista, zona: u.zona, zonaNombre: z ? z.nombre : null,
      severidad: 2, descripcion: '',
      x: Number(cx.toFixed(4)), y: Number(cy.toFixed(4)), trazo: p
    });
    render();
  };
  svg.addEventListener('pointerup', soltar);
  svg.addEventListener('pointerleave', soltar);
  svg.addEventListener('pointercancel', soltar);

  pintarDanosEditor();

  // El combustible son los mismos nueve botones del ingreso.
  document.querySelectorAll('[data-edrec-comb]').forEach((b) => b.addEventListener('click', () => {
    e.campos.combustible = b.dataset.edrecComb;
    render();
  }));

  /* Las fotos usan el mismo montador que el formulario. Se guardan al soltarlas
     y no esperan el botón de la corrección: `adjuntar_media` y `eliminar_media`
     son operaciones propias, con su permiso y su hecho en el expediente. */
  montarZonaFotos({
    id: 'edrecfoto', momento: 'ingreso',
    alSubir: (fichas) => {
      const o = Modelo.otPorId(e.otId);
      if (!o) return;
      ejecutar(() => Modelo.adjuntar_media(o.recepcion ? o.recepcion.id : null, [o.id], fichas),
        plural(fichas.length, 'fotografía agregada', 'fotografías agregadas') + ' a la recepción.',
        () => { e.fotos = Modelo.mediaDe(o.id).filter((m) => m.momento === 'ingreso'); render(); });
    },
    alQuitar: (i) => {
      const f = e.fotos[i];
      if (!f) return;
      ejecutar(() => Modelo.eliminar_media(f.id), 'Fotografía quitada.', () => {
        const o = Modelo.otPorId(e.otId);
        e.fotos = o ? Modelo.mediaDe(o.id).filter((m) => m.momento === 'ingreso') : [];
        render();
      });
    }
  });

  /* La casilla de observaciones de esta pestaña no se engancha acá: lleva
     `data-edrec="observaciones"` —es literalmente el mismo campo que en la
     pestaña Recepción— y la ata el bucle general de `pRecepcionEditarFicha`,
     que corre después de esta función. Atarla también acá la dejaría con dos
     escuchas haciendo lo mismo. */

  const deshacer = document.getElementById('edrec-dano-deshacer');
  if (deshacer) deshacer.addEventListener('click', () => {
    if (!e.danos.length) return avisar({ ok: false, motivo: 'No hay ninguna marca.' });
    e.danos.pop(); render();
  });
  const borrar = document.getElementById('edrec-dano-borrar');
  if (borrar) borrar.addEventListener('click', () => {
    if (!e.danos.length) return avisar({ ok: false, motivo: 'No hay nada que borrar.' });
    if (!confirm('¿Borrar las ' + e.danos.length + ' marcas de la silueta?')) return;
    e.danos = []; render();
  });
}

function pRecepcionEditarFicha() {
  const e = editRec();
  const volver = document.getElementById('rec-volver');
  if (volver) volver.addEventListener('click', () => {
    rec().pantalla = 'editar'; ui.editarRec = null; render();
  });

  document.querySelectorAll('[data-edrec-bloque]').forEach((b) => b.addEventListener('click', () => {
    e.bloque = b.dataset.edrecBloque; render();
  }));

  if (e.bloque === 'estado') pEditRecEstado();

  /* Se guarda en el estado a cada tecla, no al pintar: el usuario puede saltar
     entre los cuatro bloques antes de guardar y no puede perder lo escrito en
     el anterior. La patente se normaliza igual que en el ingreso — la misma
     patente escrita de dos formas es dos vehículos. */
  document.querySelectorAll('[data-edrec]').forEach((el) => {
    const clave = el.dataset.edrec;
    el.addEventListener('input', () => {
      e.campos[clave] = clave === 'patente' ? normalizarPatente(el.value) : el.value;
      if (clave === 'patente' && el.value !== e.campos[clave]) el.value = e.campos[clave];
    });
    el.addEventListener('change', () => { e.campos[clave] = el.value; });
  });

  document.querySelectorAll('[data-edrec-inv]').forEach((b) => b.addEventListener('click', () => {
    e.inventario[b.dataset.edrecInv] = b.dataset.estado;
    render();
  }));

  const motivo = document.getElementById('edrec-motivo');
  if (motivo) motivo.addEventListener('input', () => { e.motivo = motivo.value; });

  const descartar = document.getElementById('edrec-deshacer');
  if (descartar) descartar.addEventListener('click', () => {
    const o = Modelo.otPorId(e.otId);
    if (o) editRecCargar(o);
    render();
    avisar({ ok: true, motivo: 'Se descartó lo escrito. La recepción quedó como estaba.' });
  });

  const guardar = document.getElementById('edrec-guardar');
  if (guardar) guardar.addEventListener('click', () => {
    const c = e.campos;
    const zonas = Modelo.zonasDano();
    const o = Modelo.otPorId(e.otId);
    if (!o) return avisar({ ok: false, motivo: 'La orden ya no está abierta.' });

    /* Los dos largos se exigen SOBRE LO QUE SE ESTÁ CAMBIANDO, no sobre lo que
       ya estaba. Si no, corregir un teléfono obligaba a arreglar de paso un VIN
       que alguien digitó corto hace tres meses, y eso deja al recepcionista sin
       poder guardar nada — que es peor que el dato corto. Lo viejo se arregla
       el día que alguien lo toque a propósito. */
    if (c.patente !== o.patente && c.patente.length !== PATENTE_LARGO)
      return avisar({ ok: false, motivo: 'La patente tiene ' + c.patente.length +
        ' caracteres y son ' + PATENTE_LARGO + '.' });
    if (c.vin !== (o.vin || '') && c.vin && c.vin.length !== VIN_LARGO)
      return avisar({ ok: false, motivo: 'El VIN tiene ' + c.vin.length + ' caracteres y son ' +
        VIN_LARGO + ' (norma ISO 3779).' });
    // El kilometraje es obligatorio en el ingreso y lo sigue siendo acá: una
    // corrección no puede dejar la recepción peor de como estaba.
    if (String(c.km).trim() === '')
      return avisar({ ok: false, motivo: 'El kilometraje es obligatorio, igual que al recibir el ' +
        'vehículo. Si no se sabe, se deja el que estaba.' });

    const cambios = {
      cliente: { nombres: c.nombres, rut: c.rut, telefono: c.telefono,
                 correo: c.correo, direccion: c.direccion },
      vehiculo: { patente: c.patente, vin: c.vin, anio: c.anio === '' ? null : Number(c.anio),
                  marca_id: c.marca_id || null, modelo_id: c.modelo_id || null,
                  color_id: c.color_id || null },
      recepcion: { km: c.km === '' ? null : Number(c.km),
                   combustible: c.combustible === '' ? null : Number(c.combustible),
                   observaciones: c.observaciones },
      inventario: e.inventario,
      // La zona viaja como código mientras se dibuja —es lo que devuelve la
      // silueta— y se resuelve a su id recién acá, igual que en el ingreso.
      danos: e.danos.map((d) => ({
        vista: d.vista, zona_id: (zonas.find((z) => z.codigo === d.zona) || {}).id || null,
        tipo_id: null, severidad: d.severidad || 2,
        zonaNombre: d.zonaNombre, x: d.x, y: d.y,
        descripcion: d.descripcion || '', trazo: d.trazo || null
      }))
    };

    ejecutar(() => Modelo.corregir_recepcion(e.otId, cambios, e.motivo),
      'Recepción corregida. Quedó como versión nueva, con lo que decía antes, quién lo cambió y ' +
      'por qué — y el comprobante impreso ahora dice qué versión es.',
      () => {
        const o = Modelo.otPorId(e.otId);
        if (o) editRecCargar(o);
        render();
      });
  });
}
