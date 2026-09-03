/* LAS REGLAS DE NEGOCIO. Funciones puras: reciben la base y los parámetros, devuelven
   { ok, motivo }. No tocan el DOM, no mutan nada, no dependen de ninguna vista.

   Escritas así a propósito: cada una se traduce casi 1:1 a una restricción de la base.

   Detalle y decisiones: 00 Documentacion/DECISIONES.md · js/reglas.js */

const Reglas = (function () {

  const MS_DIA = 86400000;

  const ok = () => ({ ok: true, motivo: '' });
  const no = (motivo) => ({ ok: false, motivo });

  /* 🔴 DIAS DE CALENDARIO, NO HORAS REDONDEADAS (30-08-2026).

     Antes era `Math.round((hasta - desde) / MS_DIA)`, o sea las horas
     transcurridas redondeadas. Dos problemas, y el segundo es el que importa:

       · No calzaba con su sistema. Un auto que entro el 27 mostraba 2 el dia 30
         y su Torre mostraba 3. Marco lo vio poniendo las dos pantallas al lado.

       · EL NUMERO CAMBIABA SOLO DURANTE EL DIA. Un auto que entro a las 17:26
         mostraba 2 en la manana y 3 en la tarde, sin que pasara nada. En una
         pantalla que mide el cumplimiento contra una meta de dias, un numero
         que se mueve solo no se puede discutir con nadie.

     Se cuenta como lo cuenta el taller: dias de calendario entre las dos
     fechas, sin la hora. El auto que entro ayer lleva un dia, entrara a la hora
     que entrara. */
  /* 🔴 UN «2026-08-30» PELADO ES UTC, NO CHILE (30-08-2026).

     `hoyEnChile()` devuelve el dia como TEXTO, `2026-08-30`. Y
     `new Date('2026-08-30')` no es la medianoche de aca: la norma dice que una
     fecha sin hora se lee como UTC, y en Chile eso son las 20:00 del dia
     ANTERIOR. Con `setHours(0,0,0,0)` encima quedaba el 29, y las 92 ordenes
     mostraban un dia menos que su Torre.

     Un texto `AAAA-MM-DD` se arma a mano con sus tres numeros, que es la unica
     forma de que sea la medianoche local y no la de Greenwich. */
  const aMedianoche = (d) => {
    if (typeof d === 'string') {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
      if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
    }
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  };
  const dias = (desde, hasta) =>
    Math.max(0, Math.round((aMedianoche(hasta) - aMedianoche(desde)) / MS_DIA));

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

  /* ¿Puede alguien tomar una etapa que nadie le asignó? Por omisión NO: el
     reparto es del que asigna. Decisión de Marco del 22-08-2026. */
  const autoAsignacion = (db) => parametro(db, 'auto_asignacion', 'no') === 'si';

  /* ¿Una etapa terminada tiene que pasar por el visto bueno de alguien?
     Por omision SI: terminar no es cerrar. */
  const exigeValidacion = (db) => parametro(db, 'validar_termino', 'si') === 'si';

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

  /* 🔴 ¿SE EDITA ESTE PRESUPUESTO? (27-08-2026, Marco: «lo mismo con el
     presupuesto, no pasa por aprobación de nadie. La cuestión se envía pero de
     que se puede editar, se puede editar»).

     Había SEIS candados repartidos por el motor —uno en cada función que
     escribe— y los seis decían lo mismo: «está enviado y no se edita, hay que
     crear una versión nueva». Eso es una política de aprobación, y en este
     taller no existe: se manda el presupuesto por correo, la compañía contesta
     por teléfono, y se corrige el mismo documento.

     La regla que SÍ manda es la de siempre y no es de aprobación: mientras la
     ORDEN esté abierta se edita; cerrada la orden —entregada o rechazada— no se
     toca nada, igual que todo lo demás del sistema.

     ⚠️ LO QUE SE PIERDE, y queda dicho: hasta hoy el sistema podía mostrar
     EXACTAMENTE lo que se le mandó a la compañía —quedaba congelado y los
     cambios iban a una versión nueva—. Desde ahora, si alguien corrige un
     presupuesto ya enviado, el documento cambia y no queda copia de lo
     anterior. «Crear versión nueva» sigue estando para quien quiera esa foto;
     ya no es obligatorio. */
  function presupuestoEditable(db, presupuesto) {
    if (!presupuesto) return { ok: false, motivo: 'El presupuesto no existe.' };
    const o = db.orden_trabajo.find((x) => x.id === presupuesto.ot_id);
    if (!o) return { ok: false, motivo: 'La orden de este presupuesto no existe.' };
    if (esTerminal(db, o.estado))
      return { ok: false, motivo: 'La orden ' + o.numero_ot + ' está cerrada: el vehículo ya salió ' +
        'del taller y su presupuesto no se toca.' };
    return { ok: true, motivo: '' };
  }

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

  /* ── Regla 11 · La OR nace con la OT ─────────────────────────────
     🔴 26-08-2026, Marco, después de la visita en terreno: «la OR se le debe
     asignar automáticamente una vez que se genere la OT. Actualmente se genera
     a través del presupuesto pero eso estaba mal».

     Lo que había: la OR era compuesta —`23368-18868`, número de OT más un id de
     reparación— y se armaba al CREAR EL PRESUPUESTO. Dos consecuencias que en
     terreno se vieron mal:

       · una orden sin presupuesto no tenía OR, y el taller la necesita antes;
       · la OR no era un correlativo, era una cuenta sobre el número de OT.

     Ahora la OR es un CORRELATIVO PROPIO, igual que la OT: 19810, 19811, 19812.
     Sale del parámetro `correlativo_or` y se asigna en el mismo momento en que
     nace la orden. Cada OT tiene una y sólo una; las versiones del presupuesto
     la comparten, porque son el mismo trabajo.

     ⚠️ SE FUERON `formatoOR`, `siguienteCorrelativoOR` y `numeroORDisponible`.
     La última comprobaba que dos presupuestos no chocaran con la misma OR: con
     la OR colgando de la orden eso dejó de ser un choque y pasó a ser lo
     correcto —la segunda es la versión 2 del mismo trabajo—. Dejarla habría
     bloqueado versionar un presupuesto, que es la operación normal. */
  function siguienteNumeroOR(db) {
    const n = Number(parametro(db, 'correlativo_or', 19810));
    const fila = db.parametro.find((x) => x.clave === 'correlativo_or');
    if (fila) fila.valor = n + 1;
    return n;
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
    /* 🔴 Y «TALLER», QUE ES LA MISMA CASA (30-08-2026).

       Al migrar los doce años aparecieron 4.336 líneas de repuesto con el
       proveedor escrito «Taller» —$82.839.036— que esta función trataba como
       un proveedor externo y por lo tanto no se cobraban. No es un tercero: es
       el taller escribiendo su propio nombre en vez de su sigla.

       Es exactamente el problema que esta función vino a resolver, sólo que
       con una grafía más de la que se conocía cuando se escribió: «que debiese
       ser DYP, Dyp, dyp DyP y no mas» era la lista de lo que se había visto,
       no un límite. */
    if (/^taller$/i.test(t)) return PROVEEDOR_TALLER;
    return t;
  }
  const esProveedorTaller = (txt) => normalizarProveedor(txt) === PROVEEDOR_TALLER;

  /* Lo compró el taller → se le cobra al cliente. Lo puso la compañía → el
     taller no desembolsó nada y no lo cobra; la pieza igual queda registrada
     con su precio de referencia, que es lo que el original perdía al
     escribir $0 en el papel. */
  function cobroRepuesto(linea) {
    const bruto = (Number(linea.cantidad) || 0) * (Number(linea.precio_unitario) || 0);
    /* 🔴 LA LINEA MIGRADA DICE SI SE COBRA, Y MANDA ELLA (30-08-2026).

       En los doce años de historia el precio YA trae la decisión adentro:
       cuando la pieza la puso la compañía, el sistema viejo guardó $0. Volver a
       filtrarla por proveedor la deja en cero dos veces — se caían $2.024
       millones de venta que el taller sí cobró.

       Se comprobó contra `tb_consolidado`, la tabla de totales de su propio
       sistema: cobrando todas las líneas calzan 14.843 de 15.433 órdenes;
       filtrando por proveedor, 14.388.

       Para lo que se cargue de aquí en adelante la regla sigue siendo la de
       abajo, y ahí tiene sentido: en el sistema nuevo la pieza que aporta la
       compañía SÍ lleva su precio de referencia escrito, que es lo que el
       original perdía. */
    if (linea.cobrar === true) return bruto;
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

  function totalesPresupuesto(lineas, tempario, deducible, ivaPct, descuento) {
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

    /* 🔴 LA CADENA DE DESCUENTOS DEL DOCUMENTO (27-08-2026).

       Marco trae lo que le escribieron de DyP: «el deducible se descuenta del
       neto en ppto» y «debemos agregar la opción de descuento del Ppto
       también». Así que el presupuesto que sale para la compañía hace:

         subtotal − descuento − deducible = NETO · + IVA = TOTAL

       ⚠️ Y ESTO REVIERTE A MEDIAS UNA CORRECCIÓN DEL 16-08-2026. Ese día se
       DEJÓ de restar el deducible porque la lista mostraba $0 mientras el PDF
       mostraba $64.022 —dos totales distintos para la misma OR— y Marco lo vio
       al tiro: «la información no está fluyendo».

       El error de entonces no era restar: era restar en un lado y no en el
       otro. Ahora se resta SIEMPRE y en un solo lugar, y el número que el
       taller usa para medir su venta parada tiene nombre propio y aparte:
       `subtotalNeto`, lo que vale el trabajo. Quién paga cada parte —la
       compañía o el cliente con su deducible— no cambia lo que vale repararlo,
       y por eso la venta del taller NO puede leer `neto`. */
    const desc = Math.max(0, Math.min(Number(descuento) || 0, subtotalNeto));
    const ded = Math.min(Number(deducible) || 0, Math.max(0, subtotalNeto - desc));
    const neto = Math.max(0, subtotalNeto - desc - ded);
    const iva = Math.round(neto * (Number(ivaPct) || 0) / 100);
    return {
      horas: h, tempario: tarifa,
      dm, reparar, pintar, manoObra,
      repuestos, tot, subtotalNeto,
      descuento: desc, deducible: ded, neto, iva, total: neto + iva,
      /* Lo que vale el trabajo con su IVA, sin descontarle a nadie. Es lo que
         mide la venta del taller. Va con nombre para que nunca más haya que
         elegir entre «total» y «total». */
      ventaTaller: subtotalNeto + Math.round(subtotalNeto * (Number(ivaPct) || 0) / 100)
    };
  }

  /* 🔴 LA FECHA DE HOY, EN CHILE Y NO EN LONDRES (22-08-2026).

     Vive acá y no dentro de la semilla porque `reglas.js` carga segundo: lo
     ven el motor, la semilla, los arneses y las vistas. Mientras estuvo
     escondido en un solo archivo, el que necesitaba una fecha en otro lado
     volvía a escribir `toISOString()` — y eso fue exactamente lo que pasó.

     `toISOString()` pasa a UTC. Chile está en UTC-4, así que desde las 20:00
     hora local devuelve MAÑANA:

       21:30 en Chile  ->  toISOString() dice 2026-08-23  ·  acá son las 22
       19:00 en Chile  ->  toISOString() dice 2026-08-22  ·  acá son las 22

     Se arma con las partes locales, que es lo que además espera un
     `<input type="date">`. */
  const soloDia = (d) => {
    const f = (d instanceof Date) ? d : new Date(d);
    return f.getFullYear() + '-' +
      String(f.getMonth() + 1).padStart(2, '0') + '-' +
      String(f.getDate()).padStart(2, '0');
  };

  const hoyEnChile = () => soloDia(new Date());

  /* ── LA CLAVE NO SE GUARDA ─────────────────────────────────────────────
     SIS-1, 23-08-2026.

     Antes la clave se guardaba tal cual en `persona.clave`. Eso viaja: el
     documento entero sube a la sala compartida, y la sala se lee sin cuenta
     con la llave publicable, que está escrita en `js/sala.js` y publicada. Un
     GET devolvía las catorce cuentas con su clave legible.

     🔴 Y lo que hay que decir sin adornarlo: esto NO da seguridad. El código
     corre en el navegador, el algoritmo está acá abajo a la vista, y la clave
     de demostración es una sola y conocida — sacar su huella y compararla es
     cosa de un minuto para cualquiera. La seguridad de verdad llega con la
     autenticación del servidor, que es el hito H1.

     ⚠️ Lo que SÍ arregla, y por eso vale hacerlo igual: cuando una persona
     cambia su clave por una suya —de las que la gente reutiliza en otras
     partes— esa clave ya no queda escrita en un documento que cualquiera baja.
     Antes sí quedaba. Eso es daño real y es el que se cierra hoy.

     La huella lleva el id de la persona adentro, así que dos cuentas con la
     misma clave no dan la misma huella y mirar la lista no delata quién
     comparte clave con quién. */

  /* SHA-256, escrito acá porque el proyecto no tiene ni va a tener dependencias
     y porque `crypto.subtle` es asíncrono: meterlo obligaría a volver asíncrono
     el ingreso entero y todas sus pantallas. Es el algoritmo estándar y está
     comprobado contra los vectores conocidos en `pruebas.js`, no supuesto. */
  const SHA_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function sha256(texto) {
    /* El texto entra como bytes UTF-8: sin esto, «Muñoz» y «Munoz» darían la
       misma huella en unos navegadores y distinta en otros. */
    const bytes = [];
    for (const ch of String(texto)) {
      let c = ch.codePointAt(0);
      if (c < 0x80) bytes.push(c);
      else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }

    const bits = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    // El largo va al final en 64 bits. Los 32 de arriba quedan en cero: no
    // vamos a hashear textos de dos mil millones de bytes.
    bytes.push(0, 0, 0, 0, (bits >>> 24) & 255, (bits >>> 16) & 255, (bits >>> 8) & 255, bits & 255);

    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    const gira = (x, n) => (x >>> n) | (x << (32 - n));
    const w = new Array(64);

    for (let i = 0; i < bytes.length; i += 64) {
      for (let t = 0; t < 16; t++) {
        w[t] = (bytes[i + t * 4] << 24) | (bytes[i + t * 4 + 1] << 16) |
               (bytes[i + t * 4 + 2] << 8) | bytes[i + t * 4 + 3];
      }
      for (let t = 16; t < 64; t++) {
        const s0 = gira(w[t - 15], 7) ^ gira(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        const s1 = gira(w[t - 2], 17) ^ gira(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let t = 0; t < 64; t++) {
        const S1 = gira(e, 6) ^ gira(e, 11) ^ gira(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + SHA_K[t] + w[t]) | 0;
        const S0 = gira(a, 2) ^ gira(a, 13) ^ gira(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }

    return [h0, h1, h2, h3, h4, h5, h6, h7]
      .map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }

  /* La huella que se guarda en `persona.clave_hash`. Lleva el id adentro para
     que dos personas con la misma clave no compartan huella. */
  const claveHash = (persona_id, clave) => sha256('dyp:' + String(persona_id) + ':' + String(clave));

  /* Comparar por acá y no con `===` suelto en tres archivos distintos: si
     mañana esto cambia —y cambia en H1—, cambia en un solo lugar. */
  const claveCalza = (persona, clave) =>
    !!persona && !!persona.clave_hash && persona.clave_hash === claveHash(persona.id, clave);


  return {
    // claves
    sha256, claveHash, claveCalza,
    // fechas
    soloDia, hoyEnChile,
    // parámetros
    parametro, metaDias, kpiReparacion, autoAsignacion, exigeValidacion,
    // estados
    estadoPorCodigo, esFinal, cierraOrden, estaAbierta, esTerminal, nombreEstado,
    // consultas
    dias, otPorId, etapaPorId, etapaPorCodigo,
    etapasAsignadas, etapaAsignada, repuestosPendientes, estadiaAbierta, detencionAbierta,
    tieneRepuestoPendiente, estaFueraDeTaller, alertasDe,
    // reglas
    puedeCrearOT, presupuestoEditable,
    puedeAsignarEtapa, puedeFinalizarEtapa,
    calcularRelojes,
    puedeRegistrarSalida, puedeRegistrarReingreso,
    puedeCambiarEstado,
    puedeCargarRepuesto,
    puedeEscribirBitacora,
    puedeAbrirDetencion, puedeCerrarDetencion,
    // OR
    siguienteNumeroOR,
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
