/* ═══════════════════════════════════════════════════════════════════════
   LA SALA COMPARTIDA — que el celular y el computador vean lo mismo
   ───────────────────────────────────────────────────────────────────────
   POR QUÉ EXISTE. El modelo borrador guarda todo en el almacenamiento del
   navegador, así que cada dispositivo abría su propia copia: se creaba una
   orden en el teléfono y en el computador no aparecía. Con razón —no había
   nada en el medio—, pero era imposible de explicar y parecía una falla.

   QUÉ ES, Y QUÉ NO ES. Esto NO es el modelo de datos del sistema. El modelo
   real va tabla por tabla, con sus restricciones y su seguridad por rol, y
   es el hito H1 de la carta gantt. Esto es un PUENTE: manda el estado
   completo como un solo documento y avisa a los demás que hay algo nuevo.

   Existe así por una razón concreta: el motor del borrador es síncrono de
   punta a punta —cada operación responde en el acto—, y hablarle a una base
   de datos es asíncrono. Convertirlo obligaría a reescribir sus cincuenta
   operaciones y todas las pantallas. El puente no toca ni una línea del
   motor: mueve el mismo texto que el modelo ya guarda.

   🔴 SOLO DATOS DE DEMOSTRACIÓN. La sala se lee y se escribe sin
   identificarse, y eso se acepta únicamente porque lo que hay dentro es
   inventado: patente AABB11, RUT 11.111.111-1, «Cliente de Prueba». Acá no
   entra el RUT, el domicilio ni la fotografía de una persona real.

   SIN LIBRERÍAS. Se habla con la base por `fetch`, como cualquier dirección
   de internet. No se carga ningún paquete de terceros: el borrador sigue
   siendo HTML, CSS y JavaScript, y si mañana esto se apaga, el sistema
   funciona igual.
   ═══════════════════════════════════════════════════════════════════════ */

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

  async function subir(version) {
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
    aplicando = true;
    try {
      localStorage.setItem(Modelo.CLAVE, JSON.stringify(fila.db));
      const ok = Modelo.recargarDeDisco();
      versionVista = Number(fila.version) || versionVista;
      versionEnviada = Modelo.version();   // lo que acabo de aplicar ya está en la sala
      if (ok && typeof render === 'function') render();
      return ok;
    } catch (e) {
      ultimoError = e && e.message;
      return false;
    } finally { aplicando = false; }
  }

  /* ── El ciclo ────────────────────────────────────────────────────────── */

  async function latido() {
    if (!encendida || sincronizando) return;
    sincronizando = true;
    try {
      const cabeza = await mirar();

      // La sala no existe todavía: la abre el primero que llega.
      if (!cabeza) {
        await subir(1);
        versionVista = 1; versionEnviada = Modelo.version();
        ultimoError = null; return;
      }

      // Alguien más escribió después que yo: traigo lo suyo.
      if (Number(cabeza.version) > versionVista && cabeza.origen !== yo()) {
        const fila = await bajar();
        aplicar(fila);
        ultimoError = null; return;
      }

      // Nadie escribió afuera, pero yo cambié algo acá: lo mando.
      if (!aplicando && Modelo.version() !== versionEnviada) {
        const proxima = Math.max(Number(cabeza.version) || 0, versionVista) + 1;
        await subir(proxima);
        versionVista = proxima; versionEnviada = Modelo.version();
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

  /* ── Encender y apagar ───────────────────────────────────────────────── */

  function encender() {
    if (encendida) return;
    encendida = true;
    try { localStorage.setItem(CLAVE_ON, '1'); } catch (e) { /* nada */ }
    /* Al entrar manda lo que ya está en la sala: si el celular y el
       computador tienen cosas distintas, la referencia es la sala y no el
       equipo, que es justamente lo que se venía a resolver. */
    (async () => {
      try {
        const cabeza = await mirar();
        if (cabeza) { const fila = await bajar(); aplicar(fila); }
        else { await subir(1); versionVista = 1; versionEnviada = Modelo.version(); }
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

  function estado() {
    return {
      encendida: encendida,
      error: ultimoError,
      version: versionVista,
      dispositivo: yo(),
      // Lo que se muestra abajo a la izquierda, en una sola frase.
      rotulo: !encendida ? 'Datos en este equipo'
            : ultimoError ? 'Sala sin conexión'
            : 'Sala compartida'
    };
  }

  /* Arranca sola si quedó encendida la vez anterior. Por omisión está
     ENCENDIDA: es lo que se pidió —probarlo entre el teléfono y el
     computador— y se apaga desde Archivo. */
  function iniciar() {
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
           esBaseCreible };
})();
