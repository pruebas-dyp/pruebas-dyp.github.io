/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   LAS PANTALLAS QUE CUELGAN DE UNA ORDEN — una sola lista, dos pantallas.

   Son las ocho del sistema actual, con su rótulo literal. Las mira la ficha de
   la OT y las mira el expandible de la Torre.

   🔴 POR QUÉ VIVE ACÁ Y NO COPIADA EN CADA UNA.

   Esta lista estaba dentro de `ficha.js`. Al pedir los mismos botones en la
   Torre, lo cómodo era copiarla — y ahí empieza el problema que le auditamos
   al sistema actual: **cuatro vocabularios distintos para la misma cosa**. Dos
   copias no se rompen el día que se copian; se rompen tres semanas después,
   cuando alguien agrega una pantalla en un lado y la otra sigue ofreciendo
   siete. El usuario ve dos menús distintos para la MISMA orden y no tiene
   forma de saber cuál está incompleto.

   Así que la lista es una, el permiso de cada entrada es uno, y lo único que
   cambia entre las dos pantallas es cómo se dibuja: la ficha las pinta como
   botones de texto —está adentro de la orden, son navegación— y la Torre como
   botones grandes con su icono, que es lo que muestra el original.

   ── Los destinos ────────────────────────────────────────────────────────

   `imprimir:` abre el documento · `vista:` navega al módulo parado en esa
   orden · `tab:` abre esa pestaña de la ficha · `tanda:` todavía no existe y
   el botón lo dice.

   La diferencia entre las dos pantallas está en `tab:`. En la ficha ya estamos
   DENTRO de la orden, así que cambia de pestaña. En la Torre estamos afuera,
   así que abre la orden ya parada en esa pestaña — `#ot=23489&tab=bitacora` —
   y no en la pestaña por omisión, que obligaría a buscarla a mano.
   ──────────────────────────────────────────────────────────────────────── */

const PANTALLAS_OT = [
  { rot: 'Ver recepción', icono: 'recepcion',
    imprimir: 'recepcion', permiso: 'ficha.completa' },

  /* El impreso del presupuesto es el documento comercial —cliente, RUT y
     valores—, así que pide `presupuesto.montos`. Quien solo tiene
     `presupuesto.ver` lee las líneas sin precio en la ficha. */
  { rot: 'Ver Presupuesto', icono: 'presupuesto',
    imprimir: 'presupuesto', permiso: 'presupuesto.montos' },

  { rot: 'Ver repuestos', icono: 'repuesto',
    tab: 'repuestos', permiso: 'repuesto.ver' },

  { rot: 'Ver/Subir Documentos o imágenes', icono: 'documento',
    vista: 'documentos', permiso: 'documento.ver' },

  { rot: 'Ver Fotografías', icono: 'camara',
    tab: 'fotos', permiso: 'foto.ver' },

  { rot: 'Editar Recepción', icono: 'editar',
    tab: null, tanda: 8, permiso: 'ot.editar',
    nota: 'la recepción se edita desde su propia pantalla; editar una ya guardada exige política de versiones' },

  { rot: 'Agregar OR', icono: 'nuevo',
    vista: 'presupuesto', permiso: 'presupuesto.crear' },

  /* ⚠️ `Bodega de esta orden` NO está en la referencia que mandó el cliente
     para la rejilla de la Torre, pero sí existe en la ficha desde antes. Se
     deja donde estaba y fuera de la Torre, en vez de agregarlo por simetría:
     inventar un botón que el cliente no pidió es tan malo como perder uno que
     sí. Queda como pregunta abierta 21. */
  { rot: 'Bodega de esta orden', icono: 'bodega',
    vista: 'bodega', permiso: 'repuesto.cargar', enTorre: false },

  { rot: 'Bitácora', icono: 'info',
    tab: 'bitacora', permiso: 'ficha.completa' }
];

/* Las que esta cuenta puede usar. Un botón sin permiso NO se dibuja apagado:
   no está. Es la misma regla que el menú lateral — apagarlo enseña que el
   sistema tiene cosas que no te tocan, y eso no le sirve a nadie. */
function pantallasOtDe(donde) {
  return PANTALLAS_OT.filter((l) => {
    if (donde === 'torre' && l.enTorre === false) return false;
    return !l.permiso || Modelo.puede(l.permiso);
  });
}

/* ── Abrir el documento de una orden ───────────────────────────────────
   🔴 CON VARIAS OR HAY QUE PREGUNTAR CUÁL. Lo levantó Marco el 16-08-2026:
   «¿cómo identificará qué PDF quiero abrir si la OT tiene más de un
   presupuesto?». Abría el ÚLTIMO sin decirlo, que es la peor de las
   respuestas: el que imprime cree que tiene el documento que pidió.

   Vive acá por la misma razón que la lista: lo usan la ficha y la Torre, y si
   cada una trae su copia, la próxima corrección se aplica en una sola. Con una
   sola OR se abre directo, que es el caso de todos los días. */
