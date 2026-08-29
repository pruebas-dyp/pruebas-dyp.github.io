/* LAS FOTOS Y LAS FIRMAS.

   Archivo aparte del repositorio porque los binarios NO caben en localStorage: el límite
   del navegador son 5 a 10 MB y una sola foto de teléfono los llena. Viven en IndexedDB.

   Detalle y decisiones: 00 Documentacion/DECISIONES.md · js/media.js */

const Media = (function () {

  const BASE = 'dyp-media';
  const ALMACEN = 'archivos';
  const CALIDADES = [0.86, 0.78, 0.68, 0.58, 0.46];

  /* Los tres van a Configuración: nadie en el taller tiene por qué saber
     comprimir una foto, pero si alguna vez hace falta el original íntegro
     —un peritaje, un juicio— hay que poder apagarlo sabiendo lo que cuesta. */
  const par = (clave, x) => {
    try { return Reglas.parametro(Modelo.base(), clave, x); } catch (e) { return x; }
  };
  const ladoMax = () => Number(par('foto_lado_max', 1600));
  const objetivoBytes = () => Number(par('foto_objetivo_kb', 350)) * 1024;
  const comprimeSiempre = () => par('comprimir_fotos', 'si') !== 'no';

  /* 🔴 LA FECHA DE UN ARCHIVO ES LA DE AHORA, NO LA DEL DÍA A MEDIANOCHE.
     23-08-2026, Marco: «cuando uno carga una foto o un documento al panel de
     Documentos, la fecha que sale no se está linkeando con la fecha actual».

     Eran dos cosas a la vez y las dos se arreglaron. `HOY` estaba clavado en el
     12-08-2026 —el día del levantamiento— así que TODO nacía con esa fecha; eso
     se corrigió en `semilla.js`. Y aun con `HOY` bien, `HOY` es el día **a
     medianoche**: dos documentos cargados con horas de diferencia salían con la
     misma hora, 00:00, y en la lista de un expediente no se podía saber cuál
     entró primero.

     `Modelo.ahora()` junta el día del sistema con el reloj del computador, que
     es lo que usa el resto del motor para todo lo que alguien escribe. Con la
     guarda por si `Modelo` no está —el arnés de consola carga `media.js` sin él. */
  const cuando = () => {
    try { return Modelo.ahora(); } catch (e) { return new Date(HOY.getTime()); }
  };

  let _bd = null;

  function abrir() {
    if (_bd) return Promise.resolve(_bd);
    return new Promise((resolver, rechazar) => {
      const sol = indexedDB.open(BASE, 1);
      sol.onupgradeneeded = () => {
        const bd = sol.result;
        if (!bd.objectStoreNames.contains(ALMACEN)) bd.createObjectStore(ALMACEN);
      };
      sol.onsuccess = () => { _bd = sol.result; resolver(_bd); };
      sol.onerror = () => rechazar(sol.error);
    });
  }

  function conAlmacen(modo, fn) {
    return abrir().then((bd) => new Promise((resolver, rechazar) => {
      const tx = bd.transaction(ALMACEN, modo);
      const pedido = fn(tx.objectStore(ALMACEN));
      tx.oncomplete = () => resolver(pedido && pedido.result);
      tx.onerror = () => rechazar(tx.error);
      tx.onabort = () => rechazar(tx.error);
    }));
  }

  /* ── Compresión en el navegador ────────────────────────────────────────
     Se baja la calidad por pasos hasta llegar al objetivo. Si ni con la más
     baja se llega, se guarda igual: mejor una foto pesada que ninguna, y el
     tamaño real queda registrado para poder mostrarlo. */

  function comprimir(archivo) {
    return new Promise((resolver, rechazar) => {
      if (!/^image\//.test(archivo.type)) {
        return rechazar(new Error('"' + archivo.name + '" no es una imagen. Por ahora solo se aceptan fotos.'));
      }
      const url = URL.createObjectURL(archivo);
      const img = new Image();
      img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('No se pudo leer "' + archivo.name + '".')); };
      img.onload = () => {
        URL.revokeObjectURL(url);

        // Configuración manda: si está apagada, se guarda el archivo tal cual.
        if (!comprimeSiempre()) {
          return resolver({ blob: archivo, ancho: img.width, alto: img.height, calidad: null, sinComprimir: true });
        }

        const lado = ladoMax();
        const escala = Math.min(1, lado / Math.max(img.width, img.height));
        const ancho = Math.round(img.width * escala);
        const alto = Math.round(img.height * escala);

        const lienzo = document.createElement('canvas');
        lienzo.width = ancho; lienzo.height = alto;
        const ctx = lienzo.getContext('2d');
        // Suavizado alto: es lo que evita que la foto se vea "picada" al achicar.
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, ancho, alto);

        const objetivo = objetivoBytes();
        const intentar = (i) => {
          lienzo.toBlob((blob) => {
            if (!blob) return rechazar(new Error('El navegador no pudo comprimir "' + archivo.name + '".'));
            // Si el original ya pesaba menos que el comprimido, se guarda el
            // original: comprimir una foto chica solo la empeora.
            if (i === 0 && archivo.size <= blob.size) {
              return resolver({ blob: archivo, ancho: img.width, alto: img.height, calidad: null, sinComprimir: true });
            }
            if (blob.size <= objetivo || i >= CALIDADES.length - 1) {
              return resolver({ blob, ancho, alto, calidad: CALIDADES[i] });
            }
            intentar(i + 1);
          }, 'image/jpeg', CALIDADES[i]);
        };
        intentar(0);
      };
      img.src = url;
    });
  }

  /* ── Guardar ───────────────────────────────────────────────────────────
     Devuelve la ficha, que es lo que se persiste en `db.media`. Los bytes se
     quedan en IndexedDB y NO viajan al repositorio. */

  function guardar(archivo, ficha) {
    return comprimir(archivo).then((r) => {
      const id = 'me-' + Date.now().toString(36) + '-' + Math.round(performance.now() * 1000).toString(36);
      return conAlmacen('readwrite', (st) => st.put(r.blob, id))
        // La copia liviana sale hacia la sala en cuanto el archivo está seguro
        // acá. Si falla, la foto igual quedó guardada: ver `mandarALaSala`.
        .then(() => mandarALaSala(id, r.blob))
        .then(() => ({
        id,
        ot_id: (ficha && ficha.ot_id) || null,
        recepcion_id: (ficha && ficha.recepcion_id) || null,
        etapa_id: (ficha && ficha.etapa_id) || null,
        momento: (ficha && ficha.momento) || 'ingreso',
        nombre: archivo.name || 'foto.jpg',
        mime: r.blob.type,
        bytes_original: archivo.size,
        bytes: r.blob.size,
        ancho: r.ancho, alto: r.alto,
        sin_comprimir: !!r.sinComprimir,
        creado_at: cuando()
      }));
    });
  }

  /* ── Subir varias, con progreso ────────────────────────────────────────
     Es la vía que usan todas las pantallas. Existe por una razón muy
     concreta: comprimir una foto de celular toma entre 1 y 4 segundos, y sin
     un indicador el usuario aprieta, no pasa nada, y concluye que el sistema
     no funciona. Pasó en la primera prueba. */

  function subir(archivos, ficha, alAvanzar) {
    const lista = Array.from(archivos || []);
    const fichas = [], errores = [];
    if (!lista.length) return Promise.resolve({ fichas, errores });

    const paso = (i) => {
      if (i >= lista.length) return Promise.resolve({ fichas, errores });
      if (alAvanzar) alAvanzar(i, lista.length, lista[i].name);
      return guardar(lista[i], ficha)
        .then((f) => { fichas.push(f); })
        .catch((e) => { errores.push(e.message); })
        .then(() => paso(i + 1));
    };
    return paso(0).then(() => {
      if (alAvanzar) alAvanzar(lista.length, lista.length, null);
      return { fichas, errores };
    });
  }

  /* Guarda un blob ya listo (la firma del cliente, que sale de un canvas y
     pesa unos pocos KB: no se comprime). */
  function guardarBlob(blob, ficha) {
    const id = 'me-' + Date.now().toString(36) + '-' + Math.round(performance.now() * 1000).toString(36);
    return conAlmacen('readwrite', (st) => st.put(blob, id))
      .then(() => mandarALaSala(id, blob))
      .then(() => ({
      id,
      ot_id: (ficha && ficha.ot_id) || null,
      recepcion_id: (ficha && ficha.recepcion_id) || null,
      etapa_id: null,
      momento: (ficha && ficha.momento) || 'firma',
      nombre: (ficha && ficha.nombre) || 'firma.png',
      mime: blob.type, bytes_original: blob.size, bytes: blob.size,
      ancho: (ficha && ficha.ancho) || null, alto: (ficha && ficha.alto) || null,
      creado_at: cuando()
    }));
  }

  /* ═════ LA COPIA QUE VIAJA ══════════════════════════════════════
     28-08-2026. Los bytes viven en IndexedDB, que es de este navegador y de
     este aparato. La foto que se saca en el teléfono no existía para el
     computador: la ficha viajaba por la sala, el archivo no, y la pantalla
     escribía «la imagen no está en este navegador».

     Acá se arma una copia LIVIANA —1.000 px de lado largo— y se la entrega al
     modelo, que la lleva dentro de su documento. Ver el bloque largo en
     `modelo.js`, junto a `guardar_media_sala`, para el porqué del tamaño y del
     tope.

     La copia se hace sobre el archivo YA COMPRIMIDO, no sobre el original: el
     original de un teléfono son 3 o 4 MB y volver a leerlo entero para achicarlo
     otra vez es trabajo al pedo. */
  const LADO_SALA = 1000;
  const CALIDAD_SALA = 0.62;

  function copiaParaLaSala(blob) {
    return new Promise((resolver) => {
      if (!/^image\//.test(blob.type)) return resolver(null);   // un PDF no se achica
      const u = URL.createObjectURL(blob);
      const img = new Image();
      img.onerror = () => { URL.revokeObjectURL(u); resolver(null); };
      img.onload = () => {
        URL.revokeObjectURL(u);
        const escala = Math.min(1, LADO_SALA / Math.max(img.width, img.height));
        const w = Math.round(img.width * escala), h = Math.round(img.height * escala);
        const lienzo = document.createElement('canvas');
        lienzo.width = w; lienzo.height = h;
        const ctx = lienzo.getContext('2d');
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        lienzo.toBlob((chico) => resolver(chico || null), 'image/jpeg', CALIDAD_SALA);
      };
      img.src = u;
    });
  }

  const aBase64 = (blob) => new Promise((resolver) => {
    const fr = new FileReader();
    fr.onload = () => { const t = String(fr.result); resolver(t.slice(t.indexOf(',') + 1)); };
    fr.onerror = () => resolver(null);
    fr.readAsDataURL(blob);
  });

  function deBase64(b64, mime) {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime || 'image/jpeg' });
  }

  /* Deja la copia en el documento del modelo. Falla en silencio a propósito: si
     no se puede —no hay `Modelo`, se pasó del tope— la foto igual quedó guardada
     acá, que es lo que importa. Lo único que se pierde es que la vean los otros
     aparatos, y eso lo dice la pantalla de Fotografías. */
  function mandarALaSala(id, blob) {
    return copiaParaLaSala(blob).then((chico) => {
      if (!chico) return null;
      return aBase64(chico).then((b64) => {
        if (!b64) return null;
        try { return Modelo.guardar_media_sala(id, chico.type, b64, chico.size); }
        catch (e) { return null; }
      });
    }).catch(() => null);
  }

  /* 🔴 PRIMERO ACÁ, DESPUÉS LA SALA. Si el archivo no está en este navegador
     pero sí viajó en el documento, se rearma, se guarda acá —para no rearmarlo
     en cada pintada— y se devuelve. La primera vez cuesta unos milisegundos;
     de ahí en adelante es igual de rápido que una foto propia. */
  function obtener(id) {
    return conAlmacen('readonly', (st) => st.get(id)).then((blob) => {
      if (blob) return blob;
      let fila = null;
      try { fila = Modelo.mediaSala(id); } catch (e) { fila = null; }
      if (!fila || !fila.b64) return null;
      let rearmado;
      try { rearmado = deBase64(fila.b64, fila.mime); } catch (e) { return null; }
      return conAlmacen('readwrite', (st) => st.put(rearmado, id))
        .then(() => rearmado).catch(() => rearmado);
    });
  }

  /* Devuelve una URL utilizable en un <img>. Quien la pide se hace cargo de
     revocarla: si no, cada repintado filtra memoria. */
  function url(id) {
    return obtener(id).then((blob) => (blob ? URL.createObjectURL(blob) : null));
  }

  const eliminar = (id) => conAlmacen('readwrite', (st) => st.delete(id));

  /* Pinta un <img data-media="id"> resolviendo el blob. Se llama después de
     cada render, porque el HTML se vuelve a armar entero. */
  function pintar(raiz) {
    const nodos = (raiz || document).querySelectorAll('img[data-media]:not([data-media-listo])');
    nodos.forEach((img) => {
      img.dataset.mediaListo = '1';
      url(img.dataset.media).then((u) => {
        if (!u) {
          /* Ya no basta con decir «no está acá»: desde hoy las fotos viajan, así
             que si no llegó es porque su copia se pasó del tope de la sala o
             porque se subió antes de que esto existiera. Se dice cuál de las
             dos, y dónde sí está. */
          img.alt = 'La foto está en el aparato donde se tomó. Su copia no viajó ' +
            'por la sala compartida — se pasó del tope, o se subió antes de que ' +
            'las fotos viajaran.';
          img.classList.add('sin-copia');
          return;
        }
        img.src = u;
        // Se revoca cuando el nodo deja el documento.
        img.addEventListener('load', () => setTimeout(() => URL.revokeObjectURL(u), 60000), { once: true });
      }).catch(() => { img.alt = 'No se pudo leer la imagen'; });
    });
  }

  /* Cuánto ocupa todo lo guardado. Es el número que hace la conversación de
     almacenamiento. */
  function resumen(fichas) {
    const orig = fichas.reduce((s, f) => s + (f.bytes_original || 0), 0);
    const fin = fichas.reduce((s, f) => s + (f.bytes || 0), 0);
    return {
      cantidad: fichas.length, bytesOriginal: orig, bytes: fin,
      ahorro: orig ? Math.round((1 - fin / orig) * 100) : 0
    };
  }

  const fPeso = (b) => (b == null ? '—'
    : b < 1024 ? b + ' B'
    : b < 1024 * 1024 ? (b / 1024).toFixed(0) + ' KB'
    : (b / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB');

  /* ── Bajar un set de fotos en una sola carpeta ──────────────────────────
     🔴 26-08-2026. Marco lo pidió por escrito y en la visita se dijo tres
     veces, una de ellas textual: «agarrar todas estas fotos, las de recepción y
     las que tomé yo, y guardarlas todas juntas. Eso, chiquillos, es muy
     importante». Es su trabajo de todos los días: baja el set, borra las que no
     sirven, y le manda el resto al liquidador.

     ⚠️ EL ZIP ESTÁ ESCRITO ACÁ, A MANO, Y NO ES CAPRICHO. Este sistema no tiene
     una sola dependencia y no la va a tener por esto: bajar una librería de
     compresión para juntar diez JPG serían cientos de kilobytes que el taller
     descarga cada vez, para ahorrar lo que un JPG —ya comprimido— no ahorra.

     Por eso el ZIP va en modo ALMACENADO (método 0, sin comprimir): el formato
     lo permite, cualquier Windows lo abre con doble clic, y son sesenta líneas
     que se leen enteras. Lo único que hay que hacer bien es el CRC-32, que es
     lo de abajo. */
  const TABLA_CRC = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /* Nombres de archivo: sin tildes, sin barras y sin dos iguales. Un ZIP con
     dos entradas del mismo nombre lo abre igual, y deja una sola adentro. */
  function nombresUnicos(fichas) {
    const usados = {};
    return fichas.map((f, i) => {
      /* El campo es `mime`, no `tipo`. Escrito como `tipo` —que es como se
         llama en media otras veces— la extensión salía SIEMPRE .jpg, y un PNG
         renombrado a .jpg lo abre igual media cosa y ninguna otra. Lo cazó la
         primera corrida en el navegador, no las pruebas. */
      const m = String(f.mime || f.tipo || '');
      const ext = m.indexOf('png') >= 0 ? '.png'
        : m.indexOf('pdf') >= 0 ? '.pdf'
        : m.indexOf('webp') >= 0 ? '.webp' : '.jpg';
      let base = String((i + 1) + '-' + (f.momento || 'foto'))
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9._-]/g, '-');
      let nombre = base + ext, n = 2;
      while (usados[nombre]) { nombre = base + '-' + (n++) + ext; }
      usados[nombre] = true;
      return nombre;
    });
  }

  /* Arma el ZIP con los blobs que ya están en IndexedDB. Devuelve un Blob. */
  function empaquetar(fichas) {
    const nombres = nombresUnicos(fichas);
    return Promise.all(fichas.map((f) => obtener(f.id)))
      .then((blobs) => Promise.all(blobs.map((b) => (b ? b.arrayBuffer() : null))))
      .then((bufs) => {
        const partes = [], central = [];
        let desplazamiento = 0;
        const cod = new TextEncoder();

        bufs.forEach((buf, i) => {
          if (!buf) return;                       // la foto no está en este navegador
          const datos = new Uint8Array(buf);
          const nombre = cod.encode(nombres[i]);
          const crc = crc32(datos);

          const local = new DataView(new ArrayBuffer(30));
          local.setUint32(0, 0x04034b50, true);   // firma de entrada local
          local.setUint16(4, 20, true);           // versión necesaria
          local.setUint16(6, 0, true);            // sin banderas
          local.setUint16(8, 0, true);            // método 0 = almacenado
          local.setUint16(10, 0, true); local.setUint16(12, 0, true);  // hora y fecha
          local.setUint32(14, crc, true);
          local.setUint32(18, datos.length, true);
          local.setUint32(22, datos.length, true);
          local.setUint16(26, nombre.length, true);
          local.setUint16(28, 0, true);
          partes.push(new Uint8Array(local.buffer), nombre, datos);

          const dir = new DataView(new ArrayBuffer(46));
          dir.setUint32(0, 0x02014b50, true);     // firma del directorio central
          dir.setUint16(4, 20, true); dir.setUint16(6, 20, true);
          dir.setUint16(8, 0, true); dir.setUint16(10, 0, true);
          dir.setUint16(12, 0, true); dir.setUint16(14, 0, true);
          dir.setUint32(16, crc, true);
          dir.setUint32(20, datos.length, true);
          dir.setUint32(24, datos.length, true);
          dir.setUint16(28, nombre.length, true);
          dir.setUint32(42, desplazamiento, true);
          central.push(new Uint8Array(dir.buffer), nombre);

          desplazamiento += 30 + nombre.length + datos.length;
        });

        const largoCentral = central.reduce((n, p) => n + p.length, 0);
        const fin = new DataView(new ArrayBuffer(22));
        fin.setUint32(0, 0x06054b50, true);       // firma del cierre
        fin.setUint16(8, central.length / 2, true);
        fin.setUint16(10, central.length / 2, true);
        fin.setUint32(12, largoCentral, true);
        fin.setUint32(16, desplazamiento, true);

        return new Blob(partes.concat(central, [new Uint8Array(fin.buffer)]),
          { type: 'application/zip' });
      });
  }

  /* Lo baja con el nombre que le sirve al taller: la patente y la fecha. */
  function bajarCarpeta(fichas, nombre) {
    if (!fichas || !fichas.length) return Promise.resolve(0);
    return empaquetar(fichas).then((zip) => {
      const u = URL.createObjectURL(zip);
      const a = document.createElement('a');
      a.href = u; a.download = (nombre || 'fotos') + '.zip';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 30000);
      return fichas.length;
    });
  }

  /* Borra TODO lo binario. Lo usa Archivo → Reiniciar a datos de demostración:
     si no, las fotos quedarían huérfanas en IndexedDB para siempre. */
  function vaciar() {
    return conAlmacen('readwrite', (st) => st.clear());
  }

  /* Cuántas de las fotos de esta lista se ven en los DEMÁS aparatos. Es lo que
     la pantalla de Fotografías necesita para no prometer de más. */
  function viajan(fichas) {
    let si = 0;
    (fichas || []).forEach((f) => {
      try { if (Modelo.mediaSala(f.id)) si++; } catch (e) { /* sin modelo */ }
    });
    return { viajan: si, total: (fichas || []).length };
  }

  return { guardar, guardarBlob, subir, obtener, url, eliminar, pintar, resumen, fPeso, vaciar, viajan,
    empaquetar, bajarCarpeta,
           ladoMax, objetivoBytes, comprimeSiempre };
})();
