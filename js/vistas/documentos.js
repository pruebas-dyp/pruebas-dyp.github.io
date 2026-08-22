/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   DOCUMENTOS — guías de despacho, facturas y órdenes de compra.

   Existe por una obligación regulatoria, no por comodidad: desde 2023 la
   Superintendencia obliga a tener **un año de trazabilidad de los datos**, y
   sin eso el taller no puede trabajar con las aseguradoras. Es condición del
   negocio, no una preferencia.

   Como en el original, **solo muestra vehículos que están en la torre**.

   🔴 B-4 · Lo que se corrige: los botones `Enviar Fotografías por Email` y
      `Enviar Documentos por Email` del sistema actual mandan a cualquier
      dirección **sin registro visible del destinatario**. Acá todo envío
      queda registrado —quién, a quién, qué y cuándo— y los destinatarios
      salen de un catálogo, no de un campo libre.
   ──────────────────────────────────────────────────────────────────────── */

function documentosEstado() {
  ui.documentos = ui.documentos || { otId: null, busqueda: '' };
  return ui.documentos;
}

function vDocumentos() {
  const d = documentosEstado();
  return d.otId ? documentosDeOT(Modelo.otPorId(d.otId)) : documentosListado();
}

function documentosListado() {
  const d = documentosEstado();
  const q = d.busqueda.trim().toLowerCase();
  const filas = Modelo.torre().filter((o) => !q ||
    [o.numeroOT, o.patente, o.cliente].join(' ').toLowerCase().includes(q));

  return `
  <div class="panel">
    <div class="cab"><div><h2>${ico('documento', 'g')}Documentos</h2>
      <div class="desc">Solo vehículos en la torre, igual que el original</div></div>
      <div class="filtros"><input type="search" id="doc-q" placeholder="OT, patente o cliente" value="${esc(d.busqueda)}"></div></div>
    <div class="grid-envoltorio"><table class="grid">
      <thead><tr><th>OT</th><th>Patente</th><th>Marca</th><th>Modelo</th><th>Fecha de Ingreso</th>
        <th>Estado</th><th>Etapa</th><th>Adjuntos</th><th></th></tr></thead>
      ${/* Sin el `slice(0, 60)` que había: cortaba en sesenta y el pie decía
            «Mostrando 60 de 102» sin dar forma de llegar a las demás. */''}
      <tbody>${filas.map((o) => {
        const n = Modelo.mediaDe(o.id).filter((m) => m.momento === 'documento').length;
        return '<tr class="fila" data-ot="' + esc(o.numeroOT) + '"><td class="num"><strong>' + o.numeroOT + '</strong></td>' +
          '<td><span class="patente">' + esc(o.patente) + '</span></td>' +
          '<td>' + esc(o.marca || '—') + '</td><td>' + esc(o.modelo || '—') + '</td>' +
          '<td class="num">' + fFechaHora(o.fechaIngreso) + '</td>' +
          '<td><span class="et ' + esc(o.estadoClase) + '">' + esc(o.estadoNombre) + '</span></td>' +
          '<td>' + esc(o.etapaNombre) + '</td>' +
          '<td class="num">' + (n || '<span style="color:var(--gris-2)">—</span>') + '</td>' +
          '<td><button class="btn secundario" data-doc-ot="' + esc(o.id) + '">Ver / subir</button></td></tr>';
      }).join('')}</tbody>
    </table></div>
  </div>`;
}

/* Los momentos en que el sistema guarda una imagen, con el nombre que el
   taller les da. Sin esto, las fotos de la recepción quedaban invisibles acá:
   la pantalla solo miraba las cargadas como "documento", así que uno subía
   diez fotos al recibir el auto y en Documentos no aparecía ninguna. */
/* 🔷 «documento» YA NO ESTÁ EN ESTA LISTA (17-08-2026, Marco: "si uno sube un
   documento, el nombre del archivo también debe quedar acá; no quiero que
   quede abajo como vista previa, sino tenerlo directamente ahí").

   Los archivos que se suben pasaron a ser FILAS del expediente, arriba, con su
   nombre, su fecha y el botón para abrirlo. Una guía o una factura no se
   reconoce por su miniatura —son todas una hoja blanca con letras chicas—: se
   reconoce por el nombre. Las fotos del vehículo sí siguen como miniaturas,
   porque ahí la imagen ES el dato. */
