/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   LOS DATOS DE DEMOSTRACIÓN.

   🔶 TODO LO QUE HAY ACÁ ES INVENTADO. Ninguna persona, patente, RUT,
   teléfono ni domicilio corresponde a nadie real. Los nombres se arman por
   combinación desde listas neutras y los RUT son de la serie 11.111.111-1.

   Lo que NO es inventado son los CATÁLOGOS y los TOTALES: salen del
   levantamiento del sistema actual, medidos pantalla por pantalla el
   12-08-2026, y están citados uno por uno con la sección del documento de
   reglas de donde vienen. Si un número de acá cambia, es que se rompió algo.

   La generación es DETERMINISTA (ver `rnd`): la misma semilla produce
   siempre los mismos datos. Sin eso, las cifras de control cambiarían en
   cada recarga y no se podría comprobar nada.
   ──────────────────────────────────────────────────────────────────────── */

/* Fecha de referencia del modelo borrador. Es la del levantamiento, para que
   los días calculados cuadren con lo que se midió en el sistema real.

   Va como `let` y no como `const` a propósito: los tres relojes solo se
   pueden demostrar de verdad si se puede adelantar el calendario. «Datos de
   demostración» → Adelantar la fecha del sistema mueve esto, y todo lo demás se recalcula
   solo, porque ningún contador guarda días: todos se derivan de las fechas.
   Es el paso 14 del guion de prueba. */
let HOY = new Date(2026, 7, 12);
const HOY_ORIGINAL = new Date(2026, 7, 12);

