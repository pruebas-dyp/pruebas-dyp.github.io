/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   NUEVO INGRESO — la pantalla más rica del sistema.

   Es la única que NO se puede probar en el sistema actual sin meter
   un vehículo real al taller, así que acá vale doble.

   🔶 REDISEÑO DEL 15-08-2026, pedido por el cliente después de ver el sistema
   real funcionando. Lo que cambió respecto de la tanda 1:

     · CINCO pasos, no seis, y en otro orden: primero el cliente, después el
       vehículo. Se recibe a una persona, no a una patente.
     · `Inventario` y `Fotografías` dejaron de ser pasos propios: los dos son
       el estado del vehículo al entrar, y viven dentro de `Estado descriptivo`.
     · Un paso nuevo al final, `Verificar Orden`: todo lo cargado de solo
       lectura antes de crear nada.
     · **No se avanza con el paso incompleto**, y sí se retrocede siempre.
     · El inventario dejó de ser un sí/no: son cuatro estados.

   Lo que se replica tal cual del original (`?ver=ingreso`):
     · El formulario POR PASOS, con Anterior y Siguiente.
     · Los 28 ítems del checklist, con su campo de observación por ítem.
     · El combustible en NUEVE posiciones (0/8 a 8/8), no ocho.
     · El marcador `Seleccione Estado` arriba del desplegable de estados.
     · 🔴 Y lo que nuestro diseño no tenía: los campos de la solicitud son
       ARREGLOS con botón `+`. **Una recepción puede generar varias órdenes**,
       cada una con su siniestro, su compañía y su deducible.

   Lo que se corrige:
     · Marca, modelo, color, compañía, prioridad y estado salen del CATÁLOGO,
       no de listas escritas en el HTML. Modelo depende de marca, y los tres
       primeros se ESCRIBEN: la lista se achica sola y, si el valor no está,
       se agrega al catálogo sin salir de la recepción.
     · La silueta es una sola vista, la superior. Antes ofrecía cinco pestañas
       y las cinco dibujaban lo mismo.
     · Sin firma en pantalla: el comprobante se firma en papel.
     · Las fotos se comprimen antes de guardar y el peso se muestra en
       pantalla — ver media.js.
     · El borrador se guarda solo. Un formulario de 90 campos que se pierde
       al recargar es una forma de perder el trabajo de la recepcionista.

   ⚠️ NINGUNA REGLA SE APLICA DESHABILITANDO UN BOTÓN. `Siguiente` se puede
      apretar siempre, en cualquier paso y con el formulario vacío: lo que hace
      es quedarse donde está, decir cuántos campos faltan y cuáles son con su
      nombre en palabras, marcarlos en rojo y poner el cursor en el primero. Un
      botón gris no enseña nada; un rechazo con el motivo, sí.
   ──────────────────────────────────────────────────────────────────────── */

const RECEPCION_PASOS = [
  { id: 'cliente',   n: 'Datos del cliente' },
  { id: 'vehiculo',  n: 'Datos del vehículo' },
  { id: 'ordenes',   n: 'Solicitud de reparación' },
  { id: 'danos',     n: 'Estado descriptivo' },
  { id: 'verificar', n: 'Verificar Orden' }
];

const CLAVE_BORRADOR = 'dyp-recepcion-borrador';

/* ── El menú del recepcionista ─────────────────────────────────────────
   🟰 SE COPIA DEL ORIGINAL (`miembros.php?ver=recepcionista`). Apretar
   `Recepción` no abre un formulario: abre estas cuatro opciones, con su icono
   redondo y su rótulo. El recepcionista ya tiene el gesto internalizado y no
   hay ninguna razón para cambiárselo.

   Los cuatro llevan a algo que existe. `Editar Recepción` es el único que no
   está construido del todo —editar una recepción ya guardada exige política de
   versiones, y esa decisión es del taller— así que lleva a lo que HOY sí se
   puede hacer y dice con todas las letras qué falta. No se dibuja un botón que
   no haga nada, pero tampoco se esconde una opción que el original tiene. */
const RECEPCION_OPCIONES = [
  { id: 'nuevo',    icono: 'recepcion', rot: 'Nuevo Ingreso',   permiso: 'ot.crear',
    desc: 'Recibir un vehículo: cliente, vehículo, solicitud, estado y verificación' },
  { id: 'entregar', icono: 'check',     rot: 'Entregar Unidad', permiso: 'entrega.registrar',
    desc: 'Buscar por patente y cerrar el ciclo' },
  { id: 'editar',   icono: 'documento', rot: 'Editar Recepción', permiso: 'ot.editar',
    desc: 'Abrir una recepción ya hecha' },
  { id: 'or',       icono: 'nuevo',     rot: 'Agregar OR',      permiso: 'presupuesto.abrir',
    desc: 'Abrir una orden de reparación sobre un vehículo en taller' }
];

/* El VIN de un vehículo tiene DIECISIETE caracteres. No es una convención
   nuestra: es la norma ISO 3779 y la usa todo el mundo. Un VIN de 16 o de 18
   es un error de tipeo, y encontrarlo al recibir el auto cuesta cero — dos
   meses después, cuando la compañía rechaza el siniestro porque el chasis no
   calza, cuesta el trabajo entero. */
const VIN_LARGO = 17;

/* La patente chilena tiene SEIS caracteres, en los dos formatos vigentes:
   `LLLL·NN` (cuatro letras y dos dígitos, desde 2007) y el antiguo `LL·NNNN`.
   El guión o el punto que a veces se escriben son decoración: no son parte de
   la patente, y si se guardan, la misma patente entra dos veces —`AABB11` y
   `AA-BB-11`— y el buscador de Entrega no la encuentra.

   Por eso el campo se normaliza MIENTRAS SE ESCRIBE y no al guardar: lo que se
   ve en pantalla es exactamente lo que va a quedar guardado. */
const PATENTE_LARGO = 6;
const normalizarPatente = (t) =>
  String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, PATENTE_LARGO);

/* 🔴 EL VIN SE CORTA EN CÓDIGO, NO SOLO CON `maxlength` (15-08-2026).

   `maxlength` es del navegador y solo vale para lo que TECLEA una persona. Un
   valor que se le pone al campo por código —que es como se repinta el
   formulario cada vez— pasa entero, sin que el navegador diga nada.

   Y el formulario se guarda solo en `localStorage`: un VIN de 29 caracteres
   escrito antes de que existiera el tope quedó guardado, y volvía a pintarse
   completo en cada recarga. El campo se veía sin límite aunque el límite
   estuviera puesto. Por eso el corte tiene que estar acá, en el dato, y no
   apoyarse en el atributo. */
const normalizarVin = (t) =>
  String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, VIN_LARGO);

/* ── Estado del formulario ─────────────────────────────────────────────── */

/* El bloque nace SIN tipo de ingreso y SIN estado, a propósito. El paso 3
   muestra únicamente `Tipo de ingreso` hasta que se elige uno: los campos de
   una orden de compañía no tienen nada que hacer en pantalla mientras nadie
   dijo que sea de compañía. */
function bloqueVacio() {
  return { tipo_ingreso_id: '', compania_id: '', siniestro: '', deducible: '',
           liquidador: '', numero_or: '', prioridad_id: 'pri-1', estado: '',
           descripcion_danos: '', descripcion_estado: '', responsable_id: '' };
}

function rec() {
  if (!ui.recepcion || !ui.recepcion.bloques) {
    ui.recepcion = restaurarBorrador() || {
      paso: 'cliente',
      // La llave de idempotencia nace con el formulario: si el usuario aprieta
      // Guardar dos veces, la segunda devuelve lo mismo que la primera.
      llave: 'rec-' + Date.now().toString(36),
      campos: { patente: '', marca_id: '', modelo_id: '', color_id: '', anio: '', vin: '', km: '',
                combustible: '4', rut: '', nombre: '', telefono: '',
                correo: '', direccion: '', observaciones: '' },
      // Lo que se escribió en cada combo. Se guarda aparte del id porque
      // mientras se teclea todavía no calza con ninguna fila del catálogo.
      textos: {},
      bloques: [bloqueVacio()],
      danos: [],
      // item_id → 'presente' | 'no_presente' | 'danado' | 'sin_verificar'.
      // Lo que no está en el mapa es `sin_verificar`: nadie lo miró todavía.
      inventario: {},
      // item_id → la nota del recepcionista. Solo se pide en los ítems que
      // quedaron `no presente` o `dañado`, que son los que después se discuten.
      obsInventario: {},
      // La firma del cliente: el PNG para guardar y los trazos para repintar.
      firma: null, firmaTrazos: [],
      fotos: []
    };
  }
  // Los campos marcados en rojo por el último rechazo. Vive fuera del
  // borrador: es el resultado de apretar un botón, no un dato del ingreso.
  if (!ui.recepcion.marcados) ui.recepcion.marcados = [];
  /* En qué pantalla del módulo estamos: el menú de cuatro opciones, el
     formulario, o el buscador de `Editar Recepción`. Tampoco va al borrador —
     entrar a Recepción siempre muestra el menú, como en el original, aunque
     haya un ingreso a medio llenar. Que el borrador siga ahí se avisa en la
     propia opción. */
  if (!ui.recepcion.pantalla) ui.recepcion.pantalla = 'menu';
  if (!ui.recepcion.buscaEditar) ui.recepcion.buscaEditar = '';
  return ui.recepcion;
}

/* El borrador se persiste sin las fotos crudas: de esas solo va la ficha, y
   los bytes ya están en IndexedDB. Por eso sobrevive a F5. */
function guardarBorrador() {
  try {
    const r = rec();
    localStorage.setItem(CLAVE_BORRADOR, JSON.stringify({
      paso: r.paso, llave: r.llave, campos: r.campos, bloques: r.bloques,
      danos: r.danos, textos: r.textos,
      inventario: r.inventario, obsInventario: r.obsInventario,
      fotos: r.fotos,
      // El Blob de la firma no es serializable; los trazos sí, y con ellos
      // se vuelve a pintar el lienzo tal cual estaba.
      firmaTrazos: r.firmaTrazos || []
    }));
  } catch (e) { /* sin almacenamiento: el formulario sigue vivo en memoria */ }
}

function restaurarBorrador() {
  try {
    const crudo = localStorage.getItem(CLAVE_BORRADOR);
    if (!crudo) return null;
    const d = JSON.parse(crudo);
    if (!d || !d.bloques) return null;

    /* 🔴 LO GUARDADO SE SANEA AL ENTRAR, y no se le cree nada.

       El borrador vive en el navegador del recepcionista y **sobrevive a las
       publicaciones**: puede venir de una versión anterior del formulario, con
       campos que ya no existen, sin campos que hoy sí, o con valores más
       largos de los que ahora se admiten. Si se usa tal cual, un borrador
       viejo deja la pantalla en blanco o muestra un dato que el formulario ya
       no acepta — y el recepcionista no tiene forma de saber por qué.

       Se rellenan las piezas que falten y se cortan la patente y el VIN. Con
       el auto en el mesón, un formulario a medio restaurar es mejor que una
       pantalla rota. */
    d.campos = Object.assign({}, d.campos);
    d.campos.patente = normalizarPatente(d.campos.patente);
    d.campos.vin = normalizarVin(d.campos.vin);

    return Object.assign({
      paso: 'cliente', llave: 'rec-' + Date.now().toString(36),
      textos: {}, danos: [], inventario: {}, obsInventario: {}, fotos: [],
      firmaTrazos: [], marcados: [], firma: null
    }, d);
  } catch (e) { return null; }
}

function limpiarBorrador() {
  try { localStorage.removeItem(CLAVE_BORRADOR); } catch (e) { /* nada */ }
  ui.recepcion = null;
  rec();
}

/* ── Validación ────────────────────────────────────────────────────────── */

/* Los obligatorios son los que el original marca con asterisco.

   🔴 EL VIN, y por qué es un caso aparte. El 13-08-2026 lo sacamos de los
   obligatorios con este argumento: en el taller no siempre se tiene a mano al
   recibir el vehículo, y un campo obligatorio que no se puede llenar termina
   rellenándose con cualquier cosa —que es peor que dejarlo vacío—.

   El 15-08-2026 el cliente pidió que fuera obligatorio. Manda él, así que lo
   es. Pero se construyó con la salida que evita el problema que nos
   preocupaba: obligatorio **con una casilla "no viene a la vista"** que exige
   escribir el motivo y deja la orden marcada como incompleta hasta que alguien
   lo cargue. Así el dato no se rellena con basura y el sistema igual no deja
   pasar una recepción sin VIN de verdad. Las dos cosas, no una.

   Y encima va el largo: si se escribe un VIN, tiene que tener sus 17
   caracteres. Las dos reglas se acumulan — obligatorio, y bien escrito.

   El kilometraje quedó en `danos` y no en `vehiculo`: se lee del tablero al
   recibir el auto, junto con el combustible, y los dos son el estado del
   vehículo al entrar. */
