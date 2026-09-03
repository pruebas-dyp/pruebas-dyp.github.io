/* LA SALA COMPARTIDA — que el celular y el computador vean lo mismo.

   El modelo borrador guarda todo en el navegador, así que cada dispositivo abría su
   propia copia. Esto es un PUENTE: manda el estado completo como un solo documento.

   ⚠️ NO es el modelo de datos del sistema, que va tabla por tabla con su seguridad por
   rol y es el hito H1. Y SÓLO datos de demostración: acá no entra el RUT, el domicilio
   ni la fotografía de una persona real.

   Detalle y decisiones: 00 Documentacion/DECISIONES.md · js/sala.js */

const Sala = (function () {
  'use strict';

  const URL_BASE = 'https://qhhofnveqggoklnxqpig.supabase.co/rest/v1/sala_demo';
  /* Llave pública. Va en el navegador a propósito: es la que identifica al
     proyecto, no una contraseña. Lo que protege la base son sus políticas.

     Desde el 22-08-2026 esas políticas están ACOTADAS y no abiertas: se lee
     cualquier fila —el celular tiene que poder, sin cuenta—, pero escribir y
     actualizar sólo alcanzan la fila `demo`, y borrar no tiene política, que
     con RLS activo significa que no borra. Antes se podía escribir cualquier
     fila con sólo leer esta línea. */
  const LLAVE = 'sb_publishable_dcOznm8bTszeiPxz87hWcQ_XC-1EoUK';

  const SALA      = 'demo';   // una sola sala, para que todos caigan en la misma
  const CADA      = 2500;     // cada cuánto se pregunta si alguien cambió algo
  const ESPERA    = 1200;     // se deja de escribir y recién ahí se sube
  const CLAVE_YO  = 'dyp-sala-dispositivo';
  const CLAVE_ON  = 'dyp-sala-encendida';

  let encendida = false;
  let reloj = null, pendiente = null;
  let versionVista = 0;        // la última versión de la sala que ya tengo
  let versionEnviada = -1;     // la última versión del MODELO que ya subí
  let aplicando = false;       // estoy escribiendo lo que llegó: no rebotar
  let ultimoError = null;
  let sincronizando = false;

  /* Quién soy. Sirve para no repintarme con mi propio eco: si la sala dice
     que el último en escribir fui yo, no hay nada que traer. */
  function yo() {
    let id;
    try { id = localStorage.getItem(CLAVE_YO); } catch (e) { id = null; }
    if (!id) {
      id = 'disp-' + Math.random().toString(36).slice(2, 10);
      try { localStorage.setItem(CLAVE_YO, id); } catch (e) { /* sin almacenamiento */ }
    }
    return id;
  }

  const cabeceras = (extra) => Object.assign({
    'apikey': LLAVE,
    'Authorization': 'Bearer ' + LLAVE,
    'Content-Type': 'application/json'
  }, extra || {});

  /* ── Hablar con la sala ──────────────────────────────────────────────── */

  /* La consulta barata: sólo el número de versión y quién escribió. Son unos
     pocos bytes, y por eso se puede preguntar cada dos segundos y medio sin
     gastarle los datos a nadie. El documento entero —que pesa más de un
     megabyte— se baja únicamente cuando de verdad cambió. */
  async function mirar() {
    const r = await fetch(URL_BASE + '?id=eq.' + SALA + '&select=version,origen',
      { headers: cabeceras(), cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const filas = await r.json();
    return filas && filas[0] ? filas[0] : null;
  }

  async function bajar() {
    const r = await fetch(URL_BASE + '?id=eq.' + SALA + '&select=db,version',
      { headers: cabeceras(), cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const filas = await r.json();
    return filas && filas[0] ? filas[0] : null;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     🔴 LA SALA NO SUBE DATOS DE PERSONAS DE VERDAD. NUNCA. (30-08-2026)

     Este archivo manda el documento ENTERO a una tabla de Supabase, y lo hace
     con una llave publicable que va escrita unas líneas más arriba, dentro del
     JavaScript que se publica. Cualquiera que abra el código del sitio puede
     leer esa fila.

     Mientras el sistema mostraba datos de demostración eso estaba bien y así
     quedó dicho arriba: «SÓLO datos de demostración: acá no entra el RUT, el
     domicilio ni la fotografía de una persona real».

     Desde hoy el sistema puede tener la data de verdad: 6.550 clientes con su
     RUT y 6.602 con su domicilio. Si la sala se encendiera con eso cargado,
     subiría los datos personales de seis mil personas a un proyecto de terceros
     y quedarían legibles para quien tenga el link. Es la Ley 19.628, y no es
     una posibilidad remota: la sala se enciende con un botón y se queda
     encendida entre visitas — `dyp-sala-encendida` lo recuerda.

     Por eso la guarda va en las TRES puertas y no en una sola:

       · `encender` no enciende.
       · `subir` no sube, aunque alguien la haya encendido antes de que
         llegaran los datos —que es el caso real: el interruptor está guardado
         del día anterior y la nube contesta unos segundos después de arrancar—.
       · `iniciar` la apaga sola al arrancar si el interruptor venía encendido.

     Cuando el sistema tenga cuentas de verdad y los aparatos compartan la base
     directamente, esta sala sobra: para eso está Firestore, que ya tiene sus
     reglas y su identidad. La sala era el puente mientras no la había.
     ═══════════════════════════════════════════════════════════════════════ */
  function datosReales() {
    try { return typeof Modelo !== 'undefined' && Modelo.esReal && Modelo.esReal(); }
    catch (e) { return true; }   // ante la duda, NO sube: el riesgo es de un solo lado
  }

  const MOTIVO_BLOQUEO = 'La sala compartida queda apagada: el sistema está trabajando ' +
    'con los datos reales del cliente y esta sala no es un lugar para datos personales.';

  async function subir(version) {
    if (datosReales()) { ultimoError = MOTIVO_BLOQUEO; apagar(); return false; }
    /* Se manda el MISMO texto que el modelo guarda en el navegador. No se
       vuelve a armar el estado acá: el modelo tiene su propia forma de
       escribir las fechas al guardar y de leerlas al cargar, y tocar eso en
       el camino es la manera más segura de corromper los datos. */
    let crudo;
    try { crudo = localStorage.getItem(Modelo.CLAVE); } catch (e) { crudo = null; }
    if (!crudo) return false;

    const cuerpo = JSON.stringify({
      id: SALA, db: JSON.parse(crudo), version: version, origen: yo()
    });
    const r = await fetch(URL_BASE, {
      method: 'POST',
      headers: cabeceras({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
      body: cuerpo
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return true;
  }

  /* ── Aplicar lo que llegó ────────────────────────────────────────────── */

  /* Se escribe el documento recibido donde el modelo guarda lo suyo y se le
     pide que recargue. Así el estado entra por la misma puerta de siempre,
     con el mismo lector, y ninguna pantalla necesita enterarse de que hubo
     una sala en el medio.

     El borrador de una recepción a medio llenar vive en OTRA clave del
     navegador, así que no se pierde: quien esté escribiendo una recepción
     cuando llega un cambio de afuera conserva lo suyo. */
  /* 🔴 LO QUE LLEGA DE LA SALA SE REVISA ANTES DE ADOPTARLO (22-08-2026).

     Acá había un `if (!fila || !fila.db) return false` y nada más: cualquier
     documento que estuviera en la tabla se escribía como la base completa del
     sistema. Un `db: {}` dejaba el sistema en blanco en todos los navegadores
     conectados, en menos de un latido.

     Y la tabla se escribe SIN identificarse: la dirección y la llave están en
     este mismo archivo, publicado. Que la llave sea pública está bien —es la
     publishable de Supabase, identifica al proyecto, no autentica—, pero
     entonces la única defensa es la política de la tabla y esta revisión.

     No valida el contenido, que sería reimplementar el modelo acá. Valida la
     FORMA: que traiga las tablas sin las cuales el sistema no es el sistema.
     Con eso, lo que puede entrar deja de ser cualquier cosa.

     ⚠️ OJO CON EL NIVEL, que es donde se equivocó el primer intento: lo que
     viaja NO es la base, es el ENVOLTORIO que el modelo guarda —
     `{ modificado, sello, db }`— y las tablas están un piso más abajo, en
     `.db`. Validar en el nivel de arriba rechaza TODO, incluida la base buena,
     y la sala deja de sincronizar en silencio. Lo cazó el criterio de
     aceptación de COD-1, que obliga a probar que la buena entra y no sólo que
     la mala se rechaza. */
  const TABLAS_MINIMAS = ['persona', 'orden_trabajo', 'etapa', 'estado', 'rol', 'permiso'];

  function esBaseCreible(envoltorio) {
    if (!envoltorio || typeof envoltorio !== 'object' || Array.isArray(envoltorio))
      return 'no es un objeto';
    const db = envoltorio.db;
    if (!db || typeof db !== 'object' || Array.isArray(db))
      return 'no trae el envoltorio { modificado, sello, db } que guarda el modelo';
    const faltan = TABLAS_MINIMAS.filter((t) => !Array.isArray(db[t]));
    if (faltan.length) return 'le faltan tablas: ' + faltan.join(', ');
    /* Vacías tampoco: una base sin personas ni etapas no deja entrar a nadie
       ni mostrar nada, y es exactamente lo que deja un documento en blanco.

       Se leen con `|| []` y no directo: esta función revisa lo que manda un
       tercero, así que no puede LANZAR — tiene que devolver el motivo. Sin la
       guarda, tocar el orden de las comprobaciones de arriba la hacía reventar
       con «cannot read properties of undefined», y una defensa que se cae con
       una excepción deja de defender. */
    if (!(db.persona || []).length) return 'no trae ninguna persona';
    if (!(db.etapa || []).length) return 'no trae ninguna etapa';
    return null;
  }

  function aplicar(fila) {
    if (!fila || !fila.db) return false;
    const malo = esBaseCreible(fila.db);
    if (malo) {
      ultimoError = 'La sala trajo algo que no es una base del sistema: ' + malo;
      return false;
    }
    /* ⚠️ `aplicar` APLICA. La decisión de si conviene aplicar o no es de
       `queHacerConLoQueLlega()`, más abajo, y la toma `latido()` antes de
       llamar acá. Estuvieron juntas un rato y fue un error: dejó sin forma de
       sincronizar a las dos pruebas que usan `aplicar` justamente para eso. */
    aplicando = true;
    try {
      localStorage.setItem(Modelo.CLAVE, JSON.stringify(fila.db));
      const ok = Modelo.recargarDeDisco();
      versionVista = Number(fila.version) || versionVista;

      /* 🔴 SI LO QUE LLEGÓ ERA VIEJO, LO DE AHORA HAY QUE SUBIRLO (26-08-2026).

         Acá decía `versionEnviada = Modelo.versionGuardada()` a secas, con el
         comentario «lo que acabo de aplicar ya está en la sala». Es cierto…
         salvo cuando el modelo NO aplicó lo que llegó: si el documento venía de
         otra versión de la semilla, `recargarDeDisco` vuelve a sembrar, y lo
         que hay en memoria ahora no está allá arriba.

         Marcarlo igual como «ya está» dejaba el documento viejo en la sala para
         siempre. Cada equipo se curaba solo al abrir —y por eso el error no se
         veía— pero la sala seguía repartiendo lo anterior, y el primero que
         entrara con la versión anterior del código lo volvía a imponer. */
      if (ok === 'resembrado') versionEnviada = -1;          // fuerza la subida
      else versionEnviada = Modelo.versionGuardada();        // esto sí está allá
      /* 🔴 ACÁ IBA EL AVISO «llegaron cambios y se aplicaron encima». Ya no
         puede pasar: si yo hubiera cambiado algo, arriba se rechazó y no
         llegamos hasta acá. El aviso se quedó sin caso que avisar.

         ⚠️ LO QUE SÍ PUEDE PERDERSE, y queda dicho: el equipo que YA había
         subido lo suyo y está quieto recibe esto y lo aplica. Si el otro
         trabajó sobre una copia sin ese cambio, ese cambio se va. Detectarlo
         exige comparar los dos documentos, que es la mezcla, que es H1. */
      if (ok && typeof render === 'function') render();
      return ok;
    } catch (e) {
      ultimoError = e && e.message;
      return false;
    } finally { aplicando = false; }
  }

  /* ── El ciclo ────────────────────────────────────────────────────────── */

  /* 🔴 ¿HAY ALGO QUE MANDAR? (SIS-2, 23-08-2026)

     Esta pregunta estaba escrita adentro de `latido()`, en línea, y comparaba
     `Modelo.version()` — el contador de los memos, que sube también al entrar,
     al salir y al cambiar de cuenta. Entrar al sistema no cambia ningún dato, y
     sin embargo mandaba el documento entero: 2,4 MB de subida más 2,4 MB de
     bajada por cada otro dispositivo conectado. El contador de la sala iba en
     508 sin que nadie hubiera trabajado tanto.

     Ahora mira `versionGuardada`, que sube sólo cuando el documento guardado
     cambió, que es exactamente lo que esta función manda.

     ⚠️ Y sale de `latido()` a propósito: `latido` es asíncrona y probarla
     obliga a fingir la red entera. Acá la decisión es síncrona, se exporta, y
     hay una prueba que la corre — que es la única forma de que este error no
     vuelva a entrar sin que nadie se entere. */
  /* 🔴 ¿SE APLICA LO QUE LLEGÓ, O SE SUBE LO DE ACÁ? (27-08-2026, Marco: «me
     pasa el panel de la creación, pero después me vuelve hacia atrás y me dice
     que hay datos manipulados en vivo... no me permite crear el presupuesto»).

     Hasta hoy no había decisión: lo que llegaba se aplicaba, y si tapaba algo se
     avisaba con un cartel que decía «hay que volver a hacerlo». Volver a hacerlo
     no servía de nada, porque volvía a pasar: con dos ventanas abiertas contra
     la misma sala —una trabajando y otra quieta con una copia más vieja— la
     quieta sube lo suyo cada 2,5 segundos y borra lo de la que está escribiendo.
     En bucle. Marco no pudo generar un presupuesto en toda la tarde.

     La regla es una línea: SI ACÁ HAY ALGO SIN MANDAR, NO SE APLICA LO QUE
     LLEGA; se sube lo de acá y el otro equipo lo recibe.

     ⚠️ SIGUE SIENDO «GANA EL ÚLTIMO», no es mezcla —mezclar es H1 y no está
     construido—. Lo que cambia es QUIÉN gana: antes ganaba el que llegaba
     segundo aunque estuviera quieto; ahora gana el que acaba de escribir. El que
     pierde es el que ya subió lo suyo y no está haciendo nada, que es el único
     orden que no interrumpe a nadie en la mitad de algo.

     ⚠️ Y ES UNA FUNCIÓN APARTE, no una línea dentro de `latido()`: `latido` es
     asíncrona y probarla obliga a fingir la red entera. Acá la decisión es
     síncrona, se exporta, y hay una prueba que la corre —que es la única forma
     de que esto no se caiga sin que nadie se entere—. Es la misma leccion que
     dejó `hayQueSubir()`, ahí abajo. */
  function queHacerConLoQueLlega() {
    return hayQueSubir() ? 'subir' : 'aplicar';
  }

  function hayQueSubir() {
    return !aplicando && Modelo.versionGuardada() !== versionEnviada;
  }

  async function latido() {
    if (!encendida || sincronizando) return;
    sincronizando = true;
    try {
      const cabeza = await mirar();

      // La sala no existe todavía: la abre el primero que llega.
      if (!cabeza) {
        await subir(1);
        versionVista = 1; versionEnviada = Modelo.versionGuardada();
        ultimoError = null; return;
      }

      // Alguien más escribió después que yo: traigo lo suyo.
      if (Number(cabeza.version) > versionVista && cabeza.origen !== yo()) {
        /* 🔴 ANTES ESTO PISABA EN SILENCIO (SIS-2, 23-08-2026).

           Si los dos dispositivos cambiaron algo dentro de la misma ventana
           —hasta 2,5 s de latido más 1,2 s de espera—, el que llegaba segundo
           bajaba lo del otro y lo aplicaba encima de lo suyo. Sin mezcla, sin
           conflicto, sin una palabra. Y esa ventana es la de dos personas
           trabajando en paralelo, que es justo lo que va a pasar en la
           demostración.

           Mezclar es H1. Lo que se puede hacer hoy —y es infinitamente mejor
           que nada— es DARSE CUENTA y decirlo. */
        /* Se decide ANTES de bajar los 2,4 MB: si acá hay algo sin mandar,
           lo que llega no se va a aplicar igual, así que no se baja. */
        if (queHacerConLoQueLlega() === 'subir') {
          const proxima = Math.max(Number(cabeza.version) || 0, versionVista) + 1;
          await subir(proxima);
          versionVista = proxima; versionEnviada = Modelo.versionGuardada();
          ultimoError = null; return;
        }
        const fila = await bajar();
        aplicar(fila);
        ultimoError = null; return;
      }

      // Nadie escribió afuera, pero yo cambié algo acá: lo mando.
      if (hayQueSubir()) {
        const proxima = Math.max(Number(cabeza.version) || 0, versionVista) + 1;
        await subir(proxima);
        versionVista = proxima; versionEnviada = Modelo.versionGuardada();
      }
      ultimoError = null;
    } catch (e) {
      /* Sin internet, o la base durmiendo. No se interrumpe nada: el sistema
         sigue funcionando contra el almacenamiento del propio equipo y en el
         latido siguiente se vuelve a intentar. */
      ultimoError = (e && e.message) || 'sin conexión';
    } finally { sincronizando = false; }
  }

  /* Al escribir seguido —marcar diez ítems del inventario, por ejemplo— no se
     sube diez veces: se espera a que la mano se detenga. */
  function empujar() {
    if (!encendida || aplicando) return;
    clearTimeout(pendiente);
    pendiente = setTimeout(latido, ESPERA);
  }

  /* ── DOS PESTAÑAS DEL MISMO NAVEGADOR ─────────────────────────────

     🔴 27-08-2026. Y éste es el caso de verdad de Marco: la ficha se abre en
     una pestaña nueva —doble clic en la Torre— y quedan dos, o tres, del mismo
     navegador. Comparten `localStorage`, o sea comparten el documento; pero
     cada una tiene su propia copia EN MEMORIA y su propio contador. La pestaña
     quieta no se enteraba de que la otra había escrito, y en su siguiente
     latido subía a la sala su copia vieja —que desde la sala se ve igual que
     «otro equipo»— y borraba lo recién hecho. En bucle, cada 2,5 segundos.

     El navegador avisa esto solo: `storage` se dispara en las OTRAS pestañas
     del mismo origen cuando una escribe. No hace falta red ni sala: alcanza con
     escucharlo y volver a leer del disco.

     ⚠️ NO SE DISPARA EN LA PESTAÑA QUE ESCRIBIÓ —así está en la norma—, que es
     justamente lo que hace que esto no se muerda la cola. */
  window.addEventListener('storage', (ev) => {
    if (!ev || ev.key !== Modelo.CLAVE || aplicando) return;
    const ok = Modelo.recargarDeDisco();
    if (!ok) return;
    /* Lo que acaba de escribir la otra pestaña es de este mismo navegador: no
       hay nada que subir por este cambio, lo sube ella. Salvo que haya habido
       resiembra, que sí hay que empujar. */
    versionEnviada = ok === 'resembrado' ? -1 : Modelo.versionGuardada();
    if (typeof render === 'function') render();
  });

  /* ── Encender y apagar ────────────────────────────────────────── */  /* ── Encender y apagar ───────────────────────────────────────────────── */

  function encender() {
    if (encendida) return;
    if (datosReales()) { ultimoError = MOTIVO_BLOQUEO; return; }
    encendida = true;
    try { localStorage.setItem(CLAVE_ON, '1'); } catch (e) { /* nada */ }
    /* Al entrar manda lo que ya está en la sala: si el celular y el
       computador tienen cosas distintas, la referencia es la sala y no el
       equipo, que es justamente lo que se venía a resolver. */
    (async () => {
      try {
        const cabeza = await mirar();
        if (cabeza) { const fila = await bajar(); aplicar(fila); }
        else { await subir(1); versionVista = 1; versionEnviada = Modelo.versionGuardada(); }
        ultimoError = null;
      } catch (e) { ultimoError = (e && e.message) || 'sin conexión'; }
      if (typeof render === 'function') render();
    })();
    clearInterval(reloj);
    reloj = setInterval(latido, CADA);
  }

  function apagar() {
    encendida = false;
    clearInterval(reloj); reloj = null;
    clearTimeout(pendiente); pendiente = null;
    try { localStorage.setItem(CLAVE_ON, '0'); } catch (e) { /* nada */ }
  }

  function alternar() { if (encendida) apagar(); else encender(); return encendida; }

  /* Cuánto pesa el documento que sube y baja, y a partir de cuándo hay que
     preocuparse. El techo real es `localStorage`: 5 a 10 MB según navegador, y
     ahí el sistema deja de guardar. El aviso se pone MUY antes, en 3 MB, porque
     un techo que llega solo en medio de una demostración no tiene arreglo. */
  const AVISA_DESDE = 3 * 1024 * 1024;

  function peso() {
    const b = Modelo.pesoGuardado();
    return {
      bytes: b,
      apretado: b >= AVISA_DESDE,
      rotulo: b < 1024 * 1024
        ? Math.round(b / 1024) + ' KB'
        : (b / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB'
    };
  }

  /* 🔴 ACÁ VIVÍA `porQueSePerdio()` (27-08-2026). Devolvía el aviso de «lo de
     otro equipo tapó lo tuyo». Ya no hay nada que avisar: desde que
     `queHacerConLoQueLlega()` decide, la sala no aplica encima de lo que se
     está escribiendo. Un lector de un aviso que nadie escribe devuelve null
     para siempre, y eso se lee como «no pasó nada» cuando lo correcto es que
     ya no puede pasar. */

  function estado() {
    const p = peso();
    return {
      encendida: encendida,
      error: ultimoError,
      version: versionVista,
      dispositivo: yo(),
      peso: p,
      // Lo que se muestra abajo a la izquierda, en una sola frase.
      rotulo: !encendida ? 'Datos en este equipo'
            : ultimoError ? 'Sala sin conexión'
            : 'Sala compartida · ' + p.rotulo
    };
  }

  /* Arranca sola si quedó encendida la vez anterior. Por omisión está
     ENCENDIDA: es lo que se pidió —probarlo entre el teléfono y el
     computador— y se apaga desde Archivo. */
  function iniciar() {
    /* 🔴 CON LA NUBE ENCENDIDA, LA SALA NO ARRANCA (30-08-2026).

       Y no es sólo por los datos personales —de eso ya se encargan las guardas
       de `encender` y `subir`—: es que al encenderse la sala BAJA su documento
       y lo aplica encima de lo que haya. Ese documento es la demostración. O
       sea que la sala, arrancando sola como venía haciendo, borraba la data
       real recién traída de Firestore unos segundos después de traerla.

       Además ya no hace falta. La sala existía para que el celular y el
       computador vieran lo mismo cuando cada uno tenía su copia en el
       navegador. Ahora los dos leen de Firestore: ven lo mismo porque ES lo
       mismo, no porque alguien lo esté copiando de un lado al otro. */
    if (typeof Base !== 'undefined' && Base.activada()) { encendida = false; return; }

    let guardado;
    try { guardado = localStorage.getItem(CLAVE_ON); } catch (e) { guardado = null; }
    if (guardado === '0') { encendida = false; return; }
    encender();
  }

  /* 🔴 LA SALIDA DE EMERGENCIA (22-08-2026).

     La sala se escribe sin identificarse. Si alguien deja adentro algo que no
     sirve —o si dos dispositivos se pisan y queda un estado raro—, hasta ahora
     la unica forma de salir era abrir la consola del navegador. En medio de
     una reunion con el cliente eso no es una salida.

     Repone la semilla en este equipo y la sube, pisando lo que haya. Es
     deliberadamente destructivo hacia la sala: para eso existe. */
  function reponer() {
    Modelo.reiniciar();
    ultimoError = null;
    versionEnviada = -1;          // fuerza la subida en el proximo latido
    if (!encendida) return { ok: true, motivo: '' };
    empujar();
    return { ok: true, motivo: '' };
  }

  /* `aplicar` sale para poder PROBARLO: la revision de lo que llega de la sala
     es lo unico que separa el sistema de un documento cualquiera puesto por un
     tercero, y una defensa que no se puede probar no se sabe si esta. */
  return { iniciar, encender, apagar, alternar, estado, empujar, latido, reponer, aplicar,
           peso, hayQueSubir, queHacerConLoQueLlega,
           esBaseCreible };
})();
