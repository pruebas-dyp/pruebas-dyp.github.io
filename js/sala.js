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
     proyecto, no una contraseña. Lo que protege la base son sus políticas,
     y acá están abiertas porque los datos son de demostración. */
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
  function aplicar(fila) {
    if (!fila || !fila.db) return false;
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

  return { iniciar, encender, apagar, alternar, estado, empujar, latido };
})();
