/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   PRESUPUESTO — y la OR, que es "el apellido de la OT".

   Del original se copian los tres bloques (`Mano de Obra` · `Repuestos` ·
   `Externos` · `Observación`) y los tres procesos (`Cambio` · `Reparar` ·
   `Externo`).

   🔶 EL TEMPARIO VUELVE (16-08-2026). Se había sacado el 13-08 creyendo que
      el taller cotizaba un precio por trabajo. El PDF de la OR
      23505-18401-001 demuestra que no: cada línea lleva horas en DM, Reparar
      y Pintar, y el precio de cada columna es HORAS × TEMPARIO. Las once
      cifras de ese documento cuadran al peso con la fórmula que hay en
      `Reglas.totalesPresupuesto`, y hay una prueba que las compara para que
      si alguien la toca se caiga antes de una reunión.

      Textual de Marco: «Ya entendí que el tempario después se multiplica por
      las horas que colocan y te va dando el valor a cobrar de la operación».

   Lo que se corrige:

   🔴 La OR es COMPUESTA — `<OT>-<id_reparación>-<NNN>` — y el correlativo es
      por orden, no global. Nuestro diseño anterior la trataba como un
      consecutivo del sistema.

   🔴 El presupuesto se VERSIONA en vez de editarse encima. Cuando la
      aseguradora rechaza y pide ajustar, nace la versión 2 y la 1 queda
      intacta. Eso es lo que hace auditable la discusión con la compañía, y
      es imposible con el PDF actual — que además es el dolor #2 que el
      cliente nombró.

   🔶 SIN COSTOS NI UTILIDAD (decisión del 13-08-2026). El taller no lleva
      costos por orden, así que el presupuesto es la VENTA y nada más. Lo que
      sí gana valor con eso: la **venta parada**, que es la suma de lo
      presupuestado en órdenes que todavía no se entregan.
   ──────────────────────────────────────────────────────────────────────── */

/* Las tres operaciones del desplegable «OP» del sistema actual. El orden es
   el de la pantalla real. */
const PROCESOS = [
  { codigo: 'cambio',  nombre: 'Cambio',  ayuda: 'La pieza se reemplaza. Crea su fila en Repuestos y queda pedida a bodega al escribirla' },
  { codigo: 'reparar', nombre: 'Reparar', ayuda: 'La pieza se repara. Se le ponen horas de reparación y de pintura' },
  { codigo: 'externo', nombre: 'Externo', ayuda: 'Trabajo a terceros. Se cobra su precio, sin horas' }
];

function presuEstado() {
  ui.presupuesto = ui.presupuesto || { otId: null, presupuestoId: null, busqueda: '',
    linea: { proceso: '', descripcion: '' } };
  return ui.presupuesto;
}

function vPresupuesto() {
  const p = presuEstado();
  return p.otId ? vPresupuestoOT(Modelo.otPorId(p.otId)) : vPresupuestoListado();
}

/* ── Listado ───────────────────────────────────────────────────────────── */

/* `filaDesplegada` se elimina. Envolvia la lista en su propio <tr> para
   que el listado la pintara inline, y ese era el segundo camino que
   duplicaba el desplegable. Ahora la fila la inyecta `dobleClicPorFilas`
   y lo unico que hace falta es la lista: `listaPresupuestos`. */

/* La lista sola, sin la fila que la envuelve. La usan los DOS caminos que
   abren una orden en este panel —el botón «Ver» y el doble clic—, para que
   los dos muestren lo mismo.

   Antes el doble clic caía en `detalleDeOT`, la ficha larga con el vehículo,
   la tabla de presupuestos y la de repuestos: se apilaba encima de esta lista
   y la fila abierta quedaba con las dos cosas. Marco, 16-08-2026: «no es
   necesario tanto detalle, debe ser algo simple como lo que él tiene a día de
   hoy». Acá se elige QUÉ documento abrir, y para eso basta la línea con su
   etiqueta de datos. El detalle largo sigue estando donde corresponde: en la
   ficha de la orden. */
function listaPresupuestos(o) {
  if (!o) return '<div class="vacio"><div class="texto">No se pudo leer esta orden.</div></div>';
  const veMontos = Modelo.puede('presupuesto.montos');

  const acciones = (pr) => {
    const b = [];
    if (veMontos) b.push('<button class="btn secundario chico" data-pr-pdf="' + esc(pr.id) +
      '" data-pr-ot="' + esc(o.id) + '">' + ico('imprimir') + 'Ver PDF</button>');
    if (pr.estado === 'borrador') {
      b.push('<button class="btn secundario chico" data-pr-editar="' + esc(pr.id) +
        '" data-pr-ot="' + esc(o.id) + '">' + ico('editar') + 'Editar Presupuesto</button>');
      b.push('<button class="btn secundario chico" data-pr-enviar="' + esc(pr.id) + '">Enviar</button>');
    }
    if (pr.estado !== 'anulado' && pr.estado !== 'aprobado' && pr.estado !== 'rechazado')
      b.push('<button class="btn secundario chico" data-pr-anular="' + esc(pr.id) + '">Anular</button>');
    return b.join(' ');
  };

  if (!o.presupuestos.length)
    return '<div class="linea-presu"><span style="color:var(--gris-2)">Esta orden todavía no ' +
      'tiene OR abierta.</span></div>';

  return o.presupuestos.map((pr) => {
      const e = ESTADO_PRESUPUESTO[pr.estado] || { txt: pr.estado, clase: 'gris' };
      /* 🔶 LA ETIQUETA DE DATOS, ACÁ TAMBIÉN (16-08-2026, Marco): «que pueda
         ver una etiqueta de datos simple para saber qué documento abrir».
         Es el caso real: una OT con tres OR y el mismo botón «Ver PDF» tres
         veces. Sin saber qué hay adentro, abrirlas de a una es la única
         forma — y son tres PDF que hay que cerrar.

         El `data-or` es el mismo enganche que ya usa la torre y el listado:
         al pasar el mouse sale monto, estado y fechas de ESE presupuesto. */
      /* Los repuestos de ESTA OR, con la misma cuenta que la etiqueta de
         datos: las filas de su bloque Repuestos, cruzadas por el id de la
         línea. La lista y el globo tienen que decir lo mismo — si no, el que
         mira aprende a no creerle a ninguno de los dos. */
      const suyas = {};
      (pr.lineas || []).forEach((l) => { if (l.bloque === 'repuesto') suyas[l.id] = true; });
      const pedidos = o.repuestos.filter((r) => r.presupuestoLineaId && suyas[r.presupuestoLineaId]);
      const porLlegar = pedidos.filter((r) => !r.fechaBodega).length;

      return '<div class="linea-presu">' +
        /* Se rotula con el ID del presupuesto, no con el número de OR: las
           versiones comparten la OR y si no, el globo de la v2 mostraría los
           montos de la v1. */
        '<span class="cod" data-or="' + esc(pr.id) + '">Presupuesto ' +
          esc(pr.numeroOR) + '</span>' +
        '<span class="et ' + esc(e.clase) + '">' + esc(e.txt) + '</span>' +
        /* Sin «v1 · v2 · v3» (16-08-2026, Marco): «al final su identificador
           es la OR». Y es cierto — la versión era ruido en una lista donde lo
           que se elige es el documento, y el estado ya distingue la vigente
           de las anuladas. */
        /* Lo que decide si este documento se puede cerrar: si depende de una
           pieza y si esa pieza llegó. Las líneas y la fecha de envío salieron
           de acá el 16-08-2026 junto con las de la etiqueta — no cambiaban
           ninguna decisión al mirar la lista. */
        (pedidos.length
          ? '<span class="et ' + (porLlegar ? 'roja' : 'verde') + '" title="' +
            (porLlegar ? porLlegar + ' sin llegar de ' + pedidos.length
                       : 'las ' + pedidos.length + ' llegaron a bodega') + '">' +
            pedidos.length + (pedidos.length === 1 ? ' repuesto' : ' repuestos') +
            (porLlegar ? ' · ' + porLlegar + ' por llegar' : '') + '</span>'
          : '<span class="et gris" title="Este trabajo no depende de ninguna pieza">' +
            'sin repuestos</span>') +
        '<span class="monto">' + (veMontos ? fMonto(pr.total) : '•••••') + '</span>' +
        '<span class="acc">' + acciones(pr) + '</span></div>';
  }).join('');
}