const REC_OBLIGATORIOS = [
  ['rut',       'El RUT del cliente',    'cliente'],
  ['nombre',    'El nombre del cliente', 'cliente'],
  ['telefono',  'El teléfono',           'cliente'],
  ['direccion', 'La dirección',          'cliente'],
  ['patente',   'La patente',            'vehiculo'],
  ['vin',       'El VIN',                'vehiculo'],
  ['km',        'El kilometraje',        'danos']
];

/* ⚠️ CUÁLES DE LOS CAMPOS POR TIPO DE INGRESO SON OBLIGATORIOS DE VERDAD es la
   pregunta abierta 1 del rediseño. Lo que está exigido acá es la propuesta a
   validar con el cliente, y es la que ya sostiene el modelo:

     · Compañía  → la compañía y el N° de siniestro. Una orden de compañía sin
                   siniestro no se puede cobrar.
     · Empresa   → el N° de OR.
     · El resto  → opcional. Deducible, liquidador, prioridad, estado y las dos
                   descripciones se completan igual, pero no traban el ingreso
                   del vehículo, que es lo urgente.

   Si el taller dice que alguno más es obligatorio, se agrega en esta función y
   en ninguna otra parte. */
function recFaltantesBloque(b, i) {
  const faltan = [];
  const n = ' de la orden ' + (i + 1);
  const marca = (campo) => 'blq:' + i + ':' + campo;

  if (!b.tipo_ingreso_id)
    return [{ rot: 'El tipo de ingreso' + n, paso: 'ordenes', campo: marca('tipo_ingreso_id') }];

  const t = Modelo.catalogo('tipo_ingreso').find((x) => x.id === b.tipo_ingreso_id) || {};
  if (t.exige_compania && !b.compania_id)
    faltan.push({ rot: 'La compañía' + n, paso: 'ordenes', campo: marca('compania_id') });
  if (t.exige_compania && !String(b.siniestro || '').trim())
    faltan.push({ rot: 'El N° de siniestro' + n, paso: 'ordenes', campo: marca('siniestro') });
  if (t.exige_or && !String(b.numero_or || '').trim())
    faltan.push({ rot: 'El N° de OR' + n, paso: 'ordenes', campo: marca('numero_or') });
  return faltan;
}

function recFaltantes() {
  const r = rec();

  /* 🔷 SIN SALIDA DECLARADA PARA EL VIN (16-08-2026, Marco: "sacar el no viene
     a la vista"). Había una casilla que permitía cerrar la recepción sin el
     VIN escribiendo un motivo, y la orden quedaba marcada como incompleta.
     Ya no: el VIN es obligatorio y son los 17 caracteres, como cualquier otro
     campo con asterisco. */
  const faltan = REC_OBLIGATORIOS
    .filter(([c]) => !String(r.campos[c] || '').trim())
    .map(([c, rot, paso]) => ({ campo: c, rot, paso }));

  // Y si se escribió un VIN, tiene que estar completo. Se mide lo saneado: es
  // lo que el campo muestra y lo que se va a guardar.
  const vin = normalizarVin(r.campos.vin);
  if (vin && vin.length !== VIN_LARGO) {
    faltan.push({
      paso: 'vehiculo', campo: 'vin',
      rot: 'El VIN, que tiene ' + vin.length + ' caracteres y son ' + VIN_LARGO
    });
  }

  /* Y la patente, igual: seis caracteres o no es una patente. El campo ya no
     deja escribir más de seis, así que lo único que puede pasar acá es que
     falten — pero se valida igual, porque un borrador viejo o una recepción
     restaurada pueden traer cualquier cosa. */
  const patente = normalizarPatente(r.campos.patente);
  if (patente && patente.length !== PATENTE_LARGO) {
    faltan.push({
      paso: 'vehiculo', campo: 'patente',
      rot: 'La patente, que tiene ' + patente.length + ' caracteres y son ' + PATENTE_LARGO
    });
  }

  r.bloques.forEach((b, i) => faltan.push.apply(faltan, recFaltantesBloque(b, i)));
  return faltan;
}

const recFaltantesDe = (paso) => recFaltantes().filter((f) => f.paso === paso);
const recIndicePaso = () => RECEPCION_PASOS.findIndex((p) => p.id === rec().paso);

/* Un paso está completo cuando no le falta nada suyo. `verificar` no exige
   nada propio: es el resumen de los cuatro anteriores. */
const recPasoCompleto = (paso) => recFaltantesDe(paso).length === 0;

/* A qué paso se puede saltar desde las pastillas numeradas: al actual, a
   cualquiera anterior —volver atrás no valida nada— y hacia adelante solo si
   todo lo que quedó atrás está completo. */
function recAlcanzable(j) {
  if (j <= recIndicePaso()) return true;
  return RECEPCION_PASOS.slice(0, j).every((p) => recPasoCompleto(p.id));
}

/* El rechazo. Se queda donde está, dice cuántos faltan y cuáles son, los marca
   y lleva el cursor al primero. Nunca deshabilita nada. */
function recRechazar(faltan) {
  const r = rec();
  r.marcados = faltan.map((f) => f.campo);
  render();
  recEnfocar(faltan[0].campo);
  const lista = faltan.map((f) => f.rot);
  avisar({ ok: false, motivo:
    (faltan.length === 1
      ? 'Falta un campo obligatorio: '
      : 'Faltan ' + faltan.length + ' campos obligatorios: ') +
    lista.slice(0, 6).join(', ') + (lista.length > 6 ? ', y ' + (lista.length - 6) + ' más' : '') + '.' });
}

/* Redibujar la pantalla mata el foco. Se devuelve al campo que corresponda:
   puede ser un campo simple, un combo del catálogo o un campo de un bloque de
   orden, y los tres se buscan distinto. */
function recEnfocar(clave, posicion) {
  let el = null;
  if (String(clave).indexOf('blq:') === 0) {
    const [, i, campo] = String(clave).split(':');
    el = document.querySelector('[data-blq="' + i + '"][data-campo="' + campo + '"]');
  } else {
    el = document.querySelector('[data-rec="' + clave + '"]') ||
         document.querySelector('[data-combo="' + clave + '"]');
  }
  if (!el || el.disabled) return;
  el.focus();
  if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center' });
  const p = posicion === undefined ? String(el.value || '').length : posicion;
  try { el.setSelectionRange(p, p); } catch (e) { /* algunos tipos no lo permiten */ }
}

const recMarcado = (clave) => rec().marcados.indexOf(clave) >= 0;

/* ── La vista ──────────────────────────────────────────────────────────── */

/* El menú de cuatro opciones, copiado del original. Cada tarjeta es un botón
   grande: es una pantalla que se usa de pie, en el mesón, muchas veces al día. */
function vRecepcionMenu() {
  /* ⛔ ACÁ IBA EL CARTEL «hay un borrador a medio llenar», y se sacó el
     15-08-2026 junto con la razón de que existiera: ahora **salir del proceso
     descarta lo llenado a medias**, así que no hay nada que anunciar.

     El cartel no decía de qué auto era el ingreso a medias, y sin eso no se
     puede decidir si retomarlo o tirarlo: había que entrar a mirar. Avisaba de
     un problema en vez de resolverlo. */
  const tarjeta = (o) => {
    const puede = Modelo.puede(o.permiso);
    /* La opción que el rol no puede usar NO se esconde ni se apaga: se aprieta
       igual y dice quién sí puede. Esconderla dejaría al recepcionista con un
       menú distinto al que conoce, y apagarla no enseña nada. */
    return '<button class="opcion-rec' + (puede ? '' : ' ajena') + '" data-opcion="' + o.id + '">' +
      '<span class="circulo">' + ico(o.icono, 'g') + '</span>' +
      '<span class="rot">' + esc(o.rot) + '</span>' +
      '<span class="desc">' + esc(o.desc) + '</span>' +
      (puede ? '' : '<span class="et gris">no es de este perfil</span>') +
      '</button>';
  };

  return `
  <div class="panel">
    <div class="cab"><div><h2>${ico('recepcion', 'g')}Seleccione una opción</h2>
      <div class="desc">Las cuatro del sistema actual, con sus mismos nombres</div></div></div>
    <div class="cuerpo">
      <div class="opciones-rec">${RECEPCION_OPCIONES.map(tarjeta).join('')}</div>
    </div>
  </div>`;
}

/* Las dos opciones que trabajan sobre una orden YA EXISTENTE comparten el mismo
   buscador por patente que usa Entrega, porque es el gesto que el taller tiene
   internalizado: el vehículo está ahí y lo que se sabe es la patente.

   `Editar Recepción` abre la ficha, que es donde hoy se cambia lo que se puede
   cambiar. ⚠️ Editar los DATOS de una recepción ya guardada —cliente, vehículo,
   checklist, daños— no está construido, y no por falta de tiempo: una recepción
   es lo que el cliente firmó. Cambiarla después obliga a decidir si se versiona,
   quién puede y qué pasa con el comprobante ya impreso. Es del taller decidirlo.

   `Agregar OR` abre la orden de reparación ahí mismo. 🔴 Y ésta es la única
   puerta que tiene el recepcionista para hacerlo: el cliente dijo «el
   recepcionista es quien crea la OR, siempre», el motor se lo permite
   —`crear_presupuesto` pide `presupuesto.abrir`— pero el MÓDULO Presupuesto
   pide `presupuesto.crear`, que es del evaluador. Abrir la OR y valorizarla son
   dos actos distintos, y esto construye el primero sin darle el segundo. */
const REC_BUSCADOR = {
  editar: { icono: 'documento', rot: 'Editar Recepción', accion: 'Corregir la recepción',
            desc: 'Busca por patente, igual que Entrega' },
  or:     { icono: 'nuevo',     rot: 'Agregar OR',       accion: 'Abrir OR',
            desc: 'Sobre qué vehículo se abre la orden de reparación' }
};

function vRecepcionBuscar(modo) {
  const r = rec();
  const cfg = REC_BUSCADOR[modo];
  const q = String(r.buscaEditar || '').trim().toUpperCase();
  const encontradas = q ? Modelo.torre().filter((o) => o.patente.indexOf(q) >= 0) : [];

  /* 🔶 El volver va ARRIBA y AFUERA del panel (15-08-2026, pedido de Marco:
     "más fácil y más claro"). Estaba como botón chico y gris en la esquina
     derecha del encabezado, que es donde nadie mira para retroceder: la
     lectura va de izquierda a derecha y el paso atrás se busca al principio.
     Ahora es lo primero de la pantalla, con flecha y con el nombre de a dónde
     vuelve — "Volver" a secas obliga a acordarse de dónde venías. */
  return `
  <button class="btn volver" id="rec-volver"><span class="flecha-atras">&#8592;</span>
    Volver a las opciones de Recepción</button>
  <div class="panel">
    <div class="cab"><div><h2>${ico(cfg.icono, 'g')}${esc(cfg.rot)}</h2>
      <div class="desc">${esc(cfg.desc)}</div></div>
    </div>
    <div class="cuerpo">
      <div class="rejilla-campos">
        <div class="campo"><label>Patente</label>
          <input id="rec-buscar-patente" value="${esc(r.buscaEditar)}" placeholder="AABB11"
            autocomplete="off"></div>
      </div>

      ${q ? (encontradas.length ? `
      <div class="grid-envoltorio" style="margin-top:11px"><table class="grid">
        <thead><tr><th>OT</th><th>Patente</th><th>Cliente</th><th>Fecha de Ingreso</th><th>Estado</th>
          ${modo === 'or' ? '<th>OR abiertas</th>' : ''}<th></th></tr></thead>
        <tbody>${encontradas.map((o) => '<tr><td class="num">' + o.numeroOT + '</td>' +
          '<td><span class="patente">' + esc(o.patente) + '</span></td>' +
          '<td>' + esc(o.cliente) + '</td>' +
          '<td class="num">' + fFechaHora(o.fechaIngreso) + '</td>' +
          '<td><span class="et ' + o.estadoClase + '">' + esc(o.estadoNombre) + '</span></td>' +
          (modo === 'or'
            ? '<td>' + (o.presupuestos.length
                ? o.presupuestos.map((p) => '<span class="cod">' + esc(p.numeroOR) + '</span>').join(' ')
                : '<span class="et gris">ninguna</span>') + '</td>'
            : '') +
          '<td><button class="btn secundario" data-' +
            (modo === 'or' ? 'abrir-or' : 'editar-rec') + '="' + o.numeroOT + '">' +
            esc(cfg.accion) + '</button></td></tr>').join('')}
        </tbody>
      </table></div>` : `
      <div class="nota" style="margin-top:11px">Ninguna orden abierta con esa patente.
        Si el vehículo ya se entregó, está en el Histórico.</div>`) : ''}

      ${modo === 'editar' ? `
      <div class="nota info" style="margin-top:12px">${ico('info')}
        <strong>La recepción se corrige versionándola.</strong> Se cambia el cliente, el vehículo,
        los datos de la recepción, el checklist y <strong>los daños de la silueta</strong>; lo que
        estaba queda guardado con quién lo cambió, cuándo y por qué, y el comprobante impreso dice
        qué versión es. El papel que firmó el cliente no se toca. <strong>La firma no se vuelve a
        pedir</strong>: si cada corrección se firma de nuevo o el original sigue valiendo lo decide
        el taller.
      </div>` : `
      <div class="nota info" style="margin-top:12px">${ico('info')}
        <strong>Abrir la OR no es valorizarla.</strong> Acá se abre la orden de reparación sobre el
        vehículo —que es lo que hace el recepcionista— y queda en cero, esperando que el evaluador
        le ponga las líneas y los montos. Una OT puede tener <strong>varias OR</strong>.
      </div>`}
    </div>
  </div>`;
}

