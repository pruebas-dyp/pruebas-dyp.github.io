/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   LA ZONA DE FOTOS. Un solo componente para todas las pantallas que suben
   imágenes: recepción, la ficha de la orden, las etapas y documentos.

   Existe por un problema real, no por prolijidad. En la primera prueba el
   sistema "no dejaba subir fotos". Sí dejaba: comprimir una foto de celular
   toma entre 1 y 4 segundos, y en ese rato la pantalla no mostraba
   absolutamente nada. Un input de archivo pelado más un aviso que se va solo
   es indistinguible de un botón roto.

   Lo que hace este componente:
     · Una zona grande y evidente, con botón y con arrastrar-y-soltar.
     · **Progreso visible mientras comprime**, foto por foto y con el nombre.
     · Miniaturas con el peso antes y después.
     · Aguanta que se suban muchas de una: es lo que hace la gente — saca las
       fotos con el celular, las pasa al computador, y después las sube todas
       juntas.
   ──────────────────────────────────────────────────────────────────────── */

const CSS_FOTOS = `
.zona-fotos{border:2px dashed var(--borde-fuerte);border-radius:5px;padding:16px;text-align:center;
  background:var(--superficie-2);transition:border-color .15s,background .15s;cursor:pointer}
.zona-fotos:hover,.zona-fotos.encima{border-color:var(--acento);background:var(--acento-bg)}
.zona-fotos .grande{font-size:13px;font-weight:600;color:var(--tinta);margin-bottom:3px}
.zona-fotos .chico{font-size:11.5px;color:var(--gris)}
.zona-fotos input[type=file]{display:none}
.fotos-progreso{margin-top:9px;display:none}
.fotos-progreso.activo{display:block}
.fotos-progreso .txt{font-size:11.5px;color:var(--tinta);margin-bottom:4px;display:flex;
  justify-content:space-between;gap:8px}
.fotos-rejilla{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.foto-tarjeta{width:132px;border:1px solid var(--borde);border-radius:4px;overflow:hidden;
  background:var(--superficie);position:relative}
.foto-tarjeta img{width:100%;height:94px;object-fit:cover;display:block;background:var(--superficie-2)}
.foto-tarjeta .pie-foto{padding:4px 5px;font-size:10px;color:var(--gris);line-height:1.35}
.foto-tarjeta .pie-foto b{color:var(--tinta);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.foto-tarjeta .quitar-foto{position:absolute;top:3px;right:3px;width:19px;height:19px;line-height:17px;
  border-radius:3px;border:none;background:rgba(0,0,0,.6);color:#fff;cursor:pointer;font-size:14px;padding:0}
.foto-tarjeta .quitar-foto:hover{background:var(--rojo)}
`;

function asegurarCssFotos() {
  if (document.getElementById('css-fotos')) return;
  const s = document.createElement('style');
  s.id = 'css-fotos'; s.textContent = CSS_FOTOS;
  document.head.appendChild(s);
}