function vPresupuestoListado() {
  const p = presuEstado();
  const q = p.busqueda.trim().toLowerCase();
  const filas = Modelo.torre()
    .filter((o) => !p.soloSin || !o.presupuestos.length)
    .filter((o) => !q ||
      [o.numeroOT, o.patente, o.cliente, o.presupuestos.map((x) => x.numeroOR).join(' ')]
        .join(' ').toLowerCase().includes(q));

  /* Las cuatro tarjetas de arriba —venta parada, esperando aprobación,
     aprobado y sin presupuesto— se sacaron el 16-08-2026 junto con las del
     resto de los paneles. Con ellas se van los cálculos que las alimentaban:
     dejarlos corriendo para nadie es trabajo que el navegador hace en cada
     pintada y que no se ve en ninguna parte. */

  return `
  <div class="panel">
    <div class="cab">
      <div><h2>${ico('presupuesto', 'g')}Presupuesto</h2>
        <div class="desc">Las 9 columnas del original, con el total neto por orden</div></div>
      <div class="filtros"><input type="search" id="q-presu" placeholder="OT, OR, patente o cliente" value="${esc(p.busqueda)}">
        <button class="btn secundario" id="presu-solo-sin" title="Ver solo las órdenes que todavía no tienen OR abierta">Sin OR</button></div>
    </div>
    <div class="grid-envoltorio"><table class="grid">
      <thead><tr><th>OT</th><th>Cliente</th><th>Patente</th><th>Marca</th><th>Modelo</th>
        <th>Tipo</th><th>Fecha de Ingreso</th><th>OR</th><th>Total neto</th><th>Acción</th></tr></thead>
      ${/* Sin el `slice(0, 60)` que había: mostraba sesenta órdenes de las que
            hubiera y el pie decía «Mostrando 60 de 102». Las otras 42 no
            existían para el que miraba. */''}
      <tbody>${filas.map((o) => {
        const neto = o.presupuestos.reduce((s, x) => s + x.neto, 0);
        return '<tr class="fila" data-ot="' + esc(o.numeroOT) + '"><td class="num"><strong>' + o.numeroOT + '</strong></td>' +
          '<td>' + esc(o.cliente) + '</td>' +
          '<td><span class="patente">' + esc(o.patente) + '</span></td>' +
          '<td>' + esc(o.marca || '—') + '</td><td>' + esc(o.modelo || '—') + '</td>' +
          '<td>' + esc(o.origenIngresoNombre || '—') + '</td>' +
          '<td class="num">' + fFechaHora(o.fechaIngreso) + '</td>' +
          // El mouse sobre la OR abre la etiqueta con monto, estado y fechas de
          // ese presupuesto: "que el usuario tenga el detalle ahí mismo y no
          // tenga que estar abriendo la OT". Textual del cliente, 15-08-2026.
          '<td class="num">' + (o.presupuestos.length
            ? '<span data-or="' + esc(o.presupuestos[o.presupuestos.length - 1].numeroOR) + '">' +
                esc(o.presupuestos[o.presupuestos.length - 1].numeroOR) + '</span>' +
              /* Cuántos documentos hay bajo esa OR, no «v5»: la versión se
                 sacó de la vista y dejar la letra v acá la traía de vuelta
                 disfrazada. */
              (o.presupuestos.length > 1 ? ' <span class="et gris">' + o.presupuestos.length +
                ' documentos</span>' : '')
            /* «sin OR», no «sin presupuesto» (16-08-2026, Marco). Es la
               palabra del taller: la OR es el trabajo abierto sobre la orden, y
               lo que falta acá es justamente eso — todavía nadie abrió el
               trabajo. «Sin presupuesto» suena a que la OR existe y está en
               blanco, que es otra cosa. */
            : '<span class="et ambar">sin OR</span>') + '</td>' +
          '<td class="num">' + (neto ? fMonto(neto) : '—') + '</td>' +
          '<td><span style="display:flex;gap:6px;flex-wrap:wrap">' +
            '<button class="btn secundario chico" data-presu-ot="' + esc(o.id) + '">' +
              ico('editar') + 'Generar</button>' +
            (o.presupuestos.length
              ? '<button class="btn secundario chico" data-presu-ver-fila="' + esc(o.numeroOT) + '">' +
                ico('imprimir') + 'Ver</button>'
              : '') +
          /* 🔴 SIN fila propia acá. La pintaba este listado Y la pintaba
             `dobleClicPorFilas`, cada uno con su estado: el botón «Ver» con
             `p.abierta` y la flecha con el del panel. Con los dos abiertos la
             lista salía DOS VECES. Ahora el botón mueve el MISMO estado que
             la flecha y hay un solo dueño. */
          '</span></td></tr>';
      }).join('')}</tbody>
    </table></div>
  </div>
`;
}

/* ── Presupuesto de una orden ──────────────────────────────────────────── */