function vRecepcion() {
  const r = rec();
  if (r.pantalla === 'menu') return vRecepcionMenu();
  if (r.pantalla === 'editar' || r.pantalla === 'or') return vRecepcionBuscar(r.pantalla);
  // La corrección de una recepción ya guardada vive en `recepcion-editar.js`.
  if (r.pantalla === 'editar-ficha') return vRecepcionEditarFicha();

  /* El borrador se restaura de `localStorage`, y de ahí puede volver con un
     paso que ya no existe —una versión anterior del formulario, o el archivo
     tocado a mano—. Antes eso reventaba la pantalla entera y dejaba Recepción
     inservible hasta borrar los datos del navegador. Ahora vuelve al primero:
     el formulario está completo igual, solo cambia dónde se para. */
  if (!RECEPCION_PASOS.some((p) => p.id === r.paso)) r.paso = RECEPCION_PASOS[0].id;

  const i = recIndicePaso();
  const ultimo = i >= RECEPCION_PASOS.length - 1;
  const cuerpo = {
    cliente: recCliente, vehiculo: recVehiculo, ordenes: recOrdenes,
    danos: recDanos, verificar: recVerificar
  }[r.paso]();

  return `
  <div class="panel">
    <div class="cab">
      <div><h2>${ico('recepcion', 'g')}Nuevo ingreso</h2>
        <div class="desc">Cinco pasos. No se avanza con el paso incompleto; volver atrás se puede
          siempre. El borrador se guarda solo.
          <button class="enlace-volver" id="rec-volver">← Volver a las opciones</button></div></div>
      <div class="chips">
        ${RECEPCION_PASOS.map((p, k) => '<button class="chip' +
          (p.id === r.paso ? ' activo' : (recAlcanzable(k) ? '' : ' pendiente')) +
          '" data-paso="' + p.id + '">' + (k + 1) + ' · ' + esc(p.n) + '</button>').join('')}
      </div>
    </div>
    <div class="cuerpo">${cuerpo}</div>
  </div>

  ${/* La barra de abajo son los botones y nada más.

       Acá vivía un aviso permanente —"Faltan 4 en este paso: el RUT, el
       nombre…"— y se sacó el 15-08-2026: estaba retando antes de que nadie
       hiciera nada. El formulario recién abierto está vacío por definición, así
       que el aviso salía siempre y en rojo, y lo que se lee todo el tiempo se
       deja de leer.

       Lo que falta se dice cuando se aprieta `Siguiente`, que es cuando la
       persona declaró que terminó: ahí el rechazo nombra los campos, los marca
       y pone el cursor en el primero. Es la misma regla de la casa que impide
       apagar el botón — se avisa al intentar, no antes. */''}
  <div class="panel">
    <div class="cuerpo" style="display:flex;gap:10px;justify-content:flex-end;align-items:center;flex-wrap:wrap">
      <span style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn secundario" id="rec-limpiar">Descartar borrador</button>
        <button class="btn secundario" id="rec-ant" ${i <= 0 ? 'disabled' : ''}>Anterior</button>
        ${ultimo
          /* En el último paso `Siguiente` NO se dibuja gris: deja de existir, y
             en su lugar están los dos botones que cierran el ingreso. */
          ? '<button class="btn secundario" id="rec-pdf">Guardar PDF</button>' +
            '<button class="btn" id="rec-guardar">Ingresar recepción</button>'
          : '<button class="btn" id="rec-sig">Siguiente</button>'}
      </span>
    </div>
  </div>`;
}

/* ── El RUT se puntea solo ─────────────────────────────────────────────
   Se escribe `204296731` y queda `20.429.673-1`. Nadie teclea los puntos ni el
   guión, y sin esto el padrón termina con el mismo RUT escrito de cuatro formas
   —con puntos, sin puntos, con guión, sin guión— que es exactamente el
   problema que le auditamos al sistema actual con las compañías: cuatro
   escrituras de CARDIF para una sola aseguradora. Un dato que se busca tiene
   que estar guardado de una sola manera.

   El dígito verificador es el último carácter y puede ser una K. NO se valida
   que sea el correcto: eso es una regla aparte y hay que confirmarla con el
   taller antes de rechazar el RUT de un cliente que está parado en el mesón. */
function formatearRut(texto) {
  const limpio = String(texto || '').toUpperCase().replace(/[^0-9K]/g, '');
  if (!limpio) return '';

  /* Cuándo aparece el guión. El cuerpo de un RUT chileno tiene 7 u 8 dígitos,
     así que hasta el séptimo carácter todavía se está escribiendo el cuerpo y
     el guión no corresponde: sin esto, teclear `204296731` mostraba `2-0`,
     `20-4`, `204-2`… y el campo parecía roto mientras se escribía.

     Con una K la cosa es distinta: la K solo puede ser dígito verificador, así
     que apenas aparece se separa, sin importar el largo. */
  const conK = limpio.slice(-1) === 'K';
  const puntear = (n) => n.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  if (!conK && limpio.length <= 7) return puntear(limpio);

  const cuerpo = limpio.slice(0, -1).replace(/\D/g, '');
  const dv = limpio.slice(-1);
  return cuerpo ? puntear(cuerpo) + '-' + dv : dv;
}

/* Reescribe un campo MIENTRAS SE ESCRIBE y le devuelve el cursor a su lugar.
   Al asignar `value` el navegador manda el cursor al final: si alguien corrige
   un carácter del medio, le salta y termina escribiendo al revés. Se cuenta
   cuántos caracteres que CUENTAN quedaban a la izquierda —los puntos y el
   guión del RUT no cuentan, se ponen solos— y se lo deja después del mismo.

   Lo usan el RUT y la patente, que son los dos campos que se escriben de una
   forma y se guardan de otra. */
function reescribir(el, formatear, significativo) {
  const antes = String(el.value).slice(0, el.selectionStart || 0)
    .split('').filter((ch) => significativo.test(ch)).length;
  const nuevo = formatear(el.value);
  if (nuevo === el.value) return;
  el.value = nuevo;

  let pos = 0, vistos = 0;
  while (pos < nuevo.length && vistos < antes) {
    if (significativo.test(nuevo[pos])) vistos++;
    pos++;
  }
  try { el.setSelectionRange(pos, pos); } catch (e) { /* el campo no lo permite */ }
}

/* Campo de texto amarrado a `campos`. */
function recCampo(clave, rotulo, opciones) {
  const o = opciones || {};
  const r = rec();
  /* Se pinta el valor SANEADO, no el crudo. Si lo guardado quedó fuera de
     norma —un borrador de una versión anterior—, el campo tiene que mostrar lo
     que hoy se admite; si no, se ve un dato que el formulario ya no acepta. */
  const crudo = r.campos[clave] == null ? '' : r.campos[clave];
  const v = o.normalizar ? o.normalizar(crudo) : crudo;
  const obliga = REC_OBLIGATORIOS.some(([c]) => c === clave);
  return '<div class="campo' + (recMarcado(clave) ? ' falta' : '') + '"><label>' + esc(rotulo) +
    (obliga ? ' <span style="color:var(--rojo)">*</span>' : '') + '</label>' +
    '<input type="' + (o.tipo || 'text') + '" data-rec="' + clave + '" value="' + esc(v) + '"' +
    (o.largo ? ' maxlength="' + o.largo + '"' : '') +
    (o.marcador ? ' placeholder="' + esc(o.marcador) + '"' : '') + '>' +
    (o.ayuda ? '<span class="ayuda" data-ayuda="' + clave + '">' + esc(o.ayuda) + '</span>' : '') + '</div>';
}

function recSelect(clave, rotulo, filas, opciones) {
  const o = opciones || {};
  const v = rec().campos[clave];
  return '<div class="campo' + (recMarcado(clave) ? ' falta' : '') + '"><label>' + esc(rotulo) + '</label>' +
    '<select data-rec="' + clave + '">' +
    (o.vacio ? '<option value="">' + esc(o.vacio) + '</option>' : '') +
    filas.map((f) => '<option value="' + esc(f.id) + '"' + (String(v) === String(f.id) ? ' selected' : '') +
      '>' + esc(f.nombre) + '</option>').join('') + '</select>' +
    (o.ayuda ? '<span class="ayuda">' + esc(o.ayuda) + '</span>' : '') + '</div>';
}

/* Campo de catálogo que se ESCRIBE, no se elige de una lista larga.
   Marca tiene 73 valores y color 169: buscarlos con el mouse es más lento que
   teclear tres letras. Se escribe, la lista se va achicando sola, y si el
   valor no existe aparece el botón para agregarlo al catálogo sin salir de la
   recepción. El id se resuelve por nombre; mientras no calce, queda vacío. */
function recCombo(clave, rotulo, filas, tabla, opciones) {
  const o = opciones || {};
  const r = rec();
  const sel = filas.find((f) => String(f.id) === String(r.campos[clave]));
  const escrito = r.textos[clave] != null ? r.textos[clave] : (sel ? sel.nombre : '');
  const limpio = String(escrito).trim();
  const calza = filas.find((f) => String(f.nombre).toLowerCase() === limpio.toLowerCase());
  const obliga = REC_OBLIGATORIOS.some(([c]) => c === clave);
  const lista = 'dl-' + clave;

  /* Crear un maestro desde acá exige el permiso de configuración, igual que
     hacerlo en la propia pantalla de Configuración: el motor lo revisa en
     `guardar_catalogo` y rechaza a quien no lo tenga.

     Pedido del cliente el 15-08-2026: que las marcas las cree sólo
     administración. El motor ya lo impedía, pero el botón se dibujaba igual y
     el recepcionista se topaba con un rechazo después de haber escrito. Ahora
     no se ofrece lo que no se puede hacer, y se dice quién sí puede. */
  const puedeCrear = Modelo.puede('configuracion');
  const fueraDelCatalogo = !o.apagado && limpio && !calza;

  let pie;
  if (fueraDelCatalogo && puedeCrear) {
    pie = '<button class="btn secundario" style="margin-top:5px" data-combo-crear="' + clave +
      '" data-tabla="' + esc(tabla) + '">Agregar «' + esc(limpio) + '» al catálogo</button>';
  } else if (fueraDelCatalogo) {
    pie = '<span class="ayuda" style="color:var(--ambar)">«' + esc(limpio) +
      '» no está en el catálogo. Lo agrega administración.</span>';
  } else {
    pie = '<span class="ayuda">' +
      esc(o.ayuda || (calza ? '✓ ' + calza.nombre : 'Escribe y elige de la lista')) + '</span>';
  }

  /* La marca en rojo del último rechazo convive con lo de arriba: son dos cosas
     distintas. `fueraDelCatalogo` es que el valor escrito no existe en el
     maestro; la clase `falta` es que este campo es obligatorio y está vacío. */
  return '<div class="campo' + (recMarcado(clave) ? ' falta' : '') + '"><label>' + esc(rotulo) +
    (obliga ? ' <span style="color:var(--rojo)">*</span>' : '') + '</label>' +
    '<input type="text" autocomplete="off" list="' + lista + '" data-combo="' + clave +
      '" data-tabla="' + esc(tabla) + '" value="' + esc(escrito) + '"' +
      (o.marcador ? ' placeholder="' + esc(o.marcador) + '"' : '') +
      (o.apagado ? ' disabled' : '') + '>' +
    '<datalist id="' + lista + '">' +
      filas.map((f) => '<option value="' + esc(f.nombre) + '">').join('') + '</datalist>' +
    pie + '</div>';
}

/* ── Paso 1 · Cliente ──────────────────────────────────────────────────
   🔶 UN SOLO CAMPO DE NOMBRE (15-08-2026). Antes eran dos, `Nombre completo` y
   `Apellidos`, y ya el rótulo del primero decía que sobraba el segundo. El
   nombre del cliente llega de la cédula o de la póliza, de corrido; repartirlo
   a mano invita a que "de la Fuente" caiga en cualquiera de las dos casillas y
   después ningún listado ordene igual. El apellido separado se conserva donde
   sí es un dato propio: en la ficha del PERSONAL.

   Y se fue `Celular`. El taller llama a UN número. Dos casillas para lo mismo
   terminan con una vacía y la otra con el número que sí contesta — o peor, con
   dos números y nadie sabiendo cuál es el bueno. */
