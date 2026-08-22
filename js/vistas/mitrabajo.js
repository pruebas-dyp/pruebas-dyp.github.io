/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   MI TRABAJO — la pantalla del que está en el piso.

   Es la contraparte del panel del administrador. Él ve las 102 órdenes; el que
   está en pintura necesita ver las cuatro que tiene que pintar, y nada más.

   Las cuentas son por ROL, no por persona: en un taller chico el sistema no lo
   abre "Marcelo", lo abre el que está en desabolladura ese día.

   Cómo llega el trabajo hasta acá, sin que nadie reparta a mano:

     1 · El vehículo se recibe y se le declaran las etapas que aplican.
     2 · Cada etapa abierta queda disponible para la cuenta que tenga esa
         habilidad marcada en su ficha.
     3 · Quien entra con esa cuenta ve lo disponible y lo TOMA.
     4 · Al cerrarla, la orden avanza sola en la torre del administrador.

   Nadie le avisa a nadie: el estado del vehículo es el mensaje. Es lo que hoy
   se resuelve gritando en el taller o mandando un WhatsApp.

   ⚠️ Esto NO existe en el sistema actual. Ninguna de las 39 pantallas tiene
      una vista por puesto de trabajo; el original tiene una sola torre para
      todos. Es desarrollo nuevo y se cotiza aparte.
   ──────────────────────────────────────────────────────────────────────── */

