/* EXPEDIENTE DEL VEHÍCULO — declarado por el cliente como lo más importante del sistema.

   Su frase, el 15-08-2026: «todo movimiento, todo lo que se le haga al vehículo y todos
   los documentos que se suban, todas las etapas por las que pasó».

   ⚠️ Esto NO existe en el sistema actual. Es desarrollo nuevo y se cotiza aparte.

   Detalle y decisiones: 00 Documentacion/DECISIONES.md · js/vistas/expediente.js */

function expedienteEstado() {
  if (!ui.expediente) ui.expediente = { busqueda: '', otId: null, grupos: {} };
  return ui.expediente;
}

/* Cada tipo de hecho lleva su icono y su color. Son los mismos nombres que usa
   el resto del sistema: un repuesto se ve igual acá que en Bodega. */
const HECHO_ESTILO = {
  recepcion:   { ico: 'recepcion',   color: 'var(--azul)' },
  estado:      { ico: 'torre',       color: 'var(--violeta)' },
  etapa:       { ico: 'taller',      color: 'var(--verde)' },
  salida:      { ico: 'espera',      color: 'var(--ambar)' },
  reingreso:   { ico: 'espera',      color: 'var(--azul)' },
  presupuesto: { ico: 'presupuesto', color: 'var(--violeta)' },
  repuesto:    { ico: 'repuesto',    color: 'var(--ambar)' },
  bitacora:    { ico: 'documento',   color: 'var(--gris)' },
  documento:   { ico: 'documento',   color: 'var(--gris)' },
  foto:        { ico: 'documento',   color: 'var(--gris)' },
  entrega:     { ico: 'check',       color: 'var(--verde)' },
  modificacion:{ ico: 'config',      color: 'var(--gris)' }
};

function vExpediente() {
  const e = expedienteEstado();
  const ex = e.otId ? Modelo.expedienteDe(e.otId) : null;

  const buscador = `
  <div class="panel">
    <div class="cab">
      <div><h2>${ico('historico', 'g')}Expediente del vehículo</h2>
        <div class="desc">Todo lo que le pasó a un vehículo, en orden. Es lo que se le entrega a la compañía</div></div>
      <div class="filtros">
        <input type="search" id="ex-q" placeholder="Patente u OT" value="${esc(e.busqueda)}" style="width:190px">
        <button class="btn" id="ex-buscar">Buscar</button>
      </div>
    </div>
  </div>`;

  if (!ex) {
    return buscador + `
    <div class="panel"><div class="cuerpo">
      <div class="vacio">
        <div class="titulo">Escribe una patente o un número de OT</div>
        <div class="texto">El expediente junta en una sola pantalla la recepción con sus daños, las
          etapas con quién las cerró, los presupuestos con sus versiones, los repuestos con sus
          fechas, la bitácora y los archivos.</div>
      </div>
    </div></div>`;
  }

  const o = ex.orden;
  const r = ex.resumen;

  const porDia = hechosPorDia(ex.hechos);

  return buscador + `
  <div class="panel">
    <div class="cab">
      <div><h2><span class="patente">${esc(o.patente)}</span> &middot; OT ${esc(o.numeroOT)}</h2>
        <div class="desc">${esc([o.marca, o.modelo, o.color].filter(Boolean).join(' · '))}
          ${o.compania && o.compania !== '—' ? '&middot; ' + esc(o.compania) : '&middot; Particular'}
          &middot; ${esc(o.cliente)}</div></div>
      <div class="filtros">
        <button class="btn secundario" id="ex-abrir">Abrir la orden</button>
        <button class="btn" id="ex-imprimir">${ico('imprimir')}Imprimir el expediente</button>
      </div>
    </div>

    <div class="cuerpo">
      <div class="aviso-registro">
        ${ico('candado')}
        <div><strong>Este registro no se edita.</strong> Se agregan hechos, no se cambian ni se
        borran. Es lo que lo hace servible para respaldar frente a una compañía.</div>
      </div>

      <div class="linea-tiempo">
        ${porDia.map((d) => `
          <div class="dia">
            <div class="dia-rot">${fFecha(d.fecha)}</div>
            ${d.hechos.map(hechoHTML).join('')}
          </div>`).join('')}
      </div>
    </div>
  </div>`;
}

function hechoHTML(h) {
  const s = HECHO_ESTILO[h.grupo] || HECHO_ESTILO.modificacion;
  return '<div class="hecho">' +
    '<div class="hito" style="color:' + s.color + '">' + ico(s.ico) + '</div>' +
    '<div class="cuerpo-hecho">' +
      '<div class="tit">' + esc(h.titulo) + '</div>' +
      (h.detalle ? '<div class="det">' + esc(h.detalle) + '</div>' : '') +
      (h.quien ? '<div class="quien">' + esc(h.quien) + '</div>'
               : '<div class="quien sin">sin autor registrado</div>') +
    '</div></div>';
}

function pExpediente() {
  const e = expedienteEstado();
  const campo = document.getElementById('ex-q');

  const buscar = () => {
    const q = (campo.value || '').trim().toUpperCase();
    e.busqueda = q;
    if (!q) { e.otId = null; return render(); }
    // Se acepta la patente o el número de OT: el que atiende el teléfono tiene
    // la patente a mano, no el correlativo.
    const porPatente = Modelo.torre().concat(Modelo.historico({ todo: true }))
      .find((o) => String(o.patente).toUpperCase() === q);
    e.otId = porPatente ? porPatente.numeroOT : q;
    if (!Modelo.expedienteDe(e.otId)) {
      e.otId = null;
      avisar({ ok: false, motivo: 'No hay ninguna orden con «' + q + '». ' +
        'Puede ser de otro taller, o estar fuera de tu alcance.' });
    }
    render();
  };

  if (campo) campo.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') buscar(); });
  const b = document.getElementById('ex-buscar');
  if (b) b.addEventListener('click', buscar);

  const abrir = document.getElementById('ex-abrir');
  if (abrir) abrir.addEventListener('click', () => abrirFicha(e.otId));

  const imp = document.getElementById('ex-imprimir');
  if (imp) imp.addEventListener('click', () => abrirImpreso('expediente', e.otId));
}
