/* ETIQUETA, TEMA, ROL Y ARRANQUE.

   La etiqueta de datos, el tema, quién mira, la barra lateral y el cajón del celular.

   ⚠️ Este archivo se carga SIEMPRE AL FINAL. Es el único que EJECUTA algo al cargar
   —monta el tema, retoma la sesión, pinta la primera pantalla— así que necesita que todo
   lo demás esté definido. Si se adelanta, el sistema arranca contra funciones que todavía
   no existen y no da error: da undefined.

   Detalle y decisiones: 00 Documentacion/DECISIONES.md · js/app.js */

/* ───────────── Etiqueta de datos ─────────────
   Pedido del cliente el 15-08-2026, en dos partes que son la misma cosa:
   pararse sobre la PATENTE y ver en qué etapa va, cuánto lleva presupuestado y
   si está o no en el taller; y pararse sobre la OR y ver el detalle de ese
   presupuesto sin abrir la orden. Su frase: "que el usuario tenga el detalle
   ahí mismo y no tenga que estar abriendo la OT".

   Por eso hay UNA sola etiqueta y no dos. Y todo lo que muestra sale del
   modelo, nunca del texto de la fila: si mañana se mueve una columna, la
   etiqueta sigue diciendo la verdad. */

/* Acepta el NÚMERO de la orden o su ID. No es capricho: la torre necesita el
   id en `data-ot` porque el expandible se abre por id, y el resto de los
   paneles usa el número. En vez de obligar a que todos digan lo mismo, se
   resuelven los dos acá. */
function ordenPorNumeroOId(clave) {
  const porNumero = buscarOT(clave);
  if (porNumero) return porNumero;
  return Modelo.torre().find((o) => o.id === clave) ||
         Modelo.historico({ todo: true }).find((o) => o.id === clave) || null;
}

function tarjetaDeOT(clave) {
  const o = ordenPorNumeroOId(clave);
  if (!o) return null;
  const e = o.etapa ? etapaPorCodigo(o.etapa) : null;
  const neto = o.presupuestos.reduce((s, p) => s + p.neto, 0);
  const pend = o.repuestos.filter((r) => !r.fechaBodega).length;

  const donde = o.fueraDeTaller
    ? '<span class="et ambar">Fuera del taller</span>'
    : '<span class="et verde">En el taller</span>';

  return {
    titulo: '<span class="patente">' + esc(o.patente) + '</span> &middot; OT ' + esc(o.numeroOT),
    filas: [
      ['Etapa', e ? '<i class="punto" style="background:' + e.color + '"></i>' + esc(e.nombre)
                  : '<span class="et gris">Pendiente</span>'],
      ['Dónde está', donde],
      ['Presupuestado', o.presupuestos.length
        ? fMonto(neto) + ' <span style="color:var(--gris-2)">neto · ' +
          o.presupuestos.length + (o.presupuestos.length === 1 ? ' OR' : ' OR') + '</span>'
        : '<span style="color:var(--gris-2)">Sin OR</span>'],
      ['Estado', '<span class="et ' + esc(o.estadoClase) + '">' + esc(o.estadoNombre) + '</span>'],
      ['Cliente', esc(o.cliente)],
      ['Compañía', o.compania === '—' ? '<span style="color:var(--gris-2)">Particular</span>'
                                      : esc(o.compania)],
      ['Días', o.diasKpi + ' de reparación <span style="color:var(--gris-2)">· ' +
        o.diasTotales + ' totales</span>'],
      ['Repuestos', pend ? '<span style="color:var(--rojo)">' + pend + ' por llegar</span>'
        : (o.repuestos.length ? 'Todos recibidos' : 'No requiere')]
    ]
  };
}

/* La clave puede ser el NÚMERO de OR o el id de un presupuesto concreto.
   Hace falta lo segundo desde que la fila desplegada muestra las versiones
   una debajo de otra: las versiones CONSERVAN la OR —es el mismo trabajo
   discutido de nuevo—, así que buscar por número devolvía siempre la v1 y el
   globo de la v2 mostraba los montos de la v1. Justo en la pantalla donde se
   elige qué documento abrir. */
