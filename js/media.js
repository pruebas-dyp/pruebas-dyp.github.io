/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   LAS FOTOS Y LAS FIRMAS.

   Por qué esto es un archivo aparte y no una tabla más del repositorio:

   · Los binarios NO caben en localStorage. El límite del navegador son 5 a
     10 MB y en el sistema actual hay **~47 fotos por orden**. Una sola
     recepción sin comprimir se come la cuota entera y el sistema deja de
     guardar, en silencio.

   · Por eso: los BYTES van en IndexedDB, que no tiene ese techo, y en
     `db.media` queda solo la ficha —id, orden, etapa, tamaño, medidas—, que
     es texto y sí cabe. Es la misma separación que va a haber en producción
     entre el bucket de objetos y la fila en Postgres.

   ── La compresión, y por qué es un argumento de venta ────────────────────

   El cliente tiene 650 GB y borra las fotos al año **por falta de disco**,
   no por política — y al mismo tiempo la Superintendencia le exige un año de
   trazabilidad para poder trabajar con las aseguradoras. Las dos cosas
   chocan, y la que pierde es la obligación.

   A 180 vehículos al mes con ~47 fotos de ~3 MB, la proyección es de
   **~296 GB al año**. Comprimiendo a ~350 KB con el lado largo en 1600 px,
   baja a **~34 GB**. *(Cálculo nuestro sobre supuestos declarados, no una
   medición: así hay que rotularlo donde se escriba.)*

   El número que importa mostrar en pantalla es el de cada foto: `4,2 MB →
   340 KB`. Ese es el que hace entender por qué el problema se resuelve.
   ──────────────────────────────────────────────────────────────────────── */

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
      return conAlmacen('readwrite', (st) => st.put(r.blob, id)).then(() => ({
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
        creado_at: HOY
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
    return conAlmacen('readwrite', (st) => st.put(blob, id)).then(() => ({
      id,
      ot_id: (ficha && ficha.ot_id) || null,
      recepcion_id: (ficha && ficha.recepcion_id) || null,
      etapa_id: null,
      momento: (ficha && ficha.momento) || 'firma',
      nombre: (ficha && ficha.nombre) || 'firma.png',
      mime: blob.type, bytes_original: blob.size, bytes: blob.size,
      ancho: (ficha && ficha.ancho) || null, alto: (ficha && ficha.alto) || null,
      creado_at: HOY
    }));
  }

  const obtener = (id) => conAlmacen('readonly', (st) => st.get(id));

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
        if (!u) { img.alt = 'La imagen no está en este navegador'; return; }
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

  /* Borra TODO lo binario. Lo usa Archivo → Reiniciar a datos de demostración:
     si no, las fotos quedarían huérfanas en IndexedDB para siempre. */
  function vaciar() {
    return conAlmacen('readwrite', (st) => st.clear());
  }

  return { guardar, guardarBlob, subir, obtener, url, eliminar, pintar, resumen, fPeso, vaciar,
           ladoMax, objetivoBytes, comprimeSiempre };
})();
