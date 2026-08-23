/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   LOS CINCO PASOS DEL INGRESO

   Lo que se dibuja en cada paso del formulario de recepcion: cliente,
   vehiculo, solicitud de reparacion, estado descriptivo y verificar.

   Salio de su archivo el 22-08-2026 (COD-7), que pasaba las 1.500 lineas del
   umbral de la casa. No se movio ni una linea de logica: es corte y pegue.
   ─────────────────────────────────────────────────────────────────────── */

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
        <span class="ayuda">${recTactil()
          ? 'Un dedo raya · dos dedos acercan. Cada trazo es un daño.'
          : 'Raya sobre el auto con el dedo o el mouse. Cada trazo es un daño.'}</span>
        <span style="display:flex;gap:6px;flex-wrap:wrap">
          ${/* 🔴 El interruptor de modo (22-08-2026). En el celular el dedo tenía
               un solo significado —rayar— y no había forma de desplazar la
               página desde encima del dibujo sin dejar una marca. Acá el
               recepcionista dice qué está haciendo, y mientras esté en «Mover»
               el lienzo no acepta ni un trazo. */''}
          <button class="btn secundario" id="dano-modo" aria-pressed="false">Mover y acercar</button>
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
    <div class="pie-nota">Dejó de ser un sí/no. <strong>Sin verificar no es lo mismo que no presente</strong>:
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
