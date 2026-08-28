/* LAS PRUEBAS NEGATIVAS. Son el criterio de aceptación del modelo, no un extra.

   Cada una intenta algo que el negocio prohíbe. Tiene que fallar POR LA REGLA y con un
   motivo explicado, no por un botón deshabilitado ni por una excepción.

   Detalle y decisiones: 00 Documentacion/DECISIONES.md · js/pruebas.js */

const Pruebas = (function () {

  /* Cada prueba devuelve { nombre, intento, esperado, paso, detalle }. */

  function correr() {
    return Modelo.sandbox(function () {
      const db = Modelo.base();
      const res = [];
      const push = (o) => res.push(o);

      /* Las pruebas parten de un estado de sesión CONOCIDO, y no del que haya
         dejado quien estaba usando el sistema.

         Sin esto dependían de con qué cuenta estuvieras: corriéndolas como
         Pintura —que no puede cargar repuestos ni cerrar órdenes— caían nueve
         de golpe con "falta el permiso", y parecía que el motor estaba roto
         cuando lo que fallaba era el punto de partida. Se prueban las REGLAS,
         no el reparto de permisos: para eso está la prueba 17. */
      const sesionPrevia = (Modelo.personaActual() || {}).id || null;
      const rolPrevio = (Modelo.rolActual() || {}).id || null;
      Modelo.fijar_persona_actual(null);
      Modelo.fijar_rol_actual('ro-6');           // dueño: ve y puede todo
      const restaurarSesion = () => {
        if (sesionPrevia) Modelo.fijar_persona_actual(sesionPrevia);
        else { Modelo.fijar_persona_actual(null); if (rolPrevio) Modelo.fijar_rol_actual(rolPrevio); }
      };

      const abiertaCualquiera = () => db.orden_trabajo.find((o) => Reglas.estaAbierta(db, o.estado));

      /* ── 1 · Una patente, una orden abierta ─────────────────────────── */
      (function () {
        const o = abiertaCualquiera();
        const r = Reglas.puedeCrearOT(db, { vehiculo_id: o.vehiculo_id });
        push({
          nombre: 'Una patente no puede tener dos órdenes abiertas',
          intento: 'Abrir una segunda OT para un vehículo que ya tiene la orden ' + o.numero_ot,
          esperado: 'Rechazo, nombrando la orden existente',
          paso: !r.ok && r.motivo.indexOf(String(o.numero_ot)) >= 0,
          detalle: r.motivo || 'La regla permitió crearla: NO debería.'
        });
      })();

      /* ── 2 · 🔴 REGRABAR UN ESTADO NO MUEVE NINGÚN CONTADOR ──────────
         La corrección central. En el sistema actual, volver a grabar
         'Recibido' sobre 'Recibido' reinicia el contador de días: medido al
         día exacto en ocho órdenes reales. */
      (function () {
        const o = db.orden_trabajo.find((x) => x.estado === 'recibido');
        const antes = Reglas.calcularRelojes(db, o.id, HOY);
        const evAntes = db.evento.filter((e) => e.ot_id === o.id).length;
        const r = Modelo.cambiar_estado_ot(o.id, 'recibido');
        const dsp = Reglas.calcularRelojes(db, o.id, HOY);
        const evDsp = db.evento.filter((e) => e.ot_id === o.id).length;
        const quieto = antes.dias_totales === dsp.dias_totales &&
                       antes.dias_reparacion === dsp.dias_reparacion &&
                       antes.dias_estadia_actual === dsp.dias_estadia_actual &&
                       evAntes === evDsp;
        push({
          nombre: '🔴 Regrabar el mismo estado no mueve ningún contador',
          intento: "Grabar 'Recibido' sobre la OT " + o.numero_ot + ", que ya está en 'Recibido'",
          esperado: 'Rechazo, y los tres relojes intactos (' + antes.dias_totales + ' / ' +
                    antes.dias_reparacion + ' / ' + antes.dias_estadia_actual + ' días)',
          paso: !r.ok && quieto,
          detalle: !quieto
            ? 'ALGO SE MOVIÓ: ' + dsp.dias_totales + ' / ' + dsp.dias_reparacion + ' / ' +
              dsp.dias_estadia_actual + ', eventos ' + evAntes + '→' + evDsp
            : (r.motivo || 'Dejó regrabarlo sin decir nada.')
        });
      })();

      /* ── 3 · 🔴 EL RELOJ SE REANUDA, Y ADEMÁS SE OFRECEN LOS DOS ─────
         No es una prueba negativa, es la demostración del arreglo: sale del
         taller, vuelve, y ninguno de los tres números se pierde. */
      (function () {
        const o = db.orden_trabajo.find((x) => x.estado === 'recibido' &&
          Reglas.calcularRelojes(db, x.id, HOY).dias_reparacion > 3);
        if (!o) return push({ nombre: 'El reloj de reparación se reanuda al reingresar',
          intento: '—', esperado: '—', paso: false,
          detalle: 'No se encontró en la semilla una OT en taller con días suficientes.' });

        const antes = Reglas.calcularRelojes(db, o.id, HOY);
        const salida = Modelo.registrar_salida(o.id, 'espera_repuesto');
        const fuera = Reglas.calcularRelojes(db, o.id, HOY);
        const vuelta = Modelo.registrar_reingreso(o.id);
        const dsp = Reglas.calcularRelojes(db, o.id, HOY);

        // Al salir, la reparación queda congelada. Al volver, la acumulada
        // conserva lo de antes y la estadía actual arranca de cero.
        const ok = salida.ok && vuelta.ok &&
          fuera.dias_estadia_actual === 0 &&
          dsp.dias_reparacion >= antes.dias_reparacion &&
          dsp.dias_estadia_actual === 0 &&
          dsp.dias_totales === antes.dias_totales;
        push({
          nombre: '🔴 El reloj se reanuda al reingresar, y el otro vuelve a cero',
          intento: 'Sacar la OT ' + o.numero_ot + ' del taller y reingresarla',
          esperado: 'Totales intactos, reparación acumulada conservada, estadía actual en 0',
          paso: ok,
          detalle: 'Antes ' + antes.dias_totales + '/' + antes.dias_reparacion + '/' + antes.dias_estadia_actual +
                   ' → después ' + dsp.dias_totales + '/' + dsp.dias_reparacion + '/' + dsp.dias_estadia_actual +
                   '  (totales / reparación / estadía actual)'
        });
      })();

      /* ── 4 · Un estado que cierra la orden no se reabre ──────────────── */
      (function () {
        const o = abiertaCualquiera();
        const cerrar = Modelo.cambiar_estado_ot(o.id, 'entrega_cliente');
        const r = Modelo.cambiar_estado_ot(o.id, 'recibido');
        push({
          nombre: 'Una orden entregada no se reabre',
          intento: 'Cerrar la OT ' + o.numero_ot + " como 'Entrega Cliente' y volver a aceptarla",
          esperado: 'Rechazo: hay que reingresar el vehículo con una orden nueva',
          paso: cerrar.ok && !r.ok && /reingresar/i.test(r.motivo),
          detalle: !cerrar.ok ? 'No se pudo ni siquiera cerrarla: ' + cerrar.motivo
                              : (r.motivo || 'Dejó reabrirla: NO debería.')
        });
      })();

      /* ── 5 · Doble clic en crear no crea dos órdenes ─────────────────── */
      (function () {
        const antes = db.orden_trabajo.length;
        const ficha = { patente: 'ZZZZ99', nombres: 'Cliente', apellidos: 'de Prueba',
          rut: '11.111.111-1', demo: true };
        const bloques = [{ tipo_ingreso_id: 'ti-2' }];
        const uno = Modelo.crear_ot_desde_recepcion(ficha, bloques, 'prueba-doble-clic');
        const dos = Modelo.crear_ot_desde_recepcion(ficha, bloques, 'prueba-doble-clic');
        const creadas = db.orden_trabajo.length - antes;
        push({
          nombre: 'Doble clic en crear no genera dos órdenes',
          intento: 'Guardar dos veces seguidas la misma recepción',
          esperado: 'Una sola OT; la segunda devuelve la primera',
          paso: uno.ok && dos.ok && dos.repetida === true && creadas === 1,
          detalle: creadas !== 1
            ? 'Se crearon ' + creadas + ' órdenes: debía ser exactamente 1.'
            : 'La segunda llamada devolvió la OT ' +
              ((dos.ordenes && dos.ordenes[0] && dos.ordenes[0].numero_ot) || '—') + ' sin escribir nada.'
        });
      })();

      /* ── 6 · Bodega no carga sobre una orden ya cerrada ──────────────── */
      (function () {
        const cerrada = db.orden_trabajo.find((o) => Reglas.esFinal(db, o.estado));
        const r = Modelo.cargar_repuesto(cerrada.id, { descripcion: 'Paragolpes delantero' });
        push({
          nombre: 'Bodega no carga repuestos a una orden cerrada',
          intento: 'Agregar un repuesto a la OT ' + cerrada.numero_ot + ', ya entregada',
          esperado: 'Rechazo: no se puede facturar teniendo un pendiente',
          paso: !r.ok && /torre de control|abiertas/i.test(r.motivo),
          detalle: r.motivo || 'Dejó cargar el repuesto: NO debería.'
        });
      })();

      /* ── 7 · Sin texto libre donde debe haber catálogo ────────────────
         Es la regla que evita que CARDIF vuelva a convivir con CADIF, CARDF
         y CDIF, que es lo que hay hoy en el sistema real. */
      (function () {
        const r = Modelo.guardar_catalogo('compania', { nombre: 'Sura Seguros', codigo: 'SURA' });
        const r2 = Modelo.cargar_repuesto(abiertaCualquiera().id,
          { descripcion: 'Foco derecho', responsable_pago_id: 'inventado' });
        push({
          nombre: 'No se guarda una compañía repetida ni un pagador fuera del catálogo',
          intento: 'Crear la compañía "Sura Seguros" con el código SURA, y cargar un repuesto ' +
                   'con un responsable de pago que no existe',
          esperado: 'Los dos rechazados: una sola fuente por concepto',
          paso: !r.ok && !r2.ok,
          detalle: [r.motivo, r2.motivo].filter(Boolean).join('  ·  ') || 'Dejó guardar: NO debería.'
        });
      })();

      /* ── 8 · El presupuesto es la VENTA parada ────────────────────────
         Sumando lo presupuestado de las órdenes sin entregar, el taller sabe
         cuánta venta tiene en el piso. Es lo que reemplazó a la utilidad. */
      (function () {
        const vivas = db.orden_trabajo.filter((o) => Reglas.estaAbierta(db, o.estado));
        const total = vivas.reduce((s, o) => s + db.presupuesto
          .filter((p) => p.ot_id === o.id).reduce((t, p) => t + p.total, 0), 0);
        const sinPresu = vivas.filter((o) => !db.presupuesto.some((p) => p.ot_id === o.id)).length;
        push({
          nombre: 'La venta parada se puede calcular en cualquier momento',
          intento: 'Sumar lo presupuestado de las ' + vivas.length + ' órdenes sin entregar',
          esperado: 'Un total mayor que cero y el conteo de las que no tienen presupuesto',
          paso: total > 0 && vivas.length > 0,
          detalle: 'Venta parada: $' + Math.round(total).toLocaleString('es-CL') +
                   ' en ' + vivas.length + ' órdenes · ' + sinPresu + ' todavía sin presupuesto.'
        });
      })();

      /* ── 9 · Exportar es un permiso aparte ───────────────────────────── */
      (function () {
        const ope = Modelo.permisosDe('ro-3');
        const adm = Modelo.permisosDe('ro-5');
        const ok = ope.indexOf('exportar') < 0 && adm.indexOf('exportar') >= 0;
        push({
          nombre: 'Exportar el padrón es un permiso separado',
          intento: 'Comprobar que el operario no tiene "exportar" y administración sí',
          esperado: 'Permiso propio, no incluido en "ver"',
          paso: ok,
          detalle: ok
            ? 'Hoy el sistema actual tiene botón Exportar en Torre, Taller, padrón de clientes y ' +
              'nómina, y un clic entrega la tabla completa. ⚠️ La TRAZA de la exportación (A-10) ' +
              'es de la tanda 7 y todavía no está: acá solo se comprueba el permiso.'
            : 'El permiso de exportación no está separado.'
        });
      })();

      /* ── 10 · La precedencia funciona cuando se enciende ──────────────
         Está apagada por defecto porque no sabemos si existe en el original.
         Esta prueba la enciende y comprueba que bloquea. */
      (function () {
        const o = db.orden_trabajo.find((x) => x.estado === 'recibido');
        const desarme = Reglas.etapaPorCodigo(db, 'desarme');
        const desab = Reglas.etapaPorCodigo(db, 'desabolladura');
        db.ot_etapa = db.ot_etapa.filter((x) => x.ot_id !== o.id);
        db.ot_etapa.push({ id: 'oe-p1', ot_id: o.id, etapa_id: desarme.id, asignada_at: HOY, salio_at: null, persona_id: null, observacion: '' });
        db.ot_etapa.push({ id: 'oe-p2', ot_id: o.id, etapa_id: desab.id, asignada_at: HOY, salio_at: null, persona_id: null, observacion: '' });

        const apagada = Modelo.finalizar_etapa(o.id, 'desabolladura');   // debe DEJAR
        db.ot_etapa.find((x) => x.id === 'oe-p2').salio_at = null;       // se reabre
        desab.exige_precedencia = true;
        const encendida = Modelo.finalizar_etapa(o.id, 'desabolladura'); // debe RECHAZAR
        desab.exige_precedencia = false;

        push({
          nombre: 'La precedencia está construida y apagada: encendida, bloquea',
          intento: 'Cerrar Desabolladura sin Desarme, primero con el interruptor apagado y ' +
                   'después encendido, sobre la OT ' + o.numero_ot,
          esperado: 'Apagada deja; encendida rechaza nombrando Desarme',
          paso: apagada.ok && !encendida.ok && /Desarme/.test(encendida.motivo),
          detalle: 'Apagada: ' + (apagada.ok ? 'dejó cerrar ✓' : 'rechazó ✗ ' + apagada.motivo) +
                   '  ·  Encendida: ' + (encendida.ok ? 'dejó cerrar ✗' : encendida.motivo)
        });
      })();

      /* ── 11 · No se arma un círculo de precedencias ───────────────────── */
      (function () {
        const a = Reglas.etapaPorCodigo(db, 'desarme');
        const b = Reglas.etapaPorCodigo(db, 'desabolladura');
        const r = Modelo.agregar_prerrequisito(a.id, b.id);   // ya existe b←a
        push({
          nombre: 'No se puede armar un círculo de precedencias',
          intento: 'Hacer que Desarme exija Desabolladura, cuando Desabolladura ya exige Desarme',
          esperado: 'Rechazo: ninguna de las dos se podría cerrar nunca',
          paso: !r.ok && /círculo|circulo/i.test(r.motivo),
          detalle: r.motivo || 'Dejó armar el círculo: NO debería.'
        });
      })();

      /* ── 12 · Un presupuesto enviado SE SIGUE EDITANDO ────────────────
         🔴 27-08-2026, Marco: «lo mismo con el presupuesto, no pasa por
         aprobación de nadie. La cuestión se envía pero de que se puede editar,
         se puede editar».

         Esta prueba ataba lo contrario —enviar congelaba y había que versionar—
         y era correcta mientras esa política existía. Se invierte, y de paso
         ata el límite que SÍ queda: la orden cerrada. Sin esa segunda mitad, la
         prueba diría «se puede editar siempre», que no es lo que se construyó.

         ⚠️ Y ata que «Crear versión nueva» siga existiendo. Ya no es
         obligatorio, pero es lo único que deja una foto de lo que se mandó: si
         alguien lo saca por creerlo inútil, esto se pone rojo. */
      (function () {
        const o = abiertaCualquiera();
        const cr = Modelo.crear_presupuesto(o.id, { lineas: [] });
        Modelo.agregar_linea_presupuesto(cr.presupuesto_id,
          { proceso: 'reparar', descripcion: 'Desabolladura', horas_rep: 4 });
        const env = Modelo.cambiar_estado_presupuesto(cr.presupuesto_id, 'enviado');
        const trasEnviar = Modelo.agregar_linea_presupuesto(cr.presupuesto_id,
          { proceso: 'reparar', descripcion: 'Otra cosa', horas_rep: 1 });
        // Y aprobado tampoco congela: el estado es lo que contestó la compañía.
        Modelo.cambiar_estado_presupuesto(cr.presupuesto_id, 'aprobado');
        const trasAprobar = Modelo.actualizar_linea_presupuesto(
          (db.presupuesto_linea.filter((l) => l.presupuesto_id === cr.presupuesto_id).pop() || {}).id,
          { horas_rep: 2 });
        const v2 = Modelo.nueva_version_presupuesto(cr.presupuesto_id);

        /* El límite que queda: con la orden cerrada no se toca nada. Se cierra
           una orden de verdad y se intenta escribir en su presupuesto. */
        const cerrada = db.orden_trabajo.find((x) => Reglas.esFinal(db, x.estado) &&
          db.presupuesto.some((y) => y.ot_id === x.id));
        const suPresu = cerrada && db.presupuesto.find((y) => y.ot_id === cerrada.id);
        const enCerrada = suPresu
          ? Modelo.agregar_linea_presupuesto(suPresu.id, { proceso: 'reparar', descripcion: 'No debería' })
          : { ok: false, motivo: '(no había ninguna orden cerrada con presupuesto)' };

        push({
          nombre: '🔴 Un presupuesto enviado SE SIGUE EDITANDO; uno de orden cerrada, no',
          intento: 'Agregar una línea después de enviarlo, corregir horas después de aprobarlo, ' +
                   'y escribir en el presupuesto de una orden ya cerrada',
          esperado: 'Enviado y aprobado dejan editar · la orden cerrada rechaza · la versión nueva sigue existiendo',
          paso: env.ok && trasEnviar.ok && trasAprobar.ok && !enCerrada.ok &&
                v2.ok && v2.numero_or === cr.numero_or,
          detalle: !trasEnviar.ok ? 'Enviado NO dejó editar: ' + trasEnviar.motivo
            : (!trasAprobar.ok ? 'Aprobado NO dejó editar: ' + trasAprobar.motivo
              : (enCerrada.ok ? 'Dejó escribir en una orden CERRADA: el vehículo ya se fue'
                : (!v2.ok ? 'Se perdió «Crear versión nueva»: ya no hay forma de guardar lo que se mandó'
                  : 'Se edita enviado y aprobado; con la orden cerrada se planta')))
        });
      })();

      /* ── 13 · No se desactiva a alguien con etapas abiertas ───────────── */
      (function () {
        const fila = db.ot_etapa.find((x) => x.persona_id && !x.salio_at);
        if (!fila) return push({ nombre: 'No se desactiva a alguien con etapas abiertas',
          intento: '—', esperado: '—', paso: false, detalle: 'La semilla no dejó ninguna etapa abierta con responsable.' });
        const p = db.persona.find((x) => x.id === fila.persona_id);
        const r = Modelo.dar_de_baja_persona(fila.persona_id);
        push({
          nombre: 'No se desactiva a un trabajador con etapas abiertas',
          intento: 'Dar de baja a ' + p.nombres + ', que tiene trabajo asignado sin cerrar',
          esperado: 'Rechazo: hay que reasignar primero',
          paso: !r.ok && /abierta/i.test(r.motivo),
          detalle: r.motivo || 'Dejó desactivarlo: NO debería.'
        });
      })();

      /* ── 14 · El operario ve las líneas pero no los montos ───────────── */
      (function () {
        const nivel = (rol) => {
          const ps = Modelo.permisosDe(rol);
          return [ps.indexOf('presupuesto.ver') >= 0,
                  ps.indexOf('presupuesto.montos') >= 0].map((x) => (x ? '1' : '0')).join('');
        };
        const ope = nivel('ro-3'), rec = nivel('ro-1'), due = nivel('ro-6');
        push({
          nombre: 'El operario ve las líneas del presupuesto pero no los montos',
          intento: 'Comparar operario, recepción y dueño sobre ver / montos',
          esperado: 'Operario 10 · Recepción 11 · Dueño 11',
          paso: ope === '10' && rec === '11' && due === '11',
          detalle: 'Operario ' + ope + ' · Recepción ' + rec + ' · Dueño ' + due +
                   '  ·  ⚠️ En el navegador está MODELADO; se garantiza con RLS en PostgreSQL.'
        });
      })();

      /* ── 15 · No se carga un costo adicional a una orden cerrada ──────── */
      (function () {
        const cerrada = db.orden_trabajo.find((o) => Reglas.esFinal(db, o.estado));
        const r = Modelo.agregar_costo_adicional(cerrada.id, { descripcion: 'Grúa', monto: 40000 });
        push({
          nombre: 'No se cargan costos a una orden ya cerrada',
          intento: 'Agregar un costo adicional a la OT ' + cerrada.numero_ot + ', ya entregada',
          esperado: 'Rechazo',
          paso: !r.ok,
          detalle: r.motivo || 'Dejó cargarlo: NO debería.'
        });
      })();

      /* ── 16 · No se borra un catálogo en uso ──────────────────────────── */
      (function () {
        const sura = db.compania.find((c) => c.codigo === 'SURA');
        const r = Modelo.eliminar_catalogo('compania', sura.id);
        const baja = Modelo.dar_de_baja_catalogo('compania', sura.id);
        push({
          nombre: 'No se elimina un catálogo en uso: se da de baja',
          intento: 'Eliminar la compañía SURA, que tiene órdenes asociadas',
          esperado: 'Rechazo al eliminar; la baja lógica sí funciona',
          paso: !r.ok && baja.ok,
          detalle: r.motivo || 'Dejó eliminarla: el histórico habría dejado de leerse.'
        });
      })();

      /* ── 17 · 🔴 EL PERMISO LO REVISA EL MOTOR, NO EL BOTÓN ────────────
         Hasta el 13-08-2026 los permisos vivían en una tabla y en el menú, y
         ninguna operación los miraba: entrando como operario se podía crear un
         presupuesto igual. Esta prueba existe para que eso no vuelva a pasar.
         Se corre entrando como el pintor, que no tiene ese permiso. */
      (function () {
        const rolPrevio = Modelo.rolActual().id;
        /* 🔴 SE BUSCA POR LO QUE LE FALTA, no por el rol. Estaba escrito
           `rol_id === 'ro-3'` —el operario— y el 22-08-2026 esa cuenta se
           borró junto con las otras cinco que no estaban en la lista de
           Andrés: la prueba se cayó con «no puedo leer id de undefined», que
           no dice nada de lo que estaba probando. Preguntar por el permiso que
           falta sobrevive a que cambie la nómina. */
        const sinPermiso = Modelo.sesionesPosibles().find((p) => {
          Modelo.fijar_persona_actual(p.id);
          return !Modelo.puede('presupuesto.crear') && !Modelo.puede('configuracion');
        });
        Modelo.fijar_persona_actual(null);
        if (!sinPermiso) {
          push({ nombre: '🔴 El permiso lo rechaza el motor, no solo el botón',
            intento: 'Buscar una cuenta sin presupuesto.crear ni configuracion',
            esperado: 'Que exista al menos una, para poder probar con ella',
            paso: false,
            detalle: 'Ninguna de las ' + Modelo.sesionesPosibles().length +
              ' cuentas carece de esos dos permisos: no hay con quien probar.' });
          Modelo.fijar_rol_actual(rolPrevio);
          return;
        }
        const operario = sinPermiso;
        /* Se prueba VALORIZAR, no abrir. Son dos permisos distintos a propósito
           —«abrir la OR es del recepcionista; ponerle los montos, de quien sabe
           cuánto cuesta reparar»— y probar con `crear_presupuesto` daba verde
           falso: la cuenta de Recepción sí puede abrirla. */
        Modelo.fijar_persona_actual(null);
        const o = Modelo.torre().find((x) => x.presupuestos.length) || Modelo.torre()[0];
        const presu = (o.presupuestos || [])[0];
        Modelo.fijar_persona_actual(operario.id);
        const r = presu
          ? Modelo.agregar_linea_presupuesto(presu.id,
              { descripcion: 'Prueba de permiso', proceso: 'reparar', horas: 1 })
          : { ok: true, motivo: '' };
        const conf = Modelo.guardar_catalogo('compania', { nombre: 'Coladura', codigo: 'COL' });
        Modelo.fijar_persona_actual(null);
        Modelo.fijar_rol_actual(rolPrevio);
        push({
          nombre: '🔴 El permiso lo rechaza el motor, no solo el botón',
          intento: 'Entrando con la cuenta ' + operario.nombre + ' —que no tiene esos permisos—, crear un presupuesto y tocar un catálogo',
          esperado: 'Rechazo en las dos, nombrando el permiso que falta',
          paso: !r.ok && !conf.ok && /permiso/i.test(r.motivo || ''),
          detalle: r.motivo || 'Lo dejó crear: el permiso es decorativo.'
        });
      })();

      /* ── 18 · El vehículo que se traspasa le llega a su responsable ───── */
      (function () {
        const jefe = Modelo.sesionesPosibles().find((p) => p.rol_id === 'ro-2');
        const libre = Modelo.torre().find((o) => !o.responsableId);
        const antes = Modelo.miTrabajo(jefe.id).aCargo.length;
        const r = libre ? Modelo.asignar_responsable_ot(libre.id, jefe.id) : { ok: false, motivo: 'Sin órdenes libres.' };
        const despues = Modelo.miTrabajo(jefe.id).aCargo.length;
        push({
          nombre: 'El vehículo traspasado aparece en la pantalla de su responsable',
          intento: 'Asignar la OT ' + (libre ? libre.numeroOT : '—') + ' a ' + jefe.nombre,
          esperado: 'La orden le aparece en "Vehículos a mi cargo" sin que nadie le avise',
          paso: r.ok && despues === antes + 1,
          detalle: r.ok ? 'Pasó de ' + antes + ' a ' + despues + ' órdenes a su cargo.'
                        : r.motivo
        });
      })();

      /* ── 19 · 🔴 EL OPERARIO SOLO VE LOS AUTOS QUE TIENE ASIGNADOS ──────
         El permiso dice qué PANTALLAS abre; el alcance dice qué FILAS trae
         cada pantalla. Sin lo segundo, el pintor —que no podía entrar a
         Configuración— igual veía los 102 vehículos del taller con el nombre
         y el RUT de cada cliente, y abría la ficha completa de cualquiera.
         Esta prueba mide las dos cosas: cuántos ve, y que la orden de otro no
         se abra ni por el id. */
      (function () {
        /* 🔴 LA PRUEBA SE FABRICA SUS PROPIOS OPERARIOS (22-08-2026).

           Antes buscaba dos cuentas con el rol `ro-3` entre las sembradas. El
           22-08-2026 se borraron las seis cuentas que no estaban en la lista de
           Andrés —«Desabolladura» y «Pintura» entre ellas— y con eso desapareció
           la ÚNICA cuenta con alcance `asignado`: la prueba se cayó sin llegar a
           probar nada.

           El alcance es del MOTOR y su correccion no depende de a quien se le
           haya dado una cuenta. Asi que se siembran dos operarios acá dentro
           —la caja de arena descarta todo al terminar— y el control se sigue
           midiendo aunque el taller no le dé cuenta a nadie del piso.

           ⚠️ Y hay que decirlo aparte: con la nomina de hoy, NINGUNA cuenta
           real usa el alcance `asignado`. El control existe y funciona; no hay
           a quien aplicarselo hasta que los operarios tengan cuenta. */
        const fabricar = (n) => {
          const id = 'pe-prueba-' + n;
          db.persona.push({ id, tipo: 'trabajador', ficha: 9000 + n, rut: '11.111.11' + n + '-1',
            // Huella, no clave: desde SIS-1 ninguna cuenta guarda su clave, y
            // hay una prueba que recorre `db.persona` y caza a la que lo haga.
            usuario: 'operario' + n + '@prueba.cl',
            clave_hash: Reglas.claveHash(id, 'x'), clave_inicial: false,
            nombres: 'Operario', apellidos: 'de prueba ' + n, cargo: 'Operario',
            correo: 'operario' + n + '@prueba.cl', telefono: '', direccion: '', comuna: '',
            modulos: null, activo: true, demo: true });
          db.persona_rol.push({ persona_id: id, rol_id: 'ro-3' });
          ['et-2', 'et-3', 'et-4'].forEach((e) =>
            db.persona_etapa.push({ persona_id: id, etapa_id: e }));
          return db.persona.find((x) => x.id === id);
        };
        const operario = fabricar(1), otro = fabricar(2);
        /* Y se les da una etapa a cada uno, porque sin nada asignado el alcance
           `asignado` no distingue nada: los dos verían cero. */
        db.ot_etapa.filter((x) => !x.salio_at).slice(0, 6).forEach((x, k) => {
          x.persona_id = k % 2 ? otro.id : operario.id;
        });
        Modelo.fijar_persona_actual(null);
        const total = Modelo.torre().length;
        const ajena = otro ? (Modelo.miTrabajo(otro.id).mias[0] || {}) : {};

        Modelo.fijar_persona_actual(operario.id);
        const suyas = Modelo.torre().length;
        const abreAjena = ajena.ot_id ? Modelo.otPorId(ajena.ot_id) : null;
        const historico = Modelo.historico({ todo: true }).length;
        Modelo.fijar_persona_actual(null);

        push({
          nombre: '🔴 El operario ve solo sus vehículos, no el taller entero',
          intento: 'Entrar con una cuenta de alcance «asignado» y pedir la torre, el histórico y la OT ' +
                   (ajena.numeroOT || '—') + ', que es de otro',
          esperado: 'Ve solo lo asignado, el histórico vacío y la orden ajena no se abre',
          paso: suyas < total && suyas > 0 && historico === 0 && abreAjena === null,
          detalle: 'Ve ' + suyas + ' de ' + total + ' órdenes · histórico ' + historico +
                   ' · la orden ajena ' + (abreAjena === null ? 'no se abre' : 'SE ABRIÓ, no debería')
        });
      })();

      /* ── 20 · Nadie cierra la etapa que tiene otro a su nombre ───────────
         `etapa.finalizar` dice que sabe cerrar etapas. No dice que pueda
         cerrar las de cualquiera. */
      (function () {
        const uno = Modelo.sesionesPosibles().find((p) => p.rol_id === 'ro-3');
        const dos = Modelo.sesionesPosibles().find((p) => p.rol_id === 'ro-3' && p.id !== uno.id);
        Modelo.fijar_persona_actual(null);
        const suya = dos ? (Modelo.miTrabajo(dos.id).mias[0] || {}) : {};

        Modelo.fijar_persona_actual(uno.id);
        const cerrar = suya.ot_id
          ? Modelo.finalizar_etapa(suya.ot_id, suya.etapaCodigo, uno.id)
          : { ok: true, motivo: 'sin etapa de otro para probar' };
        const aNombreDeOtro = suya.ot_id
          ? Modelo.tomar_etapa(suya.ot_id, suya.etapaCodigo, dos.id)
          : { ok: true };
        Modelo.fijar_persona_actual(null);

        push({
          nombre: 'Nadie cierra ni toma la etapa que tiene otro a su nombre',
          intento: uno.nombre + ' intenta cerrar la etapa ' + (suya.etapa || '—') +
                   ' que tiene ' + (dos ? dos.nombre : '—'),
          esperado: 'Rechazo en las dos, diciendo de quién es',
          paso: !cerrar.ok && !aNombreDeOtro.ok,
          detalle: cerrar.motivo || 'La cerró: no debería.'
        });
      })();

      /* ── 21 · Las fotos del vehículo son un permiso aparte ───────────────
         El pintor no sube fotos ni las mira: marca su etapa y sigue. Bodega
         sí necesita los documentos —la guía de despacho llega con la pieza—
         pero tampoco las fotos del daño. Son dos permisos distintos y esta
         prueba comprueba que el motor los distinga, no solo la pantalla. */
      (function () {
        const o = Modelo.torre()[0];
        Modelo.adjuntar_media(null, [o.id], [
          { nombre: 'prueba-dano.jpg', momento: 'ingreso', bytes: 10, bytes_original: 10, ot_id: o.id },
          { nombre: 'prueba-guia.pdf', momento: 'documento', bytes: 10, bytes_original: 10, ot_id: o.id }
        ]);
        const dueno = Modelo.mediaDe(o.id).length;

        const bodega = Modelo.sesionesPosibles().find((p) => p.rol_id === 'ro-4');
        Modelo.fijar_persona_actual(bodega.id);
        const veBodega = Modelo.mediaDe(o.id).map((m) => m.momento);

        const operario = Modelo.sesionesPosibles().find((p) => p.rol_id === 'ro-3');
        Modelo.fijar_persona_actual(operario.id);
        const veOperario = Modelo.mediaDe(o.id).length;
        const sube = Modelo.adjuntar_media(null, [o.id], []);
        Modelo.fijar_persona_actual(null);

        push({
          nombre: 'Las fotos del vehículo y los documentos son permisos distintos',
          intento: 'Pedir los adjuntos de la OT ' + o.numeroOT + ' como bodega y como operario',
          esperado: 'Bodega ve solo el documento; el operario no ve ninguno y no puede subir',
          paso: dueno >= 2 && veBodega.length === 1 && veBodega[0] === 'documento' &&
                veOperario === 0 && !sube.ok,
          detalle: 'El dueño ve ' + dueno + ' · bodega ve [' + veBodega.join(', ') +
                   '] · el operario ve ' + veOperario + ' y al subir: ' + (sube.motivo || 'la dejó subir')
        });
      })();

      /* ── 22 · 🔴 AL ADMINISTRADOR NO SE LE QUITA NADA ────────────────────
         La matriz de permisos es editable, y `configuracion` es una casilla
         más de esa matriz. Sin esta garantía, alguien la desmarca en la fila
         de Administración —por error o por mano ajena— y el taller queda sin
         nadie que pueda volver a marcarla: la única salida sería reiniciar la
         base y perder todo. Son dos puertas y las dos tienen que estar
         trabadas: quitarle el permiso, y desactivar la única cuenta que lo
         tiene. */
      (function () {
        const admin = db.rol.find((r) => r.total);
        const antes = Modelo.permisosDe(admin.id).length;
        const quitar = Modelo.fijar_rol_permiso(admin.id, 'configuracion', false);
        const despues = Modelo.permisosDe(admin.id).length;

        // Y aunque la matriz quedara vacía a mano, el motor lo deja entrar.
        db.rol_permiso = db.rol_permiso.filter((r) => r.rol_id !== admin.id);
        const rolPrevio = Modelo.rolActual().id;
        Modelo.fijar_rol_actual(admin.id);
        const entraIgual = Modelo.puede('configuracion') && Modelo.puede('consolidado.ver');
        Modelo.fijar_rol_actual(rolPrevio);

        // La cuenta con la que se entra: trabajador activo con un rol total.
        // Es la que quedaría huérfano el sistema si se pudiera desactivar.
        const conAcceso = db.persona.filter((p) => p.activo && p.tipo === 'trabajador' &&
          (db.rol.find((r) => r.id === (db.persona_rol.find((y) => y.persona_id === p.id) || {}).rol_id) || {}).total);

        /* 🔴 LA PRUEBA SE DEJABA DE CORRER SOLA. Decía «NO PROBADO: hay N
           cuentas con acceso total» y daba la regla por buena. Con las cuentas
           de verdad del cliente —17-08-2026— pasaron a ser tres, así que la
           regla que existe para que nadie deje al sistema sin administrador
           dejó de probarse justo cuando aparecieron más administradores: el
           momento en que uno se relaja.

           Ahora se construye el escenario: se desactivan todas menos una —con
           el motor, no tocando la base a mano— y se prueba sobre la última.
           Después se reactivan, porque una prueba que deja el sistema distinto
           de como lo encontró rompe las que vienen detrás. */
        const otras = conAcceso.slice(1);
        otras.forEach((p) => Modelo.dar_de_baja_persona(p.id));
        const baja = conAcceso.length
          ? Modelo.dar_de_baja_persona(conAcceso[0].id)
          : { ok: true, motivo: 'NO HAY ninguna cuenta con acceso total' };
        otras.forEach((p) => Modelo.reactivar_persona(p.id));

        push({
          nombre: '🔴 Al administrador no se le puede quitar el acceso',
          intento: 'Desmarcarle «Administrar los catálogos», vaciarle la matriz entera y ' +
                   'desactivar su única cuenta',
          esperado: 'Las tres rebotan, y sigue teniendo los ' + db.permiso.length + ' permisos',
          paso: !quitar.ok && antes === despues && despues === db.permiso.length && entraIgual && !baja.ok,
          detalle: quitar.motivo + ' · Con la matriz vacía a mano ' +
                   (entraIgual ? 'igual entra' : 'QUEDÓ AFUERA') + ' · Al desactivar la cuenta: ' +
                   (baja.ok ? 'la desactivó, no debería' : baja.motivo)
        });
      })();

      /* ── 23 · 🔴 EL AUTO NO SALE SIN PASAR POR CONTROL DE CALIDAD ────────
         Pedido de Marco el 13-08-2026: «el control de calidad se hace antes de
         entregar el auto». Son DOS puertas y las dos tienen que estar
         trabadas, porque el vehículo puede salir por cualquiera de las dos:
         cerrando la etapa Entrega, o registrando la entrega —que es la
         operación que lo manda al histórico—.

         Y una tercera comprobación que importa igual: la orden que NUNCA pasó
         por calidad sí se entrega. Una pérdida total o un rechazo no pueden
         quedar atrapados esperando un control que jamás les aplicó. */
      (function () {
        const idDe = (c) => (db.etapa.find((e) => e.codigo === c) || {}).id;
        const final = db.estado.find((e) => (e.alcanzable_en || []).indexOf('entrega') >= 0) || {};

        // Una orden con Calidad y Entrega asignadas, las dos abiertas.
        const o = Modelo.torre().find((x) => !(x.etapasAsignadas || []).length);
        Modelo.asignar_etapas(o.id, [idDe('calidad'), idDe('entrega')]);

        const puerta1 = Modelo.finalizar_etapa(o.id, 'entrega', null);
        const puerta2 = Modelo.registrar_entrega(o.id, { estado: final.codigo, fecha: HOY });

        Modelo.finalizar_etapa(o.id, 'calidad', null);
        const ahoraSi = Modelo.registrar_entrega(o.id, { estado: final.codigo, fecha: HOY });

        // Y la que nunca pasó por calidad no queda atrapada.
        const libre = Modelo.torre().find((x) => !(x.etapasAsignadas || []).some((a) => a.codigo === 'calidad'));
        const sinCalidad = libre
          ? Modelo.registrar_entrega(libre.id, { estado: final.codigo, fecha: HOY })
          : { ok: true };

        push({
          nombre: '🔴 El auto no sale sin pasar por Control de calidad',
          intento: 'En la OT ' + o.numeroOT + ', con calidad abierta: cerrar la etapa Entrega y ' +
                   'registrar la entrega. Después cerrar calidad y volver a entregar',
          esperado: 'Las dos rebotan mientras calidad esté abierta; con calidad cerrada, entrega',
          paso: !puerta1.ok && !puerta2.ok && ahoraSi.ok && sinCalidad.ok,
          detalle: 'Etapa Entrega: ' + (puerta1.motivo || 'la cerró, no debería') +
                   ' · Entregar: ' + (puerta2.motivo || 'entregó, no debería') +
                   ' · Con calidad cerrada: ' + (ahoraSi.ok ? 'entrega' : 'NO DEJÓ — ' + ahoraSi.motivo) +
                   ' · Sin calidad asignada: ' + (sinCalidad.ok ? 'entrega' : 'QUEDÓ ATRAPADA')
        });
      })();

      /* ── 24 · Toda operación que escribe deja su hecho ───────────────────
         La razón de esta prueba es que el agujero anterior era invisible: 15
         de las 41 operaciones registraban, y no había forma de notar cuáles
         faltaban hasta que el expediente aparecía incompleto — justo cuando
         se necesita para responderle a una compañía.

         Se prueban tres operaciones que ANTES no dejaban ningún rastro, y se
         comprueba además que el hecho queda con el autor correcto y que lo
         rechazado no ensucia el registro. */
      (function () {
        const o = Modelo.torre().find((x) => !x.fueraDeTaller) || Modelo.torre()[0];

        /* 🔴 LOS HECHOS NUEVOS SE IDENTIFICAN, NO SE CUENTAN DESDE EL FINAL.
           Esto tomaba los dos ÚLTIMOS del expediente, dando por hecho que lo
           recién escrito queda al final. No queda: el expediente ordena por
           fecha, y `ahora()` es el día del calendario de la demostración con la
           hora del reloj de verdad. Pasada la medianoche esa hora —00:14— es
           anterior a la de todo lo sembrado ese día, que va entre las 8:00 y
           las 17:59. El hecho nuevo se iba al principio y la prueba miraba dos
           sembrados: "Repuesto pedido por SIN AUTOR" no era un fallo del
           registro, era la prueba mirando el lugar equivocado.

           Se cayó sola la madrugada del 17-08-2026 sin que nadie tocara el
           motor. Una prueba que depende de la hora a la que se corre no sirve
           para lo que existe. */
        const llave = (h) => h.titulo + '|' + (+h.fecha) + '|' + h.seq;
        const habia = new Set(Modelo.expedienteDe(o.numeroOT).hechos.map(llave));
        const antes = habia.size;

        /* Con sesión abierta, que es la única forma en que el sistema se usa:
           la pantalla de ingreso no deja entrar sin ella. Sin fijarla, esta
           misma prueba destapó que el autor quedaba disparejo —el evento caía
           al usuario administrador por defecto y la marca del repuesto quedaba
           nula—, que es exactamente lo que no puede pasar en un registro que
           sirve para responderle a una compañía.

           Va con una cuenta de rol total: las dos operaciones piden permisos
           distintos —la fecha es del jefe de taller y el repuesto es de
           bodega— y acá se está probando el registro, no el reparto. */
        const quien = (db.persona.find((p) => p.correo === 'gabriel.diaz@dyp.cl') || {}).id;
        Modelo.fijar_persona_actual(quien);

        const fecha = Modelo.fijar_fecha_compromiso(o.id, new Date(2026, 8, 30));
        const rep = Modelo.cargar_repuesto(o.id, { descripcion: 'Repuesto de prueba', cantidad: 1 });
        // Rechazada por una regla: no cambió nada, así que no puede dejar hecho.
        const mala = Modelo.escribir_bitacora(o.id, { asunto_id: 'no-existe', mensaje: 'x' });

        const ex = Modelo.expedienteDe(o.numeroOT);
        const nuevos = ex.hechos.filter((h) => !habia.has(llave(h)));
        const conAutor = nuevos.filter((h) => h.quien).length;

        push({
          nombre: '🔴 Toda operación que escribe deja su hecho, con autor',
          intento: 'En la OT ' + o.numeroOT + ': fijar la fecha de entrega y cargar un repuesto ' +
                   '—dos operaciones que antes no registraban nada— más una bitácora que la regla rechaza',
          esperado: 'Dos hechos nuevos, los dos con autor. La rechazada no deja ninguno',
          paso: fecha.ok && rep.ok && !mala.ok && nuevos.length === 2 && conAutor === 2,
          detalle: 'Hechos: ' + antes + ' → ' + ex.hechos.length + ' (' + nuevos.length + ' nuevos, ' +
                   conAutor + ' con autor) · ' +
                   nuevos.map((h) => h.titulo + ' por ' + (h.quien || 'SIN AUTOR')).join(' · ') +
                   ' · Rechazada: ' + (mala.ok ? 'PASÓ, no debería' : 'rebotó sin registrar')
        });
      })();

      /* ── 25 · El registro no se edita ────────────────────────────────────
         "Un registro que se puede corregir después no sirve para lo que él lo
         quiere usar." Se comprueba en la superficie del motor: si mañana
         alguien agrega una operación que toque la tabla `evento`, esta prueba
         se cae y hay que discutirlo, que es justamente lo que se busca. */
      (function () {
        const escriben = Object.keys(Modelo).filter((k) =>
          /evento/i.test(k) && /^(editar|eliminar|borrar|actualizar|guardar|fijar|corregir)/.test(k));

        const o = Modelo.torre()[0];
        const ex = Modelo.expedienteDe(o.numeroOT);
        // El expediente entrega copias: tocar lo que devuelve no altera la base.
        const original = ex.hechos.length ? ex.hechos[0].titulo : '';
        if (ex.hechos.length) ex.hechos[0].titulo = 'ADULTERADO';
        const relectura = Modelo.expedienteDe(o.numeroOT);
        const aguanta = !relectura.hechos.length || relectura.hechos[0].titulo === original;

        push({
          nombre: '🔴 El registro de hechos no se puede editar',
          intento: 'Buscar en el motor alguna operación que edite o borre un hecho, y ' +
                   'modificar a mano lo que devuelve el expediente',
          esperado: 'Ninguna operación de escritura sobre el registro, y la base intacta',
          paso: escriben.length === 0 && aguanta,
          detalle: escriben.length
            ? 'APARECIERON operaciones que escriben el registro: ' + escriben.join(', ')
            : 'Ninguna operación edita ni borra hechos · el expediente releído sigue diciendo «' +
              original + '»'
        });
      })();

      /* ── 26 · 🔴 EL ÍTEM QUE NADIE MIRÓ NO ES UN ÍTEM FALTANTE ──────────
         El cambio de modelo del 15-08-2026. Con el booleano `presente`, un
         checklist que nadie tocó se guardaba entero en `false` y se leía como
         "al auto le faltaban los 28 ítems" — que es exactamente el reclamo que
         el taller no puede permitirse tener guardado por escrito.

         Se prueban las dos mitades: lo que no se declara queda `sin_verificar`,
         y lo que sí se declara se guarda tal cual, con `danado` distinto de
         `no_presente`. */
      (function () {
        // Sin persona fijada: se lee una orden recién creada y el alcance del
        // rol decide qué devuelve `otPorId`. Acá se prueba el checklist, no el
        // reparto de permisos.
        restaurarSesion();
        Modelo.fijar_persona_actual(null);

        const items = db.inventario_item;
        const pedido = {};
        pedido[items[0].id] = 'presente';
        pedido[items[1].id] = 'no_presente';
        pedido[items[2].id] = 'danado';

        const r = Modelo.crear_ot_desde_recepcion(
          { patente: 'ZZZZ98', nombre: 'Cliente de Prueba', rut: '11.111.111-2',
            vin: 'PRUEBA00000000098', inventario: pedido, obsInventario: {}, demo: true },
          [{ tipo_ingreso_id: 'ti-2' }], 'prueba-inventario-cuatro');

        const ot = r.ok ? Modelo.otPorId(r.ordenes[0].ot_id) : null;
        const inv = ot ? ot.inventario : [];
        const cuenta = (c) => inv.filter((i) => i.estado === c).length;
        const sinTocar = items.length - 3;

        const ok = !!ot && inv.length === items.length &&
          inv[0].estado === 'presente' && inv[1].estado === 'no_presente' &&
          inv[2].estado === 'danado' && cuenta('sin_verificar') === sinTocar;

        push({
          nombre: '🔴 El ítem del checklist que nadie miró queda «sin verificar», no «no presente»',
          intento: 'Guardar una recepción declarando 3 de los ' + items.length +
                   ' ítems y dejando los otros ' + sinTocar + ' sin tocar',
          esperado: '1 presente · 1 no presente · 1 dañado · ' + sinTocar + ' sin verificar',
          paso: ok,
          detalle: !ot ? ('No se pudo crear la recepción: ' + r.motivo)
            : cuenta('presente') + ' presente · ' + cuenta('no_presente') + ' no presente · ' +
              cuenta('danado') + ' dañado · ' + cuenta('sin_verificar') + ' sin verificar' +
              (ok ? '' : '  ·  NO CUADRA: con un booleano los ' + sinTocar +
                ' sin mirar se guardaban como faltantes.')
        });
      })();

      /* ── 27 · 🔴 LA MISMA PATENTE NO PUEDE ENTRAR DE DOS FORMAS ────────
         Una patente chilena tiene seis caracteres. El guión, el punto y las
         minúsculas que a veces se escriben son decoración, y si se guardan, el
         MISMO vehículo queda como `AABB11` y como `aa-bb-11`: el buscador de
         Entrega encuentra uno y no el otro, y el historial del auto se parte
         en dos. Se normaliza al escribir, no al guardar.

         El corte en seis va en la misma prueba porque es la otra mitad de lo
         mismo: `AABB1199` no es una patente con dos caracteres de más, es un
         error de tipeo que hay que atajar en el mesón. */
      (function () {
        const variantes = ['AABB11', 'aabb11', 'AA-BB-11', ' aa bb 11 ', 'AA.BB.11'];
        const normalizadas = variantes.map(normalizarPatente);
        const todasIguales = normalizadas.every((p) => p === 'AABB11');
        const cortada = normalizarPatente('AABB1199');
        const ok = todasIguales && cortada === 'AABB11' && cortada.length === PATENTE_LARGO;

        push({
          nombre: '🔴 La misma patente escrita de cinco formas se guarda una sola vez',
          intento: 'Normalizar ' + variantes.map((v) => '«' + v + '»').join(', ') +
                   ' y además «AABB1199», que tiene dos caracteres de más',
          esperado: 'Las cinco dan AABB11, y la larga se corta en ' + PATENTE_LARGO,
          paso: ok,
          detalle: normalizadas.map((p) => '«' + p + '»').join(' ') +
            '  ·  AABB1199 → «' + cortada + '»' +
            (ok ? '' : '  ·  NO CUADRA: dos escrituras distintas del mismo vehículo.')
        });
      })();

      /* ── 28 · 🔴 PROGRAMAR LA ENTREGA NO ES HABER ENTREGADO ──────────────
         Pedido del cliente el 15-08-2026: poder poner una fecha de entrega
         futura. El riesgo está a la vista — que "programar" termine cerrando
         la orden y el auto desaparezca de la torre estando todavía en el
         taller, con el cliente esperando que lo llamen el jueves.

         Se prueban las dos mitades del mismo hecho: la fecha queda escrita, y
         la orden sigue viva, en la torre y sin estado final. */
      (function () {
        restaurarSesion();
        const quien = (db.persona.find((p) => p.correo === 'gabriel.diaz@dyp.cl') || {}).id;
        Modelo.fijar_persona_actual(quien);

        const o = Modelo.torre()[0];
        const cuando = new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate() + 5, 15, 0);
        const r = o ? Modelo.programar_entrega(o.id, cuando, 'Comprometido con el cliente') : { ok: false };
        const luego = o ? Modelo.otPorId(o.id) : null;
        const enTorre = o ? Modelo.torre().some((x) => x.id === o.id) : false;

        const quedoLaFecha = !!luego && !!luego.fechaCompromiso &&
          luego.fechaCompromiso.getTime() === cuando.getTime();

        push({
          nombre: '🔴 Programar la entrega deja la fecha, no cierra la orden',
          intento: o ? ('Programar la OT ' + o.numeroOT + ' para el ' +
                   cuando.toLocaleDateString('es-CL')) : 'No había ninguna orden viva que programar',
          esperado: 'La fecha comprometida queda escrita · la orden sigue abierta y en la torre',
          paso: r.ok && quedoLaFecha && !!luego && !luego.esFinal && enTorre,
          detalle: !o ? 'La torre vino vacía.' : (!r.ok ? ('Rebotó: ' + r.motivo) :
            'Fecha comprometida: ' + (luego.fechaCompromiso
              ? luego.fechaCompromiso.toLocaleDateString('es-CL') : 'NO QUEDÓ') +
            ' · Estado: ' + luego.estadoNombre + (luego.esFinal ? ' (FINAL, no debería)' : ' (abierta)') +
            ' · En la torre: ' + (enTorre ? 'sí' : 'NO, se la llevó'))
        });
      })();

      /* ── 29 · 🔴 EL TOPE DEL CAMPO NO PUEDE VIVIR EN EL NAVEGADOR ──────
         Reclamo del cliente el 15-08-2026: *"aun deja pasarme de 17
         caracteres"*, con un VIN de 29 en pantalla y el tope ya publicado.

         La causa: `maxlength` es del navegador y solo frena lo que TECLEA una
         persona. El formulario se guarda solo en `localStorage`, así que un
         VIN escrito antes de que existiera el tope quedaba guardado y se
         repintaba entero en cada recarga — el campo se veía sin límite aunque
         el límite estuviera puesto.

         Por eso el corte tiene que estar en el DATO. Esta prueba mide justo
         eso: lo que llega de afuera, no lo que se teclea. */
      (function () {
        const largo = '64646465646846464646468464868';   // 29, el del reclamo
        const cortado = normalizarVin(largo);
        const conBasura = normalizarVin(' 1hgcm8-2633a 004352 ');
        const patSucia = normalizarPatente('AABB1199');

        const ok = cortado.length === VIN_LARGO &&
                   cortado === largo.slice(0, VIN_LARGO) &&
                   conBasura === '1HGCM82633A004352' &&
                   patSucia.length === PATENTE_LARGO;

        push({
          nombre: '🔴 Un VIN largo guardado de antes se corta al volver a abrirlo',
          intento: 'Restaurar un borrador con un VIN de ' + largo.length +
                   ' caracteres, que `maxlength` no toca porque no se tecleó',
          esperado: 'Queda en ' + VIN_LARGO + ', en mayúsculas y sin espacios ni guiones',
          paso: ok,
          detalle: '«' + largo + '» → «' + cortado + '» (' + cortado.length + ')' +
            '  ·  con basura → «' + conBasura + '»' +
            (ok ? '' : '  ·  NO CUADRA: el tope se apoya en el navegador y no en el dato.')
        });
      })();

      /* ── 30 · 🔴 CORREGIR LA RECEPCIÓN NO BORRA LO QUE DECÍA ─────────────
         Editar Recepción se construyó el 15-08-2026 sobre una decisión que hay
         que confirmar con el taller: **se versiona, no se pisa**. Es la misma
         regla que el cliente defendió para el presupuesto, y acá pesa más
         porque hay una firma de por medio.

         Si esta prueba se cae, la corrección dejó de guardar lo anterior y el
         comprobante ya no puede decir qué cambió: eso no es un detalle de
         interfaz, es perder el respaldo frente a la compañía. */
      (function () {
        restaurarSesion();
        const quien = (db.persona.find((p) => p.correo === 'gabriel.diaz@dyp.cl') || {}).id;
        Modelo.fijar_persona_actual(quien);

        const o = Modelo.torre()[0];
        const rutAntes = o ? o.rut : null;

        // Sin motivo no se guarda: es lo único que separa corregir de alterar.
        const sinMotivo = o ? Modelo.corregir_recepcion(o.id, { cliente: { rut: '9.999.999-9' } }, '')
                            : { ok: true };
        const conMotivo = o ? Modelo.corregir_recepcion(o.id, { cliente: { rut: '9.999.999-9' } },
          'RUT mal digitado en el mesón') : { ok: false };

        const luego = o ? Modelo.otPorId(o.id) : null;
        const corr = luego && luego.recepcion ? Modelo.correccionesDeRecepcion(luego.recepcion.id) : [];
        const guardado = corr.length ? corr[0] : null;
        const conservaLoViejo = !!guardado && guardado.cambios.some((c) =>
          c.campo === 'RUT' && c.antes === rutAntes && c.despues === '9.999.999-9');

        push({
          nombre: '🔴 Corregir la recepción la versiona: guarda qué decía, quién y por qué',
          intento: o ? ('Corregir el RUT de la OT ' + o.numeroOT + ' sin motivo, y después con motivo')
                     : 'No había ninguna orden viva',
          esperado: 'Sin motivo rebota · con motivo queda la versión 2 con el valor anterior y su autor',
          paso: !sinMotivo.ok && conMotivo.ok && conservaLoViejo &&
                !!guardado && guardado.version === 2 && !!guardado.quien && !!guardado.motivo,
          detalle: !o ? 'La torre vino vacía.'
            : (sinMotivo.ok ? 'DEJÓ GUARDAR SIN MOTIVO, no debería.'
              : (!conMotivo.ok ? ('Rebotó con motivo: ' + conMotivo.motivo)
                : (!guardado ? 'No quedó registrada la corrección.'
                  : 'v' + guardado.version + ' por ' + guardado.quien + ' — ' +
                    guardado.cambios.map((c) => c.campo + ': «' + c.antes + '» → «' + c.despues + '»').join(' · ') +
                    (conservaLoViejo ? '' : '  ·  NO CONSERVÓ el valor anterior.'))))
        });
      })();

      /* ── 31 · 🔴 LA SILUETA CORREGIDA NO SE LLEVA LA QUE SE FIRMÓ ────────
         Los daños son el único campo de la recepción que es un DIBUJO, y se
         corrigen reemplazando la lista entera —así es el gesto: se raya y se
         borra lo que se rayó de más—. Si al reemplazarla no quedara guardada
         la anterior, «se versiona» sería mentira justo donde más importa: el
         estado en que entró el auto es lo que se discute con la compañía.

         Se comprueba lo que se pierde, no lo que se ve: que la fila de
         corrección conserve las marcas viejas **con sus trazos**. */
      (function () {
        restaurarSesion();
        const quien = (db.persona.find((p) => p.correo === 'gabriel.diaz@dyp.cl') || {}).id;
        Modelo.fijar_persona_actual(quien);

        const o = Modelo.torre().find((x) => (x.danos || []).length >= 2);
        const antes = o ? o.danos.length : 0;
        // Se quita la primera y se agrega una marca nueva en otra zona.
        const quedan = o ? o.danos.slice(1).map((d) => ({
          vista: d.vista, zona_id: null, zonaNombre: d.zonaNombre, severidad: d.severidad,
          x: d.x, y: d.y, descripcion: d.descripcion, trazo: d.trazo })) : [];
        quedan.push({ vista: 'superior', zona_id: null, zonaNombre: 'Techo', severidad: 2,
          x: 0.5, y: 0.2, descripcion: 'Marca agregada en la corrección',
          trazo: [{ x: 0.5, y: 0.2 }, { x: 0.52, y: 0.21 }] });

        const r = o ? Modelo.corregir_recepcion(o.id, { danos: quedan },
          'Se marcó una raya que no era del siniestro') : { ok: false };

        const luego = o ? Modelo.otPorId(o.id) : null;
        const corr = luego && luego.recepcion ? Modelo.correccionesDeRecepcion(luego.recepcion.id) : [];
        const viejas = corr.length ? (corr[0].danosAntes || []) : [];

        push({
          nombre: '🔴 Corregir la silueta guarda entera la que estaba, con sus trazos',
          intento: o ? ('Quitar una marca de la OT ' + o.numeroOT + ' y agregar otra: ' +
                   antes + ' marcas → ' + quedan.length) : 'No había ninguna orden con daños marcados',
          esperado: 'La orden queda con las marcas nuevas y la corrección conserva las ' + antes + ' anteriores',
          paso: r.ok && !!luego && luego.danos.length === quedan.length && viejas.length === antes,
          detalle: !o ? 'Ninguna orden de la semilla trae dos o más daños.'
            : (!r.ok ? ('Rebotó: ' + r.motivo)
              : 'Ahora: ' + luego.danos.map((d) => d.zonaNombre || '—').join(', ') +
                '  ·  Guardadas en la corrección: ' + viejas.length + ' de ' + antes +
                (viejas.length === antes ? '' : '  ·  SE PERDIÓ la silueta anterior.'))
        });
      })();

      /* ── 32 · 🔴 NADIE ABRE UNA DETENCIÓN SIN EL PERMISO ─────────────────
         C-1 de la auditoría del 16-08-2026. `abrir_detencion` y
         `cerrar_detencion` estaban en `ESCRIBEN` —dejaban su hecho— pero no en
         `PERMISO_DE`, y `conPermiso` sólo envuelve lo que aparece en ese mapa:
         cualquiera podía detener una orden.

         No era explotable porque ninguna pantalla las llama todavía. Pasaba a
         serlo el día que se construyera Esperas, que es justo lo que está
         modelado esperando — y ese día nadie se habría acordado de revisarlo.

         Se prueban los dos lados: que al operario lo rechace NOMBRANDO el
         permiso que le falta, y que a administración la deje. Un permiso que
         rechaza a todos no es un permiso, es una pared. */
      (function () {
        restaurarSesion();
        const o = abiertaCualquiera();
        const motivos = db.motivo_detencion || [];

        /* 🔴 Se busca por el PERMISO QUE FALTA y no por el correo de una
           cuenta concreta. Decía `pintura@` y esa cuenta se borró el 22-08-2026
           por no estar en la lista de Andrés: `find` devolvía `undefined`, la
           sesión caía al rol de antes —que sí podía— y la prueba pasaba a decir
           que el operario «lo dejó pasar». Un guardián que se cae en verde es
           peor que no tenerlo. */
        const operario = db.persona.filter((p) => p.activo).find((p) => {
          Modelo.fijar_persona_actual(p.id);
          return !Modelo.puede('detencion.gestionar');
        });
        Modelo.fijar_persona_actual(operario ? operario.id : null);
        // Recibe el CÓDIGO del motivo, no su id ni un objeto.
        const codigo = motivos.length ? motivos[0].codigo : null;
        const comoOperario = Modelo.abrir_detencion(o.id, codigo, 'prueba de permiso');

        const admin = db.persona.find((p) => p.correo === 'gabriel.diaz@dyp.cl');
        Modelo.fijar_persona_actual(admin ? admin.id : null);
        const comoAdmin = Modelo.abrir_detencion(o.id, codigo, 'prueba de permiso');

        const nombraElPermiso = !comoOperario.ok &&
          /permiso|detencion\.gestionar|no tiene/i.test(comoOperario.motivo || '');

        push({
          nombre: '🔴 Nadie abre una detención sin el permiso para hacerlo',
          intento: 'Abrir una detención en la OT ' + o.numero_ot + ' con cuenta de Pintura, y ' +
                   'después con administración',
          esperado: 'Al operario lo rechaza diciendo qué permiso falta · a administración la deja',
          paso: !comoOperario.ok && nombraElPermiso && comoAdmin.ok,
          detalle: 'Operario: ' + (comoOperario.ok
            ? 'LO DEJÓ PASAR, no debería' : (comoOperario.motivo || 'rechazó sin decir por qué')) +
            '  ·  Administración: ' + (comoAdmin.ok ? 'pudo' : 'NO PUDO — ' + comoAdmin.motivo)
        });
      })();

      /* ── 33 · Una firma del motor no revienta: rechaza y explica ─────────
         A-1 de la misma auditoría. `crear_presupuesto` desestructuraba su
         segundo argumento sin valor por omisión: llamarla con uno solo lanzaba
         un `TypeError` y dejaba la pantalla a medio pintar. Contradice la regla
         de la casa —el botón se aprieta siempre y la regla explica el motivo—
         porque un `TypeError` no explica nada.

         Se prueban las cinco firmas que desestructuran, no sólo la del
         hallazgo: si mañana alguien agrega una sexta sin `= {}`, esta prueba la
         encuentra. */
      (function () {
        restaurarSesion();
        const o = abiertaCualquiera();
        const firmas = ['crear_presupuesto', 'registrar_entrega', 'cargar_repuesto',
          'agregar_costo_adicional', 'escribir_bitacora'];
        const reventaron = [];
        firmas.forEach((f) => {
          try {
            const r = Modelo[f](o.id);
            if (!r || typeof r.ok !== 'boolean') reventaron.push(f + ' (no devolvió ok/motivo)');
          } catch (e) { reventaron.push(f + ' → ' + e.message); }
        });

        push({
          nombre: 'Ninguna operación del motor revienta por un argumento que falta',
          intento: 'Llamar las ' + firmas.length + ' operaciones que desestructuran su segundo ' +
                   'argumento pasándoles sólo la orden',
          esperado: 'Las ' + firmas.length + ' devuelven { ok, motivo }, ninguna lanza excepción',
          paso: !reventaron.length,
          detalle: reventaron.length
            ? 'Reventaron: ' + reventaron.join(' · ')
            : 'Las ' + firmas.length + ' rechazaron explicando, sin excepciones.'
        });
      })();

      /* ── 34 · 🔴 APROBAR UN PRESUPUESTO PIDE SUS REPUESTOS A BODEGA ──────
         F-1 de la auditoría del 16-08-2026, y es el hallazgo que más duele:
         `generar_repuestos_desde_presupuesto` existía, funcionaba y **nadie la
         llamaba**. El único camino que quedaba era que el bodeguero volviera a
         escribir a mano lo que el presupuestador ya había escrito — la
         redigitación, que es el dolor #1 que el cliente nos describió de su
         sistema actual, reproducido dentro del nuestro.

         Se prueba el camino completo SIN llamar la función a mano. */
      (function () {
        restaurarSesion();
        const admin = db.persona.find((p) => p.correo === 'gabriel.diaz@dyp.cl');
        Modelo.fijar_persona_actual(admin ? admin.id : null);

        const o = db.orden_trabajo.find((x) => Reglas.estaAbierta(db, x.estado) &&
          !db.repuesto.some((r) => r.ot_id === x.id));
        if (!o) return push({ nombre: '🔴 Aprobar un presupuesto pide sus repuestos a bodega',
          intento: '—', esperado: '—', paso: false,
          detalle: 'No se encontró una orden abierta y sin repuestos en la semilla.' });

        const cre = Modelo.crear_presupuesto(o.id, { lineas: [] });
        const pid = cre.presupuesto_id;
        const lin = Modelo.agregar_linea_presupuesto(pid, {
          proceso: 'cambio', descripcion: 'Paragolpes delantero', horas_dm: 1.2 });
        /* 🔴 Y NADA MÁS. Acá había un `agregar_fila_presupuesto` que escribía
           la pieza A MANO, porque hasta el 26-08-2026 el sistema no la bajaba
           solo. Ahora la baja la OP «Cambio», así que escribirla otra vez
           duplicaría — y la prueba lo cazó apenas se hizo el cambio.

           Dejarla habría sido peor que un falso rojo: la prueba estaría
           montando un flujo que ya no existe, y de paso tapando justo lo que
           ahora hay que comprobar — que la línea SOLA alcanza. */
        const env = Modelo.cambiar_estado_presupuesto(pid, 'enviado');
        const apr = Modelo.cambiar_estado_presupuesto(pid, 'aprobado');

        const pedidos = db.repuesto.filter((r) => r.ot_id === o.id);
        const ligado = pedidos.filter((r) => r.presupuesto_linea_id).length;

        push({
          nombre: '🔴 Aprobar un presupuesto pide sus repuestos a bodega',
          intento: 'En la OT ' + o.numero_ot + ': crear la OR, agregarle UNA línea de proceso ' +
                   'Cambio, enviarla y aprobarla — sin escribir el repuesto en ninguna parte',
          esperado: 'Un repuesto pendiente, ligado a la línea de presupuesto que lo originó',
          paso: cre.ok && lin.ok && env.ok && apr.ok && pedidos.length === 1 && ligado === 1,
          detalle: !apr.ok ? ('La aprobación falló: ' + apr.motivo)
            : (pedidos.length + ' repuesto(s), ' + ligado + ' ligado(s) a su línea' +
              (pedidos.length ? ' · ' + pedidos.map((r) => r.descripcion).join(', ')
                : '  ·  NADIE los pidió: el bodeguero tendría que escribirlos de nuevo a mano.'))
        });
      })();

      /* 🔴 NINGUNA PANTALLA PUEDE DECIR «SIN OR» (27-08-2026, Marco: «seguimos
         teniendo el problema que el panel de presupuesto te dice sin OR; la OR,
         como ya te lo comenté, te dije qué era y cómo se generaba»).

         Desde el 26-08 la OR nace CON la orden y es correlativa: no existe una
         orden sin OR. Lo que puede faltar es el presupuesto. El rótulo viejo
         sobrevivió en tres pantallas y en un comentario que lo defendía, porque
         cada uno se arregló por separado y por su nombre.

         Esta prueba no mira un rótulo: mira que NINGUNA pantalla lo diga, y que
         el listado de Presupuesto muestre la OR de cada orden aunque todavía no
         tenga presupuesto. Es la forma de que no vuelva por una cuarta puerta. */
      (function () {
        restaurarSesion();
        const admin = db.persona.find((x) => x.correo === 'gabriel.diaz@dyp.cl');
        Modelo.fijar_persona_actual(admin ? admin.id : null);

        const pantallas = [];
        const pintar = (nombre, fn) => {
          try { pantallas.push([nombre, fn() || '']); } catch (e) { pantallas.push([nombre, 'REVENTÓ ' + e.message]); }
        };
        ui.presupuesto = { otId: null, presupuestoId: null, busqueda: '', linea: { proceso: '', descripcion: '' } };
        pintar('Presupuesto', () => (typeof vPresupuesto === 'function' ? vPresupuesto() : ''));
        pintar('Reportería', () => (typeof vReporteria === 'function' ? vReporteria() : ''));
        pintar('Consolidado', () => (typeof vConsolidado === 'function' ? vConsolidado() : ''));

        const culpables = pantallas.filter(([, h]) => /sin OR/i.test(h)).map(([n]) => n);

        // Y la OR de una orden sin presupuesto tiene que estar a la vista.
        const sinPresu = db.orden_trabajo.find((o) => Reglas.estaAbierta(db, o.estado) &&
          !db.presupuesto.some((p) => p.ot_id === o.id));
        const listado = (pantallas[0] || [])[1] || '';
        const muestraSuOR = !sinPresu || !sinPresu.numero_or ||
          listado.indexOf(String(sinPresu.numero_or)) >= 0;

        push({
          nombre: '🔴 Ninguna pantalla dice «sin OR»: la OR nace con la orden',
          intento: 'Pintar Presupuesto, Reportería y Consolidado y buscar el rótulo',
          esperado: 'No aparece en ninguna, y el listado muestra la OR de una orden sin presupuesto',
          paso: !culpables.length && muestraSuOR,
          detalle: culpables.length
            ? 'Todavía lo dice: ' + culpables.join(', ') + '. La OR existe desde la recepción'
            : (!muestraSuOR
              ? 'La orden ' + sinPresu.numero_ot + ' tiene la OR ' + sinPresu.numero_or +
                ' y el listado no la muestra'
              : 'Lo que falta se llama «sin presupuesto», que es lo que de verdad falta')
        });
      })();

      /* 🔴 CORRER LA FECHA DE ENTREGA NO BORRA LA ANTERIOR (27-08-2026, Marco:
         «quiero que quede la trazabilidad de que se cambia la fecha de entrega
         al cliente, porque si no el cálculo de comprometida vs real pierde
         trazabilidad»).

         Es la prueba que hace que el KPI pueda dar MAL. Con un solo campo que
         se pisa, «se entregó a tiempo» compara contra la última fecha —la que
         ya se movió para que calzara— y da bien siempre. Acá se ata que la 1ª
         sobreviva a las que vengan después. */
      (function () {
        restaurarSesion();
        const admin = db.persona.find((x) => x.correo === 'gabriel.diaz@dyp.cl');
        Modelo.fijar_persona_actual(admin ? admin.id : null);
        const o = db.orden_trabajo.find((x) => Reglas.estaAbierta(db, x.estado));
        const antes = Modelo.compromisosDe(o.id);
        const primera = antes.length ? antes[0].fecha : null;

        const d1 = new Date(2027, 0, 15, 10, 30);
        const d2 = new Date(2027, 0, 28, 16, 0);
        const r1 = Modelo.fijar_fecha_compromiso(o.id, d1);
        const r2 = Modelo.programar_entrega(o.id, d2, 'El repuesto no llegó');
        const h = Modelo.compromisosDe(o.id);
        // `vistaOT` recibe la ORDEN, no su id; el que recibe el id es `otPorId`.
        const vista = Modelo.otPorId(o.id);

        const numerosSeguidos = h.every((x, i) => x.n === i + 1);
        const primeraIntacta = !primera ||
          new Date(h[0].fecha).getTime() === new Date(primera).getTime();
        const ultima = h[h.length - 1];

        push({
          nombre: '🔴 Correr la fecha de entrega no borra la que se prometió',
          intento: 'Mover dos veces la fecha comprometida, desde etapas y desde programar entrega',
          esperado: 'Quedan todas, numeradas 1..n; la 1ª intacta y la vigente es la última',
          paso: r1.ok && r2.ok && h.length === antes.length + 2 &&
                numerosSeguidos && primeraIntacta &&
                new Date(ultima.fecha).getTime() === d2.getTime() &&
                new Date(vista.fechaCompromiso).getTime() === d2.getTime() &&
                (vista.compromisos || []).length === h.length,
          detalle: h.length !== antes.length + 2
            ? 'Se guardaron ' + (h.length - antes.length) + ' de 2: la historia se está pisando'
            : (!primeraIntacta ? 'La 1ª fecha cambió: el KPI ya no puede dar mal'
              : (!numerosSeguidos ? 'Los números no van 1, 2, 3'
                : h.length + ' fechas, la 1ª del ' +
                  new Date(h[0].fecha).toLocaleDateString("es-CL") + ' y la vigente del ' +
                  new Date(ultima.fecha).toLocaleDateString("es-CL")))
        });
      })();

      /* 🔴 «CAMBIO» BAJA LA DESCRIPCIÓN A REPUESTOS, EN BLANCO (26-08-2026).

         Marco, después de ver presupuestar en terreno: «cuando ponen Cambio,
         lo que están colocando en Descripción debe fluir directamente a
         Repuesto, con cantidad 1, sin proveedor y sin monto».

         Las tres condiciones se comprueban por separado a propósito. Que baje
         es la mitad fácil; que baje EN BLANCO es la otra mitad, y es la que se
         rompe sola el día que alguien decida «aprovechar» y copiarle el precio
         de la mano de obra. */
      (function () {
        restaurarSesion();
        const admin = db.persona.find((p) => p.correo === 'gabriel.diaz@dyp.cl');
        Modelo.fijar_persona_actual(admin ? admin.id : null);
        const o = db.orden_trabajo.find((x) => Reglas.estaAbierta(db, x.estado) &&
          !db.repuesto.some((r) => r.ot_id === x.id));
        if (!o) return;

        const pid = Modelo.crear_presupuesto(o.id, { lineas: [] }).presupuesto_id;
        const DESC = 'Llanta aleación delantera derecha aro 18';
        const r1 = Modelo.agregar_linea_presupuesto(pid, { proceso: 'cambio', descripcion: DESC });

        /* 🔴 SE MIDE EL BLOQUE REPUESTOS DEL PRESUPUESTO, NO BODEGA (27-08-2026).

           Esta prueba miraba `db.repuesto` —la solicitud de bodega— y por eso
           daba verde mientras la pantalla que Marco tenía delante decía «Sin
           repuestos». Las dos cosas eran ciertas, en tablas distintas: la
           implementación bajaba a bodega y la tabla del presupuesto quedaba
           vacía. Una prueba que mide la tubería equivocada no prueba nada. */
        const bajo = db.presupuesto_linea.filter((l) => l.presupuesto_id === pid && Reglas.esRepuesto(l));
        const uno = bajo[0] || {};
        /* Y de la fila de Repuestos a bodega, que es automatico: la pieza que
           hay que comprar la ve bodega desde que se escribe, sin esperar la
           aprobacion de la compania. Lo que se corrigio hoy no fue CUANDO
           viaja: fue DE DONDE sale — del bloque Repuestos y no de la OP. */
        const enBodega = db.repuesto.filter((r) => r.ot_id === o.id);
        const laPieza = enBodega.filter((r) => r.presupuesto_linea_id === (bajo[0] || {}).id)[0];

        // Y una de Reparar NO puede bajar nada.
        const antes = bajo.length;
        Modelo.agregar_linea_presupuesto(pid, { proceso: 'reparar', descripcion: 'Pulir costado' });
        const trasReparar = db.presupuesto_linea.filter((l) => l.presupuesto_id === pid && Reglas.esRepuesto(l)).length;

        push({
          nombre: '🔴 La OP «Cambio» baja la descripción a Repuestos, en blanco',
          intento: 'Agregar una línea de Cambio con la descripción y mirar la tabla de repuestos',
          esperado: 'Una FILA EN REPUESTOS del presupuesto con esa misma descripción, cantidad 1, ' +
                    'sin proveedor y sin precio, y su pieza en bodega. Reparar no baja nada',
          paso: r1.ok && bajo.length === 1 && uno.descripcion === DESC &&
                uno.cantidad === 1 && !uno.proveedor && !uno.precio_unitario &&
                trasReparar === antes && enBodega.length === 1 &&
                !!laPieza && laPieza.descripcion === DESC,
          detalle: !bajo.length
            ? 'No bajó nada: el evaluador tendría que escribir la pieza otra vez, a mano'
            : (uno.descripcion !== DESC ? 'Bajó con otra descripción: «' + uno.descripcion + '»'
              : (uno.proveedor || uno.precio_unitario
                ? 'Bajó con proveedor o precio puestos, y eso lo cotiza bodega después'
                : (trasReparar !== antes ? 'Una línea de Reparar también bajó un repuesto'
                  : (!laPieza ? 'Quedó en el presupuesto y bodega no se enteró: la pieza hay que comprarla'
                    : 'Baja sola al bloque de Repuestos, en blanco, y de ahí a bodega'))))
        });
      })();

      /* 🔴 PRESUPUESTAR NO CREA UNA OR (27-08-2026, Marco: «no deben poder
         agregar OR acá; la OR se crea cuando generan una OT en su primer
         momento»).

         La prueba no mira la pantalla: mira el CORRELATIVO. Si alguien vuelve
         a poner `Reglas.siguienteNumeroOR(db)` dentro de `crear_presupuesto`
         —que es como estaba antes del 26-08— el número de la orden y el del
         presupuesto se separan y el contador salta. Eso es lo que se ata acá,
         y por eso sobrevive a que la pantalla se redibuje entera. */
      (function () {
        restaurarSesion();
        const admin = db.persona.find((x) => x.correo === 'gabriel.diaz@dyp.cl');
        Modelo.fijar_persona_actual(admin ? admin.id : null);
        const o = db.orden_trabajo.find((x) => Reglas.estaAbierta(db, x.estado));
        const orAntes = o.numero_or;
        const contadorAntes = Number(Reglas.parametro(db, 'correlativo_or', 0));

        const r = Modelo.crear_presupuesto(o.id, { lineas: [] });
        const pr = r.ok && db.presupuesto.find((x) => x.id === r.presupuesto_id);
        const contadorDespues = Number(Reglas.parametro(db, 'correlativo_or', 0));

        push({
          nombre: '🔴 Generar un presupuesto no abre una OR nueva',
          intento: 'Generar el presupuesto de una orden y mirar su OR y el correlativo',
          esperado: 'El presupuesto lleva la MISMA OR de la orden y el correlativo no se mueve',
          paso: !!pr && String(pr.numero_or) === String(orAntes) &&
                String(o.numero_or) === String(orAntes) &&
                contadorDespues === contadorAntes,
          detalle: !pr ? 'No se pudo generar el presupuesto: ' + r.motivo
            : (String(pr.numero_or) !== String(orAntes)
              ? 'El presupuesto nació con la OR ' + pr.numero_or + ' y la orden tiene la ' + orAntes
              : (contadorDespues !== contadorAntes
                ? 'El correlativo saltó de ' + contadorAntes + ' a ' + contadorDespues +
                  ': se consumió una OR que nadie va a usar'
                : 'Misma OR ' + orAntes + ', correlativo quieto en ' + contadorAntes))
        });
      })();

      /* Y la pantalla, que es donde Marco lo vio: el módulo Presupuesto no
         puede ofrecer abrir una OR. Se mira el HTML de verdad, no una bandera:
         una prueba que compruebe «existe la función» daría verde con el botón
         puesto igual. */
      (function () {
        restaurarSesion();
        const admin = db.persona.find((x) => x.correo === 'gabriel.diaz@dyp.cl');
        Modelo.fijar_persona_actual(admin ? admin.id : null);
        /* Una orden SIN presupuesto todavia: es el caso que Marco vio, la
           recepcion recien hecha. Con uno ya generado la pantalla muestra la
           grilla y no el desplegable, y la prueba estaria mirando otra cosa. */
        const o = db.orden_trabajo.find((x) => Reglas.estaAbierta(db, x.estado) &&
          !db.presupuesto.some((y) => y.ot_id === x.id));
        let html = '';
        try {
          ui.presupuesto = { otId: o.id, presupuestoId: null, busqueda: '',
                             linea: { proceso: '', descripcion: '' } };
          html = typeof vPresupuesto === 'function' ? vPresupuesto() : '';
        } catch (e) { html = 'REVENTÓ: ' + e.message; }

        const ofreceCrear = html.indexOf('>Agregar OR<') >= 0;
        const pideElegir = html.indexOf('Seleccione ID de reparación a presupuestar') >= 0;
        const nombraLaOR = o.numero_or ? html.indexOf(String(o.numero_or)) >= 0 : false;

        push({
          nombre: '🔴 Presupuesto pide ELEGIR la reparación, no crearla',
          intento: 'Pintar el módulo Presupuesto sobre una orden sin presupuesto todavía',
          esperado: 'Ningún botón «Agregar OR»; sale el desplegable de reparación con la OR de la orden',
          paso: !ofreceCrear && pideElegir && nombraLaOR,
          detalle: ofreceCrear
            ? 'Sigue el botón «Agregar OR»: la OR ya existe y ahí se abriría otra'
            : (!pideElegir ? 'No sale el desplegable de «Seleccione ID de reparación»'
              : (!nombraLaOR ? 'El desplegable no nombra la OR ' + o.numero_or + ' de esta orden'
                : 'Se elige la OR ' + o.numero_or + ' y se le pone precio'))
        });
      })();

      /* 🔶 Y SI DESPUÉS LE CAMBIAN LA OP, LA LISTA DE COMPRAS SIGUE.

         En la pantalla la OP se elige después de escribir, y se cambia de
         opinión. Lo que no puede pasar es que la lista de repuestos quede
         mintiendo — ni de más ni de menos. */
      (function () {
        restaurarSesion();
        const admin = db.persona.find((p) => p.correo === 'gabriel.diaz@dyp.cl');
        Modelo.fijar_persona_actual(admin ? admin.id : null);
        const o = db.orden_trabajo.find((x) => Reglas.estaAbierta(db, x.estado) &&
          !db.repuesto.some((r) => r.ot_id === x.id));
        if (!o) return;

        const pid = Modelo.crear_presupuesto(o.id, { lineas: [] }).presupuesto_id;
        Modelo.agregar_linea_presupuesto(pid, { proceso: 'reparar', descripcion: 'Foco trasero derecho' });
        const linea = db.presupuesto_linea.filter((l) => l.presupuesto_id === pid).pop();
        /* 🔴 SE CUENTAN LAS FILAS DE REPUESTOS DEL PRESUPUESTO (27-08-2026).
           Esta prueba también contaba `db.repuesto`, y por lo mismo daba verde
           sobre la tubería que no era. */
        const cuantos = () => db.presupuesto_linea
          .filter((l) => l.presupuesto_id === pid && Reglas.esRepuesto(l)).length;

        const conReparar = cuantos();
        Modelo.actualizar_linea_presupuesto(linea.id, { proceso: 'cambio' });
        const conCambio = cuantos();
        Modelo.actualizar_linea_presupuesto(linea.id, { proceso: 'reparar' });
        const deVuelta = cuantos();

        /* Y con la pieza YA RECIBIDA no se borra: llegó y está en la repisa.
           Para que exista la pieza hay que MANDARLA a bodega primero, que desde
           hoy es un acto aparte —`generar_repuestos_desde_presupuesto`— y no
           una consecuencia de escribir la fila. */
        Modelo.actualizar_linea_presupuesto(linea.id, { proceso: 'cambio' });
        Modelo.generar_repuestos_desde_presupuesto(pid);
        const suyo = db.repuesto.filter((r) => r.ot_id === o.id)[0];
        if (suyo) Modelo.recibir_repuesto(suyo.id);
        const rechaza = Modelo.actualizar_linea_presupuesto(linea.id, { proceso: 'reparar' });
        const trasRecibido = cuantos();

        push({
          nombre: '🔶 Cambiarle la OP a una línea corrige la lista de repuestos',
          intento: 'Reparar → Cambio → Reparar en el bloque de Repuestos, y después con la pieza ' +
                   'ya generada y recibida en bodega',
          esperado: '0 → 1 → 0, y con la pieza recibida se niega y la deja donde está',
          paso: conReparar === 0 && conCambio === 1 && deVuelta === 0 &&
                rechaza.ok === false && trasRecibido === 1,
          detalle: conCambio !== 1 ? 'Pasar a Cambio no bajó el repuesto'
            : (deVuelta !== 0 ? 'Volver a Reparar dejó la fila colgada en el bloque de Repuestos'
              : (rechaza.ok !== false ? 'Borró un repuesto que bodega ya había recibido'
                : 'Sigue a la OP, y se planta cuando la pieza ya llegó'))
        });
      })();

      /* ── 35 · El aviso sale al ENVIAR, no al crear una OR vacía ──────────
         F-2. La cola se disparaba sólo al crear la OR, y lo que le anunciaba a
         la compañía era un presupuesto de "0 líneas · $0 neto". El momento con
         valor de negocio —el envío— no disparaba nada. */
      (function () {
        restaurarSesion();
        const admin = db.persona.find((p) => p.correo === 'gabriel.diaz@dyp.cl');
        Modelo.fijar_persona_actual(admin ? admin.id : null);

        const o = db.orden_trabajo.find((x) => Reglas.estaAbierta(db, x.estado));
        const antes = Modelo.avisosDe(o.id).length;

        const cre = Modelo.crear_presupuesto(o.id, { lineas: [] });
        const pid = cre.presupuesto_id;
        const alCrear = Modelo.avisosDe(o.id).slice(0, Modelo.avisosDe(o.id).length - antes);
        const externosAlCrear = alCrear.filter((a) => a.canal === 'compania' || a.canal === 'cliente');

        /* Una línea que SÍ vale plata con la fórmula nueva: la mano de obra
           sale de las horas por el tempario, no de un precio escrito. Con
           `precio_unitario` a secas y sin proveedor, esta línea valía $0 —que
           es correcto: una pieza que pone la compañía no se cobra— y el aviso
           salía con «$0 neto», que es justo lo que esta prueba vigila. */
        Modelo.agregar_linea_presupuesto(pid, {
          proceso: 'reparar', descripcion: 'Puerta trasera izquierda',
          horas_rep: 6.5, horas_pint: 5.46 });
        Modelo.cambiar_estado_presupuesto(pid, 'enviado');

        const todos = Modelo.avisosDe(o.id);
        const alEnviar = todos.filter((a) => /envia/i.test(a.asunto || ''));
        /* Se mira el monto DEL TRABAJO, que es el que va antes de la palabra
           «neto». Antes se buscaba «$0» en cualquier parte del texto y desde
           que el aviso nombra el deducible —«…deducible $40.000 · quedan $0»—
           un aviso correcto se leía como uno vacío. La prueba vigilaba lo
           que importa; el que estaba mal escrito era su filtro. */
        const montoDelTrabajo = (a) => (/(\$[\d.]+) neto/.exec(a.detalle || '') || [])[1] || '';
        const conMonto = alEnviar.filter((a) => {
          const m = montoDelTrabajo(a);
          return m && m !== '$0';
        });

        push({
          nombre: 'El aviso a la compañía sale al enviar, no al crear la OR vacía',
          intento: 'Crear una OR en la OT ' + o.numero_ot + ' y contar avisos externos; después ' +
                   'agregarle una línea y enviarla',
          esperado: 'Crear no genera aviso externo · enviar sí, y su detalle trae el monto real',
          paso: !externosAlCrear.length && alEnviar.length > 0 && conMonto.length > 0,
          detalle: 'Al crear: ' + externosAlCrear.length + ' aviso(s) externo(s)' +
            (externosAlCrear.length ? ' — «' + externosAlCrear[0].detalle + '», NO debería' : '') +
            '  ·  Al enviar: ' + alEnviar.length + ' aviso(s)' +
            (alEnviar.length ? ' — «' + alEnviar[0].detalle + '» para ' + alEnviar[0].para : '')
        });
      })();

      /* 🔴 LA ARITMÉTICA DEL PRESUPUESTO, CONTRA EL DOCUMENTO REAL.
         Es la OR 23505-18401-001 que trajo Marco el 16-08-2026, línea por
         línea y con su tempario de $10.000. Si esta prueba se cae, el sistema
         está calculando distinto que el papel que hoy firma la compañía — y
         eso no se descubre mirando la pantalla, porque un total equivocado se
         ve igual de bien que uno correcto. */
      (function () {
        const L = [
          // Mano de obra: la OP clasifica el trabajo y las horas lo cobran.
          { bloque: 'mano_obra', proceso: 'cambio',  horas_dm: 1.78, horas_rep: 0,    horas_pint: 0 },
          { bloque: 'mano_obra', proceso: 'cambio',  horas_dm: 0.42, horas_rep: 0,    horas_pint: 0 },
          { bloque: 'mano_obra', proceso: 'cambio',  horas_dm: 0.22, horas_rep: 0,    horas_pint: 0 },
          { bloque: 'mano_obra', proceso: 'cambio',  horas_dm: 0.65, horas_rep: 0,    horas_pint: 0 },
          { bloque: 'mano_obra', proceso: 'reparar', horas_dm: 0,    horas_rep: 4.16, horas_pint: 6.24 },
          { bloque: 'mano_obra', proceso: 'reparar', horas_dm: 0,    horas_rep: 6.5,  horas_pint: 5.46 },
          { bloque: 'mano_obra', proceso: 'reparar', horas_dm: 0,    horas_rep: 6.79, horas_pint: 9.36 },
          { bloque: 'mano_obra', proceso: 'reparar', horas_dm: 0,    horas_rep: 1.5,  horas_pint: 0 },
          // Repuestos: tabla aparte, escrita a mano. Sólo se cobra la que pone
          // el taller; las cuatro de la compañía se registran y no suman.
          { bloque: 'repuesto', cantidad: 1, proveedor: 'sura', precio_unitario: 0 },
          { bloque: 'repuesto', cantidad: 1, proveedor: 'sura', precio_unitario: 0 },
          { bloque: 'repuesto', cantidad: 1, proveedor: 'sura', precio_unitario: 0 },
          { bloque: 'repuesto', cantidad: 1, proveedor: 'sura', precio_unitario: 0 },
          { bloque: 'repuesto', cantidad: 1, proveedor: 'dyp',  precio_unitario: 14000 },
          // Externos: tabla aparte tambien.
          { bloque: 'externo', precio_unitario: 17800 }
        ];
        const t = Reglas.totalesPresupuesto(L, 10000, 0, 19);
        const papel = { dm: 30700, reparar: 189500, pintar: 210600, manoObra: 430800,
          repuestos: 14000, tot: 17800, subtotalNeto: 462600, neto: 462600,
          iva: 87894, total: 550494 };
        const difieren = Object.keys(papel).filter((k) => t[k] !== papel[k]);
        push({
          nombre: 'El presupuesto calcula igual que el documento real (OR 23505-18401-001)',
          intento: 'Cargar las 10 líneas de esa OR con tempario $10.000 y comparar los totales',
          esperado: 'Los 10 números del PDF, al peso',
          paso: !difieren.length,
          detalle: difieren.length
            ? difieren.map((k) => k + ': ' + t[k] + ' y el papel dice ' + papel[k]).join(' · ')
            : 'Mano de obra ' + t.manoObra + ' (DM ' + t.dm + ' · Reparar ' + t.reparar +
              ' · Pintar ' + t.pintar + ') + repuestos ' + t.repuestos + ' + T.O.T. ' + t.tot +
              ' = ' + t.subtotalNeto + ' neto · IVA ' + t.iva + ' · total ' + t.total
        });
      })();

      /* 🔴 LAS HORAS SE ESCRIBEN CON COMA, Y EL PRECIO CON PUNTO DE MILES.
         «1,78» es como se escribe una hora acá y como viene en el documento
         real; «157.000» es como se escribe un precio. `Number()` devuelve NaN
         con las dos, y la línea quedaba en CERO sin avisar: el evaluador
         escribía, veía cómo se le borraba el campo, y el presupuesto salía
         con menos plata de la que puso. Se descubrió mirando la pantalla
         dibujada, no leyendo el código. */
      (function () {
        const o = abiertaCualquiera();
        const cr = Modelo.crear_presupuesto(o.id, { lineas: [] });
        Modelo.agregar_linea_presupuesto(cr.presupuesto_id,
          { proceso: 'cambio', descripcion: 'Puerta trasera izquierda' });
        const l = Modelo.base().presupuesto_linea
          .filter((x) => x.presupuesto_id === cr.presupuesto_id).pop();
        Modelo.actualizar_linea_presupuesto(l.id,
          { horas_dm: '1,78', horas_rep: '4,16', horas_pint: '6,24', precio_unitario: '157.000' });
        const g = Modelo.base().presupuesto_linea.find((x) => x.id === l.id);
        const bien = g.horas_dm === 1.78 && g.horas_rep === 4.16 &&
                     g.horas_pint === 6.24 && g.precio_unitario === 157000;
        push({
          nombre: 'Las horas con coma y el precio con punto de miles se guardan enteros',
          intento: 'Escribir 1,78 · 4,16 · 6,24 horas y $157.000 en una línea',
          esperado: 'Se guardan tal cual, no en cero',
          paso: bien,
          detalle: 'DM ' + g.horas_dm + ' · Rep ' + g.horas_rep + ' · Pint ' + g.horas_pint +
            ' · precio ' + g.precio_unitario + (bien ? '' : '  ← algo se fue a cero')
        });
      })();

      /* 🔴 ESCRIBIR EL REPUESTO EN EL PRESUPUESTO **ES** PEDIRLO.
         Regla que fijó Marco el 16-08-2026: «se pide cuando uno pone
         repuestos en el presupuesto». Antes la pieza nacía al aprobar la OR y
         había un botón para pedirlas antes; los dos se eliminaron. Lo que se
         vigila acá es la cadena entera, porque cada eslabón se puede romper
         solo: que Reparar NO cree pieza, que Cambio SÍ y sin esperar
         aprobación, que editar la línea arrastre a la pieza de bodega, y que
         aprobar no la duplique. */
      (function () {
        const o = abiertaCualquiera();
        const enBodega = () => Modelo.base().repuesto.filter((r) => r.ot_id === o.id).length;
        const partida = enBodega();

        const cr = Modelo.crear_presupuesto(o.id, { lineas: [] });
        const alCrear = enBodega();
        Modelo.agregar_linea_presupuesto(cr.presupuesto_id,
          { proceso: 'reparar', descripcion: 'Puerta trasera izquierda' });
        const trasReparar = enBodega();
        Modelo.agregar_fila_presupuesto(cr.presupuesto_id, 'repuesto',
          { descripcion: 'Foco delantero derecho' });
        /* 🔴 ESCRIBIR LA FILA SÍ PIDE, Y ESO ESTÁ BIEN (27-08-2026, corregido).

           Esta mañana puse acá que NO pedía, leyendo «cuando se generen los
           repuestos» como si hubiera un botón de generar. No lo hay —se sacó el
           16-08 porque Marco pidió que fuera automático— y con eso dejé el
           camino a bodega cortado: nada llegaba. Lo que Marco separaba no era
           cuándo viaja sino de dónde sale. */
        const trasEscribirla = enBodega();

        const lc = Modelo.base().presupuesto_linea
          .filter((l) => l.presupuesto_id === cr.presupuesto_id && Reglas.esRepuesto(l))[0];
        Modelo.actualizar_linea_presupuesto(lc.id, { proveedor: 'dyp', precio_unitario: '145.000' });

        /* El estado se copia AHORA, no se lee al final: `Modelo.base()`
           devuelve la fila viva, así que después de aprobar diría «aprobado» y
           la prueba se caería sola diciendo que la pieza no se pidió en
           borrador — cuando sí lo hizo. */
        const estadoAlPedir = Modelo.base().presupuesto
          .find((x) => x.id === cr.presupuesto_id).estado;
        /* Y volver a pedirlas no duplica: es idempotente por linaje. */
        Modelo.generar_repuestos_desde_presupuesto(cr.presupuesto_id);
        const trasGenerar = enBodega();
        const rep = Modelo.base().repuesto.find((r) => r.presupuesto_linea_id === lc.id) || {};

        Modelo.cambiar_estado_presupuesto(cr.presupuesto_id, 'enviado');
        Modelo.cambiar_estado_presupuesto(cr.presupuesto_id, 'aprobado');
        const trasAprobar = enBodega();

        const bien = alCrear === partida && trasReparar === partida &&
          trasEscribirla === partida + 1 && trasGenerar === partida + 1 &&
          estadoAlPedir === 'borrador' &&
          rep.proveedor === 'DYP' && rep.precio_unitario === 145000 &&
          trasAprobar === trasGenerar;

        push({
          nombre: 'Pedir los repuestos a bodega no espera la aprobación de la compañía',
          intento: 'Escribir una línea de mano de obra y una fila de Repuestos con la OR en ' +
                   'borrador, volver a pedirlas, y después aprobar',
          esperado: 'La mano de obra no pide nada · la fila de Repuestos pide en el acto y en ' +
                    'borrador · la pieza sigue lo que se escribe · ni volver a pedir ni aprobar duplican',
          paso: bien,
          detalle: 'bodega ' + partida + ' → tras Reparar ' + trasReparar +
            ' → tras escribir la fila ' + trasEscribirla +
            ' → tras generar ' + trasGenerar + ' (con la OR en «' + estadoAlPedir + '»)' +
            ' → tras aprobar ' + trasAprobar +
            ' · la pieza quedó con proveedor ' + (rep.proveedor || '—') + ' y precio ' +
            (rep.precio_unitario || 0)
        });
      })();

      /* 🔴 CADA CHIP DE LA TORRE DICE LO QUE VA A LISTAR.
         Las cinco tarjetas de arriba se sacaron el 16-08-2026 y sus números
         pasaron a los chips. Las tarjetas leían `Modelo.metricas()` y el
         filtro tenía su propia regla: dos caminos para el mismo número. Un
         chip que promete 53 y al apretarlo lista 46 destruye la confianza en
         toda la pantalla, y es el tipo de cosa que se descubre en la reunión.
         Se comprueba también con una búsqueda puesta. */
      (function () {
        const guardado = JSON.parse(JSON.stringify({
          situacion: ui.torre.situacion, busqueda: ui.torre.busqueda,
          compania: ui.torre.compania, etapa: ui.torre.etapa, pagina: ui.torre.pagina }));
        const malos = [];
        [['', 'sin filtro'], ['HYUNDAI', 'buscando HYUNDAI']].forEach(([q, rot]) => {
          ui.torre.busqueda = q; ui.torre.compania = 'todas'; ui.torre.etapa = 'todas';
          ui.torre.situacion = 'piso';
          const cuentas = cuentasSituacion();
          Object.keys(SITUACION_TORRE).forEach((k) => {
            ui.torre.situacion = k;
            const filas = filtrarTorre().length;
            if (cuentas[k] !== filas) malos.push(rot + ' · ' + k + ': dice ' + cuentas[k] + ' y lista ' + filas);
          });
        });
        Object.assign(ui.torre, guardado);

        push({
          nombre: 'Cada chip de la torre lista exactamente lo que su número promete',
          intento: 'Comparar la cuenta de las seis situaciones contra las filas que devuelve el filtro',
          esperado: 'Los seis calzan, con y sin búsqueda',
          paso: !malos.length,
          detalle: malos.length ? malos.join(' · ')
            : 'Todos · En taller · Fuera · Con repuesto pendiente · Sin etapa · Sobre la meta'
        });
      })();

      /* Las cuatro formas de escribir el mismo taller. En el original son
         cuatro proveedores distintos para cualquier suma. */
      (function () {
        const variantes = ['DYP', 'Dyp', 'dyp', 'DyP', 'D&P', 'd y p'];
        const malas = variantes.filter((v) => !Reglas.esProveedorTaller(v));
        const falsoPositivo = ['sura', 'SURA', 'Mapfre', ''].filter((v) => Reglas.esProveedorTaller(v));
        push({
          nombre: 'DYP escrito de cualquier forma es el mismo proveedor, y sólo él se cobra',
          intento: 'Normalizar ' + variantes.join(', ') + ' y comprobar que sura/Mapfre no se cuelan',
          esperado: 'Las seis variantes son el taller · ninguna aseguradora lo es',
          paso: !malas.length && !falsoPositivo.length,
          detalle: malas.length ? 'No reconocidas: ' + malas.join(', ')
            : (falsoPositivo.length ? 'Se colaron: ' + falsoPositivo.join(', ')
              : 'Las seis dan «' + Reglas.PROVEEDOR_TALLER + '»; la pieza que pone la compañía no se cobra')
        });
      })();

      /* ── El buscador del Histórico encuentra por las tres ─────────────────
         🔴 El campo dice «Patente u OT» y buscaba SÓLO la patente. Escribir el
         número de la orden devolvía cero, y cero con el filtro puesto se lee
         como «esa orden no existe» — que es justo lo que Marco concluyó el
         17-08-2026: «el Histórico está mal, no encuentra absolutamente nada».
         Se prueban las tres formas en que en el taller se nombra un trabajo. */
      (function () {
        const uni = Modelo.historico({ todo: true });
        const o = uni.find((x) => x.presupuestos.length) || uni[0];
        if (!o) {
          push({ nombre: 'El Histórico busca por patente, por OT y por OR',
            intento: 'Buscar una orden entregada por sus tres nombres',
            esperado: 'La encuentra por los tres', paso: false,
            detalle: 'No hay ninguna orden entregada con la que probar.' });
          return;
        }
        const busca = (q) => Modelo.historico({ patente: String(q) })
          .some((x) => x.numeroOT === o.numeroOT);
        const porPatente = busca(o.patente);
        const porOT = busca(o.numeroOT);
        const porOR = o.presupuestos.length ? busca(o.presupuestos[0].numeroOR) : true;
        // Y por parte del texto, que es como se busca cuando se acuerda a medias.
        const porTrozo = busca(String(o.patente).slice(0, 3));
        /* Ojo con la cadena: 'ZZZZ99' NO sirve, porque la prueba de la recepción
           crea un vehículo con esa patente y este control se caía solo. */
        const falso = Modelo.historico({ patente: 'NO-EXISTE-0000' }).length;

        push({
          nombre: 'El Histórico busca por patente, por OT y por OR',
          intento: 'Buscar la orden ' + o.numeroOT + ' escribiendo su patente, su número de OT, ' +
                   'su OR y las tres primeras letras de la patente',
          esperado: 'La encuentra de las cuatro formas, y lo que no existe sigue dando cero',
          paso: porPatente && porOT && porOR && porTrozo && falso === 0,
          detalle: 'Patente ' + (porPatente ? 'sí' : 'NO') + ' · OT ' + (porOT ? 'sí' : 'NO') +
                   ' · OR ' + (porOR ? 'sí' : 'NO') + ' · parte de la patente ' +
                   (porTrozo ? 'sí' : 'NO') + ' · una patente inventada devuelve ' + falso
        });
      })();

      /* ── Cada cuenta entra exactamente a lo que dijo el cliente ───────────
         🔴 Andrés Guzmán —jefe de recepción— entregó el 17-08-2026 la lista de
         quién usa la web hoy y a qué módulo entra cada uno. Está copiada acá
         TEXTUAL, y no leída de la semilla: si se leyera de la semilla, esta
         prueba diría «la semilla es igual a sí misma» y no comprobaría nada.

         Al cruzarla la primera vez, nueve de las trece cuentas veían MENOS de
         lo que ven hoy —Iván sin Presupuesto, Andrés sin Consolidado, seis
         personas sin Histórico—, porque los permisos del rol se habían
         inventado antes de tener la lista. Un sistema nuevo que le quita
         pantallas al que hoy las usa no se puede llevar a una reunión. */
      (function () {
        const ESPERADO = {
          'gabriel.diaz@dyp.cl':      ['torre', 'historico', 'recepcion', 'taller', 'personal', 'presupuesto', 'documentos', 'bodega', 'consolidado', 'configuracion'],
          'alejandra.diaz@dyp.cl':    ['torre', 'historico', 'personal', 'presupuesto', 'documentos', 'bodega'],
          'nancy.carvajal@dyp.cl':    ['torre', 'historico', 'personal', 'presupuesto', 'documentos'],
          'nicole.hernandez@dyp.cl':  ['torre', 'historico', 'recepcion', 'taller', 'personal', 'presupuesto', 'documentos', 'bodega'],
          'ivan.villalobos@dyp.cl':   ['torre', 'historico', 'recepcion', 'taller', 'presupuesto'],
          'esteban.calvo@dyp.cl':     ['torre', 'historico', 'recepcion', 'taller', 'presupuesto'],
          'sheila.marin@dyp.cl':      ['torre', 'historico', 'personal', 'presupuesto', 'documentos'],
          'sandra.hernandez@dyp.cl':  ['torre', 'historico', 'presupuesto', 'documentos'],
          'cristian.vidal@dyp.cl':    ['torre', 'historico', 'recepcion', 'taller', 'presupuesto'],
          'cristopher.zuniga@dyp.cl': ['torre', 'historico', 'documentos', 'bodega'],
          'nicolas.zuniga@dyp.cl':    ['torre', 'historico', 'documentos', 'bodega'],
          'andres.guzman@dyp.cl':     ['torre', 'historico', 'recepcion', 'taller', 'presupuesto', 'consolidado'],
          'recepcion@dyp.cl':         ['torre', 'historico', 'recepcion', 'taller'],
          /* La cuenta de Arttmize para la puesta en marcha: acceso total. No es
             del taller y por eso no figura en la lista de Andrés — se borró por
             error el 22-08-2026 al dejar «solo las de la lista» y volvió. */
          'administrador@dyp.cl':     ['torre', 'historico', 'recepcion', 'taller', 'personal', 'presupuesto', 'documentos', 'bodega', 'consolidado', 'configuracion']
        };

        const malas = [];
        Object.keys(ESPERADO).forEach((usuario) => {
          const p = db.persona.find((x) => x.usuario === usuario);
          if (!p) { malas.push(usuario + ': la cuenta no existe'); return; }
          const r = Modelo.iniciar_sesion(p.usuario, Semilla.CLAVE_DEMO);
          if (!r.ok) { malas.push(usuario + ': no entra — ' + r.motivo); return; }
          const ve = Modelo.MODULOS_MENU.filter((m) => entraAlModulo(m.id)).map((m) => m.id);
          const falta = ESPERADO[usuario].filter((x) => ve.indexOf(x) < 0);
          const sobra = ve.filter((x) => ESPERADO[usuario].indexOf(x) < 0);
          if (falta.length || sobra.length) {
            malas.push(p.nombres + ' ' + (p.apellidos || '') +
              (falta.length ? ' · le falta ' + falta.join(', ') : '') +
              (sobra.length ? ' · le sobra ' + sobra.join(', ') : ''));
          }
        });
        Modelo.cerrar_sesion();

        push({
          nombre: '🔴 Cada cuenta entra exactamente a los módulos que dijo el cliente',
          intento: 'Entrar con las ' + Object.keys(ESPERADO).length +
                   ' cuentas y comparar el menú contra la lista que entregó Andrés Guzmán',
          esperado: 'Ninguna cuenta ve un módulo de más ni le falta uno',
          paso: !malas.length,
          detalle: malas.length ? malas.join(' · ')
            : 'Las ' + Object.keys(ESPERADO).length + ' cuentas calzan al módulo'
        });
      })();

      /* ── Las hojas de Configuración pintan, y sus columnas calzan ─────────
         🔴 POR QUÉ EXISTE (18-08-2026). Al agregar Marcas y Modelos metí la
         condición del código en la función equivocada —en `cfgEtapas`, donde
         la variable `tabla` ni siquiera existe—. Esa hoja habría reventado al
         abrirla, y nada lo habría notado: las pruebas no entraban a
         Configuración, y la comprobación de pantallas sólo pinta la sección
         por omisión. Catorce hojas detrás de un botón cada una es exactamente
         donde se esconde un error así.

         Se comprueban las dos cosas que fallaron: que cada hoja PINTE, y que
         sus encabezados y sus celdas sean los mismos —una columna corrida es
         un dato leyéndose bajo el título de otro, que es peor que un error—. */
      (function () {
        const c = cfg();
        const previa = c.seccion;
        const malas = [];

        CONFIG_SECCIONES.forEach((sec) => {
          c.seccion = sec.id;
          let html;
          try { html = vConfiguracion(); }
          catch (e) { malas.push(sec.nombre + ': reventó — ' + e.message); return; }

          // Ojo: `<thead>` también empieza con `<th`, por eso el separador.
          const ths = (html.match(/<th[ >]/g) || []).length;
          const prim = html.match(/<tr class="fila[^"]*"[^>]*>([\s\S]*?)<\/tr>/);
          const tds = prim ? (prim[1].match(/<td/g) || []).length : 0;

          /* Roles y permisos queda fuera de la comparación: su tabla tiene una
             columna por rol y una fila por permiso, así que encabezados y
             celdas no tienen por qué coincidir. */
          if (sec.id !== 'permisos' && tds && ths !== tds) {
            malas.push(sec.nombre + ': ' + ths + ' encabezados y ' + tds + ' celdas');
          }
        });

        c.seccion = previa;
        push({
          nombre: '🔴 Las ' + CONFIG_SECCIONES.length + ' hojas de Configuración pintan y sus columnas calzan',
          intento: 'Pintar una por una las ' + CONFIG_SECCIONES.length +
                   ' hojas y comparar sus encabezados contra las celdas de la primera fila',
          esperado: 'Ninguna revienta y ninguna queda corrida',
          paso: !malas.length,
          detalle: malas.length ? malas.join(' · ')
            : 'Las ' + CONFIG_SECCIONES.length + ' pintan; ninguna columna corrida'
        });
      })();

      /* ── La Reportería con la pantalla vacía ──────────────────────────────
         🔴 POR QUÉ EXISTE (19-08-2026). El panel se rehizo con nueve gráficos
         y CADA UNO divide por algo: por el total de órdenes, por el máximo de
         la serie, por la suma de las porciones del anillo. Con un período sin
         entregas —una compañía nueva, un rango mal escrito, el primer día del
         mes— todos esos divisores son cero.

         Es el caso que se rompe en la reunión y no en la prueba: nadie filtra
         por un mes vacío mientras desarrolla, y el usuario lo hace en el
         primer minuto. Acá se filtra a propósito por un rango donde no hay
         nada y se exige que el panel se pinte y lo DIGA, sin reventar y sin
         inventar un cero disfrazado de dato. */
      (function () {
        if (typeof vReporteria !== 'function') return;
        const previo = ui.reporteria;
        // Un rango anterior a cualquier orden de la demostración.
        ui.reporteria = { desde: '2001-01-01', hasta: '2001-01-31', compania_id: '',
          filas: 'compania', columnas: '', medida: 'ordenes' };
        let html = '', reventó = '';
        try { html = vReporteria(); } catch (e) { reventó = e.message; }
        ui.reporteria = previo;

        const dice = html.indexOf('Sin órdenes entregadas') >= 0;
        const sinBasura = html.indexOf('NaN') < 0 && html.indexOf('undefined') < 0;
        push({
          nombre: '🔴 La Reportería con un período sin entregas se pinta y lo dice',
          intento: 'Filtrar la reportería por enero de 2001, donde no hay ninguna orden entregada',
          esperado: 'La pantalla se pinta, explica que no hay órdenes, y no muestra NaN ni undefined',
          paso: !reventó && dice && sinBasura,
          detalle: reventó ? 'Reventó: ' + reventó
            : (!dice ? 'Se pintó pero no dice que el período está vacío'
              : (!sinBasura ? 'Se coló un NaN o un undefined en la pantalla'
                : 'Se pinta con el vacío explicado, sin NaN ni undefined'))
        });
      })();

      /* ── El mes en curso no entra en la comparación ───────────────────────
         🔴 POR QUÉ EXISTE (19-08-2026). Las tarjetas de la Reportería decían
         «−65% vs. mes anterior» en órdenes y «−100%» en cumplimiento. No había
         pasado nada: el mes en curso llevaba doce días de treinta y uno y se
         estaba comparando contra un mes entero.

         Un indicador que grita una caída inventada quema la credibilidad del
         panel completo. La serie de las tarjetas tiene que tener un mes MENOS
         que la del gráfico cuando el último mes va en curso, y ésa es la
         diferencia que se comprueba acá. */
      (function () {
        if (typeof repAgregados !== 'function') return;
        const previo = ui.reporteria;
        ui.reporteria = { desde: '', hasta: '', compania_id: '',
          filas: 'compania', columnas: '', medida: 'ordenes' };
        const g = repAgregados(Modelo.historico({ todo: true }), Modelo.metricas().metaDias);
        ui.reporteria = previo;

        const esperado = g.hayMesEnCurso ? g.meses.length - 1 : g.meses.length;
        push({
          nombre: '🔴 La Reportería no compara contra un mes a medias',
          intento: 'Pedir la serie del mes a mes teniendo el mes en curso todavía abierto',
          esperado: 'La serie de las tarjetas deja el mes en curso afuera; el gráfico lo conserva',
          paso: g.serieOrdenes.length === esperado && (!g.hayMesEnCurso || !!g.notaMesEnCurso),
          detalle: g.hayMesEnCurso
            ? 'Meses en el gráfico: ' + g.meses.length + ' · en la comparación: ' +
              g.serieOrdenes.length + ' · aviso en pantalla: ' + (g.notaMesEnCurso ? 'sí' : 'NO')
            : 'No hay mes en curso en el período: la serie va completa (' + g.serieOrdenes.length + ')'
        });
      })();

      /* Quién da el visto bueno en las pruebas del ciclo. Se busca por el
         PERMISO y no por un id escrito a mano: el 22-08-2026 la cuenta «Jefe
         de taller» se borró —no estaba en la lista de Andrés— y tres pruebas
         quedaron apuntando a una persona que ya no existe. */
      const JEFA = (function () {
        const previo = (Modelo.personaActual() || {}).id || null;
        const q = Modelo.sesionesPosibles().find((p) => {
          Modelo.fijar_persona_actual(p.id);
          return Modelo.puede('etapa.validar') && !Modelo.rolActual().total;
        });
        Modelo.fijar_persona_actual(previo);
        return q ? q.id : null;
      })();

      /* ── Terminar NO es cerrar ────────────────────────────────────────
         🔴 LA REGLA NUEVA DEL 22-08-2026, y la mas facil de romper sin darse
         cuenta: alcanza con que alguien vuelva a poner `salio_at` dentro de
         `finalizar_etapa` para que el visto bueno del jefe deje de existir y
         nadie lo note — la etapa se cierra igual, la orden avanza igual, y el
         control simplemente ya no esta.

         Marco lo pidio asi: el encargado declara terminado, el jefe acepta, y
         hasta entonces el vehiculo NO avanza. */
      (function () {
        const o = abiertaCualquiera();
        const etapa = db.etapa.find((e) => e.codigo === 'desarme');
        // Escenario limpio: una etapa asignada a un operario, sin cerrar.
        db.ot_etapa = db.ot_etapa.filter((x) => x.ot_id !== o.id);
        /* Un operario DE VERDAD: alguien con el rol de operario, no el primer
           trabajador de la lista -que es Recepcion y si puede repartir-. */
        const rolOper = (db.persona_rol.find((r) => r.rol_id === 'ro-3') || {}).persona_id;
        const oper = db.persona.find((p) => p.id === rolOper) ||
                     db.persona.find((p) => p.tipo === 'trabajador');
        if (!db.persona_etapa.some((h) => h.persona_id === oper.id && h.etapa_id === etapa.id)) {
          db.persona_etapa.push({ persona_id: oper.id, etapa_id: etapa.id });
        }
        db.ot_etapa.push({ id: 'oe-val', ot_id: o.id, etapa_id: etapa.id,
          asignada_at: HOY, salio_at: null, persona_id: oper.id, observacion: '',
          asignada_por: JEFA, terminada_at: null, terminada_por: null,
          validada_at: null, validada_por: null });

        // El operario dice que termino. No puede validar.
        /* Solo la persona: `fijar_rol_actual` borra la sesion de persona, y la
           etapa quedaba "tomada por otro" contra un `persona_actual` vacio. */
        Modelo.fijar_persona_actual(oper.id);
        const rTerm = Modelo.finalizar_etapa(o.id, 'desarme', oper.id);
        const fila = db.ot_etapa.find((x) => x.id === 'oe-val');


        /* 🔴 TERMINAR ES CERRAR (27-08-2026, Marco: «a día de hoy el sistema no
           tiene validaciones de etapas, por lo tanto debes eliminarlo. Hoy día
           pasa todo por el jefe de taller»).

           Esta prueba ataba lo contrario: que terminar dejara la etapa
           esperando y que sólo el visto bueno la cerrara. Era cierto y ya no lo
           es. Se invierte, y de paso ata las dos mitades que importan: que
           cierre, y que NADIE quede con el permiso de validar —si alguien lo
           tuviera, volvería a aparecer el módulo «Por validar» para una cuenta
           sí y para las demás no. */
        const cerroAlTerminar = !!fila && !!fila.salio_at;
        Modelo.fijar_persona_actual(null);
        const nadieValida = !db.persona.filter((x) => x.usuario).some((x) => {
          Modelo.fijar_persona_actual(x.id);
          const puede = Modelo.puede('etapa.validar');
          Modelo.fijar_persona_actual(null);
          return puede;
        });

        push({
          nombre: '🔴 Terminar una etapa la CIERRA: no hay visto bueno',
          intento: 'Declarar terminada una etapa asignada, y preguntarle a cada cuenta si puede validar',
          esperado: 'Queda cerrada en el acto, y ninguna cuenta tiene el permiso de validar',
          paso: rTerm.ok && cerroAlTerminar && nadieValida,
          detalle: !rTerm.ok ? 'No dejo declarar terminada: ' + rTerm.motivo
            : (!cerroAlTerminar
              ? 'Quedó esperando revisión: el visto bueno se apagó pero la etapa no cierra'
              : (!nadieValida
                ? 'Hay una cuenta que todavía puede validar: le va a aparecer «Por validar» a ella sola'
                : 'Cierra al terminar, y nadie valida'))
        });
      })();

      /* Devolver sin motivo deja al encargado sin saber que rehacer. */
      (function () {
        const o = abiertaCualquiera();
        const etapa = db.etapa.find((e) => e.codigo === 'desabolladura');
        db.ot_etapa = db.ot_etapa.filter((x) => x.id !== 'oe-dev');
        db.ot_etapa.push({ id: 'oe-dev', ot_id: o.id, etapa_id: etapa.id,
          asignada_at: HOY, salio_at: null, persona_id: null, observacion: '',
          asignada_por: JEFA, terminada_at: HOY, terminada_por: null,
          validada_at: null, validada_por: null });
        const r = Modelo.devolver_etapa(o.id, 'desabolladura', '');
        const conMotivo = Modelo.devolver_etapa(o.id, 'desabolladura', 'Falta lijar el borde');
        push({
          nombre: 'Una etapa no se puede devolver sin decir por que',
          intento: 'Devolver una etapa terminada con el motivo en blanco',
          esperado: 'Rechazo pidiendo el motivo, y aceptacion cuando se escribe',
          paso: !r.ok && conMotivo.ok,
          detalle: r.ok ? 'La devolvio SIN motivo: el encargado no sabe que rehacer.'
            : (conMotivo.ok ? r.motivo : 'Con motivo tampoco dejo: ' + conMotivo.motivo)
        });
      })();

      /* 🔴 REBOTAR NO ES QUEDARSE (22-08-2026).

         `ir()` revisaba el permiso y avisaba «no tienes acceso» — y despues
         repintaba igual la pantalla rechazada. El rebote solo cambiaba de
         vista si la actual no era un modulo CONOCIDO, y al arrancar con la
         sesion guardada `ui.vista` vale 'torre', que si lo es. Resultado
         medido en el navegador: el operario de desabolladura abrio el sistema
         en la Torre de control, con nombres de clientes y compañia a la vista,
         despues de que el sistema le dijera que no podia entrar.

         Se mira sin navegador: para cada cuenta, que el modulo de aterrizaje
         sea uno que esa cuenta alcance. */
      (function () {
        const donde = (typeof window !== 'undefined') ? window : globalThis;
        const hay = typeof donde.primerModuloPermitido === 'function' &&
                    typeof donde.entraAlModulo === 'function';
        const malas = [];
        let revisadas = 0;
        if (hay) {
          db.persona.filter((p) => p.activo).forEach((p) => {
            Modelo.fijar_persona_actual(p.id);
            revisadas++;
            const destino = donde.primerModuloPermitido();
            if (!donde.entraAlModulo(destino)) {
              malas.push([p.nombres, p.apellidos].filter(Boolean).join(' ') + ' → ' + destino);
            }
          });
        }
        push({
          nombre: '🔴 Nadie aterriza en una pantalla que su cuenta no alcanza',
          intento: 'Recorrer las ' + revisadas + ' cuentas activas y preguntar en que modulo abre cada una',
          esperado: 'Todas caen en un modulo que su propia cuenta puede abrir',
          paso: hay && revisadas > 0 && !malas.length,
          detalle: !hay ? 'No existe primerModuloPermitido(): app.js no cargo'
            : (malas.length ? 'Aterrizan donde no pueden entrar: ' + malas.slice(0, 4).join(', ')
              : 'Las ' + revisadas + ' cuentas abren en una pantalla suya')
        });
      })();

      /* 🔴 LA DEVOLUCION TIENE QUE LLEGARLE AL QUE REHACE (22-08-2026).

         El motivo se guardaba solo en la bitacora de la orden. Al encargado la
         tarjeta le reaparecia identica a una asignacion nueva —mismo rotulo,
         misma fecha— sin una palabra de que su trabajo habia sido rechazado.
         Un rechazo que no llega no es un rechazo: es la etapa dando vueltas.
         Se mira donde la persona mira: su propia pantalla. */
      (function () {
        const o = abiertaCualquiera();
        const etapa = db.etapa.find((e) => e.codigo === 'pintura');
        const quien = db.persona.find((p) => p.usuario === 'cristopher.zuniga@dyp.cl');
        db.ot_etapa = db.ot_etapa.filter((x) => x.id !== 'oe-devmot');
        db.ot_etapa.push({ id: 'oe-devmot', ot_id: o.id, etapa_id: etapa.id,
          asignada_at: HOY, salio_at: null, persona_id: quien ? quien.id : null,
          observacion: '', asignada_por: JEFA, terminada_at: HOY,
          terminada_por: quien ? quien.id : null, validada_at: null, validada_por: null });
        Modelo.fijar_persona_actual(JEFA);
        const RAZON = 'El tono no calza con la puerta de al lado';
        const r = Modelo.devolver_etapa(o.id, 'pintura', RAZON);
        let laVe = false, conMotivo = false;
        if (quien) {
          Modelo.fijar_persona_actual(quien.id);
          const suya = Modelo.miTrabajo(quien.id).mias
            .find((x) => x.ot_id === o.id && x.etapaCodigo === 'pintura');
          laVe = !!(suya && suya.devueltaPendiente);
          conMotivo = !!(suya && suya.devueltaMotivo === RAZON);
        }
        push({
          nombre: '🔴 La etapa devuelta le llega al encargado con el motivo',
          intento: 'El jefe devuelve una etapa y se mira la pantalla del que tiene que rehacerla',
          esperado: 'La ve marcada como devuelta y con el motivo escrito, sin abrir la orden',
          paso: r.ok && laVe && conMotivo,
          detalle: !r.ok ? 'No dejo devolver: ' + r.motivo
            : (!laVe ? 'Le vuelve a aparecer sin ninguna marca de que se la devolvieron'
              : (!conMotivo ? 'Se marca como devuelta pero sin el motivo: no sabe que rehacer'
                : 'La ve marcada y con el motivo'))
        });
      })();

      /* 🔴 LA PUERTA DEL QUE VALIDA (22-08-2026).

         El ciclo entero se construyo, se probo con 47 pruebas en verde y se
         publico — y en el navegador NO habia por donde llegar a la bandeja
         donde el jefe valida. El motor validaba, la pantalla se dibujaba, y
         el menu no la ofrecia: la vista vivia dentro de «Mi trabajo», que
         esta fuera del menu a proposito desde que Marco pidio dejar solo los
         diez modulos del sistema actual. El jefe aterriza en la Torre.

         Y para las cuentas del cliente hay una segunda tapa: las trece traen
         escrita su lista de modulos, esa lista se armo mirando las 39
         pantallas del sistema ACTUAL, y por construccion no puede nombrar una
         pantalla que ese sistema no tiene.

         Esta prueba mira las DOS cuentas que validan y por caminos distintos:
         el jefe de taller —cuenta de puesto, sin lista— y Gabriel Diaz —con
         los diez modulos escritos—. Y pregunta por el MENU, no por el
         permiso: el permiso ya daba que si mientras la puerta no existia. */
      (function () {
        /* 🔴 LA BANDEJA «POR VALIDAR» NO LE APARECE A NADIE (27-08-2026).

           Esta prueba comprobaba lo contrario —que el que valida tuviera la
           puerta en el menú— y era la correcta mientras el visto bueno
           existía. Ahora el riesgo es el inverso: que a alguien le quede el
           permiso y le aparezca una bandeja que en el taller no se usa.

           Se pregunta por el MENÚ y no por el permiso, igual que antes: el
           permiso podía dar que sí mientras la puerta no existía, y ahora puede
           dar que no mientras la puerta sigue dibujada. */
        const donde = (typeof window !== 'undefined') ? window : globalThis;
        const hayMenu = typeof donde.modulosDelMenu === 'function';
        const conBandeja = [];
        db.persona.filter((x) => x.usuario).forEach((p) => {
          if (!hayMenu) return;
          Modelo.fijar_persona_actual(p.id);
          if (donde.modulosDelMenu().indexOf('porvalidar') >= 0) conBandeja.push([p.nombres, p.apellidos].filter(Boolean).join(' '));
        });
        Modelo.fijar_persona_actual(null);

        push({
          nombre: '🔴 Nadie tiene la bandeja «Por validar» en el menú',
          intento: 'Recorrer las cuentas y mirar su menú',
          esperado: 'Ninguna la tiene: en el taller el que cierra la etapa es el mismo que la hace',
          paso: hayMenu && !conBandeja.length,
          detalle: !hayMenu ? 'El menú no está cargado: no se pudo probar'
            : (conBandeja.length
              ? 'Le aparece a ' + conBandeja.join(', ') + ': el visto bueno no existe en este taller'
              : 'A ninguna de las ' + db.persona.filter((x) => x.usuario).length + ' cuentas')
        });
      })();

      /* 🔴 EL CHIP PROMETE LA MISMA CANTIDAD QUE LA TABLA MUESTRA (28-08-2026).

         Presupuesto, Seguimiento Repuestos y Documentos estrenaron chips con la
         cuenta al lado, igual que la Torre. El error clásico de esa forma es
         contar sobre el universo completo y listar sobre el filtrado: el chip
         dice 41, se aprieta, y aparecen 3. Ninguno de los dos números se ve
         mal por su cuenta —por eso no se descubre mirando— y se paga cuando
         alguien usó la cuenta para decidir algo.

         La prueba NO compara la cuenta contra la fórmula que la produce: eso
         sería preguntárselo dos veces al mismo. Pinta la pantalla, cuenta las
         FILAS del HTML y las compara con el número impreso en el chip. Y lo
         hace con un filtro puesto, que es donde el defecto aparece: sin
         filtros, contar sobre el universo y sobre lo filtrado da igual y la
         prueba pasaría con el error adentro. */
      (function () {
        const donde = (typeof window !== 'undefined') ? window : globalThis;
        if (typeof donde.cuentasDeChips !== 'function' || typeof donde.vPresupuestoListado !== 'function') {
          push({
            nombre: '🔴 Los chips de los tres paneles prometen lo que muestran',
            intento: 'Pintar cada panel con cada chip puesto y contar las filas',
            esperado: 'La cuenta del chip es la cantidad de filas que aparecen',
            paso: false,
            detalle: 'Las vistas no están cargadas: no se pudo probar'
          });
          return;
        }

        const filasDe = (html) => (html.match(/<tr class="fila"/g) || []).length;
        const cuentaDelChip = (html, attr, k) => {
          const re = new RegExp('data-' + attr + '="' + k + '"[^>]*>[^<]*<span class="cuenta">(\\d+)');
          const m = html.match(re);
          return m ? Number(m[1]) : null;
        };

        const admin = db.persona.find((x) => /gabriel/i.test(x.usuario || ''));
        Modelo.fijar_persona_actual(admin ? admin.id : null);

        // Una compañía que exista de verdad: con `todas` no hay filtro que probar.
        const cia = (Modelo.torre().find((o) => o.compania && o.compania !== '\u2014') || {}).compania || 'todas';
        const malos = [];
        let probados = 0;

        const revisar = (panel, attr, mapa, poner, pintar) => {
          Object.keys(mapa).forEach((k) => {
            poner(k);
            const html = pintar();
            const prometidas = cuentaDelChip(html, attr, k);
            const listadas = filasDe(html);
            probados++;
            if (prometidas === null) malos.push(panel + '/' + k + ': el chip no se pint\u00f3');
            else if (prometidas !== listadas) {
              malos.push(panel + '/' + k + ': promete ' + prometidas + ' y lista ' + listadas);
            }
          });
        };

        // 1 · Presupuesto, con una compañía puesta.
        const p = presuEstado();
        const guardaP = { b: p.busqueda, c: p.compania, t: p.tipo, s: p.situacion, ot: p.otId };
        p.busqueda = ''; p.tipo = 'todas'; p.compania = cia; p.otId = null;
        revisar('Presupuesto', 'presu-sit', SITUACION_PRESU,
          (k) => { p.situacion = k; }, () => vPresupuestoListado());
        p.busqueda = guardaP.b; p.compania = guardaP.c; p.tipo = guardaP.t;
        p.situacion = guardaP.s; p.otId = guardaP.ot;

        // 2 · Seguimiento Repuestos, con la misma compañía.
        const b = bodegaEstado();
        const guardaB = { b: b.busqueda, c: b.compania, s: b.situacion };
        b.busqueda = ''; b.compania = cia;
        revisar('Repuestos', 'bod-sit', SITUACION_REP,
          (k) => { b.situacion = k; }, () => bodegaSeguimiento());
        b.busqueda = guardaB.b; b.compania = guardaB.c; b.situacion = guardaB.s;

        // 3 · Documentos, con una etapa puesta.
        const d = documentosEstado();
        const guardaD = { b: d.busqueda, e: d.estado, et: d.etapa, s: d.situacion, ot: d.otId };
        const etapa = (Modelo.torre().find((o) => o.etapa) || {}).etapa || 'todas';
        d.busqueda = ''; d.estado = 'todas'; d.etapa = etapa; d.otId = null;
        revisar('Documentos', 'doc-sit', SITUACION_DOC,
          (k) => { d.situacion = k; }, () => documentosListado());
        d.busqueda = guardaD.b; d.estado = guardaD.e; d.etapa = guardaD.et;
        d.situacion = guardaD.s; d.otId = guardaD.ot;

        Modelo.fijar_persona_actual(null);

        push({
          nombre: '🔴 Los chips de los tres paneles prometen lo que muestran',
          intento: 'Con un filtro puesto, pintar cada panel con cada chip activo y ' +
            'contar las filas del HTML contra el número impreso en el chip',
          esperado: 'Los dos números son el mismo, en los ' + probados + ' casos',
          paso: !malos.length && probados > 0,
          detalle: malos.length
            ? malos.join(' · ')
            : probados + ' chips revisados en Presupuesto, Repuestos y Documentos, ' +
              'con la compañía ' + cia + ' puesta'
        });
      })();

      /* ══ COD-1 · Las tres defensas de seguridad del 22-08-2026 ═════════
         Las tres son invisibles: no cambian ni una pantalla. Si alguien las
         deshace sin querer, nada se ve distinto — sólo vuelve a estar abierto
         lo que se cerró. Por eso van medidas. */

      /* 🔴 1 · LO QUE LLEGA DE LA SALA SE REVISA ANTES DE ADOPTARLO.

         La sala se escribe sin identificarse: la direccion y la llave estan en
         `sala.js`, publicado. Antes, cualquier documento que estuviera en esa
         tabla se adoptaba como la base completa del sistema — un `{}` dejaba
         todas las pantallas conectadas en blanco.

         Se prueban las dos mitades, y la primera importa mas: que la base
         BUENA entre. El primer intento de este arreglo validaba un nivel mas
         arriba de donde estan las tablas y rechazaba TODO, incluida la buena:
         la sala dejaba de sincronizar en silencio. */
      (function () {
        const haySala = typeof Sala !== 'undefined' && typeof Sala.esBaseCreible === 'function';
        const buena = { modificado: false, sello: 'x', db: db };
        const malas = [
          ['un documento vacio',            {}],
          ['sin el envoltorio del modelo',  { modificado: false, sello: 'x' }],
          ['sin las tablas minimas',        { db: { persona: [{}] } }],
          /* Trae persona Y etapa, asi que las dos comprobaciones de «vacio» lo
             dejan pasar: sólo cae por las tablas que faltan. Es el caso que
             cuida ESA comprobacion, y sin el se podia borrar sin que nada se
             pusiera rojo. Es tambien un caso real: un documento truncado. */
          ['truncado a medias',             { db: { persona: [{ id: 'x' }], etapa: [{ id: 'e' }] } }],
          ['sin ninguna persona',           { db: Object.assign({}, db, { persona: [] }) }],
          ['un arreglo en vez de objeto',   [1, 2, 3]],
          ['nulo',                          null]
        ];
        const aceptaBuena = haySala && Sala.esBaseCreible(buena) === null;
        /* Las malas se prueban llamando a `Sala.aplicar()` y NO a
           `esBaseCreible()`: lo que hay que cuidar es que la revision este
           ENCHUFADA. Probando solo el juicio, borrar la llamada dentro de
           `aplicar` dejaba esta prueba en verde y la sala abierta otra vez.
           Medido rompiendolo a proposito el 22-08-2026. */
        const foto = () => Modelo.base().persona.length + String.fromCharCode(124) + Modelo.base().orden_trabajo.length;
        const antes = foto();
        /* Se llama a `aplicar()` de verdad y no a `esBaseCreible()`: lo que hay
           que cuidar es que la revision este ENCHUFADA.

           No hace falta deshacer nada DESPUES, y ese es justamente el punto: si
           la revision funciona, ninguna de estas seis toca la base. La foto de
           antes y la de despues lo comprueban. Si alguna se cuela, la base
           queda con lo que trajo y las pruebas siguientes se van a caer — feo,
           pero correcto: eso es exactamente lo que pasaria en el navegador de
           alguien.

           Y una excepcion cuenta como que SE COLO, no como aprobado: adoptar
           algo que revienta a mitad de camino es peor que rechazarlo. */
        const pasanMalas = haySala
          ? malas.filter(([, m]) => {
              try { return Sala.aplicar({ db: m, version: 9001 }) !== false; }
              catch (e) { return true; }
            }).map(([r]) => r)
          : ['(no se pudo probar)'];

        const despues = foto();
        const baseIntacta = antes === despues;
        push({
          nombre: '🔴 La sala no adopta cualquier cosa, pero si adopta la base buena',
          intento: 'Ofrecerle a la sala la base real y ' + malas.length + ' documentos que no lo son',
          esperado: 'La buena entra; las ' + malas.length + ' malas rebotan con su motivo',
          paso: haySala && aceptaBuena && !pasanMalas.length && baseIntacta,
          detalle: !haySala ? 'No existe Sala.esBaseCreible(): sala.js no cargo'
            : (!aceptaBuena
                ? 'RECHAZA LA BASE BUENA: la sala deja de sincronizar y nadie se entera. Motivo: ' +
                  Sala.esBaseCreible(buena)
                : (pasanMalas.length ? 'Se colaron: ' + pasanMalas.join(', ')
                  : (!baseIntacta ? 'Una mala reboto pero igual dejo la base tocada'
                    : 'Entra la buena y rebotan las ' + malas.length + ' por aplicar()')))
        });
      })();

      /* 🔴 2 · LA SESION NO VIVE EN `localStorage`.

         Estaba ahi, y `localStorage` sobrevive a cerrar el navegador: quien
         prendiera despues ese computador entraba como la ultima persona que lo
         uso, sin clave. En el meson de recepcion de un taller, donde el equipo
         lo usan tres personas al dia, ese es el caso normal.

         La prueba mira el ALMACENAMIENTO, no el codigo: da igual como se
         escriba mientras la sesion no quede ahi. */
      (function () {
        const CLAVE = Modelo.CLAVE_SESION;
        let previo = null;
        try { previo = localStorage.getItem(CLAVE); } catch (e) { previo = null; }
        try { localStorage.removeItem(CLAVE); } catch (e) { /* sin almacenamiento */ }

        const p = db.persona.find((x) => x.usuario === 'gabriel.diaz@dyp.cl');
        const r = p ? Modelo.iniciar_sesion(p.usuario, Semilla.CLAVE_DEMO) : { ok: false, motivo: 'sin cuenta' };
        let quedo = null;
        try { quedo = localStorage.getItem(CLAVE); } catch (e) { quedo = null; }
        try { if (previo !== null) localStorage.setItem(CLAVE, previo); } catch (e) { /* nada */ }

        push({
          nombre: '🔴 La sesion no queda guardada en el navegador entero',
          intento: 'Entrar con una cuenta y mirar si el id quedo en localStorage',
          esperado: 'No queda: la sesion vive en sessionStorage y muere con la pestaña',
          paso: r.ok && quedo === null,
          detalle: !r.ok ? 'No dejo entrar: ' + r.motivo
            : (quedo !== null
              ? 'La sesion quedo en localStorage (' + quedo + '): sobrevive a cerrar el navegador'
              : 'No quedo en localStorage')
        });
      })();


      /* 🔴 SIS-1 · LA CLAVE NO SE GUARDA EN NINGUNA PARTE (23-08-2026).

         El documento entero sube a la sala compartida, y la sala se lee sin
         cuenta con la llave publicable, que va publicada en `js/sala.js`. Un
         GET anónimo devolvía las catorce cuentas con su clave legible.

         Esta prueba mira el DATO, no el código: da lo mismo cómo se escriba
         mientras en `persona` no quede una clave que se pueda leer. */
      (function () {
        const cuentas = db.persona.filter((p) => p.usuario);
        const conTexto = cuentas.filter((p) => p.clave !== undefined);
        const sinHuella = cuentas.filter((p) => !p.clave_hash);

        push({
          nombre: '🔴 Ninguna cuenta guarda su clave, sólo la huella',
          intento: 'Recorrer las ' + cuentas.length + ' cuentas y buscar el campo `clave`',
          esperado: 'Cero con clave legible, las ' + cuentas.length + ' con `clave_hash`',
          paso: cuentas.length > 0 && conTexto.length === 0 && sinHuella.length === 0,
          detalle: conTexto.length
            ? conTexto.length + ' cuentas siguen guardando la clave en texto: ' +
              conTexto.slice(0, 3).map((p) => p.usuario).join(', ')
            : (sinHuella.length
              ? sinHuella.length + ' cuentas no tienen huella y no va a entrar nadie'
              : 'Las ' + cuentas.length + ' guardan huella y ninguna guarda la clave')
        });
      })();

      /* 🔴 SIS-1 · Y LA HUELLA TIENE QUE SERVIR PARA ALGO.

         ⚠️ Sin esta segunda prueba, la de arriba se aprueba borrando el campo
         `clave` y nada más: cero claves legibles, cero forma de entrar. Ya pasó
         en este proyecto una prueba que daba verde sin probar nada. */
      (function () {
        const p = db.persona.find((x) => x.usuario === 'gabriel.diaz@dyp.cl');
        const buena = p ? Modelo.iniciar_sesion(p.usuario, Semilla.CLAVE_DEMO) : { ok: false };
        const mala = p ? Modelo.iniciar_sesion(p.usuario, Semilla.CLAVE_DEMO + 'x') : { ok: true };

        push({
          nombre: '🔴 La clave buena entra y la equivocada no',
          intento: 'Entrar con la clave de demostración, y después con esa misma más una letra',
          esperado: 'La primera entra, la segunda no',
          paso: !!buena.ok && !mala.ok,
          detalle: !buena.ok ? 'La clave BUENA no entró: ' + buena.motivo
            : (mala.ok ? 'La clave equivocada entró: la huella no se está comparando'
              : 'Entra la buena, rebota la equivocada')
        });
      })();

      /* 🔴 SIS-1 · CAMBIAR LA CLAVE TAMPOCO LA ESCRIBE.

         Éste es el daño que de verdad se cierra. La clave de demostración es
         pública y da lo mismo; la que escribe una persona es SUYA, y de las que
         se reutilizan en otras partes. Antes quedaba en el documento. */
      (function () {
        const p = db.persona.find((x) => x.usuario === 'nicole.hernandez@dyp.cl');
        const NUEVA = 'clave-de-prueba-2026';
        const antes = p ? p.clave_hash : null;
        const r = p ? Modelo.cambiar_clave(p.id, Semilla.CLAVE_DEMO, NUEVA) : { ok: false, motivo: 'sin cuenta' };
        const quedoEnTexto = !!p && JSON.stringify(p).indexOf(NUEVA) >= 0;
        const entraConLaNueva = r.ok && Modelo.iniciar_sesion(p.usuario, NUEVA).ok;
        // Se deja como estaba: las demás pruebas cuentan con la clave de demostración.
        if (p && antes) { p.clave_hash = antes; p.clave_inicial = true; }

        push({
          nombre: '🔴 La clave que escribe una persona tampoco queda escrita',
          intento: 'Cambiar la clave de una cuenta y buscar el texto nuevo dentro de su ficha',
          esperado: 'No aparece por ninguna parte, y aun así se puede entrar con ella',
          paso: r.ok && !quedoEnTexto && entraConLaNueva,
          detalle: !r.ok ? 'No dejó cambiarla: ' + r.motivo
            : (quedoEnTexto ? 'La clave nueva quedó escrita en la ficha, legible'
              : (!entraConLaNueva ? 'Se guardó, pero después no deja entrar con ella'
                : 'Sólo quedó la huella, y sirve para entrar'))
        });
      })();

      /* 🔶 SIS-1 · EL SHA-256 ES EL DE VERDAD.

         Está escrito a mano —el proyecto no tiene dependencias y `crypto.subtle`
         es asíncrono— así que hay que comprobarlo contra los vectores conocidos.
         Una huella «casi» correcta no da error: da otro número, y nadie entra. */
      (function () {
        const VECTORES = [
          ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
          ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
          ['hello', '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'],
          /* ⚠️ Con ñ y con tilde, que es el que se rompe de verdad: si el texto
             no entra como bytes UTF-8, «Muñoz» da una huella en un navegador y
             otra en otro, y la persona deja de poder entrar según dónde esté. */
          ['Muñoz', '02529cce20e22bd9fbbe678115e1e3c318c8c7159c54ac2b2d1420c7199ab4c7'],
          ['clave con ñ y tilde: áéíóú',
            '8d35f931090b706b453abe71686ef21492c9da4eadc7c6d7b81b08291a2c9e25']
        ];
        const fallan = VECTORES.filter(([t, esperado]) => Reglas.sha256(t) !== esperado);
        const idAdentro = Reglas.claveHash('pe-t-5', 'x') !== Reglas.claveHash('pe-t-6', 'x');

        push({
          nombre: '🔶 El SHA-256 escrito a mano da los vectores conocidos',
          intento: 'Hashear los cinco vectores conocidos, con ñ y tilde incluidos',
          esperado: 'Los cinco calzan, y la huella cambia si cambia la persona',
          paso: fallan.length === 0 && idAdentro,
          detalle: fallan.length
            ? fallan.length + ' vectores no calzan: el hash está roto y no va a entrar nadie'
            : (!idAdentro ? 'Dos personas con la misma clave dan la misma huella'
              : 'Los cinco vectores calzan y la huella lleva el id adentro')
        });
      })();


      /* 🔴 SIS-2 · ENTRAR AL SISTEMA NO SUBE NADA A LA SALA (23-08-2026).

         `fijar_persona_actual` y `cerrar_sesion` suben `version` —y hacen bien:
         cambian los permisos y hay que botar los memos— pero la sala estaba
         usando ESE número para decidir si tenía algo que mandar. Entrar y salir
         subía el documento entero, 2,4 MB, sin que hubiera cambiado un dato. El
         contador de la sala iba en 508 sin que nadie hubiera trabajado tanto.

         La prueba mira los DOS contadores, porque el arreglo consiste
         exactamente en que dejen de moverse juntos. */
      (function () {
        const p = db.persona.find((x) => x.usuario === 'gabriel.diaz@dyp.cl');
        const q = db.persona.find((x) => x.usuario === 'nicole.hernandez@dyp.cl');

        /* Se parte de una sala SINCRONIZADA: se aplica un documento, y con eso
           la sala anota que lo que hay acá ya está allá. */
        // Igual que abajo: el documento que de verdad viaja, con sus fechas.
        try { Sala.aplicar({ version: 900, db: JSON.parse(localStorage.getItem(Modelo.CLAVE)) }); } catch (e) { /* sin almacenamiento */ }
        const alDia = Sala.hayQueSubir();

        Modelo.iniciar_sesion(p.usuario, Semilla.CLAVE_DEMO);
        Modelo.iniciar_sesion(q.usuario, Semilla.CLAVE_DEMO);
        Modelo.cerrar_sesion();
        Modelo.iniciar_sesion(p.usuario, Semilla.CLAVE_DEMO);
        const trasEntrarYSalir = Sala.hayQueSubir();

        Modelo.guardar_catalogo('asunto_bitacora', { nombre: 'Un cambio de verdad' });
        const trasCambiarUnDato = Sala.hayQueSubir();

        push({
          nombre: '🔴 Entrar y salir no le manda nada a la sala',
          intento: 'Preguntarle a la SALA si tiene algo que subir: recién sincronizada, ' +
            'tras entrar y salir cuatro veces, y tras cambiar un dato',
          esperado: 'No · No · Sí',
          paso: !alDia && !trasEntrarYSalir && trasCambiarUnDato,
          detalle: alDia
            ? 'Cree que tiene algo que subir cuando acaba de sincronizar'
            : (trasEntrarYSalir
              ? 'Entrar y salir la hace subir el documento entero: 2,4 MB por nada, ' +
                'y otros 2,4 de bajada por cada equipo conectado'
              : (!trasCambiarUnDato
                ? 'Un cambio de verdad NO subiría: la sala dejó de sincronizar en silencio, que es peor'
                : 'Sólo sube cuando cambió el documento guardado'))
        });
      })();

      /* 🔴 SIS-2 · PERO CAMBIAR UN DATO SÍ TIENE QUE LLEGAR.

         ⚠️ Sin esta segunda, la de arriba se aprueba dejando el contador
         clavado en cero: nada sube nunca y la sala deja de sincronizar en
         silencio, que es peor que el problema que vino a arreglar. */
      (function () {
        const antes = Modelo.versionGuardada();
        // Sin `id`: es un alta, que no necesita que la fila exista de antes.
        const r = Modelo.guardar_catalogo('asunto_bitacora', { nombre: 'Prueba SIS-2' });
        const despues = Modelo.versionGuardada();

        push({
          nombre: '🔴 Cambiar un dato sí sube exactamente una vez',
          intento: 'Guardar una fila de catálogo y mirar el contador que lee la sala',
          esperado: 'Sube 1',
          paso: !!r.ok && despues === antes + 1,
          detalle: !r.ok ? 'No dejó guardar: ' + r.motivo
            : (despues === antes
              ? 'El contador no se movió: el cambio NO llegaría nunca a la sala'
              : (despues - antes) + ' de diferencia')
        });
      })();

      /* 🔶 SIS-2 · EL PESO DEL DOCUMENTO SE PUEDE MIRAR.

         El techo real es `localStorage`: 5 a 10 MB según navegador, y ahí el
         sistema deja de guardar. A 11 KB por orden y 180 órdenes al mes, eso
         llega a los dos meses y medio de operación de verdad. Un techo que se
         ve venir tiene arreglo; uno que aparece en medio de una demostración,
         no. */
      (function () {
        const p = (typeof Sala !== 'undefined' && Sala.peso) ? Sala.peso() : null;
        const bytes = p ? p.bytes : 0;

        push({
          nombre: '🔶 Cuánto pesa el documento que sube a la sala se puede ver',
          intento: 'Preguntarle a la sala el peso de lo guardado',
          esperado: 'Un número mayor que cero, con su rótulo, y bajo el aviso de 3 MB',
          paso: !!p && bytes > 0 && !!p.rotulo && !p.apretado,
          detalle: !p ? 'La sala no sabe decir cuánto pesa'
            : (bytes === 0 ? 'Dice 0 bytes: no está leyendo lo guardado'
              : (p.apretado
                ? 'Ya pasó los 3 MB (' + p.rotulo + '): hay que cortar lo que viaja'
                : p.rotulo + ' guardados, bajo el aviso de 3 MB'))
        });
      })();



      /* 🔴 SIS-3 · EL DOBLE CLIC NO ESCRIBE DOS VECES (23-08-2026).

         La regla 15 estaba escrita desde el principio y enchufada en UN solo
         lugar: la recepción. Comprobado en el navegador, sobre la orden 23267:
         dos llamadas seguidas dejaban DOS bitácoras idénticas. Y había una
         tercera copia de la misma idea —`Reglas.operacionYaHecha`— exportada y
         sin un solo uso.

         ⚠️ La segunda llamada no devuelve un error: devuelve LO MISMO que la
         primera, marcado `repetida`. Para quien apretó, salió bien una vez, que
         es lo que cree que pasó. */
      (function () {
        /* `Modelo.base()` en vez del `db` de arriba: la sala puede haber
           reemplazado el objeto, y contar en el viejo da cero. */
        const bd = Modelo.base();
        const ot = bd.orden_trabajo.find((o) => !Reglas.esTerminal(bd, o.estado));
        const asunto = bd.asunto_bitacora[0];
        const MENSAJE = 'Prueba de doble clic ' + Date.now();
        const antes = bd.bitacora.length;

        const a = Modelo.escribir_bitacora(ot.id, { asunto_id: asunto.id, mensaje: MENSAJE });
        const b = Modelo.escribir_bitacora(ot.id, { asunto_id: asunto.id, mensaje: MENSAJE });
        const agregadas = bd.bitacora.length - antes;

        // Y un mensaje DISTINTO en la misma orden sí tiene que entrar.
        const c = Modelo.escribir_bitacora(ot.id, { asunto_id: asunto.id, mensaje: MENSAJE + ' y algo más' });
        const agregadasDespues = bd.bitacora.length - antes;

        push({
          nombre: '🔴 Dos clics en la bitácora dejan UNA anotación',
          intento: 'Escribir el mismo mensaje dos veces seguidas, y después uno distinto',
          esperado: 'Una sola anotación de las dos primeras; la tercera sí entra',
          paso: a.ok && b.ok && agregadas === 1 && c.ok && agregadasDespues === 2,
          detalle: agregadas === 2
            ? 'Quedaron DOS anotaciones idénticas: el doble clic sigue duplicando'
            : (!b.ok ? 'La segunda devolvió un error en vez de devolver lo mismo: ' + b.motivo
              : (agregadasDespues !== 2
                ? 'Un mensaje DISTINTO no entró: la llave está agarrando de más'
                : 'Una anotación de las dos iguales, y la distinta entró'))
        });

        push({
          nombre: '🔶 La segunda llamada dice que fue repetida',
          intento: 'Mirar lo que devuelve la segunda',
          esperado: 'ok, y marcada `repetida`',
          paso: !!b.ok && !!b.repetida,
          detalle: b.repetida ? 'Devuelve lo mismo que la primera, marcado'
            : 'No viene marcada: quien llame no puede saber que no escribió'
        });
      })();

      /* 🔶 SIS-3 · LA TABLA DE OPERACIONES NO CRECE PARA SIEMPRE.

         Viaja a la sala dentro del documento, así que una lista que sólo crece
         es peso muerto cruzando la red en cada sincronización. Se poda con la
         misma ventana con la que se decide si algo fue un doble clic.

         ⚠️ La prueba PLANTA una operación vieja en vez de esperar a que pase el
         tiempo. Sin eso no probaba nada: en una corrida nunca se juntan las
         suficientes para notar la diferencia, y la mutación «que no se pode
         nunca» pasaba en verde.  */
      (function () {
        const bd = Modelo.base();
        bd.operacion.push({ llave: 'plantada-vieja', resultado: { ok: true }, ms: 1 });
        const conLaVieja = bd.operacion.length;

        // Cualquier acción con llave dispara la poda.
        const ot = bd.orden_trabajo.find((o) => !Reglas.esTerminal(bd, o.estado));
        Modelo.escribir_bitacora(ot.id, { asunto_id: bd.asunto_bitacora[0].id,
          mensaje: 'Dispara la poda ' + Date.now() });

        const quedaLaVieja = Modelo.base().operacion.some((o) => o.llave === 'plantada-vieja');
        const ahora = Modelo.base().operacion.length;

        push({
          nombre: '🔶 Las operaciones viejas se podan solas',
          intento: 'Plantar una operación de hace rato y ejecutar una acción con llave',
          esperado: 'La vieja ya no está; las de la ventana sí',
          paso: conLaVieja > 0 && !quedaLaVieja && ahora > 0,
          detalle: quedaLaVieja
            ? 'La vieja sigue ahí: la tabla crece para siempre y viaja entera en cada sincronización'
            : (ahora === 0
              ? 'Se podó todo, incluida la recién hecha: no ataja ningún doble clic'
              : 'La vieja se fue y quedaron ' + ahora + ' dentro de la ventana')
        });
      })();

      /* 🔴 ABRIR UNA PESTAÑA NUESTRA NO PUEDE ECHAR A NADIE (23-08-2026, Marco).

         El doble clic en una orden la abre en una pestaña nueva, y ahí el
         sistema pedía entrar de nuevo. La causa no se adivina mirando: desde
         COD-1 la sesión vive en `sessionStorage`, y el navegador **le da una
         copia** a la pestaña que abre… **salvo con `noopener`**. Con esa
         bandera la pestaña nace en otro grupo de contextos y su almacenamiento
         arranca vacío.

         La prueba mira lo que se le pasa a `window.open` de verdad, no una
         función auxiliar que decida bien por su cuenta: si mañana alguien
         vuelve a escribir el `noopener`, esto falla. */
      (function () {
        if (typeof abrirFicha !== 'function') {
          push({ nombre: '🔴 Abrir una pestaña nuestra conserva la sesión',
            intento: 'Llamar a abrirFicha', esperado: 'sin noopener',
            paso: false, detalle: 'abrirFicha no está cargada (falta js/app/render.js)' });
          return;
        }
        const real = window.open;
        const llamadas = [];
        window.open = function () { llamadas.push([].slice.call(arguments)); return null; };
        try { abrirFicha(23298); } catch (e) { /* da igual: lo que importa son los argumentos */ }
        window.open = real;

        const rasgos = llamadas.length ? String(llamadas[0][2] || '') : '(no llamó)';
        push({
          nombre: '🔴 Abrir una pestaña nuestra conserva la sesión',
          intento: 'Abrir la ficha de una orden y mirar con qué se llama a window.open',
          esperado: 'Se abre en _blank y SIN `noopener`, que es lo que vacía el sessionStorage',
          paso: llamadas.length === 1 && rasgos.indexOf('noopener') < 0,
          detalle: !llamadas.length ? 'No abrió ninguna pestaña'
            : (rasgos.indexOf('noopener') >= 0
              ? 'Va con `noopener`: la pestaña nueva nace sin sesión y pide entrar de nuevo'
              : 'Sin `noopener` (' + (rasgos || 'sin rasgos') + '): la sesión viaja')
        });
      })();

      /* 🔴 QUIÉN HACE CADA ETAPA, CLAVADO CONTRA EL SISTEMA ACTUAL (26-08-2026).

         Marco mandó ocho capturas del sistema que usan hoy —el desplegable
         «Seleccionar encargado» de cada etapa— y esto es la transcripción.
         No es una preferencia de diseño: es el dato del cliente, y si alguien
         edita la semilla y se lleva a alguien por delante, el taller se queda
         sin a quién asignarle esa etapa y nadie se entera hasta que un jefe
         abre «Asignar etapas» y encuentra el desplegable vacío.

         ⚠️ LA PRUEBA FIJA LOS NOMBRES, UNO POR UNO. Contar cuántos hay no
         sirve: cambiar a una persona por otra deja el número igual. */
      (function () {
        const ESPERADO = {
          'Desarme': ['Jose Castillo', 'Clever Vicitacion Ramirez Mendoza',
            'Moises Benjamin Avendaño Rojas', 'Gustavo Herrera', 'Juan Cupertino Mora',
            'Jeronimo Hernandez', 'David Ulises Milla Caviedes'],
          'Desabolladura': ['Jose Castillo', 'Clever Vicitacion Ramirez Mendoza',
            'Moises Benjamin Avendaño Rojas', 'Gustavo Herrera', 'Juan Cupertino Mora',
            'Jeronimo Hernandez'],
          'Preparación': ['Carlos (Beto) Rodriguez', 'Luis Fernando Arroyave Nuñez',
            'Felipe Miranda Vasquez'],
          'Pintura': ['Carlos (Beto) Rodriguez', 'Luis Fernando Arroyave Nuñez',
            'Felipe Miranda Vasquez'],
          'Armado': ['Jose Castillo', 'Clever Vicitacion Ramirez Mendoza',
            'Moises Benjamin Avendaño Rojas', 'Gustavo Herrera', 'Juan Cupertino Mora',
            'Jeronimo Hernandez', 'David Ulises Milla Caviedes'],
          'Mecánica': ['Julio Alexis Reyes Orellana'],
          'Terminación': ['Carlos (Beto) Rodriguez', 'Luis Fernando Arroyave Nuñez',
            'Felipe Miranda Vasquez'],
          'Control de calidad': ['Iván Villalobos', 'Esteban Calvo']
        };

        const bd = Modelo.base();
        const problemas = [];
        Object.keys(ESPERADO).forEach((nombre) => {
          const e = bd.etapa.find((x) => x.nombre === nombre);
          if (!e) { problemas.push('no existe la etapa «' + nombre + '»'); return; }
          const tiene = bd.persona_etapa.filter((x) => x.etapa_id === e.id).map((x) => {
            const p = bd.persona.find((y) => y.id === x.persona_id) || {};
            return ((p.nombres || '') + ' ' + (p.apellidos || '')).trim();
          });
          const faltan = ESPERADO[nombre].filter((n) => tiene.indexOf(n) < 0);
          const sobran = tiene.filter((n) => ESPERADO[nombre].indexOf(n) < 0);
          if (faltan.length) problemas.push(nombre + ' perdió a ' + faltan.join(', '));
          if (sobran.length) problemas.push(nombre + ' tiene de más a ' + sobran.join(', '));
        });

        push({
          nombre: '🔴 Cada etapa la hace quien la hace en el sistema actual',
          intento: 'Comparar los habilitados de las 8 etapas contra las capturas de Marco',
          esperado: 'Los mismos nombres, etapa por etapa',
          paso: problemas.length === 0,
          detalle: problemas.length ? problemas.join(' · ')
            : 'Las 8 etapas calzan · ' +
              Object.keys(ESPERADO).map((n) => n + ' ' + ESPERADO[n].length).join(', ')
        });
      })();

      /* 🔴 Y QUE NINGUNA ETAPA QUEDE SIN A QUIÉN ASIGNARLE.

         Va aparte de la de arriba a propósito: aquélla dice QUIÉNES son, ésta
         dice que el taller puede funcionar. Si mañana el cliente cambia la
         lista, la de arriba hay que actualizarla —es dato suyo—; ésta no se
         toca nunca, porque una etapa sin nadie es un vehículo que no avanza.

         Entrega queda fuera: en el sistema actual esa fila no tiene
         desplegable ni casilla, así que no se asigna a nadie. */
      (function () {
        const bd = Modelo.base();
        const SIN_ENCARGADO = ['Entrega'];
        const vacias = bd.etapa
          .filter((e) => e.vigente && SIN_ENCARGADO.indexOf(e.nombre) < 0)
          .filter((e) => !bd.persona_etapa.some((x) => x.etapa_id === e.id))
          .map((e) => e.nombre);

        push({
          nombre: '🔴 Ninguna etapa del taller se queda sin a quién asignarle',
          intento: 'Recorrer las etapas vigentes y mirar si alguna no tiene habilitados',
          esperado: 'Ninguna vacía (salvo Entrega, que no se asigna)',
          paso: vacias.length === 0,
          detalle: vacias.length
            ? 'Sin nadie: ' + vacias.join(', ') + '. El jefe de taller abre «Asignar etapas» y el desplegable sale vacío'
            : 'Las ' + (bd.etapa.filter((e) => e.vigente).length - 1) + ' etapas asignables tienen gente'
        });
      })();

      /* 🔶 Y QUIEN NO TIENE CUENTA NO SE OFRECE PARA ENTRAR.

         Los once del taller están en Personal pero no son usuarios. Sin esto
         la pantalla de ingreso los listaba igual, con el correo en blanco y un
         botón «entrar» que no podía funcionar. */
      (function () {
        const bd = Modelo.base();
        const sinCuenta = bd.persona.filter((p) => p.tipo === 'trabajador' && !p.usuario);
        const ofrecidos = Modelo.sesionesPosibles();
        const colados = ofrecidos.filter((x) => !x.usuario);

        push({
          nombre: '🔶 La pantalla de ingreso no ofrece cuentas que no existen',
          intento: 'Pedir las sesiones posibles con ' + sinCuenta.length + ' trabajadores sin usuario',
          esperado: 'Sólo los que tienen cuenta de verdad',
          paso: sinCuenta.length > 0 && colados.length === 0,
          detalle: !sinCuenta.length
            ? 'No hay trabajadores sin cuenta: el caso no se pudo probar'
            : (colados.length
              ? 'Se colaron ' + colados.length + ' sin usuario: serían botones muertos'
              : 'Ofrece ' + ofrecidos.length + ' y deja fuera a los ' + sinCuenta.length + ' del taller')
        });
      })();

      /* 🔴 NADIE PINTA LA TORRE ENCIMA DE UNA FICHA (26-08-2026, Marco).

         «Hago doble clic para visualizar la info de esa OT y me vuelve a la
         Torre de control y más encima me saca el panel lateral.»

         `render()` pinta `ui.vista` —que en la ventana de una OT vale «torre»—
         así que cualquiera que lo llame ahí borra la ficha. La sala compartida
         lo llamaba en cada latido: la ficha duraba un segundo.

         ⚠️ LA PRUEBA LLAMA A `render()` DIRECTO, que es lo que hacen la sala,
         los temporizadores y el próximo archivo que se escriba. La primera
         versión de esta prueba leía el código de la sala buscando llamadas
         sueltas, y NO cazaba el latido — el camino que de verdad rompía la
         pantalla de Marco— porque esa función no se puede leer desde afuera.
         Mirando el comportamiento se cazan todos, incluso los que no existen
         todavía. */
      (function () {
        const antesReg = ui.registroOT;
        const realModo = (typeof modoRegistro === 'function') ? modoRegistro : null;
        if (!realModo) {
          push({ nombre: '🔴 Nadie pinta la Torre encima de una ficha',
            intento: 'Buscar modoRegistro', esperado: 'cargada',
            paso: false, detalle: 'modoRegistro no está (falta js/app.js)' });
          return;
        }
        let fichas = 0;
        try {
          modoRegistro = () => { fichas++; };

          ui.registroOT = '23368';
          let reventoConFicha = false;
          try { render(); } catch (e) { reventoConFicha = true; }
          const conFicha = fichas;

          fichas = 0;
          ui.registroOT = null;
          try { render(); } catch (e) { /* en el arnés no hay DOM: da igual */ }
          const sinFicha = fichas;

          push({
            nombre: '🔴 Nadie pinta la Torre encima de una ficha',
            intento: 'Llamar a render() —como hace la sala— con una OT abierta, y después sin ella',
            esperado: 'Con OT abierta repinta LA FICHA; sin ella, el panel de siempre',
            paso: conFicha === 1 && !reventoConFicha && sinFicha === 0,
            detalle: conFicha === 0
              ? 'Con la ficha abierta, render() se puso a pintar el panel: es la Torre encima ' +
                'de la OT, sin barra lateral — el bug que se está arreglando'
              : (reventoConFicha ? 'Reventó al repintar la ficha'
                : (sinFicha !== 0 ? 'Sin ficha abierta igual repintó la ficha ' + sinFicha + ' vez/veces'
                  : 'Con OT abierta → ficha · sin OT → panel'))
          });
        } finally {
          modoRegistro = realModo;
          ui.registroOT = antesReg;
        }
      })();

      /* 🔴 EL PRIMER CLIC NO PUEDE MOVER LA FILA (26-08-2026, Marco).

         «Si tiene una OT abierta y desplegada y quiere abrir otra en otra
         pestaña, doble clic a la otra y se le abre. Porque actualmente tiene
         que contraer primero todo para después doble clic y abrir.»

         La causa: el primer clic desplegaba al tiro, la tabla se rearmaba y la
         fila apuntada se corría 259 px bajo el dedo —medido en Chrome—, así que
         el segundo clic caía en otra parte. Con todo contraído nada se movía y
         por eso «funcionaba» sólo así.

         ⚠️ LA PRUEBA HACE LOS DOS CLICS SIN NADA ENTRE MEDIO, que es el caso
         que estaba roto. Si alguien vuelve a hacer que el clic simple actúe sin
         esperar la ventana del doble clic, acá se cae. */
      (function () {
        if (typeof conDobleClic !== 'function' || typeof VENTANA_DOBLE_CLIC !== 'number') {
          push({ nombre: '🔴 Con una fila desplegada, el doble clic en otra abre igual',
            intento: 'Buscar conDobleClic', esperado: 'cargada',
            paso: false, detalle: 'conDobleClic no está cargada (falta js/app/render.js)' });
          return;
        }

        /* Una fila de mentira con lo justo: un `addEventListener` que guarda el
           oyente y un `contains` que dice que sí. No se toca el DOM real porque
           en el arnés no hay. */
        const oyentes = [];
        const celda = { classList: { add() {} }, title: '', contains: () => true };
        const fila = { addEventListener: (t, f) => { if (t === 'click') oyentes.push(f); } };

        let desplegadas = 0, abiertas = 0;
        conDobleClic(fila, 'ot-23366',
          () => { abiertas++; return true; },
          () => { desplegadas++; },
          celda);

        const clic = () => oyentes.forEach((f) => f({ target: celda }));
        clic(); clic();                       // los dos clics, sin nada entremedio

        /* Lo que importa: al segundo clic YA abrió, y el despliegue del primero
           no llegó a ejecutarse. Si el clic simple actuara al tiro, acá
           `desplegadas` valdría 1 y la tabla se habría movido entre medio. */
        push({
          nombre: '🔴 Con una fila desplegada, el doble clic en otra abre igual',
          intento: 'Dos clics seguidos sobre la celda de la OT, sin nada entre medio',
          esperado: 'Abre UNA pestaña y no despliega: entre clic y clic la tabla no se mueve',
          paso: abiertas === 1 && desplegadas === 0,
          detalle: desplegadas
            ? 'El primer clic desplegó al tiro (' + desplegadas + '): la fila se corre y el ' +
              'segundo clic cae en otra parte — es el bug que se está arreglando'
            : (abiertas !== 1
              ? 'Abrió ' + abiertas + ' pestañas en vez de una'
              : 'Una pestaña, cero despliegues, con ventana de ' + VENTANA_DOBLE_CLIC + ' ms')
        });
      })();

      /* 🔴 UN GESTO, UNA PESTAÑA (26-08-2026).

         `conDobleClic` tenía DOS caminos para el mismo gesto: la cuenta a mano
         y un `dblclick` nativo. Mientras el clic simple redibujaba, el nativo no
         llegaba a dispararse y nadie lo notó; en los paneles sin desplegable
         —Bodega, Documentos— sí se disparaba, y un doble clic llamaba a abrir
         dos veces. Dos `window.open`, dos pestañas de la misma orden.

         La prueba cuenta oyentes: si vuelve a aparecer un segundo camino, falla
         antes de que alguien lo vea en pantalla. */
      (function () {
        if (typeof conDobleClic !== 'function') return;
        const tipos = [];
        const celda = { classList: { add() {} }, title: '', contains: () => true };
        const fila = { addEventListener: (t) => tipos.push(t) };
        conDobleClic(fila, 'ot-1', () => true, null, celda);

        push({
          nombre: '🔴 Un doble clic abre una pestaña, no dos',
          intento: 'Contar los oyentes que engancha `conDobleClic` en la fila',
          esperado: 'Sólo `click`. Con `dblclick` además, el mismo gesto abre dos veces',
          paso: tipos.length === 1 && tipos[0] === 'click',
          detalle: tipos.indexOf('dblclick') >= 0
            ? 'Volvió el `dblclick` nativo junto a la cuenta a mano: dos caminos, dos pestañas'
            : 'Un solo camino (' + (tipos.join(', ') || 'ninguno') + ')'
        });
      })();

      /* 🔴 Y EL PASE LO TIENE QUE DEJAR QUIEN ABRE (26-08-2026).

         Sin esto, todo lo de abajo se puede cumplir perfecto y el sistema
         seguir echando a la gente: bastaba que `abrirNuestra` no dejara el
         pase, y la pestaña nueva no tenía qué adoptar. Se comprobó rompiéndolo
         a propósito —sacando la llamada— y ninguna prueba se caía.

         Se mira el efecto real: abrir una ficha tiene que dejar el pase puesto,
         no que exista la función. */
      (function () {
        if (typeof abrirFicha !== 'function' || typeof CLAVE_PASE !== 'string') return;
        const antes = (Modelo.personaActual() || {}).id || null;
        Modelo.fijar_persona_actual('pe-t-2');
        try { localStorage.removeItem(CLAVE_PASE); } catch (e) { /* nada */ }

        const real = window.open;
        window.open = function () { return null; };
        try { abrirFicha(23298); } catch (e) { /* lo que importa es el pase */ }
        window.open = real;

        let dejo = null;
        try { dejo = JSON.parse(localStorage.getItem(CLAVE_PASE) || 'null'); } catch (e) { dejo = null; }
        try { localStorage.removeItem(CLAVE_PASE); } catch (e) { /* nada */ }
        Modelo.fijar_persona_actual(antes);

        push({
          nombre: '🔴 Abrir una orden le deja el pase a la pestaña nueva',
          intento: 'Abrir la ficha de una orden y mirar si quedó el pase puesto',
          esperado: 'Queda el pase con el id de quien tiene la sesión',
          paso: !!dejo && dejo.id === 'pe-t-2' && typeof dejo.t === 'number',
          detalle: !dejo
            ? 'No dejó pase: la pestaña nueva no tiene qué adoptar y pedirá la clave de nuevo'
            : (dejo.id !== 'pe-t-2'
              ? 'Dejó el pase de otra persona: ' + dejo.id
              : 'Pase puesto para pe-t-2, con hora')
        });
      })();

      /* 🔴 LA PESTAÑA NUEVA NO PUEDE PEDIR LA CLAVE DE NUEVO (26-08-2026, Marco).

         «Se me abre una pestaña automáticamente pero luego me devuelve a la
         original (Torre de control).» Eso que se ve es el arranque sin sesión:
         pinta la Torre y le pone el ingreso encima, venga uno de Bodega, de
         Presupuesto o de donde sea.

         Sacar `noopener` hizo que Chrome de escritorio copiara el
         `sessionStorage` —la prueba de más arriba cuida eso— pero esa copia es
         una cortesía del navegador y no se puede dar por hecha. El pase la
         reemplaza cuando no llega.

         ⚠️ SE PRUEBA ADOPTANDO DE VERDAD, no mirando la tabla: se deja el pase,
         se vacía la sesión como si fuera otra pestaña, y se pregunta si entró
         quien correspondía. Y se comprueban los dos candados que lo hacen
         aceptable: de un solo uso, y muere con el reloj. */
      (function () {
        if (typeof dejarPase !== 'function' || typeof tomarPase !== 'function') {
          push({ nombre: '🔴 La pestaña nueva hereda la sesión, no la vuelve a pedir',
            intento: 'Buscar el pase', esperado: 'cargado',
            paso: false, detalle: 'dejarPase/tomarPase no están (falta js/app/render.js)' });
          return;
        }
        const antes = (Modelo.personaActual() || {}).id || null;
        Modelo.fijar_persona_actual('pe-t-2');          // Gabriel Díaz

        dejarPase();
        const primero = tomarPase();
        const segundo = tomarPase();                    // el mismo pase, otra vez

        Modelo.fijar_persona_actual(null);              // como una pestaña que nace vacía
        const adoptado = Modelo.adoptar_sesion(primero);
        const quedo = (Modelo.personaActual() || {}).id || null;

        // Y uno vencido: se fabrica con la hora corrida hacia atrás.
        Modelo.fijar_persona_actual('pe-t-2');
        dejarPase();
        try {
          const d = JSON.parse(localStorage.getItem('dyp-pase'));
          d.t = d.t - (PASE_VIVE + 1000);
          localStorage.setItem('dyp-pase', JSON.stringify(d));
        } catch (e) { /* si no se pudo, la comprobación de abajo lo dirá */ }
        const vencido = tomarPase();

        Modelo.fijar_persona_actual(antes);

        const bien = primero === 'pe-t-2' && segundo === null &&
          adoptado === true && quedo === 'pe-t-2' && vencido === null;
        push({
          nombre: '🔴 La pestaña nueva hereda la sesión, no la vuelve a pedir',
          intento: 'Dejar el pase, adoptarlo desde una pestaña sin sesión, y volver a pedirlo',
          esperado: 'Entra quien tenía la sesión · el pase sirve UNA vez · vencido no sirve',
          paso: bien,
          detalle: primero !== 'pe-t-2' ? 'El pase no trajo a quien tenía la sesión: ' + primero
            : (segundo !== null ? 'El pase sirvió DOS veces: no es de un solo uso'
            : (!adoptado || quedo !== 'pe-t-2' ? 'No adoptó la sesión: quedó en ' + quedo
            : (vencido !== null ? 'Un pase de hace más de ' + PASE_VIVE + ' ms todavía sirve'
            : 'Hereda, se gasta al primer uso, y a los ' + (PASE_VIVE / 1000) + ' s ya no sirve')))
        });
      })();

      /* 🔴 LO QUE SE ESCRIBE HOY QUEDA FECHADO HOY (23-08-2026, Marco).

         `HOY` estaba clavado en el 12-08-2026 —el día del levantamiento— así que
         un documento cargado hoy salía fechado once días atrás, y lo mismo toda
         anotación de bitácora.

         ⚠️ LA PRUEBA MIRA UN REGISTRO ESCRITO DE VERDAD, y no la constante.
         El primer intento comparaba `HOY` contra el reloj y dejaba pasar el caso
         «alguien adelantó el calendario a propósito». Con esa salida de escape,
         volver a clavar la fecha en el 12 de agosto NO se cazaba: se comprobó
         rompiéndolo. Lo que importa no es cuánto vale la constante, es con qué
         fecha nace lo que una persona escribe. */
      (function () {
        const bd = Modelo.base();
        const ot = bd.orden_trabajo.find((o) => !Reglas.esTerminal(bd, o.estado));
        const antes = bd.bitacora.length;
        Modelo.escribir_bitacora(ot.id, { asunto_id: bd.asunto_bitacora[0].id,
          mensaje: 'Con que fecha nace esto ' + Date.now() });
        const escrita = Modelo.base().bitacora[Modelo.base().bitacora.length - 1];
        const f = escrita && escrita.fecha instanceof Date ? escrita.fecha : null;

        const hoy = new Date();
        const mismoDia = f && f.getFullYear() === hoy.getFullYear()
          && f.getMonth() === hoy.getMonth() && f.getDate() === hoy.getDate();
        const traeHora = f && (f.getHours() || f.getMinutes() || f.getSeconds());

        push({
          nombre: '🔴 Lo que se escribe hoy queda fechado hoy',
          intento: 'Escribir una anotación y mirar con qué fecha quedó',
          esperado: 'El día de hoy de verdad, y con la hora del reloj',
          paso: !!mismoDia && !!traeHora,
          detalle: !f ? 'La anotación no quedó con una fecha'
            : (!mismoDia
              ? 'Quedó fechada el ' + f.toLocaleDateString('es-CL') + ' y hoy es ' +
                hoy.toLocaleDateString('es-CL') + ': la fecha del sistema está clavada'
              : (!traeHora ? 'Quedó a medianoche: no lleva la hora del reloj'
                : 'Fechada hoy, ' + f.toLocaleTimeString('es-CL')))
        });
      })();
      /* 🔶 EL IVA DEL PRESUPUESTO SALE DE CONFIGURACIÓN (23-08-2026).

         La pantalla lo tenía escrito a mano —un `19` en la llamada— mientras el
         documento impreso lo leía del parámetro. Dos lugares calculando lo mismo
         por caminos distintos: el día que alguien cambiara el IVA, la pantalla y
         lo que se le manda a la compañía habrían dicho cosas distintas. */
      (function () {
        if (typeof grillaPresupuesto !== 'function') {
          push({ nombre: '🔶 El IVA del presupuesto sale de Configuración', intento: 'Pintar la grilla',
            esperado: 'usa el parámetro', paso: false, detalle: 'la vista no está cargada' });
          return;
        }
        const bd = Modelo.base();
        const previo = Reglas.parametro(bd, 'iva', 19);
        const o = Modelo.torre().find((x) => (x.presupuestos || []).length);
        if (!o) {
          push({ nombre: '🔶 El IVA del presupuesto sale de Configuración', intento: 'Buscar una OR',
            esperado: 'usa el parámetro', paso: false, detalle: 'ninguna orden tiene presupuesto' });
          return;
        }
        const pr = o.presupuestos[0];
        // Se mueve el parámetro a un número que NO puede venir de ninguna otra parte.
        Modelo.guardar_parametro('iva', 7);
        const conSiete = grillaPresupuesto(o, Object.assign({}, pr, { totales: null }), false, (n) => String(n));
        Modelo.guardar_parametro('iva', previo);

        push({
          nombre: '🔶 El IVA del presupuesto sale de Configuración, no de un 19 escrito a mano',
          intento: 'Poner el IVA en 7% y volver a pintar la grilla del presupuesto',
          esperado: 'Dice «IVA 7%» y ya no dice «IVA 19%»',
          paso: conSiete.indexOf('IVA 7%') >= 0 && conSiete.indexOf('IVA 19%') < 0,
          detalle: conSiete.indexOf('IVA 19%') >= 0
            ? 'Sigue diciendo 19% con el parámetro en 7: está escrito a mano en la vista'
            : (conSiete.indexOf('IVA 7%') < 0 ? 'No encontré el rótulo del IVA en la grilla'
              : 'La pantalla sigue el parámetro, igual que el impreso')
        });
      })();

      /* 🔶 EL PANEL DE COBRO CIERRA EL PRESUPUESTO (23-08-2026, Marco).

         «Debemos tener un panel final del valor a cobrar sobre ese presupuesto,
         separado por Neto, el IVA a cobrar y el total con IVA.» */
      (function () {
        if (typeof grillaPresupuesto !== 'function') return;
        const o = Modelo.torre().find((x) => (x.presupuestos || []).length);
        if (!o) return;
        const html = grillaPresupuesto(o, o.presupuestos[0], false, (n) => String(n));
        const tiene = (s) => html.indexOf(s) >= 0;
        const posicion = html.indexOf('class="panel-cobro"');

        push({
          nombre: '🔶 El presupuesto cierra con el valor a cobrar, separado en tres',
          intento: 'Pintar la grilla y buscar el panel con Neto, IVA y Total con IVA',
          esperado: 'Están los tres, y el panel va al final',
          paso: tiene('class="panel-cobro"') && tiene('Valor a cobrar') && tiene('>Neto<')
            && tiene('Total con IVA') && posicion > html.length * 0.5,
          detalle: !tiene('class="panel-cobro"') ? 'No está el panel de cobro'
            : (!tiene('Total con IVA') ? 'Falta el total con IVA'
              : (posicion <= html.length * 0.5 ? 'El panel no está al final: es lo último que se mira'
                : 'Neto, IVA y Total con IVA, cerrando la pantalla'))
        });
      })();

      /* 🔶 EL NÚMERO DE OR VA SOLO, SIN NADA ATRÁS (23-08-2026, Marco).

         El título decía «Editar presupuesto N° 23489-18089-001»: ese `-001` era
         la VERSIÓN rellenada a tres dígitos, y se leía como el correlativo viejo
         de la OR —el que se sacó el 15-08—. «No debiese estar, ya que no se
         repite la OR asociada a una OT.»

         Se pinta la pantalla de verdad y se busca ahí. Comparar un texto armado
         acá adentro no probaría nada: probaría que sé escribir una expresión
         regular. */
      (function () {
        if (typeof vPresupuestoOT !== 'function') return;
        const o = Modelo.torre().find((x) => (x.presupuestos || []).length);
        if (!o) return;
        const pr = o.presupuestos[0];
        const previo = ui.presupuesto;
        ui.presupuesto = { otId: o.id, presupuestoId: pr.id };
        let html = '';
        try { html = vPresupuestoOT(o); } catch (e) { html = '(no se pudo pintar: ' + e.message + ')'; }
        ui.presupuesto = previo;

        // El numero de OR es solo digitos y un guion: no hay nada que escapar.
        const conSufijo = new RegExp(String(pr.numeroOR) + '-[0-9]{3}');
        const dice = (s) => html.indexOf(s) >= 0;
        const unaSolaVersion = o.presupuestos.filter((x) => x.numeroOR === pr.numeroOR).length === 1;

        push({
          nombre: '🔶 El número de OR va solo: sin el -001 y sin «versión 1»',
          intento: 'Pintar el editor del presupuesto y leer su encabezado',
          esperado: 'Dice la OR y la patente, y con una sola versión no dice «versión»',
          paso: !conSufijo.test(html) && dice(String(pr.numeroOR))
            && (!unaSolaVersion || !dice('versión ' + pr.version)),
          detalle: conSufijo.test(html)
            ? 'Sigue apareciendo ' + pr.numeroOR + '-00' + pr.version + ': el sufijo de versión no se sacó'
            : (!dice(String(pr.numeroOR)) ? 'No aparece el número de OR por ninguna parte'
              : (unaSolaVersion && dice('versión ' + pr.version)
                ? 'Con una sola versión sigue diciendo «versión ' + pr.version + '»'
                : 'La OR ' + pr.numeroOR + ' sola, sin sufijo' +
                  (unaSolaVersion ? ' y sin rótulo de versión' : ' (esta OR sí tiene varias versiones)')))
        });
      })();


      /* 🔴 LOS PERMISOS SON DE LA PERSONA, NO DEL ROL (23-08-2026, Marco).

         Antes colgaban del rol y se editaban en una matriz de Configuración.
         Ahora cada cuenta tiene la suya y se mueve en Personal.

         La prueba mira lo que de verdad importa: que quitarle un permiso a UNA
         persona no se lo quite a las demás que comparten su rol. Eso es todo lo
         que este cambio vino a resolver. */
      (function () {
        const bd = Modelo.base();
        const conMismoRol = bd.persona.filter((p) => p.usuario && p.tipo === 'trabajador')
          .map((p) => ({ p, rol: (bd.persona_rol.find((x) => x.persona_id === p.id) || {}).rol_id }))
          .filter((x) => x.rol && !(bd.rol.find((r) => r.id === x.rol) || {}).total);

        // Dos cuentas distintas que comparten rol, que es el caso que dolía.
        let a = null, b = null;
        conMismoRol.forEach((x) => {
          if (a && !b && x.rol === a.rol && x.p.id !== a.p.id) b = x;
          if (!a) a = x;
        });
        if (!b) {
          conMismoRol.forEach((x) => {
            const otro = conMismoRol.find((y) => y.rol === x.rol && y.p.id !== x.p.id);
            if (otro && !b) { a = x; b = otro; }
          });
        }
        if (!a || !b) {
          push({ nombre: '🔴 Quitarle un permiso a una cuenta no se lo quita a las demás',
            intento: 'Buscar dos cuentas que compartan rol', esperado: 'dos', paso: false,
            detalle: 'No hay dos cuentas con el mismo rol en la nómina' });
          return;
        }

        const codigo = (Modelo.permisosDePersona(a.p.id) || [])
          .find((c) => c !== 'configuracion' && (Modelo.permisosDePersona(b.p.id) || []).indexOf(c) >= 0);
        if (!codigo) {
          push({ nombre: '🔴 Quitarle un permiso a una cuenta no se lo quita a las demás',
            intento: 'Buscar un permiso que las dos tengan', esperado: 'uno', paso: false,
            detalle: 'Las dos cuentas no comparten ningún permiso' });
          return;
        }

        const r = Modelo.fijar_persona_permiso(a.p.id, codigo, false);

        /* ⚠️ Se pregunta con `Modelo.puede()` ENTRANDO como cada una, y no
           leyendo la tabla. La primera versión miraba `permisosDePersona` y por
           eso no cazaba nada: esa función lee la tabla nueva sí o sí, así que
           daba lo mismo que el motor hubiera vuelto a resolver por el rol. Lo
           que hay que comprobar es lo que el sistema HACE con la persona
           sentada adelante. */
        const comoEl = (persona_id, cod) => {
          Modelo.fijar_persona_actual(persona_id);
          return Modelo.puede(cod);
        };
        const sesionPrevia = (Modelo.personaActual() || {}).id || null;
        const aLoPerdio = !comoEl(a.p.id, codigo);
        const bLoConserva = comoEl(b.p.id, codigo);
        /* ⚠️ Y se devuelve la sesión donde estaba. Entrar como otra persona no
           es gratis: cambia los permisos y bota los memos, y la prueba de la
           sala que corre más abajo daba por sentado quién estaba sentado. */
        Modelo.fijar_persona_actual(sesionPrevia);
        Modelo.fijar_persona_permiso(a.p.id, codigo, true);   // se deja como estaba

        push({
          nombre: '🔴 Quitarle un permiso a una cuenta no se lo quita a las demás',
          intento: 'Quitarle «' + codigo + '» a una cuenta y mirar a otra del mismo rol',
          esperado: 'La primera lo pierde, la segunda lo conserva',
          paso: !!r.ok && aLoPerdio && bLoConserva,
          detalle: !r.ok ? 'No dejó quitarlo: ' + r.motivo
            : (!aLoPerdio ? 'No se lo quitó a nadie'
              : (!bLoConserva
                ? 'Se lo quitó TAMBIÉN a la otra cuenta: sigue colgando del rol'
                : 'Cada cuenta tiene la suya'))
        });
      })();

      /* 🔴 LA PUERTA NO SE PUEDE CERRAR POR DENTRO (23-08-2026).

         Con la matriz por rol esto se resolvía diciendo que la fila de
         Administración no se toca. Con los permisos por persona esa proteccion
         ya no alcanza, y la regla pasa a estar escrita de verdad: siempre tiene
         que quedar al menos una cuenta activa que pueda entrar a Configuración.

         ⚠️ LA PRUEBA AFIRMA LA GARANTÍA, no fabrica el caso. El primer intento
         quitaba el permiso a todas menos una para ver si la última rebotaba, y
         nunca llegaba: las cuentas de acceso total conservan «configuracion»
         pase lo que pase, así que jamás queda una sola. Eso NO es que el
         guardia falle — es que el sistema esta protegido por dos lados. Lo que
         hay que comprobar es el resultado: intentar quitárselo a TODAS y que
         igual quede alguien que pueda entrar. */
      (function () {
        const bd = Modelo.base();
        const cuentas = bd.persona.filter((p) => p.usuario && p.activo);
        const antes = cuentas.filter((p) =>
          (Modelo.permisosDePersona(p.id) || []).indexOf('configuracion') >= 0);

        /* Se intenta quitárselo a TODAS, sin excepción.

           ⚠️ Y se repone SÓLO a las que lo tenían. Quitar un permiso que la
           cuenta no tiene también devuelve «ok» —no hay nada que hacer— así que
           usar esa respuesta para saber a quién devolvérselo se lo regala a las
           catorce. Pasó, y la prueba lo cazó: «14 de 3». */
        cuentas.forEach((p) => Modelo.fijar_persona_permiso(p.id, 'configuracion', false));
        const despues = cuentas.filter((p) =>
          (Modelo.permisosDePersona(p.id) || []).indexOf('configuracion') >= 0);
        antes.forEach((p) => Modelo.fijar_persona_permiso(p.id, 'configuracion', true));
        const repuesto = cuentas.filter((p) =>
          (Modelo.permisosDePersona(p.id) || []).indexOf('configuracion') >= 0);

        push({
          nombre: '🔴 No se puede dejar al sistema sin nadie que entre a Configuración',
          intento: 'Intentar quitarle «configuracion» a las ' + cuentas.length + ' cuentas activas',
          esperado: 'Alguna lo conserva igual',
          paso: antes.length > 0 && despues.length > 0 && repuesto.length === antes.length,
          detalle: !despues.length
            ? 'El sistema quedó sin nadie que pueda volver a entrar a Configuración'
            : (repuesto.length !== antes.length
              ? 'La prueba no dejó las cuentas como estaban (' + repuesto.length + ' de ' + antes.length + ')'
              : 'Quedan ' + despues.length + ' de ' + antes.length + ' que igual entran: ' +
                despues.map((p) => p.nombres).join(', '))
        });
      })();
      /* 🔶 UNA CUENTA DE ACCESO TOTAL NO SE PUEDE RECORTAR.

         Es la otra mitad de la misma garantía, y va aparte porque se rompe de
         otra manera: acá el rechazo no depende de cuántas cuentas queden. */
      (function () {
        const bd = Modelo.base();
        const total = bd.persona.find((p) => {
          const pr = bd.persona_rol.find((x) => x.persona_id === p.id);
          return p.usuario && pr && (bd.rol.find((r) => r.id === pr.rol_id) || {}).total;
        });
        if (!total) return;
        const r = Modelo.fijar_persona_permiso(total.id, 'configuracion', false);
        const sigueEntrando = (Modelo.permisosDePersona(total.id) || []).indexOf('configuracion') >= 0;

        push({
          nombre: '🔶 A una cuenta de acceso total no se le puede quitar nada',
          intento: 'Quitarle «configuracion» a la cuenta de acceso total',
          esperado: 'Rebota, y la cuenta sigue entrando',
          paso: !r.ok && sigueEntrando,
          detalle: r.ok ? 'Dejó recortarla: la garantía de acceso total no está'
            : (!sigueEntrando ? 'Rebotó pero igual perdió el permiso'
              : 'Rebota y conserva el catálogo completo')
        });
      })();

      /* 🔶 UNA CUENTA SIN NINGÚN MÓDULO NO ENTRA A NINGUNA PANTALLA.

         Dejarla en cero es lo mismo que desactivarla, pero sin decirlo: la
         persona entra al sistema y se queda mirando una pared. */
      (function () {
        const bd = Modelo.base();
        const p = bd.persona.find((x) => x.usuario && Array.isArray(x.modulos) && x.modulos.length);
        if (!p) return;
        const previos = p.modulos.slice();
        previos.slice(0, previos.length - 1).forEach((m) => Modelo.fijar_persona_modulo(p.id, m, false));
        const r = Modelo.fijar_persona_modulo(p.id, p.modulos[0], false);
        const quedaronLos = p.modulos.length;
        previos.forEach((m) => Modelo.fijar_persona_modulo(p.id, m, true));

        push({
          nombre: '🔶 Una cuenta no se puede quedar sin ningún módulo',
          intento: 'Quitarle los módulos uno por uno hasta el último',
          esperado: 'El último rebota',
          paso: !r.ok && quedaronLos === 1,
          detalle: r.ok ? 'La dejó en cero módulos: entra al sistema y no ve ninguna pantalla'
            : 'Rebota con el último, y le queda ' + quedaronLos
        });
      })();

      /* 🔶 CONFIGURACIÓN YA NO TIENE «PARÁMETROS» NI «ROLES Y PERMISOS».

         Los dos se sacaron el 23-08-2026. La prueba pinta la pantalla de verdad
         en vez de mirar la constante: lo que importa es que no queden las
         pestañas, no que la lista esté bien escrita. */
      (function () {
        if (typeof vConfiguracion !== 'function') return;
        const previo = ui.configuracion;
        let html = '';
        try { html = vConfiguracion(); } catch (e) { html = '(no pintó: ' + e.message + ')'; }
        ui.configuracion = previo;

        const dice = (s) => html.indexOf(s) >= 0;
        push({
          nombre: '🔶 Configuración ya no tiene Parámetros ni Roles y permisos',
          intento: 'Pintar Configuración y buscar las dos pestañas',
          esperado: 'Ninguna de las dos, y las de catálogo siguen',
          paso: !dice('>Parámetros<') && !dice('>Roles y permisos<') && dice('>Etapas<'),
          detalle: dice('>Parámetros<') ? 'Sigue la pestaña Parámetros'
            : (dice('>Roles y permisos<') ? 'Sigue la pestaña Roles y permisos'
              : (!dice('>Etapas<') ? 'Se llevó también las pestañas de catálogo'
                : 'Las dos fuera, y los catálogos intactos'))
        });
      })();


      /* 🔴 LA REPORTERÍA LA VEN DOS CUENTAS, Y NADIE MÁS (23-08-2026, Marco).

         «Que el panel de Reportería solo lo pueda ver administración y Gabriel
         Díaz. NADIE MÁS. SUMAMENTE IMPORTANTE.» Al preguntarle quién es
         «administración» —en este sistema son dos cosas distintas— contestó:
         «Gabriel Díaz + Administración (Arttmize) de momento».

         ⚠️ LA PRUEBA RECORRE LAS CATORCE CUENTAS Y ENTRA COMO CADA UNA. No mira
         la tabla ni la lista de la semilla: entra y pregunta. Es la única forma
         de que esto no se rompa en silencio, y lo que se juega es la venta y la
         rentabilidad del taller.

         Alejandra es el caso que importa: comparte el rol Administración con
         Gabriel, así que cualquier permiso que venga del ROL le llega a ella
         también. Si esta prueba se pone verde con ella adentro, el arreglo no
         sirvió. */
      (function () {
        const ESPERADOS = ['gabriel.diaz@dyp.cl', 'administrador@dyp.cl'];
        const bd = Modelo.base();
        const cuentas = bd.persona.filter((p) => p.usuario);
        const sesionPrevia = (Modelo.personaActual() || {}).id || null;

        const ven = [];
        cuentas.forEach((p) => {
          Modelo.fijar_persona_actual(p.id);
          if (Modelo.puede('reporteria.ver')) ven.push(p.usuario);
        });
        Modelo.fijar_persona_actual(sesionPrevia);

        const sobran = ven.filter((u) => ESPERADOS.indexOf(u) < 0);
        const faltan = ESPERADOS.filter((u) => ven.indexOf(u) < 0);

        push({
          nombre: '🔴 La Reportería la ven exactamente dos cuentas',
          intento: 'Entrar como cada una de las ' + cuentas.length + ' cuentas y preguntar por `reporteria.ver`',
          esperado: ESPERADOS.join(' y ') + ', y nadie más',
          paso: sobran.length === 0 && faltan.length === 0,
          detalle: sobran.length
            ? 'La ven cuentas que NO deben: ' + sobran.join(', ')
            : (faltan.length ? 'NO la ven cuentas que sí deben: ' + faltan.join(', ')
              : 'La ven las dos, y las otras ' + (cuentas.length - 2) + ' no')
        });
      })();

      /* 🔴 Y EL CASO QUE ROMPE TODO SI SE HACE MAL: el rol de acceso total.

         Va aparte de la de arriba a propósito. Aquella dice QUIÉNES la ven;
         ésta dice POR QUÉ el mecanismo aguanta: un permiso reservado no lo
         otorga ningún rol, ni el que alcanza todo el sistema. Si esa regla se
         cae, la prueba de arriba se cae con ella pero sin explicar la causa. */
      (function () {
        const bd = Modelo.base();
        const sesionPrevia = (Modelo.personaActual() || {}).id || null;
        const totales = bd.persona.filter((p) => {
          const pr = bd.persona_rol.find((x) => x.persona_id === p.id);
          return p.usuario && pr && (bd.rol.find((r) => r.id === pr.rol_id) || {}).total;
        });
        const sinDarselo = totales.filter((p) =>
          (Modelo.permisosDePersona(p.id) || []).indexOf('reporteria.ver') < 0);
        const laVen = [];
        sinDarselo.forEach((p) => {
          Modelo.fijar_persona_actual(p.id);
          if (Modelo.puede('reporteria.ver')) laVen.push(p.usuario);
          // y lo demás sí lo tiene: acceso total sigue siendo acceso total
        });
        Modelo.fijar_persona_actual(sesionPrevia);

        push({
          nombre: '🔴 Ni el acceso total abre un permiso reservado',
          intento: 'Entrar como las cuentas de acceso total a las que NO se les dio la Reportería',
          esperado: 'Ninguna la ve, aunque su rol alcance todo lo demás',
          paso: sinDarselo.length > 0 && laVen.length === 0,
          detalle: !sinDarselo.length
            ? 'Todas las cuentas totales la tienen dada: el caso no se pudo probar'
            : (laVen.length
              ? 'La ven por el rol: ' + laVen.join(', ') + '. El permiso reservado no está funcionando'
              : 'Las ' + sinDarselo.length + ' quedan afuera: ' +
                sinDarselo.map((p) => p.nombres).join(', '))
        });
      })();

      /* 🔶 Y EL ACCESO TOTAL SIGUE SIENDO TOTAL EN TODO LO DEMÁS.

         Sin esta, la de arriba se aprueba rompiendo el rol total entero. */
      (function () {
        const bd = Modelo.base();
        const sesionPrevia = (Modelo.personaActual() || {}).id || null;
        const p = bd.persona.find((x) => {
          const pr = bd.persona_rol.find((y) => y.persona_id === x.id);
          return x.usuario && pr && (bd.rol.find((r) => r.id === pr.rol_id) || {}).total;
        });
        if (!p) return;
        Modelo.fijar_persona_actual(p.id);
        const noReservados = bd.permiso.filter((x) => !x.reservado).map((x) => x.codigo);
        const leFaltan = noReservados.filter((c) => !Modelo.puede(c));
        Modelo.fijar_persona_actual(sesionPrevia);

        push({
          nombre: '🔶 El acceso total sigue alcanzando todo lo no reservado',
          intento: 'Entrar como ' + p.nombres + ' y pedir los ' + noReservados.length + ' permisos no reservados',
          esperado: 'Los tiene todos',
          paso: leFaltan.length === 0,
          detalle: leFaltan.length
            ? 'Le faltan ' + leFaltan.length + ': ' + leFaltan.slice(0, 4).join(', ')
            : 'Los ' + noReservados.length + ', como corresponde'
        });
      })();

      /* 🔴 LA PANTALLA SE DEFIENDE SOLA, NO EL BOTÓN.

         Esconder el botón es una cortesía visual: quien llegue por el menú, por
         la dirección, o con el estado del Histórico ya guardado en «reporteria»,
         entra igual. La única comprobación que sirve es la que hace la pantalla
         antes de dibujarse. */
      (function () {
        if (typeof vReporteria !== 'function') return;
        const bd = Modelo.base();
        const sesionPrevia = (Modelo.personaActual() || {}).id || null;
        const sinPermiso = bd.persona.find((p) => p.usuario &&
          (Modelo.permisosDePersona(p.id) || []).indexOf('reporteria.ver') < 0 &&
          !(bd.rol.find((r) => r.id === (bd.persona_rol.find((x) => x.persona_id === p.id) || {}).rol_id) || {}).total);
        if (!sinPermiso) return;

        Modelo.fijar_persona_actual(sinPermiso.id);
        let html = '';
        try { html = vReporteria(); } catch (e) { html = '(reventó: ' + e.message + ')'; }
        Modelo.fijar_persona_actual(sesionPrevia);

        const dice = (s) => html.indexOf(s) >= 0;
        push({
          nombre: '🔴 La pantalla de Reportería rebota sola, sin depender del botón',
          intento: 'Pintar `vReporteria()` entrando como ' + sinPermiso.nombres + ', que no la tiene',
          esperado: 'Devuelve el cartel de reservada, y ningún dato de venta',
          paso: dice('no está disponible para esta cuenta') && !dice('Venta del período'),
          detalle: dice('reventó')
            ? html
            : (!dice('no está disponible para esta cuenta')
              ? 'Pintó la Reportería completa: la pantalla no se está defendiendo'
              : 'Devuelve el cartel y no dibuja ninguna cifra')
        });
      })();

      /* 🔴 3 · EL COLOR DE UN CATALOGO SE LIMPIA EN EL MOTOR.

         El color se pinta dentro de un atributo `style`. La vista lo escapa,
         pero eso depende de que cada pantalla se acuerde; el motor no depende
         de nadie. Y hasta el 22-08-2026 el valor por omision se aplicaba SOLO
         al crear: al EDITAR una etapa el color entraba tal cual. */
      (function () {
        const et = db.etapa[2];
        const ataques = ['#fff" onmouseover="alert(1)', '"><script>alert(1)</script>',
                         'javascript:alert(1)', '#GGGGGG', 'red', ''];
        const colaron = [];
        ataques.forEach((mal) => {
          Modelo.guardar_catalogo('etapa', { id: et.id, nombre: et.nombre, color: mal });
          const q = db.etapa.find((e) => e.id === et.id).color;
          if (!/^#[0-9a-f]{6}$/i.test(q)) colaron.push(mal.slice(0, 24) + ' -> ' + q);
        });
        Modelo.guardar_catalogo('etapa', { id: et.id, nombre: et.nombre, color: '#a3e635' });
        const sobrevive = db.etapa.find((e) => e.id === et.id).color === '#a3e635';
        push({
          nombre: '🔴 Un color que no es un color no entra al catalogo',
          intento: 'Guardar ' + ataques.length + ' colores invalidos y despues uno legitimo',
          esperado: 'Los invalidos quedan en el color por omision; el legitimo se conserva',
          paso: !colaron.length && sobrevive,
          detalle: colaron.length ? 'Se colaron: ' + colaron.join(' · ')
            : (!sobrevive ? 'El color legitimo tambien se descarto: la validacion es demasiado dura'
              : 'Los ' + ataques.length + ' invalidos se limpiaron y el legitimo quedo')
        });
      })();


      /* 🔴 LA FECHA DE HOY ES LA DE CHILE, NO LA DE LONDRES (COD-2, 22-08-2026).

         `toISOString()` pasa a UTC. Chile esta en UTC-4, asi que desde las
         20:00 hora local devuelve MAÑANA. En `flujo.js` se registraba una
         entrega con fecha del dia siguiente y la comprobacion pasaba o fallaba
         segun a que hora se corriera.

         Lo importante de este caso no es la linea: es que LA TRAMPA YA ESTABA
         ESCRITA en el proyecto —un comentario en `semilla.js` avisaba de esto
         mismo— y el error se repitio igual tres archivos mas alla. De ahi salio
         la regla: una advertencia que importa no se guarda en un comentario, se
         guarda en una prueba que falle cuando alguien la ignore.

         Esta es esa prueba. Fija las horas en vez de depender del reloj del
         equipo, o solo fallaria entre las 20:00 y la medianoche. */
      (function () {
        const hayHelper = typeof Reglas !== 'undefined' &&
                          typeof Reglas.soloDia === 'function' &&
                          typeof Reglas.hoyEnChile === 'function';
        /* Cuatro instantes con su desfase escrito, para no depender de la zona
           horaria del equipo que corre las pruebas. */
        const casos = [
          ['2026-08-22T21:30:00-04:00', '2026-08-22'],   // de noche: UTC ya dice 23
          ['2026-08-22T23:59:00-04:00', '2026-08-22'],   // el filo del dia
          ['2026-08-22T19:00:00-04:00', '2026-08-22'],   // antes del corte
          ['2026-01-01T22:15:00-03:00', '2026-01-01']    // en horario de verano
        ];
        const malos = [];
        let cazaAlViejo = false;
        if (hayHelper) {
          casos.forEach(([iso, esperado]) => {
            const d = new Date(iso);
            const dio = Reglas.soloDia(d);
            if (dio !== esperado) malos.push(iso + ' dio ' + dio + ' y debia dar ' + esperado);
            /* Y que el metodo viejo SI se equivoque en al menos uno: si no, la
               prueba no estaria probando nada —seria verde en las dos formas—. */
            if (d.toISOString().slice(0, 10) !== esperado) cazaAlViejo = true;
          });
        }
        /* `hoyEnChile()` tiene que dar lo mismo que mirar el reloj local. */
        const ahora = new Date();
        const coincideHoy = hayHelper && Reglas.hoyEnChile() ===
          (ahora.getFullYear() + '-' +
           String(ahora.getMonth() + 1).padStart(2, '0') + '-' +
           String(ahora.getDate()).padStart(2, '0'));

        push({
          nombre: '🔴 La fecha de hoy es la de Chile y no la de UTC',
          intento: 'Pedir el dia de ' + casos.length + ' instantes, dos de ellos despues de las 20:00',
          esperado: 'El dia local en los cuatro, y hoyEnChile() igual al reloj del equipo',
          paso: hayHelper && !malos.length && coincideHoy && cazaAlViejo,
          detalle: !hayHelper ? 'No existe Reglas.soloDia/hoyEnChile: el helper no esta donde todos lo ven'
            : (malos.length ? 'Se corrio el dia: ' + malos.join(' · ')
              : (!coincideHoy ? 'hoyEnChile() no coincide con el reloj local'
                : (!cazaAlViejo
                    ? 'OJO: en esta zona horaria toISOString() acierta, asi que esta prueba no ' +
                      'distingue el arreglo del error. Hay que revisarla.'
                    : 'Los ' + casos.length + ' dan el dia local; toISOString() habria fallado')))
        });
      })();



      /* ⚠️ ESTA PRUEBA VA ULTIMA, Y NO ES CAPRICHO.

         Llama a `Sala.aplicar`, que por dentro hace `Modelo.recargarDeDisco()`,
         y eso REEMPLAZA el objeto `db` del modelo por otro. El arnés capturó el
         suyo en la primera línea de `correr()`: desde acá para abajo, esa
         referencia mira un objeto que ya no es el del sistema.

         Costó encontrarlo: la prueba de la bitácora decía que un mensaje nuevo
         no entraba, y sí entraba — lo que pasaba es que se estaba contando en
         el `db` viejo. Lo que se ve no falla; lo que se mide, sí. */

      /* 🔴 LA SALA NO PUEDE TRAER DATOS DE OTRA VERSIÓN (26-08-2026).

         El sello de la semilla existe desde que Marco pasó un día viendo siete
         cuentas con el sistema ya en diecinueve. Pero se miraba SÓLO al
         arrancar, sobre el almacenamiento de este navegador.

         La sala compartida abrió una segunda puerta y ahí no había nadie
         mirando: se publican datos nuevos, la sala baja el documento viejo, y
         la pantalla muestra lo anterior sin un solo error. Pasó hoy: entraron
         los once del taller, se sembró, y la Personal seguía en catorce.

         ⚠️ LA PRUEBA ENSUCIA EL ALMACENAMIENTO Y LO DEJA COMO ESTABA. Va acá,
         al final, junto a la otra que reemplaza el `db` del modelo, y por el
         mismo motivo: lo que corra después estaría midiendo otro objeto. */
      (function () {
        const nombreP = '🔴 Un documento de otra versión de la semilla se vuelve a sembrar';
        let crudo = null;
        try { crudo = localStorage.getItem(Modelo.CLAVE); } catch (e) { crudo = null; }
        if (!crudo) {
          push({ nombre: nombreP, intento: 'Leer el documento guardado',
            esperado: 'Hay uno', paso: false, detalle: 'No hay almacenamiento' });
          return;
        }

        let detalle = '', paso = false;
        try {
          const doc = JSON.parse(crudo);

          /* ⚠️ SE MIRA EL MODELO, NO EL DISCO. La primera versión de esta prueba
             comprobaba que el documento guardado quedara con el sello nuevo, y
             fallaba siempre — con el arreglo funcionando perfecto.

             El motivo: TODA la suite corre dentro de `Modelo.sandbox()`, que
             cambia `guardar` por un simulacro que no escribe nada. Es a
             propósito y está bien: las pruebas no pueden ensuciar los datos de
             quien está usando el sistema. Pero significa que en una prueba el
             disco NUNCA cambia, y cualquier afirmación sobre él es falsa aunque
             el sistema haga lo correcto.

             Lo que sí se puede afirmar acá dentro es lo que importa: que el
             modelo volvió a la semilla y que lo dijo. */
          /* ⚠️ Y SE LE PONE UNA MARCA AL DOCUMENTO VIEJO. Contar trabajadores no
             distingue nada: adentro del sandbox la base YA es la semilla, así
             que sembrar de nuevo la deja igual. Se comprobó rompiéndolo a
             propósito —«detecta el sello pero no siembra»— y la prueba pasaba
             igual. La marca sólo sobrevive si el documento viejo se cargó tal
             cual; si de verdad se volvió a sembrar, no está. */
          const MARCA = 'pe-marca-del-documento-viejo';
          /* Y UNA SEGUNDA MARCA, ÉSTA EN MEMORIA. Con una sola no alcanzaba: la
             mutación «detecta el sello pero no siembra» no carga el documento
             viejo NI vuelve a sembrar —deja la base como estaba— y la marca del
             documento tampoco aparecía, así que la prueba pasaba igual.

             Las dos juntas cierran las tres salidas:
               · si cargó el documento viejo  → aparece MARCA
               · si no hizo nada              → sigue MARCA_MEM
               · si sembró de verdad          → no está ninguna de las dos */
          const MARCA_MEM = 'pe-marca-en-memoria';
          Modelo.base().persona.push({ id: MARCA_MEM, tipo: 'trabajador', nombres: 'Marca',
            apellidos: 'en memoria', activo: false, demo: true });

          doc.sello = 'sello-de-otra-version';
          doc.db.persona.push({ id: MARCA, tipo: 'trabajador', nombres: 'Marca',
            apellidos: 'del documento viejo', activo: false, demo: true });
          localStorage.setItem(Modelo.CLAVE, JSON.stringify(doc));

          const ok = Modelo.recargarDeDisco();
          const quedaMarca = Modelo.base().persona.some((x) => x.id === MARCA);
          const quedaEnMemoria = Modelo.base().persona.some((x) => x.id === MARCA_MEM);
          const ahora = Modelo.base().persona.filter((x) => x.tipo === 'trabajador').length;
          const aviso = Modelo.porQueSeResembro();

          /* `'resembrado'` y no `true`: ése es el contrato. Devolver `true` a
             secas dejaría a la sala sin poder distinguir «cargué lo tuyo» de
             «lo tuyo era viejo», y con eso el documento viejo se queda arriba. */
          paso = ok === 'resembrado' && !quedaMarca && !quedaEnMemoria && !!aviso;
          detalle = !ok
            ? 'recargarDeDisco devolvió ' + ok + ': ni siquiera leyó el documento'
            : (ok !== 'resembrado'
              ? 'Devolvió ' + JSON.stringify(ok) + ' en vez de «resembrado»: la sala no puede saber que hay que subir'
            : (quedaMarca
              ? 'Cargó el documento viejo tal cual: la marca sigue adentro. La pantalla mostraría datos de otra versión'
              : (quedaEnMemoria
                ? 'No volvió a sembrar: avisó y dejó la base como estaba, así que el aviso miente'
                : (!aviso
                ? 'Sembró de nuevo pero no lo dijo: el usuario ve cambiar los datos sin explicación'
                  : 'Detecta el sello ajeno, vuelve a sembrar y lo avisa · ' + ahora + ' trabajadores'))));
        } catch (e) {
          detalle = 'reventó: ' + e.message;
        } finally {
          // Se deja exactamente como estaba, pase lo que pase.
          try { localStorage.setItem(Modelo.CLAVE, crudo); Modelo.recargarDeDisco(); } catch (e) { /* nada */ }
        }

        push({
          nombre: nombreP,
          intento: 'Sellar el documento guardado como de otra versión y recargar de disco',
          esperado: 'Se da cuenta, vuelve a sembrar y lo dice en pantalla',
          paso: paso, detalle: detalle
        });
      })();

      /* 🔴 Y LO RESEMBRADO TIENE QUE SUBIR A LA SALA (26-08-2026).

         La de arriba comprueba que un documento de otra versión no se cargue.
         Ésta comprueba la otra mitad, que es la que de verdad se veía: si el
         equipo se cura solo pero no sube lo suyo, la sala sigue repartiendo el
         documento viejo a todos los demás. Cada uno se cura al abrir —y por eso
         no se nota— hasta que entra alguien con el código anterior y lo vuelve
         a imponer.

         Se llama a `Sala.aplicar()`, que es la que de verdad decide, y se le
         pregunta a `Sala.hayQueSubir()`, que es la que de verdad mira. */
      (function () {
        const nombreP = '🔴 Lo resembrado sube a la sala, no se queda en este equipo';
        if (typeof Sala === 'undefined' || !Sala.aplicar || !Sala.hayQueSubir) {
          push({ nombre: nombreP, intento: 'Buscar Sala.aplicar y Sala.hayQueSubir',
            esperado: 'las dos', paso: false, detalle: 'La sala no está cargada' });
          return;
        }
        let crudo = null;
        try { crudo = localStorage.getItem(Modelo.CLAVE); } catch (e) { crudo = null; }
        if (!crudo) {
          push({ nombre: nombreP, intento: 'Leer el documento guardado',
            esperado: 'Hay uno', paso: false, detalle: 'No hay almacenamiento' });
          return;
        }

        let paso = false, detalle = '';
        try {
          const doc = JSON.parse(crudo);
          doc.sello = 'sello-de-otra-version';
          // Llega por la sala, como llegaría de otro equipo.
          Sala.aplicar({ version: 4242, db: doc });
          const sube = Sala.hayQueSubir();
          paso = sube === true;
          detalle = sube
            ? 'Después de resembrar queda marcado para subir: la sala se pone al día'
            : 'Se dio por conforme: la sala se queda con el documento viejo y se lo reparte a todos';
        } catch (e) {
          detalle = 'reventó: ' + e.message;
        } finally {
          try { localStorage.setItem(Modelo.CLAVE, crudo); Modelo.recargarDeDisco(); } catch (e) { /* nada */ }
        }

        push({
          nombre: nombreP,
          intento: 'Hacer llegar por la sala un documento de otra versión de la semilla',
          esperado: 'El equipo resiembra Y queda con algo que subir',
          paso: paso, detalle: detalle
        });
      })();

      /* 🔴 SIS-2 · PISAR LO DE OTRO EQUIPO YA NO ES SILENCIOSO (23-08-2026).

         La prueba llama a `Sala.aplicar()`, que es la función que de verdad
         escribe encima — no a un ayudante que decida bien por su cuenta. Es la
         lección de COD-1: una prueba que comprueba el JUICIO y no el CABLEADO
         se queda verde cuando alguien desenchufa la llamada. */
      (function () {
        const nombreP = '🔴 La sala no pisa lo que estoy escribiendo';
        if (typeof Sala === 'undefined' || !Sala.queHacerConLoQueLlega) {
          push({ nombre: nombreP, intento: 'Preguntarle a la sala qué hacer con lo que llega',
            esperado: 'Decide', paso: false, detalle: 'La sala no está cargada' });
          return;
        }

        /* ⚠️ El documento tiene que ser el QUE DE VERDAD VIAJA, y no uno armado
           acá con `Modelo.base()`: el modelo escribe las fechas con su propio
           serializador, y un `JSON.stringify` sin él las deja como texto plano.
           Con eso adentro, la Reportería revienta con «getFullYear is not a
           function» tres pantallas más allá. Se toma el guardado tal cual. */
        let crudo = null;
        try { crudo = localStorage.getItem(Modelo.CLAVE); } catch (e) { crudo = null; }
        if (!crudo) {
          push({ nombre: nombreP, intento: 'Preguntarle a la sala qué hacer con lo que llega',
            esperado: 'Decide', paso: false, detalle: 'Sin almacenamiento: no se pudo probar' });
          return;
        }
        const ajeno = { version: 999, db: JSON.parse(crudo) };

        /* Punto de partida propio: sincronizado. Las pruebas de más arriba dejan
           cambios sin subir, y sin esta pasada la decisión saldría «subir» por lo
           que hizo OTRA prueba y no por lo que hace ésta. */
        Sala.aplicar(ajeno);
        const quieto = Sala.queHacerConLoQueLlega();

        /* Y ahora, escribiendo. Esto es Marco generando su presupuesto. */
        Modelo.guardar_catalogo('asunto_bitacora', { nombre: 'Iba escribiendo esto' });
        const escribiendo = Sala.queHacerConLoQueLlega();

        push({
          nombre: nombreP,
          intento: 'Preguntarle a la sala qué hacer con lo que llega: quieto, y con algo recién escrito acá',
          esperado: 'Quieto lo aplica; con algo sin mandar NO lo aplica — sube lo de acá',
          paso: quieto === 'aplicar' && escribiendo === 'subir',
          detalle: quieto !== 'aplicar'
            ? 'Estando al día se niega a aplicar: los dos equipos no se verían nunca'
            : (escribiendo !== 'subir'
              ? 'Con cambios sin mandar igual aplica encima: es el bucle que dejó a Marco sin poder generar un presupuesto'
              : 'Gana el que acaba de escribir, no el que llegó segundo')
        });

        /* 🔶 Y QUE SIGA PISANDO CUANDO CORRESPONDE. Una defensa que nunca deja
           pasar nada no es una defensa: es una desconexión. Si la sala dejara de
           aplicar SIEMPRE, los dos equipos quedarían mirándose y nadie vería lo
           del otro —y ninguna prueba se pondría roja—. */
        const antes = db.asunto_bitacora.length;
        Sala.aplicar(ajeno);
        push({
          nombre: '🔶 Estando al día, lo que llega SÍ se aplica',
          intento: 'Aplicar el documento de la sala sin tener nada pendiente acá',
          esperado: 'Se aplica: si no, la sala compartida no comparte nada',
          paso: db.asunto_bitacora.length !== antes || Sala.hayQueSubir() === false,
          detalle: 'La defensa protege al que escribe, no desconecta a los dos'
        });
      })();

      restaurarSesion();
      return res;
    });
  }

  /* Comprobaciones de que la semilla sigue cuadrando con lo medido en el
     sistema real. No son reglas de negocio: son control de que no rompimos
     los datos de demostración al tocar el motor. */
  function comprobarCifras() {
    const m = Modelo.metricas();
    const db = Modelo.base();
    const esperado = [
      ['Órdenes vivas en la torre',        m.enTorre,                     Semilla.TOTAL_TORRE],
      ['Con repuesto pendiente',           m.conRepuestoPendiente,        Semilla.CON_REPUESTO_PENDIENTE],
      ['Fuera de taller',                  m.fueraDeTaller,               Semilla.FUERA_DE_TALLER],
      ['Sin ninguna etapa asignada',       m.sinEtapa,                    Semilla.SIN_ETAPA],
      ['Trabajadores del equipo de demostración', db.persona.filter((p) => p.tipo === 'trabajador').length, Semilla.EQUIPO_DEMO],
      ['Entregados (histórico)',           Modelo.historico({ todo: true }).length, Semilla.TOTAL_HISTORICO],
      ['Etapas del taller',                db.etapa.length,               9],
      ['Estados del maestro',              db.estado.length,              9],
      ['Estados finales',                  db.estado.filter((e) => e.es_final).length, 5],
      ['Asuntos de bitácora',              db.asunto_bitacora.length,     6],
      ['Ítems del checklist de recepción', db.inventario_item.length,     28],
      // Cuatro, no dos: el checklist dejó de ser un sí/no el 15-08-2026.
      ['Estados posibles de un ítem',      Modelo.inventarioEstados().length, 4],
      ['Pasos del formulario de ingreso',  RECEPCION_PASOS.length,        5],
      // Los dos largos fijos del paso 2. Están acá para que nadie los "arregle"
      // sin darse cuenta: son norma (ISO 3779) y formato legal, no preferencia.
      ['Caracteres de una patente',        PATENTE_LARGO,                 6],
      ['Caracteres de un VIN',             VIN_LARGO,                     17],
      // El tempario se eliminó el 13-08-2026 y con él su cifra de control.
      // Queda ésta en su lugar: que no haya quedado ni un rastro de la tabla.
      /* 11 desde el 18-08-2026: entraron Marcas y Modelos. El cotejo contra
         `cloud.webdyp.cl` mostró que ellos SÍ los administran —73 marcas
         cargadas— y era la única pantalla de su Configuración con uso real,
         mientras que acá los teníamos sembrados y sin dónde editarlos. */
      ['Catálogos configurables',          Modelo.CATALOGOS.length,       11],
      /* 🔴 Ninguna patente repetida. La semilla las repetía —el mismo auto a
         nombre de dos personas— y no lo cachó nadie hasta que el cliente lo vio
         en pantalla. Un dato inventado puede ser cualquier cosa menos
         contradictorio. Se cuenta acá para que si la fórmula se vuelve a tocar,
         la cifra se caiga antes que la reunión. */
      ['Patentes distintas entre los vehículos',
        new Set(db.vehiculo.map((v) => v.patente)).size, db.vehiculo.length],

      /* 🔴 Los repuestos NACEN del presupuesto. La semilla los inventaba
         sueltos: 239 sin línea que los originara y ocho órdenes con repuestos
         pendientes sin ninguna OR. En pantalla eso es un auto que nadie
         presupuestó esperando una pieza que nadie pidió —imposible en el
         taller— y además contradecía la regla que el propio motor aplica al
         aprobar una OR. Marco lo vio en la demostración el 16-08-2026.
         Van como cifra, no como comentario, para que si alguien vuelve a
         sembrar repuestos a mano se caiga acá y no en la reunión. */
      ['Repuestos sin la línea de presupuesto que los originó',
        db.repuesto.filter((r) => !r.presupuesto_linea_id).length, 0],
      ['Órdenes con repuestos y sin presupuesto',
        (function () {
          const conOR = new Set(db.presupuesto.map((p) => p.ot_id));
          return new Set(db.repuesto.map((r) => r.ot_id).filter((id) => !conOR.has(id))).size;
        })(), 0],
      /* Sólo las líneas de proceso `cambio` compran algo: reparar y externo no
         generan pieza. Si esto deja de ser cero, alguien pidió un repuesto
         para una línea que no lo necesita. */
      /* 🔴 El monto GUARDADO y el CALCULADO tienen que ser el mismo. La lista
         muestra `presupuesto.total` —lo guardado— y el PDF recalcula. Se
         separaron al sacar el deducible del documento: la lista decía $0
         porque el deducible se comía el trabajo, y el PDF decía $64.022. Un
         sistema que muestra dos totales para la misma OR no se puede defender
         delante de una compañía, y no se ve hasta que alguien abre el PDF. */
      ['Presupuestos donde la pantalla y el documento no dicen lo mismo',
        (function () {
          /* Se compara lo que ve la PANTALLA contra lo que imprime el
             DOCUMENTO, que es donde el desacuerdo hace daño. Antes se
             comparaba contra lo guardado en la base, y eso pasaba en verde
             mientras el navegador de Marco —con datos de una versión
             anterior— mostraba $0 en el listado y $64.022 en el PDF: la copia
             guardada sólo se refresca cuando alguien toca ese presupuesto.
             Ahora ningún monto se lee de la copia; los dos salen de la misma
             cuenta, y esta cifra lo comprueba. */
          let malos = 0;
          Modelo.torre().concat(Modelo.historico({ todo: true })).forEach((o) =>
            (o.presupuestos || []).forEach((p) => {
              if (!p.totales) { malos++; return; }
              if (p.neto !== p.totales.neto || p.iva !== p.totales.iva ||
                  p.total !== p.totales.total) malos++;
            }));
          return malos;
        })(), 0],
      /* 🔴 NINGÚN PANEL ESCONDE FILAS. Cinco tablas —Taller, Presupuesto,
         Documentos, el seguimiento de Bodega y el Consolidado— pintaban
         `filas.slice(0, 60)` y abajo un rótulo que decía «Mostrando 60 de
         102». Las otras 42 órdenes no existían para el que miraba: no había
         botón, ni página siguiente, ni forma de llegar a ellas. Y el pie de
         tabla del Consolidado sumaba la venta de las 102, así que la misma
         pantalla mostraba dos números distintos de la misma cosa.

         Se sacó el corte y ahora la tabla va entera con su selector de
         páginas. Esta cifra es el guardián: si alguien vuelve a poner un
         `slice`, el panel pinta menos filas de las que hay en la torre y se
         cae acá, no en la reunión. */
      ['Paneles que pintan menos órdenes de las que hay',
        (function () {
          const total = Modelo.torre().length;
          const cuenta = (html) => (String(html).match(/<tr class="fila"/g) || []).length;
          const paneles = [
            ['Taller', typeof vTaller],
            ['Presupuesto', typeof vPresupuesto],
            ['Documentos', typeof vDocumentos],
            ['Bodega · seguimiento', typeof bodegaSeguimiento],
            ['Consolidado', typeof vConsolidado]
          ];
          const fn = { 'Taller': () => vTaller(), 'Presupuesto': () => vPresupuesto(),
            'Documentos': () => vDocumentos(), 'Bodega · seguimiento': () => bodegaSeguimiento(),
            'Consolidado': () => vConsolidado() };
          let cortados = 0;
          paneles.forEach(([nombre, tipo]) => {
            if (tipo !== 'function') return;      // el panel no está cargado
            let n;
            try { n = cuenta(fn[nombre]()); } catch (e) { return; }
            if (n && n < total) cortados++;
          });
          return cortados;
        })(), 0],
      /* 🔴 QUE TODAS LAS PANTALLAS SE HAYAN CARGADO (21-08-2026).

         Un acento grave dentro de un comentario CSS —en `ingreso.js`, donde el
         CSS vive dentro de un template literal— TERMINÓ el literal y el archivo
         entero dejó de cargar. El navegador no mostró ningún error: los otros
         archivos siguieron cargando, la torre se pintó, y lo único que pasó fue
         que `pantallaIngreso` ya no existía.

         El resultado era el peor posible: **el sistema arrancaba en la Torre de
         control, con todos los datos a la vista y sin pedir clave**. Un fallo
         silencioso que se ve como si todo estuviera bien.

         La trampa estaba documentada en `impresos.js` desde antes y aun así se
         repitió, que es exactamente para lo que sirve una cifra: acordarse por
         uno. Si un archivo de vista se rompe, esta cuenta deja de dar cero. */
      ['Pantallas del sistema que no cargaron',
        (function () {
          const debe = ['pantallaIngreso', 'vTorre', 'vTaller', 'vPresupuesto', 'vBodega',
            'vDocumentos', 'vHistorico', 'vConsolidado', 'vPersonal', 'vConfiguracion',
            'vRecepcion', 'vEntrega', 'vMiTrabajo', 'vPorValidar', 'vReporteria',
            'vExpediente', 'vRepuestos', 'vDetenidos', 'mostrarImpreso', 'svgSilueta'];
          /* Se pregunta por `window`, no evaluando el nombre: una `function`
             de nivel superior en un script clásico SÍ queda colgada de
             `window` —a diferencia de un `const`, que no—, así que alcanza
             para saber si su archivo cargó. */
          const donde = (typeof window !== 'undefined') ? window : globalThis;
          return debe.filter((n) => typeof donde[n] !== 'function').length;
        })(), 0],

      /* Una devolución sin motivo deja al encargado mirando la misma etapa sin
         saber qué rehacer. La regla lo exige al devolver; esta cifra vigila que
         tampoco entre así por los datos de demostración. */
      ['Etapas devueltas sin decir por qué',
        db.ot_etapa.filter((x) => x.devuelta_at &&
          String(x.devuelta_motivo || '').trim().length < 5).length, 0],

      /* 🔴 LAS ETAPAS QUE NADIE PUEDE HACER (22-08-2026).

         Al dejar sólo las trece cuentas de la lista de Andrés se fueron las
         que habíamos inventado para el piso —«Desabolladura», «Pintura»—, y
         con ellas quedaron CUATRO de las nueve etapas sin ninguna cuenta que
         las tenga habilitadas.

         🔶 26-08-2026: BAJÓ DE 4 A 1, que es de lo que se trataba. Marco mandó
         las ocho capturas del sistema actual con el desplegable de encargados
         de cada etapa, y con eso entraron los once del taller. Desabolladura,
         Preparación, Pintura y Terminación pasaron a tener gente.

         La que queda es ENTREGA, y queda a propósito: en el sistema actual esa
         fila no tiene casilla ni desplegable, así que no se le asigna a nadie.
         Si algún día baja a 0 hay que preguntarse quién la llenó y por qué. */
      ['Etapas del taller que ninguna cuenta puede hacer',
        db.etapa.filter((e) =>
          !db.persona_etapa.some((h) => h.etapa_id === e.id)).length, 1],

      /* 🔴 ACÁ SE VIGILABA QUE LA TASA DE DEVOLUCIONES NO SALIERA PLANA
         (27-08-2026). Era la cuarta aparición de la misma trampa: un dato
         sembrado con un porcentaje parejo da una distribución uniforme, y una
         distribución uniforme se ve INVENTADA.

         Ya no hay devoluciones que repartir: devolver es la otra mitad del
         visto bueno, y el visto bueno no existe en este taller. La cifra daría
         «plana» siempre, y para que diera verde habría que sembrar
         devoluciones de un proceso que nadie hace — al revés de para lo que
         existía. Vuelve cuando vuelva C-43.

         Lo que sí queda vigilado es que no aparezcan por su cuenta. */
      ['Etapas con devoluciones registradas',
        db.ot_etapa.filter((x) => (x.devoluciones || 0) > 0).length, 0],

      ['Repuestos nacidos de una línea que no es «cambio»',
        (function () {
          const proc = {};
          db.presupuesto_linea.forEach((l) => { proc[l.id] = l.proceso; });
          return db.repuesto.filter((r) => r.presupuesto_linea_id &&
            proc[r.presupuesto_linea_id] !== 'cambio').length;
        })(), 0],

      /* ── Las cuatro cifras de la Reportería (19-08-2026) ──────────────
         El panel se rehizo entero y su valor está en dos gráficos que el
         sistema del cliente no puede tener. Un gráfico equivocado es peor que
         ninguno: se ve convincente. Estas cuatro son los guardianes. */

      /* 🔴 UNA ETAPA NO PUEDE DURAR MÁS QUE EL TRABAJO ENTERO. Es la primera
         forma en que un desglose por etapas se vuelve mentira: basta que una
         fecha de asignación quede antes del ingreso para que la suma de las
         partes supere el total y el gráfico muestre 80 días de etapas dentro
         de una orden de 60. */
      ['Órdenes donde las etapas duran más que la orden completa',
        (function () {
          const MS = 86400000;
          return Modelo.historico({ todo: true }).filter((o) => {
            const suma = (o.etapasAsignadas || [])
              .filter((e) => e.finalizada && e.asignadaAt && e.finalizadaAt)
              .reduce((s, e) => s + Math.max(0, (e.finalizadaAt - e.asignadaAt) / MS), 0);
            // Un día de holgura por el redondeo de las horas.
            return suma > o.diasTotales + 1;
          }).length;
        })(), 0],

      /* Una etapa que cierra antes de asignarse da días negativos, y un día
         negativo en un promedio lo arrastra sin que se note. */
      ['Etapas que se cerraron antes de asignarse',
        (function () {
          return db.ot_etapa.filter((x) => x.salio_at && x.asignada_at &&
            x.salio_at < x.asignada_at).length;
        })(), 0],

      /* 🔶 EL GRÁFICO PLANO. Hasta el 19-08-2026 la semilla cerraba cada etapa
         exactamente dos días después de la anterior, así que «dónde se van los
         días» salía con siete barras idénticas. Un gráfico donde todas las
         partes miden lo mismo no responde nada, y encima se ve inventado —
         porque lo era. Si alguien vuelve a repartir parejo, se cae acá. */
      ['El desglose por etapas quedó plano (todas duran lo mismo)',
        (function () {
          const MS = 86400000, m = new Map();
          Modelo.historico({ todo: true }).forEach((o) => {
            (o.etapasAsignadas || []).forEach((e) => {
              if (!e.finalizada || !e.asignadaAt || !e.finalizadaAt) return;
              const c = m.get(e.nombre) || { n: 0, d: 0 };
              c.n++; c.d += Math.max(0, (e.finalizadaAt - e.asignadaAt) / MS);
              m.set(e.nombre, c);
            });
          });
          const proms = [...m.values()].filter((c) => c.n).map((c) => c.d / c.n);
          if (proms.length < 2) return 0;          // sin etapas no hay nada que aplanar
          return (Math.max(...proms) - Math.min(...proms)) < 2 ? 1 : 0;
        })(), 0],

      /* 🔴 LAS PARTES DEL ANILLO TIENEN QUE SUMAR EL TOTAL. Un anillo cuyas
         porciones no suman lo que dice el centro es el gráfico más mentiroso
         que hay: el ojo confía en la forma y nadie verifica la aritmética.
         Se compara la composición —mano de obra, repuestos, T.O.T.— contra la
         venta del período, que es el número grande del panel. */
      ['Pesos de diferencia entre las partes del anillo y la venta del período',
        (function () {
          if (typeof repAgregados !== 'function') return 0;   // panel no cargado
          const lista = Modelo.historico({ todo: true });
          const g = repAgregados(lista, Modelo.metricas().metaDias);
          const partes = g.composicion.reduce((s, p) => s + p.v, 0);
          return Math.round(Math.abs(partes - g.venta));
        })(), 0]
    ];
    return esperado.map(([nombre, real, ref]) => ({
      nombre, real, referencia: ref, paso: real === ref
    }));
  }

  return { correr, comprobarCifras };
})();