function recCliente() {
  return `
  <div class="rejilla-campos">
    ${recCampo('rut', 'RUT', { marcador: '11.111.111-1' })}
    ${recCampo('nombre', 'Nombre completo', { marcador: 'Nombre y apellidos' })}
    ${recCampo('telefono', 'Teléfono')}
    ${recCampo('correo', 'Correo')}
    ${recCampo('direccion', 'Dirección')}
  </div>
`;
}

/* ── Paso 2 · Vehículo ─────────────────────────────────────────────────
   El kilometraje y el combustible se fueron al paso 4: los dos se leen del
   tablero cuando ya se está mirando el auto, no cuando se anota la patente. */

// Cuántos caracteres le sobran o le faltan, dicho en castellano.
function recSobranFaltan(largo, esperado) {
  const meta = esperado || VIN_LARGO;
  const n = Math.abs(largo - meta);
  const verbo = largo < meta ? ['falta', 'faltan'] : ['sobra', 'sobran'];
  return (n === 1 ? verbo[0] : verbo[1]) + ' ' + n;
}

/* El contador de los dos campos de largo fijo. Se calcula acá y no dentro del
   render porque el campo NO se repinta al escribir —se perdería el cursor— y
   el contador tiene que moverse igual, tecla a tecla. */
function recAyudaLargo(clave) {
  const meta = clave === 'patente' ? PATENTE_LARGO : VIN_LARGO;
  // Se cuenta sobre el valor saneado, que es el que se está viendo en el campo.
  const v = clave === 'patente'
    ? normalizarPatente(rec().campos[clave])
    : normalizarVin(rec().campos[clave]);
  if (!v) {
    return clave === 'patente'
      ? 'Son ' + PATENTE_LARGO + ' caracteres, en mayúsculas y sin guión'
      : 'Obligatorio. Son ' + VIN_LARGO + ' caracteres, como vienen en el chasis';
  }
  if (v.length === meta) return '✓ ' + meta + ' de ' + meta + ' caracteres';
  return v.length + ' de ' + meta + ' caracteres: ' + recSobranFaltan(v.length, meta);
}

/* El VIN. Obligatorio, y son los 17 caracteres: obligatorio no alcanza si el
   dato queda mal copiado.

   🔷 SE SACÓ LA CASILLA «No viene a la vista» (16-08-2026, Marco). Dejaba
   cerrar la recepción sin el VIN escribiendo un motivo, y la orden quedaba
   marcada como incompleta arrastrando ese pendiente por todo el sistema —la
   ficha, el comprobante impreso—. Un campo con asterisco que se puede saltar
   es un campo que en la práctica no es obligatorio.

   🔶 `maxlength` de 17 (15-08-2026). El campo dejaba escribir de largo y recién
   en Verificar avisaba que sobraban caracteres: el aviso llegaba tarde y no
   decía dónde estaba el error. El tope lo hace imposible, y el contador de
   abajo va diciendo cuánto falta mientras se copia del chasis. */
function recVin() {
  const r = rec();
  return '<div class="campo' + (recMarcado('vin') ? ' falta' : '') + '">' +
    '<label>VIN (número de chasis) <span style="color:var(--rojo)">*</span></label>' +
    '<input type="text" autocomplete="off" data-rec="vin" value="' + esc(normalizarVin(r.campos.vin)) + '" ' +
    'maxlength="' + VIN_LARGO + '" placeholder="' + VIN_LARGO + ' caracteres">' +
    '<span class="ayuda" data-ayuda="vin">' + esc(recAyudaLargo('vin')) + '</span></div>';
}

function recVehiculo() {
  const r = rec();
  const marcas = Modelo.catalogo('marca');
  const modelos = Modelo.catalogo('modelo').filter((m) => m.marca_id === r.campos.marca_id);
  const anios = [];
  for (let a = 2027; a >= 1979; a--) anios.push({ id: a, nombre: String(a) });

  return `
  <div class="rejilla-campos">
    ${recCampo('patente', 'Patente', {
      marcador: 'AABB11', largo: PATENTE_LARGO, normalizar: normalizarPatente,
      ayuda: recAyudaLargo('patente') })}
    ${recCombo('marca_id', 'Marca', marcas, 'marca', { marcador: 'Escribe la marca' })}
    ${recCombo('modelo_id', 'Modelo', modelos, 'modelo', {
      marcador: r.campos.marca_id ? 'Escribe el modelo' : 'Primero la marca',
      apagado: !r.campos.marca_id,
      ayuda: r.campos.marca_id ? '' : 'Depende de la marca' })}
    ${recCombo('color_id', 'Color', Modelo.catalogo('color_vehiculo'), 'color_vehiculo', { marcador: 'Escribe el color' })}
    ${recSelect('anio', 'Año', anios, { vacio: 'Seleccionar' })}
    ${recVin()}
  </div>`;
}

/* ── Paso 3 · Solicitud de reparación · VARIAS ÓRDENES ─────────────────
   El paso arranca mostrando UN campo: el tipo de ingreso. Los demás aparecen
   cuando se elige uno, y son los de ese tipo. Un formulario que enseña ocho
   campos de compañía a quien viene por un particular no está siendo completo:
   está haciendo perder el tiempo. */

function recOrdenes() {
  const r = rec();
  const tipos = Modelo.catalogo('tipo_ingreso');
  const comps = Modelo.catalogo('compania').filter((c) => c.vigente !== false);
  const prios = Modelo.catalogo('prioridad');
  /* Los cuatro estados que el original ofrece en el ingreso son los que el
     catálogo marca alcanzables desde esta pantalla, con la redacción DEL
     MAESTRO. El formulario del sistema real escribe uno de ellos distinto
     —`Espera Repuestos` contra `Espera repuesto`—: es el defecto C-3 y no se
     replica. Una sola fuente por concepto. */
  const estados = Modelo.catalogo('estado').filter((e) => (e.alcanzable_en || []).indexOf('ingreso') >= 0);

  const campoBlq = (i, campo, rotulo, dentro, ayuda, obliga) =>
    '<div class="campo' + (recMarcado('blq:' + i + ':' + campo) ? ' falta' : '') + '"><label>' +
    esc(rotulo) + (obliga ? ' <span style="color:var(--rojo)">*</span>' : '') + '</label>' +
    dentro + (ayuda ? '<span class="ayuda">' + esc(ayuda) + '</span>' : '') + '</div>';

  const texto = (i, b, campo, rotulo, ayuda, obliga) =>
    campoBlq(i, campo, rotulo,
      '<input data-blq="' + i + '" data-campo="' + campo + '" value="' + esc(b[campo] || '') + '">',
      ayuda, obliga);

  const area = (i, b, campo, rotulo, ayuda) =>
    '<div class="campo" style="grid-column:1/-1"><label>' + esc(rotulo) + '</label>' +
    '<textarea rows="2" data-blq="' + i + '" data-campo="' + campo + '">' + esc(b[campo] || '') + '</textarea>' +
    (ayuda ? '<span class="ayuda">' + esc(ayuda) + '</span>' : '') + '</div>';

  const bloque = (b, i) => {
    const t = tipos.find((x) => x.id === b.tipo_ingreso_id) || null;

    const selTipo = campoBlq(i, 'tipo_ingreso_id', 'Tipo de ingreso',
      '<select data-blq="' + i + '" data-campo="tipo_ingreso_id">' +
      '<option value="">Seleccione tipo de ingreso</option>' +
      tipos.map((x) => '<option value="' + esc(x.id) + '"' + (b.tipo_ingreso_id === x.id ? ' selected' : '') +
        '>' + esc(x.nombre) + '</option>').join('') + '</select>',
      t ? '' : 'Los campos de la orden aparecen al elegirlo', true);

    if (!t) {
      return `
      <fieldset class="bloque" style="margin-bottom:12px">
        <legend>Orden ${i + 1} de ${r.bloques.length}</legend>
        <div class="rejilla-campos">${selTipo}</div>
        ${r.bloques.length > 1
          ? '<div style="margin-top:8px"><button class="btn secundario" data-quitar-blq="' + i + '">Quitar esta orden</button></div>'
          : ''}
      </fieldset>`;
    }

    const deCompania = t.exige_compania ?
      campoBlq(i, 'compania_id', 'Compañía',
        '<select data-blq="' + i + '" data-campo="compania_id"><option value="">Seleccione compañía</option>' +
        comps.map((c) => '<option value="' + esc(c.id) + '"' + (b.compania_id === c.id ? ' selected' : '') +
          '>' + esc(c.nombre) + '</option>').join('') + '</select>',
        'Del catálogo: no se escribe a mano', true) +
      texto(i, b, 'siniestro', 'N° de siniestro', '', true) +
      campoBlq(i, 'deducible', 'Deducible neto',
        '<input type="number" data-blq="' + i + '" data-campo="deducible" value="' + esc(b.deducible) + '">') : '';

    const deEmpresa = t.exige_or
      ? texto(i, b, 'numero_or', 'N° de OR',
          'El que trae el cliente corporativo — pregunta abierta 2', true)
      : '';

    return `
    <fieldset class="bloque" style="margin-bottom:12px">
      <legend>Orden ${i + 1} de ${r.bloques.length}${r.bloques.length > 1 ? ' · genera su propia OT' : ''}
        · ${esc(t.nombre)}</legend>
      <div class="rejilla-campos">
        ${selTipo}
        ${deCompania}
        ${deEmpresa}
        ${campoBlq(i, 'prioridad_id', 'Prioridad',
          '<select data-blq="' + i + '" data-campo="prioridad_id">' +
          prios.map((p) => '<option value="' + esc(p.id) + '"' + (b.prioridad_id === p.id ? ' selected' : '') +
            '>' + esc(p.nombre) + '</option>').join('') + '</select>')}
        ${campoBlq(i, 'estado', 'Estado',
          '<select data-blq="' + i + '" data-campo="estado">' +
          '<option value="">Seleccione Estado</option>' +
          estados.map((e) => '<option value="' + esc(e.codigo) + '"' + (b.estado === e.codigo ? ' selected' : '') +
            '>' + esc(e.nombre) + '</option>').join('') + '</select>',
          b.estado ? 'Del maestro, con su redacción exacta' : 'Sin elegir, la orden nace Recibido')}
        ${/* ⚠️ NO está en la lista de campos que pidió el cliente para ninguno de
             los tres tipos. Se mantiene porque es lo que convierte la recepción
             en un TRASPASO y no en un aviso: la orden le aparece a esa persona
             en su pantalla apenas se guarda. Si el taller lo quiere fuera, se
             borra este bloque y nada más. */''}
        ${campoBlq(i, 'responsable_id', 'Responsable de la orden',
          '<select data-blq="' + i + '" data-campo="responsable_id"><option value="">Sin asignar todavía</option>' +
          Modelo.sesionesPosibles().map((p) => '<option value="' + esc(p.id) + '"' +
            (b.responsable_id === p.id ? ' selected' : '') + '>' + esc(p.nombre) + ' · ' +
            esc(p.cargo) + '</option>').join('') + '</select>',
          'Le aparece en su pantalla apenas se guarde')}
      </div>
      <div class="rejilla-campos" style="margin-top:8px">
        ${t.exige_compania ? area(i, b, 'liquidador', 'Liquidador / evaluador de la OT') : ''}
        ${area(i, b, 'descripcion_danos', 'Descripción de daños',
          'En palabras. Las marcas de la silueta van en el paso 4')}
        ${area(i, b, 'descripcion_estado', 'Descripción del estado')}
      </div>
      ${r.bloques.length > 1
        ? '<div style="margin-top:8px"><button class="btn secundario" data-quitar-blq="' + i + '">Quitar esta orden</button></div>'
        : ''}
    </fieldset>`;
  };

  return `
  ${r.bloques.map(bloque).join('')}
  <button class="btn" id="rec-add-blq">+ Agregar otra orden a esta recepción</button>
  <div class="pie-nota">Una recepción puede generar <strong>varias órdenes</strong>: en el formulario
    original los campos de la solicitud son arreglos con botón <strong>+</strong>. Cada bloque tiene su
    propio tipo de ingreso y genera su propia OT; comparten vehículo, cliente, checklist, daños y fotos.</div>
`;
}

/* ── Paso 4 · Estado descriptivo ───────────────────────────────────────
   🔶 ABSORBE EL INVENTARIO Y LAS FOTOS (15-08-2026). Los tres eran pasos
   distintos y son la misma pregunta: en qué estado entró el vehículo. Van en
   este orden porque es el orden en que se recorre el auto: se mira por fuera y
   se marca el daño, se lee el tablero, y se fotografía. */