function abrirImpresoDeOT(tipo, o) {
  if (!o) return;
  if (tipo !== 'presupuesto' || o.presupuestos.length <= 1) return abrirImpreso(tipo, o.id);

  dialogo('¿Qué presupuesto quieres abrir?',
    '<p class="pie-nota" style="margin:0 0 10px">Esta orden tiene ' +
    o.presupuestos.length + ' documentos. Se abren en otra pestaña.</p>' +
    '<div class="grid-envoltorio"><table class="grid"><tbody>' +
    o.presupuestos.map((pr) => {
      const e = ESTADO_PRESUPUESTO[pr.estado] || { txt: pr.estado, clase: 'gris' };
      return '<tr><td><span class="cod">OR ' + esc(pr.numeroOR) + '</span></td>' +
        '<td><span class="et ' + esc(e.clase) + '">' + esc(e.txt) + '</span></td>' +
        '<td class="num">' + fMonto(pr.total) + '</td>' +
        '<td><button class="btn secundario chico" data-elegir-pr="' + esc(pr.id) + '">' +
        'Abrir</button></td></tr>';
    }).join('') + '</tbody></table></div>');

  (dialogo.ultimo || document).querySelectorAll('[data-elegir-pr]').forEach((x) =>
    x.addEventListener('click', () => {
      if (dialogo.cerrar) dialogo.cerrar();
      abrirImpreso('presupuesto', o.id, x.dataset.elegirPr);
    }));
}

/* ── La rejilla de botones grandes, para la Torre ─────────────────────── */

function rejillaPantallasOT(o) {
  const lista = pantallasOtDe('torre');
  if (!lista.length) return '';

  const boton = (l) => {
    const cuerpo = '<span class="aro">' + ico(l.icono, 'g') + '</span>' +
      '<span class="rot">' + esc(l.rot) + '</span>';

    // Todavía no construida: se dibuja y lo dice. Un botón que no hace nada y
    // no lo avisa es peor que no tenerlo.
    if (l.tanda) {
      return '<button class="pantalla-ot pendiente" data-ot-pendiente="' + esc(l.rot) +
        '|' + l.tanda + (l.nota ? '|' + esc(l.nota) : '') + '">' + cuerpo +
        '<span class="et gris">pendiente</span></button>';
    }
    if (l.imprimir) {
      return '<button class="pantalla-ot" data-ot-imprimir="' + esc(l.imprimir) +
        '" data-ot-num="' + esc(o.numeroOT) + '">' + cuerpo + '</button>';
    }
    if (l.tab) {
      return '<button class="pantalla-ot" data-ot-tab="' + esc(l.tab) +
        '" data-ot-num="' + esc(o.numeroOT) + '">' + cuerpo + '</button>';
    }
    return '<button class="pantalla-ot" data-ot-vista="' + esc(l.vista) +
      '" data-ot-num="' + esc(o.numeroOT) + '">' + cuerpo + '</button>';
  };

  return '<div class="pantallas-ot">' + lista.map(boton).join('') + '</div>';
}

/* ── Su cableado ──────────────────────────────────────────────────────── */

function pRejillaPantallasOT() {
  /* `stopPropagation` en los cuatro: la fila de la Torre abre la orden con
     doble clic, así que sin esto apretar dos veces un botón de la rejilla
     abriría además la ventana de la orden encima. */
  document.querySelectorAll('[data-ot-imprimir]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    abrirImpresoDeOT(b.dataset.otImprimir, Modelo.otPorNumero(b.dataset.otNum));
  }));

  // Acá está la diferencia con la ficha: se ABRE la orden en esa pestaña.
  document.querySelectorAll('[data-ot-tab]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    abrirFicha(b.dataset.otNum, b.dataset.otTab);
  }));

  /* El módulo se abre YA PARADO en esta orden, igual que desde la ficha: si
     llevara al listado habría que volver a buscar la patente teniendo el
     número de la orden en la mano. */
  document.querySelectorAll('[data-ot-vista]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    window.open('index.html#vista=' + encodeURIComponent(b.dataset.otVista) +
      '&ot=' + encodeURIComponent(b.dataset.otNum || ''), '_blank', 'noopener');
  }));

  document.querySelectorAll('[data-ot-pendiente]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    // El mismo texto que da la ficha para el mismo botón: son la misma lista,
    // así que tienen que decir lo mismo.
    const [rot, , nota] = String(b.dataset.otPendiente).split('|');
    avisar({ ok: false, motivo: '"' + rot + '" todavía no se construye' +
      (nota ? ': ' + nota : '') + '. El botón lo dice en vez de no hacer nada.' });
  }));
}