const Semilla = (function () {

  /* ── Cifras de control, medidas sobre el sistema actual ────────────────
     Las comprueba «Datos de demostración» → Comprobar cifras de la demostración. */

  const TOTAL_TORRE            = 102;  // reglas §C.5  — órdenes vivas
  const CON_REPUESTO_PENDIENTE = 41;   // reglas §C.6  — tarjeta 41/102
  const FUERA_DE_TALLER        = 10;   // reglas §C.6  — y son distintas de las 41
  const SIN_ETAPA              = 53;   // reglas §C.7  — "Pendiente" / "Sin Asignar"
  const TRABAJADORES           = 89;   // medido en el sistema real; la demo siembra 5
  /* 19 desde el 17-08-2026: los seis puestos del taller, el evaluador, y las
     doce cuentas que entregó Andrés Guzmán —los usuarios de la web de hoy— más
     la de Arttmize para la puesta en marcha. */
  const EQUIPO_DEMO            = 19;
  const TOTAL_HISTORICO        = 120;  // ~3 entregas diarias (§C.21)
  const ULTIMA_OT              = 23488;// reglas §C.13 — al 12-08-2026

  /* ── Cuánto pesa cada etapa dentro de una reparación ───────────────────
     🔶 HASTA EL 19-08-2026 TODAS DURABAN DOS DÍAS EXACTOS. La fecha de cierre
     era `ingreso + orden × 2`, idéntica para las 120 órdenes del histórico.
     Alcanzaba para tener una fecha, pero al armar el gráfico de «dónde se van
     los días» salieron siete barras iguales — un gráfico que se ve inventado,
     porque lo era.

     Estos pesos reparten la ventana real de cada orden. No son una medición
     del taller: son la proporción con la que se reparte, y por eso van con
     nombre propio acá y no escondidos en una fórmula. El día que lleguen los
     tiempos reales de DyP, se reemplazan estos ocho números y nada más.

     ⚠️ Es dato de DEMOSTRACIÓN, rotulado como tal en el panel. */
  const PESO_ETAPA = {
    desarme: 1, desabolladura: 2.6, preparacion: 1.4, pintura: 2.2,
    armado: 1.5, mecanica: 1, terminacion: 0.9, calidad: 0.5
  };

  /* La versión de la FORMA de los datos. Entra al sello: cualquier cambio en
     cómo se siembra —no en cuántas filas hay— se anota subiendo este número, y
     los navegadores que tengan la base anterior vuelven a sembrar solos. Sin
     esto, el reparto nuevo de las etapas no habría llegado a nadie que ya
     tuviera el sistema abierto, que es exactamente el problema del 18-08. */
  const FORMA_DATOS = 2;
  // TEMPARIO_HORA ($10.000, reglas §C.15) se eliminó el 13-08-2026 junto con
  // el tempario entero. La cifra queda medida en `reglas`, no en el sistema.

  /* ── El catálogo de permisos ───────────────────────────────────────────
     Vive acá arriba, fuera del generador, para que el motor lo pueda comparar
     con lo que hay guardado en el navegador SIN volver a sembrar todo.

     Sirve para un problema que ya pasó dos veces y cuesta caro cuando pasa
     delante del cliente: el navegador guarda la base POR ORIGEN, así que
     `localhost:8101` conserva la suya mientras se prueba en otro puerto. Si
     después se agregan permisos, ese navegador arranca con el código nuevo y
     la base vieja, y módulos enteros desaparecen del menú —incluso los del
     administrador— porque piden un permiso que en esa base no existe.
     Con esta lista afuera, el motor lo detecta al arrancar y vuelve a sembrar
     en vez de dejar el sistema a medias. */
  const CATALOGO_PERMISOS = [
    ['torre.ver',            'Ver la torre de control'],
    ['historico.ver',        'Ver el histórico de órdenes ya cerradas'],
    ['taller.ver',           'Ver el tablero del taller'],
    ['repuesto.ver',         'Ver los repuestos pendientes'],
    ['espera.ver',           'Ver el análisis de esperas y lo detenido'],
    ['ficha.completa',       'Ver la ficha completa: cliente, compañía, siniestro, historial y bitácora'],
    ['documento.ver',        'Ver los documentos de una orden'],
    ['documento.cargar',     'Cargar y quitar documentos de una orden'],
    ['foto.ver',             'Ver las fotografías del vehículo'],
    ['foto.cargar',          'Cargar y quitar fotografías del vehículo'],
    ['ot.crear',             'Crear órdenes de trabajo'],
    ['ot.editar',            'Editar la recepción de una orden'],
    ['etapa.asignar',        'Asignar etapas a un vehículo'],
    ['etapa.finalizar',      'Finalizar etapas'],
    ['presupuesto.ver',      'Ver el presupuesto y sus líneas'],
    ['presupuesto.montos',   'Ver los montos de venta del presupuesto'],
    ['presupuesto.crear',    'Crear y editar presupuestos'],
    // Abrir la OR y VALORIZARLA son dos cosas distintas, y el cliente lo dijo
    // en las dos direcciones el 15-08-2026: "el recepcionista es quien crea la
    // OR, siempre" y "recepcionista y evaluador son procesos separados". El
    // recepcionista le pone el numero al trabajo; quien sabe cuanto cuesta
    // reparar un tapabarro le pone los montos.
    ['presupuesto.abrir',    'Abrir la OR de un trabajo, sin ponerle los montos'],
    ['perdida_total.declarar', 'Declarar un vehiculo como perdida total'],
    ['repuesto.devolver',    'Devolver un repuesto y dejarlo pendiente de nuevo'],
    ['repuesto.cargar',      'Cargar repuestos en bodega'],
    ['salida.registrar',     'Registrar salidas y reingresos'],
    ['detencion.gestionar',  'Abrir y cerrar detenciones de una orden'],
    ['entrega.registrar',    'Entregar el vehículo'],
    ['personal.ver',         'Ver la ficha de los trabajadores'],
    ['personal.editar',      'Crear, editar y dar de baja trabajadores'],
    ['datos.rut_completo',   'Ver el RUT, domicilio y teléfono sin enmascarar'],
    ['exportar',             'Exportar tablas a Excel'],
    ['configuracion',        'Administrar los catálogos del sistema'],
    ['consolidado.ver',      'Ver el consolidado y la rentabilidad']
  ];

  /* ── Los cuatro estados del inventario de recepción ────────────────────
     🔶 DEJÓ DE SER UN SÍ/NO el 15-08-2026, por pedido del cliente.

     El que nadie tocó queda `sin_verificar`, NO `no_presente`: no es lo mismo
     "revisé y no está" que "no alcancé a mirar", y con un booleano las dos
     cosas se guardaban igual —y la segunda se leía como la primera, que es la
     que genera el reclamo—. `danado` tampoco es `no_presente`: el auto trae el
     espejo, pero roto. Son tres conversaciones distintas con el cliente.

     Vive acá afuera del generador para que el motor y las vistas ofrezcan
     exactamente estos cuatro, y ninguna pantalla los escriba a mano. */
  const INVENTARIO_ESTADOS = [
    { codigo: 'presente',     nombre: 'Presente',      clase: 'verde', icono: 'check' },
    { codigo: 'no_presente',  nombre: 'No presente',   clase: 'roja',  icono: 'cruz' },
    { codigo: 'danado',       nombre: 'Dañado',        clase: 'ambar', icono: 'alerta' },
    { codigo: 'sin_verificar',nombre: 'Sin verificar', clase: 'gris',  icono: 'pregunta' }
  ];
  const INVENTARIO_POR_OMISION = 'sin_verificar';

  /* ── Generador determinista ────────────────────────────────────────────
     LCG clásico. No sirve para criptografía y no hace falta: sirve para que
     la demostración sea reproducible. */

  let _s = 20260812;
  const rnd = () => { _s = (_s * 1103515245 + 12345) & 0x7fffffff; return _s / 0x7fffffff; };
  const entre = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const elegir = (arr) => arr[Math.floor(rnd() * arr.length)];
  const dias = (n) => new Date(HOY.getTime() - n * 86400000);
  /* TODA fecha guardada lleva hora de taller. `dias()` devuelve medianoche, y
     desde el 16-08-2026 el sistema entero muestra `dd-mm-aaaa HH:MM` —pedido
     de Marco: «todo lo relacionado en fecha debe quedar así»—. Sin hora, el
     formato nuevo mostraría 00:00 en todas partes, que es peor que no
     mostrarla: da a entender que el taller pide, recibe y entrega a
     medianoche. Acá se reparte entre las 8:00 y las 17:59.

     `dias()` queda para las CUENTAS de días, donde la hora estorba. */
  const diasHora = (n) => {
    const d = dias(n);
    d.setHours(8 + entre(0, 9), entre(0, 59), 0, 0);
    return d;
  };

  /* La clave con la que entran TODAS las cuentas de la demostración. En un
     solo lugar: si mañana se cambia, se cambia acá y no cuenta por cuenta. */
  const CLAVE_DEMO = 'dyp2026';

  /* Los diez módulos del menú, en el mismo orden en que se ven. Está acá y no
     repetido cuenta por cuenta: si mañana entra un módulo nuevo, quien tiene
     acceso total lo tiene sin que nadie se acuerde de agregarlo a mano. */
  const MODULOS_TODOS = ['recepcion', 'torre', 'taller', 'presupuesto', 'bodega',
    'documentos', 'historico', 'personal', 'consolidado', 'configuracion'];

  const EQUIPO = [
    /* La cuenta «Recepcionista» de la lista de Andrés: es el puesto, no una
       persona, y así la tienen ellos. */
    { nombre: 'Recepción',      rol: 'ro-1', etapas: [],
      cargo: 'Recepción y entrega',
      modulos: ['torre', 'historico', 'recepcion', 'taller'] },
    { nombre: 'Jefe de taller', rol: 'ro-2', etapas: ['et-1', 'et-5', 'et-8', 'et-9'],
      cargo: 'Jefatura de taller', usuario: 'jefe' },
    { nombre: 'Desabolladura',  rol: 'ro-3', etapas: ['et-1', 'et-2', 'et-5'],
      cargo: 'Operario · Desabolladura' },
    { nombre: 'Pintura',        rol: 'ro-3', etapas: ['et-3', 'et-4', 'et-7'],
      cargo: 'Operario · Preparación y pintura' },
    { nombre: 'Bodega',         rol: 'ro-4', etapas: ['et-6', 'et-8'],
      cargo: 'Bodega y mecánica' },
    // El administrador también entra con usuario y clave: no hay una puerta
    // trasera sin credenciales, que es como se cuela el "entro yo nomás".
    { nombre: 'Gabriel', apellidos: 'Díaz', rol: 'ro-5', etapas: [],
      cargo: 'Gerente General', usuario: 'gabriel.diaz', modulos: MODULOS_TODOS },
    /* El evaluador va AL FINAL, y no es un detalle de estilo: los ids de las
       personas se generan por posición (`pe-t-N`), así que meterlo en medio
       corría a todos los de abajo — `pe-t-6` dejaba de ser el administrador y
       media docena de pruebas se caían con "el rol Evaluador no puede hacer
       esto". Lo nuevo se agrega al final. */
    { nombre: 'Evaluador',      rol: 'ro-8', etapas: [],
      cargo: 'Evaluación y presupuestos' },

    /* ═══════════════════════════════════════════════════════════════════
       🔷 LOS USUARIOS DE VERDAD (17-08-2026)

       Andrés Guzmán —jefe de recepción— entregó la lista de quién usa la web
       hoy y a qué módulo entra cada uno. Está tal cual la mandó.

       Qué es de ELLOS y qué es NUESTRO, para no confundirlo en la
       demostración:

         · Los MÓDULOS de cada persona son de ellos, textuales. No se inventó
           ninguno ni se sacó ninguno.
         · El ROL —lo que se puede HACER dentro de cada módulo— es propuesta
           NUESTRA. Su sistema no lo tiene: allá el que entra a una pantalla
           puede todo lo que la pantalla ofrece. Hay que confirmarlo con
           ellos cargo por cargo.
         · Nombre y cargo son reales, porque son las cuentas del sistema.
           RUT, teléfono y dirección son inventados, igual que para todos.

       Los dos operarios —desabolladura y pintura— no están en la lista, y con
       razón: hoy no usan la web. En este sistema sí tienen pantalla, así que
       quedan SIN lista de módulos, que es lo mismo que decir "lo que su rol
       permita". Ver `modulos` en el motor. */
    { nombre: 'Alejandra', apellidos: 'Díaz', rol: 'ro-5', etapas: [],
      cargo: 'Gerente de Administración y Finanzas', usuario: 'alejandra.diaz',
      modulos: ['torre', 'historico', 'personal', 'presupuesto', 'documentos', 'bodega'] },
    { nombre: 'Nancy', apellidos: 'Carvajal', rol: 'ro-8', etapas: [],
      cargo: 'Administración', usuario: 'nancy.carvajal',
      modulos: ['torre', 'historico', 'personal', 'presupuesto', 'documentos'] },
    { nombre: 'Nicole', apellidos: 'Hernández', rol: 'ro-2', etapas: ['et-1', 'et-5', 'et-8', 'et-9'],
      cargo: 'Jefatura', usuario: 'nicole.hernandez',
      modulos: ['torre', 'historico', 'recepcion', 'taller', 'personal', 'presupuesto',
                'documentos', 'bodega'] },
    { nombre: 'Iván', apellidos: 'Villalobos', rol: 'ro-1', etapas: [],
      cargo: 'Recepción', usuario: 'ivan.villalobos',
      modulos: ['torre', 'historico', 'recepcion', 'taller', 'presupuesto'] },
    { nombre: 'Esteban', apellidos: 'Calvo', rol: 'ro-1', etapas: [],
      cargo: 'Recepción', usuario: 'esteban.calvo',
      modulos: ['torre', 'historico', 'recepcion', 'taller', 'presupuesto'] },
    { nombre: 'Sheila', apellidos: 'Marín', rol: 'ro-8', etapas: [],
      cargo: 'Administración', usuario: 'sheila.marin',
      modulos: ['torre', 'historico', 'personal', 'presupuesto', 'documentos'] },
    { nombre: 'Sandra', apellidos: 'Hernández', rol: 'ro-8', etapas: [],
      cargo: 'Administración', usuario: 'sandra.hernandez',
      modulos: ['torre', 'historico', 'presupuesto', 'documentos'] },
    { nombre: 'Cristian', apellidos: 'Vidal', rol: 'ro-1', etapas: [],
      cargo: 'Recepción', usuario: 'cristian.vidal',
      modulos: ['torre', 'historico', 'recepcion', 'taller', 'presupuesto'] },
    { nombre: 'Cristopher', apellidos: 'Zúñiga', rol: 'ro-4', etapas: ['et-6', 'et-8'],
      cargo: 'Bodega', usuario: 'cristopher.zuniga',
      modulos: ['torre', 'historico', 'documentos', 'bodega'] },
    { nombre: 'Nicolás', apellidos: 'Zúñiga', rol: 'ro-4', etapas: ['et-6', 'et-8'],
      cargo: 'Bodega', usuario: 'nicolas.zuniga',
      modulos: ['torre', 'historico', 'documentos', 'bodega'] },
    { nombre: 'Andrés', apellidos: 'Guzmán', rol: 'ro-2', etapas: ['et-1', 'et-5', 'et-8', 'et-9'],
      cargo: 'Jefe de Recepción', usuario: 'andres.guzman',
      modulos: ['torre', 'historico', 'recepcion', 'taller', 'presupuesto', 'consolidado'] },

    /* La cuenta de Arttmize, para acompañar la puesta en marcha. Va con
       acceso total y declarada como lo que es: no es del taller. */
    { nombre: 'Administrador', apellidos: 'Arttmize', rol: 'ro-5', etapas: [],
      cargo: 'Arttmize SpA · puesta en marcha', usuario: 'administrador',
      modulos: MODULOS_TODOS }
  ];

  /* La lista de cuentas que mira el SELLO. */
  const EQUIPO_SELLO = EQUIPO;

  function generar() {
    _s = 20260812;   // se reinicia en cada siembra: mismo resultado siempre

    /* ═══════════════════════════════════════════════════════════════════
       CATÁLOGOS — copiados del sistema actual, no inventados
       ═══════════════════════════════════════════════════════════════════ */

    /* Las NUEVE etapas, en el orden del formulario `nuevo-personal`.
       reglas §A.1. `Lavado` NO existe: era un supuesto nuestro.
       Una sola redacción por etapa — el original la escribe de tres formas
       distintas según la pantalla ("Control de calidad" / "Control de
       Calidad" / "Calidad").

       exige_precedencia y requiere_repuestos_completos van APAGADAS: no
       sabemos si esas reglas existen en el sistema actual. Preguntas 1 y 3. */
    const etapa = [
      { id: 'et-1', codigo: 'desarme',       nombre: 'Desarme',            orden: 1, color: '#fb923c', aplica_siempre: true,  exige_precedencia: false, requiere_repuestos_completos: false, vigente: true },
      { id: 'et-2', codigo: 'desabolladura', nombre: 'Desabolladura',      orden: 2, color: '#eab308', aplica_siempre: true,  exige_precedencia: false, requiere_repuestos_completos: false, vigente: true },
      { id: 'et-3', codigo: 'preparacion',   nombre: 'Preparación',        orden: 3, color: '#a3e635', aplica_siempre: true,  exige_precedencia: false, requiere_repuestos_completos: false, vigente: true },
      { id: 'et-4', codigo: 'pintura',       nombre: 'Pintura',            orden: 4, color: '#60a5fa', aplica_siempre: true,  exige_precedencia: false, requiere_repuestos_completos: false, vigente: true },
      { id: 'et-5', codigo: 'armado',        nombre: 'Armado',             orden: 5, color: '#34d399', aplica_siempre: true,  exige_precedencia: false, requiere_repuestos_completos: false, vigente: true },
      { id: 'et-6', codigo: 'mecanica',      nombre: 'Mecánica',           orden: 6, color: '#f59e0b', aplica_siempre: false, exige_precedencia: false, requiere_repuestos_completos: false, vigente: true },
      { id: 'et-7', codigo: 'terminacion',   nombre: 'Terminación',        orden: 7, color: '#c084fc', aplica_siempre: true,  exige_precedencia: false, requiere_repuestos_completos: false, vigente: true },
      { id: 'et-8', codigo: 'calidad',       nombre: 'Control de calidad', orden: 8, color: '#4ade80', aplica_siempre: true,  exige_precedencia: false, requiere_repuestos_completos: false, vigente: true },
      /* 🔶 ENTREGA con la precedencia ENCENDIDA (13-08-2026, pedido de Marco):
         «el control de calidad se hace antes de entregar el auto». Es la única
         de las nueve con el interruptor puesto, y no hizo falta tocar código:
         la fila `Entrega ← Calidad` ya estaba en `etapa_prerrequisito`, solo
         estaba apagada porque no se había confirmado con el cliente. Se apaga
         y se enciende desde Configuración → Precedencias. */
      { id: 'et-9', codigo: 'entrega',       nombre: 'Entrega',            orden: 9, color: '#94a3b8', aplica_siempre: true,  exige_precedencia: true,  requiere_repuestos_completos: false, vigente: true }
    ];

    /* Precedencias: el ORDEN sí está observado (reglas §A.3, historial de una
       OT que recorrió el taller). El BLOQUEO no: en pantalla no hay rastro.
       Por eso las filas existen y el interruptor de cada etapa está apagado.
       Si se confirma que la regla existe, se enciende sin tocar código. */
    const etapa_prerrequisito = [
      { etapa_id: 'et-2', requiere_etapa_id: 'et-1' },   // Desabolladura ← Desarme
      { etapa_id: 'et-3', requiere_etapa_id: 'et-2' },   // Preparación   ← Desabolladura
      { etapa_id: 'et-4', requiere_etapa_id: 'et-3' },   // Pintura       ← Preparación
      { etapa_id: 'et-5', requiere_etapa_id: 'et-4' },   // Armado        ← Pintura
      { etapa_id: 'et-6', requiere_etapa_id: 'et-1' },   // Mecánica      ← Desarme
      { etapa_id: 'et-7', requiere_etapa_id: 'et-5' },   // Terminación   ← Armado
      { etapa_id: 'et-8', requiere_etapa_id: 'et-7' },   // Calidad       ← Terminación
      { etapa_id: 'et-9', requiere_etapa_id: 'et-8' }    // Entrega       ← Calidad
    ];

    /* Los NUEVE estados del maestro `administrar-estados`, literales, con sus
       tildes faltantes y su alternancia de mayúsculas. reglas §B.

       es_final     → gobierna Torre vs Histórico. Verificado: el filtro del
                      Histórico ofrece exactamente estos cinco (§C.8).
       cierra_orden → si admite cambios. NO es lo mismo.

       ⚠️ Mirar `Rechazado`: el maestro lo marca Estado Inicial —o sea sigue
       en la Torre— pero en la reunión se dijo que un rechazo cierra la orden para
       siempre. Los dos booleanos dejan la contradicción visible en vez de
       taparla. Pregunta abierta. */
    const estado = [
      { id: 'es-1', codigo: 'recibido',        nombre: 'Recibido',                         es_final: false, cierra_orden: false, clase: 'verde', orden: 1, vigente: true, alcanzable_en: ['ingreso', 'ficha'] },
      { id: 'es-2', codigo: 'rechazado',       nombre: 'Rechazado',                        es_final: false, cierra_orden: true,  clase: 'roja',  orden: 2, vigente: true, alcanzable_en: ['ingreso', 'ficha'] },
      { id: 'es-3', codigo: 'fuera_taller',    nombre: 'Fuera de taller / Espera repuesto',es_final: false, cierra_orden: false, clase: 'ambar', orden: 3, vigente: true, alcanzable_en: ['ingreso', 'ficha'] },
      { id: 'es-4', codigo: 'pt_espera',       nombre: 'Perdida Total / Espera retiro',    es_final: false, cierra_orden: false, clase: 'roja',  orden: 4, vigente: true, alcanzable_en: ['ingreso', 'ficha'] },
      { id: 'es-5', codigo: 'perdida_total',   nombre: 'Perdida total',                    es_final: true,  cierra_orden: true,  clase: 'roja',  orden: 5, vigente: true, alcanzable_en: [] },
      { id: 'es-6', codigo: 'finalizado',      nombre: 'Finalizado',                       es_final: true,  cierra_orden: true,  clase: 'gris',  orden: 6, vigente: true, alcanzable_en: [] },
      { id: 'es-7', codigo: 'despachada_pt',   nombre: 'Despachada por Perdida Total',     es_final: true,  cierra_orden: true,  clase: 'gris',  orden: 7, vigente: true, alcanzable_en: ['entrega'] },
      { id: 'es-8', codigo: 'entrega_cliente', nombre: 'Entrega Cliente',                  es_final: true,  cierra_orden: true,  clase: 'gris',  orden: 8, vigente: true, alcanzable_en: ['entrega'] },
      { id: 'es-9', codigo: 'entrega_sin_rep', nombre: 'Entrega sin reparar',              es_final: true,  cierra_orden: true,  clase: 'gris',  orden: 9, vigente: true, alcanzable_en: ['entrega'] }
    ];
    /* ⚠️ `perdida_total` y `finalizado` quedan con alcanzable_en vacío A
       PROPÓSITO: en el sistema actual están en el maestro y en el filtro del
       Histórico, pero NINGUNA pantalla los ofrece. Cómo se llega a ellos es
       la pregunta 4. Configuración los muestra rotulados "sin origen
       declarado" en vez de que nosotros inventemos una respuesta. */

    /* Compañías: SIETE reales, consolidadas desde los 19 valores sucios del
       filtro del Histórico. reglas §C.11. Los alias quedan escritos porque
       son el mapa de la migración: hay que poder mostrar qué se
       unificó con qué. */
    const compania = [
      { id: 'co-1', codigo: 'SURA',          nombre: 'SURA',                  vigente: true, alias: [] },
      { id: 'co-2', codigo: 'MAPFRE',        nombre: 'MAPFRE',                vigente: true, alias: ['MAPFE', 'MAPFEE', 'MAPFRW'] },
      { id: 'co-3', codigo: 'CARDIF',        nombre: 'CARDIF',                vigente: true, alias: ['CADIF', 'CARDF', 'CDIF'] },
      { id: 'co-4', codigo: 'HDI',           nombre: 'HDI Seguros',           vigente: true, alias: [] },
      { id: 'co-5', codigo: 'CHILENA',       nombre: 'Chilena Consolidada',   vigente: true, alias: [] },
      { id: 'co-6', codigo: 'MAGALLANES',    nombre: 'Magallanes',            vigente: true, alias: [] },
      { id: 'co-7', codigo: 'PENTA',         nombre: 'Penta Security',        vigente: true, alias: [] }
    ];
    /* Quedaron FUERA a propósito, y hay que preguntarlos: `PRUEBA` (un
       registro de prueba en producción), `HECTOR VASQUEZ` (el nombre de una
       persona guardado como compañía), y `DIVERSEY`, `EUROPCAR` y
       `GRAND LEASING`, que parecen empresas cliente y no aseguradoras. */

    /* Qué campos pide cada tipo de ingreso va en el CATÁLOGO, no escrito en la
       pantalla de recepción: el día que aparezca un cuarto tipo se agrega acá y
       el formulario lo ofrece solo. `exige_or` es el N° de OR que la recepción
       digita en las órdenes de empresa — ver la advertencia de `or_externa` en
       `modelo.js`: no es la OR que genera el presupuesto. */
    const tipo_ingreso = [
      { id: 'ti-1', codigo: 'compania',   nombre: 'Compañía',   exige_compania: true,  exige_or: false, vigente: true },
      { id: 'ti-2', codigo: 'particular', nombre: 'Particular', exige_compania: false, exige_or: false, vigente: true },
      { id: 'ti-3', codigo: 'empresa',    nombre: 'Empresa',    exige_compania: false, exige_or: true,  vigente: true }
    ];

    const prioridad = [
      { id: 'pri-1', codigo: 'normal',  nombre: 'Normal',  color: '#64748b', vigente: true },
      { id: 'pri-2', codigo: 'express', nombre: 'Express', color: '#f43f5e', vigente: true }
    ];

    /* Los SEIS asuntos de la bitácora. reglas §C.16. La columna Alerta de la
       Torre es la INICIAL de estos, y las seis iniciales son distintas entre
       sí, así que no hay colisión.

       ⚠️ En el sistema actual están escritos en el código: la ficha ofrece
       los seis y las pantallas de etapas solo cuatro. Acá son un catálogo y
       se ofrecen los seis en todas partes. */
    const asunto_bitacora = [
      { id: 'as-1', codigo: 'envio',        nombre: 'Envio',        orden: 1, genera_alerta: true, vigente: true },
      { id: 'as-2', codigo: 'autorizado',   nombre: 'Autorizado',   orden: 2, genera_alerta: true, vigente: true },
      { id: 'as-3', codigo: 'otro',         nombre: 'Otro',         orden: 3, genera_alerta: true, vigente: true },
      { id: 'as-4', codigo: 'repuestos',    nombre: 'Repuestos',    orden: 4, genera_alerta: true, vigente: true },
      { id: 'as-5', codigo: 'correcciones', nombre: 'Correcciones', orden: 5, genera_alerta: true, vigente: true },
      { id: 'as-6', codigo: 'presupuesto',  nombre: 'Presupuesto',  orden: 6, genera_alerta: true, vigente: true }
    ];

    /* 🔶 EL TEMPARIO SE ELIMINÓ (13-08-2026). En el sistema actual es un
       desplegable con un solo valor —$10.000 la hora, reglas §C.15— y acá
       servía para proponer la venta de mano de obra multiplicando las horas
       por esa tarifa. Se saca entero: el taller no cobra por hora, cotiza un
       precio por trabajo, y tener la tarifa a la vista invita a que la
       compañía divida el monto por las horas y discuta un valor hora que no
       existe. Con el desplegable fuera del presupuesto, el catálogo de
       Configuración no gobernaba nada: una pantalla que configura aire. */

    /* Responsable de pago de cada repuesto. En el original es texto libre y
       viene sucio (`sura`, `SURA`, `Sura`, `dyp`, `DYP`, `Dyp`, y muchos
       vacíos). Acá es catálogo cerrado: ES PLATA DEL TALLER. reglas §C.14. */
    const responsable_pago = [
      { id: 'rp-1', codigo: 'compania', nombre: 'Compañía', es_taller: false, vigente: true },
      { id: 'rp-2', codigo: 'dyp',      nombre: 'DyP',      es_taller: true,  vigente: true }
    ];

    /* ⚠️ NO existe en el sistema actual. Ninguna de las 39 pantallas tiene
       motivos de detención ni imputabilidad. Queda modelado, sin pantalla
       propia: es desarrollo nuevo y se cotiza aparte. */
    const motivo_detencion = [
      { id: 'mo-1', codigo: 'espera_repuesto',   nombre: 'Espera de repuesto',            imputable_a: 'proveedor',   vigente: true },
      { id: 'mo-2', codigo: 'espera_aprobacion', nombre: 'Espera aprobación aseguradora', imputable_a: 'aseguradora', vigente: true },
      { id: 'mo-3', codigo: 'espera_liquidador', nombre: 'Espera visita del liquidador',  imputable_a: 'aseguradora', vigente: true },
      { id: 'mo-4', codigo: 'espera_cliente',    nombre: 'Espera respuesta del cliente',  imputable_a: 'cliente',     vigente: true }
    ];

    /* El original tiene 169 colores y 73 marcas. Acá va una muestra: lo que
       importa demostrar es que son un CATÁLOGO editable, no una lista quemada
       — en el sistema actual "Administrar Colores Vehículos" apunta a sí
       misma y no lleva a ninguna parte. */
    const color_vehiculo = ['Blanco', 'Negro', 'Gris', 'Plata', 'Rojo', 'Azul', 'Azul marino',
      'Verde', 'Beige', 'Café', 'Amarillo', 'Naranjo', 'Burdeo', 'Perla', 'Grafito', 'Champagne']
      .map((n, i) => ({ id: 'col-' + (i + 1), codigo: n.toLowerCase().replace(/\s/g, '_'), nombre: n, orden: i + 1, vigente: true }));

    const MARCAS = ['CHEVROLET', 'HYUNDAI', 'KIA', 'NISSAN', 'SUZUKI', 'TOYOTA', 'MAZDA',
      'FORD', 'PEUGEOT', 'RENAULT', 'MITSUBISHI', 'VOLKSWAGEN', 'HONDA', 'SUBARU',
      'CHERY', 'MG', 'GREAT WALL', 'JAC', 'CITROEN', 'FIAT'];
    const marca = MARCAS.map((n, i) => ({ id: 'ma-' + (i + 1), codigo: String(i), nombre: n, vigente: true }));

    /* ── 🔶 EL PARQUE NO ES PAREJO ─────────────────────────────────────────
       Hasta el 19-08-2026 la marca del vehículo salía de `marca[idx % 20]`:
       veinte marcas repartidas en redondo, así que las 222 órdenes daban
       exactamente once o doce autos por marca. En la Reportería eso se veía
       como un ranking de «Modelos más siniestrados» donde los diez primeros
       marcaban SEIS órdenes cada uno, con las diez barras del mismo largo.

       Un ranking donde todos empatan no es un ranking: es un adorno. Y a la
       vista se nota que el dato es inventado, que es justo lo que no puede
       pasar en la pantalla que se le muestra al dueño.

       Estos pesos son un reparto de mercado plausible —las japonesas y
       coreanas de volumen arriba, las europeas y chinas abajo—, NO una
       medición del parque chileno ni de la cartera de DyP. Es dato de
       demostración y así está rotulado en el panel. */
    const PESO_MARCA = { CHEVROLET: 9, HYUNDAI: 9, KIA: 8, NISSAN: 8, SUZUKI: 7, TOYOTA: 7,
      MAZDA: 6, FORD: 5, PEUGEOT: 4, RENAULT: 4, MITSUBISHI: 3, VOLKSWAGEN: 3,
      HONDA: 2, SUBARU: 2, CHERY: 2, MG: 2, 'GREAT WALL': 1, JAC: 1, CITROEN: 1, FIAT: 1 };
    /* La bolsa: cada marca entra tantas veces como pesa, y se recorre en
       redondo. Sale de una tabla y no de un sorteo para que la base sembrada
       sea idéntica en todos los computadores — que es lo que deja comparar una
       captura de pantalla contra otra. */
    const bolsaCruda = [];
    marca.forEach((m, i) => {
      for (let k = 0; k < (PESO_MARCA[m.nombre] || 1); k++) bolsaCruda.push(i);
    });
    /* Se entrelaza por POSICIÓN, no por valor: ordenar por una función del
       valor deja juntas todas las copias de la misma marca, que es lo que
       había que evitar. Ocho Chevrolet seguidos en la torre se leen como un
       error de carga, no como el parque de un taller. `(i × 41) mod 85` es una
       permutación —41 y 85 no comparten divisores—, así que no se pierde ni se
       repite ninguna. */
    const BOLSA_MARCA = bolsaCruda
      .map((v, i) => ({ v, orden: (i * 41) % bolsaCruda.length }))
      .sort((a, b) => a.orden - b.orden)
      .map((x) => x.v);

    /* Dentro de cada marca tampoco es parejo: el modelo de entrada se vende
       más que el tope de gama. Cuatro de cada diez autos son el primer modelo,
       tres el segundo, dos el tercero y uno el cuarto. */
    const PATRON_MODELO = [0, 1, 0, 2, 0, 1, 3, 0, 1, 2];

    const MODELOS = {
      CHEVROLET: ['Sail', 'Onix', 'Spark', 'Tracker'], HYUNDAI: ['Accent', 'Tucson', 'Creta', 'Grand i10'],
      KIA: ['Rio', 'Morning', 'Sportage', 'Seltos'], NISSAN: ['Versa', 'Kicks', 'Qashqai', 'March'],
      SUZUKI: ['Swift', 'Baleno', 'Vitara', 'Celerio'], TOYOTA: ['Yaris', 'Corolla', 'Rav4', 'Hilux'],
      MAZDA: ['Mazda 3', 'CX-5', 'Mazda 2', 'BT-50'], FORD: ['Ranger', 'Ecosport', 'Escape', 'Fiesta'],
      PEUGEOT: ['208', '2008', '308', 'Partner'], RENAULT: ['Kwid', 'Duster', 'Sandero', 'Logan'],
      MITSUBISHI: ['L200', 'ASX', 'Outlander', 'Mirage'], VOLKSWAGEN: ['Gol', 'Polo', 'T-Cross', 'Amarok'],
      HONDA: ['Fit', 'HR-V', 'City', 'Civic'], SUBARU: ['XV', 'Forester', 'Impreza', 'Outback'],
      CHERY: ['Tiggo 2', 'Tiggo 4', 'Arrizo 5', 'Tiggo 7'], MG: ['MG3', 'ZS', 'MG5', 'RX5'],
      'GREAT WALL': ['Wingle', 'Poer', 'Haval H6', 'Jolion'], JAC: ['S2', 'T6', 'S3', 'J4'],
      CITROEN: ['C3', 'C4 Cactus', 'Berlingo', 'C-Elysee'], FIAT: ['Mobi', 'Argo', 'Cronos', 'Strada']
    };
    const modelo = [];
    marca.forEach((m) => (MODELOS[m.nombre] || []).forEach((n, j) =>
      modelo.push({ id: m.id + '-mo-' + (j + 1), marca_id: m.id, nombre: n, vigente: true })));

    /* Los 28 ítems del checklist de recepción, en el orden del formulario del
       sistema actual. inventario §Nuevo Ingreso.
       Se cree que "el checklist se cayó": está entero. Pregunta 10.

       El `codigo` es el `name` literal del HTML original y NO se toca: es la
       llave de la migración. El `nombre` es lo que se lee en pantalla, y ahí sí
       se corrigió (15-08-2026, pedido del cliente): seis rótulos que estaban en
       plural donde el taller cuenta de a uno —`Ceniceros`→`Cenicero`— o sin la
       preposición —`Llave rueda`→`Llave de rueda`—, más las tildes que faltaban
       por venir de un `codigo` sin acentos: Botiquín, Cinturón, Batería,
       Señalizadores y Triángulos. Antes se derivaba del código con un `replace`,
       y por eso ninguna llevaba tilde. */
    const inventario_item = [
      ['radio',                   'Radio'],
      ['ceniceros',               'Cenicero'],
      ['encendedor',              'Encendedor'],
      ['espejo_interior',         'Espejo interior'],
      ['luz_interior',            'Luz interior'],
      ['pisos_goma',              'Pisos de goma'],
      ['tag',                     'Tag'],
      ['cinturon',                'Cinturón'],
      ['antena_radio',            'Antena radio'],
      ['botiquin',                'Botiquín'],
      ['parabrisas',              'Parabrisas'],
      ['emblemas_delanteros',     'Emblemas delanteros'],
      ['placa_patente_delantera', 'Placa patente delantera'],
      ['espejos_laterales',       'Espejos laterales'],
      ['senalizadores_laterales', 'Señalizadores laterales'],
      ['llave_rueda',             'Llave de rueda'],
      ['rueda_repuesto',          'Rueda repuesto'],
      ['tapas_ruedas',            'Tapas de rueda'],
      ['placa_patente_trasera',   'Placa patente trasera'],
      ['tapa_bencina',            'Tapa bencina'],
      ['bateria',                 'Batería'],
      ['bocina',                  'Bocina'],
      ['documentos',              'Documentos'],
      ['llaves_vehiculo',         'Llaves del vehículo'],
      ['sistema_alarma',          'Sistema de alarma'],
      ['extintor',                'Extintor'],
      ['triangulos',              'Triángulos'],
      ['gata',                    'Gata']
    ].map(([c, n], i) => ({ id: 'inv-' + (i + 1), codigo: c, orden: i + 1, vigente: true, nombre: n }));

    const tipo_dano = [
      { id: 'td-1', codigo: 'rayon',      nombre: 'Rayón',      color: '#f59e0b', vigente: true },
      { id: 'td-2', codigo: 'abolladura', nombre: 'Abolladura', color: '#ef4444', vigente: true },
      { id: 'td-3', codigo: 'quiebre',    nombre: 'Quiebre',    color: '#a78bfa', vigente: true },
      { id: 'td-4', codigo: 'faltante',   nombre: 'Faltante',   color: '#22d3ee', vigente: true },
      { id: 'td-5', codigo: 'oxido',      nombre: 'Óxido',      color: '#84cc16', vigente: true }
    ];

    /* 🔴 CUATRO ZONAS QUE FALTABAN, y no era un detalle. La silueta ofrecía
       marcar el parabrisas, la luneta y los dos costados traseros, pero esos
       cuatro códigos no estaban en este catálogo: al guardar, `zona_id` quedaba
       en null y el daño se perdía como dato consultable —seguía dibujado, pero
       nadie podía preguntar después cuántos vehículos llegaron con la luneta
       rota—. Se agregan (15-08-2026). Es exactamente el agujero que este
       catálogo existe para tapar. */
    const zona_dano = [
      ['capo', 'Capó'], ['techo', 'Techo'], ['maletero', 'Maletero'],
      ['puerta_del_izq', 'Puerta del. izq.'], ['puerta_tra_izq', 'Puerta tras. izq.'],
      ['puerta_del_der', 'Puerta del. der.'], ['puerta_tra_der', 'Puerta tras. der.'],
      ['paragolpes_del', 'Paragolpes del.'], ['paragolpes_tra', 'Paragolpes tras.'],
      ['tapabarro_izq', 'Tapabarro izq.'], ['tapabarro_der', 'Tapabarro der.'],
      ['parabrisas', 'Parabrisas'], ['luneta', 'Luneta'],
      ['costado_tra_izq', 'Costado tras. izq.'], ['costado_tra_der', 'Costado tras. der.']
    ].map(([c, n], i) => ({ id: 'zd-' + (i + 1), codigo: c, nombre: n, vigente: true }));

    /* ═══════════════════════════════════════════════════════════════════
       ROLES Y PERMISOS — se CONSTRUYEN, no se copian
       El sistema actual no tiene ninguna administración de roles: el alta de
       usuario tiene cinco campos y ninguno es un rol. reglas §A.4.
       Esto es literalmente lo que se pidió al decir "escalable".
       ═══════════════════════════════════════════════════════════════════ */

    const permiso = CATALOGO_PERMISOS.map(([codigo, descripcion]) => ({ codigo, descripcion }));

    /* ── ALCANCE: sobre QUÉ ÓRDENES ─────────────────────────────────────────
       El permiso dice qué PANTALLAS abre alguien. El alcance dice sobre qué
       FILAS. Son dos cosas distintas y hasta el 13-08-2026 solo existía la
       primera: al pintor no le aparecía Configuración en el menú, pero veía
       los 102 vehículos del taller con el nombre y el RUT de cada cliente.

         todo      · todas las órdenes
         asignado  · solo las que tiene tomadas o a su cargo
         compania  · solo las de su compañía de seguros

       El operario es el único con `asignado`, y es el punto: entra, ve los
       cuatro autos que le tocan, cierra su etapa y no hay una fila más. */
    const rol = [
      { id: 'ro-1', codigo: 'recepcion',    nombre: 'Recepción',      alcance: 'todo',     vigente: true },
      { id: 'ro-2', codigo: 'jefe_taller',  nombre: 'Jefe de taller', alcance: 'todo',     vigente: true },
      { id: 'ro-3', codigo: 'operario',     nombre: 'Operario',       alcance: 'asignado', vigente: true },
      { id: 'ro-4', codigo: 'bodega',       nombre: 'Bodega',         alcance: 'todo',     vigente: true },
      /* `total: true` no es una fila más de la matriz: es una GARANTÍA. Un rol
         total tiene acceso a todo el sistema siempre, y no se le puede quitar.
         Sin esto, bastaba con que alguien desmarcara `configuracion` en la
         fila de Administración —por error o por mano ajena— para que el taller
         quedara sin nadie que pudiera volver a marcarla. Un sistema del que te
         puedes dejar afuera sin marcha atrás no es administrable. */
      { id: 'ro-5', codigo: 'admin',        nombre: 'Administración', alcance: 'todo',     total: true, vigente: true },
      { id: 'ro-6', codigo: 'dueno',        nombre: 'Dueño',          alcance: 'todo',     total: true, vigente: true },
      { id: 'ro-7', codigo: 'aseguradora',  nombre: 'Aseguradora',    alcance: 'compania', vigente: true, externo: true },
      /* El evaluador no existia. Lo pidio el cliente el 15-08-2026: es quien
         valoriza el presupuesto y el UNICO que declara una perdida total.
         Queda como rol INTERNO del taller mientras no se confirme si es
         alguien de la casa o el liquidador de la compañia — si fuera de la
         compañia habria que darle alcance 'compania' y tratarlo como externo,
         que cambia el modelo de acceso completo. */
      { id: 'ro-8', codigo: 'evaluador',    nombre: 'Evaluador',      alcance: 'todo',     vigente: true }
    ];

    /* La matriz. Lo importante para la demostración es el contraste entre el
       operario —que ve el presupuesto pero NO los montos— y quien sí los ve.
       "Tiene el presupuesto y no puede ver los valores."

       🔶 CAMBIO PEDIDO POR MARCO (13-08-2026): el nivel de COSTO y UTILIDAD se
       eliminó. El taller no lleva costos por orden, así que el presupuesto es
       la VENTA y nada más. Quedan dos niveles: ve las líneas / ve los montos. */
    /* Quién presupuesta: el JEFE DE TALLER y administración. Nadie más.
       Pasó por dos revisiones. Primero lo tenía solo el dueño y el flujo no
       cerraba —el auto se recibe, se le asigna un responsable y esa persona
       tiene que poder valorizar el daño—, así que se le dio también a
       recepción con el argumento de que es quien habla con la compañía. Al
       revisar los accesos de verdad quedó claro que el argumento no aguanta:
       hablar con la compañía es MANDAR el presupuesto, no ARMARLO. Quien sabe
       cuánto cuesta reparar un tapabarro es el que está en el taller.
       Recepción quedó leyéndolo y pudiendo mandarlo; un operario ve las
       líneas, no los valores, y no crea. */
    /* El reparto, puesto por puesto. Sale de recorrer el día de cada uno y
       preguntar qué necesita TOCAR, no qué le vendría bien mirar.

       RECEPCIÓN — recibe el auto, fotografía el daño, anota al cliente y a la
       compañía, hace el seguimiento y al final entrega. Es la única que
       necesita el RUT sin enmascarar, porque es la que emite. No ve el
       histórico ni el tablero de esperas: eso es análisis de gestión, no
       atención de público.

       🔶 CAMBIO PEDIDO POR MARCO (13-08-2026): recepción pierde dos permisos
       que antes tenía —eran los dos más discutibles de los dieciséis—:

         · `presupuesto.crear` · valorizar el daño lo hace quien sabe cuánto
           cuesta reparar un tapabarro, y ése es el jefe de taller. Recepción
           conserva `presupuesto.ver` y `presupuesto.montos`: sigue leyendo la
           OR y sigue pudiendo abrir el PDF para mandárselo a la compañía y
           para responderle al cliente cuánto es. Lo que ya no hace es armarla.
         · `salida.registrar` · sacar el vehículo del taller DETIENE el reloj
           de reparación, que es el número del que cuelga toda la meta de días.
           Esa decisión es del taller, no del mostrador.

       Si en la práctica resulta que es recepción la que recibe el auto de
       vuelta cuando llega de un tercero, es una casilla en Configuración.

       JEFE DE TALLER — reparte el trabajo y responde por los plazos. Ve casi
       todo lo operativo: torre, tablero, esperas, repuestos, presupuestos con
       monto. No ve el HISTÓRICO —el archivo de lo ya cerrado es del
       administrador— ni el consolidado, ni la configuración, ni el RUT.
       Puede mirar la ficha del personal para saber quién está, pero no
       editarla: los datos de un trabajador los toca administración.

       OPERARIO (desabolladura, pintura) — hace el trabajo con las manos. Ve
       SU lista, el tablero del piso y si llegó su repuesto. Del vehículo ve
       lo que necesita para trabajarlo: patente, marca, modelo, color, daños,
       su etapa y las líneas del presupuesto SIN los montos —para saber qué
       fue autorizado—. No ve al cliente, ni la compañía, ni el siniestro, ni
       fotos, ni documentos, ni el historial. Y solo sobre los autos que tiene
       asignados: el alcance `asignado` hace el resto.

       BODEGA — pide, recibe y entrega piezas. Necesita la torre entera porque
       compra para todo el taller, y los documentos porque la guía de despacho
       llega con la pieza. No ve montos de venta ni el RUT del cliente.

       ADMINISTRACIÓN (Gabriel Díaz) — ve y hace todo, incluido el histórico,
       el consolidado y la configuración. Hoy queda igual que el rol Dueño
       porque así se pidió: un administrador que vea todo. Son dos filas
       distintas para que el día que el dueño quiera guardarse el margen,
       se le quite `consolidado.ver` a Administración en Configuración y
       listo — sin tocar una línea de código. */
    const M = {
      recepcion:   ['torre.ver', 'taller.ver', 'repuesto.ver', 'ficha.completa',
                    'documento.ver', 'documento.cargar', 'foto.ver', 'foto.cargar',
                    'ot.crear', 'ot.editar', 'presupuesto.ver', 'presupuesto.montos',
                    // Abre la OR, no le pone los montos. Esa es la separacion.
                    'presupuesto.abrir',
                    'entrega.registrar', 'datos.rut_completo'],
      evaluador:   ['torre.ver', 'taller.ver', 'repuesto.ver', 'espera.ver', 'ficha.completa',
                    'documento.ver', 'foto.ver', 'presupuesto.ver', 'presupuesto.montos',
                    'presupuesto.abrir', 'presupuesto.crear',
                    // El unico que puede declararla, aparte de administracion.
                    'perdida_total.declarar', 'historico.ver'],
      jefe_taller: ['torre.ver', 'taller.ver', 'repuesto.ver', 'espera.ver', 'ficha.completa',
                    'documento.ver', 'foto.ver', 'foto.cargar',
                    'etapa.asignar', 'etapa.finalizar', 'presupuesto.ver', 'presupuesto.montos',
                    'presupuesto.crear', 'presupuesto.abrir', 'personal.ver', 'salida.registrar',
                    // Quién decide que un auto se detiene y por qué: el que manda en el taller.
                    'detencion.gestionar'],
      operario:    ['taller.ver', 'repuesto.ver', 'etapa.finalizar', 'presupuesto.ver'],
      bodega:      ['torre.ver', 'taller.ver', 'repuesto.ver', 'ficha.completa',
                    'documento.ver', 'documento.cargar', 'repuesto.cargar',
                    'repuesto.devolver', 'presupuesto.ver'],
      admin:       permiso.map((p) => p.codigo),
      dueno:       permiso.map((p) => p.codigo),
      aseguradora: ['torre.ver', 'ficha.completa', 'presupuesto.ver', 'presupuesto.montos',
                    'documento.ver', 'foto.ver']
    };
    const rol_permiso = [];
    rol.forEach((r) => (M[r.codigo] || []).forEach((p) =>
      rol_permiso.push({ rol_id: r.id, permiso_codigo: p })));

    /* ═══════════════════════════════════════════════════════════════════
       PERSONAS — todas inventadas
       ═══════════════════════════════════════════════════════════════════ */

    const NOM = ['Andrés', 'Bernardita', 'Camilo', 'Daniela', 'Esteban', 'Fernanda', 'Gonzalo',
      'Hilda', 'Ignacio', 'Javiera', 'Kevin', 'Lorena', 'Matías', 'Natalia', 'Óscar', 'Paulina',
      'Rodrigo', 'Sofía', 'Tomás', 'Valentina', 'Wilson', 'Ximena', 'Yerko', 'Zoila'];
    const APE = ['Aguilera', 'Bravo', 'Cárdenas', 'Donoso', 'Espinoza', 'Fuentes', 'Gallardo',
      'Herrera', 'Ibáñez', 'Jara', 'Klein', 'Lagos', 'Molina', 'Núñez', 'Orellana', 'Peña',
      'Quezada', 'Riquelme', 'Sepúlveda', 'Tapia', 'Urrutia', 'Vergara', 'Yáñez', 'Zúñiga'];

    // RUT ficticio de la serie 11.111.111-K. No corresponde a nadie.
    const rutFalso = (n) => '11.' + String(100 + (n % 900)).padStart(3, '0') + '.' +
      String(100 + ((n * 7) % 900)).padStart(3, '0') + '-' + (n % 10);

    const persona = [];
    const persona_etapa = [];
    const persona_rol = [];

    /* 🔶 EL VALOR HORA SE ELIMINÓ (decisión del 13-08-2026). No se ocupa. Y hay algo que conviene señalar: el requisito A-3 de la
       auditoría pedía protegerlo con su propia política de acceso porque hoy
       cualquier cuenta ve el sueldo de los 89 trabajadores.
       **Al no recoger el dato, el requisito deja de aplicar.** El dato que no
       se guarda no se puede filtrar: es la mejor respuesta posible a A-3. */

    /* CINCO personas, no 89 (decisión del 13-08-2026).
       El sistema real tiene 89 trabajadores y ese número sigue anotado más
       arriba como lo que se midió. Pero una lista de 89 no se puede usar para
       demostrar nada: no se distingue quién hace qué. Acá va un equipo chico
       con especialidades claras, que es lo que permite mostrar el flujo —a
       quién le llega el auto después de la recepción, quién lo pinta, quién lo
       entrega— y que cada perfil vea en su panel solo lo suyo.

       Nombres inventados. Ningún dato de ninguna persona real. */
    /* Cada persona entra al sistema con SU usuario y SU clave. El usuario es
       el correo o el número de ficha —los dos sirven, porque en el taller a la
       gente se la identifica por ficha y en la oficina por correo—.

       ⚠️ Las claves iniciales son de DEMOSTRACIÓN y están a la vista en la
          pantalla de ingreso, a propósito: esto corre en el navegador y una
          clave guardada acá la puede leer cualquiera que abra las herramientas
          del desarrollador. **Es un ingreso modelado, no una autenticación.**
          La de verdad vive en el servidor, con la clave cifrada y sin viajar
          nunca al navegador. No decimos "cumple" donde corresponde decir
          "está modelado, falta el servidor". */
    /* Las cuentas son POR ROL, no por persona (decisión del 13-08-2026). En un
       taller chico el sistema no lo abre "Marcelo": lo abre el que está en
       desabolladura ese día. Y en una demostración los nombres inventados
       distraen — la primera pregunta pasa a ser "¿quién es Marcelo?" en vez de
       "¿qué ve el que desabolla?".

       La única cuenta con nombre propio es la del administrador, porque es una
       sola persona y responde por todo.

       Cuando el sistema se ponga en marcha, cada cuenta de rol puede
       desdoblarse en una por persona sin cambiar nada: el motor ya trabaja con
       cuentas individuales, y las etapas y las órdenes cuelgan de la cuenta,
       no del rol. */
    /* CLAVE_DEMO, MODULOS_TODOS y EQUIPO se subieron al alcance del módulo
       el 18-08-2026: el SELLO de la semilla necesita leer las cuentas SIN
       generar la base entera, y desde adentro de esta función no se alcanzan. */

    const sinTildes = (t) => String(t).toLowerCase()
      .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
      .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/[^a-z]/g, '');

    EQUIPO.forEach((x, i) => {
      const id = 'pe-t-' + (i + 1);
      const corto = x.usuario || sinTildes(x.nombre);
      persona.push({
        id, tipo: 'trabajador', ficha: 1001 + i, rut: rutFalso(i + 1),
        usuario: corto + '@dyp.cl',
        /* 🔷 UNA SOLA CLAVE PARA TODOS (17-08-2026, Marco: "de momento todos
           entren con la contraseña dyp2026"). Antes cada cuenta tenía la suya
           —`nombre` + 2026— y para probar el sistema con catorce cuentas había
           que ir a buscar catorce claves distintas.

           🔴 ESTO ES DE LA DEMOSTRACIÓN Y NO PUEDE VIAJAR A LA PUESTA EN
           MARCHA. Una clave compartida y escrita en el código no es una clave:
           es un cartel. Queda marcada `clave_inicial`, así que el sistema pide
           cambiarla al entrar y lo dice en la ficha de cada cuenta. */
        clave: CLAVE_DEMO,
        clave_inicial: true,
        nombres: x.nombre, apellidos: x.apellidos || '', cargo: x.cargo,
        correo: corto + '@dyp.cl',
        telefono: '+56 9 0000 ' + String(1001 + i).slice(-4),
        direccion: 'Dirección de ejemplo ' + (100 + i), comuna: 'Comuna de ejemplo',
        /* A qué módulos entra. `null` no es "a ninguno": es "los que su rol
           permita", que es como funcionaba antes de que existiera esta lista.
           Los dos operarios quedan así a propósito. */
        modulos: x.modulos ? x.modulos.slice() : null,
        activo: true, demo: true
      });
      x.etapas.forEach((e) => persona_etapa.push({ persona_id: id, etapa_id: e }));
      persona_rol.push({ persona_id: id, rol_id: x.rol });
    });

    // Un usuario por rol, para poder demostrar el enmascaramiento.
    rol.forEach((r, i) => {
      const id = 'pe-u-' + r.codigo;
      persona.push({
        id, tipo: 'usuario', ficha: null, rut: rutFalso(500 + i),
        nombres: 'Usuario', apellidos: r.nombre, correo: r.codigo + '@ejemplo.cl',
        telefono: null, direccion: null, comuna: null, activo: true, demo: true
      });
      persona_rol.push({ persona_id: id, rol_id: r.id });
    });

    /* ═══════════════════════════════════════════════════════════════════
       PARÁMETROS DE NEGOCIO — no constantes en el código
       ═══════════════════════════════════════════════════════════════════ */

    const parametro = [
      { clave: 'meta_dias_reparacion', nombre: 'Meta de días de reparación', valor: 15, tipo: 'numero',
        ayuda: 'El objetivo declarado por el taller. Hoy el promedio de las órdenes abiertas es 18.' },
      { clave: 'kpi_reparacion', nombre: 'Qué reloj se mide contra la meta', valor: 'acumulado', tipo: 'opcion',
        opciones: [
          { valor: 'acumulado',      nombre: 'Reparación acumulada (el reloj se reanuda al reingresar)' },
          { valor: 'estadia_actual', nombre: 'Estadía actual (el reloj vuelve a cero al reingresar)' }
        ],
        ayuda: 'En la reunión se pidió que vuelva a cero. Los dos números se calculan siempre; esto elige cuál es el KPI.' },
      /* A quién se le avisa cuando se envía o se resuelve un presupuesto. Queda
         configurable a propósito: es una decisión del taller que todavía no
         está respondida —la pregunta 6— y el sistema no se bloquea esperándola.
         Por omisión sigue al origen de la orden, que es lo razonable. */
      { clave: 'aviso_presupuesto_destino', nombre: 'A quién se avisa del presupuesto',
        valor: 'auto', tipo: 'opcion',
        opciones: [
          { valor: 'auto',     nombre: 'Según el origen: compañía si vino por compañía, si no el cliente' },
          { valor: 'compania', nombre: 'Siempre a la compañía' },
          { valor: 'cliente',  nombre: 'Siempre al cliente' }
        ],
        ayuda: 'El aviso sale al enviar y al resolverse, con las líneas y el monto reales. ' +
               'El modelo borrador NO manda correo: la cola está modelada y el envío es del servidor.' },
      { clave: 'correlativo_ot', nombre: 'Próximo número de OT', valor: ULTIMA_OT + 1, tipo: 'numero',
        ayuda: 'Correlativo de cinco dígitos, sin año ni local. Al 12-08-2026 el sistema real iba por ' + ULTIMA_OT + '.' },
      { clave: 'iva', nombre: 'IVA', valor: 19, tipo: 'numero', ayuda: 'Porcentaje aplicado al neto del presupuesto.' },
      /* 🔶 EL TEMPARIO VUELVE (16-08-2026). Se había sacado el 13-08 creyendo
         que el taller cotizaba un precio por trabajo. El PDF de la OR
         23505-18401-001 que trajo Marco muestra que no: cada línea lleva
         horas en Desmontar y montar, Reparar y Pintar, y el precio de cada
         columna es HORAS × TEMPARIO. Las cifras de ese documento cuadran al
         peso con esa fórmula. Es el valor por omisión: cada presupuesto
         guarda el suyo, para que subir la tarifa no cambie una OR ya firmada. */
      { clave: 'tempario', nombre: 'Tempario (valor hora)', valor: 10000, tipo: 'numero',
        ayuda: 'Valor de la hora de mano de obra. Multiplica las horas de Desmontar y montar, Reparar y Pintar.' },
      { clave: 'retencion_fotos_meses', nombre: 'Retención de fotografías (meses)', valor: 12, tipo: 'numero',
        ayuda: 'Hoy las fotos se borran al año POR FALTA DE DISCO, no por política. Acá es una decisión de negocio.' },
      /* Nadie en el taller sabe comprimir una foto, y no tiene por qué: lo hace
         el sistema al subirla. Pero queda como interruptor, porque si alguna
         vez hace falta el original íntegro —un peritaje, un juicio— hay que
         poder apagarlo sabiendo lo que cuesta en disco. */
      { clave: 'comprimir_fotos', nombre: 'Comprimir las fotos al subirlas', valor: 'si', tipo: 'opcion',
        opciones: [
          { valor: 'si', nombre: 'Sí — el sistema las achica solo (recomendado)' },
          { valor: 'no', nombre: 'No — guardar el archivo tal como viene' }
        ],
        ayuda: 'Con compresión, ~34 GB al año. Sin compresión, ~296 GB. Cálculo nuestro sobre supuestos.' },
      { clave: 'foto_lado_max', nombre: 'Lado largo de la foto (píxeles)', valor: 1600, tipo: 'numero',
        ayuda: 'A 1600 px una foto de taller se sigue viendo bien impresa y en pantalla.' },
      { clave: 'foto_objetivo_kb', nombre: 'Peso objetivo por foto (KB)', valor: 350, tipo: 'numero',
        ayuda: 'El sistema baja la calidad por pasos hasta llegar acá. Si no llega, guarda igual y lo dice.' }
    ];

    /* ═══════════════════════════════════════════════════════════════════
       OPERACIÓN — datos inventados, totales reales
       ═══════════════════════════════════════════════════════════════════ */

    const vehiculo = [], recepcion = [], orden_trabajo = [], ot_etapa = [], ot_estadia = [];
    const repuesto = [], presupuesto = [], presupuesto_linea = [], bitacora = [], media = [];
    const evento = [], dano = [], recepcion_inventario = [], ot_detencion = [], costo_adicional = [];
    // La cola de avisos por correo nace vacía: se llena al operar. Es la
    // parte MODELADA del punto 4 — el envío real lo hace el servidor.
    const aviso = [];

    /* 🔴 UNA PATENTE, UN VEHÍCULO, UNA PERSONA.

       La fórmula anterior repetía sin que se notara: las cuatro letras
       ciclaban cada 18 y el número cada 90, y 90 es múltiplo de 18, así que
       `PATENTES[i]` y `PATENTES[i+90]` eran LA MISMA PATENTE. Con 222 órdenes,
       cada patente salía dos o tres veces, cada una con otro dueño. Lo vio el
       cliente el 15-08-2026 en Entrega: `KFVZ17` figuraba a nombre de Daniela
       Herrera y de Ximena Bravo, las dos listas para entregar.

       No era sólo feo: contradecía la primera regla del motor —una patente no
       puede tener dos órdenes abiertas— justo en la pantalla donde se muestra
       que esa regla existe. Un dato de demostración que se contradice a sí
       mismo hace perder la reunión.

       Ahora el índice recorre las letras en base 18, que no se sincroniza con
       el ciclo de 90 del número, y además se comprueba una por una: la que
       repita se descarta. */
    const PATENTES = [];
    const L = 'BCDFGHJKLPRSTVWXYZ';
    const patentesVistas = {};
    for (let i = 0; PATENTES.length < 400; i++) {
      const p = L[i % 18] + L[Math.floor(i / 18) % 18] + L[Math.floor(i / 324) % 18] +
        L[Math.floor(i / 5832) % 18] + String(10 + (i % 90));
      if (patentesVistas[p]) continue;
      patentesVistas[p] = true;
      PATENTES.push(p);
    }

    let nOT = ULTIMA_OT - (TOTAL_TORRE + TOTAL_HISTORICO) + 1;
    let seqRep = 0, seqPre = 0, seqEv = 0, seqBit = 0;

    // Quién puede hacer cada etapa. Se calcula una vez: son 89 trabajadores
    // por 9 etapas y crearOrden se llama 222 veces.
    const habilitados = {};
    etapa.forEach((e) => {
      habilitados[e.id] = persona_etapa.filter((p) => p.etapa_id === e.id).map((p) => p.persona_id);
    });

    /* Cómo se reparten las 102 vivas. Medido en reglas §C.7: son 53 sin
       ninguna etapa asignada ("Pendiente" / "Sin Asignar"). Las otras 49 se
       reparten en cinco etapas; Desarme, Pintura, Mecánica y Entrega no
       tienen ningún vehículo en este momento, y eso también se copia. */
    const REPARTO = [
      { etapa: null,    n: SIN_ETAPA },
      { etapa: 'et-2',  n: 12 },   // Desabolladura
      { etapa: 'et-5',  n: 11 },   // Armado
      { etapa: 'et-3',  n: 11 },   // Preparación
      { etapa: 'et-8',  n: 8 },    // Control de Calidad
      { etapa: 'et-7',  n: 7 }     // Terminación
    ];
    const plan = [];
    REPARTO.forEach((r) => { for (let i = 0; i < r.n; i++) plan.push(r.etapa); });

    /* Reparto de compañía y tipo de ingreso, medido en reglas §C.25:
       78 por compañía (74 SURA + 4 MAPFRE), 23 empresa, 1 particular.
       Las 24 sin compañía son exactamente las de empresa y particular. */
    const planTipo = [];
    for (let i = 0; i < 74; i++) planTipo.push({ tipo: 'ti-1', comp: 'co-1' });
    for (let i = 0; i < 4; i++)  planTipo.push({ tipo: 'ti-1', comp: 'co-2' });
    for (let i = 0; i < 23; i++) planTipo.push({ tipo: 'ti-3', comp: null });
    planTipo.push({ tipo: 'ti-2', comp: null });

    /* 🔶 EL CLIENTE TIENE UN SOLO CAMPO DE NOMBRE (15-08-2026, pedido del
       cliente). El apellido se conserva en el modelo de PERSONAL —al trabajador
       se le paga y se le emite, y ahí el apellido es un dato propio— pero al
       cliente se le escribe el nombre completo en una sola casilla, que es como
       llega: de la cédula o de la póliza, de corrido. Dos casillas invitaban a
       repartirlo mal —"de la Fuente" cae en cualquiera de las dos— y después
       ningún listado ordenaba igual. */
    function nuevoCliente(i) {
      const id = 'pe-c-' + i;
      /* 🔴 EL GENERADOR DE NOMBRES REPETÍA. `(i × 3) mod 24` sólo recorre ocho
         de los veinticuatro nombres —3 y 24 comparten divisores—, así que la
         pareja nombre+apellido volvía a salir cada 24 clientes: con 222
         órdenes había NUEVE personas distintas llamadas igual.

         En pantalla eso se veía en la Reportería: «Clientes con más vehículos»
         mostraba diez clientes con cinco órdenes cada uno, las diez barras del
         mismo largo. No era el ranking: eran homónimos sumados.

         Ahora el segundo apellido lleva la tanda, así que dos clientes sólo
         podrían llamarse igual pasando los 576 — bastante más allá de lo que
         siembra la demostración. */
      const n1 = (i * 5) % NOM.length;
      const a1 = (i * 7) % APE.length;
      const a2 = (i * 7 + 1 + Math.floor(i / APE.length)) % APE.length;
      persona.push({
        id, tipo: 'cliente', ficha: null, rut: rutFalso(2000 + i),
        nombres: NOM[n1] + ' ' + APE[a1] + ' ' + APE[a2],
        correo: 'cliente' + i + '@ejemplo.cl', telefono: '+56 9 1111 ' + String(1000 + i).slice(-4),
        direccion: 'Dirección de ejemplo ' + (200 + i), comuna: 'Comuna de ejemplo',
        activo: true, demo: true
      });
      return id;
    }

    /* ── Las cuentas de flota ──────────────────────────────────────────────
       Un taller no atiende a 222 personas distintas y cada una una sola vez:
       hay arriendos, empresas y taxis que traen varios autos al año, y ésos
       son justamente los clientes que importan en un ranking y en una
       negociación de tarifa. Sin ellos la lista de «clientes con más
       vehículos» es una lista de gente con un auto.

       Nombres inventados y rotulados «de ejemplo», igual que el resto de la
       demostración: acá no entra ningún dato de un cliente real de DyP. */
    const FLOTA = ['Rent a Car de ejemplo SpA', 'Transportes de ejemplo Ltda',
      'Flota Corporativa de ejemplo', 'Arriendos del Valle de ejemplo SpA',
      'Servicios Generales de ejemplo Ltda', 'Logística de ejemplo SpA']
      .map((nombre, k) => {
        const id = 'pe-c-flota-' + (k + 1);
        persona.push({
          id, tipo: 'cliente', ficha: null, rut: rutFalso(7700 + k), nombres: nombre,
          correo: 'flota' + (k + 1) + '@ejemplo.cl',
          telefono: '+56 2 2222 ' + String(1000 + k).slice(-4),
          direccion: 'Dirección de ejemplo ' + (700 + k), comuna: 'Comuna de ejemplo',
          activo: true, demo: true
        });
        return id;
      });
    // El reparto entre las seis no es parejo: la primera se lleva cinco de
    // cada catorce y la última una. Así se ven estas carteras.
    const REPARTO_FLOTA = [0, 0, 0, 1, 1, 2, 3, 0, 1, 4, 2, 5, 0, 1];

    /* Crea una orden completa: vehículo, recepción, OT, estadías, etapas,
       presupuesto, repuestos, bitácora y eventos. */
    function crearOrden(idx, { viva, etapaActual, tipo, comp, fuera, conRepPend }) {
      const numero_ot = nOT++;
      const ot_id = 'ot-' + numero_ot;
      const pat = PATENTES[idx % PATENTES.length];
      const ma = marca[BOLSA_MARCA[idx % BOLSA_MARCA.length]];
      const mos = modelo.filter((m) => m.marca_id === ma.id);

      const veh_id = 'veh-' + numero_ot;
      vehiculo.push({
        id: veh_id, patente: pat, marca_id: ma.id,
        modelo_id: mos.length
          ? mos[PATRON_MODELO[idx % PATRON_MODELO.length] % mos.length].id : null,
        anio: 2015 + (idx % 11), color_id: color_vehiculo[idx % color_vehiculo.length].id,
        /* 17 caracteres, que es lo que exige la norma y lo que exige el propio
           formulario de ingreso. Decía `VIN-DEMO-23278` —catorce— y el sistema
           quedaba pidiendo en la recepción algo que sus propios datos no
           cumplían. Sin I, O ni Q, que un VIN real tampoco usa. */
        vin: ('VDYPDEM' + numero_ot).padEnd(17, '0')
      });

      // Una de cada seis órdenes es de una flota; el resto, de un particular
      // distinto cada vez.
      const cli_id = idx % 6 === 3
        ? FLOTA[REPARTO_FLOTA[Math.floor(idx / 6) % REPARTO_FLOTA.length]]
        : nuevoCliente(idx);
      /* Distribución sesgada: la mayoría de las órdenes vivas son recientes y
         hay una cola de casos antiguos. En el sistema real la columna `Días`
         va de 1 a 82 con promedio 18 — pero ese contador está roto y se
         reinicia al regrabar el estado, así que lo que se replica es la FORMA
         de la distribución, no el número. Un reparto plano daba promedios de
         60 días y dejaba 79 de 92 vehículos sobre la meta: irreal. */
      const s = rnd();
      const diasIngreso = viva
        ? (s < 0.62 ? entre(1, 22) : s < 0.86 ? entre(23, 55) : entre(56, 130))
        : entre(20, 210);
      const fecha_ingreso = diasHora(diasIngreso);

      /* Una recepción puede generar VARIAS órdenes. A-8: en el formulario de
         ingreso los campos son arreglos con botón +. Acá una de cada doce
         trae dos siniestros, para que el caso exista en la demostración. */
      const rec_id = 'rec-' + numero_ot;
      recepcion.push({
        id: rec_id, vehiculo_id: veh_id, cliente_id: cli_id, fecha: fecha_ingreso,
        km: entre(15, 220) * 1000, combustible: entre(0, 8),
        observaciones: '', firma_media_id: null, recibido_por: 'pe-u-recepcion'
      });
      /* Un solo `rnd()` por ítem, igual que cuando era un booleano: la semilla
         es determinista y cambiar la CANTIDAD de tiradas corre toda la
         secuencia siguiente y descuadra las cifras de control. */
      inventario_item.forEach((it) => {
        const s = rnd();
        recepcion_inventario.push({
          recepcion_id: rec_id, item_id: it.id, observacion: '',
          estado: s < 0.74 ? 'presente' : s < 0.86 ? 'no_presente'
                : s < 0.94 ? 'danado' : 'sin_verificar'
        });
      });
      // Los daños son del vehículo al ingresar, así que cuelgan de la
      // recepción: si el auto trae dos siniestros, la silueta es una sola.
      const nD = entre(1, 4);
      for (let d = 0; d < nD; d++) dano.push({
        id: 'da-' + numero_ot + '-' + d, recepcion_id: rec_id, vista: 'superior',
        zona_id: zona_dano[entre(0, zona_dano.length - 1)].id,
        tipo_id: tipo_dano[entre(0, tipo_dano.length - 1)].id,
        severidad: entre(1, 3), x: rnd(), y: rnd(), descripcion: ''
      });

      const estadoCod = !viva ? (rnd() > 0.06 ? 'entrega_cliente' : 'entrega_sin_rep')
                              : (fuera ? 'fuera_taller' : 'recibido');
      // Con hora, igual que el ingreso: un taller entrega varios autos el mismo
      // día y el orden importa cuando hay un reclamo.
      /* El día de la entrega se guarda también como NÚMERO —cuántos días
         atrás—, porque lo necesita el reparto de las etapas más abajo: sin él
         habría que deducirlo de la fecha y las dos cuentas podrían separarse.
         El sorteo es el mismo de siempre y en el mismo orden: la base sembrada
         no cambia en nada más que en las fechas de las etapas. */
      const diasEntrega = viva ? null : entre(1, diasIngreso - 1);
      const fecha_entrega_real = viva ? null : diasHora(diasEntrega);

      /* El deducible de la póliza. Se calcula ANTES de la orden porque el
         presupuesto lo resta del neto, y así los dos leen el mismo número. */
      const deducibleOT = comp ? entre(0, 8) * 25000 : 0;

      orden_trabajo.push({
        id: ot_id, numero_ot, recepcion_id: rec_id, vehiculo_id: veh_id, cliente_id: cli_id,
        tipo_ingreso_id: tipo, compania_id: comp,
        siniestro: comp ? 'SIN-' + numero_ot : null,
        deducible: deducibleOT,
        liquidador: comp ? NOM[idx % NOM.length] + ' ' + APE[idx % APE.length] : null,
        prioridad_id: rnd() > 0.88 ? 'pri-2' : 'pri-1',
        /* El compromiso lleva hora igual que el ingreso: la columna Fecha de
           Entrega la muestra, y sin hora quedaba en 00:00 — una hora que nadie
           comprometió y que además hace inútil ordenar por esa columna cuando
           hay varios autos citados el mismo día. */
        fecha_ingreso, fecha_compromiso: diasHora(diasIngreso - entre(15, 25)),
        fecha_entrega_real, estado: estadoCod,
        /* Quién responde por el vehículo completo: recepción o jefe de taller,
           que son los dos que pueden presupuestarlo y hacerlo avanzar. Antes
           entraba bodega en el reparto y quedaba con 26 autos "a mi cargo",
           que no es lo que hace bodega. Una de cada cuatro queda SIN
           responsable: son las que hay que asignar, y sin ellas la pantalla
           del jefe no tendría nada pendiente que mostrar. */
        responsable_id: idx % 4 === 0 ? null : ['pe-t-1', 'pe-t-2'][idx % 2],
        observaciones_ingreso: '', demo: true
      });

      /* ── Las estadías. Es la tabla que arregla el contador de días ──────
         Una de cada cinco órdenes vivas ya salió y volvió: eso es lo que en
         el sistema actual borraba el reloj y acá queda como dos filas con
         fecha. Con esto los tres relojes dan números distintos y se puede
         mostrar la diferencia en pantalla.

         🔶 Y UNA DE CADA CUATRO ENTREGADAS TAMBIÉN (19-08-2026). Faltaban, y
         se notó al armar la Reportería: como el histórico no tenía NI UNA
         orden que se hubiera ido y vuelto, «días totales» y «días de
         reparación» daban exactamente el mismo número, y el gráfico de los
         tres relojes salía plano — la corrección central del sistema, la que
         justifica el proyecto, quedaba invisible justo en el panel que se le
         muestra al dueño. */
      const volvioYSeEntrego = !viva && idx % 4 === 1 && (diasIngreso - diasEntrega) >= 14;
      const salioYVolvio = viva && !fuera && idx % 5 === 0 && diasIngreso > 30;
      if (volvioYSeEntrego) {
        /* Entró, se hizo el desarme, se lo llevó el cliente mientras llegaban
           las piezas, volvió y se entregó. En el sistema actual esta orden
           aparece con el contador partiendo desde que volvió: el mes que el
           auto estuvo afuera desaparece de la estadística y el taller queda
           mejor de lo que es. Acá quedan las dos estadías con fecha. */
        const span = diasIngreso - diasEntrega;
        const afuera = Math.max(3, Math.round(span * (0.20 + (idx % 5) * 0.05)));
        const dentro1 = Math.max(2, Math.round((span - afuera) * 0.45));
        const salida1 = diasIngreso - dentro1;
        const regreso = salida1 - afuera;
        ot_estadia.push({ id: 'est-' + numero_ot + '-1', ot_id, entro_at: fecha_ingreso,
          salio_at: diasHora(salida1), motivo_salida: 'espera_repuesto' });
        ot_estadia.push({ id: 'est-' + numero_ot + '-2', ot_id,
          entro_at: diasHora(regreso), salio_at: fecha_entrega_real, motivo_salida: null });
      } else if (salioYVolvio) {
        // Inspección corta, se lo lleva el cliente mientras llegan las piezas,
        // y vuelve. Totales grandes con reparación chica: es EXACTAMENTE el
        // caso que el contador del sistema actual no sabe contar.
        const dentro1 = entre(4, 10);
        const actual = entre(2, 12);
        ot_estadia.push({ id: 'est-' + numero_ot + '-1', ot_id, entro_at: fecha_ingreso,
          salio_at: diasHora(diasIngreso - dentro1), motivo_salida: 'espera_repuesto' });
        ot_estadia.push({ id: 'est-' + numero_ot + '-2', ot_id,
          entro_at: diasHora(actual), salio_at: null, motivo_salida: null });
      } else if (fuera) {
        const dentro1 = Math.min(entre(3, 10), Math.max(1, diasIngreso - 1));
        ot_estadia.push({ id: 'est-' + numero_ot + '-1', ot_id, entro_at: fecha_ingreso,
          salio_at: diasHora(diasIngreso - dentro1), motivo_salida: 'espera_repuesto' });
      } else {
        ot_estadia.push({ id: 'est-' + numero_ot + '-1', ot_id, entro_at: fecha_ingreso,
          salio_at: viva ? null : fecha_entrega_real, motivo_salida: null });
      }

      evento.push({ id: 'ev-' + (++seqEv), ot_id, fecha: fecha_ingreso, tipo: 'estado',
        detalle: 'Ingreso del vehículo. Estado: Recibido', etapa_id: null, persona_id: 'pe-u-recepcion' });

      /* Etapas asignadas. 53 órdenes no tienen ninguna: esas van a la
         pantalla de asignar, las demás a la de finalizar.
         El responsable de cada etapa cerrada sale del grupo de trabajadores
         habilitados para ESA etapa — que es el único modelo de permisos que
         el sistema actual tiene de verdad. Sin esto la nómina sale vacía. */
      if (etapaActual) {
        const hasta = etapa.find((e) => e.id === etapaActual).orden;
        const suyas = etapa.filter((e) => e.orden <= hasta && e.aplica_siempre);
        const cerradas = suyas.filter((e) => e.orden < hasta);

        /* ── EL REPARTO DE LA VENTANA ────────────────────────────────────
           Las etapas ya no cierran cada dos días: se reparten el tiempo que
           el vehículo estuvo de verdad, pesadas por `PESO_ETAPA`.

           Todo se cuenta en «días atrás», que es como se guardan las fechas
           acá: número más grande = más antiguo. La ventana va desde el día
           siguiente al ingreso —cuando se asignan— hasta un día antes de la
           salida. En una orden viva termina donde empieza la etapa que está
           abierta ahora, que lleva entre uno y cinco días corriendo.

           La variación sale del índice de la orden, NO de un sorteo: agregar
           un `entre()` acá correría toda la secuencia del generador y
           cambiaría datos que no tienen nada que ver con las etapas.

           Lo que hay que conservar si esto se vuelve a tocar: los días de las
           etapas SUMAN los días de la orden. Un gráfico donde las partes no
           suman el total hace más daño que no tenerlo. */
        const arranque = Math.max(1, diasIngreso - 1);
        const fin = viva
          ? Math.max(0, Math.min(arranque - 1, 1 + (idx % 5)))
          : Math.max(0, Math.min(arranque - 1, diasEntrega + 1));
        const ventana = Math.max(0.5, arranque - fin);
        const pesos = cerradas.map((e, k) =>
          (PESO_ETAPA[e.codigo] || 1) * (0.75 + ((idx * 7 + k * 11) % 55) / 100));
        const sumaPesos = pesos.reduce((s, p) => s + p, 0) || 1;

        /* 🔴 EL REPARTO SE HACE CON DECIMALES, NO CON DÍAS ENTEROS.

           Primera versión: se redondeaba el cierre de cada etapa al día. En
           una orden corta —una semana con siete etapas— dos etapas seguidas
           caían el MISMO día, y como `diasHora` le pone a cada fecha una hora
           al azar entre las 8 y las 18, la segunda quedaba a las 09:14 y la
           primera a las 15:40: la etapa cerraba antes de asignarse. Cuarenta y
           siete etapas quedaron así, con días negativos que se colaban al
           promedio del gráfico sin que nada se viera roto.

           La cifra de control «Etapas que se cerraron antes de asignarse» lo
           cachó. Ahora el reparto va en decimales y la hora del día SALE del
           decimal: dos etapas del mismo día quedan a horas distintas y en el
           orden correcto, sin sorteo de por medio.

           Cada etapa queda además con su ventana propia —`desde` es el cierre
           de la anterior—, así el tiempo de una etapa se lee directo, restando
           dos fechas, sin reconstruir ninguna cadena. */
        const fechaTramo = (diasAtras) => {
          const enteros = Math.max(0, Math.floor(diasAtras));
          const resto = Math.min(0.999, Math.max(0, diasAtras - enteros));
          const d = dias(enteros);
          /* «Días atrás» corre al revés del reloj: más decimal = más antiguo
             dentro del día, así que la hora va al revés del decimal. La jornada
             va de 08:00 a 17:59, igual que el resto de las fechas del sistema. */
          const minutos = Math.round((1 - resto) * 599);
          d.setHours(8 + Math.floor(minutos / 60), minutos % 60, 0, 0);
          return d;
        };

        const tramo = new Map();
        let corrido = 0, previo = arranque;
        suyas.forEach((e, k) => {
          if (e.orden >= hasta) { tramo.set(e.id, { desde: previo, hasta: null }); return; }
          corrido += pesos[k];
          // Estrictamente decreciente: todos los pesos son mayores que cero.
          const d = arranque - ventana * (corrido / sumaPesos);
          tramo.set(e.id, { desde: previo, hasta: d });
          previo = d;
        });

        suyas.forEach((e) => {
          const cerrada = e.orden < hasta;
          const gente = habilitados[e.id] || [];
          const resp = gente.length ? gente[(idx + e.orden) % gente.length] : null;
          const t = tramo.get(e.id);
          const cuando = fechaTramo(cerrada ? t.hasta : fin);
          /* Una etapa CERRADA siempre tiene responsable: alguien la hizo. Una
             abierta, no necesariamente — el auto está en pintura y todavía
             nadie lo agarró. Ese es el estado que la pantalla "Mi trabajo"
             ofrece para tomar, y si la semilla dejara todas asignadas no
             habría nada que mostrar. Dos de cada tres abiertas quedan libres. */
          const suelta = !cerrada && (idx + e.orden) % 3 !== 0;
          ot_etapa.push({
            id: 'oe-' + numero_ot + '-' + e.orden, ot_id, etapa_id: e.id,
            asignada_at: fechaTramo(t.desde),
            salio_at: cerrada ? cuando : null,
            persona_id: suelta ? null : resp, observacion: ''
          });
          if (cerrada) evento.push({ id: 'ev-' + (++seqEv), ot_id,
            fecha: cuando, tipo: 'etapa',
            detalle: 'Completado', etapa_id: e.id, persona_id: resp });
        });
      }

      /* Costos adicionales: aparecen después del presupuesto y alguien los
         paga. Una de cada seis órdenes trae uno, para que la pantalla tenga
         qué mostrar. */
      if (idx % 6 === 0) costo_adicional.push({
        id: 'ca-' + numero_ot, ot_id,
        descripcion: elegir(['Flete de repuesto', 'Pulido adicional', 'Insumos de pintura',
          'Grúa', 'Traslado a tercero']),
        monto: entre(8, 90) * 1000,
        responsable_pago_id: rnd() > 0.5 ? 'rp-2' : 'rp-1', fecha: diasHora(Math.max(1, diasIngreso - 3))
      });

      /* Una de cada ocho órdenes vivas todavía no tiene presupuesto: el auto
         entró y nadie lo ha valorizado. Es un caso real y es lo que hace útil
         el indicador de "sin presupuesto" — esas son órdenes que el taller
         **no puede cobrar todavía**.

         Se excluyen las que tienen que mostrar un repuesto pendiente: sin OR
         no hay presupuesto, sin presupuesto no hay línea de cambio y sin línea
         de cambio no hay repuesto que pedir. Antes no se excluían y quedaban
         ocho autos sin OR con repuestos pendientes — Marco lo cachó el
         16-08-2026 mirando la demostración, y tenía razón. */
      const sinPresupuesto = viva && idx % 8 === 3 && !conRepPend;

      /* Presupuesto con OR compuesta: <OT>-<id_reparacion>-<NNN>. */
      const id_reparacion = 18000 + (numero_ot % 900);
      const pid = 'pr-' + (++seqPre);
      const nL = sinPresupuesto ? 0 : entre(2, 6);
      const PIEZAS = ['Paragolpes delantero', 'Tapabarro izquierdo', 'Foco delantero derecho',
        'Puerta trasera izquierda', 'Capó', 'Espejo lateral derecho', 'Parabrisas',
        'Maletero', 'Rejilla frontal', 'Moldura lateral'];
      const cent = (a, b) => entre(a, b) / 100;
      let orden = 0;

      /* ── Bloque 1 · Mano de Obra ─────────────────────────────────────
         La OP clasifica el trabajo y nada más: cambiar la pieza, repararla o
         mandarla afuera. Las horas van en centésimas, como en el documento
         real (1,78 · 4,16 · 6,24). Cambiar es desmontar y montar; reparar
         lleva su tiempo y casi siempre también de pintura —una puerta que se
         repara hay que pintarla—; externo no lleva horas porque el trabajo lo
         hace un tercero y se cobra su factura. */
      for (let l = 0; l < nL; l++) {
        const proceso = elegir(['cambio', 'reparar', 'externo']);
        presupuesto_linea.push({
          id: pid + '-l' + (++orden), presupuesto_id: pid, orden,
          bloque: 'mano_obra', proceso,
          descripcion: elegir(PIEZAS),
          horas_dm:   proceso === 'cambio'  ? cent(20, 200) : 0,
          horas_rep:  proceso === 'reparar' ? cent(100, 700) : 0,
          horas_pint: proceso === 'reparar' && rnd() > 0.25 ? cent(100, 950) : 0,
          codigo: '', cantidad: 1, proveedor: '', precio_unitario: 0
        });
      }

      /* ── Bloque 2 · Repuestos ────────────────────────────────────────
         Tabla APARTE, escrita a mano. No sale de las líneas de mano de obra:
         se pide una pieza porque hay que comprarla, no porque alguien
         clasificó un trabajo. El proveedor decide si se cobra — dos de cada
         tres las pone la compañía—, y va escrito ya normalizado: en el
         original la misma DYP aparece de cuatro formas. */
      const lineasCambio = [];
      const nRep = sinPresupuesto ? 0 : entre(0, 3);
      for (let r = 0; r < nRep; r++) {
        const fila = {
          id: pid + '-l' + (++orden), presupuesto_id: pid, orden,
          bloque: 'repuesto', proceso: 'cambio',
          descripcion: elegir(PIEZAS),
          horas_dm: 0, horas_rep: 0, horas_pint: 0,
          codigo: '', cantidad: 1,
          proveedor: rnd() > 0.66 ? 'DYP' : (comp ? 'SURA' : 'Particular'),
          precio_unitario: entre(12, 380) * 1000
        };
        presupuesto_linea.push(fila);
        lineasCambio.push(fila);
      }

      /* ── Bloque 3 · Externos ─────────────────────────────────────────
         Igual: tabla propia y a mano. Lleva precio y no horas. */
      const nExt = sinPresupuesto ? 0 : (rnd() > 0.72 ? entre(1, 2) : 0);
      for (let e = 0; e < nExt; e++) {
        presupuesto_linea.push({
          id: pid + '-l' + (++orden), presupuesto_id: pid, orden,
          bloque: 'externo', proceso: 'externo',
          descripcion: elegir(['Montaje y balanceo', 'Alineación', 'Tapizado de asiento',
            'Pulido de óptico', 'Grabado de patente']),
          horas_dm: 0, horas_rep: 0, horas_pint: 0,
          codigo: '', cantidad: 1,
          proveedor: elegir(['Vidriería Central', 'Tapicería Norte', 'Alineación Sur']),
          precio_unitario: entre(8, 60) * 1000
        });
      }

      /* Estado del presupuesto, con sus fechas. Se sortea siempre —aunque
         después se fuerce— para no correr la secuencia del generador: la
         semilla es determinista y una tirada de más descuadra todo lo que
         viene detrás. Las que deben mostrar un repuesto pendiente quedan
         aprobadas, porque es la aprobación la que autoriza el pedido. */
      let estadoPre = viva ? elegir(['borrador', 'enviado', 'aprobado']) : 'aprobado';
      if (conRepPend) estadoPre = 'aprobado';
      /* Si la orden tiene que mostrar un repuesto pendiente y el sorteo no le
         dio ninguna fila en Repuestos, se le agrega una: sin pieza que
         comprar no hay repuesto que pueda estar pendiente. */
      if (conRepPend && !lineasCambio.length && !sinPresupuesto) {
        const fila = {
          id: pid + '-l' + (++orden), presupuesto_id: pid, orden,
          bloque: 'repuesto', proceso: 'cambio',
          descripcion: elegir(PIEZAS),
          horas_dm: 0, horas_rep: 0, horas_pint: 0,
          codigo: '', cantidad: 1,
          proveedor: rnd() > 0.66 ? 'DYP' : (comp ? 'SURA' : 'Particular'),
          precio_unitario: entre(12, 380) * 1000
        };
        presupuesto_linea.push(fila);
        lineasCambio.push(fila);
      }

      // Enviado unos días después de entrar; respondido después de enviado.
      const diasEnvio = Math.max(0, diasIngreso - entre(1, 3));
      const diasResp  = Math.max(0, diasEnvio - entre(1, 5));

      /* Los totales con la MISMA fórmula del motor: horas × tempario en las
         tres columnas, más los repuestos que puso el taller, más los
         externos, menos el deducible. Calcularlos aparte acá era la puerta
         para que la demostración mostrara un número y la pantalla otro. */
      const tempario = 10000;
      const tot = Reglas.totalesPresupuesto(
        presupuesto_linea.filter((l) => l.presupuesto_id === pid),
        tempario, deducibleOT, 19);
      if (sinPresupuesto) { seqPre--; } else
      presupuesto.push({
        id: pid, ot_id, id_reparacion, correlativo: 1,
        numero_or: Reglas.formatoOR(numero_ot, id_reparacion),
        version: 1, estado: estadoPre, tempario, observacion: '',
        neto: tot.neto, iva: tot.iva, total: tot.total,
        // Un borrador no se ha mandado y un enviado no tiene respuesta: las
        // fechas siguen al estado en vez de quedar las tres en nulo.
        enviado_at: estadoPre === 'borrador' ? null : diasHora(diasEnvio),
        resuelto_at: estadoPre === 'aprobado' ? diasHora(diasResp) : null
      });

      /* ── Repuestos ──────────────────────────────────────────────────────
         NACEN del presupuesto. Cada línea de proceso `cambio` es una pieza
         que hay que comprar, y es la aprobación de la OR la que autoriza el
         pedido: exactamente lo que hace `generar_repuestos_desde_presupuesto`
         cuando el evaluador aprueba. La semilla los inventaba sueltos —239 sin
         línea que los originara— y el modelo terminaba contradiciendo su
         propia regla en la pantalla donde se muestra.

         Los dos hitos van como FECHAS, no como booleanos: es la corrección que
         permite medir cuánto demora un repuesto — con los booleanos del
         original eso no se puede calcular. §C.14. */
      /* La pieza nace CUANDO SE ESCRIBE en el presupuesto, no cuando la OR
         se aprueba: es la regla que fijo Marco el 16-08-2026. Por eso acá
         ya no se pregunta por el estado — un borrador con una línea de
         Cambio tiene su repuesto pedido igual, y bodega lo ve. Las que
         están fuera de las 41 marcadas llegan todas, así que la cifra de
         control «con repuesto pendiente» no se mueve. */
      if (!sinPresupuesto) {
        lineasCambio.forEach((linea, r) => {
          // La primera de una orden marcada queda pendiente a propósito: son
          // las 41 de la tarjeta "con repuesto pendiente".
          const llego = conRepPend ? (r > 0 && rnd() > 0.5) : true;
          const dPedido = Math.max(0, diasResp);
          const dBodega = Math.max(0, dPedido - entre(2, 15));
          const dArea   = Math.max(0, dBodega - entre(1, 6));
          repuesto.push({
            id: 'rep-' + (++seqRep), ot_id, presupuesto_linea_id: linea.id,
            // La descripción es la de la línea: es la MISMA pieza, no otra.
            descripcion: linea.descripcion,
            /* El código, el proveedor y el precio BAJAN de la línea: es lo
               que el evaluador escribió en el bloque Repuestos y lo que
               bodega tiene que ver sin volver a teclearlo. Y quién paga sale
               del proveedor, no de un sorteo: si la pieza la puso la
               compañía, el taller no la desembolsó. */
            cantidad: linea.cantidad,
            codigo_interno: '', codigo_externo: '',
            proveedor: linea.proveedor, precio_unitario: linea.precio_unitario,
            responsable_pago_id: Reglas.esProveedorTaller(linea.proveedor) ? 'rp-2' : 'rp-1',
            fecha_solicitud: diasHora(dPedido),
            fecha_bodega: llego ? diasHora(dBodega) : null,
            fecha_entrega_area: llego && rnd() > 0.4 ? diasHora(dArea) : null,
            observacion: '', recibido_por: llego ? 'pe-u-bodega' : null
          });
        });
      }

      /* Bitácora: es lo que enciende las banderas de la columna Alerta.
         La distribución copia la medida sobre las 102 órdenes: E 91, A 81,
         O 72, R 3, C 1, P 0. §C.16. */
      const asuntos = [];
      if (rnd() < 0.90) asuntos.push('as-1');   // Envio
      if (rnd() < 0.80) asuntos.push('as-2');   // Autorizado
      if (rnd() < 0.71) asuntos.push('as-3');   // Otro
      if (rnd() < 0.03) asuntos.push('as-4');   // Repuestos
      if (rnd() < 0.01) asuntos.push('as-5');   // Correcciones
      asuntos.forEach((a) => bitacora.push({
        id: 'bit-' + (++seqBit), ot_id, asunto_id: a, mensaje: 'Mensaje de demostración.',
        destinatario_id: 'pe-u-admin', autor_id: 'pe-u-recepcion',
        fecha: diasHora(Math.max(1, diasIngreso - entre(1, 5))), alerta_apagada: false
      }));

      return ot_id;
    }

    // Las 102 vivas.
    const fueraIdx = new Set();
    while (fueraIdx.size < FUERA_DE_TALLER) fueraIdx.add(entre(0, TOTAL_TORRE - 1));
    const repIdx = new Set();
    while (repIdx.size < CON_REPUESTO_PENDIENTE) repIdx.add(entre(0, TOTAL_TORRE - 1));

    for (let i = 0; i < TOTAL_TORRE; i++) {
      crearOrden(i, {
        viva: true, etapaActual: plan[i],
        tipo: planTipo[i].tipo, comp: planTipo[i].comp,
        fuera: fueraIdx.has(i), conRepPend: repIdx.has(i)
      });
    }

    // El histórico.
    for (let i = 0; i < TOTAL_HISTORICO; i++) {
      crearOrden(TOTAL_TORRE + i, {
        viva: false, etapaActual: 'et-9',
        tipo: i % 5 === 0 ? 'ti-3' : 'ti-1', comp: i % 5 === 0 ? null : 'co-1',
        fuera: false, conRepPend: false
      });
    }

    return {
      // catálogos
      etapa, etapa_prerrequisito, estado, compania, tipo_ingreso, prioridad,
      asunto_bitacora, responsable_pago, motivo_detencion,
      color_vehiculo, marca, modelo, inventario_item, tipo_dano, zona_dano,
      // acceso
      rol, permiso, rol_permiso, persona, persona_rol, persona_etapa,
      // parámetros
      parametro,
      // operación
      vehiculo, recepcion, recepcion_inventario, dano, orden_trabajo,
      // Las correcciones de una recepción ya guardada. Nace vacía: la semilla
      // no inventa correcciones, y una recepción sin correcciones es la
      // versión 1. Ver `corregir_recepcion` en el modelo.
      recepcion_correccion: [],
      ot_etapa, ot_estadia, ot_detencion, costo_adicional,
      presupuesto, presupuesto_linea, repuesto, bitacora, media, evento, aviso,
      // idempotencia
      operacion: []
    };
  }

  /* ── EL SELLO DE LA SEMILLA ────────────────────────────────────────────
     🔴 EL PROBLEMA QUE ESTO RESUELVE (18-08-2026). Marco: "no estoy viendo los
     cambios realizados". Y no los estaba viendo: su Personal mostraba SIETE
     cuentas —las de antes— cuando el sistema ya traía diecinueve. Lo publicado
     estaba bien; lo que fallaba es que el navegador guarda la base de datos de
     la demostración y, una vez guardada, se queda con ella.

     Ya había un detector de "base vieja", pero comprobaba cosas puntuales
     escritas a mano: que no falte un permiso, que la OR no traiga el formato
     antiguo. Cada cambio de esquema exige acordarse de agregarle una
     comprobación nueva, y con las cuentas del cliente nadie se acordó — que es
     exactamente lo que va a volver a pasar la próxima vez.

     El sello lo hace solo: es una huella de la FORMA de los datos —cuántas
     cuentas, con qué usuario, a qué módulos entran, cuántos permisos, cuántas
     órdenes—. Si algo de eso cambia, el sello cambia, y la base guardada se
     descarta sin que nadie tenga que anotarlo en ninguna parte.

     No reemplaza a `baseVieja`: se suma. Aquélla explica QUÉ falta y sirve
     para leer el aviso; ésta se da cuenta SIEMPRE. */
  const SELLO = (function () {
    const equipo = EQUIPO_SELLO.map((x) => (x.usuario || x.nombre) + '>' +
      (x.modulos ? x.modulos.join('+') : 'rol')).join(',');
    const crudo = [EQUIPO_DEMO, CATALOGO_PERMISOS.length, TOTAL_TORRE, TOTAL_HISTORICO,
      ULTIMA_OT, INVENTARIO_ESTADOS.length, FORMA_DATOS, equipo].join('|');
    // Huella corta y estable. No es criptografía: es para notar un cambio.
    let h = 5381;
    for (let i = 0; i < crudo.length; i++) h = ((h * 33) ^ crudo.charCodeAt(i)) >>> 0;
    return 's' + h.toString(36) + '-' + EQUIPO_DEMO;
  })();

  return {
    generar, CATALOGO_PERMISOS, INVENTARIO_ESTADOS, INVENTARIO_POR_OMISION, SELLO,
    TOTAL_TORRE, CON_REPUESTO_PENDIENTE, FUERA_DE_TALLER, SIN_ETAPA,
    TRABAJADORES, EQUIPO_DEMO, TOTAL_HISTORICO, ULTIMA_OT
  };
})();