function recDanos() {
  const r = rec();
  const items = Modelo.catalogo('inventario_item');
  const estados = Modelo.inventarioEstados();
  const c = recInvConteo();

  /* 🔶 EL LAYOUT COMPACTO DEL ORIGINAL (15-08-2026). El dibujo a la izquierda,
     y a la derecha —en la misma pantalla, sin bajar— el tipo de daño, las
     marcas con su observación, el kilometraje, el combustible y las fotos. Es
     como está en el sistema real y es como se trabaja: el auto está adelante y
     el recepcionista no puede andar buscando dónde quedó cada campo. */
  return `
  <div class="estado-descriptivo">
    <div class="ed-dibujo">
      <div class="lienzo">${svgSilueta()}</div>
      <div class="ed-barra">
        <span class="ayuda">Raya sobre el auto con el dedo o el mouse. Cada trazo es un daño.</span>
        <span style="display:flex;gap:6px">
          <button class="btn secundario" id="dano-deshacer">Deshacer el último</button>
          <button class="btn secundario" id="dano-borrar">Borrar todo</button>
        </span>
      </div>
    </div>

    <div class="ed-lado">
      ${/* 🔶 ACÁ NO VA NADA MÁS (15-08-2026, y va en mayúsculas porque se pidió
           tres veces). Se raya el auto y se escribe en UNA casilla. Se sacaron
           el selector de tipo de daño —Rayón, Abolladura, Quiebre, Faltante,
           Óxido— y la lista de marcas con su observación por trazo.

           Por qué se sacan aunque funcionaran: la recepción se hace en el mesón
           con el cliente esperando, y elegir un tipo antes de cada raya y
           redactar una línea después de cada raya es más trabajo que el que
           ahorra. El tipo de daño se cuenta en la observación, en castellano.

           La zona se sigue deduciendo sola de dónde cayó el trazo, y por eso el
           dato consultable no se pierde — pero eso pasa por debajo y el
           recepcionista no lo ve ni lo elige. */''}
      <div class="campo">
        <label>Observaciones</label>
        <textarea rows="5" data-rec="observaciones"
          placeholder="Qué trae el vehículo: dónde está el daño, de qué tipo, si ya venía…">${esc(r.campos.observaciones)}</textarea>
        <span class="ayuda">Una sola casilla para todo lo marcado.</span>
      </div>

      <fieldset class="bloque" style="margin-top:12px"><legend>Tablero</legend>
        <div class="rejilla-campos">
          ${recCampo('km', 'Kilometraje', { tipo: 'number', ayuda: 'Como se lee al recibirlo' })}
        </div>
        <h4 class="rot-chico" style="margin-top:10px">Nivel de combustible</h4>
        <div class="chips">
          ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => '<button class="chip' +
            (String(r.campos.combustible) === String(n) ? ' activo' : '') + '" data-comb="' + n + '">' +
            n + '/8' + (n === 8 ? ' lleno' : n === 0 ? ' vacío' : '') + '</button>').join('')}
        </div>
        <div class="pie-nota">Nueve posiciones, como el original. Nuestro diseño decía ocho.</div>
      </fieldset>

      <fieldset class="bloque" style="margin-top:12px"><legend>Fotografías de ingreso</legend>
        ${zonaFotos({ id: 'recfoto', fotos: r.fotos, titulo: 'Agregar fotografías' })}
      </fieldset>
    </div>
  </div>

  <fieldset class="bloque" style="margin-top:12px">
    <legend>Inventario del vehículo · los ${items.length} ítems</legend>
    <div style="margin:2px 0 10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <span id="n-inv" class="chips-conteo">${recInvResumen(c)}</span>
      <button class="btn secundario" id="inv-todos">Marcar todos presentes</button>
      <button class="btn secundario" id="inv-ninguno">Volver todos a sin verificar</button>
    </div>
    ${/* 🔶 CUATRO BOTONES POR ÍTEM, no un desplegable (15-08-2026). Son 28
         ítems: con un `select` hay que abrirlo, buscar la opción y cerrarlo —
         tres gestos por ítem, 84 en total— y encima no se ve de un golpe cómo
         quedó el checklist. Con los botones se marca de un toque y el estado se
         lee de lejos por su color y su icono, que es lo que hace el original.

         🔶 LA OBSERVACIÓN POR ÍTEM, en los 28 y en cualquier estado
         (15-08-2026). Se probó mostrarla solo en `no presente` y `dañado` —que
         es donde la muestra el original— y el cliente pidió poder escribir
         siempre. Manda él, y además tiene razón: «rayado pero funciona» es una
         nota legítima sobre un ítem PRESENTE, y no somos nosotros los que
         tenemos que adivinar en cuáles lo dejamos escribir.

         Lo que sí cambia según el estado es qué PREGUNTA el campo —«Por qué no
         está», «Qué daño tiene», «Sin observación»— y que al marcar uno de los
         dos estados que se discuten después el foco salta solo a la casilla.
         Esa es la mitad que sí vale la pena guiar. */''}
    <div class="grid-envoltorio"><table class="grid">
      <thead><tr><th>Elemento</th><th style="width:250px">Estado</th><th>Observación</th></tr></thead>
      <tbody>${items.map((it) => {
        const v = r.inventario[it.id] || 'sin_verificar';
        return '<tr data-fila-inv="' + esc(it.id) + '"><td>' + esc(it.nombre) +
          ' <span class="cod" style="font-size:10.5px;color:var(--gris-2)">' + esc(it.codigo) + '</span></td>' +
          '<td><span class="inv-botones">' +
            estados.map((e) => '<button type="button" class="inv-btn ' + e.clase +
              (v === e.codigo ? ' activo' : '') + '" data-inv="' + esc(it.id) +
              '" data-estado="' + esc(e.codigo) + '" title="' + esc(e.nombre) + '" ' +
              'aria-label="' + esc(it.nombre + ': ' + e.nombre) + '">' +
              ico(e.icono) + '</button>').join('') +
          '</span></td>' +
          '<td class="celda-obs-inv">' + recObsInv(it, v) + '</td></tr>';
      }).join('')}</tbody>
    </table></div>
    <div class="pie-nota">🔶 Dejó de ser un sí/no. <strong>Sin verificar no es lo mismo que no presente</strong>:
      lo primero es que nadie alcanzó a mirarlo, lo segundo es que se revisó y no estaba. Y
      <strong>dañado no es lo mismo que faltante</strong>: son dos reclamos distintos. Lo que nadie toca
      queda en <em>sin verificar</em>, nunca en <em>no presente</em>.</div>
  </fieldset>`;
}

/* Los dos estados que PIDEN explicación. No son los únicos donde se puede
   escribir —se escribe en cualquiera—, pero son los que se van a discutir
   después, así que el marcador del campo pregunta lo que corresponde y el
   foco salta solo al marcarlos. */
const INV_PIDE_NOTA = ['no_presente', 'danado'];

// Qué pregunta el campo según cómo quedó el ítem.
function recObsMarcador(estado) {
  if (estado === 'danado') return 'Qué daño tiene';
  if (estado === 'no_presente') return 'Por qué no está';
  return 'Sin observación';
}

/* La celda de observación de un ítem. Se escribe SIEMPRE, en los 28 y en
   cualquier estado: el recepcionista puede querer anotar «rayado pero
   funciona» en algo que está presente, y no es él quien tiene que adivinar en
   cuáles lo dejamos escribir. Lo único que cambia según el estado es qué
   pregunta el campo. */
function recObsInv(it, estado) {
  const r = rec();
  return '<input data-obsinv="' + esc(it.id) + '" value="' + esc(r.obsInventario[it.id] || '') + '" ' +
    'placeholder="' + esc(recObsMarcador(estado)) + '" ' +
    'aria-label="' + esc('Observación de ' + it.nombre) + '">';
}

/* Los ítems que tienen algo escrito, con su estado al lado. Se usa en
   Verificar: la nota sin el estado no se entiende —«se lo llevó el cliente» no
   dice si el ítem falta o está dañado— y el estado sin la nota no sirve de
   prueba. Van juntos o no van. */
function recItemsConNota() {
  const r = rec();
  const estados = Modelo.inventarioEstados();
  return Modelo.catalogo('inventario_item')
    .filter((it) => String(r.obsInventario[it.id] || '').trim())
    .map((it) => {
      const cod = r.inventario[it.id] || 'sin_verificar';
      const e = estados.find((x) => x.codigo === cod) || estados[estados.length - 1];
      return { nombre: it.nombre, nota: String(r.obsInventario[it.id]).trim(),
               estadoNombre: e.nombre, clase: e.clase };
    });
}

function recInvConteo() {
  const r = rec();
  const c = { presente: 0, no_presente: 0, danado: 0, sin_verificar: 0 };
  Modelo.catalogo('inventario_item').forEach((it) => {
    const v = r.inventario[it.id] || 'sin_verificar';
    if (c[v] === undefined) c[v] = 0;
    c[v]++;
  });
  return c;
}

/* El desglose, no un total. "24 de 28" no dice nada cuando hay cuatro estados:
   lo que importa es cuántos están dañados y cuántos nadie miró. */
function recInvResumen(c) {
  return Modelo.inventarioEstados()
    .map((e) => '<span class="et ' + e.clase + '">' + c[e.codigo] + ' ' + esc(e.nombre.toLowerCase()) + '</span>')
    .join(' ');
}

/* Las piezas rayadas, agrupadas y contadas. Es lo que el croquis aporta como
   DATO —y lo que después permite preguntar cuántos vehículos llegaron con la
   puerta trasera derecha marcada—, sin pedirle nada al recepcionista. */
function recPiezasMarcadas(danos) {
  const cuenta = {};
  danos.forEach((d) => {
    const k = d.zonaNombre || 'Sin zona';
    cuenta[k] = (cuenta[k] || 0) + 1;
  });
  return Object.keys(cuenta).map((k) =>
    '<span class="et azul" style="margin:0 4px 4px 0;display:inline-block">' + esc(k) +
    (cuenta[k] > 1 ? ' ×' + cuenta[k] : '') + '</span>').join('');
}

/* Dibujar lo rayado, y nada más. No hay lista al lado: el auto ya muestra dónde
   se marcó, que es exactamente para lo que sirve un croquis. */
function pintarDanos() {
  const r = rec();
  const g = document.getElementById('marcas');
  if (!g) return;

  // Cada daño es un TRAZO. Se redibuja entero desde los puntos guardados, así
  // que sobrevive a cambiar de paso, a recargar y al borrador restaurado.
  g.innerHTML = r.danos.map((d, i) => {
    // Un daño sin trazo viene de un borrador anterior al dibujo libre: se marca
    // en el centro de su zona en vez de desaparecer de la pantalla.
    const p = (d.trazo && d.trazo.length) ? d.trazo : [siluetaPuntoDeZona(d.vista, d.zona)];
    return '<path class="trazo-dano" data-trazo="' + i + '" d="' + siluetaTrazoD(p) + '"></path>';
  }).join('');

  const n = document.getElementById('n-marcas');
  if (n) n.textContent = r.danos.length ? plural(r.danos.length, 'marca', 'marcas') : 'sin marcas';
}

/* ── Paso 5 · Verificar Orden ──────────────────────────────────────────
   Todo lo cargado, de solo lectura, agrupado como los cuatro pasos anteriores.
   Lo que quedó vacío dice **Sin datos** y no se esconde: el campo que no está
   se tiene que poder ver antes de crear la orden, no después. */