function vPresupuestoOT(o) {
  const p = presuEstado();
  if (!o) { p.otId = null; return vPresupuestoListado(); }

  const actual = p.presupuestoId
    ? o.presupuestos.find((x) => x.id === p.presupuestoId)
    : o.presupuestos[o.presupuestos.length - 1];

  return `
  <div class="panel">
    <div class="cab">
      ${/* El título es el del original: `Editar presupuesto N° <OR>-<versión> -
           <PATENTE>`, y debajo el siniestro con su glosa. Se entra acá desde
           `Editar Presupuesto` del listado con una OR ya elegida, así que el
           encabezado tiene que decir CUÁL se está editando — si dice solo el
           número de orden, con varias OR no se sabe en cuál se está. */''}
      <div><h2>${ico('presupuesto', 'g')}${actual
        ? 'Editar presupuesto N° ' + esc(actual.numeroOR) + '-' +
          String(actual.version).padStart(3, '0') + ' · ' + esc(o.patente)
        : 'Generar presupuesto · Orden N° ' + o.numeroOT}</h2>
        <div class="desc">${o.siniestro
          ? esc(o.siniestro) + ' · ' + esc(o.origenIngresoNombre || '') + ' · '
          : ''}${esc(o.cliente)}${o.compania && o.compania !== '—' ? ' · ' + esc(o.compania) : ''}</div></div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn secundario" id="presu-volver">Volver al listado</button>
        ${/* «Eliminar esta OR» se fue de acá a la × de cada pestaña
             (16-08-2026, Marco). Un botón suelto arriba obliga a mirar cuál
             pestaña está activa para saber sobre cuál actúa; la × va DENTRO
             de la que se va a borrar y no hay que adivinar nada. */''}
        ${/* La pérdida total la declara el EVALUADOR, no el recepcionista, y
              se decide acá: es mirando el presupuesto donde se ve que reparar
              cuesta más que el auto. Sólo aparece si el rol puede declararla y
              si la orden sigue abierta. */
          Modelo.puede('perdida_total.declarar') && !o.esFinal
          ? '<button class="btn secundario" id="presu-pt" ' +
            'title="Declarar el vehículo como pérdida total. Cierra la orden.">Pérdida total</button>'
          : ''}
        <button class="btn" id="presu-nuevo">Agregar OR</button>
      </div>
    </div>
    <div class="cuerpo">
      ${o.presupuestos.length ? `
      <div class="chips" style="margin-bottom:11px">
        ${/* Cada OR con su × arriba a la derecha. Sólo la muestra el que puede
             presupuestar, y sólo sobre borradores: un presupuesto ya enviado
             no se borra —se anula o se versiona—, porque la discusión con la
             compañía tiene que quedar completa. Ahí la × no se dibuja en vez
             de dibujarse y rebotar: el estado de la pestaña ya lo explica. */''}
        ${o.presupuestos.map((x) => '<span class="chip-or' +
          (actual && x.id === actual.id ? ' activo' : '') + '">' +
          '<button class="chip" data-presu-ver="' + esc(x.id) + '">OR ' + esc(x.numeroOR) +
            ' · v' + x.version + '</button>' +
          (Modelo.puede('presupuesto.crear') && x.estado === 'borrador'
            ? '<button class="quitar-or" data-presu-borrar="' + esc(x.id) +
              '" title="Eliminar la OR ' + esc(x.numeroOR) + '">&times;</button>' : '') +
          '</span>').join('')}
      </div>` : ''}
      ${actual ? vPresupuestoDetalle(o, actual) : `
      <div class="vacio"><div class="titulo">Esta orden no tiene presupuestos</div>
      <div class="texto">Aprieta <strong>Agregar OR</strong>. Cada presupuesto genera su propia OR:
      la OT es el nombre y el presupuesto el apellido.</div></div>`}
    </div>
  </div>`;
}

/* ── La grilla del presupuesto ─────────────────────────────────────────
   Punto 8, pedido el 15-08-2026. El cliente dijo que le gusta el PDF que ya
   sale —"hace como un Excel por columna"— y que la pantalla de carga no se
   parece en nada: se carga en un formulario aparte y el resultado se ve en
   otro lado.

   Así que la pantalla pasa a ser el documento. Una sola tabla, cada monto en
   la columna de su tipo, los subtotales por columna al pie y la última fila
   sirve para escribir. Se carga SOBRE la grilla y se ve al tiro dónde cae.

   Y la pregunta que pidió: **¿el trabajo requiere repuestos?** Si la respuesta
   es no, la columna no se dibuja y hay una cosa menos que mirar. Es la mitad
   de la simplificación que pedía: no sacar funciones, sacar de la vista lo que
   este trabajo no usa. */
/* ── La grilla del presupuesto ─────────────────────────────────────────
   Reconstruida el 16-08-2026 desde el documento real (OR 23505-18401-001) y
   las tres pantallas del sistema actual que trajo Marco. Son los mismos tres
   bloques del original —Mano de Obra · Repuestos · Externos— pero con la
   aritmética a la vista, que es lo que allá no está.

   Cómo se arma, y por qué así:

   · Se elige el TEMPARIO una vez, arriba. Es el valor de la hora y multiplica
     las tres columnas de tiempo. Queda guardado EN el presupuesto: si mañana
     sube la tarifa, una OR ya firmada no puede cambiar de monto sola.

   · Se escribe DESCRIPCIÓN + OP y se agrega. La operación es Cambio, Reparar
     o Externo, igual que el desplegable «OP» del original.

   · Cada línea lleva las TRES columnas de horas habilitadas —DM, Reparar y
     Pintar—, textual de Marco: «igual deben quedar las tres columnas
     habilitadas porque pueden reparar y pintar y se le asigna hora». Una
     puerta que se repara hay que pintarla, y el original obligaba a decidir
     una sola.

   · Cada columna cobra `horas × tempario`, y el valor se ve EN LA LÍNEA. En
     el original se escriben horas y la plata recién aparece en el PDF: el
     evaluador cotiza a ciegas y descubre el monto cuando ya lo mandó.

   · Una línea de operación **Cambio** crea además su fila en Repuestos, con la
     descripción heredada. Ahí van el código, la cantidad, el proveedor y el
     precio — y ES LO QUE BAJA A BODEGA cuando la OR se aprueba.

   · El PROVEEDOR decide si el repuesto se cobra: si la pieza la puso el
     taller, se cobra; si la puso la compañía, no la desembolsó nadie acá. Y
     «DYP», «Dyp», «dyp» y «DyP» son EL MISMO proveedor — en el original son
     cuatro, y por eso ninguna suma por proveedor sirve. */

function fHoras(n) {
  const v = Number(n) || 0;
  return v ? v.toFixed(2).replace('.', ',') : '';
}

/* Las tres columnas de tiempo del documento. El impreso agrupa por ESTAS, no
   por la operación: una misma línea sale en Reparar y en Pintar. */
const COL_HORAS = [
  { campo: 'horas_dm',   rot: 'DM (horas)',   bloque: 'Desmontar y montar',
    ayuda: 'Horas de desmontar y montar la pieza' },
  { campo: 'horas_rep',  rot: 'Rep (horas)',  bloque: 'Reparar',
    ayuda: 'Horas de reparación de la pieza' },
  { campo: 'horas_pint', rot: 'Pint (horas)', bloque: 'Pintar',
    ayuda: 'Horas de pintura' }
];

const OP_ROT = { cambio: 'C', reparar: 'R', externo: 'E' };

/* El presupuesto abierto: el elegido, o el ultimo de la orden. Lo usan
   los manejadores del tempario, la observacion y la linea nueva. */
function presuActual() {
  const p = presuEstado();
  const o = Modelo.otPorId(p.otId);
  if (!o || !o.presupuestos.length) return null;
  return (p.presupuestoId && o.presupuestos.find((x) => x.id === p.presupuestoId)) ||
    o.presupuestos[o.presupuestos.length - 1];
}

/* La cabecera de cada uno de los tres bloques. Van numerados y con su
   subtotal a la derecha porque son TRES COSAS DISTINTAS que el documento
   suma por separado, y en la pantalla anterior se leian como una sola tabla
   larga. Textual de Marco: "debiese quedar clara la separacion entre Mano de
   Obra / Repuestos / Trabajos externos - T.O.T.". */