function vMiTrabajo() {
  const yo = Modelo.personaActual();

  if (!yo) {
    return `
    <div class="panel"><div class="cuerpo"><div class="vacio">
      ${ico('personal')}
      <div class="titulo">Estás mirando el sistema completo</div>
      <div class="texto">Esta pantalla muestra lo que le toca a <strong>una cuenta</strong>.
      Para verla, hay que entrar con una de las del taller:</div>
      <div class="lista">${Modelo.sesionesPosibles().map((p) =>
        '<li><strong>' + esc(p.nombre) + '</strong> — ' + esc(p.cargo) +
        (p.etapas.length ? ' · ' + esc(p.etapas.join(', ')) : ' · sin etapas asignadas') + '</li>').join('')}</div>
    </div></div></div>`;
  }

  const t = Modelo.miTrabajo(yo.id);

  /* "Ver orden" solo en lo que YA es mío. En lo disponible no aparece, y no es
     un detalle: el alcance del rol operario recorta la ficha a los vehículos
     que tiene tomados, así que ese botón, en esa lista, llevaría a la pantalla
     que dice "esta orden no es tuya". Se toma primero, se mira después. */
  const fila = (x, mia) =>
    '<tr class="fila' + (x.sobreMeta ? ' alerta' : '') + '">' +
    '<td class="num"><strong>' + x.numeroOT + '</strong></td>' +
    '<td><span class="patente">' + esc(x.patente) + '</span></td>' +
    '<td>' + esc([x.marca, x.modelo].filter(Boolean).join(' ') || '—') + '</td>' +
    '<td><i class="punto" style="background:' + x.color + '"></i>' + esc(x.etapa) + '</td>' +
    '<td class="num">' + x.dias + (x.sobreMeta ? ' <span class="et roja">sobre la meta</span>' : '') + '</td>' +
    '<td>' + (x.repuestosPendientes
      ? '<span class="et ambar">' + x.repuestosPendientes + ' por llegar</span>'
      : '<span class="et verde">al día</span>') + '</td>' +
    '<td>' + (x.enTaller ? '<span class="et verde">en taller</span>' : '<span class="et gris">afuera</span>') + '</td>' +
    '<td style="white-space:nowrap">' +
      (mia
        ? '<button class="btn" data-mt-cerrar="' + esc(x.ot_id) + '|' + esc(x.etapaCodigo) + '">Terminé</button> ' +
          '<button class="btn secundario" data-mt-soltar="' + esc(x.ot_id) + '|' + esc(x.etapaCodigo) + '">Soltar</button>' +
          ' <button class="btn secundario" data-mt-abrir="' + esc(x.numeroOT) + '">Ver orden</button>'
        : '<button class="btn secundario" data-mt-tomar="' + esc(x.ot_id) + '|' + esc(x.etapaCodigo) + '">Tomar</button>') +
    '</td></tr>';

  const verCliente = Modelo.puede('ficha.completa');
  const puedePresupuestar = Modelo.puede('presupuesto.crear');

  /* Recepción y administración no tienen NINGUNA etapa declarada en su ficha:
     no pintan ni desabollan. Para ellas los dos paneles de etapas están vacíos
     siempre, no solo hoy, y un panel que nunca va a tener nada es ruido.
     Se dibujan únicamente si la cuenta sabe hacer algo con las manos. */
  const conEtapas = Modelo.base().persona_etapa.some((h) => h.persona_id === yo.id);

  return `
  ${t.aCargo.length ? `
  <div class="panel">
    <div class="cab"><div><h2>${ico('auto', 'g')}Vehículos a mi cargo</h2>
      <div class="desc">${puedePresupuestar
        ? 'Me los traspasaron en la recepción. Respondo por ellos hasta la entrega'
        : 'Los recibí yo. Respondo por ellos hasta la entrega, aunque la OR la arme el taller'}</div></div></div>
    <div class="grid-envoltorio"><table class="grid">
      <thead><tr><th>OT</th><th>Patente</th>${verCliente ? '<th>Cliente</th><th>Compañía</th>' : '<th>Vehículo</th>'}<th>Estado</th>
        <th>Etapa</th><th>Días</th><th>Presupuesto</th><th style="min-width:210px">Acción</th></tr></thead>
      <tbody>${t.aCargo.map((x) =>
        '<tr class="fila' + (x.sobreMeta ? ' alerta' : '') + '">' +
        '<td class="num"><strong>' + x.numeroOT + '</strong></td>' +
        '<td><span class="patente">' + esc(x.patente) + '</span></td>' +
        (verCliente
          ? '<td>' + esc(x.cliente) + '</td><td>' + esc(x.compania) + '</td>'
          : '<td>' + esc([x.marca, x.modelo].filter(Boolean).join(' ') || '—') + '</td>') +
        '<td><span class="et ' + esc(x.estadoClase) + '">' + esc(x.estado) + '</span></td>' +
        '<td>' + esc(x.etapa) + '</td>' +
        '<td class="num">' + x.dias + (x.sobreMeta ? ' <span class="et roja">sobre la meta</span>' : '') + '</td>' +
        '<td>' + (x.conPresupuesto
          ? '<span class="et verde">hecho</span>'
          : '<span class="et ambar">falta</span>') + '</td>' +
        '<td style="white-space:nowrap">' +
          (puedePresupuestar
            ? '<button class="btn' + (x.conPresupuesto ? ' secundario' : '') + '" data-mt-presu="' + esc(x.ot_id) + '">' +
              (x.conPresupuesto ? 'Ver presupuesto' : 'Presupuestar') + '</button> '
            : '') +
          '<button class="btn secundario" data-mt-abrir="' + esc(x.numeroOT) + '">Ver orden</button>' +
        '</td></tr>').join('')}</tbody>
    </table></div>
  </div>` : ''}

  ${conEtapas ? `
  <div class="panel">
    <div class="cab"><div><h2>${ico('taller', 'g')}Lo que tengo entre manos</h2>
      <div class="desc">El vehículo que lleva más días parado va primero</div></div></div>
    <div class="grid-envoltorio"><table class="grid">
      <thead><tr><th>OT</th><th>Patente</th><th>Vehículo</th><th>Mi etapa</th><th>Días</th>
        <th>Repuestos</th><th>Dónde está</th><th style="min-width:230px">Acción</th></tr></thead>
      <tbody>${t.mias.length ? t.mias.map((x) => fila(x, true)).join('')
        : '<tr><td colspan="8"><div class="vacio"><div class="titulo">No tienes nada tomado</div>' +
          '<div class="texto">Abajo está lo que puedes tomar según las etapas que tienes habilitadas.</div>' +
          '</div></td></tr>'}</tbody>
    </table></div>
    ${t.mias.length && Modelo.puede('foto.cargar') ? `
    <div class="cuerpo">
      <fieldset class="bloque"><legend>Foto del avance</legend>
        <div class="rejilla-campos" style="margin-bottom:9px">
          <div class="campo"><label>¿De cuál de tus órdenes?</label>
            <select id="mt-foto-ot">${t.mias.map((x) =>
              '<option value="' + esc(x.ot_id) + '">OT ' + x.numeroOT + ' · ' + esc(x.patente) +
              ' · ' + esc(x.etapa) + '</option>').join('')}</select></div>
        </div>
        ${zonaFotos({ id: 'mtfoto', fotos: [], titulo: 'Agregar fotos de cómo va el trabajo' })}
      </fieldset>
    </div>` : ''}
  </div>

  <div class="panel">
    <div class="cab"><div><h2>${ico('nuevo', 'g')}Disponible para tomar</h2>
      <div class="desc">Etapas abiertas que nadie tomó, de las que sabes hacer</div></div></div>
    <div class="grid-envoltorio"><table class="grid">
      <thead><tr><th>OT</th><th>Patente</th><th>Vehículo</th><th>Etapa</th><th>Días</th>
        <th>Repuestos</th><th>Dónde está</th><th style="min-width:230px">Acción</th></tr></thead>
      ${/* Iba cortada en 40 y sin decirlo en ninguna parte: el que no veía su
            trabajo en la lista concluía que no había trabajo. Va entera; si
            pasa de 50 aparece el pie con el selector. */''}
      <tbody>${t.disponibles.length ? t.disponibles.map((x) => fila(x, false)).join('')
        : '<tr><td colspan="8"><div class="vacio"><div class="titulo">Nada disponible ahora</div>' +
          '<div class="texto">Cuando se reciba un vehículo que pase por ' +
          esc(Modelo.sesionesPosibles().find((p) => p.id === (Modelo.personaActual() || {}).id)
            ? (Modelo.sesionesPosibles().find((p) => p.id === Modelo.personaActual().id).etapas.join(', ') || 'tus etapas')
            : 'tus etapas') + ', aparece acá.</div></div></td></tr>'}</tbody>
    </table></div>
  </div>` : ''}

  ${!conEtapas && !t.aCargo.length ? `
  <div class="panel"><div class="cuerpo"><div class="vacio">${ico('auto')}
    <div class="titulo">Nada a tu nombre ahora</div>
    <div class="texto">Acá aparecen los vehículos que recibiste o que te traspasaron.</div>
  </div></div></div>` : ''}`;
}