function recVerificar() {
  const r = rec();
  const nada = '<span class="et gris">Sin datos</span>';
  const v = (x) => (String(x == null ? '' : x).trim() ? esc(String(x).trim()) : nada);
  const d = (k, val) => '<div class="dato"><span class="k">' + esc(k) + '</span><span class="v">' + val + '</span></div>';

  const nom = (tabla, id) => {
    const f = Modelo.catalogo(tabla).find((x) => x.id === id);
    return f ? esc(f.nombre) : nada;
  };
  const c = recInvConteo();

  const orden = (b, i) => {
    const t = Modelo.catalogo('tipo_ingreso').find((x) => x.id === b.tipo_ingreso_id);
    const est = Modelo.catalogo('estado').find((x) => x.codigo === b.estado);
    return `
    <fieldset class="bloque" style="margin-bottom:10px">
      <legend>Orden ${i + 1} de ${r.bloques.length} · ${t ? esc(t.nombre) : 'sin tipo de ingreso'}</legend>
      <div class="ficha-rejilla">
        <div>
          ${d('Tipo de ingreso', t ? esc(t.nombre) : nada)}
          ${t && t.exige_compania ? d('Compañía', nom('compania', b.compania_id)) : ''}
          ${t && t.exige_compania ? d('N° de siniestro', v(b.siniestro)) : ''}
          ${t && t.exige_compania ? d('Deducible neto', String(b.deducible).trim() ? fMonto(Number(b.deducible)) : nada) : ''}
          ${t && t.exige_or ? d('N° de OR', v(b.numero_or)) : ''}
        </div>
        <div>
          ${d('Prioridad', nom('prioridad', b.prioridad_id))}
          ${d('Estado', est ? esc(est.nombre)
            : '<span class="et gris">Sin datos</span> <span class="ayuda">nace Recibido</span>')}
          ${d('Responsable', b.responsable_id
            ? esc((Modelo.sesionesPosibles().find((p) => p.id === b.responsable_id) || {}).nombre || '')
            : nada)}
        </div>
      </div>
      ${t && t.exige_compania ? '<div class="dato-largo"><span class="k">Liquidador / evaluador</span>' +
        '<span class="v">' + v(b.liquidador) + '</span></div>' : ''}
      <div class="dato-largo"><span class="k">Descripción de daños</span><span class="v">${v(b.descripcion_danos)}</span></div>
      <div class="dato-largo"><span class="k">Descripción del estado</span><span class="v">${v(b.descripcion_estado)}</span></div>
    </fieldset>`;
  };

  return `
  <div class="nota info">${ico('info')}
    <strong>Nada se ha creado todavía.</strong> Esto es lo que se va a guardar cuando se apriete
    <strong>Ingresar recepción</strong>: ${plural(r.bloques.length, 'orden de trabajo', 'órdenes de trabajo')}
    sobre un vehículo, un cliente, un checklist, ${plural(r.danos.length, 'daño marcado', 'daños marcados')}
    y ${plural(r.fotos.length, 'fotografía', 'fotografías')}.
  </div>

  <div class="ficha-rejilla" style="margin-top:11px">
    <fieldset class="bloque"><legend>1 · Datos del cliente</legend>
      ${d('RUT', v(r.campos.rut))}
      ${d('Nombre completo', v(r.campos.nombre))}
      ${d('Teléfono', v(r.campos.telefono))}
      ${d('Correo', v(r.campos.correo))}
      ${d('Dirección', v(r.campos.direccion))}
    </fieldset>

    <fieldset class="bloque"><legend>2 · Datos del vehículo</legend>
      ${d('Patente', r.campos.patente
        ? '<span class="patente">' + esc(String(r.campos.patente).toUpperCase().replace(/[^A-Z0-9]/g, '')) + '</span>'
        : nada)}
      ${d('Marca', nom('marca', r.campos.marca_id))}
      ${d('Modelo', nom('modelo', r.campos.modelo_id))}
      ${d('Color', nom('color_vehiculo', r.campos.color_id))}
      ${d('Año', v(r.campos.anio))}
      ${d('VIN', v(r.campos.vin))}
    </fieldset>

    <fieldset class="bloque"><legend>4 · Estado descriptivo</legend>
      ${d('Kilometraje', String(r.campos.km).trim() ? fKm(Number(r.campos.km)) : nada)}
      ${d('Combustible', fComb(r.campos.combustible))}
      ${d('Daños marcados', r.danos.length ? String(r.danos.length) : nada)}
      ${d('Fotografías', r.fotos.length ? String(r.fotos.length) : nada)}
      ${d('Inventario', recInvResumen(c))}
      ${d('Ítems con observación', recItemsConNota().length
        ? String(recItemsConNota().length) : nada)}
    </fieldset>
  </div>

  ${/* Lo anotado en el checklist, escrito completo. En Verificar no basta con
       decir "3 ítems con observación": el cliente está firmando esto, y lo que
       tiene que poder leer es QUÉ dice cada una. */''}
  ${recItemsConNota().length ? `
  <fieldset class="bloque" style="margin-top:10px"><legend>Observaciones del inventario</legend>
    ${recItemsConNota().map((x) => `<div class="dato-largo">
      <span class="k">${esc(x.nombre)} <span class="et ${x.clase}">${esc(x.estadoNombre)}</span></span>
      <span class="v">${esc(x.nota)}</span></div>`).join('')}
  </fieldset>` : ''}

  ${/* Las piezas que quedaron rayadas. No es una tabla de daños con tipo y
       comentario —eso se sacó— sino el resumen de dónde se marcó, que es lo que
       el trazo aporta como dato. Lo demás está en la observación. */''}
  ${r.danos.length ? `
  <fieldset class="bloque" style="margin-top:10px"><legend>Piezas marcadas en el croquis</legend>
    <div>${recPiezasMarcadas(r.danos)}</div>
  </fieldset>` : ''}

  <h3 class="rot-seccion">3 · Solicitud de reparación</h3>
  ${r.bloques.map(orden).join('')}

  ${/* 🔶 LA FIRMA DEL CLIENTE (15-08-2026). Se había sacado el 13-08 con el
       argumento de que el comprobante se firma en papel; el cliente la pidió de
       vuelta: quiere que firme en la tablet o el celular y que salga impresa.

       Va en ESTE paso y no en otro: el cliente firma lo que acaba de revisar, y
       lo que acaba de revisar es este resumen. Firmar antes de ver el resumen
       sería firmar a ciegas. */''}
  <fieldset class="bloque" style="margin-top:12px"><legend>Firma del cliente</legend>
    <div class="firma-zona">
      <canvas id="firma-lienzo" width="620" height="190"
        class="${r.firma || (r.firmaTrazos || []).length ? 'firmado' : ''}" aria-label="Zona para firmar"></canvas>
      <div class="firma-pie">
        <span class="ayuda">${r.firma || (r.firmaTrazos || []).length
          ? 'Firmado. Sale impreso en el comprobante de recepción.'
          : 'El cliente firma con el dedo en la tablet o el celular, o con el mouse.'}</span>
        ${/* 🔷 DESHACER (16-08-2026, Marco). Antes lo único que había era
              «Borrar y volver a firmar»: si al cliente le salía mal el apellido
              tenía que rehacer la firma entera. Deshacer saca el último trazo
              —el que va desde que apoya el dedo hasta que lo levanta— y deja lo
              anterior donde estaba.

              Se aprieta siempre, también con el recuadro en blanco: ahí no se
              queda mudo, dice que no hay nada que deshacer. */''}
        <span class="acciones-firma">
          <button type="button" class="btn secundario" id="firma-deshacer">Deshacer el último trazo</button>
          <button type="button" class="btn secundario" id="firma-borrar">Borrar y volver a firmar</button>
        </span>
      </div>
    </div>
    <div class="pie-nota">La firma no es obligatoria para ingresar la recepción: si el cliente dejó
      el auto y se fue, el vehículo entra igual. Lo que no se puede es decir que firmó sin que haya
      firmado.</div>
  </fieldset>

  ${/* Las observaciones se escriben en el paso 4, junto al dibujo, que es donde
       están mirando el auto. Acá se muestran para revisarlas antes de firmar,
       no para escribirlas de nuevo. */''}
  <div class="dato-largo" style="margin-top:12px"><span class="k">Observaciones de la recepción</span>
    <span class="v">${v(r.campos.observaciones)}</span></div>

  <div class="pie-nota">El comprobante se genera <strong>en el navegador</strong>, con
    <strong>Guardar PDF</strong>. No queda ningún archivo en una ruta adivinable: es la corrección
    C-10 / DP-4 del sistema actual, donde <span class="cod">/pdf/recepcion-&lt;OT&gt;.pdf</span> es
    enumerable y lleva nombre, RUT, dirección y la firma del cliente.</div>`;
}

/* ⛔ ACÁ VIVÍA LA PANTALLA DE CONFIRMACIÓN, y se eliminó el 15-08-2026 a
   pedido del cliente: *"saca lo que marqué con X, que no muestre eso"*.

   Mostraba la OT recién creada con su patente, su estado y tres botones.
   Guardada la recepción se vuelve derecho al menú de opciones, y el número de
   OT se dice en el aviso —ver `guardarRecepcion`—, que es lo único de esa
   pantalla que el recepcionista necesitaba.

   El comprobante impreso NO se perdió: sigue saliendo desde la ficha de la
   orden, que es de donde salía igual. */

/* ── Cableado ──────────────────────────────────────────────────────────── */