function tarjetaDeOR(clave) {
  let orden = null, presu = null;
  Modelo.torre().concat(Modelo.historico({ todo: true })).some((o) => {
    const p = o.presupuestos.find((x) => x.id === clave) ||
              o.presupuestos.find((x) => String(x.numeroOR) === String(clave));
    if (p) { orden = o; presu = p; return true; }
    return false;
  });
  if (!presu) return null;

  /* Las piezas de ESTE presupuesto: las que nacieron de sus filas del bloque
     Repuestos. Se cruza por el id de la línea, que es el vínculo que bodega
     usa — no por descripción, que se repite entre versiones. */
  const suyas = {};
  (presu.lineas || []).forEach((l) => { if (l.bloque === 'repuesto') suyas[l.id] = true; });
  const pedidos = orden.repuestos.filter((r) => r.presupuestoLineaId && suyas[r.presupuestoLineaId]);
  const porLlegar = pedidos.filter((r) => !r.fechaBodega).length;

  return {
    titulo: 'OR ' + esc(presu.numeroOR),
    filas: [
      ['Vehículo', '<span class="patente">' + esc(orden.patente) + '</span> ' + esc(orden.marca || '')],
      ['Estado', '<span class="et">' + esc(presu.estado) + '</span>'],
      ['Neto', fMonto(presu.neto)],
      ['Total', '<strong>' + fMonto(presu.total) + '</strong>'],
      /* 🔶 REPUESTOS EN VEZ DE LÍNEAS Y FECHAS (16-08-2026, Marco). Las
         líneas y las dos fechas no cambian ninguna decisión al pasar el
         mouse; lo que sí la cambia es si ese trabajo depende de una pieza
         que todavía no llega. La cuenta sale de las filas del bloque
         Repuestos de ESTA OR, que son las que bajaron a bodega. */
      ['¿Necesita repuestos?', pedidos.length
        ? '<strong>Sí</strong>' : '<span style="color:var(--gris-2)">No</span>'],
      ['Repuestos solicitados', pedidos.length
        ? pedidos.length + (porLlegar ? ' <span class="et roja">' + porLlegar +
            ' por llegar</span>' : ' <span class="et verde">todos llegaron</span>')
        : '<span style="color:var(--gris-2)">—</span>']
    ],
    pie: 'Clic para abrir la OT ' + esc(orden.numeroOT),
    ot: orden.numeroOT
  };
}

/* La etiqueta es una sola y vive pegada al body: si se dibujara dentro de la
   tabla, el `overflow` del envoltorio la cortaría. */
function cajaEtiqueta() {
  let caja = document.getElementById('etiqueta-datos');
  if (!caja) {
    caja = document.createElement('div');
    caja.id = 'etiqueta-datos';
    caja.className = 'etiqueta-datos';
    document.body.appendChild(caja);
  }
  return caja;
}

function mostrarEtiqueta(el) {
  const dato = el.dataset.tip || '';
  const corte = dato.indexOf(':');
  if (corte < 0) return;
  const tipo = dato.slice(0, corte), clave = dato.slice(corte + 1);
  const t = tipo === 'or' ? tarjetaDeOR(clave) : tarjetaDeOT(clave);
  if (!t) return;

  const caja = cajaEtiqueta();
  caja.innerHTML = '<div class="tit">' + t.titulo + '</div>' +
    t.filas.map(([k, v]) => '<div class="fila"><span class="k">' + esc(k) +
      '</span><span class="v">' + v + '</span></div>').join('') +
    (t.pie ? '<div class="pie">' + esc(t.pie) + '</div>' : '');
  caja.classList.add('visible');

  // Se ubica al lado del elemento, y se corrige si se sale por el borde: en la
  // última columna de la tabla, una etiqueta fija se saldría de la pantalla.
  const r = el.getBoundingClientRect();
  const ancho = caja.offsetWidth, alto = caja.offsetHeight;
  let x = r.left, y = r.bottom + 6;
  if (x + ancho > window.innerWidth - 8) x = window.innerWidth - ancho - 8;
  if (y + alto > window.innerHeight - 8) y = r.top - alto - 6;
  caja.style.left = Math.max(8, x) + 'px';
  caja.style.top = Math.max(8, y) + 'px';
}

function ocultarEtiqueta() {
  const caja = document.getElementById('etiqueta-datos');
  if (caja) caja.classList.remove('visible');
}

/* Delegación: se engancha UNA vez al documento y sirve para todo lo que se
   pinte después, sin volver a cablear en cada render. */
let etiquetasEnchufadas = false;
function activarEtiquetas() {
  if (etiquetasEnchufadas) return;
  etiquetasEnchufadas = true;
  document.addEventListener('mouseover', (ev) => {
    const el = ev.target.closest('[data-tip]');
    if (el) mostrarEtiqueta(el);
  });
  document.addEventListener('mouseout', (ev) => {
    if (ev.target.closest('[data-tip]')) ocultarEtiqueta();
  });
  // Al desplazar la tabla la etiqueta quedaría flotando sobre otra fila.
  document.addEventListener('scroll', ocultarEtiqueta, true);
}

/* Marca lo que ya está pintado. Las patentes toman el número de OT de su
   propia fila —que salió del modelo al pintarla, no del texto— y las celdas de
   OR se marcan donde el panel las haya rotulado con `data-or`. */
function marcarEtiquetas() {
  activarEtiquetas();
  document.querySelectorAll('[data-ot] .patente').forEach((p) => {
    const fila = p.closest('[data-ot]');
    if (fila && fila.dataset.ot) p.dataset.tip = 'ot:' + fila.dataset.ot;
  });
  document.querySelectorAll('[data-or]').forEach((c) => {
    if (!c.dataset.or) return;
    c.dataset.tip = 'or:' + c.dataset.or;
    /* "Desde ahí se puede pinchar para ir al detalle". El clic va a la orden
       dueña de esa OR y no propaga: si propagara, la fila de abajo desplegaría
       su expandible al mismo tiempo. */
    if (c.dataset.orEnchufada) return;
    c.dataset.orEnchufada = '1';
    c.addEventListener('click', (ev) => {
      const t = tarjetaDeOR(c.dataset.or);
      if (!t) return;
      ev.stopPropagation();
      ocultarEtiqueta();
      abrirFicha(t.ot);
    });
  });
}

