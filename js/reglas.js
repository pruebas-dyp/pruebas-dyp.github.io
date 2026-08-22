/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   LAS REGLAS DE NEGOCIO. Funciones puras: reciben la base y los parámetros,
   devuelven { ok, motivo }. No tocan el DOM, no mutan nada, no dependen de
   ninguna vista.

   Están escritas así a propósito: cada una se traduce casi 1:1 a un
   constraint o un trigger de PostgreSQL cuando el sistema pase a producción.

   REGLA DE ORO: ninguna de estas se aplica deshabilitando un botón. El botón
   se puede apretar siempre; la regla rechaza y explica el motivo. Si el
   usuario no entiende por qué no puede hacer algo, el sistema falló.

   ── Qué cambió respecto de la versión anterior, y por qué ────────────────

   1 · NADA QUEMADO. Antes esta misma constante decidía el destino de una
       orden:  ESTADOS_TERMINALES = ['entregado','perdida_total','rechazado'].
       Era exactamente el defecto que le auditamos al sistema actual, cometido
       por nosotros. Ahora los estados salen del catálogo `estado` y quien
       decide es su booleano, editable desde Configuración.

   2 · TRES RELOJES, NO DOS. Ver `calcularRelojes`. En la reunión se pidió que al
       reingresar el cronómetro "vuelva a cero" (grabación [00:34:58]); el
       levantamiento mostró que hoy se reinicia solo con regrabar el estado,
       que es otra cosa y es un defecto. Los dos números conviven y CUÁL de
       ellos es el KPI es un parámetro de negocio, no una decisión nuestra.

   3 · PRECEDENCIA Y REPUESTOS, APAGADAS. No sabemos si esas reglas existen
       en el sistema actual (preguntas 1 y 3, sin confirmar). Están construidas y
       apagadas: se encienden por etapa desde Configuración, sin tocar código.
   ──────────────────────────────────────────────────────────────────────── */