function pRecepcion() {
  const r = rec();

  // La corrección de una recepción tiene su propio archivo y sus propios
  // enganches. Sale de acá derecho para no arrastrar los del formulario.
  if (r.pantalla === 'editar-ficha') return pRecepcionEditarFicha();

  /* El menú de cuatro opciones. Cada una lleva a algo que existe; la que el rol
     no puede usar se aprieta igual y dice quién sí puede. */
  document.querySelectorAll('[data-opcion]').forEach((b) => b.addEventListener('click', () => {
    const op = RECEPCION_OPCIONES.find((x) => x.id === b.dataset.opcion);
    if (!op) return;
    if (!Modelo.puede(op.permiso)) {
      return avisar({ ok: false, motivo: '«' + op.rot + '» no es de este perfil. El rol ' +
        (Modelo.rolActual().nombre || '—') + ' no tiene el permiso «' + op.permiso +
        '». Se administra en Configuración → Roles y permisos.' });
    }
    if (op.id === 'entregar') return ir('entrega');
    // Las otras tres son pantallas de este mismo módulo.
    r.pantalla = op.id; r.buscaEditar = ''; render();
  }));

  /* Volver al menú, desde el formulario o desde el buscador. Salir del
     formulario descarta lo que se hubiera llenado: es la misma regla que al
     salir del módulo, y tiene que ser la misma por las dos puertas. */
  const volver = document.getElementById('rec-volver');
  if (volver) volver.addEventListener('click', () => {
    limpiarBorrador();
    rec().pantalla = 'menu';
    render();
  });

  // El buscador de `Editar Recepción`.
  const buscar = document.getElementById('rec-buscar-patente');
  if (buscar) {
    buscar.addEventListener('input', () => {
      r.buscaEditar = buscar.value.toUpperCase();
      render();
      const otra = document.getElementById('rec-buscar-patente');
      if (otra) { otra.focus(); otra.setSelectionRange(otra.value.length, otra.value.length); }
    });
    /* Corregir la recepción. Se carga la orden UNA vez, al entrar: si se
       recargara en cada pintado, cada tecla que escribe el usuario se perdería
       con el render siguiente. */
    document.querySelectorAll('[data-editar-rec]').forEach((b) => b.addEventListener('click', () => {
      const o = Modelo.torre().find((x) => String(x.numeroOT) === b.dataset.editarRec);
      if (!o) return avisar({ ok: false, motivo: 'Esa orden ya no está abierta.' });
      editRecCargar(o);
      r.pantalla = 'editar-ficha';
      render();
    }));

    /* Abrir la OR desde acá. Es el mismo procedimiento del motor que usa el
       módulo de presupuesto, así que la regla y el permiso los revisa él: si un
       día alguien no puede, lo rechaza con su motivo y no con un botón gris. */
    document.querySelectorAll('[data-abrir-or]').forEach((b) => b.addEventListener('click', () => {
      const o = Modelo.torre().find((x) => String(x.numeroOT) === b.dataset.abrirOr);
      if (!o) return avisar({ ok: false, motivo: 'Esa orden ya no está abierta.' });
      const res = Modelo.crear_presupuesto(o.id, { lineas: [] });
      if (!avisar(res, 'OR ' + (res.numero_or || '') + ' abierta sobre la OT ' + o.numeroOT +
        '. Queda en cero: la valoriza el evaluador.')) return;
      render();
    }));
  }

  /* Navegación entre pasos. Las pastillas dejan volver a cualquier paso
     anterior sin validar nada, y hacia adelante solo si lo de atrás está
     completo. La que no se puede alcanzar NO está deshabilitada: se aprieta,
     rechaza y dice qué falta. */
  document.querySelectorAll('[data-paso]').forEach((b) => b.addEventListener('click', () => {
    const j = RECEPCION_PASOS.findIndex((p) => p.id === b.dataset.paso);
    if (j < 0 || j === recIndicePaso()) return;
    if (!recAlcanzable(j)) {
      const faltan = [];
      RECEPCION_PASOS.slice(0, j).forEach((p) => faltan.push.apply(faltan, recFaltantesDe(p.id)));
      return recRechazar(faltan);
    }
    r.paso = b.dataset.paso; r.marcados = []; guardarBorrador(); render();
  }));

  const ant = document.getElementById('rec-ant');
  if (ant) ant.addEventListener('click', () => {
    const i = recIndicePaso();
    if (i <= 0) return;
    r.paso = RECEPCION_PASOS[i - 1].id; r.marcados = [];
    guardarBorrador(); render();
  });

  const sig = document.getElementById('rec-sig');
  if (sig) sig.addEventListener('click', recAvanzar);

  // Campos simples. Se guarda al escribir, sin repintar: repintar en cada
  // tecla haría perder el foco y el cursor.
  document.querySelectorAll('input[data-rec], textarea[data-rec]').forEach((el) =>
    el.addEventListener('input', () => {
      /* El RUT se reescribe con sus puntos y su guión en cada tecla. Hay que
         devolver el cursor a mano: al cambiar el valor el navegador lo manda al
         final, y si alguien corrige un dígito del medio el cursor le salta. Se
         cuenta cuántos dígitos quedaban a la izquierda y se lo deja después del
         mismo dígito, ya con los puntos puestos. */
      if (el.dataset.rec === 'rut') reescribir(el, formatearRut, /[0-9K]/i);
      // La patente se limpia en el mismo gesto: mayúsculas, sin guión ni
      // punto, y cortada en seis. Escribir la séptima simplemente no hace nada.
      if (el.dataset.rec === 'patente') reescribir(el, normalizarPatente, /[A-Z0-9]/i);
      if (el.dataset.rec === 'vin') reescribir(el, normalizarVin, /[A-Z0-9]/i);

      r.campos[el.dataset.rec] = el.value;
      // El contador de patente y VIN se mueve tecla a tecla. No se repinta el
      // campo —se perdería el cursor—: se reescribe solo su línea de ayuda.
      if (el.dataset.rec === 'patente' || el.dataset.rec === 'vin') {
        const pista = document.querySelector('[data-ayuda="' + el.dataset.rec + '"]');
        if (pista) pista.textContent = recAyudaLargo(el.dataset.rec);
      }

      recDesmarcar(el, el.dataset.rec);
      guardarBorrador();
    }));
  // Los desplegables sí repintan: marca cambia la lista de modelos.
  document.querySelectorAll('select[data-rec]').forEach((el) => el.addEventListener('change', () => {
    r.campos[el.dataset.rec] = el.value;
    if (el.dataset.rec === 'marca_id') r.campos.modelo_id = '';
    guardarBorrador(); render();
  }));

  /* Los combos que se escriben. El id se resuelve por nombre en cada tecla; si
     todavía no calza con ninguna fila, queda vacío y aparece el botón para
     agregarlo. No se redibuja en cada letra —se perdería el cursor—, salvo
     cuando el valor pasa de calzar a no calzar, que es cuando ese botón tiene
     que aparecer o desaparecer. */
  const filasDe = (tabla) => tabla === 'modelo'
    ? Modelo.catalogo('modelo').filter((m) => m.marca_id === r.campos.marca_id)
    : Modelo.catalogo(tabla);

  document.querySelectorAll('[data-combo]').forEach((el) => el.addEventListener('input', () => {
    const clave = el.dataset.combo;
    const antes = r.campos[clave];
    r.textos[clave] = el.value;
    const t = el.value.trim().toLowerCase();
    const fila = filasDe(el.dataset.tabla).find((f) => String(f.nombre).toLowerCase() === t);
    r.campos[clave] = fila ? fila.id : '';
    recDesmarcar(el, clave);
    // Cambiar de marca invalida el modelo elegido.
    if (clave === 'marca_id' && r.campos.marca_id !== antes) {
      r.campos.modelo_id = ''; r.textos.modelo_id = '';
    }
    guardarBorrador();
    if (!!fila !== !!antes || clave === 'marca_id') { render(); recEnfocar(clave, el.value.length); }
  }));

  document.querySelectorAll('[data-combo-crear]').forEach((b) => b.addEventListener('click', () => {
    const clave = b.dataset.comboCrear;
    const nombre = String(r.textos[clave] || '').trim();
    if (!nombre) return;
    const fila = { nombre, codigo: nombre.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 18) };
    // El modelo cuelga de la marca: sin marca elegida no se puede crear.
    if (b.dataset.tabla === 'modelo') {
      if (!r.campos.marca_id) return avisar({ ok: false, motivo: 'Primero hay que elegir la marca.' });
      fila.marca_id = r.campos.marca_id;
    }
    const res = Modelo.guardar_catalogo(b.dataset.tabla, fila);
    if (!avisar(res, '«' + nombre + '» quedó en el catálogo y ya está elegido.')) return;
    const creada = filasDe(b.dataset.tabla).find((f) => String(f.nombre).toLowerCase() === nombre.toLowerCase());
    if (creada) r.campos[clave] = creada.id;
    guardarBorrador(); render();
  }));

  document.querySelectorAll('[data-comb]').forEach((b) => b.addEventListener('click', () => {
    r.campos.combustible = b.dataset.comb; guardarBorrador(); render();
  }));

  // Bloques de orden
  document.querySelectorAll('[data-blq]').forEach((el) => {
    const ev = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(ev, () => {
      const i = Number(el.dataset.blq);
      r.bloques[i][el.dataset.campo] = el.value;
      recDesmarcar(el, 'blq:' + i + ':' + el.dataset.campo);
      guardarBorrador();
      // El tipo de ingreso decide QUÉ campos existen: eso sí repinta.
      if (ev === 'change') render();
    });
  });
  const add = document.getElementById('rec-add-blq');
  if (add) add.addEventListener('click', () => { r.bloques.push(bloqueVacio()); guardarBorrador(); render(); });
  document.querySelectorAll('[data-quitar-blq]').forEach((b) => b.addEventListener('click', () => {
    r.bloques.splice(Number(b.dataset.quitarBlq), 1); r.marcados = []; guardarBorrador(); render();
  }));

  // Silueta
  /* ── Rayar sobre el auto ────────────────────────────────────────────
     Se raya con el dedo o con el mouse, y cada trazo es un daño. Al soltar se
     calcula el centro del trazo y se mira en qué vista y en qué zona cayó: el
     recepcionista dibuja, el sistema clasifica. Así el dato sigue siendo
     consultable —"cuántos vehículos de SURA llegaron con la puerta delantera
     izquierda dañada"— sin obligarlo a apuntarle a un rectángulo.

     `pointer*` y no `mouse*`: esto se usa en una tablet. El `touch-action:none`
     del CSS evita que el dedo arrastre la página mientras se raya. */
  const svg = document.getElementById('silueta');
  if (svg) {
    const zonas = Modelo.zonasDano();
    let trazo = null, vivo = null;

    const punto = (ev) => {
      const caja = svg.getBoundingClientRect();
      return { x: Number(((ev.clientX - caja.left) / caja.width).toFixed(4)),
               y: Number(((ev.clientY - caja.top) / caja.height).toFixed(4)) };
    };

    svg.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* no siempre se puede */ }
      trazo = { puntos: [punto(ev)] };
      vivo = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      vivo.setAttribute('class', 'trazo-dano');
      document.getElementById('marcas').appendChild(vivo);
    });

    svg.addEventListener('pointermove', (ev) => {
      if (!trazo) return;
      trazo.puntos.push(punto(ev));
      vivo.setAttribute('d', siluetaTrazoD(trazo.puntos));
    });

    const soltar = () => {
      if (!trazo) return;
      const puntos = trazo.puntos;
      trazo = null; vivo = null;

      // El centro del trazo decide la zona. Con el promedio y no con el primer
      // punto: una raya que cruza dos piezas pertenece a la que más recorre.
      const cx = puntos.reduce((s, p) => s + p.x, 0) / puntos.length;
      const cy = puntos.reduce((s, p) => s + p.y, 0) / puntos.length;
      const u = siluetaUbicar(cx, cy);
      const z = u.zona ? zonas.find((x) => x.codigo === u.zona) : null;

      /* Sin tipo de daño: ya no se elige. La zona se sigue deduciendo sola —es
         gratis y mantiene el dato consultable— y qué clase de daño es se cuenta
         en la observación, en castellano. */
      r.danos.push({
        vista: u.vista, zona: u.zona, zonaNombre: z ? z.nombre : null,
        severidad: 2, descripcion: '',
        x: Number(cx.toFixed(4)), y: Number(cy.toFixed(4)),
        trazo: puntos
      });
      guardarBorrador(); pintarDanos();
    };
    svg.addEventListener('pointerup', soltar);
    svg.addEventListener('pointerleave', soltar);
    svg.addEventListener('pointercancel', soltar);

    pintarDanos();
  }

  const deshacer = document.getElementById('dano-deshacer');
  if (deshacer) deshacer.addEventListener('click', () => {
    if (!r.danos.length) return avisar({ ok: false, motivo: 'No hay ningún daño marcado todavía.' });
    const d = r.danos.pop();
    guardarBorrador(); pintarDanos();
    avisar({ ok: true, motivo: '' }, 'Se quitó la marca' +
      (d.zonaNombre ? ' de ' + d.zonaNombre.toLowerCase() : '') + '.');
  });
  const borrarTodo = document.getElementById('dano-borrar');
  if (borrarTodo) borrarTodo.addEventListener('click', () => {
    if (!r.danos.length) return avisar({ ok: false, motivo: 'No hay nada que borrar.' });
    if (!confirm('¿Borrar los ' + r.danos.length + ' daños marcados y sus observaciones?')) return;
    r.danos = [];
    guardarBorrador(); pintarDanos();
  });

  /* Inventario · cuatro botones por ítem. No se repinta la pantalla entera al
     marcar uno: son 28 ítems y volver a dibujar la tabla en cada toque hace que
     se sienta lenta justo donde hay que ir rápido. Se mueve la marca de esa
     fila y se actualiza el conteo, nada más. */
  document.querySelectorAll('.inv-btn').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.inv;
    r.inventario[id] = b.dataset.estado;
    document.querySelectorAll('.inv-btn[data-inv="' + id + '"]').forEach((otro) =>
      otro.classList.toggle('activo', otro === b));
    const rot = document.getElementById('n-inv');
    if (rot) rot.innerHTML = recInvResumen(recInvConteo());

    /* La casilla de observación está siempre, así que acá NO se redibuja la
       celda: si alguien está escribiendo y toca un botón, volver a pintar el
       campo le borraría lo tecleado. Solo cambia lo que el campo pregunta.

       Y si el ítem pasó a `no presente` o `dañado` sin nada escrito, el foco
       se va ahí: acaba de decir que algo falta o está dañado, y lo siguiente
       que quiere hacer es contar qué. Si ya había texto no se le mueve el
       cursor encima. */
    const fila = document.querySelector('[data-fila-inv="' + id + '"]');
    const casilla = fila && fila.querySelector('[data-obsinv]');
    if (casilla) {
      casilla.placeholder = recObsMarcador(b.dataset.estado);
      if (INV_PIDE_NOTA.indexOf(b.dataset.estado) >= 0 && !casilla.value.trim()) casilla.focus();
    }
    guardarBorrador();
  }));
  // Las casillas que ya venían pintadas de arranque.
  document.querySelectorAll('[data-obsinv]').forEach((el) => el.addEventListener('input', () => {
    r.obsInventario[el.dataset.obsinv] = el.value; guardarBorrador();
  }));

  const todos = document.getElementById('inv-todos');
  if (todos) todos.addEventListener('click', () => {
    Modelo.catalogo('inventario_item').forEach((i) => { r.inventario[i.id] = 'presente'; });
    guardarBorrador(); render();
  });
  const ninguno = document.getElementById('inv-ninguno');
  if (ninguno) ninguno.addEventListener('click', () => { r.inventario = {}; guardarBorrador(); render(); });

  montarFotos();
  montarFirma();

  const limpiar = document.getElementById('rec-limpiar');
  if (limpiar) limpiar.addEventListener('click', () => {
    if (!confirm('¿Descartar el borrador de esta recepción? Las fotos ya subidas se borran.')) return;
    Promise.all(r.fotos.map((f) => Media.eliminar(f.id).catch(() => null)))
      .then(() => { limpiarBorrador(); render(); });
  });

  const pdf = document.getElementById('rec-pdf');
  if (pdf) pdf.addEventListener('click', recComprobanteBorrador);

  const guardar = document.getElementById('rec-guardar');
  if (guardar) guardar.addEventListener('click', guardarRecepcion);

  Media.pintar();
}

/* Al escribir en un campo marcado en rojo se le quita la marca a ESE campo, sin
   redibujar: los otros que faltan siguen marcados, que es lo que sirve de guía. */
function recDesmarcar(el, clave) {
  const r = rec();
  const k = r.marcados.indexOf(clave);
  if (k < 0) return;
  if (!String(el.value || '').trim()) return;
  r.marcados.splice(k, 1);
  const caja = el.closest ? el.closest('.campo') : null;
  if (caja) caja.classList.remove('falta');
}

/* Avanzar. Es la única puerta hacia adelante y siempre se puede apretar. */
function recAvanzar() {
  const r = rec();
  const faltan = recFaltantesDe(r.paso);
  if (faltan.length) return recRechazar(faltan);
  const i = recIndicePaso();
  if (i >= RECEPCION_PASOS.length - 1) return;
  r.paso = RECEPCION_PASOS[i + 1].id;
  r.marcados = [];
  guardarBorrador(); render();
}

/* Lo que hace el botón `Ingresar recepción` de la barra de herramientas cuando
   todavía no se llegó al último paso: lleva a Verificar si está todo, y si no,
   rechaza donde falta. Vive acá y no en `app.js` porque las reglas del
   formulario son de este archivo. */
/* La única puerta al formulario. Son cuatro los caminos que entran —`Ingresar
   recepción`, `Agregar fotos`, `Nuevo ingreso` y `Descartar borrador`—, y
   pasan todos por acá para que el quinto que se agregue herede lo mismo. */
function recEntrarAlFormulario(paso) {
  const r = rec();
  r.pantalla = 'nuevo';
  if (paso) r.paso = paso;
  return r;
}

function recIrAVerificar() {
  // Desde el menú, `Ingresar recepción` entra al formulario: es lo que se pidió.
  const r = recEntrarAlFormulario();
  render();
  const faltan = recFaltantes();
  if (faltan.length) {
    r.paso = faltan[0].paso;
    return recRechazar(faltan);
  }
  r.paso = 'verificar'; r.marcados = [];
  guardarBorrador(); render();
  avisar({ ok: true, motivo: '' }, 'Todo completo. Revisa el resumen antes de ingresar la recepción.');
}