function cabBloquePresu(n, titulo, quePaga, subtotal, $) {
  return '<div class="cab-bloque">' +
    '<span class="orden">' + n + '</span>' +
    '<div class="texto"><span class="tit">' + esc(titulo) + '</span>' +
      '<span class="que">' + esc(quePaga) + '</span></div>' +
    '<div class="monto"><span class="rot">Subtotal</span>' +
      '<span class="val">' + $(subtotal) + '</span></div>' +
  '</div>';
}

function grillaPresupuesto(o, pr, editable, $) {
  const p = presuEstado();
  const t = pr.totales ||
    Reglas.totalesPresupuesto(pr.lineas, pr.tempario, o.deducible, 19);
  /* Los tres bloques son INDEPENDIENTES y se separan por `bloque`. La OP de
     una línea de mano de obra clasifica ESE trabajo —cambiar, reparar,
     mandar afuera— y no pone nada en las otras dos tablas: Repuestos y
     Externos se escriben a mano, fila por fila. Corregido el 16-08-2026 con
     el sistema real a la vista. */
  const lineas = pr.lineas || [];
  const manoObra = lineas.filter(Reglas.esManoObra);
  const repuestos = lineas.filter(Reglas.esRepuesto);
  const externos = lineas.filter(Reglas.esExterno);

  /* ── Tempario ──────────────────────────────────────────────────────────
     FIJO. Se muestra, no se elige. Lo mueve SÓLO administración, en
     Configuración → Parámetros, y con el permiso `configuracion` que ningún
     otro rol tiene. Pedido de Marco el 16-08-2026.

     Y es lo correcto: el valor hora es una decisión del taller, no de quien
     está cotizando un auto. Con un selector en esta pantalla, dos
     evaluadores podían mandarle a la misma compañía dos tarifas distintas el
     mismo día, y la discusión que sigue no la gana nadie.

     El presupuesto guarda el suyo, congelado al abrirse la OR: si mañana
     administración sube la tarifa, una OR ya cotizada no puede cambiar de
     monto sola. Para recotizar con la tarifa nueva se crea una versión. */
  const tempActual = Number(Reglas.parametro(Modelo.base(), 'tempario', 10000));
  const desfasado = pr.tempario !== tempActual;
  const horasTotales = t.horas.dm + t.horas.rep + t.horas.pint;

  const cabTempario = `
    <div class="tira-tempario">
      <div class="celda">
        <span class="rot">Tempario · valor de la hora</span>
        <span class="val">${$(pr.tempario)}</span>
        <span class="pie">${editable
          ? 'Fijado al abrir la OR. Lo cambia administración en Configuración → Parámetros'
          : 'El que tenía el taller cuando se cotizó esta OR'}${
          desfasado ? ' · <strong>hoy la tarifa es ' + $(tempActual) +
            '</strong>: esta OR conserva la suya. Para recotizar, versión nueva' : ''}</span>
      </div>
      <div class="celda">
        <span class="rot">Horas cargadas</span>
        <span class="val">${fHoras(horasTotales) || '0'} h</span>
        <span class="pie">DM ${fHoras(t.horas.dm) || '0'} ·
          Reparar ${fHoras(t.horas.rep) || '0'} · Pintar ${fHoras(t.horas.pint) || '0'}</span>
      </div>
      <div class="celda destacada">
        <span class="rot">Mano de obra</span>
        <span class="val">${$(t.manoObra)}</span>
        <span class="pie">horas × tempario</span>
      </div>
    </div>`;

  /* ── Agregar una línea ────────────────────────────────
     Arriba de todo y con la forma del sistema actual: una franja con los
     encabezados «Descripción» y «OP», el campo de descripción ANCHO —que es
     el que más se escribe: «neumatico sailun terramax sv301 235/55R19
     delantero derecho» no cabe en una casilla de 180px— y el botón Enviar.

     Es UN formulario para los TRES bloques: la operación decide a cuál va.
     Cambio crea la línea de mano de obra Y su fila en Repuestos; Reparar solo
     la de mano de obra; Externo va al bloque de trabajos externos. Estaba al
     pie del bloque 1 y se leía como si fuera solo de ahí.

     Pedido de Marco el 16-08-2026: «debiese ser exactamente igual a cómo está
     en el sistema original... partamos dejándolo igual y después hagamos
     upgrades». */
  const formLinea = !editable ? '' : `
  <div class="agregar-linea">
    <div class="rot"><span class="desc">Descripción</span><span class="op">OP</span><span></span></div>
    <div class="fila">
      <input id="l-desc" value="${esc(p.linea.descripcion)}"
        placeholder="Tal como se escribe: «neumatico sailun terramax sv301 235/55R19 delantero derecho»">
      <select id="l-op">
        <option value="">Seleccione</option>
        ${PROCESOS.map((x) => '<option value="' + x.codigo + '"' +
          (p.linea.proceso === x.codigo ? ' selected' : '') + ' title="' + esc(x.ayuda) + '">' +
          esc(x.nombre) + '</option>').join('')}
      </select>
      <button class="btn" id="l-agregar">Enviar</button>
    </div>
    <div class="pie">Agrega una línea de <strong>Mano de Obra</strong>. La OP dice qué se le
      hace a esa pieza —<strong>Cambio</strong>, <strong>Reparar</strong> o
      <strong>Externo</strong>— y las horas se escriben después, en la propia fila.
      Los repuestos y los trabajos externos se agregan en sus tablas, más abajo.</div>
  </div>`;

  /* ── Bloque 1 · Mano de Obra ───────────────────────────────────────── */
  const filaMO = (l, i) => {
    const sub = COL_HORAS.reduce((s, c) => s + (Number(l[c.campo]) || 0), 0) * pr.tempario;
    return '<tr><td class="num">' + (i + 1) + '</td>' +
      '<td>' + esc(l.descripcion) + '</td>' +
      '<td class="num"><span class="et ' + (l.proceso === 'cambio' ? 'azul' : 'gris') +
        '" title="' + esc(l.proceso) + '">' + OP_ROT[l.proceso] + '</span></td>' +
      COL_HORAS.map((c) => '<td class="num">' + (editable
        /* `type="text"` con `inputmode="decimal"`, NO `type=number`: el campo
           numerico solo acepta el PUNTO como separador, asi que un "1,20"
           -que es como se escribe una hora en Chile y como viene en el
           documento real- lo rechaza y deja la casilla EN BLANCO. Quedaba el
           valor en pesos debajo y la casilla vacia arriba: el evaluador
           creeria que se le borraron las horas. El teclado del celular igual
           abre en numeros por el `inputmode`. */
        ? '<input type="text" inputmode="decimal" style="width:80px" ' +
          'data-horas="' + esc(l.id) + '" data-campo="' + c.campo + '" ' +
          'value="' + esc(fHoras(l[c.campo])) + '" placeholder="0,00" title="' + esc(c.ayuda) + '">'
        : (fHoras(l[c.campo]) || '—')) +
        // El peso de cada columna, debajo del tiempo. Es la cuenta que el
        // original no muestra hasta que el PDF ya salió.
        (Number(l[c.campo]) ? '<div class="ayuda" style="margin:2px 0 0">' +
          $(Math.round(Number(l[c.campo]) * pr.tempario)) + '</div>' : '') + '</td>').join('') +
      '<td class="num"><strong>' + $(Math.round(sub)) + '</strong></td>' +
      '<td>' + (editable ? '<button class="quitar" data-quitarlinea="' + esc(l.id) +
        '" title="Quitar la línea">&times;</button>' : '') + '</td></tr>';
  };

  const bloqueMO = `
  <section class="bloque-presu mano-obra">
    ${cabBloquePresu(1, 'Mano de Obra', 'El trabajo del taller: horas \u00d7 tempario', t.manoObra, $)}
    <div class="grid-envoltorio"><table class="grid">
      <thead><tr><th style="width:44px">N°</th><th>Descripción</th><th style="width:52px">OP</th>
        ${COL_HORAS.map((c) => '<th class="num" style="width:106px" title="' + esc(c.ayuda) +
          '">' + esc(c.rot) + '</th>').join('')}
        <th class="num" style="width:112px">Valor</th><th style="width:44px"></th></tr></thead>
      <tbody>${manoObra.length ? manoObra.map(filaMO).join('')
        : '<tr><td colspan="8" style="color:var(--gris-2);padding:9px">Todavía no hay líneas. ' +
          'Se escriben abajo: descripción y operación.</td></tr>'}</tbody>
      <tfoot><tr><td colspan="3" style="text-align:right"><strong>Subtotal</strong></td>
        ${COL_HORAS.map((c) => {
          const h = manoObra.reduce((s, l) => s + (Number(l[c.campo]) || 0), 0);
          return '<td class="num"><strong>' + (fHoras(h) || '0') + '</strong>' +
            '<div class="ayuda" style="margin:2px 0 0">' + $(Math.round(h * pr.tempario)) +
            '</div></td>';
        }).join('')}
        <td class="num"><strong>${$(t.manoObra)}</strong></td><td></td></tr></tfoot>
    </table></div>
  </section>`;

  /* ── Bloque 2 · Repuestos ──────────────────────────────────────────── */
  const campoLinea = (l, nombre, tipo, ancho, extra) => (editable
    ? '<input type="' + tipo + '" style="width:' + ancho + '" data-rep="' + esc(l.id) + '" ' +
      'data-campo="' + nombre + '" value="' + esc(l[nombre] == null ? '' : l[nombre]) + '"' +
      (extra || '') + '>'
    : esc(l[nombre] === '' || l[nombre] == null ? '—' : l[nombre]));

  const filaRep = (l) => {
    const cobra = Reglas.esProveedorTaller(l.proveedor);
    return '<tr><td>' + campoLinea(l, 'codigo', 'text', '110px', ' placeholder="El de bodega"') + '</td>' +
      '<td class="num">' + campoLinea(l, 'cantidad', 'number', '70px', ' min="1"') + '</td>' +
      // Se escribe: esta tabla se llena a mano, no hereda de nadie.
      '<td>' + campoLinea(l, 'descripcion', 'text', '100%', ' placeholder="La pieza, como se pide"') + '</td>' +
      '<td>' + campoLinea(l, 'proveedor', 'text', '152px',
        ' placeholder="DYP, SURA, …" list="lista-proveedores"') + '</td>' +
      '<td class="num">' + campoLinea(l, 'precio_unitario', 'number', '120px', ' min="0" placeholder="0"') + '</td>' +
      '<td class="num">' + (cobra
        ? '<strong>' + $(Reglas.cobroRepuesto(l)) + '</strong>'
        : '<span class="et gris" title="La pieza la pone ' + esc(l.proveedor || 'un tercero') +
          ': el taller no la desembolsó, así que no la cobra">no se cobra</span>') + '</td>' +
      '<td>' + (editable ? '<button class="quitar" data-quitarlinea="' + esc(l.id) +
        '" title="Quitar la fila">&times;</button>' : '') + '</td></tr>';
  };

  const bloqueRep = `
  <section class="bloque-presu repuestos">
    ${cabBloquePresu(2, 'Repuestos', 'Se escriben a mano. Son la solicitud que ve Bodega',
      t.repuestos, $)}
    <div class="grid-envoltorio"><table class="grid">
      <thead><tr><th style="width:130px">Código</th><th style="width:84px">Cantidad</th>
        <th>Descripción</th><th style="width:172px">Proveedor</th>
        <th class="num" style="width:130px">Precio unitario</th>
        <th class="num" style="width:126px">Se cobra</th><th style="width:44px"></th></tr></thead>
      <tbody>${repuestos.length ? repuestos.map(filaRep).join('')
        : '<tr><td colspan="7" style="color:var(--gris-2);padding:9px">Sin repuestos. ' +
          'Se agregan con <strong>Añadir fila</strong>.</td></tr>'}</tbody>
      <tfoot><tr><td colspan="5" style="text-align:right"><strong>Subtotal</strong></td>
        <td class="num"><strong>${$(t.repuestos)}</strong></td><td></td></tr></tfoot>
    </table></div>
    ${editable ? '<div class="pie-anadir"><button class="btn secundario" data-anadir="repuesto">' +
      'Añadir fila</button></div>' : ''}
    <span class="ayuda"><strong>Esta tabla es la solicitud de repuestos.</strong> Lo que se
      escribe acá viaja a Bodega, al check-list, al consolidado y al detalle de lo que está
      pendiente — sin que bodega lo vuelva a escribir y sin esperar la aprobación de la
      compañía. Sólo se le cobran al cliente las piezas que pone el taller: escribir
      <strong>DYP</strong> en cualquier forma es el mismo proveedor.</span>
  </section>`;

  /* ── Bloque 3 · Externos (T.O.T.) ──────────────────────────────────── */
  const filaExt = (l) =>
    '<tr><td>' + campoLinea(l, 'codigo', 'text', '110px', '') + '</td>' +
    '<td>' + campoLinea(l, 'descripcion', 'text', '100%', ' placeholder="El trabajo que hace el tercero"') + '</td>' +
    '<td>' + campoLinea(l, 'proveedor', 'text', '172px',
      ' placeholder="Quién lo hace" list="lista-proveedores"') + '</td>' +
    '<td class="num">' + campoLinea(l, 'precio_unitario', 'number', '120px', ' min="0" placeholder="0"') + '</td>' +
    '<td>' + (editable ? '<button class="quitar" data-quitarlinea="' + esc(l.id) +
      '" title="Quitar">&times;</button>' : '') + '</td></tr>';

  const bloqueExt = `
  <section class="bloque-presu externos">
    ${cabBloquePresu(3, 'Trabajos externos \u00b7 T.O.T.',
      'Se escriben a mano. Lo que hace un tercero y el taller factura', t.tot, $)}
    <div class="grid-envoltorio"><table class="grid">
      <thead><tr><th style="width:130px">Código</th><th>Descripción</th>
        <th style="width:190px">Proveedor</th><th class="num" style="width:130px">Precio</th>
        <th style="width:44px"></th></tr></thead>
      <tbody>${externos.length ? externos.map(filaExt).join('')
        : '<tr><td colspan="5" style="color:var(--gris-2);padding:9px">Sin trabajos externos. ' +
          'Se agregan con <strong>Añadir fila</strong>.</td></tr>'}</tbody>
      <tfoot><tr><td colspan="3" style="text-align:right"><strong>Subtotal</strong></td>
        <td class="num"><strong>${$(t.tot)}</strong></td><td></td></tr></tfoot>
    </table></div>
    ${editable ? '<div class="pie-anadir"><button class="btn secundario" data-anadir="externo">' +
      'Añadir fila</button></div>' : ''}
  </section>`;

  /* ── El cierre del documento ───────────────────────────────────────── */
  const fila = (rot, val, fuerte, nota) =>
    '<tr><td>' + esc(rot) + (nota ? ' <span class="ayuda">' + esc(nota) + '</span>' : '') + '</td>' +
    '<td class="num"' + (fuerte ? ' style="font-weight:700"' : '') + '>' + val + '</td></tr>';

  const cierre = `
  <div class="rejilla-campos" style="margin-top:12px;align-items:start">
    <fieldset class="bloque"><legend>Observación</legend>
      ${editable
        ? '<textarea id="presu-obs" rows="6" placeholder="Lo que la compañía tiene que leer junto ' +
          'al monto">' + esc(pr.observacion) + '</textarea>' +
          '<div style="margin-top:8px"><button class="btn secundario" id="presu-obs-guardar">' +
          'Guardar la observación</button></div>'
        : (pr.observacion
          ? '<div class="nota">' + esc(pr.observacion) + '</div>'
          : '<div class="ayuda">Sin observación.</div>')}
    </fieldset>
    <fieldset class="bloque"><legend>Totales</legend>
      <div class="grid-envoltorio"><table class="grid"><tbody>
        ${fila('Mano de Obra', $(t.manoObra))}
        ${fila('Repuestos neto', $(t.repuestos))}
        ${fila('T.O.T. neto', $(t.tot))}
        ${fila('Subtotal neto', $(t.subtotalNeto), true)}
        ${fila('Deducible neto', t.deducible ? '&minus; ' + $(t.deducible) : $(0), false, 'de la póliza')}
        ${fila('Total neto', $(t.neto), true)}
        ${fila('IVA 19%', $(t.iva))}
        ${fila('Total', $(t.total), true)}
      </tbody></table></div>
    </fieldset>
  </div>`;

  /* Los proveedores que ya se usaron, para que quien escribe no invente una
     quinta forma del mismo nombre. Es la sugerencia, no una jaula: un
     proveedor nuevo se escribe igual. */
  const vistos = {};
  (Modelo.torre() || []).forEach((x) => (x.presupuestos || []).forEach((y) =>
    (y.lineas || []).forEach((l) => { if (l.proveedor) vistos[l.proveedor] = true; })));
  const datalist = '<datalist id="lista-proveedores">' +
    Object.keys(vistos).sort().map((v) => '<option value="' + esc(v) + '">').join('') +
    '</datalist>';

  return datalist + cabTempario + formLinea + bloqueMO + bloqueRep + bloqueExt + cierre;
}