function modoRegistro(numero) {
  ui.registroOT = String(numero);
  document.body.classList.add('ventana-registro');
  pintarLogo();
  document.getElementById('usr').innerHTML = ico('usuario') + esc(quienMira());

  const o = buscarOT(numero);

  if (!o) {
    /* Dos motivos distintos para no poder abrirla, y hay que decir cuál es.
       "No existe" cuando alguien pega mal el número; "no es tuya" cuando la
       orden está pero el alcance del rol no la alcanza. Callarlo sería más
       cómodo y dejaría al pintor pensando que el sistema se rompió. */
    const ajena = Modelo.otFueraDeAlcance(numero);
    document.title = (ajena ? 'OT fuera de tu alcance' : 'OT no encontrada') + ' · Automotora DyP';
    document.getElementById('ruta').innerHTML = '<span>Torre de control</span>';
    document.getElementById('titulo').innerHTML = ico(ajena ? 'candado' : 'alerta', 'g') +
      (ajena ? 'Esta orden no está asignada a ti' : 'Orden de trabajo no encontrada');
    document.getElementById('bajada').textContent = '';
    document.getElementById('tabs').innerHTML = '';
    document.getElementById('herramientas').innerHTML =
      '<a class="hbtn primario" href="index.html">' + ico('torre') + 'Volver al sistema</a>';
    document.getElementById('contenido').innerHTML =
      '<div class="panel"><div class="cuerpo"><div class="vacio">' + ico(ajena ? 'candado' : 'buscar') +
      (ajena
        ? '<div class="titulo">La OT ' + esc(numero) + ' existe, pero no es tuya</div>' +
          '<div class="texto">El rol <strong>' + esc(Modelo.rolActual().nombre || '—') +
          '</strong> solo abre las órdenes que tiene tomadas o a su cargo. ' +
          'Si tienes que trabajar este vehículo, el jefe de taller te asigna la etapa y aparece en <strong>Mi trabajo</strong>.</div>'
        : '<div class="titulo">No existe la OT ' + esc(numero) + '</div>' +
          '<div class="texto">Puede que el número esté mal escrito o que la orden no esté en esta demostración.</div>') +
      '</div></div></div>';
    document.getElementById('estado-barra').innerHTML =
      '<span class="celda"><span class="luz"></span>Conectado</span><span class="celda">Automotora DyP</span>';
    return;
  }

  document.title = 'OT ' + o.numeroOT + ' · ' + o.patente + ' · Automotora DyP';
  document.getElementById('ruta').innerHTML =
    '<span>Operación diaria</span>' + ico('chevron') + '<span>Torre de control</span>' +
    ico('chevron') + '<span>OT ' + o.numeroOT + '</span>';
  document.getElementById('titulo').innerHTML = ico('torre', 'g') + 'Ficha de la orden de trabajo';
  document.getElementById('bajada').textContent =
    'Toda la información de esta orden en una sola pantalla. Esta pestaña tiene su propia dirección: se puede compartir.';
  // Las pestañas las pinta la ficha, que es la que sabe en cuál está.
  document.getElementById('tabs').innerHTML = '';

  // Nada de botones inertes: o llevan a alguna parte, o dicen en qué tanda se
  // construyen. Un botón que no hace nada y no lo dice es peor que no tenerlo.
  /* La barra se arma con lo que la cuenta puede hacer. Antes salían los diez
     botones siempre, y el pintor apretaba "Acta de entrega" para descubrir que
     no era para él. */
  const puede = (c) => Modelo.puede(c);
  const barra = ['<a class="hbtn primario" href="index.html">' + ico('torre') + 'Volver al sistema</a>',
    '<span class="sep"></span>',
    '<button class="hbtn" type="button" data-fichatab="etapas">' + ico('taller') + 'Etapas</button>'];
  if (puede('ficha.completa')) barra.push('<button class="hbtn" type="button" data-fichatab="bitacora">' + ico('info') + 'Bitácora</button>');
  if (puede('foto.ver')) barra.push('<button class="hbtn" type="button" data-fichatab="fotos">' + ico('camara') + 'Fotos</button>');
  const impresos = [];
  if (puede('ficha.completa')) impresos.push(['recepcion', 'Comprobante']);
  // El impreso del presupuesto lleva cliente, RUT y valores: pide `montos`,
  // no `ver`. Con `ver` se leen las líneas sin precio, en la ficha.
  if (puede('presupuesto.montos')) impresos.push(['presupuesto', 'Presupuesto']);
  if (puede('ficha.completa')) impresos.push(['ficha', 'Ficha completa'], ['entrega', 'Acta de entrega']);
  if (impresos.length) {
    barra.push('<span class="sep"></span>');
    impresos.forEach(([k, rot]) => barra.push('<button class="hbtn" type="button" data-imprimir="' + k + '">' +
      ico('imprimir') + rot + '</button>'));
  }
  // La ficha arma su propia barra: el rótulo va igual que en los paneles, y
  // desde el 16-08-2026 también abre las herramientas de la demostración.
  barra.push('<button class="hbtn der" type="button" data-demo-abrir="1" ' +
    'title="Las herramientas de la demostración: la guía, las pruebas y el calendario">' +
    ico('base') + 'Datos de demostración</button>');
  document.getElementById('herramientas').innerHTML = barra.join('');

  document.querySelectorAll('#herramientas [data-imprimir]').forEach((b) =>
    b.addEventListener('click', () => abrirImpreso(b.dataset.imprimir, o.id)));
  document.querySelectorAll('#herramientas [data-demo-abrir]').forEach((b) =>
    b.addEventListener('click', dialogoDemostracion));

  document.getElementById('contenido').innerHTML = vFichaOT(o);
  pFichaOT(o);
  pintarBarraEstado('OT <strong>' + o.numeroOT + '</strong> · ' + esc(o.patente));
}

