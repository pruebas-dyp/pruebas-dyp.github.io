/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   CABLEADO, FIRMA, FOTOS Y COMPROBANTE

   Lo que ENGANCHA el formulario: los manejadores de cada campo, la firma del
   cliente, la zona de fotos y el comprobante que se muestra antes de guardar.

   Salio de su archivo el 22-08-2026 (COD-7), que pasaba las 1.500 lineas del
   umbral de la casa. No se movio ni una linea de logica: es corte y pegue.
   ─────────────────────────────────────────────────────────────────────── */

/* ── Cableado ──────────────────────────────────────────────────────────── */

function pRecepcion() {
  const r = rec();

  // La corrección de una recepción tiene su propio archivo y sus propios
  // enganches. Sale de acá derecho para no arrastrar los del formulario.
  if (r.pantalla === 'editar-ficha') return pRecepcionEditarFicha();

  /* El menú de cuatro opciones. Cada una lleva a algo que existe; la que el rol
     no puede usar se aprieta igual y dice quién sí puede. */
  /* Los dos botones del cartel del borrador. `Retomar` entra al formulario en
     el paso donde quedó —no en el primero: volver a recorrer cuatro pasos para
     llegar a lo que faltaba es exactamente lo que se vino a evitar—. */
  const retomar = document.getElementById('rec-retomar');
  if (retomar) retomar.addEventListener('click', () => { recEntrarAlFormulario(); render(); });
  const tirar = document.getElementById('rec-tirar');
  if (tirar) tirar.addEventListener('click', () => {
    const b = recBorradorEnCurso();
    if (!confirm('¿Descartar el ingreso a medio llenar' +
      (b && b.patente ? ' de la patente ' + b.patente : '') + '? ' +
      (b && b.fotos ? 'Las ' + b.fotos + ' fotos ya subidas se borran. ' : '') +
      'No se puede deshacer.')) return;
    limpiarBorrador(); render();
    avisar({ ok: true, motivo: '' }, 'Borrador descartado.');
  });

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

  /* El mismo `data-combo` viaja en dos controles distintos —el autocompletado
     del computador y el `select` del celular—, así que acá se bifurca igual que
     en los bloques de orden: un `select` avisa con `change` y su valor ya es el
     ID; un `input` avisa con `input` y hay que buscar el nombre en el catálogo. */
  document.querySelectorAll('[data-combo]').forEach((el) => {
    const esSelect = el.tagName === 'SELECT';
    el.addEventListener(esSelect ? 'change' : 'input', () => {
      const clave = el.dataset.combo;
      const antes = r.campos[clave];

      if (esSelect) {
        r.campos[clave] = el.value;
        // El texto escrito deja de tener sentido cuando se elige de una lista.
        r.textos[clave] = '';
      } else {
        r.textos[clave] = el.value;
        const t = el.value.trim().toLowerCase();
        const fila = filasDe(el.dataset.tabla).find((f) => String(f.nombre).toLowerCase() === t);
        r.campos[clave] = fila ? fila.id : '';
      }
      recDesmarcar(el, clave);
      // Cambiar de marca invalida el modelo elegido.
      if (clave === 'marca_id' && r.campos.marca_id !== antes) {
        r.campos.modelo_id = ''; r.textos.modelo_id = '';
      }
      guardarBorrador();

      /* El `select` repinta siempre: el de Modelo depende de la marca y hay que
         rearmar sus opciones. Y no se devuelve el foco con `recEnfocar`, que es
         para poner el cursor dentro de un texto: en una lista desplegable no
         hay cursor y forzar el foco vuelve a abrir la rueda del sistema. */
      if (esSelect) return render();
      const fila = filasDe(el.dataset.tabla).find(
        (f) => String(f.nombre).toLowerCase() === el.value.trim().toLowerCase());
      if (!!fila !== !!antes || clave === 'marca_id') { render(); recEnfocar(clave, el.value.length); }
    });
  });

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

    /* Dedos apoyados en este momento. Con dos o más el gesto es un acercamiento,
       no un rayón: se descarta el trazo empezado en vez de dejar una marca
       torcida cada vez que alguien hace pinza sobre el auto. */
    const dedos = new Set();
    const lienzo = svg.closest('.lienzo');
    const modoMover = () => !!(lienzo && lienzo.classList.contains('mover'));

    const punto = (ev) => {
      const caja = svg.getBoundingClientRect();
      return { x: Number(((ev.clientX - caja.left) / caja.width).toFixed(4)),
               y: Number(((ev.clientY - caja.top) / caja.height).toFixed(4)) };
    };

    /* Saca de la pantalla el trazo a medio hacer y olvida que existía. No toca
       `r.danos`: el daño se guarda recién al soltar, así que acá no hay nada
       que deshacer, sólo un dibujo que borrar. */
    const descartar = () => {
      if (vivo && vivo.parentNode) vivo.parentNode.removeChild(vivo);
      trazo = null; vivo = null;
    };

    svg.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType === 'touch') dedos.add(ev.pointerId);
      // En modo mover el lienzo no dibuja, y tampoco se traga el gesto: sin
      // `preventDefault` el navegador puede desplazar y acercar con libertad.
      if (modoMover()) return;
      if (dedos.size > 1) return descartar();   // segundo dedo = está acercando
      ev.preventDefault();
      try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* no siempre se puede */ }
      trazo = { puntos: [punto(ev)] };
      vivo = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      vivo.setAttribute('class', 'trazo-dano');
      document.getElementById('marcas').appendChild(vivo);
    });

    svg.addEventListener('pointermove', (ev) => {
      if (!trazo) return;
      // Un dedo que aparece a mitad del trazo también es una pinza.
      if (dedos.size > 1) return descartar();
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
    /* El dedo que se levanta deja de contar para la pinza. Se hace acá y no
       dentro de `soltar` porque `soltar` también se llama sin evento. */
    const levantar = (ev) => { if (ev && ev.pointerId != null) dedos.delete(ev.pointerId); soltar(); };
    svg.addEventListener('pointerup', levantar);
    svg.addEventListener('pointerleave', levantar);
    svg.addEventListener('pointercancel', (ev) => {
      if (ev && ev.pointerId != null) dedos.delete(ev.pointerId);
      descartar();     // el navegador se llevó el gesto: no era un daño
    });

    /* El interruptor de modo. Cambia una clase y nada más: quién puede dibujar
       lo decide el CSS con `touch-action`, que es lo único que el navegador
       respeta de verdad para soltar o retener el gesto táctil. */
    const btnModo = document.getElementById('dano-modo');
    if (btnModo && lienzo) btnModo.addEventListener('click', () => {
      descartar();
      const mover = !lienzo.classList.contains('mover');
      lienzo.classList.toggle('mover', mover);
      btnModo.textContent = mover ? 'Volver a marcar' : 'Mover y acercar';
      btnModo.setAttribute('aria-pressed', mover ? 'true' : 'false');
      btnModo.classList.toggle('activo', mover);
      avisar({ ok: true, motivo: '' }, mover
        ? 'Modo mover: desplaza y acerca con los dedos. El auto no se raya.'
        : 'Modo marcar: cada trazo sobre el auto es un daño.');
    });

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

/* 🔴 IR A UN PASO CUALQUIERA, RESPETANDO LA REGLA (31-08-2026).

   Las pastillas numeradas ya la respetaban; el botón «Agregar fotos» de la
   barra no, y aterrizaba en el paso 4 con los campos del 1 en blanco. Marco lo
   vio. Esto es la misma comprobación que hacen las pastillas, en un solo lugar,
   para que el próximo botón que quiera saltar a un paso la herede.

   Devuelve `true` si llegó y `false` si rechazó — quien llama necesita saberlo
   para no seguir haciendo cosas sobre un paso al que no se llegó. */
function recIrAlPaso(id) {
  const r = recEntrarAlFormulario();
  const j = RECEPCION_PASOS.findIndex((x) => x.id === id);
  if (j < 0) return false;
  if (!recAlcanzable(j)) {
    const faltan = [];
    RECEPCION_PASOS.slice(0, j).forEach((x) => faltan.push.apply(faltan, recFaltantesDe(x.id)));
    /* Se deja a la persona en el primer paso que le falta algo, no en el que
       quiso alcanzar: ahí es donde tiene que escribir. */
    if (faltan.length) r.paso = faltan[0].paso;
    guardarBorrador();
    recRechazar(faltan);
    return false;
  }
  r.paso = id; r.marcados = [];
  guardarBorrador(); render();
  return true;
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

/* ── ACÁ VIVÍA EL LIENZO DE FIRMA ─────────────────────────────────

   🔴 27-08-2026. Se eliminó entero: `montarFirma`, `repintarFirma`, el sello
   que descartaba los PNG atrasados y los dos botones. El comprobante se imprime
   y se firma a mano, que es como trabajan en el mesón. Ver el comentario largo
   en `recepcion-pasos.js`.

   Se borra en vez de dejarse apagado por lo de siempre: código que no corre
   nadie lo mantiene, y el día que alguien lo despierte va a estar hablando de
   un campo —`firma_media_id`— que tampoco existe ya. */

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
    fotosIngreso: r.fotos
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