function vPresupuestoDetalle(o, pr) {
  const p = presuEstado();
  const editable = pr.estado === 'borrador';

  /* Dos niveles de permiso: ve las líneas / ve los montos.
     "Tiene el presupuesto y no puede ver los valores."
     ⚠️ Acá está MODELADO: el dato igual llegó al navegador. Se garantiza en
     PostgreSQL con RLS. */
  const veMontos = Modelo.puede('presupuesto.montos');
  const $ = (n) => (veMontos ? fMonto(n) : '<span title="Este rol no ve los montos">•••••</span>');
  const repuestosPedidos = o.repuestos.filter((r) => pr.lineas.some((l) => l.id === r.presupuesto_linea_id));

  return `
  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:11px">
    <span class="et ${ESTADO_PRESUPUESTO[pr.estado] ? ESTADO_PRESUPUESTO[pr.estado].clase : 'gris'}">
      ${esc(ESTADO_PRESUPUESTO[pr.estado] ? ESTADO_PRESUPUESTO[pr.estado].txt : pr.estado)}</span>
    <span class="cod">OR ${esc(pr.numeroOR)}</span>
    <span class="et gris">versión ${pr.version}</span>
    <span style="flex:1"></span>
    ${editable ? '<button class="btn" data-presu-estado="enviado">Enviar a la compañía</button>' : ''}
    ${pr.estado === 'enviado' ? '<button class="btn" data-presu-estado="aprobado">Marcar aprobado</button>' +
      '<button class="btn secundario" data-presu-estado="rechazado">Marcar rechazado</button>' : ''}
    ${/* SIN botón «Pedir repuestos a bodega» (16-08-2026, Marco): «eso no
         debería estar ya que se pide por los repuestos y eso es
         automáticamente». Y tiene razón: las piezas salen del bloque
         Repuestos y bajan solas cuando la OR se aprueba. Un botón que hace lo
         mismo que ya pasa solo enseña a desconfiar de lo automático — el
         usuario lo aprieta «por si acaso» y nunca sabe cuál de los dos
         caminos movió la pieza. */''}
    <button class="btn secundario" id="presu-version">Crear versión nueva</button>
    ${Modelo.puede('presupuesto.montos')
      ? '<button class="btn secundario" id="presu-pdf" data-pr="' + esc(pr.id) + '">' +
        ico('imprimir') + 'Ver el documento</button>'
      : ''}
  </div>

  ${grillaPresupuesto(o, pr, editable, $)}

  ${editable ? '' : `
  <div class="nota">Este presupuesto está <strong>${esc(pr.estado)}</strong> y no se edita.
  Para cambiarlo se crea una versión nueva: así queda auditable qué se le mandó a la compañía y cuándo.</div>`}

  <div class="panel" style="margin-top:11px"><div class="cuerpo">
    <div class="ficha-rejilla">
      <fieldset class="bloque"><legend>Totales</legend>
        <div class="dato"><span class="k">Neto</span><span class="v">${$(pr.neto)}</span></div>
        <div class="dato"><span class="k">IVA ${Reglas.parametro(Modelo.base(), 'iva', 19)}%</span><span class="v">${$(pr.iva)}</span></div>
        <div class="dato"><span class="k">Total</span><span class="v"><strong>${$(pr.total)}</strong></span></div>
        ${veMontos ? '' : '<div class="pie-nota" style="margin-top:6px">Estás mirando como <strong>' +
          esc(Modelo.rolActual().nombre) + '</strong>: este rol ve las líneas pero no los valores.</div>'}
      </fieldset>
      <fieldset class="bloque"><legend>Qué significa esta OR para el taller</legend>
        <div class="dato"><span class="k">Estado</span><span class="v">
          <span class="et ${ESTADO_PRESUPUESTO[pr.estado] ? ESTADO_PRESUPUESTO[pr.estado].clase : 'gris'}">
          ${esc(ESTADO_PRESUPUESTO[pr.estado] ? ESTADO_PRESUPUESTO[pr.estado].txt : pr.estado)}</span></span></div>
        <div class="dato"><span class="k">Venta de esta OR</span><span class="v"><strong>${$(pr.total)}</strong></span></div>
        <div class="dato"><span class="k">Venta total de la OT</span><span class="v">${$(totalOT(o))}</span></div>
        <div class="dato"><span class="k">¿Está entregada?</span><span class="v">${o.esFinal
          ? '<span class="et gris">sí, ya facturable</span>'
          : '<span class="et ambar">no · esta venta está parada</span>'}</span></div>
      </fieldset>
    </div>
  </div></div>

  <fieldset class="bloque" style="margin-top:11px"><legend>Pedido a bodega</legend>
    ${repuestosPedidos.length
      ? '<div class="grid-envoltorio"><table class="grid"><thead><tr><th>Repuesto</th><th>Paga</th>' +
        '<th>Solicitado</th><th>Llegó</th></tr></thead><tbody>' +
        repuestosPedidos.map((r) => '<tr><td>' + esc(r.descripcion) + '</td>' +
          '<td><span class="et ' + (r.pagaTaller ? 'roja' : 'gris') + '">' + esc(r.responsablePago) + '</span></td>' +
          '<td class="num">' + fFechaHora(r.fechaSolicitud) + '</td>' +
          '<td class="num">' + (r.fechaBodega ? fFechaHora(r.fechaBodega) : '<span class="et ambar">pendiente</span>') +
          '</td></tr>').join('') + '</tbody></table></div>'
      : '<div style="color:var(--gris-2);font-size:12.5px;padding:6px 2px">Todavía no se pidió nada a bodega.</div>'}
  </fieldset>`;
}

