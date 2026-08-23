/* NUEVO INGRESO — la pantalla más rica del sistema.

   Cinco pasos, con el orden que pidió el cliente el 15-08-2026. Es la única que NO se
   puede probar en el sistema actual sin meter un vehículo real al taller.

   Detalle y decisiones: 00 Documentacion/DECISIONES.md · js/vistas/recepcion.js */

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
/* ¿Pantalla de dedo? El `datalist` de más abajo funciona en un computador, pero
   en Android y en iOS **casi no se despliega**: sólo sugiere mientras se
   escribe, así que el recepcionista toca «Marca», no pasa nada, y concluye que
   está roto. Reportado desde el celular el 22-08-2026.

   En esas pantallas se pinta un `select` nativo, que abre la rueda del sistema
   operativo y se maneja con el pulgar. En escritorio se conserva el
   autocompletado, que ahí sí sirve y además deja escribir para filtrar. */
function recTactil() {
  try {
    // El dispositivo apuntador manda: si el principal es un dedo, es táctil,
    // mida lo que mida la ventana.
    if (window.matchMedia('(pointer: coarse)').matches) return true;
    /* El ancho es sólo el respaldo, y **se exige que sea mayor que cero**: una
       pestaña en segundo plano informa `innerWidth = 0`, y sin este resguardo un
       computador de escritorio quedaba clasificado como celular y perdía el
       autocompletado. Salió probando el 22-08-2026. */
    const w = window.innerWidth;
    return w > 0 && w <= 860;
  } catch (e) { return false; }   // navegador sin matchMedia: queda el de siempre
}

function recCombo(clave, rotulo, filas, tabla, opciones) {
  const o = opciones || {};
  const r = rec();
  const sel = filas.find((f) => String(f.id) === String(r.campos[clave]));

  /* La versión de dedo. Va antes que todo lo demás porque no comparte nada con
     el autocompletado: acá el valor del control es el ID de la fila, no su
     nombre escrito, así que no hay «texto que no calza con el catálogo» ni
     botón de crear. Quien tenga que agregar una marca lo hace en Configuración,
     que además es lo que pidió el cliente el 15-08-2026. */
  if (recTactil()) {
    const obligaT = REC_OBLIGATORIOS.some(([c]) => c === clave);
    const vacio = o.apagado ? (o.marcador || 'Primero la marca') : 'Elige ' + rotulo.toLowerCase();
    return '<div class="campo' + (recMarcado(clave) ? ' falta' : '') + '"><label>' + esc(rotulo) +
      (obligaT ? ' <span style="color:var(--rojo)">*</span>' : '') + '</label>' +
      '<select data-combo="' + clave + '" data-tabla="' + esc(tabla) + '"' +
        (o.apagado ? ' disabled' : '') + '>' +
        '<option value="">' + esc(vacio) + '</option>' +
        filas.map((f) => '<option value="' + esc(f.id) + '"' +
          (String(f.id) === String(r.campos[clave]) ? ' selected' : '') + '>' +
          esc(f.nombre) + '</option>').join('') +
      '</select>' +
      '<span class="ayuda">' + esc(o.ayuda || (sel ? '✓ ' + sel.nombre : '')) + '</span></div>';
  }


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
