/* QUE EL SISTEMA SE PUEDA USAR SIN VER LA PANTALLA — SIS-3, 23-08-2026.

   Dos cosas, y las dos son de una sola línea para el resto del código:

   1. `Acceso.etiquetar(raiz)` amarra cada `<label>` con su campo. Las etiquetas
      YA estaban escritas —81 `<div class="campo">` con su `<label>` adentro—
      pero ninguna decía a qué campo pertenece. Sin ese amarre, un lector de
      pantalla anuncia «campo de texto» y nada más, y hacer clic en el texto de
      la etiqueta no pone el foco en el campo, que es comodidad para todos.

      Medido antes de esto: **118 campos, 2 `label for`**.

   2. `Acceso.anunciar(texto)` dice en voz alta lo que pasó. El sistema tenía
      **cero** regiones `aria-live`: los avisos aparecían en pantalla y no se
      anunciaban a nadie.

   ⚠️ POR QUÉ ESTO CORRE DESPUÉS DE PINTAR Y NO SE ESCRIBE EN CADA VISTA.
   El HTML se arma como texto en veinte archivos distintos, y arreglar 118
   campos a mano es garantizar que el 119 nazca sin etiqueta. Acá es un solo
   lugar, se prueba una vez, y vale para lo que venga. Es el mismo patrón que
   `Media.pintar()`, que ya se llama después de cada render por la misma razón.

   Detalle y decisiones: 00 Documentacion/DECISIONES.md · js/acceso.js */

const Acceso = (function () {
  'use strict';

  const CONTROLES = 'input, select, textarea';
  let secuencia = 0;

  /* Los que no llevan etiqueta y no la necesitan: el buscador ya se explica
     solo con su lupa y su `placeholder`, y una casilla dentro de una fila de
     tabla toma el nombre de su fila. Para esos se usa `aria-label`. */
  function textoDeRespaldo(control) {
    const ph = control.getAttribute('placeholder');
    if (ph) return ph;
    const t = control.getAttribute('title');
    if (t) return t;
    /* Un `<select>` no puede llevar `placeholder`, y los filtros de este
       sistema no llevan etiqueta escrita: se explican con su primera opción,
       que por convención de la casa es la que dice «todo» — «Todas las
       compañías», «Todas las etapas». Ese texto ES el nombre del filtro, así
       que sirve tal cual y no hay que inventar ninguno. */
    if (control.tagName === 'SELECT' && control.options && control.options.length) {
      const primera = (control.options[0].textContent || '').trim();
      if (primera) return primera;
    }
    return null;
  }

  function idPara(control) {
    if (control.id) return control.id;
    control.id = 'ac-' + (++secuencia);
    return control.id;
  }

  /* Amarra lo que se pueda dentro de `raiz`. Devuelve el recuento, que es lo
     que mira la prueba: un arreglo que no se puede contar no se puede defender. */
  function etiquetar(raiz) {
    const donde = raiz || document;
    const controles = donde.querySelectorAll(CONTROLES);
    let amarrados = 0, conRespaldo = 0, sinNada = 0;

    controles.forEach((control) => {
      // Ya tiene nombre accesible: no se toca.
      if (control.getAttribute('aria-label') || control.getAttribute('aria-labelledby')) return;
      if (control.id && donde.querySelector('label[for="' + control.id + '"]')) return;

      /* La etiqueta que le corresponde es la del envoltorio más cercano, y sólo
         si ese envoltorio tiene UN control. Con dos —un rango de fechas, por
         ejemplo— no se puede saber cuál es cuál, y adivinar mal es peor que no
         etiquetar: el lector diría el nombre equivocado. */
      const caja = control.closest('.campo, .campo-linea, label');
      const etiqueta = caja && (caja.tagName === 'LABEL' ? caja : caja.querySelector('label'));
      const unoSolo = caja && caja.querySelectorAll(CONTROLES).length === 1;

      if (etiqueta && unoSolo && !etiqueta.getAttribute('for')) {
        etiqueta.setAttribute('for', idPara(control));
        amarrados++;
        return;
      }

      const respaldo = textoDeRespaldo(control);
      if (respaldo) { control.setAttribute('aria-label', respaldo); conRespaldo++; return; }

      sinNada++;
    });

    return { controles: controles.length, amarrados, conRespaldo, sinNada };
  }

  /* ── Decirlo en voz alta ─────────────────────────────────────────────── */

  /* Una sola región para todo el sistema. `polite` espera a que el lector
     termine lo que está diciendo; `assertive` interrumpe, y por eso se reserva
     para lo que salió mal. */
  function region(urgente) {
    const id = urgente ? 'anuncio-urgente' : 'anuncio';
    let r = document.getElementById(id);
    if (r) return r;
    r = document.createElement('div');
    r.id = id;
    r.className = 'solo-lectores';
    r.setAttribute('role', 'status');
    r.setAttribute('aria-live', urgente ? 'assertive' : 'polite');
    r.setAttribute('aria-atomic', 'true');
    document.body.appendChild(r);
    return r;
  }

  /* ⚠️ El texto se limpia y se vuelve a poner en el latido siguiente. Sin eso,
     dos avisos iguales seguidos —«Guardado», «Guardado»— no se anuncian la
     segunda vez: el lector compara el contenido y no ve ningún cambio. */
  function anunciar(texto, urgente) {
    const r = region(!!urgente);
    r.textContent = '';
    setTimeout(() => { r.textContent = String(texto || ''); }, 30);
  }

  return { etiquetar, anunciar };
})();