/* ── Cableado ──────────────────────────────────────────────────────────── */

function pPresupuesto() {
  // Doble clic abre la orden en pestaña nueva, igual que en la torre.
  /* El doble clic abre la MISMA lista simple que el botón «Ver», no la
     ficha larga: en este panel se elige qué documento abrir, no se estudia
     la orden. Apilaba las dos cosas en la fila abierta. */
  dobleClicPorFilas(null, { detalle: (clave) => listaPresupuestos(ordenPorNumeroOId(clave)) });
  const p = presuEstado();

  const q = document.getElementById('q-presu');
  if (q) q.addEventListener('input', () => {
    p.busqueda = q.value; render();
    const n = document.getElementById('q-presu');
    n.focus(); n.setSelectionRange(n.value.length, n.value.length);
  });

  const soloSin = document.getElementById('presu-solo-sin');
  if (soloSin) {
    soloSin.classList.toggle('activo', !!p.soloSin);
    soloSin.addEventListener('click', () => { p.soloSin = !p.soloSin; render(); });
  }

  /* 🔴 LOS BOTONES DE FILA CORTAN EL EVENTO. La fila entera abre la orden con
     doble clic, así que sin `stopPropagation` apretar dos veces seguidas
     `Ver` —para abrir y cerrar, que es lo natural— abría además la ventana de
     la orden encima. Se vio probando. */
  document.querySelectorAll('[data-presu-ot]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    p.otId = b.dataset.presuOt; p.presupuestoId = null; render();
  }));

  /* `Ver` despliega la línea de abajo, y vuelve a apretarse para cerrarla. Se
     abre una a la vez: con 60 filas, dejarlas todas abiertas convierte el
     listado en una lista de presupuestos y se pierde la lista de órdenes. */
  document.querySelectorAll('[data-presu-ver-fila]').forEach((b) => b.addEventListener('click', (ev) => {
    // Mueve el MISMO estado que la flecha de la fila. Tenía el suyo y por eso
    // se podían abrir los dos a la vez, pintando la lista dos veces.
    ev.stopPropagation();
    alternarDetalle(b.dataset.presuVerFila);
  }));

  document.querySelectorAll('[data-pr-pdf]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    abrirImpreso('presupuesto', b.dataset.prOt, b.dataset.prPdf);
  }));

  // `Editar Presupuesto` entra a ESE presupuesto, no al último de la orden:
  // desde el listado se eligió cuál, y perder esa elección sería hacérsela
  // repetir adentro.
  document.querySelectorAll('[data-pr-editar]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    p.otId = b.dataset.prOt; p.presupuestoId = b.dataset.prEditar; render();
  }));

  document.querySelectorAll('[data-pr-enviar]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    ejecutar(() => Modelo.cambiar_estado_presupuesto(b.dataset.prEnviar, 'enviado'),
      'Presupuesto enviado a la compañía.');
  }));

  /* Anular pregunta. Es la única de las cuatro que no se deshace sola: deja la
     OR fuera de la venta del taller, y si fue por error hay que crear otra. */
  document.querySelectorAll('[data-pr-anular]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (!confirm('¿Anular este presupuesto?\n\nLa OR deja de contar en la venta de la orden y ' +
                 'del taller. No se reactiva: si fue un error, hay que generar otra.\n\n' +
                 'Se puede deshacer con Ctrl+Z.')) return;
    ejecutar(() => Modelo.cambiar_estado_presupuesto(b.dataset.prAnular, 'anulado'),
      'Presupuesto anulado. Salió de la venta parada.');
  }));
  /* Eliminar una OR creada por equivocación. Solo en borrador, y preguntando:
     es la única acción del presupuesto que borra en vez de versionar. */
  document.querySelectorAll('[data-presu-borrar]').forEach((b) => b.addEventListener('click', (ev) => {
    // La × vive DENTRO de la pestaña, así que su clic también seleccionaría
    // esa OR. Se corta acá: no tiene sentido abrir lo que se va a borrar.
    ev.stopPropagation();
    const o = Modelo.otPorId(p.otId);
    const pr = o && o.presupuestos.find((x) => x.id === b.dataset.presuBorrar);
    if (!pr) return;
    if (!confirm('¿Eliminar la OR ' + pr.numeroOR + ' con sus líneas? No se puede recuperar, ' +
                 'pero sí se puede deshacer con Ctrl+Z.')) return;
    ejecutar(() => Modelo.eliminar_presupuesto(pr.id), 'OR ' + pr.numeroOR + ' eliminada.',
      () => { p.presupuestoId = null; });
  }));

  const volver = document.getElementById('presu-volver');
  if (volver) volver.addEventListener('click', () => { p.otId = null; p.presupuestoId = null; render(); });

  document.querySelectorAll('[data-presu-ver]').forEach((b) => b.addEventListener('click', () => {
    p.presupuestoId = b.dataset.presuVer; render();
  }));

  const nuevo = document.getElementById('presu-nuevo');
  if (nuevo) nuevo.addEventListener('click', () =>
    ejecutar(() => Modelo.crear_presupuesto(p.otId, { lineas: [] }), 'OR creada.',
      (r) => { p.presupuestoId = r.presupuesto_id; render(); }));

  /* Ver el documento sin salir de la pantalla. El botón decía "PDF · tanda 7"
     y solo avisaba que estaba pendiente: quien acaba de armar un presupuesto
     quiere ver CÓMO le va a llegar a la compañía antes de mandarlo, y tenía
     que irse a la ficha de la orden a buscarlo. Se abre la versión que está a
     la vista, no la última: si se está mirando la v1, se ve la v1. */
  const pdf = document.getElementById('presu-pdf');
  if (pdf) pdf.addEventListener('click', () => abrirImpreso('presupuesto', p.otId, pdf.dataset.pr));

  const version = document.getElementById('presu-version');
  if (version) version.addEventListener('click', () => {
    const o = Modelo.otPorId(p.otId);
    const actual = p.presupuestoId ? o.presupuestos.find((x) => x.id === p.presupuestoId)
                                   : o.presupuestos[o.presupuestos.length - 1];
    if (!actual) return avisar({ ok: false, motivo: 'No hay presupuesto del cual sacar una versión.' });
    ejecutar(() => Modelo.nueva_version_presupuesto(actual.id),
      'Versión nueva. La anterior queda intacta.', (r) => { p.presupuestoId = r.presupuesto_id; render(); });
  });

  document.querySelectorAll('[data-presu-estado]').forEach((b) => b.addEventListener('click', () => {
    const o = Modelo.otPorId(p.otId);
    const actual = p.presupuestoId ? o.presupuestos.find((x) => x.id === p.presupuestoId)
                                   : o.presupuestos[o.presupuestos.length - 1];
    /* Al aprobar se piden los repuestos solos, así que el mensaje lo dice: si
       el usuario no ve que pasó, va a ir a escribirlos a mano a bodega — que es
       exactamente lo que esto viene a evitar. */
    ejecutar(() => Modelo.cambiar_estado_presupuesto(actual.id, b.dataset.presuEstado),
      (r) => 'Presupuesto ' + b.dataset.presuEstado + '.' + (r && r.repuestos
        ? ' Se pidieron ' + r.repuestos + (r.repuestos === 1 ? ' repuesto' : ' repuestos') +
          ' a bodega.' : ''));
  }));

  /* Declarar la pérdida total. Pide el fundamento por escrito y avisa que
     cierra la orden: es un estado terminal y no se vuelve atrás — regla del
     propio cliente, "esa vez se cerró como rechazado y tengo que reingresar el
     vehículo". */
  const bpt = document.getElementById('presu-pt');
  if (bpt) bpt.addEventListener('click', () => {
    const o = Modelo.otPorId(p.otId);
    if (!o) return;
    const motivo = prompt('Declarar la OT ' + o.numeroOT + ' (' + o.patente + ') como PÉRDIDA TOTAL. ' +
      'Esto CIERRA la orden y no se puede deshacer. Escribe el fundamento:');
    if (motivo === null) return;
    ejecutar(() => Modelo.declarar_perdida_total(p.otId, motivo),
      'Declarada pérdida total. La orden quedó cerrada y el fundamento está en el expediente.',
      () => { p.otId = null; p.presupuestoId = null; render(); });
  });

  /* El tempario ya no se elige acá: es fijo y lo mueve administración en
     Configuración → Parámetros. Ver la nota en `grillaPresupuesto`. */

  /* ── Las horas de cada línea ──────────────────────────────────────────
     Se guardan al salir del campo, no en cada tecla: escribir «1,78» son
     cuatro pulsaciones y cuatro guardados serían cuatro hechos en el
     expediente para un solo dato. */
  document.querySelectorAll('[data-horas]').forEach((inp) => {
    inp.addEventListener('change', () => {
      const cambios = {};
      cambios[inp.dataset.campo] = inp.value;
      ejecutar(() => Modelo.actualizar_linea_presupuesto(inp.dataset.horas, cambios), null);
    });
  });

  /* ── Los campos de Repuestos y Externos ─────────────────────────────── */
  document.querySelectorAll('[data-rep]').forEach((inp) => {
    inp.addEventListener('change', () => {
      const cambios = {};
      cambios[inp.dataset.campo] = inp.value;
      ejecutar(() => Modelo.actualizar_linea_presupuesto(inp.dataset.rep, cambios),
        inp.dataset.campo === 'proveedor'
          // El proveedor es el que decide si se cobra: cuando cambia, vale la
          // pena decir en qué quedó, porque puede mover el total.
          ? () => (Reglas.esProveedorTaller(inp.value)
              ? 'Proveedor DYP: esta pieza se le cobra al cliente.'
              : (String(inp.value).trim()
                ? 'Proveedor ' + String(inp.value).trim() + ': la pone un tercero, no se cobra.'
                : 'Sin proveedor: no se cobra hasta que se diga quién la pone.'))
          : null);
    });
  });

  /* ── La observación ───────────────────────────────────────────────── */
  const obsGuardar = document.getElementById('presu-obs-guardar');
  if (obsGuardar) obsGuardar.addEventListener('click', () => {
    const pr = presuActual();
    const ta = document.getElementById('presu-obs');
    if (!pr || !ta) return;
    ejecutar(() => Modelo.fijar_observacion_presupuesto(pr.id, ta.value), 'Observación guardada.');
  });

  /* «Añadir fila» en Repuestos y en Externos. La fila entra EN BLANCO y se
     llena en la propia tabla, igual que en el sistema actual: pedir los datos
     en un formulario aparte obliga a saberlo todo antes de escribir nada. */
  document.querySelectorAll('[data-anadir]').forEach((b) => b.addEventListener('click', () => {
    const pr = presuActual();
    if (!pr) return;
    const bloque = b.dataset.anadir;
    ejecutar(() => Modelo.agregar_fila_presupuesto(pr.id, bloque),
      bloque === 'repuesto'
        ? 'Fila agregada. Al escribir la pieza queda pedida a bodega.'
        : 'Fila agregada. Escribe el trabajo, quién lo hace y cuánto cobra.');
  }));

  const agregar = document.getElementById('l-agregar');
  if (agregar) agregar.addEventListener('click', () => {
    const pr = presuActual();
    if (!pr) return;
    const v = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    /* La línea entra con la descripción y la operación, y nada más. Las horas
       —y el precio del repuesto o del trabajo externo— se escriben después en
       la propia fila, que es como se arma un presupuesto de verdad: primero
       se anota todo lo que hay que hacer mirando el auto, y después se le
       ponen los tiempos. */
    /* El desplegable parte en «Seleccione», igual que el original. Sin
       operación no se sabe a qué bloque va la línea, así que se avisa en vez
       de elegir una por el usuario: adivinar «Reparar» le mete horas a una
       pieza que quería cambiar, y eso se descubre cuando el presupuesto ya
       salió. El botón NO se deshabilita — se aprieta y la regla explica. */
    const op = v('l-op');
    if (!op) return avisar({ ok: false, motivo:
      'Falta la operación. Cambio compra la pieza, Reparar la arregla y Externo la manda a un tercero: ' +
      'el sistema no puede elegir por ti cuál de las tres es.' });
    p.linea.proceso = op;
    ejecutar(() => Modelo.agregar_linea_presupuesto(pr.id, {
      proceso: op, descripcion: v('l-desc')
    }), op === 'cambio'
      ? 'Línea agregada. Su repuesto quedó abajo: ponle el proveedor y el precio.'
      : (op === 'externo'
        ? 'Trabajo externo agregado. Ponle el proveedor y el precio abajo.'
        : 'Línea agregada. Ponle las horas en DM, Reparar o Pintar.'),
      () => { p.linea.descripcion = ''; });
  });

  document.querySelectorAll('[data-quitarlinea]').forEach((b) => b.addEventListener('click', () =>
    ejecutar(() => Modelo.quitar_linea_presupuesto(b.dataset.quitarlinea), 'Línea quitada.')));

  document.querySelectorAll('[data-pendiente]').forEach((b) => b.addEventListener('click', () => {
    const [rot, tanda, nota] = b.dataset.pendiente.split('|');
    avisar({ ok: false, motivo: '"' + rot + '" se construye en la tanda ' + tanda +
      (nota ? ' (' + nota + ')' : '') + '.' });
  }));
}