function pMiTrabajo() {
  const yo = Modelo.personaActual();
  if (!yo) return;

  const par = (b, attr) => b.dataset[attr].split('|');

  document.querySelectorAll('[data-mt-tomar]').forEach((b) => b.addEventListener('click', () => {
    const [ot, etapa] = par(b, 'mtTomar');
    ejecutar(() => Modelo.tomar_etapa(ot, etapa, yo.id), 'Tomaste esa etapa. Queda a tu nombre.');
  }));

  document.querySelectorAll('[data-mt-soltar]').forEach((b) => b.addEventListener('click', () => {
    const [ot, etapa] = par(b, 'mtSoltar');
    ejecutar(() => Modelo.soltar_etapa(ot, etapa), 'La devolviste a la lista.');
  }));

  /* "Terminé" cierra la etapa a nombre de quien la tenía. Es la misma
     operación que usa el jefe de taller desde la ficha, con las mismas reglas:
     si la etapa exige repuestos y faltan, se rechaza y se explica. */
  document.querySelectorAll('[data-mt-cerrar]').forEach((b) => b.addEventListener('click', () => {
    const [ot, etapa] = par(b, 'mtCerrar');
    ejecutar(() => Modelo.finalizar_etapa(ot, etapa, yo.id),
      'Etapa cerrada. La orden ya avanzó en la torre.');
  }));

  document.querySelectorAll('[data-mt-abrir]').forEach((b) => b.addEventListener('click', () =>
    abrirFicha(b.dataset.mtAbrir)));

  // El presupuesto de una orden a mi cargo, sin pasar por el listado.
  document.querySelectorAll('[data-mt-presu]').forEach((b) => b.addEventListener('click', () => {
    presuEstado().otId = b.dataset.mtPresu;
    presuEstado().presupuestoId = null;
    ir('presupuesto');
  }));

  /* Las fotos del avance se suben desde acá, que es donde está la persona
     trabajando. Antes había que ir a la ficha de la orden: dos pantallas de
     distancia para algo que se hace con el celular en la mano.

     Quien no tiene `foto.cargar` no ve el bloque, y por lo tanto tampoco hay
     nada que cablear: el pintor no sube fotos, cierra su etapa. */
  if (!Modelo.puede('foto.cargar')) return;
  montarZonaFotos({
    id: 'mtfoto', momento: 'proceso',
    ot_id: (document.getElementById('mt-foto-ot') || {}).value || null,
    alSubir: (fichas) => {
      const sel = document.getElementById('mt-foto-ot');
      const ot = sel ? sel.value : null;
      if (!ot) return;
      const r = Modelo.adjuntar_media(null, [ot], fichas);
      if (r && r.ok === false) return avisar(r);
      render();
    }
  });
}