const MOMENTOS_MEDIA = [
  { id: 'ingreso',   rot: 'Fotografías de la recepción', pie: 'Cómo llegó el vehículo' },
  { id: 'proceso',   rot: 'Fotografías del avance',      pie: 'Por etapa, cargadas al cerrar cada una' },
  { id: 'salida',    rot: 'Fotografías de la entrega',   pie: 'Cómo salió el vehículo' }
];

function documentosDeOT(o) {
  const media = Modelo.mediaDe(o.id);
  const docs = media.filter((m) => m.momento === 'documento');
  /* Ver y cargar son permisos distintos. Bodega necesita subir la guía de
     despacho que llega con la pieza; el jefe de taller mira el expediente y no
     lo toca. Antes bastaba con `documento.ver` para las dos cosas. */
  const cargaDocs = Modelo.puede('documento.cargar');
  const destinatarios = Modelo.destinatarios();
  const presus = o.presupuestos || [];
  const pedidos = (o.repuestos || []).filter((r) => r.fechaSolicitud);

  /* El expediente de la orden: todo lo que se emitió o se mandó, en un solo
     lugar y en el orden en que ocurre. Es lo que se busca cuando la compañía
     pregunta "¿qué le mandaron y cuándo?". */
  const expediente = [
    { rot: 'Comprobante de recepción', cuando: o.fechaIngreso, hay: true, imprimir: 'recepcion',
      detalle: media.filter((m) => m.momento === 'ingreso').length + ' fotos de ingreso' },
    { rot: 'Presupuesto / OR', cuando: presus.length ? presus[presus.length - 1].enviadoAt : null,
      hay: !!presus.length, imprimir: 'presupuesto',
      detalle: presus.length
        ? presus.map((p) => p.numeroOR + ' · v' + p.version + ' · ' + p.estado).join(' — ')
        : 'todavía no se genera' },
    { rot: 'Pedido a bodega', cuando: pedidos.length ? pedidos[0].fechaSolicitud : null,
      hay: !!pedidos.length, vista: 'bodega',
      detalle: pedidos.length
        ? plural(pedidos.length, 'repuesto pedido', 'repuestos pedidos') + ' · ' +
          pedidos.filter((r) => r.fechaBodega).length + ' ya llegaron'
        : 'no se ha pedido nada' },
    { rot: 'Ficha completa de la orden', cuando: null, hay: true, imprimir: 'ficha',
      detalle: 'Historial, etapas, repuestos y fotos' },
    { rot: 'Acta de entrega', cuando: o.fechaEntrega, hay: !!o.fechaEntrega, imprimir: 'entrega',
      detalle: o.fechaEntrega ? 'Entregado' : 'la orden todavía no se entrega' }
  ];

  /* Y a continuación, en la MISMA tabla, lo que se subió. Antes vivía en una
     tabla aparte más abajo y como miniaturas: el expediente decía «esto es todo
     lo que hay de esta orden» y la guía de despacho recién cargada no estaba en
     él. Van al final porque llegan después de los cinco documentos que el
     sistema emite solo. */
  docs.forEach((m) => expediente.push({
    rot: m.nombre, cuando: m.creado_at, hay: true, archivo: m,
    detalle: 'Cargado a mano · ' + Media.fPeso(m.bytes)
  }));

  const bloqueFotos = (m) => {
    const fotos = media.filter((x) => x.momento === m.id);
    if (!fotos.length) return '';
    return '<fieldset class="bloque" style="margin-top:11px"><legend>' + esc(m.rot) +
      ' <span class="et gris">' + fotos.length + '</span></legend>' +
      '<div class="fotos-rejilla">' + fotos.map((f) =>
        '<figure class="foto-tarjeta"><img data-media="' + esc(f.id) + '" alt="' + esc(f.nombre) + '">' +
        '<figcaption class="pie-foto"><b>' + esc(f.nombre) + '</b>' +
        '<span class="cod">' + fFechaHora(f.creado_at) + ' · ' + Media.fPeso(f.bytes) + '</span>' +
        (f.etapa_nombre ? '<br>' + esc(f.etapa_nombre) : '') + '</figcaption></figure>').join('') +
      '</div><div class="pie-nota">' + esc(m.pie) + '</div></fieldset>';
  };

  return `
  <div class="panel">
    <div class="cab"><div><h2>${ico('documento', 'g')}Expediente de la orden N° ${o.numeroOT}</h2>
      <div class="desc">${esc(o.patente)} · ${esc(o.cliente)} · ${esc(o.compania)}</div></div>
      <button class="btn secundario" id="doc-volver">Volver</button></div>
    <div class="cuerpo">
      <div class="grid-envoltorio"><table class="grid">
        <thead><tr><th style="width:26%">Documento</th><th>Qué tiene</th><th>Fecha</th><th>Acción</th></tr></thead>
        <tbody>${expediente.map((e) =>
          '<tr class="fila"><td><strong>' + esc(e.rot) + '</strong>' +
            /* El lápiz del sistema actual, ahora al lado del nombre en el
               expediente. El archivo llega como `escaneo_001.pdf` desde el
               scanner del mesón y así nadie lo encuentra seis meses después,
               que es cuando la compañía lo pide. El nombre es lo único que hace
               encontrable un documento: no hay tipo ni categoría, porque el
               taller no las usa. */
            (e.archivo && cargaDocs ? ' <button class="enlace-volver" data-doc-nombrar="' +
              esc(e.archivo.id) + '" title="Ponerle nombre">' + ico('editar') + '</button>' : '') +
            '</td>' +
          '<td>' + esc(e.detalle) + '</td>' +
          '<td class="num">' + (e.cuando ? fFechaHora(e.cuando) : '—') + '</td>' +
          '<td>' + (e.archivo
            ? '<span style="display:flex;gap:6px;flex-wrap:wrap">' +
              '<button class="btn secundario" data-doc-abrir="' + esc(e.archivo.id) + '">Ver documento</button>' +
              (cargaDocs ? '<button class="btn secundario" data-doc-quitar="' + esc(e.archivo.id) +
                '">Quitar</button>' : '') + '</span>'
            : (!e.hay ? '<span class="et gris">todavía no</span>'
              : e.imprimir
                ? '<button class="btn secundario" data-doc-imprimir="' + esc(e.imprimir) + '">Ver documento</button>'
                : '<button class="btn secundario" data-doc-ir="' + esc(e.vista) + '">Ir a bodega</button>')) +
          '</td></tr>').join('')}</tbody>
      </table></div>

      ${MOMENTOS_MEDIA.map(bloqueFotos).join('')}

      ${media.length ? '' : '<div class="pie-nota" style="margin-top:11px">' +
        'Esta orden todavía no tiene ninguna imagen cargada.</div>'}

      ${cargaDocs ? `<fieldset class="bloque" style="margin-top:11px"><legend>Cargar documentos</legend>
        ${zonaFotos({ id: 'docfoto', fotos: [], titulo: 'Soltar guías, facturas u órdenes de compra' })}
      </fieldset>` : ''}

      ${/* Acá había una segunda tabla con los mismos archivos —nombre, fecha,
            peso, quitar—. Con los documentos ya en el expediente de arriba era
            la misma lista dos veces en la misma pantalla, y la de abajo no
            dejaba abrirlos. Se sacó entera: nada se perdió, todo subió. */''}

      <fieldset class="bloque" style="margin-top:11px"><legend>Enviar por correo</legend>
        <div class="rejilla-campos">
          <div class="campo"><label>Para</label>
            <select id="doc-dest">${destinatarios.map((p) => '<option value="' + esc(p.id) + '">' +
              esc(p.nombre) + '</option>').join('')}</select>
            <span class="ayuda">Catálogo cerrado, no un campo libre</span></div>
          <div class="campo"><label>&nbsp;</label><button class="btn" id="doc-enviar">Enviar y registrar</button></div>
        </div>
      </fieldset>
    </div>
  </div>`;
}