/* La ficha de la orden, sus pestanas y sus acciones viven en
   js/vistas/ficha.js, y las dos pantallas de etapas en js/vistas/etapas.js */

/* ───────────────── Tema ───────────────── */

function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  const b = document.getElementById('btn-tema');
  /* Dos rótulos, uno largo y uno corto, y el CSS elige cuál se ve. En un
     celular «Tema oscuro» + «Cambiar mi clave» + «Cerrar sesión» no caben en
     la barra, y esconder un botón no es una opción: la regla de la casa es que
     ninguno se apaga. Se acorta. */
  if (b) b.innerHTML = '<span class="largo">' + (tema === 'oscuro' ? 'Tema oscuro' : 'Tema claro') +
    '</span><span class="corto">' + (tema === 'oscuro' ? 'Oscuro' : 'Claro') + '</span>';
  try { localStorage.setItem('dyp-tema', tema); } catch (e) { /* file:// sin almacenamiento */ }
  // Las marcas de daño se dibujan por JS: hay que repintarlas al cambiar de tema.
  if (ui.vista === 'recepcion') pintarDanos();
}

function montarTema() {
  const b = document.getElementById('btn-tema');
  if (!b) return;
  aplicarTema(document.documentElement.dataset.tema === 'claro' ? 'claro' : 'oscuro');
  b.addEventListener('click', () => {
    aplicarTema(document.documentElement.dataset.tema === 'oscuro' ? 'claro' : 'oscuro');
  });
}

/* ───────────────── Rol con el que se mira ─────────────────
   Cambiar de rol acá es lo que hace demostrable el enmascaramiento: el mismo
   dato desaparece o aparece según quién mire. Es el paso 26 del guion.

   ⚠️ Y hay que repetirlo cada vez: esto está MODELADO. En el navegador el
   dato igual llegó. La garantía es RLS en PostgreSQL. */

/* El selector de arriba a la derecha es la SESIÓN: con quién se entra al
   sistema. Cada persona trae su rol, y con el rol sus permisos y su menú.

   Antes era un selector de roles sueltos. Con eso se podía mostrar que el
   operario no ve los montos, pero no se podía mostrar lo importante: que el
   pintor entra y ve sus autos. Un rol no tiene autos; una persona sí. */
/* Arriba a la derecha va QUIÉN está usando el sistema, con su cargo, y la
   salida. Antes acá había un desplegable que cambiaba de persona sin pedir
   nada: con el ingreso ya construido eso sería una puerta trasera, así que
   para cambiar de usuario hay que cerrar sesión y volver a entrar. En una
   demostración cuesta dos clics, y a cambio lo que se muestra es cierto. */
function montarRol() {
  const cont = document.getElementById('usr');
  if (!cont) return;
  const yo = Modelo.personaActual();

  if (!yo) {
    cont.innerHTML = ico('usuario') + '<span style="font-size:11px;color:var(--gris)">Sin sesión</span>';
    return;
  }

  cont.innerHTML = ico('usuario') +
    '<span style="font-size:11px"><strong>' + esc((yo.nombres + ' ' + (yo.apellidos || '')).trim()) + '</strong>' +
    '<span style="color:var(--gris)"> · ' + esc(yo.cargo || Modelo.rolActual().nombre) + '</span></span>' +
    '<button type="button" id="btn-clave" style="margin-left:8px">' +
      '<span class="largo">Cambiar mi clave</span><span class="corto">Clave</span></button>' +
    '<button type="button" id="btn-salir" style="margin-left:6px">' +
      '<span class="largo">Cerrar sesión</span><span class="corto">Salir</span></button>';

  document.getElementById('btn-clave').addEventListener('click', dialogoMiClave);

  document.getElementById('btn-salir').addEventListener('click', () => {
    Modelo.cerrar_sesion();
    document.querySelectorAll('.velo, .velo-impreso, .desplegable').forEach((v) => v.remove());
    montarRol();
    pintarMenu();
    ir('torre');
    pantallaIngreso();
  });
}

/* Cambiar la propia clave, desde donde sea y con cualquier cuenta.

   Estaba solo dentro de Personal, que pide `personal.ver` — un permiso que hoy
   tienen dos de las seis cuentas. Y sin embargo el sistema le decía a todas, al
   entrar con la clave inicial, «conviene cambiarla en Personal → su ficha»:
   una instrucción imposible para la recepcionista, el pintor y bodega, que son
   justamente los que más la necesitan.

   La clave de uno no es un dato de administración: es de uno. Se pide la
   actual, así que nadie cambia la de otro ni aunque deje la sesión abierta. */