/* opciones = { id, fotos, titulo, ayuda, verQuitar } */
function zonaFotos(op) {
  asegurarCssFotos();
  const fotos = op.fotos || [];
  const res = Media.resumen(fotos);
  const comprime = Media.comprimeSiempre();

  return `
  <div class="zona-fotos" id="${esc(op.id)}-zona">
    <input type="file" id="${esc(op.id)}-input" accept="image/*" multiple>
    <div class="grande">${ico('camara')} ${esc(op.titulo || 'Agregar fotografías')}</div>
    <div class="chico">Haz clic acá, o arrastra las fotos desde una carpeta. Se pueden varias de una vez.</div>
  </div>

  <div class="fotos-progreso" id="${esc(op.id)}-prog">
    <div class="txt"><span id="${esc(op.id)}-prog-txt">Preparando…</span>
      <span id="${esc(op.id)}-prog-n"></span></div>
    <div class="barra-fondo"><div class="barra-relleno" id="${esc(op.id)}-prog-barra" style="width:0%"></div></div>
  </div>

  ${fotos.length ? `
  <div class="fotos-rejilla" id="${esc(op.id)}-lista">
    ${fotos.map((f, i) => '<figure class="foto-tarjeta">' +
      '<img data-media="' + esc(f.id) + '" alt="' + esc(f.nombre) + '">' +
      (op.verQuitar === false ? '' :
        '<button class="quitar-foto" data-' + esc(op.id) + '-quitar="' + i + '" title="Quitar">&times;</button>') +
      '<figcaption class="pie-foto"><b>' + esc(f.nombre) + '</b>' +
      (f.sin_comprimir
        ? '<span class="cod">' + Media.fPeso(f.bytes) + ' · sin comprimir</span>'
        : '<span class="cod">' + Media.fPeso(f.bytes_original) + ' → ' + Media.fPeso(f.bytes) + '</span>') +
      (f.ancho ? ' ' + f.ancho + '×' + f.alto : '') +
      '</figcaption></figure>').join('')}
  </div>
  <div class="pie-nota">
    <strong>${plural(res.cantidad, 'foto', 'fotos')}${comprime && res.ahorro > 0
      ? ' · ' + Media.fPeso(res.bytesOriginal) + ' → ' + Media.fPeso(res.bytes) + ' · ' + res.ahorro + '% menos'
      : ' · ' + Media.fPeso(res.bytes)}.</strong>
    ${comprime
      ? 'El sistema las achica solo al subirlas.'
      : 'La compresión está apagada en Configuración: se guardan tal como vienen.'}
  </div>` : `
  <div class="pie-nota">
    Sin fotografías todavía. ${comprime
      ? 'Se comprimen solas al subirlas — a ' + Media.ladoMax() + ' px de lado largo y unos ' +
        Math.round(Media.objetivoBytes() / 1024) + ' KB.'
      : 'La compresión está apagada en Configuración: se guardarán tal como vengan.'}
  </div>`}`;
}

/* opciones = { id, momento, ot_id, etapa_id, alSubir(fichas), alQuitar(indice) } */
function montarZonaFotos(op) {
  const zona = document.getElementById(op.id + '-zona');
  const input = document.getElementById(op.id + '-input');
  if (!zona || !input) return;

  const prog = document.getElementById(op.id + '-prog');
  const txt = document.getElementById(op.id + '-prog-txt');
  const num = document.getElementById(op.id + '-prog-n');
  const barra = document.getElementById(op.id + '-prog-barra');

  const procesar = (archivos) => {
    const lista = Array.from(archivos || []);
    if (!lista.length) return;
    prog.classList.add('activo');
    zona.style.pointerEvents = 'none';

    Media.subir(lista, { momento: op.momento || 'ingreso', ot_id: op.ot_id || null, etapa_id: op.etapa_id || null },
      (hechas, total, nombre) => {
        barra.style.width = Math.round(hechas / total * 100) + '%';
        num.textContent = hechas + ' de ' + total;
        txt.textContent = nombre ? 'Procesando ' + nombre + '…' : 'Listo';
      })
      .then(({ fichas, errores }) => {
        prog.classList.remove('activo');
        zona.style.pointerEvents = '';
        input.value = '';
        if (errores.length) avisar({ ok: false, motivo: errores.join(' · ') });
        if (fichas.length && op.alSubir) op.alSubir(fichas);
        if (fichas.length) {
          const r = Media.resumen(fichas);
          avisar({ ok: true, motivo: '' },
            plural(fichas.length, 'foto guardada', 'fotos guardadas') +
            (Media.comprimeSiempre() && r.ahorro > 0
              ? ': ' + Media.fPeso(r.bytesOriginal) + ' → ' + Media.fPeso(r.bytes) + ' (' + r.ahorro + '% menos).'
              : ': ' + Media.fPeso(r.bytes) + '.'));
        }
      });
  };

  zona.addEventListener('click', () => input.click());
  input.addEventListener('change', () => procesar(input.files));

  // Arrastrar y soltar: es como la gente mueve un puñado de fotos.
  ['dragenter', 'dragover'].forEach((ev) => zona.addEventListener(ev, (e) => {
    e.preventDefault(); e.stopPropagation(); zona.classList.add('encima');
  }));
  ['dragleave', 'drop'].forEach((ev) => zona.addEventListener(ev, (e) => {
    e.preventDefault(); e.stopPropagation(); zona.classList.remove('encima');
  }));
  zona.addEventListener('drop', (e) => procesar(e.dataTransfer && e.dataTransfer.files));

  if (op.alQuitar) {
    document.querySelectorAll('[data-' + op.id + '-quitar]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        op.alQuitar(Number(b.getAttribute('data-' + op.id + '-quitar')));
      }));
  }

  Media.pintar();
}