const Reglas = (function () {

  const MS_DIA = 86400000;

  const ok = () => ({ ok: true, motivo: '' });
  const no = (motivo) => ({ ok: false, motivo });

  const dias = (desde, hasta) => Math.max(0, Math.round((hasta - desde) / MS_DIA));

  /* ── Parámetros de negocio ─────────────────────────────────────────────
     Viven en la tabla `parametro`, no en constantes. La meta de días y cuál
     de los dos relojes de reparación se mide contra ella se editan desde
     Configuración. */

  function parametro(db, clave, porDefecto) {
    const p = db.parametro && db.parametro.find((x) => x.clave === clave);
    return p ? p.valor : porDefecto;
  }

  const metaDias = (db) => Number(parametro(db, 'meta_dias_reparacion', 15));

  // 'acumulado'      → el reloj se REANUDA: suma todas las estadías dentro.
  // 'estadia_actual' → el reloj VUELVE A CERO en cada reingreso (lo que pidió
  //                    en la reunión). Los dos se calculan siempre; esto elige
  //                    cuál se mide contra la meta.
  const kpiReparacion = (db) => parametro(db, 'kpi_reparacion', 'acumulado');

  /* ── Catálogo de estados ───────────────────────────────────────────────
     Dos booleanos, y son cosas distintas. Hay que no confundirlos:

     · es_final     → decide TORRE vs HISTÓRICO. Es la regla más limpia del
                      sistema actual: el filtro del Histórico ofrece exacta-
                      mente los cinco estados marcados así (reglas §C.8).
     · cierra_orden → decide si la orden admite cambios. "Esa vez se cerró
                      como rechazado y tengo que reingresar el vehículo."

     ⚠️ No coinciden, y ahí hay una pregunta abierta:
     `Rechazado` está marcado ESTADO INICIAL en el maestro real —o sea sigue
     en la Torre— pero él dijo que un rechazo cierra la orden para siempre.
     Con un solo booleano eso no se puede expresar. Con dos, sí, y la
     contradicción queda visible en vez de resuelta a dedo. */

  const estadoPorCodigo = (db, c) => db.estado.find((e) => e.codigo === c);

  function esFinal(db, codigo) {
    const e = estadoPorCodigo(db, codigo);
    return !!(e && e.es_final);
  }

  function cierraOrden(db, codigo) {
    const e = estadoPorCodigo(db, codigo);
    return !!(e && e.cierra_orden);
  }

  // "Está viva en la Torre" = su estado NO es final. Nada más.
  const estaAbierta = (db, codigo) => !esFinal(db, codigo);

  // "No admite cambios" — es lo que antes se llamaba terminal.
  const esTerminal = (db, codigo) => cierraOrden(db, codigo);

  const nombreEstado = (db, codigo) => {
    const e = estadoPorCodigo(db, codigo);
    return e ? e.nombre : codigo;
  };

  /* ── Utilidades de consulta ───────────────────────────────────────────── */

  const otPorId = (db, id) => db.orden_trabajo.find((o) => o.id === id);
  const etapaPorId = (db, id) => db.etapa.find((e) => e.id === id);
  const etapaPorCodigo = (db, c) => db.etapa.find((e) => e.codigo === c);

  // Etapas efectivamente ASIGNADAS a una OT. Las que no se asignaron no
  // existen para esta orden: no bloquean a nadie ni cuentan como pendientes.
  const etapasAsignadas = (db, ot_id) => db.ot_etapa.filter((x) => x.ot_id === ot_id);

  const etapaAsignada = (db, ot_id, etapa_id) =>
    db.ot_etapa.find((x) => x.ot_id === ot_id && x.etapa_id === etapa_id);

  const repuestosPendientes = (db, ot_id) =>
    db.repuesto.filter((r) => r.ot_id === ot_id && !r.fecha_bodega);

  const estadiaAbierta = (db, ot_id) =>
    db.ot_estadia.find((e) => e.ot_id === ot_id && !e.salio_at);

  const detencionAbierta = (db, ot_id) =>
    db.ot_detencion.find((d) => d.ot_id === ot_id && !d.fin);

  /* ── Regla 1 · Una patente, una orden abierta ──────────────────────────
     "Una patente puede usarse varias veces, pero no puede tener dos órdenes
      al mismo tiempo. Tiene que terminar una salida para que vuelva a usarse."
     En PostgreSQL: índice único parcial sobre orden_trabajo(vehiculo_id)
     donde el estado no sea final. */

  function puedeCrearOT(db, { vehiculo_id, excepto_ot_id }) {
    const abierta = db.orden_trabajo.find((o) =>
      o.vehiculo_id === vehiculo_id && estaAbierta(db, o.estado) && o.id !== excepto_ot_id);
    if (abierta) {
      const v = db.vehiculo.find((x) => x.id === vehiculo_id);
      return no('La patente ' + (v ? v.patente : '') + ' ya tiene la orden ' +
        abierta.numero_ot + ' abierta (' + nombreEstado(db, abierta.estado) + '). ' +
        'Hay que cerrarla antes de volver a ingresar el vehículo.');
    }
    return ok();
  }

  /* ── Reglas 2 a 5 · Asignar y finalizar etapas ─────────────────────────
     2 · Se asignan varias etapas a la vez y en cualquier orden. Verificado:
         Preparación y Pintura se cerraron en el mismo segundo.
     3 · Las etapas que no se asignaron no bloquean a nadie.
     4 · PRECEDENCIA — configurable, APAGADA por defecto. No sabemos si la
         regla existe en el sistema actual: en pantalla no hay ni rastro y
         comprobarlo exigía escribir en una orden real. Pregunta 1, sin confirmar.
     5 · REPUESTOS COMPLETOS — igual: configurable y apagada. Pregunta 3. */

  function puedeAsignarEtapa(db, { ot_id, etapa_id }) {
    const orden = otPorId(db, ot_id);
    if (!orden) return no('La orden de trabajo no existe.');
    if (esTerminal(db, orden.estado))
      return no('La orden ' + orden.numero_ot + ' está cerrada como ' +
        nombreEstado(db, orden.estado) + ' y no admite cambios.');
    if (!estadiaAbierta(db, ot_id))
      return no('La orden ' + orden.numero_ot + ' no está en el taller. ' +
        'Hay que registrar el reingreso antes de asignar etapas.');
    if (!etapaPorId(db, etapa_id)) return no('La etapa no existe en el catálogo.');
    if (etapaAsignada(db, ot_id, etapa_id))
      return no('Esa etapa ya está asignada a la orden ' + orden.numero_ot + '.');
    return ok();
  }

  function puedeFinalizarEtapa(db, { ot_id, etapa_id }) {
    const orden = otPorId(db, ot_id);
    if (!orden) return no('La orden de trabajo no existe.');
    if (esTerminal(db, orden.estado))
      return no('La orden ' + orden.numero_ot + ' está cerrada como ' +
        nombreEstado(db, orden.estado) + ' y no admite cambios.');

    const etapa = etapaPorId(db, etapa_id);
    if (!etapa) return no('La etapa no existe en el catálogo.');

    const asignada = etapaAsignada(db, ot_id, etapa_id);
    if (!asignada)
      return no('La etapa ' + etapa.nombre + ' no está asignada a la orden ' +
        orden.numero_ot + '. Primero hay que asignarla.');
    if (asignada.salio_at)
      return no('La etapa ' + etapa.nombre + ' ya está finalizada.');

    // Regla 4 · Solo si esta etapa tiene la precedencia ENCENDIDA, y solo
    // pesan los prerrequisitos que además estén asignados a esta orden.
    if (etapa.exige_precedencia) {
      const faltantes = db.etapa_prerrequisito
        .filter((p) => p.etapa_id === etapa_id)
        .map((p) => etapaAsignada(db, ot_id, p.requiere_etapa_id))
        .filter((x) => x && !x.salio_at)
        .map((x) => etapaPorId(db, x.etapa_id).nombre);

      if (faltantes.length)
        return no('No se puede finalizar ' + etapa.nombre + ': antes hay que cerrar ' +
          faltantes.join(' y ') + '.');
    }

    // Regla 5 · Repuestos completos, donde esté encendida.
    if (etapa.requiere_repuestos_completos) {
      const pend = repuestosPendientes(db, ot_id);
      if (pend.length)
        return no('No se puede finalizar ' + etapa.nombre + ': falta por llegar ' +
          pend.map((r) => r.descripcion).join(', ') + '.');
    }

    return ok();
  }

  /* ── Regla 6 · Los TRES relojes ────────────────────────────────────────

     Acá está la corrección que justifica el proyecto, y también la
     contradicción que hay que poner sobre la mesa.

     · dias_totales        desde el ingreso. NUNCA se reinicia. Es el número
                           que mira la aseguradora y el dueño del auto.
     · dias_reparacion     suma de todo el tiempo DENTRO del taller. El reloj
                           se detiene al salir y SE REANUDA al reingresar.
     · dias_estadia_actual desde el último reingreso. VUELVE A CERO. Es lo que
                           se pidió en la reunión: "el taller mide el tiempo de
                           reparación, que no debe ser superior a 15 días".
     · dias_fuera          el complemento: totales − reparación.

     Los cuatro salen de `ot_estadia`, que es una tabla de HECHOS CON FECHA.
     Ninguno se calcula desde el estado, y por eso ninguno se puede reiniciar
     regrabando el estado — que es el defecto medido en 8 órdenes reales del
     sistema actual, todas con el evento 'Recibido' a 'Recibido'. */

  function calcularRelojes(db, ot_id, hoy) {
    const vacio = { dias_totales: 0, dias_reparacion: 0, dias_estadia_actual: 0, dias_fuera: 0, dias_kpi: 0, sobre_meta: false };
    const orden = otPorId(db, ot_id);
    if (!orden) return vacio;

    const ref = orden.fecha_entrega_real || hoy;
    const dias_totales = dias(orden.fecha_ingreso, ref);

    const estadias = db.ot_estadia
      .filter((e) => e.ot_id === ot_id)
      .sort((a, b) => a.entro_at - b.entro_at);

    // Tiempo dentro = suma de los tramos. Un tramo abierto cuenta hasta ref.
    const dias_reparacion = estadias.reduce(
      (s, e) => s + dias(e.entro_at, e.salio_at && e.salio_at < ref ? e.salio_at : ref), 0);

    const abierta = estadias.find((e) => !e.salio_at);
    const ultima = estadias[estadias.length - 1];

    let dias_estadia_actual = 0;
    if (abierta) dias_estadia_actual = dias(abierta.entro_at, ref);
    else if (esFinal(db, orden.estado) && ultima) dias_estadia_actual = dias(ultima.entro_at, ultima.salio_at);
    // Si no hay estadía abierta y la orden sigue viva, el vehículo está fuera
    // del taller: el reloj de reparación está detenido y el actual, en cero.

    const dias_fuera = Math.max(0, dias_totales - dias_reparacion);
    const dias_kpi = kpiReparacion(db) === 'estadia_actual' ? dias_estadia_actual : dias_reparacion;

    return {
      dias_totales, dias_reparacion, dias_estadia_actual, dias_fuera, dias_kpi,
      sobre_meta: dias_kpi > metaDias(db)
    };
  }

  /* ── Regla 7 · La salida y el reingreso son hechos con fecha ───────────
     No un estado que se pisa. `Fecha de salida` existe en la ficha del
     sistema actual y está vacía incluso en órdenes ya entregadas. */

  function puedeRegistrarSalida(db, { ot_id }) {
    const orden = otPorId(db, ot_id);
    if (!orden) return no('La orden de trabajo no existe.');
    if (esTerminal(db, orden.estado))
      return no('La orden ' + orden.numero_ot + ' está cerrada como ' +
        nombreEstado(db, orden.estado) + '.');
    if (!estadiaAbierta(db, ot_id))
      return no('La orden ' + orden.numero_ot + ' ya está fuera del taller. ' +
        'No se puede registrar una salida sin haber reingresado antes.');
    return ok();
  }

  function puedeRegistrarReingreso(db, { ot_id }) {
    const orden = otPorId(db, ot_id);
    if (!orden) return no('La orden de trabajo no existe.');
    if (esTerminal(db, orden.estado))
      return no('La orden ' + orden.numero_ot + ' está cerrada como ' +
        nombreEstado(db, orden.estado) + '.');
    if (estadiaAbierta(db, ot_id))
      return no('La orden ' + orden.numero_ot + ' ya está dentro del taller.');
    return ok();
  }

  /* ── Regla 8 · Estados finales inmutables ──────────────────────────────
     Y la contracara: REGRABAR UN ESTADO NO ES UN CAMBIO DE ESTADO. Es la
     corrección central. En el sistema actual, volver a grabar 'Recibido'
     sobre 'Recibido' reinicia el contador de días. Acá no pasa nada: ni un
     evento, ni un contador movido. */

  function puedeCambiarEstado(db, { ot_id, nuevo_estado }) {
    const orden = otPorId(db, ot_id);
    if (!orden) return no('La orden de trabajo no existe.');
    if (esTerminal(db, orden.estado))
      return no('La orden ' + orden.numero_ot + ' se cerró como ' +
        nombreEstado(db, orden.estado) + ' y eso no se edita. ' +
        'Si cambió la situación, hay que reingresar el vehículo con una orden nueva.');
    if (!estadoPorCodigo(db, nuevo_estado))
      return no('El estado "' + nuevo_estado + '" no existe en el catálogo.');
    if (orden.estado === nuevo_estado)
      return no('La orden ' + orden.numero_ot + ' ya está en ' + nombreEstado(db, nuevo_estado) +
        '. Regrabar el mismo estado no cambia nada, y sobre todo no mueve ningún contador.');
    return ok();
  }

  /* ── Regla 9 · Bodega solo opera sobre órdenes vivas ───────────────────
     "Se obliga al bodeguero a cargar sí o sí mientras el auto está en el
      taller, porque yo no puedo facturar teniendo un pendiente."
     OJO: vale para las órdenes VIVAS, estén el auto dentro o fuera. Cuando
     el vehículo está en casa del cliente esperando la pieza es justamente
     cuando más se reciben repuestos. */

  function puedeCargarRepuesto(db, { ot_id }) {
    const orden = otPorId(db, ot_id);
    if (!orden) return no('La orden de trabajo no existe.');
    if (!estaAbierta(db, orden.estado))
      return no('La orden ' + orden.numero_ot + ' ya no está en la torre de control (' +
        nombreEstado(db, orden.estado) + '). Bodega solo carga repuestos sobre órdenes ' +
        'abiertas: después de cerrada no se puede facturar un pendiente.');
    return ok();
  }

  /* ── Regla 10 · Repuesto pendiente ≠ fuera de taller ────────────────────
     Son dimensiones independientes. En los datos reales: 41 órdenes con
     repuestos pendientes contra 10 fuera del taller. No hay regla que
     prohibir; hay una confusión que evitar, y por eso son dos consultas
     distintas y no una. */

  const tieneRepuestoPendiente = (db, ot_id) => repuestosPendientes(db, ot_id).length > 0;
  const estaFueraDeTaller = (db, ot_id) => !estadiaAbierta(db, ot_id);

  /* ── Regla 11 · La OR es compuesta ─────────────────────────────────────
        23488-18382-001
          │      │     └── correlativo de la OR dentro de esa reparación
          │      └──────── id de la reparación
          └─────────────── número de OT
     "El presupuesto genera el apellido de la OT." El correlativo es POR
     ORDEN, no global: la versión anterior devolvía un consecutivo único
     para todo el sistema y eso no reproduce el formato real. */

  /* La OR SIN el correlativo final. Pedido del cliente el 15-08-2026: antes
     era `23368-18868-001` y ahora es `23368-18868`.

     ⚠️ Esto se APARTA de la réplica y hay que decirlo: la OR compuesta con sus
     tres partes es lo que muestra el sistema actual —verificado en pantalla, la
     de repuestos titula "Repuestos Presupuesto Orden N° 23488-18382-001"—. En
     `DECISIONES-REPLICA` estaba clasificada como Igual y pasa a Corregido.

     Lo que hacía el correlativo era distinguir las VERSIONES de un mismo
     presupuesto. Sacándolo, la OR identifica la reparación y las versiones la
     comparten, que además calza mejor con la regla del propio cliente: el
     presupuesto se versiona, no se edita, y las versiones son del mismo
     trabajo. La versión se muestra aparte, que es donde corresponde.

     El campo `correlativo` se sigue guardando en la fila. No se muestra, pero
     al migrar hay presupuestos ya enviados a las compañías con el número viejo
     impreso, y sin él no habría cómo reconstruirlo. */
  function formatoOR(numero_ot, id_reparacion) {
    return String(numero_ot) + '-' + String(id_reparacion);
  }

  function siguienteCorrelativoOR(db, ot_id, id_reparacion) {
    const previos = db.presupuesto.filter(
      (p) => p.ot_id === ot_id && String(p.id_reparacion) === String(id_reparacion));
    return previos.reduce((m, p) => Math.max(m, Number(p.correlativo) || 0), 0) + 1;
  }

  /* Desde que la OR no lleva correlativo, sus VERSIONES la comparten a
     propósito: son el mismo trabajo. Lo que no puede pasar es abrir un
     presupuesto nuevo sobre una reparación que ya tiene uno — eso es
     versionarlo, y hay una operación para eso. */
  function numeroORDisponible(db, numero_or) {
    return db.presupuesto.some((p) => p.numero_or === numero_or)
      ? no('La OR ' + numero_or + ' ya existe para esta reparación. Un presupuesto no se ' +
           'reemplaza con otro: se crea la versión siguiente, y la anterior queda intacta.')
      : ok();
  }

  /* ── Regla 12 · Alertas ────────────────────────────────────────────────
     Cada mensaje de bitácora enciende la bandera de su asunto, y la letra es
     la inicial del asunto. Descifrado sobre las 102 órdenes: E(nvio) 91,
     A(utorizado) 81, O(tro) 72, R(epuestos) 3, C(orrecciones) 1.

     ⚠️ Cómo se APAGAN no se pudo observar en el sistema actual ("las alertas
     se van mueriendo"). Queda como regla configurable por asunto y como
     pregunta 6, todavía sin confirmar. */

  function alertasDe(db, ot_id) {
    const asuntos = db.asunto_bitacora;
    const msjs = db.bitacora.filter((b) => b.ot_id === ot_id);
    return asuntos
      .filter((a) => a.genera_alerta && msjs.some((m) => m.asunto_id === a.id && !m.alerta_apagada))
      .sort((a, b) => a.orden - b.orden)
      .map((a) => ({ letra: a.nombre.charAt(0).toUpperCase(), asunto: a.nombre }));
  }

  function puedeEscribirBitacora(db, { ot_id, asunto_id, mensaje }) {
    const orden = otPorId(db, ot_id);
    if (!orden) return no('La orden de trabajo no existe.');
    if (!db.asunto_bitacora.some((a) => a.id === asunto_id))
      return no('El asunto no existe en el catálogo. La bitácora no acepta asuntos escritos a mano.');
    if (!mensaje || !String(mensaje).trim())
      return no('El mensaje de bitácora no puede ir vacío.');
    return ok();
  }

  /* ── Regla 13 · Detenciones ────────────────────────────────────────────
     ⚠️ Esto NO existe en el sistema actual: no hay motivos de detención ni
     imputabilidad en ninguna de las 39 pantallas. Queda modelado y sin
     pantalla propia; es desarrollo nuevo y se cotiza aparte. */

  function puedeAbrirDetencion(db, { ot_id, motivo_id }) {
    const orden = otPorId(db, ot_id);
    if (!orden) return no('La orden de trabajo no existe.');
    if (esTerminal(db, orden.estado))
      return no('La orden ' + orden.numero_ot + ' está cerrada y no admite detenciones.');
    if (detencionAbierta(db, ot_id))
      return no('La orden ' + orden.numero_ot + ' ya tiene una detención abierta. ' +
        'Hay que cerrarla antes de registrar otra.');
    if (!db.motivo_detencion.some((m) => m.id === motivo_id))
      return no('El motivo de detención no existe en el catálogo.');
    return ok();
  }

  function puedeCerrarDetencion(db, { ot_id }) {
    if (!detencionAbierta(db, ot_id))
      return no('La orden no tiene ninguna detención abierta.');
    return ok();
  }

  /* ── Regla 14 · Los catálogos ──────────────────────────────────────────
     Esto es lo que se pidió al decir "escalable": poder agregar
     una etapa, un estado o una compañía sin llamar a un programador. Y su
     contracara, que es igual de importante: no poder borrar algo que está
     en uso, ni guardar dos veces el mismo código.

     El sistema actual falla en las dos puntas. No tiene alta —las etapas y
     los asuntos están escritos en el HTML— y no tiene integridad: el filtro
     del Histórico muestra 19 compañías para 7 aseguradoras reales, con
     CARDIF escrito de cuatro formas y el nombre de una persona guardado
     como compañía. */

  // Dónde se usa cada catálogo. Es la tabla que hace posible el "no se puede
  // borrar porque está en uso" sin escribir una función por catálogo.
  const USOS = {
    etapa:            [['ot_etapa', 'etapa_id'], ['persona_etapa', 'etapa_id'],
                       ['etapa_prerrequisito', 'etapa_id'], ['etapa_prerrequisito', 'requiere_etapa_id'],
                       ['media', 'etapa_id']],
    estado:           [['orden_trabajo', 'estado', 'codigo']],
    compania:         [['orden_trabajo', 'compania_id']],
    motivo_detencion: [['ot_detencion', 'motivo_id']],
    prioridad:        [['orden_trabajo', 'prioridad_id']],
    color_vehiculo:   [['vehiculo', 'color_id']],
    tipo_ingreso:     [['orden_trabajo', 'tipo_ingreso_id']],
    asunto_bitacora:  [['bitacora', 'asunto_id']],
    responsable_pago: [['repuesto', 'responsable_pago_id']],
    inventario_item:  [['recepcion_inventario', 'item_id']],
    marca:            [['vehiculo', 'marca_id'], ['modelo', 'marca_id']],
    // El modelo faltaba: sin esto su marca de uso salía siempre en «sin uso» y
    // se podía eliminar un modelo que tiene autos en el taller.
    modelo:           [['vehiculo', 'modelo_id']]
  };

  function usosDeFila(db, tabla, fila) {
    const refs = USOS[tabla] || [];
    let total = 0;
    refs.forEach(([t, col, porCampo]) => {
      const valor = porCampo ? fila[porCampo] : fila.id;
      if (!db[t]) return;
      total += db[t].filter((f) => f[col] === valor).length;
    });
    return total;
  }

  function puedeGuardarCatalogo(db, tabla, fila, { esNuevo }) {
    if (!db[tabla]) return no('El catálogo "' + tabla + '" no existe.');
    if (!fila.nombre || !String(fila.nombre).trim())
      return no('El nombre es obligatorio.');

    /* Un modelo cuelga de una marca, siempre. Sin ella no se ofrece en ningún
       combo de Recepción: queda cargado en la base y no existe para nadie, que
       es peor que no haberlo creado. La pantalla manda la marca sí o sí —el
       desplegable siempre trae una elegida—, pero la regla va en el motor, que
       es por donde también entran las cargas masivas. */
    if (tabla === 'modelo' && esNuevo && !fila.marca_id)
      return no('El modelo tiene que colgar de una marca.');
    if (fila.codigo !== undefined) {
      const cod = String(fila.codigo || '').trim();
      if (!cod) return no('El código es obligatorio: es lo que amarra la llave foránea.');
      const choque = db[tabla].find((f) =>
        String(f.codigo).toLowerCase() === cod.toLowerCase() && f.id !== fila.id);
      if (choque)
        return no('Ya existe "' + choque.nombre + '" con el código ' + choque.codigo + '. ' +
          'Una sola fuente por concepto: así es como el sistema actual terminó con ' +
          'CARDIF, CADIF, CARDF y CDIF conviviendo.');
    }
    if (esNuevo && db[tabla].some((f) =>
      String(f.nombre).trim().toLowerCase() === String(fila.nombre).trim().toLowerCase()))
      return no('Ya existe un registro llamado "' + String(fila.nombre).trim() + '" en este catálogo.');
    return ok();
  }

  function puedeEliminarCatalogo(db, tabla, id) {
    if (!db[tabla]) return no('El catálogo "' + tabla + '" no existe.');
    const fila = db[tabla].find((f) => f.id === id);
    if (!fila) return no('El registro no existe.');
    const usos = usosDeFila(db, tabla, fila);
    if (usos)
      return no('"' + fila.nombre + '" está en uso en ' + usos +
        (usos === 1 ? ' registro' : ' registros') + ' y no se puede eliminar. ' +
        'Se da de baja: deja de ofrecerse en los formularios y el histórico se sigue leyendo bien.');
    return ok();
  }

  function puedeDarDeBajaCatalogo(db, tabla, id) {
    const fila = (db[tabla] || []).find((f) => f.id === id);
    if (!fila) return no('El registro no existe.');
    if (!fila.vigente) return no('"' + fila.nombre + '" ya está dado de baja.');
    return ok();
  }

  /* Precedencias: no se puede exigir una etapa a sí misma, ni armar un ciclo.
     Un ciclo deja el taller trabado sin que nadie entienda por qué. */
  function puedeAgregarPrerrequisito(db, { etapa_id, requiere_etapa_id }) {
    if (etapa_id === requiere_etapa_id)
      return no('Una etapa no puede ser prerrequisito de sí misma.');
    const a = etapaPorId(db, etapa_id), b = etapaPorId(db, requiere_etapa_id);
    if (!a || !b) return no('Alguna de las dos etapas no existe.');
    if (db.etapa_prerrequisito.some((p) => p.etapa_id === etapa_id && p.requiere_etapa_id === requiere_etapa_id))
      return no(b.nombre + ' ya es prerrequisito de ' + a.nombre + '.');

    // Búsqueda en profundidad: ¿se llega desde `requiere` de vuelta a `etapa`?
    const visto = new Set();
    const hayCamino = (desde, hasta) => {
      if (desde === hasta) return true;
      if (visto.has(desde)) return false;
      visto.add(desde);
      return db.etapa_prerrequisito
        .filter((p) => p.etapa_id === desde)
        .some((p) => hayCamino(p.requiere_etapa_id, hasta));
    };
    if (hayCamino(requiere_etapa_id, etapa_id))
      return no('Eso arma un círculo: ' + a.nombre + ' ya es prerrequisito de ' + b.nombre +
        ', directa o indirectamente. Ninguna de las dos se podría cerrar nunca.');
    return ok();
  }

  /* ── Regla 15 · Idempotencia ───────────────────────────────────────────
     Doble clic en cualquier botón que cree algo no crea dos. Se resuelve con
     una llave de operación, no con deshabilitar el botón: si el usuario
     aprieta dos veces, la segunda devuelve lo mismo que la primera. */

  function operacionYaHecha(db, llave) {
    return db.operacion.some((o) => o.llave === llave);
  }

  /* ── Presupuesto · el proveedor y la aritmética ────────────────────────
     Reconstruido desde la OR 23505-18401-001 del sistema real (PDF que trajo
     Marco el 16-08-2026). Las cifras de ese documento cuadran al peso con
     esta fórmula, y por eso vive acá y no en la vista: es la regla, no la
     pantalla.

     UNA línea de mano de obra puede cobrar en las TRES columnas —una puerta
     se repara Y se pinta— y cada columna es horas × tempario. El impreso
     agrupa por COLUMNA (Desmontar y montar · Reparar · Pintar), no por
     operación, que es lo que hacía ver el original como tres tablas
     distintas cuando en realidad es una sola con tres tiempos. */

  /* El proveedor del repuesto decide si se cobra. En el sistema actual es
     texto libre y el mismo taller aparece escrito «DYP», «Dyp», «dyp» y
     «DyP» —cuatro proveedores distintos para el buscador y para cualquier
     suma—. Acá se normaliza: si dice D&P en cualquier forma, es el taller.
     Textual de Marco: «que debiese ser DYP, Dyp, dyp DyP y no mas». */
  const PROVEEDOR_TALLER = 'DYP';
  function normalizarProveedor(txt) {
    const t = String(txt == null ? '' : txt).trim();
    if (!t) return '';
    // d y p · d&p · dyp · d-p, con o sin espacios y en cualquier caja.
    if (/^d\s*[y&\-]?\s*p$/i.test(t)) return PROVEEDOR_TALLER;
    return t;
  }
  const esProveedorTaller = (txt) => normalizarProveedor(txt) === PROVEEDOR_TALLER;

  /* Lo compró el taller → se le cobra al cliente. Lo puso la compañía → el
     taller no desembolsó nada y no lo cobra; la pieza igual queda registrada
     con su precio de referencia, que es lo que el original perdía al
     escribir $0 en el papel. */
  function cobroRepuesto(linea) {
    const bruto = (Number(linea.cantidad) || 0) * (Number(linea.precio_unitario) || 0);
    return esProveedorTaller(linea.proveedor) ? bruto : 0;
  }

  const horasDe = (l) => ({
    dm:   Number(l.horas_dm)   || 0,
    rep:  Number(l.horas_rep)  || 0,
    pint: Number(l.horas_pint) || 0
  });

  /* Los totales del presupuesto, en el mismo orden y con los mismos nombres
     del documento que firma la compañía. `deducible` viene de la ORDEN, no
     del presupuesto: es lo que la póliza descuenta, y se resta del neto
     antes del IVA. */
  /* Los tres bloques se separan por `bloque`, no por la OP. La OP clasifica
     el TRABAJO de una linea de mano de obra —cambiar, reparar o mandar
     afuera— y no dice nada sobre la lista de compras: Repuestos y Externos se
     escriben a mano, fila por fila. Corregido el 16-08-2026 con el sistema
     real a la vista. */
  const esManoObra = (l) => (l.bloque || 'mano_obra') === 'mano_obra';
  const esRepuesto = (l) => l.bloque === 'repuesto';
  const esExterno  = (l) => l.bloque === 'externo';

  function totalesPresupuesto(lineas, tempario, deducible, ivaPct) {
    const ls = lineas || [];
    const tarifa = Number(tempario) || 0;
    const h = { dm: 0, rep: 0, pint: 0 };
    ls.filter(esManoObra).forEach((l) => {
      const x = horasDe(l);
      h.dm += x.dm; h.rep += x.rep; h.pint += x.pint;
    });
    const dm = Math.round(h.dm * tarifa);
    const reparar = Math.round(h.rep * tarifa);
    const pintar = Math.round(h.pint * tarifa);
    const manoObra = dm + reparar + pintar;

    const repuestos = ls.filter(esRepuesto).reduce((s, l) => s + cobroRepuesto(l), 0);
    const tot = ls.filter(esExterno)
      .reduce((s, l) => s + (Number(l.precio_unitario) || 0), 0);

    const subtotalNeto = manoObra + repuestos + tot;
    const ded = Math.min(Number(deducible) || 0, subtotalNeto);

    /* 🔴 EL NETO ES LO QUE VALE EL TRABAJO, sin descontar el deducible.
       Lo descontaba, y desde que el deducible salió del documento (16-08-2026)
       eso dejó dos totales distintos para la misma OR: la lista mostraba $0
       —el deducible de $100.000 se comía un trabajo de $53.800— y el PDF
       mostraba $64.022. Marco lo vio de inmediato: «la información no está
       fluyendo».

       El que estaba mal era este. Un presupuesto cotiza lo que cuesta
       reparar; quién paga cada parte —la compañía o el cliente con su
       deducible— es una conversación posterior y no cambia el valor del
       trabajo. Además, restándolo, la venta parada del taller salía menos
       de lo que realmente hay presupuestado.

       `deducible` se sigue devolviendo: la ficha del siniestro lo muestra. */
    const neto = subtotalNeto;
    const iva = Math.round(neto * (Number(ivaPct) || 0) / 100);
    return {
      horas: h, tempario: tarifa,
      dm, reparar, pintar, manoObra,
      repuestos, tot, subtotalNeto,
      deducible: ded, neto, iva, total: neto + iva
    };
  }

  return {
    // parámetros
    parametro, metaDias, kpiReparacion,
    // estados
    estadoPorCodigo, esFinal, cierraOrden, estaAbierta, esTerminal, nombreEstado,
    // consultas
    dias, otPorId, etapaPorId, etapaPorCodigo,
    etapasAsignadas, etapaAsignada, repuestosPendientes, estadiaAbierta, detencionAbierta,
    tieneRepuestoPendiente, estaFueraDeTaller, alertasDe,
    // reglas
    puedeCrearOT,
    puedeAsignarEtapa, puedeFinalizarEtapa,
    calcularRelojes,
    puedeRegistrarSalida, puedeRegistrarReingreso,
    puedeCambiarEstado,
    puedeCargarRepuesto,
    puedeEscribirBitacora,
    puedeAbrirDetencion, puedeCerrarDetencion,
    // OR
    formatoOR, siguienteCorrelativoOR, numeroORDisponible,
    // presupuesto
    PROVEEDOR_TALLER, normalizarProveedor, esProveedorTaller, cobroRepuesto,
    esManoObra, esRepuesto, esExterno,
    horasDe, totalesPresupuesto,
    // catálogos
    USOS, usosDeFila,
    puedeGuardarCatalogo, puedeEliminarCatalogo, puedeDarDeBajaCatalogo,
    puedeAgregarPrerrequisito,
    // idempotencia
    operacionYaHecha
  };
})();