function dialogoMiClave() {
  const yo = Modelo.personaActual();
  if (!yo) return avisar({ ok: false, motivo: 'No hay ninguna sesión abierta.' });
  cerrarDialogos();

  const velo = document.createElement('div');
  velo.className = 'velo';
  velo.innerHTML =
    '<div class="dialogo" style="max-width:420px">' +
      '<div class="cab"><h2>' + ico('candado', 'g') + 'Cambiar mi clave</h2></div>' +
      '<div class="cuerpo">' +
        '<div class="dato"><span class="k">Cuenta</span><span class="v"><span class="cod">' +
          esc(yo.usuario || '—') + '</span></span></div>' +
        '<div class="dato"><span class="k">También sirve</span><span class="v">la ficha ' +
          esc(yo.ficha) + '</span></div>' +
        (yo.clave_inicial ? '<div class="nota" style="margin-top:9px">' + ico('alerta') +
          '<span>Esta cuenta todavía tiene la <strong>clave inicial</strong>, que está a la vista ' +
          'en la pantalla de ingreso.</span></div>' : '') +
        '<div class="rejilla-campos" style="margin-top:11px">' +
          '<div class="campo" style="grid-column:1/-1"><label>Clave actual</label>' +
            '<input type="password" id="mc-actual" autocomplete="current-password"></div>' +
          '<div class="campo" style="grid-column:1/-1"><label>Clave nueva</label>' +
            '<input type="password" id="mc-nueva" autocomplete="new-password">' +
            '<span class="ayuda">Mínimo 6 caracteres</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="pie">' +
        '<button class="btn secundario" id="mc-cancelar">Cancelar</button>' +
        '<button class="btn" id="mc-guardar">Cambiar la clave</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(velo);

  const cerrar = () => velo.remove();
  velo.addEventListener('click', (ev) => { if (ev.target === velo) cerrar(); });
  document.getElementById('mc-cancelar').addEventListener('click', cerrar);
  const campo = document.getElementById('mc-actual');
  campo.focus();

  document.getElementById('mc-guardar').addEventListener('click', () => {
    const r = Modelo.cambiar_clave(yo.id,
      document.getElementById('mc-actual').value,
      document.getElementById('mc-nueva').value);
    if (!r.ok) return avisar(r);
    cerrar();
    montarRol();
    avisar({ ok: true, motivo: '' }, 'Clave cambiada. La próxima vez entras con la nueva.');
  });
}

/* Qué permiso pide cada módulo para aparecer en el menú. Un operario que ve
   "Configuración" y al entrar no puede tocar nada aprende que el sistema le
   miente; mejor no ofrecérselo. Lo que no está acá lo ve cualquiera. */
const PERMISO_DE_MODULO = {
  // `mitrabajo` es el único sin permiso, y a propósito: solo muestra lo de
  // quien entró. Todo lo demás declara qué pide. Antes cinco pantallas no
  // declaraban nada y las veía cualquiera — un operario entraba al histórico
  // completo con los datos de todos los clientes.
  recepcion:     'ot.crear',
  // La bandeja del que revisa. Sin este permiso no hay nada que aceptar.
  porvalidar:    'etapa.validar',
  torre:         'torre.ver',
  taller:        'taller.ver',
  entrega:       'entrega.registrar',
  repuestos:     'repuesto.ver',
  detenidos:     'espera.ver',
  // El MÓDULO de presupuesto es para quien los arma. Ver las líneas dentro de
  // una orden es otra cosa y la gobierna `presupuesto.ver`, que el operario sí
  // tiene: ve qué hay que hacerle al auto, sin los valores.
  presupuesto:   'presupuesto.crear',
  bodega:        'repuesto.cargar',
  documentos:    'documento.ver',
  // El archivo de lo ya cerrado tiene permiso propio, aparte de la torre: es
  // donde están los datos de todos los clientes que pasaron por el taller, y
  // para trabajar el día de hoy no hace falta. Solo administración.
  historico:     'historico.ver',
  // El expediente muestra TODO de una orden: cliente, montos, bitácora y
  // archivos. Es exactamente lo que describe `ficha.completa`, así que pide ese
  // permiso y no uno nuevo. El pintor no lo tiene, y con razón: para cerrar su
  // etapa no necesita el historial de comunicaciones con la compañía.
  expediente:    'ficha.completa',
  personal:      'personal.ver',
  consolidado:   'consolidado.ver',
  configuracion: 'configuracion'
};

/* ───────────────── Arranque ───────────────── */

montarTema();
montarBarraMenu();
montarRol();

/* 🔷 SI LOS DATOS DE DEMOSTRACIÓN SE VOLVIERON A CARGAR, SE DICE (18-08-2026).
   Antes esto sólo salía por la consola del navegador, y ahí no lo lee nadie:
   la pantalla cambiaba sola —o peor, no cambiaba— sin ninguna explicación.
   Marco pasó un día viendo siete cuentas cuando el sistema ya traía
   diecinueve. El aviso va con retardo porque en este punto todavía no hay
   dónde pintarlo. */
setTimeout(() => {
  const porQue = Modelo.porQueSeResembro();
  if (porQue) avisar({ ok: true, motivo: '' }, porQue, { persistente: true });
}, 900);

/* Sin sesión no se ve nada. Se retoma la de antes —un F5 no puede echar a la
   recepcionista con el formulario a medio llenar— y si no hay, se pide entrar.

   🔴 Desde el 26-08-2026 no se retoma sólo la propia: una pestaña abierta con
   doble clic desde otra HEREDA la sesión de la que la abrió. El navegador a
   veces la copia solo y a veces no —de eso era el reclamo de Marco: cada
   pestaña nueva pedía entrar de nuevo—, así que ahora lo garantiza el sistema.
   El orden de búsqueda y sus candados están en `sesionDeEstaPestana`, en
   render.js, junto al `abrirNuestra` que deja el pase. */
