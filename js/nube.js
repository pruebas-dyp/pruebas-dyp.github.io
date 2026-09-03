/* LA NUBE — las fotos viven en Google Cloud, no en el navegador.

   El bucket es `dyp-taller-fotos`, en Santiago, dentro del proyecto de Google Cloud
   `dyp-control-taller`. Las fotos van del teléfono DIRECTO al bucket: no pasan por
   ningún servidor nuestro.

   Detalle y decisiones: 00 Documentacion/DECISIONES.md · js/nube.js */

const Nube = (function () {
  'use strict';

  /* 🔴 POR QUÉ FIREBASE Y NO UNA FUNCIÓN NUESTRA (29-08-2026).

     El primer intento fue una función en Cloud Run que firmara las direcciones.
     Está escrita, desplegada y probada — y no se puede encender: para que el
     navegador la llame hay que darle permiso de IAM a «cualquiera», y la
     organización `arttmize.com` tiene una política que sólo permite dar
     permisos a gente del dominio. Medido contra la base real: la llamada vuelve
     con `iam.allowedPolicyMemberDomains`. Abrir esa política es un cambio en la
     organización entera y la cuenta no tiene ese poder.

     Firebase resuelve lo mismo SIN tocar IAM: le da al navegador una identidad
     anónima de un solo uso, y unas reglas propias —que viven en el proyecto—
     dicen qué puede hacer con ella. Es el MISMO Google Cloud, el MISMO bucket y
     la MISMA región; lo único distinto es por qué puerta entra.

     Las reglas, tal como están publicadas sobre el bucket:

       · sólo bajo `/fotos/`, fuera de ahí no se lee ni se escribe
       · sólo con identidad — sin ella no se puede ni mirar
       · sólo imágenes y PDF, hasta 8 MB
       · nunca borrar: una foto de recepción es parte de un documento firmado

     Probado contra el bucket de verdad: con identidad baja (200); sin identidad
     leer y escribir dan 403; con identidad pero fuera de `/fotos/`, 403; borrar,
     403. */

  const PROYECTO = 'dyp-control-taller';
  const BUCKET   = 'dyp-taller-fotos';

  /* Llave pública de la aplicación web. Va en el navegador a propósito, igual
     que la de la sala: identifica al proyecto, no es una contraseña. Lo que
     protege el bucket son las reglas de arriba. */
  const LLAVE = 'AIzaSyCqN-1UWVbh92gm2p520Cdap3LQhRuXhzs';

  const IDENTIDAD = 'https://identitytoolkit.googleapis.com/v1';
  const ALMACEN   = 'https://firebasestorage.googleapis.com/v0/b/' + BUCKET + '/o';
  const CLAVE_YO  = 'dyp-nube-identidad';

  /* ⚠️ CUÁNTO SE ESPERA ANTES DE DARSE POR VENCIDO.

     `fetch` no tiene tiempo límite propio: con señal mala el teléfono se queda
     esperando para siempre y la pantalla de fotos se congela. En el taller eso
     se ve como que el sistema se coló, y la persona vuelve a apretar.

     Con tope, la foto cae sola al respaldo de la sala y el trabajo sigue. 30
     segundos NO es lo que se espera normalmente —una foto de 300 KB sube en
     medio segundo— sino el techo de una conexión trabada. La identidad tiene
     un tope más corto porque son 200 bytes: si eso no llega en 10 segundos, no
     hay red. */
  const TOPE_ESPERA = 30000;
  const TOPE_ESPERA_IDENTIDAD = 10000;

  /* `fetch` con reloj. `AbortController` es lo único que corta una petición de
     verdad; sin él la promesa queda colgada aunque nadie la mire. */
  async function pedir(url, opciones, tope) {
    const corte = new AbortController();
    const reloj = setTimeout(() => corte.abort(), tope || TOPE_ESPERA);
    try {
      return await fetch(url, Object.assign({}, opciones, { signal: corte.signal }));
    } finally {
      clearTimeout(reloj);
    }
  }

  let sesion = null;          // { idToken, refreshToken, vence }
  let pidiendo = null;        // la promesa en curso, para no pedir dos veces
  let ultimoError = null;

  const ahora = () => Date.now();

  /* ── La identidad ─────────────────────────────────────────────────────
     Se guarda para no pedir una nueva en cada pantalla: el `refreshToken` no
     vence, así que el mismo aparato conserva su identidad entre visitas. Si el
     navegador no tiene dónde guardar, se pide una nueva y funciona igual. */

  function guardada() {
    try { return JSON.parse(localStorage.getItem(CLAVE_YO) || 'null'); }
    catch (e) { return null; }
  }
  function guardar(s) {
    try { localStorage.setItem(CLAVE_YO, JSON.stringify(s)); }
    catch (e) { /* sin almacenamiento: la identidad dura lo que la pestaña */ }
  }

  async function nueva() {
    const r = await pedir(IDENTIDAD + '/accounts:signUp?key=' + LLAVE, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true })
    }, TOPE_ESPERA_IDENTIDAD);
    if (!r.ok) throw new Error('No se pudo abrir la identidad: HTTP ' + r.status);
    const d = await r.json();
    return { idToken: d.idToken, refreshToken: d.refreshToken,
      vence: ahora() + (Number(d.expiresIn || 3600) - 120) * 1000 };
  }

  async function refrescar(refreshToken) {
    const r = await pedir('https://securetoken.googleapis.com/v1/token?key=' + LLAVE, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(refreshToken)
    }, TOPE_ESPERA_IDENTIDAD);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    return { idToken: d.id_token, refreshToken: d.refresh_token,
      vence: ahora() + (Number(d.expires_in || 3600) - 120) * 1000 };
  }

  /* Devuelve un token vigente. Tres caminos, en orden de costo: el que está en
     memoria, el que se puede refrescar, y una identidad nueva. */
  function token() {
    if (sesion && sesion.vence > ahora()) return Promise.resolve(sesion.idToken);
    if (pidiendo) return pidiendo;

    pidiendo = (async () => {
      const g = sesion || guardada();
      if (g && g.refreshToken) {
        try {
          sesion = await refrescar(g.refreshToken);
          guardar(sesion); return sesion.idToken;
        } catch (e) { /* el refresco falló: se pide una nueva */ }
      }
      sesion = await nueva();
      guardar(sesion);
      return sesion.idToken;
    })().finally(() => { pidiendo = null; });

    return pidiendo;
  }

  /* ── Subir y bajar ────────────────────────────────────────────────────
     El nombre del objeto lo arma ACÁ y con azar del navegador: nunca con el
     nombre del archivo, que puede traer la patente o el nombre de un cliente.
     Una dirección de foto no tiene por qué contar de quién es el auto. */

  function nombreNuevo(mime) {
    const ext = mime === 'image/png' ? 'png'
      : mime === 'image/webp' ? 'webp'
      : mime === 'application/pdf' ? 'pdf' : 'jpg';
    const azar = Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map((b) => b.toString(16).padStart(2, '0')).join('');
    const d = new Date();
    const dia = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
    return 'fotos/' + dia + '/' + azar + '.' + ext;
  }

  /* Sube el archivo y devuelve la ruta del objeto, que es lo que se guarda en
     la ficha de la foto y viaja por la sala a los demás aparatos.

     Devuelve `null` si no se pudo — sin internet, sin permiso, lo que sea. NO
     lanza: quien llama tiene que poder seguir guardando la foto en su navegador
     igual. La nube es una mejora, no una condición para trabajar. */
  async function subir(blob) {
    try {
      const tk = await token();
      const objeto = nombreNuevo(blob.type);
      const r = await pedir(ALMACEN + '?name=' + encodeURIComponent(objeto), {
        method: 'POST',
        headers: { 'Authorization': 'Firebase ' + tk, 'Content-Type': blob.type || 'image/jpeg' },
        body: blob
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      ultimoError = null;
      return objeto;
    } catch (e) {
      ultimoError = e.message;
      return null;
    }
  }

  /* Baja el objeto y devuelve su Blob, o `null`. Igual que arriba: no lanza. */
  async function bajar(objeto) {
    if (!objeto) return null;
    try {
      const tk = await token();
      const r = await pedir(ALMACEN + '/' + encodeURIComponent(objeto) + '?alt=media', {
        headers: { 'Authorization': 'Firebase ' + tk }
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      ultimoError = null;
      return await r.blob();
    } catch (e) {
      ultimoError = e.message;
      return null;
    }
  }

  /* Para la pantalla: si la nube está respondiendo o no. Se prueba pidiendo la
     identidad, que es la parte barata y la que falla primero cuando algo anda
     mal —sin internet, llave revocada, proyecto apagado—. */
  async function probar() {
    try { await token(); return { ok: true, motivo: '' }; }
    catch (e) { return { ok: false, motivo: e.message }; }
  }

  const donde = () => ({ proyecto: PROYECTO, bucket: BUCKET, region: 'southamerica-west1' });
  const problema = () => ultimoError;

  /* `token` sale afuera para que la BASE use la MISMA identidad que las fotos.
     Son dos servicios distintos —Firestore y el bucket— del mismo proyecto, y
     pedir dos identidades anonimas al mismo aparato seria pedir dos veces lo
     mismo: el doble de llamadas y dos sesiones que vencen por separado. */
  return { subir, bajar, probar, donde, problema, token, LLAVE, BUCKET, PROYECTO };
})();