function pDocumentos() {
  // Doble clic abre la orden en pestaña nueva, igual que en la torre.
  /* 🔷 SIN DESPLEGABLE (17-08-2026, Marco: "documentos no debiese tener lista
     desplegable hacia abajo"). Mismo criterio que en Bodega: lo que hay que
     mirar de una orden está en su expediente, a un doble clic en la OT, y el
     expandible sólo movía la tabla debajo del dedo. El doble clic se mantiene y
     sigue saliendo únicamente desde la columna OT. */
  dobleClicPorFilas(null, { sinDetalle: true });
  const d = documentosEstado();

  const q = document.getElementById('doc-q');
  if (q) q.addEventListener('input', () => {
    d.busqueda = q.value; render();
    const n = document.getElementById('doc-q');
    n.focus(); n.setSelectionRange(n.value.length, n.value.length);
  });

  // Los documentos del expediente se abren acá mismo, sin ir a la ficha.
  document.querySelectorAll('[data-doc-imprimir]').forEach((b) => b.addEventListener('click', () =>
    abrirImpreso(b.dataset.docImprimir, d.otId)));

  document.querySelectorAll('[data-doc-ir]').forEach((b) => b.addEventListener('click', () => {
    const o = Modelo.otPorId(d.otId);
    const bod = bodegaEstado();
    bod.pantalla = 'checklist'; bod.patente = o.patente; bod.otId = o.id;
    ir('bodega');
  }));

  document.querySelectorAll('[data-doc-ot]').forEach((b) => b.addEventListener('click', () => {
    d.otId = b.dataset.docOt; render();
  }));
  const volver = document.getElementById('doc-volver');
  if (volver) volver.addEventListener('click', () => { d.otId = null; render(); });

  if (d.otId && Modelo.puede('documento.cargar')) montarZonaFotos({
    id: 'docfoto', momento: 'documento', ot_id: d.otId,
    alSubir: (fichas) => {
      Modelo.adjuntar_media(null, [d.otId],
        fichas.map((x) => Object.assign(x, { ot_id: d.otId, momento: 'documento' })));
      render();
    }
  });

  /* Ponerle nombre al documento. Llega con el nombre que traía el archivo y se
     puede cambiar; la extensión se conserva sola aunque el usuario la borre al
     escribir. Cada cambio queda en el expediente con el nombre viejo y el
     nuevo: si mañana alguien discute qué documento era, ahí está. */
  document.querySelectorAll('[data-doc-nombrar]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.docNombrar;
    const actual = (Modelo.mediaDe(d.otId).find((m) => m.id === id) || {}).nombre || '';
    const nuevo = prompt('Nombre del documento\n\nComo se va a buscar después: ' +
      '"Guía de despacho N° 79074 Johnson", "Vale de retiro Castillo".', actual);
    if (nuevo === null) return;
    ejecutar(() => Modelo.renombrar_media(id, nuevo), 'Documento renombrado.');
  }));

  /* Abrir el archivo cargado. Antes no se podía: la lista de abajo mostraba
     nombre, fecha y peso, y para verlo había que buscar la miniatura. El
     archivo vive en IndexedDB, así que se pide su URL y se muestra acá mismo
     —no se descarga—: el expediente se mira, no se reparte. */
  document.querySelectorAll('[data-doc-abrir]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.docAbrir;
    const m = Modelo.mediaDe(d.otId).find((x) => x.id === id);
    Media.url(id).then((u) => {
      if (!u) {
        return avisar({ ok: false, motivo: 'El archivo no está en este navegador. ' +
          'Los documentos se guardan en el equipo donde se cargaron: si esta orden se subió ' +
          'en el computador del mesón, hay que abrirla ahí.' });
      }
      dialogo(m ? m.nombre : 'Documento',
        '<div class="pie-nota" style="margin:0 0 8px">' +
        (m ? fFechaHora(m.creado_at) + ' · ' + Media.fPeso(m.bytes) : '') + '</div>' +
        '<img src="' + u + '" alt="' + esc(m ? m.nombre : 'documento') +
        '" style="max-width:100%;border:1px solid var(--borde);border-radius:3px">');
      // Se revoca al cerrar el cuadro; si no, cada apertura filtra memoria.
      const velo = dialogo.ultimo;
      if (velo) velo.addEventListener('click', () => setTimeout(() => URL.revokeObjectURL(u), 500));
    });
  }));

  document.querySelectorAll('[data-doc-quitar]').forEach((b) => b.addEventListener('click', () => {
    Media.eliminar(b.dataset.docQuitar).catch(() => null)
      .then(() => ejecutar(() => Modelo.eliminar_media(b.dataset.docQuitar), 'Documento quitado.'));
  }));

  const enviar = document.getElementById('doc-enviar');
  if (enviar) enviar.addEventListener('click', () => {
    const dest = document.getElementById('doc-dest').value;
    const n = Modelo.mediaDe(d.otId).filter((m) => m.momento === 'documento').length;
    if (!n) return avisar({ ok: false, motivo: 'No hay documentos que enviar.' });
    // El envío queda como mensaje de bitácora: quién, a quién, qué y cuándo.
    ejecutar(() => Modelo.escribir_bitacora(d.otId, {
      asunto_id: 'as-1', destinatario_id: dest,
      mensaje: 'Envío de ' + plural(n, 'documento', 'documentos') + ' por correo.'
    }), 'Envío registrado en la bitácora. En producción, acá sale el correo.');
  });
}
