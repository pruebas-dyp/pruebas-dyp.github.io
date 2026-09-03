/* LA BASE — los doce años de historia, en Firestore.

   Hasta hoy el sistema vivía entero en el navegador: `Semilla.generar()` armaba
   datos de demostración y `localStorage` los guardaba. Desde acá los datos son
   los DE VERDAD y viven en Firestore, en el proyecto `dyp-control-taller` —el
   mismo del sitio y del bucket de fotos, y la misma región, Santiago.

   Detalle y decisiones: 00 Documentacion/DECISIONES.md · js/base.js */

const Base = (function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════════════════
     🔴 POR QUÉ NO SE BAJA TODO. LA DECISIÓN QUE ORDENA ESTE ARCHIVO.

     En Firestore hay 1.541.725 documentos y unos 330 MB. Eso no cabe en un
     navegador, y aunque cupiera no habría que hacerlo: bajarlo entero costaría
     1,5 millones de lecturas CADA VEZ que alguien abre el sistema —unos USD
     0,90 por apertura— y el teléfono del taller se quedaría sin memoria antes
     de terminar.

     Pero medido contra la data real: el taller trabaja con 92 unidades activas,
     y todo lo que cuelga de ellas son 10.161 documentos y 2,1 MB. Es el 0,7 %.
     Los otros 1.531.564 son historia que se consulta de vez en cuando, no
     todos los días.

     De ahí las dos velocidades de este archivo:

       · EL CONJUNTO DE TRABAJO se baja entero al arrancar y vive en memoria,
         igual que vivía la semilla. Todo el sistema —las vistas, la torre, el
         presupuesto— sigue leyendo del mismo `db` de siempre y no se entera de
         que cambió de dónde viene. Eso es lo que permite conectar 17.000 líneas
         sin reescribirlas.

       · LA HISTORIA se pregunta cuando alguien la pide: el Histórico busca en
         Firestore, y una orden vieja se baja completa recién cuando se abre.
     ═══════════════════════════════════════════════════════════════════════ */

  const PROYECTO = 'dyp-control-taller';
  const RECURSO  = 'projects/' + PROYECTO + '/databases/(default)/documents';
  const API      = 'https://firestore.googleapis.com/v1/';

  /* Los estados en que una orden está VIVA. Sale del catálogo del modelo, no de
     una lista escrita a mano: `es_final` marca los que ya terminaron. Se deja
     acá y no en la consulta porque Firestore no sabe leer el catálogo. */
  const VIVAS = ['recibido', 'fuera_taller', 'pt_espera'];

  /* Firestore acepta hasta 30 valores en un `IN`. Los cruces se hacen por
     tandas de a 30 y se juntan los resultados. */
  const POR_TANDA = 30;

  /* Escribir: hasta 500 operaciones por lote; se usan 400 para dejar aire bajo
     el techo de 10 MB del cuerpo. Igual que el cargador del ETL. */
  const POR_LOTE = 400;

  /* Sin tope, una conexión mala deja la pantalla en «Cargando…» para siempre.
     En el taller eso se ve como que el sistema se colgó. */
  const TOPE = 45000;

  /* 🔴 EL INTERRUPTOR DE TODO ESTO.

     `true`  → el sistema arranca contra Firestore y muestra la data real.
     `false` → vuelve a la demostración de la semilla, sin tocar la nube.

     Existe para poder VOLVER. Si algo falla en una prueba con el cliente
     delante, se cambia esta línea y el sistema queda como estaba: la
     demostración sigue completa y no se desarmó nada para conectar la nube. */
  const USAR_NUBE = true;

  /* ═══ LO QUE ES DEL SISTEMA, NO DEL TALLER ═════════════════════════════
     Los catalogos del modelo nuevo y las cuentas. Hasta el 30-08-2026 vivian en
     `semilla.js`, o sea DENTRO DEL CODIGO PUBLICADO: para cambiarle un modulo a
     alguien habia que editar el sistema y volver a publicarlo, y el cambio no
     se podia hacer desde Configuracion porque al recargar volvia la semilla.

     Ahora viven en la base, que es donde va la configuracion de quien ve que.
     Son 452 documentos entre todos: se bajan enteros y no cuesta nada.

     Si la nube no contesta, el sistema cae a los de la semilla y funciona igual
     — son los mismos. Por eso este cambio no puede dejar a nadie afuera. */
  const CATALOGOS_DEL_SISTEMA = [
    'estado', 'etapa', 'etapa_prerrequisito', 'compania', 'tipo_ingreso',
    'prioridad', 'asunto_bitacora', 'responsable_pago', 'motivo_detencion',
    'inventario_item', 'tipo_dano', 'zona_dano', 'parametro',
    'rol', 'permiso', 'rol_permiso',
    'persona_rol', 'persona_permiso', 'persona_etapa'
  ];

  const CLAVE_CACHE = 'dyp-base-cache-v2';

  /* Cuánto vale la copia guardada antes de volver a preguntar. Diez minutos es
     una decisión de PLATA, no de frescura: sin esto cada F5 son 10.161
     lecturas, y doce personas recargando toda la mañana suman una cuenta que no
     tiene por qué existir. Los cambios de los demás igual llegan — la sala
     avisa, y `refrescar()` está a un botón. */
  const CACHE_VIVE = 10 * 60 * 1000;

  let ultimoError = null;
  let informe = null;         // qué se bajó la última vez y cuánto costó

  /* ── Hablar con Firestore ──────────────────────────────────────────────── */

  /* `aguanta` marca la peticion como `keepalive`: el navegador la termina
     aunque la pagina se cierre o se congele. Se usa cuando el celular manda a
     la aplicacion al fondo, que es justo cuando se pierden las subidas. Tiene
     un tope de 64 KB de cuerpo, asi que solo va en el vaciado de salida. */
  async function pedir(url, cuerpo, aguanta) {
    const corte = new AbortController();
    const reloj = setTimeout(() => corte.abort(), TOPE);
    try {
      const tk = await Nube.token();
      const r = await fetch(url, Object.assign({
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + tk, 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo)
      }, aguanta ? { keepalive: true } : { signal: corte.signal }));
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
      return await r.json();
    } finally {
      clearTimeout(reloj);
    }
  }

  /* ── Traducir de Firestore al modelo ───────────────────────────────────
     Firestore devuelve cada campo etiquetado con su tipo —`{stringValue: "x"}`,
     `{integerValue: "42"}`— y el modelo espera valores pelados. */

  function deValor(v) {
    if (v === null || v === undefined) return null;
    if ('nullValue'    in v) return null;
    if ('stringValue'  in v) return v.stringValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue'  in v) return Number(v.doubleValue);
    if ('booleanValue' in v) return v.booleanValue;
    if ('timestampValue' in v) return new Date(v.timestampValue);
    if ('arrayValue'   in v) return (v.arrayValue.values || []).map(deValor);
    if ('mapValue'     in v) {
      const o = {};
      Object.keys(v.mapValue.fields || {}).forEach((k) => { o[k] = deValor(v.mapValue.fields[k]); });
      return o;
    }
    return null;
  }

  /* 🔴 LAS FECHAS VUELVEN A SER `Date`, Y ESTO NO ES UN DETALLE.

     El ETL las guardó como texto ISO a propósito: una fecha de 2014 que el
     sistema viejo escribió sin zona horaria no se puede convertir a un instante
     sin adivinar, y adivinar sobre 15.534 órdenes es correr la historia entera
     unas horas.

     Pero el modelo trabaja con objetos `Date` —la semilla los genera así y todo
     el formateo los espera así—. Si llegan como texto, `formatearFecha` recibe
     un `String` y la pantalla muestra basura o se cae.

     Se convierten POR EL NOMBRE DEL CAMPO, que en este modelo es una convención
     firme y comprobada contra las 42 colecciones: o empieza con `fecha`, o
     termina en `_at`. No hay un solo campo de fecha que se llame de otra forma,
     ni un campo que se llame así y no sea una fecha. Convertir por «parece una
     fecha» habría sido peor: un VIN o un número de siniestro puede parecerlo. */
  const ES_FECHA = /^fecha|_at$/;
  const ISO = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/;

  function deDocumento(d) {
    const o = { id: String(d.name).split('/').pop() };
    const f = d.fields || {};
    Object.keys(f).forEach((k) => {
      let v = deValor(f[k]);
      if (typeof v === 'string' && ES_FECHA.test(k) && ISO.test(v)) {
        const t = new Date(v.replace(' ', 'T'));
        if (!isNaN(t.getTime())) v = t;
      }
      o[k] = v;
    });
    return o;
  }

  /* ── Traducir del modelo a Firestore ───────────────────────────────────── */

  function aValor(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (v instanceof Date) return { stringValue: isNaN(v.getTime()) ? '' : v.toISOString() };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') {
      return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    }
    if (Array.isArray(v)) return { arrayValue: { values: v.map(aValor) } };
    if (typeof v === 'object') {
      const f = {};
      Object.keys(v).forEach((k) => { f[k] = aValor(v[k]); });
      return { mapValue: { fields: f } };
    }
    return { stringValue: String(v) };
  }

  function aDocumento(coleccion, fila) {
    const f = {};
    Object.keys(fila).forEach((k) => { if (k !== 'id') f[k] = aValor(fila[k]); });
    return { name: RECURSO + '/' + coleccion + '/' + String(fila.id).replace(/\//g, '_'), fields: f };
  }

  /* ── Consultar ─────────────────────────────────────────────────────────── */

  /* 🔴 BUSCAR POR ID NO ES BUSCAR POR UN CAMPO DE TEXTO (30-08-2026).

     El id de un documento se consulta con el campo especial `__name__`, y ahí
     Firestore NO acepta una cadena: exige una REFERENCIA —`referenceValue`— con
     la ruta completa del documento. Pasarle la misma ruta como texto devuelve
     `400 __key__ filter value must be a Key`.

     Se descubrió con las 22 consultas del arranque fallando en bloque mientras
     la primera —que filtra por `estado`, un campo normal— contestaba 200. Ese
     contraste fue lo que lo delató: no era el permiso ni la identidad, era el
     tipo de UN campo. */
  const valorDe = (campo, v) =>
    (campo === '__name__' ? { referenceValue: String(v) } : aValor(v));

  const igual = (campo, valor) => ({
    fieldFilter: { field: { fieldPath: campo }, op: 'EQUAL', value: valorDe(campo, valor) } });

  const dentroDe = (campo, valores) => ({
    fieldFilter: { field: { fieldPath: campo }, op: 'IN',
      value: { arrayValue: { values: valores.map((v) => valorDe(campo, v)) } } } });

  const yTodos = (fs) => (fs.length === 1 ? fs[0] : { compositeFilter: { op: 'AND', filters: fs } });

  let lecturas = 0;   // se cuentan para poder DECIR lo que costó

  async function consultar(coleccion, filtro, limite, orden) {
    const q = { from: [{ collectionId: coleccion }] };
    if (filtro) q.where = filtro;
    if (limite) q.limit = limite;
    if (orden) q.orderBy = [{ field: { fieldPath: orden.campo }, direction: orden.dir || 'DESCENDING' }];
    const d = await pedir(API + RECURSO + ':runQuery', { structuredQuery: q });
    const filas = (d || []).filter((x) => x && x.document).map((x) => deDocumento(x.document));
    lecturas += filas.length;
    return filas;
  }

  /* Un `IN` no acepta más de 30 valores: se parte en tandas y se juntan. Las
     tandas van EN PARALELO —son consultas independientes— porque en serie el
     arranque tardaba lo que tarda la más lenta multiplicado por el número de
     tandas, y con `media` eso eran 155 idas y vueltas una detrás de otra. */
  async function consultarPorTandas(coleccion, campo, valores, filtroExtra) {
    const v = Array.from(new Set(valores.filter((x) => x !== null && x !== undefined)));
    if (!v.length) return [];
    const tandas = [];
    for (let i = 0; i < v.length; i += POR_TANDA) tandas.push(v.slice(i, i + POR_TANDA));
    const partes = await Promise.all(tandas.map((t) => {
      const f = filtroExtra ? yTodos([dentroDe(campo, t), filtroExtra]) : dentroDe(campo, t);
      return consultar(coleccion, f);
    }));
    return [].concat.apply([], partes);
  }

  async function contar(coleccion, filtro) {
    const q = { from: [{ collectionId: coleccion }] };
    if (filtro) q.where = filtro;
    const d = await pedir(API + RECURSO + ':runAggregationQuery', {
      structuredAggregationQuery: { structuredQuery: q, aggregations: [{ alias: 'n', count: {} }] } });
    return Number(d[0].result.aggregateFields.n.integerValue);
  }

  /* ═══ EL CONJUNTO DE TRABAJO ═══════════════════════════════════════════
     Las 92 órdenes vivas y todo lo que cuelga de ellas. Es lo que reemplaza a
     la semilla: desde acá el sistema muestra autos de verdad. */

  async function conjuntoDeTrabajo() {
    const t0 = Date.now();
    lecturas = 0;

    const orden_trabajo = await consultar('orden_trabajo', dentroDe('estado', VIVAS));
    if (!orden_trabajo.length) throw new Error('Firestore no devolvió ninguna orden activa');

    const ots  = orden_trabajo.map((o) => o.id);
    const vehs = orden_trabajo.map((o) => o.vehiculo_id);
    const clis = orden_trabajo.map((o) => o.cliente_id);
    const recs = orden_trabajo.map((o) => o.recepcion_id);

    /* Todo lo que cuelga de la orden, a la vez. Son consultas independientes y
       esperarlas de a una haría el arranque diez veces más lento. */
    /* 🔴 `dano` NO CUELGA DE LA ORDEN, CUELGA DE LA RECEPCION (30-08-2026).

       Estaba en esta lista y por eso se pedia `dano where ot_id IN (...)`. Ese
       campo no existe: los daños se guardan con `recepcion_id` —el modelo los
       indexa asi, `danosDeRec`— porque una recepcion puede generar dos ordenes
       y el auto se raya UNA vez. La consulta devolvia cero siempre y el croquis
       de daños salia limpio en las 92 ordenes, como si a ningun auto le hubiera
       pasado nada. Va abajo, junto al inventario, que cuelga de lo mismo. */
    const porOt = ['ot_estadia', 'ot_etapa', 'presupuesto', 'repuesto',
                   'bitacora', 'evento', 'media', 'costo_adicional',
                   'compromiso', 'ot_detencion'];

    const [colgadas, vehiculo, clientes, recepcion, marca, modelo, color_vehiculo,
           cuentas, catalogos] = await Promise.all([
      Promise.all(porOt.map((c) => consultarPorTandas(c, 'ot_id', ots).catch(() => []))),
      consultarPorTandas('vehiculo', '__name__', vehs.filter(Boolean).map((v) => RECURSO + '/vehiculo/' + v)),
      consultarPorTandas('persona',  '__name__', clis.filter(Boolean).map((v) => RECURSO + '/persona/' + v)),
      consultarPorTandas('recepcion', '__name__', recs.filter(Boolean).map((v) => RECURSO + '/recepcion/' + v)),
      consultar('marca'), consultar('modelo'), consultar('color_vehiculo'),
      /* Las 14 cuentas del taller, con sus modulos y sus permisos. */
      consultar('cuenta').catch(() => []),
      Promise.all(CATALOGOS_DEL_SISTEMA.map((c) => consultar(c).catch(() => null)))
    ]);

    const tablas = { orden_trabajo, vehiculo, recepcion, marca, modelo, color_vehiculo };
    porOt.forEach((c, i) => { tablas[c] = colgadas[i]; });

    /* 🔴 UN CATALOGO VACIO NO SE ADOPTA, SE DEJA EL DE LA SEMILLA.
       `null` significa «la consulta fallo» y un arreglo vacio significa «no hay
       ninguno», y las dos cosas terminan igual de mal: sin `estado` no hay
       Torre, sin `permiso` no entra nadie. Ante la duda manda la semilla, que
       siempre esta. */
    CATALOGOS_DEL_SISTEMA.forEach((c, i) => {
      if (Array.isArray(catalogos[i]) && catalogos[i].length) tablas[c] = catalogos[i];
    });
    if (cuentas.length) tablas.cuenta = cuentas;

    /* Las líneas del presupuesto cuelgan del presupuesto, no de la orden; y el
       inventario cuelga de la recepción. Van después porque necesitan los ids
       que recién ahora existen. */
    const [presupuesto_linea, recepcion_inventario, trabajadores, dano, recepcion_correccion] =
      await Promise.all([
      consultarPorTandas('presupuesto_linea', 'presupuesto_id', tablas.presupuesto.map((p) => p.id)),
      consultarPorTandas('recepcion_inventario', 'recepcion_id', recepcion.map((r) => r.id)),
      /* 🔴 TODA PERSONA QUE APAREZCA EN UNA PANTALLA (30-08-2026).

         Antes se traían sólo los que hicieron una etapa —los mecánicos y
         pintores— y por eso la bitácora mostraba «De: —  Para: —» teniendo el
         autor y el destinatario guardados: son usuarios del sistema, no gente
         de taller, y no venían en la consulta.

         Van los cuatro orígenes: quién hizo la etapa, quién escribió el
         mensaje, a quién iba dirigido, y quién es el responsable de la orden.
         Un nombre que falta se ve igual que un dato que no existe. */
      consultarPorTandas('persona', '__name__',
        Array.from(new Set([].concat(
          tablas.ot_etapa.map((e) => e.persona_id),
          tablas.bitacora.map((b) => b.autor_id),
          tablas.bitacora.map((b) => b.destinatario_id),
          orden_trabajo.map((o) => o.responsable_id)
        ).filter(Boolean))).map((v) => RECURSO + '/persona/' + v)),
      /* Los daños del croquis y las correcciones de la recepcion: las dos
         cuelgan de la recepcion, no de la orden. */
      consultarPorTandas('dano', 'recepcion_id', recepcion.map((r) => r.id)).catch(() => []),
      consultarPorTandas('recepcion_correccion', 'recepcion_id', recepcion.map((r) => r.id)).catch(() => [])
    ]);

    tablas.presupuesto_linea = presupuesto_linea;
    tablas.recepcion_inventario = recepcion_inventario;
    tablas.dano = dano;
    tablas.recepcion_correccion = recepcion_correccion;
    tablas.persona = clientes.concat(trabajadores);

    informe = {
      cuando: new Date().toISOString(),
      segundos: (Date.now() - t0) / 1000,
      lecturas,
      documentos: Object.keys(tablas).reduce((n, k) => n + tablas[k].length, 0),
      ordenes_activas: orden_trabajo.length,
      por_tabla: Object.keys(tablas).sort().reduce((o, k) => { o[k] = tablas[k].length; return o; }, {})
    };
    ultimoError = null;
    return tablas;
  }

  /* ── La copia guardada ─────────────────────────────────────────────────
     Para no pagar 10.161 lecturas en cada F5. Guarda las tablas tal como
     llegaron; las fechas viajan con la misma marca `__fecha` que usa el modelo,
     para no tener dos formas de guardar lo mismo. */

  function guardarCache(tablas) {
    try {
      localStorage.setItem(CLAVE_CACHE, JSON.stringify(
        { cuando: Date.now(), informe, tablas },
        function (k, v) {
          const orig = this[k];
          return orig instanceof Date ? { __fecha: orig.toISOString() } : v;
        }));
      return true;
    } catch (e) {
      /* Cuota llena. No es grave: se vuelve a preguntar a Firestore, que es
         más lento y cuesta lecturas, pero el sistema anda igual. */
      return false;
    }
  }

  function leerCache(maxEdad) {
    try {
      const crudo = localStorage.getItem(CLAVE_CACHE);
      if (!crudo) return null;
      const d = JSON.parse(crudo, (k, v) =>
        (v && typeof v === 'object' && v.__fecha ? new Date(v.__fecha) : v));
      if (!d || !d.tablas || !d.cuando) return null;
      if (maxEdad !== 0 && Date.now() - d.cuando > (maxEdad || CACHE_VIVE)) return null;
      informe = d.informe || null;
      return d.tablas;
    } catch (e) { return null; }
  }

  function olvidarCache() {
    try { localStorage.removeItem(CLAVE_CACHE); } catch (e) { /* nada */ }
  }

  /* ── Escribir ──────────────────────────────────────────────────────────
     🔴 SÓLO SE MANDA LO QUE CAMBIÓ, Y SE SABE POR COMPARACIÓN.

     El modelo no avisa QUÉ fila tocó: `guardar()` reescribe el documento
     entero, que es lo correcto cuando el destino es `localStorage`. Mandar
     10.161 documentos a Firestore en cada clic sería absurdo —y caro—.

     Así que al bajar se guarda una huella de cada fila (su JSON) y al subir se
     compara. Lo que cambió y lo nuevo se mandan; lo demás no se toca. Cuesta
     recorrer 10.000 filas en memoria, que son milisegundos, y ahorra miles de
     escrituras.

     ⚠️ NO SE BORRA NADA. Una fila que desaparece del modelo no se borra en
     Firestore: las reglas lo prohíben —`allow delete: if false`— y encima es
     historia de doce años. Si algún día hay que dar de baja algo, se marca. */

  let huella = null;          // { coleccion: { id: json } }
  /* Sube cada vez que la huella cambia. Va en la llave del conteo de abajo: sin
     esto, tomar la huella de nuevo no invalidaria el numero del pie. */
  let selloHuella = 0;
  let pendiente = null;       // el temporizador del empujón
  let empujando = false;
  let ultimoEmpujon = null;   // { subidos, cuando, error }

  const TABLAS_QUE_SUBEN = [
    'orden_trabajo', 'vehiculo', 'persona', 'recepcion', 'recepcion_inventario',
    'recepcion_correccion', 'presupuesto', 'presupuesto_linea', 'repuesto',
    'ot_etapa', 'ot_estadia', 'ot_detencion', 'costo_adicional', 'compromiso',
    'bitacora', 'evento', 'media', 'aviso', 'dano',
    /* 🔴 LOS CATALOGOS TAMBIEN SUBEN, DESDE EL 30-08-2026.

       Faltaban, y el efecto era que Configuracion no servia para nada: se
       agregaba una etapa, decia que si, y al recargar no estaba. El encabezado
       de esa pantalla promete «se agregan, se editan y se dan de baja desde
       aca, sin programador» — y ninguna de las tres cosas sobrevivia a un F5.

       Lo mismo con los tres bloques de casillas de Personal: modulos, permisos
       y habilidades daban su aviso verde y no volvian. */
    'estado', 'etapa', 'etapa_prerrequisito', 'compania', 'tipo_ingreso',
    'prioridad', 'asunto_bitacora', 'responsable_pago', 'motivo_detencion',
    'inventario_item', 'tipo_dano', 'zona_dano', 'parametro',
    'rol', 'permiso', 'rol_permiso',
    'persona_rol', 'persona_permiso', 'persona_etapa',
    'marca', 'modelo', 'color_vehiculo'
  ];

  /* 🔴 LAS CUENTAS SE LEEN DE `cuenta` Y HAY QUE ESCRIBIRLAS AHI (30-08-2026).

     En memoria una cuenta es una fila mas de `db.persona` —asi lo pide el
     modelo, y esta bien: una cuenta ES una persona que ademas puede entrar—.
     Pero en la base viven en su propia coleccion, aparte de los 6.550 clientes.

     Sin esta traduccion, cambiar una clave o un modulo escribia en `persona`.
     Tres consecuencias, y la tercera es la que importa:

       1. El cambio no se veia: se lee de `cuenta`, que seguia igual. «Clave
          cambiada» decia la pantalla, y al otro dia entraba la vieja.
       2. Quedaba un documento de mas en `persona`.
       3. Ese documento llevaba la HUELLA DE LA CLAVE adentro, en la coleccion
          donde viven los clientes del taller. Una credencial guardada donde no
          va, y que las reglas no dejan borrar.

     `es_cuenta` es la marca que las distingue, y viene de la propia base. */
  const coleccionDe = (tabla, fila) =>
    (tabla === 'persona' && fila && (fila.es_cuenta || fila.usuario) ? 'cuenta' : tabla);

  /* 🔴 LO PENDIENTE SE ANOTA, NO SE DEDUCE (30-08-2026).

     La primera version de esto guardaba la HUELLA en el equipo y al arrancar
     comparaba: lo que no calzara era «trabajo sin subir». Sonaba bien y estaba
     mal, porque al arrancar la base todavia tiene la SEMILLA —el sistema siembra
     la demostracion mientras Firestore contesta— y una fila de la semilla no
     calza con nada. Resultado medido: 6.791 filas dadas por pendientes, subidas
     a la base del cliente. Clientes inventados, autos inventados y hasta cuatro
     cuentas viejas que se habian fusionado, resucitadas dentro de su data real.

     Ahora se anota en el momento: cuando `empujar` sabe que hay N filas que
     mandar, deja la LISTA DE IDS en el equipo ANTES de esperar, y la borra
     recien cuando la subida confirma. Si la pagina muere en el medio —que es lo
     que pasa en el celular al cambiar de aplicacion— la lista queda, y al abrir
     de nuevo se sabe exactamente que era: no se deduce, estaba escrito.

     La diferencia practica: la lista solo puede contener filas que el sistema
     iba a subir estando conectado. La semilla nunca entra. */
  const CLAVE_PENDIENTES = 'dyp-base-pendientes-v1';

  function anotarPendientes(lista) {
    try {
      if (!lista.length) localStorage.removeItem(CLAVE_PENDIENTES);
      else localStorage.setItem(CLAVE_PENDIENTES, JSON.stringify(
        lista.map((c) => ({ t: c.tabla || c.coleccion, c: c.coleccion, i: c.fila.id }))));
    } catch (e) { /* cuota: se pierde el rescate, no los datos */ }
  }

  function limpiarPendientes() {
    try { localStorage.removeItem(CLAVE_PENDIENTES); } catch (e) { /* nada */ }
  }

  /* Las filas que quedaron anotadas y todavia estan en esta base. Se devuelven
     con su tabla del modelo para que quien reponga sepa donde va cada una. */
  function pendienteDeAntes(db) {
    let anotadas;
    try {
      const crudo = localStorage.getItem(CLAVE_PENDIENTES);
      anotadas = crudo ? JSON.parse(crudo) : null;
    } catch (e) { return []; }
    if (!Array.isArray(anotadas) || !anotadas.length) return [];
    const out = [];
    anotadas.forEach((a) => {
      const filas = db[a.t];
      if (!Array.isArray(filas)) return;
      const f = filas.find((x) => x && x.id === a.i);
      if (f) out.push({ tabla: a.t, coleccion: a.c, fila: f });
    });
    return out;
  }

  function tomarHuella(db) {
    selloHuella++;
    huella = {};
    TABLAS_QUE_SUBEN.concat(['cuenta']).forEach((c) => { huella[c] = {}; });
    TABLAS_QUE_SUBEN.forEach((c) => {
      (db[c] || []).forEach((f) => {
        if (f && f.id) huella[coleccionDe(c, f)][f.id] = JSON.stringify(f);
      });
    });
  }


  /* Marca lo que hay en `db` como «ya está igual en la nube», sin escribir. La
     usa el Histórico después de bajar órdenes viejas: llegaron DE allá, así que
     no hay nada que mandar de vuelta. */
  function anotarHuella(db) {
    selloHuella++;
    if (!huella) return;
    TABLAS_QUE_SUBEN.forEach((c) => {
      (db[c] || []).forEach((f) => {
        if (!f || !f.id) return;
        const d = coleccionDe(c, f);
        if (!huella[d]) huella[d] = {};
        if (huella[d][f.id] === undefined) huella[d][f.id] = JSON.stringify(f);
      });
    });
  }

  /* Olvida la huella y con eso desconecta la escritura. La llama `sembrar()`:
     con datos de demostración en memoria no hay NADA que mandar a la nube. */
  function soltar() { selloHuella++; huella = null; if (pendiente) { clearTimeout(pendiente); pendiente = null; } }

  function cambios(db) {
    if (!huella) return [];
    const lista = [];
    TABLAS_QUE_SUBEN.forEach((c) => {
      (db[c] || []).forEach((f) => {
        /* 🔴 SIN `id` NO SE SUBE, Y HAY QUE DECIRLO EN VEZ DE CALLARLO.
           El checklist de una recepcion nueva se creaba sin `id` y estas filas
           lo saltaban en silencio: la recepcion se guardaba, la pantalla decia
           que si, y al dia siguiente no tenia checklist. Ahora se cuenta y
           `ultimaSubida()` lo dice, para que se note. */
        if (!f) return;
        if (!f.id) { sinId++; return; }
        const d = coleccionDe(c, f);
        const ahora = JSON.stringify(f);
        if ((huella[d] || {})[f.id] !== ahora) lista.push({ coleccion: d, fila: f, json: ahora });
      });
    });
    return lista;
  }
  let sinId = 0;

  /* ═══ CUANTOS QUEDAN SIN SUBIR, PARA EL ROTULO DE LA BARRA ══════════════
     `cambios()` recorre la base entera haciendo un `JSON.stringify` por fila.
     Con las 92 ordenes vivas no se nota; con el historico cargado son mas de
     cincuenta mil, y el rotulo del pie lo pedia en CADA repintado — o sea al
     mover cualquier filtro. Medido: minutos por repintado.

     Acá se guarda el conteo con una llave de dos partes: la version de los
     datos y el sello de la huella. Mientras ninguna cambie, el numero es el
     mismo y no hay nada que recorrer.

     ⚠️ SE MEMORIZA EL CONTEO, NO `cambios()`. Esa funcion decide QUE SE SUBE y
     una respuesta vieja ahi es una subida que no ocurre. Lo peor que puede
     pasar con esto es que el numero del pie tarde un repintado. */
  let conteoLlave = null;
  let conteoValor = 0;
  function cuantosPendientes(db) {
    if (!huella) return 0;
    const v = (typeof Modelo !== 'undefined' && Modelo.versionMemo) ? Modelo.versionMemo() : -1;
    const llave = v + '|' + selloHuella;
    if (conteoLlave === llave) return conteoValor;
    conteoLlave = llave;
    conteoValor = cambios(db).length;
    return conteoValor;
  }

  async function escribir(lista, aguanta) {
    /* Con `keepalive` el navegador topa el cuerpo en 64 KB, asi que el vaciado
       de salida manda lotes chicos. Sin eso, un lote grande se rechaza entero
       justo en el momento en que no hay nadie mirando. */
    const porLote = aguanta ? 20 : POR_LOTE;
    for (let i = 0; i < lista.length; i += porLote) {
      const trozo = lista.slice(i, i + porLote);
      await pedir(API + RECURSO + ':commit', {
        writes: trozo.map((c) => ({ update: aDocumento(c.coleccion, c.fila) })) }, aguanta);
      // Recién cuando el lote llegó se anota: si se corta, lo que no subió
      // sigue marcado como distinto y se reintenta en el próximo empujón.
      trozo.forEach((c) => { huella[c.coleccion][c.fila.id] = c.json; });
    }
  }

  /* Se llama desde `Modelo.guardar()`, o sea en cada cambio. Espera a que la
     persona deje de escribir antes de subir: cargar una línea de presupuesto
     dispara `guardar()` en cada tecla, y sin esta espera serían veinte
     escrituras para un solo dato. */
  const ESPERA_EMPUJON = 1500;

  function empujar(db) {
    if (!huella) return;                     // no se arrancó desde la nube
    /* Se anota ANTES de esperar. Esos 1,5 segundos son justo donde el celular
       congela la pagina, y si la lista se escribiera despues no habria nada que
       rescatar: se perderia igual, solo que con mas codigo. */
    anotarPendientes(cambios(db));
    if (pendiente) clearTimeout(pendiente);
    pendiente = setTimeout(() => { pendiente = null; empujarYa(db); }, ESPERA_EMPUJON);
  }

  async function empujarYa(db) {
    if (empujando) { empujar(db); return; }
    const lista = cambios(db);
    if (!lista.length) return;
    empujando = true;
    try {
      await escribir(lista);
      limpiarPendientes();            // llegaron: ya no hay nada que rescatar
      ultimoEmpujon = { subidos: lista.length, cuando: new Date(), error: null,
        sinId: sinId };
      sinId = 0;
      ultimoError = null;
    } catch (e) {
      ultimoError = e.message;
      ultimoEmpujon = { subidos: 0, cuando: new Date(), error: e.message };
      /* No se pierde: la huella de lo que falló quedó sin actualizar, así que
         el próximo cambio lo vuelve a mandar. */
    } finally {
      empujando = false;
    }
  }

  /* 🔴 VACIAR ANTES DE QUE LA PAGINA SE VAYA (30-08-2026).

     El empujon espera 1,5 s a que la persona deje de teclear, y despues escribe
     con `await`. En un computador eso sobra. En un celular no: al cambiar de
     aplicacion —o al bloquear la pantalla, o al mandar una captura por
     WhatsApp— el navegador CONGELA la pagina. El temporizador no dispara y la
     escritura en curso se corta. El trabajo queda guardado en el telefono, la
     pantalla dijo que si, y a la nube no llego nada.

     Paso de verdad: una recepcion hecha en el telefono se veia ahi y no existia
     en el computador. Se perdio media hora buscandola en Firestore.

     `visibilitychange` es el evento que SI llega en el celular —`beforeunload`
     no es confiable ahi— y `keepalive` deja que la peticion termine aunque la
     pagina ya no este. */
  function vaciarAhora(db) {
    if (!huella || empujando) return;
    const lista = cambios(db);
    if (!lista.length) return;
    if (pendiente) { clearTimeout(pendiente); pendiente = null; }
    escribir(lista, true).then(() => {
      limpiarPendientes();
      ultimoEmpujon = { subidos: lista.length, cuando: new Date(), error: null, sinId: sinId };
    }).catch((e) => { ultimoError = e.message; });
  }

  function vigilarLaSalida(dameLaBase) {
    const salir = () => {
      if (document.visibilityState === 'hidden') vaciarAhora(dameLaBase());
    };
    document.addEventListener('visibilitychange', salir);
    window.addEventListener('pagehide', () => vaciarAhora(dameLaBase()));
  }

  /* ═══ LA HISTORIA, BAJO DEMANDA ═══════════════════════════════════════
     Lo que NO está en memoria. El Histórico pregunta acá en vez de filtrar un
     arreglo, porque el arreglo tiene 92 filas y la historia tiene 15.534. */

  /* Busca órdenes cerradas. Firestore no sabe buscar «texto que contenga», así
     que se busca por lo que sí tiene índice: patente exacta, número de OT,
     siniestro, o el rango de fechas. Es lo mismo que sabía hacer el sistema
     viejo, y con 15.534 órdenes alcanza. */
  async function buscarOrdenes(criterio) {
    const filtros = [];
    if (criterio.numero_ot) filtros.push(igual('numero_ot', Number(criterio.numero_ot)));
    if (criterio.siniestro) filtros.push(igual('siniestro', String(criterio.siniestro).trim()));
    if (criterio.compania_id) filtros.push(igual('compania_id', criterio.compania_id));
    if (criterio.estado) filtros.push(igual('estado', criterio.estado));

    if (criterio.patente) {
      const p = String(criterio.patente).trim().toUpperCase();
      const v = await consultar('vehiculo', igual('patente', p), 5);
      if (!v.length) return { ordenes: [], vehiculos: [] };
      const ordenes = await consultarPorTandas('orden_trabajo', 'vehiculo_id', v.map((x) => x.id),
        filtros.length ? yTodos(filtros) : null);
      return { ordenes, vehiculos: v };
    }

    if (!filtros.length) {
      /* Sin criterio: las últimas, por número de OT. No se baja la historia
         entera «por si acaso». */
      const ordenes = await consultar('orden_trabajo', null, criterio.limite || 50,
        { campo: 'numero_ot', dir: 'DESCENDING' });
      return { ordenes, vehiculos: await traerVehiculos(ordenes) };
    }

    const ordenes = await consultar('orden_trabajo', yTodos(filtros), criterio.limite || 200);
    return { ordenes, vehiculos: await traerVehiculos(ordenes) };
  }

  const traerVehiculos = (ordenes) => consultarPorTandas('vehiculo', '__name__',
    ordenes.map((o) => o.vehiculo_id).filter(Boolean).map((v) => RECURSO + '/vehiculo/' + v));

  /* ═══ TODA LA HISTORIA, DE UNA ═══════════════════════════════════════
     Las 15.534 órdenes con sus 13.201 autos y sus 6.675 clientes: 35.410
     documentos, unos 8 MB. Se pide cuando alguien aprieta «Ver todos», nunca
     al arrancar.

     🔴 LA PLATA NO SE BAJA, YA VIENE CALCULADA. Mostrar la venta de una orden
     exige sus presupuestos y sus líneas, y eso son 333.554 documentos más —
     veinte veces lo que pesa todo lo demás—. Así que el total de cada orden se
     calcula UNA VEZ, al migrar, y se guarda en la propia orden: `venta_mo`,
     `venta_rep`, `venta_tot`.

     Y se calcula con `Reglas.totalesPresupuesto`, o sea con la MISMA función
     que usa la pantalla cuando sí tiene los presupuestos a mano. No es una
     fórmula parecida escrita en otro lenguaje: es la del sistema, corrida
     sobre la data. Dos sumas parecidas para el mismo número es exactamente
     cómo un informe y una pantalla terminan diciendo cosas distintas. */
  async function historicoCompleto(avisar) {
    const ordenes = [];
    let cursor = null;
    /* De a 3.000. `runQuery` no pagina solo, así que se avanza por número de OT
       —que es único y creciente— pidiendo «las siguientes menores que ésta».
       De un viaje, 15.534 documentos son una respuesta de 5 MB que en el
       teléfono del taller se corta. */
    for (let vuelta = 0; vuelta < 12; vuelta++) {
      const q = { from: [{ collectionId: 'orden_trabajo' }], limit: 3000,
        orderBy: [{ field: { fieldPath: 'numero_ot' }, direction: 'DESCENDING' }] };
      if (cursor !== null) {
        q.where = { fieldFilter: { field: { fieldPath: 'numero_ot' },
          op: 'LESS_THAN', value: { integerValue: String(cursor) } } };
      }
      const d = await pedir(API + RECURSO + ':runQuery', { structuredQuery: q });
      const parte = (d || []).filter((x) => x && x.document).map((x) => deDocumento(x.document));
      lecturas += parte.length;
      if (!parte.length) break;
      ordenes.push.apply(ordenes, parte);
      if (avisar) avisar(ordenes.length);
      if (parte.length < 3000) break;
      cursor = parte[parte.length - 1].numero_ot;
    }

    /* Los autos y los clientes van completos y no por cruce: pedir 13.201
       vehículos de a 30 serían 440 idas y vueltas. La colección entera son
       tres llamadas. */
    /* La estadía va también, y no es un extra: de ahí sale la columna
       «Reparación» —cuántos días estuvo el auto adentro—, que es el número con
       el que el taller se mide. Sin ella salía 0 en las 15.442 y parecía que
       ninguna orden había tomado tiempo. */
    const [vehiculo, persona, ot_estadia] = await Promise.all([
      todaLaColeccion('vehiculo', avisar ? (c, n) => avisar(ordenes.length, c, n) : null),
      todaLaColeccion('persona', avisar ? (c, n) => avisar(ordenes.length, c, n) : null),
      todaLaColeccion('ot_estadia', avisar ? (c, n) => avisar(ordenes.length, c, n) : null)
    ]);

    /* Se cuenta en Firestore lo que TENDRIA que haber y se compara con lo que
       llego. Cuesta una lectura por coleccion y es la unica forma de saber que
       no falta nada — el bug de los 12.000 vehiculos existio justamente porque
       nadie estaba comparando. */
    const [nOt, nVeh, nPer, nEst] = await Promise.all([
      contar('orden_trabajo'), contar('vehiculo'), contar('persona'), contar('ot_estadia')
    ]);
    const faltan = [];
    if (ordenes.length  !== nOt)  faltan.push('ordenes ' + ordenes.length + '/' + nOt);
    if (vehiculo.length !== nVeh) faltan.push('vehiculos ' + vehiculo.length + '/' + nVeh);
    if (persona.length  !== nPer) faltan.push('personas ' + persona.length + '/' + nPer);
    if (ot_estadia.length !== nEst) faltan.push('estadias ' + ot_estadia.length + '/' + nEst);
    if (faltan.length) throw new Error('Faltaron datos: ' + faltan.join(', '));

    return { orden_trabajo: ordenes, vehiculo, persona, ot_estadia,
      completo: { ordenes: nOt, vehiculos: nVeh, personas: nPer, estadias: nEst } };
  }

  /* 🔴 UNA COLECCION ENTERA, Y ENTERA DE VERDAD (30-08-2026).

     El primer intento uso la API de listado con `pageSize=1000`. Bajo 12.000
     vehiculos de 13.201 y no dio ningun error: **devolvio una parte como si
     fuera el todo**. La causa es que esa API TOPA LAS PAGINAS EN 300 sin
     decirlo —pide 1.000 y entrega 300— asi que el tope de vueltas del bucle se
     alcanzaba antes que el final de la coleccion. 40 vueltas x 300 = 12.000
     exactos, que fue lo que lo delato.

     Lo grave no eran los 1.201 vehiculos: era que la pantalla los daba por
     inexistentes. Un auto que estuvo en el taller aparecia como si nunca
     hubiera entrado, y la venta de doce anios salia $79.681.300 mas baja sin
     una sola senal de que faltaba algo.

     Ahora se pagina con CURSOR sobre el id, que es lo que la consulta si
     respeta, y —esto es lo importante— **si se acaban las vueltas antes que la
     coleccion, LANZA**. Quien llama prefiere un error a un numero incompleto:
     un error se ve, un numero incompleto se cree. */
  async function todaLaColeccion(col, avisar) {
    const filas = [];
    let ultimo = null;
    const POR_VUELTA = 3000;
    const TOPE_VUELTAS = 60;          // 180.000 documentos: mas que cualquier coleccion que se pida entera
    for (let i = 0; i < TOPE_VUELTAS; i++) {
      const q = { from: [{ collectionId: col }], limit: POR_VUELTA,
        orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }] };
      if (ultimo) {
        q.startAt = { values: [{ referenceValue: RECURSO + '/' + col + '/' + ultimo }],
          before: false };
      }
      const d = await pedir(API + RECURSO + ':runQuery', { structuredQuery: q });
      const parte = (d || []).filter((x) => x && x.document);
      if (!parte.length) return filas;
      parte.forEach((x) => filas.push(deDocumento(x.document)));
      lecturas += parte.length;
      if (avisar) avisar(col, filas.length);
      if (parte.length < POR_VUELTA) return filas;
      ultimo = String(parte[parte.length - 1].document.name).split('/').pop();
    }
    throw new Error('La coleccion ' + col + ' no cabe en ' + TOPE_VUELTAS +
      ' vueltas: se bajaron ' + filas.length + ' y hay mas. No se devuelve a medias.');
  }

  /* Los clientes de un conjunto de órdenes. Va aparte de `buscarOrdenes`
     porque el Histórico las necesita y una búsqueda por compañía no. */
  const personasDe = (ordenes) => consultarPorTandas('persona', '__name__',
    ordenes.map((o) => o.cliente_id).filter(Boolean).map((v) => RECURSO + '/persona/' + v));

  /* Los presupuestos de un conjunto de órdenes, CON sus líneas.

     Van los dos juntos porque los montos que muestra el Histórico —mano de
     obra, repuestos, T.O.T.— no están guardados en el presupuesto: se calculan
     desde las líneas, horas × tempario. Con el presupuesto solo, las cuatro
     columnas de plata salen en $0 y una orden de 2015 aparece como si no se
     hubiera cobrado nada. */
  async function presupuestosDe(ordenes) {
    const ids = ordenes.map((o) => o.id);
    /* La estadía va acá aunque no sea plata: sin ella `diasReparacion` da 0 y
       la columna «Reparación» del Histórico —cuántos días estuvo el auto
       adentro— sale en blanco para toda la historia. Es una consulta más y se
       hace junto con las otras, no en serie. */
    const [pres, estadias] = await Promise.all([
      consultarPorTandas('presupuesto', 'ot_id', ids),
      consultarPorTandas('ot_estadia', 'ot_id', ids)
    ]);
    if (!pres.length) return { presupuesto: [], presupuesto_linea: [], ot_estadia: estadias };
    const lineas = await consultarPorTandas('presupuesto_linea', 'presupuesto_id',
      pres.map((x) => x.id));
    return { presupuesto: pres, presupuesto_linea: lineas, ot_estadia: estadias };
  }

  /* ═══ LAS ETAPAS DE UN CONJUNTO DE ÓRDENES ═════════════════════════════
     Para la Reportería. `presupuestosDe` trae la plata y la estadía, pero no
     las etapas, y sin ellas los dos gráficos que abren la reparación etapa por
     etapa salen en blanco: no porque falte el dato —`ot_etapa` está migrada
     entera— sino porque nadie lo pedía.

     No se baja la colección completa: son 78.405 documentos y triplicaría lo
     que hoy pesa «Ver todos». Se piden las del período que se está mirando, de
     a 30 ids por consulta, que es como se cruza todo lo demás. */
  const etapasDe = (ordenes) => consultarPorTandas('ot_etapa', 'ot_id',
    (ordenes || []).map((o) => o.id || o).filter(Boolean));

  /* Una orden vieja, completa: para poder abrir su expediente sin tenerla en
     memoria. Devuelve las tablas listas para mezclar en el modelo. */
  async function expediente(ot_id) {
    const [o] = await consultar('orden_trabajo', igual('__name__', RECURSO + '/orden_trabajo/' + ot_id), 1);
    if (!o) return null;
    const porOt = ['ot_estadia', 'ot_etapa', 'presupuesto', 'repuesto', 'bitacora',
                   'evento', 'media', 'costo_adicional', 'compromiso', 'ot_detencion', 'dano'];
    const [colgadas, veh, cli, rec] = await Promise.all([
      Promise.all(porOt.map((c) => consultar(c, igual('ot_id', ot_id)).catch(() => []))),
      o.vehiculo_id ? consultar('vehiculo', igual('__name__', RECURSO + '/vehiculo/' + o.vehiculo_id), 1) : [],
      o.cliente_id  ? consultar('persona',  igual('__name__', RECURSO + '/persona/' + o.cliente_id), 1) : [],
      o.recepcion_id ? consultar('recepcion', igual('__name__', RECURSO + '/recepcion/' + o.recepcion_id), 1) : []
    ]);
    const t = { orden_trabajo: [o], vehiculo: veh, persona: cli, recepcion: rec };
    porOt.forEach((c, i) => { t[c] = colgadas[i]; });
    t.presupuesto_linea = await consultarPorTandas('presupuesto_linea', 'presupuesto_id',
      t.presupuesto.map((p) => p.id));
    t.recepcion_inventario = await consultarPorTandas('recepcion_inventario', 'recepcion_id',
      rec.map((r) => r.id));
    return t;
  }

  /* Los números del histórico sin bajar una sola fila: se cuentan en Firestore.
     15.534 órdenes contadas cuestan UNA lectura, no 15.534. */
  const cuantasOrdenes = (estado) => contar('orden_trabajo', estado ? igual('estado', estado) : null);

  /* ── Estado, para poder DECIRLO en pantalla ────────────────────────────── */

  const donde = () => ({ proyecto: PROYECTO, base: '(default)', region: 'southamerica-west1' });
  const problema = () => ultimoError;
  const ultimoInforme = () => informe;
  const ultimaSubida = () => ultimoEmpujon;
  const conectada = () => huella !== null;

  async function probar() {
    try {
      const n = await contar('orden_trabajo', null);
      return { ok: true, motivo: '', ordenes: n };
    } catch (e) { return { ok: false, motivo: e.message, ordenes: 0 }; }
  }

  return {
    conjuntoDeTrabajo, leerCache, guardarCache, olvidarCache,
    tomarHuella, anotarHuella, soltar, empujar, empujarYa, cambios,
    pendienteDeAntes, vaciarAhora, vigilarLaSalida,
    buscarOrdenes, personasDe, presupuestosDe, etapasDe, historicoCompleto, cuantosPendientes, todaLaColeccion, expediente, cuantasOrdenes, contar,
    donde, problema, ultimoInforme, ultimaSubida, conectada, probar,
    /* `conectada()` recien es verdad cuando la nube YA contesto, y hay
       preguntas que hay que hacer antes: en el arranque, mientras se baja.
       Esta dice otra cosa —si la nube esta en juego— y se sabe de entrada. */
    usaLaNube: () => USAR_NUBE,
    activada: () => USAR_NUBE,
    PROYECTO, VIVAS
  };
})();
