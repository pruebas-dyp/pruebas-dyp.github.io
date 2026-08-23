/* EL ARNÉS DE FLUJO.

   `pruebas.js` comprueba las REGLAS una por una; esto comprueba que la información VIAJE
   entre módulos: que lo cargado en una pantalla le llegue a la que tiene que enterarse.

   Detalle y decisiones: 00 Documentacion/DECISIONES.md · js/flujo.js */

const Flujo = (function () {
  'use strict';

  function correr() {
    return Modelo.sandbox(function () {
      const db = Modelo.base();
      const res = [];
      const push = (o) => res.push(o);

      /* Cada comprobación va envuelta. Una que se cae —porque el paso anterior
         no dejó lo que esperaba— tiene que quedar en rojo y dejar correr a las
         demás: un arnés que se detiene en la primera falla esconde todo lo que
         venía después, que es justamente lo que se quería revisar. */
      const paso = (fn) => {
        try { fn(); }
        catch (e) {
          push({ grupo: 'Se cayó la comprobación', nombre: 'Error al comprobar',
                 viaje: '—', paso: false,
                 detalle: 'La comprobación se interrumpió: ' + ((e && e.message) || String(e)) });
        }
      };

      /* Se parte de una sesión conocida —el dueño, que puede todo— y se va
         cambiando de cuenta a propósito cuando lo que se prueba es
         justamente quién puede hacer qué. */
      const personaPrevia = (Modelo.personaActual() || {}).id || null;
      const rolPrevio = (Modelo.rolActual() || {}).id || null;
      const comoDueno = () => { Modelo.fijar_persona_actual(null); Modelo.fijar_rol_actual('ro-6'); };
      const comoRol = (codigo) => {
        const r = Modelo.roles().find((x) => x.codigo === codigo);
        Modelo.fijar_persona_actual(null);
        if (r) Modelo.fijar_rol_actual(r.id);
        return !!r;
      };
      const comoPersona = (id) => Modelo.fijar_persona_actual(id);
      comoDueno();

      const ok = (r) => !!(r && r.ok);
      const motivo = (r) => (r && r.motivo) || '';

      /* ══ A · DE LA RECEPCIÓN A LA TORRE DE CONTROL ══════════════════ */

      let otA = null;
      paso(function () {
        const antes = Modelo.torre().length;
        const r = Modelo.crear_ot_desde_recepcion({
          patente: 'FLUJ01', nombre: 'Cliente de Prueba', rut: '11.111.111-1',
          telefono: '+56 9 1111 1111', direccion: 'Domicilio de ejemplo 211',
          vin: 'FLUJO000000000001', km: 100000, demo: true,
          danos: [{ vista: 'lateral_izq', x: 0.19, y: 0.44, severidad: 2,
                    descripcion: 'Rayón de prueba de flujo',
                    trazo: [{ x: 0.19, y: 0.44 }, { x: 0.22, y: 0.46 }] }]
        }, [{ tipo_ingreso_id: 'ti-2' }], 'flujo-recepcion-1');

        otA = ok(r) && r.ordenes && r.ordenes[0] ? r.ordenes[0] : null;
        const fila = otA ? Modelo.torre().find((f) => f.id === otA.ot_id) : null;
        push({
          grupo: 'Recepción → Torre de control',
          nombre: 'El vehículo recibido aparece en la torre',
          viaje: 'Se guarda una recepción · se mira la torre',
          paso: !!fila && Modelo.torre().length === antes + 1 && fila.patente === 'FLUJ01',
          detalle: fila
            ? 'OT ' + fila.numeroOT + ' · patente ' + fila.patente + ' · ' + fila.cliente +
              ' · la torre pasó de ' + antes + ' a ' + Modelo.torre().length
            : 'La orden no llegó a la torre. ' + motivo(r)
        });
      });

      paso(function () {
        const v = otA ? Modelo.otPorId(otA.ot_id) : null;
        const d = v && v.danos ? v.danos : [];
        push({
          grupo: 'Recepción → Torre de control',
          nombre: 'El daño marcado en la silueta llega a la ficha',
          viaje: 'Se raya el auto en la recepción · se abre la ficha',
          paso: d.length === 1 && d[0].vista === 'lateral_izq' && !!d[0].trazo,
          detalle: d.length
            ? d.length + ' daño en ' + d[0].vista + ' · coordenada x ' + d[0].x + ' · y ' + d[0].y +
              ' · con su trazo guardado. (La ZONA la deduce la pantalla desde dónde cayó el ' +
              'trazo, así que una marca cargada por fuera del dibujo no la trae.)'
            : 'La ficha no muestra ningún daño: lo marcado en la silueta se perdió.'
        });
      });

      paso(function () {
        const v = otA ? Modelo.otPorId(otA.ot_id) : null;
        push({
          grupo: 'Recepción → Torre de control',
          nombre: 'El VIN y el kilometraje viajan con el vehículo',
          viaje: 'Paso 2 de la recepción · ficha de la orden',
          paso: !!v && v.vin === 'FLUJO000000000001',
          detalle: v ? 'VIN ' + (v.vin || '—') + ' · ' + (v.kilometraje || '—') + ' km'
                     : 'No se pudo abrir la ficha.'
        });
      });

      /* ══ B · DEL PRESUPUESTO A LA BODEGA ════════════════════════════ */

      let presuB = null;
      paso(function () {
        const r = Modelo.crear_presupuesto(otA.ot_id, { lineas: [] });
        presuB = ok(r) ? r.presupuesto_id : null;
        push({
          grupo: 'Presupuesto → Bodega',
          nombre: 'El recepcionista abre la OR sobre la orden',
          viaje: 'Recepción → Agregar OR · panel de Presupuesto',
          paso: ok(r),
          detalle: ok(r) ? 'OR ' + r.numero_or + ' abierta, en cero' : motivo(r)
        });
      });

      paso(function () {
        // Mano de obra: el trabajo de desabollar. NO pide pieza a bodega.
        const r1 = Modelo.agregar_linea_presupuesto(presuB, {
          proceso: 'reparar', descripcion: 'Desabolladura tapabarro', cantidad: 1, horas_rep: 3 });
        const n = db.presupuesto_linea.filter((l) => l.presupuesto_id === presuB).length;
        push({
          grupo: 'Presupuesto → Bodega',
          nombre: 'La mano de obra queda en el presupuesto y no pide pieza',
          viaje: 'Bloque Mano de Obra · bodega',
          paso: ok(r1) && n === 1 && Modelo.otPorId(otA.ot_id).repuestos.length === 0,
          detalle: ok(r1)
            ? 'Una línea de Reparar, sin repuestos pedidos — que es lo correcto'
            : motivo(r1)
        });
      });

      /* 🔴 EL VIAJE QUE IMPORTA. La pieza baja a bodega apenas se escribe en el
         bloque Repuestos del presupuesto: NO hay que esperar la aprobación, y
         sobre todo nadie la vuelve a escribir. Es el dolor #1 que el cliente
         describió de su sistema actual —la redigitación— resuelto acá. */
      paso(function () {
        const antes = Modelo.otPorId(otA.ot_id).repuestos.length;
        const r = Modelo.agregar_fila_presupuesto(presuB, 'repuesto', {
          descripcion: 'Paragolpes delantero', cantidad: 1, precio_unitario: 120000,
          proveedor: 'Proveedor de prueba' });
        const despues = Modelo.otPorId(otA.ot_id).repuestos.length;
        push({
          grupo: 'Presupuesto → Bodega',
          nombre: '🔴 La pieza escrita en el presupuesto le llega sola al bodeguero',
          viaje: 'Bloque Repuestos de la OR · panel de Bodega',
          paso: ok(r) && despues === antes + 1,
          detalle: despues > antes
            ? '«Paragolpes delantero» apareció en bodega sin que nadie lo volviera a escribir'
            : 'La pieza NO llegó a bodega: habría que redigitarla a mano. ' + motivo(r)
        });
      });

      paso(function () {
        const antes = Modelo.otPorId(otA.ot_id).repuestos.length;
        Modelo.cambiar_estado_presupuesto(presuB, 'enviado');
        const r = Modelo.cambiar_estado_presupuesto(presuB, 'aprobado');
        const despues = Modelo.otPorId(otA.ot_id).repuestos.length;
        push({
          grupo: 'Presupuesto → Bodega',
          nombre: 'Aprobar no vuelve a pedir lo que ya estaba pedido',
          viaje: 'Se aprueba la OR · bodega no duplica',
          paso: ok(r) && despues === antes,
          detalle: ok(r)
            ? 'Aprobado, y bodega sigue con ' + despues + ' pieza: no se duplicó'
            : motivo(r)
        });
      });

      paso(function () {
        const rep = Modelo.otPorId(otA.ot_id).repuestos[0];
        push({
          grupo: 'Presupuesto → Bodega',
          nombre: 'El repuesto queda amarrado a la línea que lo originó',
          viaje: 'Línea del presupuesto · ficha del repuesto',
          paso: !!rep && !!rep.presupuestoLineaId,
          detalle: rep
            ? '«' + rep.descripcion + '» ← línea ' + (rep.presupuestoLineaId || 'SUELTA')
            : 'No hay repuesto que revisar.'
        });
      });

      paso(function () {
        const fila = Modelo.torre().find((f) => f.id === otA.ot_id);
        const pend = fila ? fila.repuestos.filter((r) => !r.fechaBodega).length : 0;
        push({
          grupo: 'Presupuesto → Bodega',
          nombre: 'La torre muestra que ese vehículo espera repuesto',
          viaje: 'Bodega · columna de la torre de control',
          paso: pend === 1,
          detalle: pend + ' repuesto pendiente en la fila de la OT ' + (fila ? fila.numeroOT : '—')
        });
      });

      paso(function () {
        const avisos = Modelo.avisosDe(otA.ot_id) || [];
        const alEnviar = avisos.filter((a) => /enviado|aprobado/i.test(a.asunto || ''));
        /* Lo que se vigila es lo que SALE del taller. Un aviso interno en cero
           es legítimo —le dice al taller que hay una OR esperando que alguien
           la valorice—; a la compañía de seguros no se le anuncia un
           presupuesto vacío, que es lo que pasaba antes. */
        const vacio = avisos.filter((a) => a.canal === 'compania' && /0 líneas/.test(a.detalle || ''));
        push({
          grupo: 'Presupuesto → Bodega',
          nombre: 'El aviso a la compañía sale con el monto de verdad',
          viaje: 'Se envía la OR · cola de avisos',
          paso: alEnviar.length > 0 && vacio.length === 0,
          detalle: alEnviar.length
            ? alEnviar[alEnviar.length - 1].asunto + ' — ' + alEnviar[alEnviar.length - 1].detalle
            : 'No se generó aviso al enviar el presupuesto.'
        });
      });

      /* ══ C · LA BODEGA Y SUS CUATRO MARCAS ══════════════════════════ */

      paso(function () {
        if (!comoRol('bodega')) { comoDueno(); }
        const rep = Modelo.otPorId(otA.ot_id).repuestos[0];
        const r = Modelo.recibir_repuesto(rep.id);
        const v = Modelo.otPorId(otA.ot_id).repuestos[0];
        const fila = Modelo.torre().find((f) => f.id === otA.ot_id);
        const pend = fila ? fila.repuestos.filter((x) => !x.fechaBodega).length : -1;
        push({
          grupo: 'Bodega → Torre y ficha',
          nombre: 'Marcar el repuesto como llegado baja el pendiente',
          viaje: 'Bodega marca la llegada · torre y ficha',
          paso: ok(r) && !!v.fechaBodega && pend === 0,
          detalle: ok(r) ? 'Llegó con fecha · pendientes en la torre: ' + pend : motivo(r)
        });
      });

      paso(function () {
        const rep = Modelo.otPorId(otA.ot_id).repuestos[0];
        const sinVale = Modelo.entregar_repuesto_area(rep.id);
        push({
          grupo: 'Bodega → Torre y ficha',
          nombre: 'No se entrega al área sin el vale de retiro',
          viaje: 'Bodega intenta entregar sin subir el vale',
          paso: !ok(sinVale),
          detalle: !ok(sinVale) ? motivo(sinVale) : 'Se entregó sin vale: el respaldo no se está exigiendo.'
        });
      });

      paso(function () {
        const rep = Modelo.otPorId(otA.ot_id).repuestos[0];
        const r = Modelo.devolver_repuesto(rep.id, 'Llegó dañado — prueba de flujo');
        const v = Modelo.otPorId(otA.ot_id).repuestos[0];
        push({
          grupo: 'Bodega → Torre y ficha',
          nombre: 'La devolución deja el repuesto pendiente otra vez',
          viaje: 'Bodega devuelve · el ciclo vuelve a empezar',
          paso: ok(r) && !v.fechaBodega,
          detalle: ok(r) ? 'Volvió a «' + (v.estado || 'por pedir') + '»' : motivo(r)
        });
      });

      /* ══ D · LAS ETAPAS: QUIÉN ASIGNA, QUIÉN CIERRA, A QUIÉN LE LLEGA ══ */

      const etapaD = Modelo.etapas()[0];              // Desarme
      let personaD = null;
      paso(function () {
        const gente = Modelo.personasParaEtapa(etapaD.id) || [];
        personaD = gente[0] || null;
        push({
          grupo: 'Etapas · quién y a quién',
          nombre: 'Sólo se ofrece a quien tiene esa etapa habilitada',
          viaje: 'Ficha del personal · desplegable de asignar',
          paso: gente.length > 0,
          detalle: gente.length
            ? gente.length + ' habilitados para ' + etapaD.nombre + ' · primero: ' + (personaD.nombres || personaD.nombre || '—')
            : '⚠️ NADIE puede hacer ' + etapaD.nombre + ': esa etapa no se puede asignar a ninguna cuenta.'
        });
      });

      paso(function () {
        comoRol('operario');
        const r = Modelo.asignar_etapas(otA.ot_id, [etapaD.id]);
        push({
          grupo: 'Etapas · quién y a quién',
          nombre: 'Un operario no reparte trabajo',
          viaje: 'Operario intenta asignar una etapa',
          paso: !ok(r),
          detalle: !ok(r) ? motivo(r) : 'El operario pudo asignarse trabajo solo.'
        });
        comoDueno();
      });

      paso(function () {
        const resp = {}; if (personaD) resp[etapaD.id] = personaD.id;
        const r = Modelo.asignar_etapas(otA.ot_id, [etapaD.id], resp);
        const v = Modelo.otPorId(otA.ot_id);
        const asignada = (v.etapasAsignadas || []).find((e) => e.codigo === etapaD.codigo);
        push({
          grupo: 'Etapas · quién y a quién',
          nombre: 'El jefe asigna la etapa y queda con responsable',
          viaje: 'Asignar etapas · ficha de la orden',
          paso: ok(r) && !!asignada,
          detalle: ok(r) && asignada
            ? etapaD.nombre + ' asignada a ' + (asignada.responsable || 'sin responsable')
            : (motivo(r) || 'La etapa no quedó en la ficha de la orden.')
        });
      });

      paso(function () {
        if (!personaD) { push({ grupo: 'Etapas · quién y a quién',
          nombre: 'La etapa le llega a Mi trabajo del responsable',
          viaje: 'Asignar · pantalla del operario', paso: false,
          detalle: 'No había nadie habilitado para asignarle la etapa.' }); return; }
        /* `miTrabajo` separa lo que tiene a su nombre de lo que está a cargo
           suyo: para esto valen las dos, la pregunta es si le llegó. */
        const mt = Modelo.miTrabajo(personaD.id) || {};
        const mio = [].concat(mt.mias || [], mt.aCargo || []);
        const esta = mio.some((x) => x.ot_id === otA.ot_id || x.id === otA.ot_id);
        push({
          grupo: 'Etapas · quién y a quién',
          nombre: '🔴 La etapa le llega a «Mi trabajo» de esa persona',
          viaje: 'El jefe asigna · el operario abre su pantalla',
          paso: esta,
          detalle: esta ? 'La OT aparece entre las ' + mio.length + ' de ' + (personaD.nombres || personaD.nombre)
                        : 'La orden NO le aparece a quien tiene que hacerla.'
        });
      });

      paso(function () {
        const otros = (Modelo.personal() || []).filter((p) =>
          p.id !== (personaD && personaD.id) && p.activo !== false);
        const otro = otros[0];
        if (!otro) return;
        const mtO = Modelo.miTrabajo(otro.id) || {};
        const suyo = [].concat(mtO.mias || [], mtO.aCargo || []);
        const loVe = suyo.some((x) => x.ot_id === otA.ot_id || x.id === otA.ot_id);
        push({
          grupo: 'Etapas · quién y a quién',
          nombre: 'A quien no le tocaba, no le aparece',
          viaje: 'Mi trabajo de otra persona',
          paso: !loVe,
          detalle: !loVe ? 'La orden no está en la lista de ' + (otro.nombres || otro.nombre)
                         : 'Le aparece trabajo que no es suyo.'
        });
      });

      paso(function () {
        const v = Modelo.otPorId(otA.ot_id);
        const fila = Modelo.torre().find((f) => f.id === otA.ot_id);
        push({
          grupo: 'Etapas · quién y a quién',
          nombre: 'La etapa en curso se ve en la torre',
          viaje: 'Ficha de la orden · columna Etapa de la torre',
          paso: !!fila && !!fila.etapaNombre,
          detalle: fila ? 'Etapa en la torre: ' + (fila.etapaNombre || '—') +
                          ' · encargado: ' + (fila.responsableNombre || 'Sin asignar')
                        : 'La orden no está en la torre.'
        });
      });

      paso(function () {
        const r = Modelo.finalizar_etapa(otA.ot_id, etapaD.codigo, personaD ? personaD.id : null);
        const v = Modelo.otPorId(otA.ot_id);
        const cerrada = (v.etapasAsignadas || []).find((e) =>
          e.codigo === etapaD.codigo && (e.finalizada || e.terminadaAt));
        push({
          grupo: 'Etapas · quién y a quién',
          nombre: 'Cerrar la etapa queda con fecha y con autor',
          viaje: 'El operario termina · historial de la orden',
          paso: ok(r) && !!cerrada,
          detalle: ok(r) && cerrada
            ? etapaD.nombre + ' cerrada · la terminó ' + (cerrada.terminadaPor || '—') +
              (cerrada.validadaPor ? ' · visto bueno de ' + cerrada.validadaPor : '')
            : (motivo(r) || 'La etapa no quedó marcada como terminada en la ficha.')
        });
      });

      /* Quién puede dar por terminada una etapa que tiene otro a su nombre. Es
         la pregunta que se hizo textual: «quién puede dar el término de esa
         etapa y quién no». */
      /* Se entra con una PERSONA de verdad, no sólo con un rol: en el sistema
         siempre hay alguien identificado detrás, y la regla de «esta etapa la
         tiene otro» necesita saber quién la está apretando. */
      /* El escenario se ARMA acá en vez de buscarlo entre los datos de
         demostración: buscándolo, bastaba con que la semilla no tuviera una
         etapa abierta con responsable para que la comprobación se saltara sola
         y el arnés informara todo en verde sin haber probado nada. */
      /* 🔴 ESTA NO ES UNA PRUEBA DEL SISTEMA: ES UNA PREGUNTA AL TALLER.
         Si una etapa no la puede hacer ninguna cuenta, el trabajo existe pero
         no hay a quién asignárselo, y esa orden se queda quieta esperando a
         alguien que no está. Sale en rojo a propósito mientras siga siendo
         cierto: es de las cosas que hay que resolver con el cliente, no con
         código. */
      paso(function () {
        const huerfanas = Modelo.etapas().filter((e) =>
          (Modelo.personasParaEtapa(e.id) || []).length === 0);
        push({
          grupo: 'Etapas · quién y a quién',
          nombre: 'Todas las etapas tienen a alguien que pueda hacerlas',
          viaje: 'Catálogo de etapas · fichas del personal',
          paso: huerfanas.length === 0,
          detalle: huerfanas.length === 0
            ? 'Las ' + Modelo.etapas().length + ' etapas tienen gente habilitada'
            : huerfanas.length + ' etapas SIN NADIE que las pueda hacer: ' +
              huerfanas.map((e) => e.nombre).join(', ') +
              ' — quien pinta y quien desabolla no tiene cuenta en el sistema.'
        });
      });

      paso(function () {
        // Se elige una etapa que SÍ tenga gente: lo que se prueba acá es la
        // regla de «esto lo tiene otro», no si hay dotación cargada.
        const otraEtapa = Modelo.etapas().find((e) => e.codigo !== etapaD.codigo &&
          (Modelo.personasParaEtapa(e.id) || []).length > 0);
        if (!otraEtapa) return;
        const gente = Modelo.personasParaEtapa(otraEtapa.id) || [];
        const dueno = gente[0];
        if (!dueno) return;
        const resp = {}; resp[otraEtapa.id] = dueno.id;
        Modelo.asignar_etapas(otA.ot_id, [otraEtapa.id], resp);

        /* La regla «esa etapa la tiene otro» sólo protege a los roles cuyo
           alcance es `asignado` —los operarios, que ven nada más lo suyo—. Al
           jefe de taller y a administración NO les aplica, y está bien: alguien
           tiene que poder destrabar una orden cuando el que la tenía no está.

           Así que el ajeno con el que se prueba tiene que ser un operario. Si
           se elige a cualquiera, se termina midiendo otra cosa. */
        const esOperario = (p) => {
          const rol = (Modelo.roles() || []).find((x) => x.id === p.rol_id);
          return rol && rol.alcance === 'asignado';
        };
        const ajeno = gente.find((p) => p.id !== dueno.id && esOperario(p)) ||
                      (Modelo.personal() || []).find((p) => p.id !== dueno.id &&
                        p.activo !== false && esOperario(p));
        if (!ajeno) {
          push({
            grupo: 'Etapas · quién y a quién',
            nombre: '🔴 Nadie cierra la etapa que tiene otro a su nombre',
            viaje: 'Otra persona intenta terminar trabajo ajeno',
            paso: false,
            detalle: 'No se pudo probar: ninguna cuenta activa tiene alcance de operario. ' +
              'Es la misma causa de la comprobación anterior — quien hace el trabajo en el ' +
              'taller no tiene cuenta, así que la regla que lo protege no se puede ejercer.'
          });
          return;
        }
        const mismaEtapa = gente.some((p) => p.id === ajeno.id);

        comoPersona(ajeno.id);
        const r = Modelo.finalizar_etapa(otA.ot_id, otraEtapa.codigo, null);
        comoDueno();
        push({
          grupo: 'Etapas · quién y a quién',
          nombre: '🔴 Nadie cierra la etapa que tiene otro a su nombre',
          viaje: 'Otra persona intenta terminar trabajo ajeno',
          paso: !ok(r),
          detalle: !ok(r)
            ? motivo(r) + (mismaEtapa ? '' :
                ' (rechazado por el rol: no había otra persona habilitada para ' +
                otraEtapa.nombre + ' con quien probar el caso exacto)')
            : (ajeno.nombres || ajeno.nombre) + ' cerró la ' + otraEtapa.nombre +
              ' que tenía ' + (dueno.nombres || dueno.nombre) + '.'
        });
      });

      /* ══ E · SALIDA, REINGRESO Y LOS TRES RELOJES ═══════════════════ */

      paso(function () {
        const antes = Modelo.otPorId(otA.ot_id);
        const r = Modelo.registrar_salida(otA.ot_id, 'espera_repuesto');
        const v = Modelo.otPorId(otA.ot_id);
        push({
          grupo: 'Salida y reingreso',
          nombre: 'Sacar el vehículo lo marca fuera de taller',
          viaje: 'Ficha · torre de control',
          paso: ok(r) && v.fueraDeTaller === true,
          detalle: ok(r) ? 'Fuera de taller · reparación acumulada: ' + v.diasReparacion + ' días' : motivo(r)
        });
      });

      paso(function () {
        const r = Modelo.registrar_reingreso(otA.ot_id);
        const v = Modelo.otPorId(otA.ot_id);
        push({
          grupo: 'Salida y reingreso',
          nombre: '🔴 Al reingresar, la estadía vuelve a cero y los totales siguen',
          viaje: 'Reingreso · los tres relojes de la ficha',
          paso: ok(r) && v.diasEstadiaActual === 0 && v.diasTotales >= 0,
          detalle: ok(r)
            ? 'totales ' + v.diasTotales + ' · reparación ' + v.diasReparacion +
              ' · estadía actual ' + v.diasEstadiaActual
            : motivo(r)
        });
      });

      /* ══ F · LA BITÁCORA ENCIENDE LA ALERTA ════════════════════════ */

      paso(function () {
        const fila0 = Modelo.torre().find((f) => f.id === otA.ot_id);
        const antes = (fila0.alertas || []).map((a) => a.letra).join('');
        const r = Modelo.escribir_bitacora(otA.ot_id, {
          asunto_id: 'as-4', mensaje: 'Repuesto pedido — prueba de flujo' });
        const fila1 = Modelo.torre().find((f) => f.id === otA.ot_id);
        const despues = (fila1.alertas || []).map((a) => a.letra).join('');
        push({
          grupo: 'Bitácora → Alerta',
          nombre: 'Escribir en la bitácora enciende su letra en la torre',
          viaje: 'Bitácora de la orden · columna Alerta',
          paso: ok(r) && despues.length > antes.length,
          detalle: ok(r) ? 'Alertas: «' + (antes || '—') + '» → «' + despues + '»' : motivo(r)
        });
      });

      /* ══ G · DE LA ENTREGA AL HISTÓRICO ════════════════════════════ */

      paso(function () {
        const r = Modelo.registrar_entrega(otA.ot_id, { estado: 'entrega_cliente', fecha: null });
        push({
          grupo: 'Entrega → Histórico',
          nombre: 'No se entrega sin pasar por Control de calidad',
          viaje: 'Entrega · regla del taller',
          paso: !ok(r),
          detalle: !ok(r) ? motivo(r) : 'Se entregó sin control de calidad.'
        });
      });

      paso(function () {
        // Se cierran todas las etapas que falten y recién ahí se entrega.
        const v = Modelo.otPorId(otA.ot_id);
        Modelo.etapas().forEach((e) => {
          Modelo.asignar_etapas(otA.ot_id, [e.id]);
          Modelo.finalizar_etapa(otA.ot_id, e.codigo, null);
        });
        const enTorreAntes = Modelo.torre().length;
        const histAntes = (Modelo.historico({ patente: 'FLUJ01' }) || []).length;
        /* Con `toISOString()` esto devolvia MAÑANA despues de las 20:00 hora
           de Chile, y la comprobacion pasaba o fallaba segun a que hora se
           corriera. La trampa estaba escrita en `semilla.js` desde antes y se
           repitio igual acá: por eso el helper subio a `Reglas`. */
        const hoyISO = Reglas.hoyEnChile();
        const r = Modelo.registrar_entrega(otA.ot_id, { estado: 'entrega_cliente', fecha: hoyISO });
        const sigueEnTorre = Modelo.torre().some((f) => f.id === otA.ot_id);
        const histDespues = (Modelo.historico({ patente: 'FLUJ01' }) || []).length;
        push({
          grupo: 'Entrega → Histórico',
          nombre: '🔴 Entregar saca de la torre y deja en el histórico',
          viaje: 'Entrega · torre de control · histórico',
          paso: ok(r) && !sigueEnTorre && histDespues > histAntes,
          detalle: ok(r)
            ? 'Torre ' + enTorreAntes + ' → ' + Modelo.torre().length +
              ' · histórico de esa patente: ' + histAntes + ' → ' + histDespues
            : motivo(r)
        });
      });

      paso(function () {
        const r = Modelo.cambiar_estado_ot(otA.ot_id, 'recibido');
        push({
          grupo: 'Entrega → Histórico',
          nombre: 'Una orden entregada no se reabre',
          viaje: 'Intento de volver a ponerla en la torre',
          paso: !ok(r),
          detalle: !ok(r) ? motivo(r) : 'Se pudo reabrir una orden cerrada.'
        });
      });

      /* ══ H · PERMISOS Y ALCANCE POR CUENTA ═════════════════════════ */

      paso(function () {
        comoRol('recepcion');
        const viva = Modelo.torre()[0];
        const r = Modelo.declarar_perdida_total(viva.id, 'prueba de flujo');
        push({
          grupo: 'Permisos por cuenta',
          nombre: 'Recepción no declara la pérdida total',
          viaje: 'Recepción intenta cerrar por pérdida total',
          paso: !ok(r),
          detalle: !ok(r) ? motivo(r) : 'Recepción pudo declararla.'
        });
        comoDueno();
      });

      paso(function () {
        const hay = comoRol('evaluador');
        if (!hay) { comoDueno(); return; }
        const viva = Modelo.torre()[0];
        const r = Modelo.declarar_perdida_total(viva.id, 'prueba de flujo');
        const sigue = Modelo.torre().some((f) => f.id === viva.id);
        push({
          grupo: 'Permisos por cuenta',
          nombre: 'El evaluador sí, y eso saca el vehículo de la torre',
          viaje: 'Evaluador declara · torre de control',
          paso: ok(r) && !sigue,
          detalle: ok(r) ? 'La OT ' + viva.numeroOT + ' salió de la torre' : motivo(r)
        });
        comoDueno();
      });

      paso(function () {
        comoRol('operario');
        const suyas = Modelo.torre().length;
        comoDueno();
        const todas = Modelo.torre().length;
        push({
          grupo: 'Permisos por cuenta',
          nombre: 'El operario ve sus vehículos, no el taller entero',
          viaje: 'Torre de control con una cuenta y con otra',
          paso: suyas < todas,
          detalle: 'Operario ve ' + suyas + ' de ' + todas + ' órdenes'
        });
      });

      // Se devuelve la sesión a como estaba antes de la prueba.
      Modelo.fijar_persona_actual(personaPrevia);
      if (rolPrevio) Modelo.fijar_rol_actual(rolPrevio);

      return res;
    });
  }

  return { correr };
})();