const HAY_SESION = sesionDeEstaPestana();

if (!HAY_SESION) {
  pintarMenu();
  ir('torre');            // se dibuja el marco debajo, pero tapado
  pantallaIngreso();
} else if (PARAM_OT) {
  // La dirección trae una OT: esta pestaña es la ventana de ese registro.
  // Y puede pedir además en qué pestaña y en qué modo abrirla.
  fichaAplicarDireccion();
  modoRegistro(PARAM_OT);
} else {
  pintarMenu();
  // `#vista=bodega` abre el sistema directo en un módulo. Sirve para saltar
  // desde la ficha, que vive en su propia pestaña.
  const pedida = (function () {
    try { return new URLSearchParams(window.location.hash.replace(/^#/, '')).get('vista'); }
    catch (e) { return null; }
  })();
  /* El módulo con el que abre no puede ser «torre» a secas: hay cuentas que no
     entran ahí. Se abre en lo primero que su propio menú le ofrece. */
  ir(MENU.some((m) => m.id === pedida) ? pedida : primerModuloPermitido());
  pararEnLaOrden(leerDelAncla('ot'));
}

/* Un documento tiene dirección propia: `#impreso=presupuesto&ot=23330` lo abre
   solo, sin pasar por la ficha. Sirve para mandarle el presupuesto a alguien
   por enlace, y sirve para generar el PDF sin abrir el sistema a mano. */
(function () {
  const tipo = leerDelAncla('impreso');
  const ot = leerDelAncla('ot');
  if (!tipo || !ot || !IMPRESOS[tipo]) return;
  const o = Modelo.otPorNumero(ot);
  if (!o) return;
  abrirImpreso(tipo, o.id);
})();

function leerDelAncla(clave) {
  try { return new URLSearchParams(window.location.hash.replace(/^#/, '')).get(clave); }
  catch (e) { return null; }
}

/* Deja el módulo recién abierto parado en una orden concreta. Es lo que hace
   que desde la ficha se llegue de un clic a su presupuesto, su bodega o sus
   documentos, en vez de aterrizar en el listado y volver a buscar la patente
   que uno ya tenía en la mano. */
function pararEnLaOrden(numeroOT) {
  if (!numeroOT) return;
  const o = Modelo.otPorNumero(numeroOT);
  if (!o) return;
  switch (ui.vista) {
    case 'presupuesto':
      presuEstado().otId = o.id; presuEstado().presupuestoId = null; break;
    case 'bodega': {
      const b = bodegaEstado();
      b.pantalla = 'checklist'; b.patente = o.patente; b.otId = o.id; break;
    }
    case 'documentos':
      documentosEstado().otId = o.id; break;
    case 'entrega':
      ui.entrega = ui.entrega || {}; ui.entrega.patente = o.patente; ui.entrega.otId = o.id; break;
    default: return;
  }
  render();
}

/* Las pestañas se enteran unas de otras.

   El sistema se usa con varias pestañas abiertas: la torre en una y dos o tres
   órdenes en las suyas. Cada una carga su copia al abrirse, así que un
   presupuesto cargado en la pestaña A no aparecía en la pestaña B hasta
   recargar a mano — y desde adentro parecía que el sistema no guardaba.

   El navegador avisa del cambio con el evento `storage`, que llega solo a las
   OTRAS pestañas. Se relee y se repinta lo que esté a la vista. */
window.addEventListener('storage', (ev) => {
  /* 🔶 LA SESION YA NO VIAJA ENTRE PESTAÑAS, Y ES A PROPOSITO (22-08-2026).

     Acá había una rama que atendía el cambio de sesión: si en una pestaña se
     cerraba sesión o entraba otra persona, las demás se ponían al día. Vivía de
     que la sesión estuviera en `localStorage`, que es del navegador entero.

     Desde hoy la sesión está en `sessionStorage` —porque en `localStorage`
     sobrevivía a cerrar el navegador y el siguiente entraba como el anterior,
     sin clave—. `sessionStorage` es por pestaña y no emite este evento, así que
     esa rama no volvería a dispararse nunca: se saca en vez de dejarla ahí
     pareciendo que hace algo.

     Lo que se perdió: dos pestañas ya no comparten sesión. Lo que se ganó: cada
     pestaña tiene la suya, que es lo que corresponde. Los DATOS sí siguen
     viajando —eso es lo de abajo— y esa era la mitad que de verdad importaba.

     `Modelo.sesionGuardada()` y `sesionAlDia()` quedan exportadas sin llamador
     acá. No se tocan: las usa la comprobación de sesión del arranque. */
  if (ev.key !== Modelo.CLAVE) return;
  if (!Modelo.recargarDeDisco()) return;
  render();
});

/* Las teclas que la barra de herramientas promete. Si el botón dice F2, F2
   tiene que hacerlo: un atajo rotulado que no responde es lo mismo que un
   botón muerto. F5 no se intercepta a propósito — recarga el navegador, y como
   los datos viven en el equipo la pantalla vuelve igual. */
document.addEventListener('keydown', (ev) => {
  // Ctrl+Z deshace en cualquier pantalla, no solo donde está el botón: es la
  // tecla que la gente aprieta por reflejo cuando se equivoca.
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') {
    const escribiendo = /^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || '');
    if (escribiendo) return;           // ahí Ctrl+Z es del campo de texto
    ev.preventDefault();
    return accionModulo('deshacer');
  }
  if (ev.key !== 'F2') return;
  const m = MODULOS[ui.vista];
  if (!m) return;
  const conF2 = m.acciones.find((a) => a[3] === 'F2');
  if (!conF2) return;
  ev.preventDefault();
  accionModulo(conF2[2]);
});

/* Pegar la dirección de una orden en una pestaña que ya está abierta tiene que
   funcionar igual que abrirla desde la torre. Cambiar solo el ancla no recarga
   la página, así que hay que escucharlo a mano — si no, el enlace compartido
   parece roto para quien lo recibe. */
window.addEventListener('hashchange', function () {
  const leer = (clave) => {
    try { return new URLSearchParams(window.location.hash.replace(/^#/, '')).get(clave); }
    catch (e) { return null; }
  };
  const vista = leer('vista');
  const ot = leer('ot');
  if (ot && !vista) {
    /* Pegar el enlace de una orden en una pestaña YA ABIERTA no recarga nada:
       solo cambia el ancla. Hay que atender igual la pestaña y el modo que ese
       enlace pide, o el que lo recibe cae en un lugar distinto del que le
       mandaron y no hay forma de que lo sepa. */
    fichaAplicarDireccion();
    if (String(ot) !== String(ui.registroOT)) return modoRegistro(ot);
    return refrescarFicha();
  }
  if (vista && MENU.some((m) => m.id === vista)) {
    // Se venía de una ventana de registro: hay que devolverle el menú lateral.
    if (ui.registroOT) { ui.registroOT = null; document.body.classList.remove('ventana-registro'); pintarMenu(); }
    ir(vista);
    pararEnLaOrden(leer('ot'));
  }
});

/* Se revisa al entrar y cada cinco minutos. Cinco es a propósito: en una
   demostración se publica un ajuste y se quiere que el que está mirando lo
   sepa sin que nadie se lo diga por teléfono. */
revisarVersionPublicada();
setInterval(revisarVersionPublicada, 5 * 60 * 1000);

/* ── La barra lateral: plegar y angostar ────────────────────────────────
   Pedido de Marco el 16-08-2026 mirando la Torre de control: en el sistema
   actual la tabla de 17 columnas entra completa a zoom 100% porque ese
   sistema NO tiene barra lateral —el menú va arriba, en una franja—. Acá la
   barra se come 208px que a la tabla le hacen falta.

   Dos salidas, y las dos las conserva el navegador:

   · PLEGAR a iconos (46px). Recupera 162px y no muere nada: los diez módulos
     siguen visibles y a un clic, con el nombre en el globo. Esconder el menú
     entero habría sido peor — para cambiar de pantalla habría que abrirlo.

   · ANGOSTAR con el tirador del borde, y SÓLO angostar: entre 132 y los 208
     de partida. Textual: "uno pueda medir el ancho, pero solo de achicarlo
     desde lo que ya esta". Ensanchar no resuelve nada acá.

   Va en `localStorage` y no en la base: es una preferencia de ESTE
   computador, no un dato del taller. El de recepción puede quererla plegada
   y el de gerencia no, y ninguno de los dos está equivocado. */
const LATERAL_MAX = 208;
const LATERAL_MIN = 132;
const LATERAL_CLAVE = 'dyp.lateral';

function guardarLateral(estado) {
  try { localStorage.setItem(LATERAL_CLAVE, JSON.stringify(estado)); } catch (e) { /* modo privado */ }
}
function leerLateral() {
  try { return JSON.parse(localStorage.getItem(LATERAL_CLAVE) || '{}') || {}; } catch (e) { return {}; }
}

/* UNA sola fuente para el ancho: esta variable, escrita en el `body`.
   Primero lo resolvía a medias el CSS —una regla `body.lateral-plegado` con
   su propio ancho— y a medias el JS con una variable en `<html>`. La clase se
   aplicaba, el rótulo se escondía… y la barra seguía midiendo 208. Dos
   dueños del mismo número siempre terminan así. */
const LATERAL_PLEGADA = 46;

function aplicarLateral(estado) {
  const ancho = Math.min(LATERAL_MAX, Math.max(LATERAL_MIN, Number(estado.ancho) || LATERAL_MAX));
  document.body.style.setProperty('--ancho-lateral',
    (estado.plegado ? LATERAL_PLEGADA : ancho) + 'px');
  document.body.classList.toggle('lateral-plegado', !!estado.plegado);
  const b = document.getElementById('btn-plegar');
  if (b) {
    b.innerHTML = ico('chevron') + '<span class="rot">Contraer la barra</span>';
    b.title = estado.plegado ? 'Mostrar los nombres de los módulos'
                             : 'Contraer la barra a iconos y darle el ancho a la tabla';
    b.setAttribute('aria-label', b.title);
    b.setAttribute('aria-expanded', estado.plegado ? 'false' : 'true');
  }
}

function montarLateral() {
  const estado = leerLateral();
  aplicarLateral(estado);

  const boton = document.getElementById('btn-plegar');
  if (boton) boton.addEventListener('click', () => {
    const e = leerLateral();
    e.plegado = !e.plegado;
    guardarLateral(e);
    aplicarLateral(e);
  });

  const tirador = document.getElementById('tirador-lateral');
  const sidebar = document.getElementById('sidebar');
  if (!tirador || !sidebar) return;

  let arrastrando = false;
  const mover = (ev) => {
    if (!arrastrando) return;
    // El ancho es la distancia entre el borde izquierdo de la barra y el
    // puntero: así el borde va pegado al mouse y no se va quedando atrás.
    const x = ev.clientX - sidebar.getBoundingClientRect().left;
    const ancho = Math.min(LATERAL_MAX, Math.max(LATERAL_MIN, Math.round(x)));
    document.body.style.setProperty('--ancho-lateral', ancho + 'px');
    ev.preventDefault();
  };
  const soltar = () => {
    if (!arrastrando) return;
    arrastrando = false;
    document.body.classList.remove('arrastrando-lateral');
    const e = leerLateral();
    e.ancho = parseInt(document.body.style.getPropertyValue('--ancho-lateral'), 10) || LATERAL_MAX;
    guardarLateral(e);
    // Las tablas miden su ancho al pintarse: al cambiar el del área hay que
    // dejarlas recalcular, o las columnas quedan con el ancho de antes.
    if (typeof mejorarTablas === 'function') mejorarTablas();
  };

  tirador.addEventListener('mousedown', (ev) => {
    arrastrando = true;
    document.body.classList.add('arrastrando-lateral');
    ev.preventDefault();
  });
  document.addEventListener('mousemove', mover);
  document.addEventListener('mouseup', soltar);

  /* Doble clic en el tirador: vuelve al ancho de fábrica. Es la salida para
     quien la angostó de más y no sabe cuánto medía. */
  tirador.addEventListener('dblclick', () => {
    const e = leerLateral();
    e.ancho = LATERAL_MAX;
    guardarLateral(e);
    aplicarLateral(e);
  });
}

montarLateral();

/* ── EL CAJÓN DE MÓDULOS EN PANTALLA CHICA ─────────────────────────────
   🔴 EL PROBLEMA QUE ESTO RESUELVE (21-08-2026). El CSS escondía la barra
   lateral bajo los 860 px con un `display:none` y nada la reemplazaba. En un
   celular —y en una tablet vertical, que son 768— el sistema quedaba con UN
   módulo: el que se abría al entrar, y de ahí no se salía. No es que se viera
   mal: no se podía usar.

   Ahora la misma barra, sin duplicar nada, se corre a un cajón. Tres formas de
   cerrarlo, que es lo mínimo para que nadie quede atrapado: tocar un módulo,
   tocar el velo de al lado, o Escape.

   ⚠️ Lo que se cierra es una CLASE en el `body`, no un estilo escrito a mano.
   Escrito a mano hay que acordarse de deshacerlo en cada camino de salida —y
   siempre queda uno afuera—; con la clase, el CSS decide y los tres caminos
   hacen exactamente lo mismo. */
function montarCajonModulos() {
  const boton = document.getElementById('btn-nav');
  const velo = document.getElementById('velo-nav');
  const nav = document.getElementById('nav');
  if (!boton || !velo) return;

  const abierto = () => document.body.classList.contains('nav-abierta');
  const poner = (v) => {
    document.body.classList.toggle('nav-abierta', v);
    velo.hidden = !v;
    boton.setAttribute('aria-expanded', v ? 'true' : 'false');
    boton.setAttribute('aria-label', v ? 'Cerrar el menú de módulos' : 'Abrir el menú de módulos');
    /* Con el cajón abierto, el fondo NO se desplaza: en un teléfono, arrastrar
       sobre el velo movía la tabla de atrás y daba la sensación de que la
       aplicación se había roto. */
    document.body.classList.toggle('sin-desplazar', v);
  };

  boton.addEventListener('click', () => poner(!abierto()));
  velo.addEventListener('click', () => poner(false));
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && abierto()) { poner(false); boton.focus(); }
  });
  // Elegir un módulo cierra el cajón. Va por delegación: la lista se repinta
  // en cada render y un oyente por enlace se perdería en el primer repintado.
  if (nav) nav.addEventListener('click', (ev) => {
    if (ev.target.closest && ev.target.closest('a')) poner(false);
  });
  /* Al pasar a una pantalla ancha el cajón deja de existir. Si quedara la
     clase puesta, el `body` seguiría sin poder desplazarse en el escritorio y
     nadie ataría ese síntoma con haber girado el teléfono. */
  const ancha = window.matchMedia('(min-width: 861px)');
  const alGirar = (e) => { if (e.matches) poner(false); };
  if (ancha.addEventListener) ancha.addEventListener('change', alGirar);
  else if (ancha.addListener) ancha.addListener(alGirar);   // navegadores viejos
}

montarCajonModulos();

/* La sala compartida se enciende al final, cuando el modelo y las pantallas ya
   están en pie: al arrancar puede traer el estado de la sala y repintar, y para
   eso `render` tiene que existir. Si no hay internet, falla en silencio y el
   sistema queda como siempre estuvo, con los datos de este equipo. */
if (typeof Sala !== 'undefined') Sala.iniciar();