/* 🔴 EL PNG QUE LLEGA TARDE. `canvas.toBlob` es asíncrono: el PNG se arma
   después, y el navegador se toma lo que se toma. Si mientras tanto la firma
   cambió —el cliente apretó Deshacer— el PNG viejo llegaba igual y se guardaba
   ENCIMA del estado nuevo. Medido el 16-08-2026: tres trazos, tres veces
   Deshacer, el recuadro quedaba en blanco en pantalla y el sistema seguía
   teniendo una firma guardada. El comprobante habría impreso una firma que ya
   no estaba a la vista, que es exactamente lo que este panel promete que no
   puede pasar.

   Cada cambio sube el sello; el PNG que llega con un sello viejo se descarta.
   Va FUERA de `montarFirma` a propósito: cada render vuelve a montar el lienzo,
   y con el contador adentro el trazo viejo se comparaba contra su propio
   contador —el de la vuelta anterior— y siempre se daba por vigente. */
let selloFirma = 0;

/* ── La firma ──────────────────────────────────────────────────────────
   El lienzo de firma. Sin librerías: es trazo sobre canvas.

   Se escucha `pointer*` y no `mouse*` porque la firma se toma en una tablet o
   un teléfono, que es donde va a pasar de verdad. `touch-action:none` en el CSS
   evita que el dedo haga scroll de la página mientras se firma — sin eso, la
   pantalla se mueve y el trazo sale cortado. */
function montarFirma() {
  const c = document.getElementById('firma-lienzo');
  if (!c) return;
  const r = rec();
  const ctx = c.getContext('2d');

  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#111';

  // Si ya había firma, se repinta: cambiar de paso no puede borrarla.
  if (r.firmaTrazos && r.firmaTrazos.length) repintarFirma(ctx, r.firmaTrazos);

  let trazando = false;
  const punto = (ev) => {
    const caja = c.getBoundingClientRect();
    return { x: (ev.clientX - caja.left) * (c.width / caja.width),
             y: (ev.clientY - caja.top) * (c.height / caja.height) };
  };

  c.addEventListener('pointerdown', (ev) => {
    trazando = true;
    c.setPointerCapture(ev.pointerId);
    r.firmaTrazos = r.firmaTrazos || [];
    r.firmaTrazos.push([punto(ev)]);
  });
  c.addEventListener('pointermove', (ev) => {
    if (!trazando) return;
    const p = punto(ev);
    const trazo = r.firmaTrazos[r.firmaTrazos.length - 1];
    trazo.push(p);
    ctx.beginPath();
    ctx.moveTo(trazo[trazo.length - 2].x, trazo[trazo.length - 2].y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  });
  const soltar = () => {
    if (!trazando) return;
    trazando = false;
    // El PNG se guarda al vuelo: si el navegador se cierra a mitad de la
    // recepción, la firma ya está en el borrador.
    const mio = ++selloFirma;
    // El primer trazo cambia el rótulo del pie —de "el cliente firma con el
    // dedo" a "Firmado"— y el borde del recuadro. Sin este repintado había que
    // cambiar de paso para que la pantalla admitiera que ya estaba firmada.
    const primero = (r.firmaTrazos || []).length === 1;
    c.toBlob((blob) => {
      if (mio !== selloFirma) return;      // llegó tarde: la firma ya cambió
      r.firma = blob; guardarBorrador();
      if (primero) render();
    }, 'image/png');
  };
  c.addEventListener('pointerup', soltar);
  c.addEventListener('pointerleave', soltar);
  c.addEventListener('pointercancel', soltar);

  const borrar = document.getElementById('firma-borrar');
  if (borrar) borrar.addEventListener('click', () => {
    selloFirma++;                          // mata cualquier PNG en camino
    ctx.clearRect(0, 0, c.width, c.height);
    r.firmaTrazos = []; r.firma = null;
    guardarBorrador(); render();
  });

  /* Deshacer el último trazo. Los trazos ya se guardaban uno por uno —cada uno
     es lo que se dibujó entre apoyar el dedo y levantarlo—, así que deshacer es
     sacar el último y repintar los que quedan. El PNG se rehace, porque es lo
     que se imprime en el comprobante: si el dibujo y la imagen guardada se
     separan, el papel muestra una firma que en pantalla ya no está. */
  const deshacer = document.getElementById('firma-deshacer');
  if (deshacer) deshacer.addEventListener('click', () => {
    const trazos = r.firmaTrazos || [];
    if (!trazos.length) {
      return avisar({ ok: false,
        motivo: 'No hay ningún trazo que deshacer: el recuadro está en blanco.' });
    }
    trazos.pop();
    const mio = ++selloFirma;
    // Se repinta al tiro, sin esperar al PNG: el que firma tiene que ver que
    // pasó algo en el momento en que aprieta.
    ctx.clearRect(0, 0, c.width, c.height);
    repintarFirma(ctx, trazos);

    const cerrar = () => { guardarBorrador(); render(); };
    if (!trazos.length) { r.firma = null; return cerrar(); }
    c.toBlob((blob) => {
      if (mio !== selloFirma) return;
      r.firma = blob; cerrar();
    }, 'image/png');
  });
}

function repintarFirma(ctx, trazos) {
  trazos.forEach((t) => {
    if (t.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(t[0].x, t[0].y);
    for (let i = 1; i < t.length; i++) ctx.lineTo(t[i].x, t[i].y);
    ctx.stroke();
  });
}

/* ── Fotos ─────────────────────────────────────────────────────────────── */

function montarFotos() {
  const r = rec();
  montarZonaFotos({
    id: 'recfoto', momento: 'ingreso',
    alSubir: (fichas) => { r.fotos.push.apply(r.fotos, fichas); guardarBorrador(); render(); },
    alQuitar: (i) => {
      const f = r.fotos[i];
      if (!f) return;
      Media.eliminar(f.id).catch(() => null).then(() => {
        r.fotos.splice(i, 1); guardarBorrador(); render();
      });
    }
  });
}

/* ── El comprobante antes de guardar ───────────────────────────────────
   `Guardar PDF` en el paso Verificar arma el comprobante con lo que hay en el
   formulario, sin crear nada. Es el mismo documento del sistema, con la OT
   rotulada `sin asignar` porque todavía no existe — no un número inventado.

   🔴 Y se arma acá, en el navegador. El sistema actual lo escribe en
   `/pdf/recepcion-<OT>.pdf`, con el correlativo de cinco dígitos en el nombre:
   una ruta enumerable con nombre, RUT, dirección, teléfono, VIN, patente y la
   firma del cliente. Hallazgo C-10 / DP-4. Acá no hay archivo en el servidor. */
function recComprobanteBorrador() {
  const r = rec();
  const nom = (tabla, id) => (Modelo.catalogo(tabla).find((x) => x.id === id) || {}).nombre || null;
  const b = r.bloques[0] || bloqueVacio();
  const t = Modelo.catalogo('tipo_ingreso').find((x) => x.id === b.tipo_ingreso_id);
  const items = Modelo.catalogo('inventario_item');
  const estados = Modelo.inventarioEstados();

  mostrarImpreso(impresoRecepcion({
    id: null, numeroOT: 'sin asignar',
    patente: normalizarPatente(r.campos.patente),
    marca: nom('marca', r.campos.marca_id), modelo: nom('modelo', r.campos.modelo_id),
    anio: r.campos.anio || null, color: nom('color_vehiculo', r.campos.color_id),
    vin: normalizarVin(r.campos.vin) || null,
    cliente: r.campos.nombre || '', rut: r.campos.rut || null,
    telefono: r.campos.telefono || null, direccion: r.campos.direccion || null,
    origenIngresoNombre: t ? t.nombre : null,
    compania: nom('compania', b.compania_id) || '—',
    siniestro: b.siniestro || null,
    fechaIngreso: HOY,
    recepcion: {
      km: String(r.campos.km).trim() ? Number(r.campos.km) : null,
      combustible: r.campos.combustible,
      observaciones: r.campos.observaciones || ''
    },
    danos: r.danos.map((x) => ({
      zonaNombre: x.zonaNombre, vista: x.vista, zona: x.zona,
      severidad: x.severidad, x: x.x, y: x.y, trazo: x.trazo || null
    })),
    inventario: items.map((it) => {
      const cod = r.inventario[it.id] || 'sin_verificar';
      const e = estados.find((x) => x.codigo === cod) || estados[estados.length - 1];
      return { item: it.nombre, codigo: it.codigo, estado: e.codigo, estadoNombre: e.nombre,
               observacion: r.obsInventario[it.id] || '' };
    }),
    // Las fotos todavía no cuelgan de ninguna OT: van directo desde el borrador.
    fotosIngreso: r.fotos,
    // Y la firma, que tampoco está guardada: se resuelve del Blob del borrador
    // para que el papel que se revisa con el cliente sea el mismo que después
    // queda archivado, firma incluida.
    firmaSrc: r.firma ? URL.createObjectURL(r.firma) : null
  }), 'recepcion-borrador-' + (r.campos.patente || 'sin-patente'));
}

/* ── Guardar ───────────────────────────────────────────────────────────── */

function guardarRecepcion() {
  const r = rec();
  const faltan = recFaltantes();
  if (faltan.length) {
    r.paso = faltan[0].paso;
    return recRechazar(faltan);
  }

  const zonas = Modelo.zonasDano();

  const ficha = Object.assign({}, r.campos, {
    anio: r.campos.anio ? Number(r.campos.anio) : null,
    km: r.campos.km ? Number(r.campos.km) : null,
    combustible: Number(r.campos.combustible),
    // El checklist va como mapa `item_id → estado`, no como arreglo posicional:
    // así no depende del orden en que el catálogo devuelva los ítems.
    inventario: r.inventario, obsInventario: r.obsInventario,
    danos: r.danos.map((d) => ({
      vista: d.vista, severidad: d.severidad, x: d.x, y: d.y,
      descripcion: d.descripcion || '',
      // El trazo va junto con la zona: uno se dibuja, la otra se consulta.
      trazo: d.trazo || null,
      zona_id: (zonas.find((z) => z.codigo === d.zona) || {}).id || null,
      // Sin tipo: dejó de elegirse. La columna queda por si vuelve a pedirse.
      tipo_id: null
    })),
    demo: true
  });

  const bloques = r.bloques.map((b) => Object.assign({}, b, {
    deducible: b.deducible ? Number(b.deducible) : 0,
    compania_id: b.compania_id || null,
    responsable_id: b.responsable_id || null
  }));

  Promise.resolve().then(() => {
    const res = Modelo.crear_ot_desde_recepcion(ficha, bloques, r.llave);
    if (!res.ok) return avisar(res);

    // Las fotos se amarran a la recepción y a todas sus órdenes.
    Modelo.adjuntar_media(res.recepcion_id, res.ordenes.map((o) => o.ot_id), r.fotos);

    /* Y la firma del cliente, que va como un archivo más pero con su propio
       momento: el impreso la busca por ahí para estamparla en el comprobante. */
    if (r.firma) {
      Media.guardarBlob(r.firma, { momento: 'firma', nombre: 'firma-cliente.png',
        recepcion_id: res.recepcion_id })
        .then((f) => Modelo.adjuntar_media(res.recepcion_id,
          res.ordenes.map((o) => o.ot_id), [f]))
        .catch(() => { /* sin IndexedDB la firma no se guarda; la recepción sí */ });
    }

    /* 🔶 GUARDADA LA RECEPCIÓN SE VUELVE AL MENÚ, Y LIMPIO (15-08-2026).
       El cliente pidió primero volver al inicio del módulo, y después que la
       pantalla de confirmación no se mostrara: *"saca lo que marqué con X, que
       no muestre eso"*.

       Se descarta el formulario entero, no solo se cambia de pantalla: si se
       dejaran los campos cargados, el menú saldría con el cartel «hay un
       borrador a medio llenar» señalando una recepción que YA se guardó, y el
       recepcionista terminaría entrando a ver qué quedó a medias. */
    limpiarBorrador();
    rec().pantalla = 'menu';
    render();

    /* El número de OT viaja en el aviso. Es lo único del comprobante que el
       recepcionista necesita de verdad —lo anota en el papel y con eso busca
       después—, así que se dice en vez de mostrarse en una tabla. */
    const nombra = res.ordenes.map((o) => o.numero_ot).join(', ');
    avisar({ ok: true, motivo: '' },
      res.repetida
        ? 'Esta recepción ya estaba guardada: es la misma orden ' + nombra + ', no se creó otra.'
        : (res.ordenes.length === 1
            ? 'Recepción ingresada. Quedó la orden ' + nombra + '.'
            : 'Recepción ingresada. Quedaron las órdenes ' + nombra + ' desde un solo ingreso.'));
  });
}
