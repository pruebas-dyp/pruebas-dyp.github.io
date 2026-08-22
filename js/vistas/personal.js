/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   PERSONAL Y CARGA DE TRABAJO.

   Las columnas del original se copian, menos una. Lo que cambia es quién ve qué:

   🔶 EL VALOR HORA SE ELIMINÓ (decisión del 13-08-2026). El cliente no lo
      ocupa. Y conviene decírselo así: la auditoría pedía protegerlo con su
      propia política de acceso, porque hoy **cualquier cuenta ve el sueldo de
      los 89 trabajadores**. Al no recoger el dato, el requisito A-3 deja de
      aplicar. **El dato que no se guarda no se puede filtrar.**

   🔴 A-2 · RUT, domicilio y teléfono se enmascaran por rol.

   🔴 B-7 · SE PUEDE DAR DE BAJA. En el original **no existe pantalla para
      desactivar una cuenta**, y por eso hoy las once cuentas externas no se
      pueden cerrar sin tocar la base de datos. Y no se elimina gente: *"si
      vuelve hay que recargar todo y se pierde el registro"*.

   · RUT y número de ficha son inmutables. Así se pidió, y es correcto.

   ⚠️ La pantalla "Ver nómina de pagos" del original **muestra la Torre de
      Control**: mismas 102 órdenes, mismas 17 columnas, ni un dato de pagos.
      Nunca se construyó, y acá tampoco: se sacó la vista de carga de trabajo
      que la reemplazaba (decisión del 13-08-2026) porque no existe en el
      sistema actual y no se replica lo que no está.
   ──────────────────────────────────────────────────────────────────────── */

function personalEstado() {
  ui.personal = ui.personal || { pantalla: 'listado', busqueda: '', personaId: null, verBajas: false };
  return ui.personal;
}

function vPersonal() {
  const p = personalEstado();
  const cuerpo = { listado: personalListado, ficha: personalFicha }[p.pantalla]();
  return `
  <div class="panel">
    <div class="cab">
      <div><h2>${ico('personal', 'g')}Personal</h2>
        <div class="desc">Quién puede hacer qué etapa. De ahí salen los permisos operativos</div></div>
    </div>
    <div class="cuerpo">${cuerpo}</div>
  </div>`;
}

function personalListado() {
  const p = personalEstado();
  const q = p.busqueda.trim().toLowerCase();
  const todos = Modelo.personal();
  const filas = todos.filter((x) => (p.verBajas || x.activo) &&
    (!q || [x.ficha, x.nombres, x.apellidos, x.rut].join(' ').toLowerCase().includes(q)));
  const veDatos = Modelo.puede('datos.rut_completo');

  return `
  <div class="nota">
    Entraste como <strong>${esc(Modelo.rolActual().nombre)}</strong>:
    ${veDatos ? 'ves el RUT y el domicilio completos.' : 'ves el RUT y el domicilio enmascarados.'}
    Para mirar con otro perfil hay que cerrar sesión y volver a entrar.
  </div>

  <div class="filtros" style="margin:10px 0">
    <input type="search" id="per-q" placeholder="Ficha, cuenta o RUT" value="${esc(p.busqueda)}">
    <label><input type="checkbox" id="per-bajas" ${p.verBajas ? 'checked' : ''}> Mostrar desactivadas</label>
    <span style="flex:1"></span>
    ${Modelo.puede('personal.editar') ? '<button class="btn secundario" id="per-nuevo">Nueva cuenta</button>' : ''}
  </div>

  <div class="grid-envoltorio"><table class="grid">
    ${/* 🔷 LA COLUMNA DE MÓDULOS (17-08-2026). Andrés Guzmán entregó la lista de
          a qué entra cada uno, y esa lista tiene que poder revisarse de un
          vistazo: es lo primero que va a mirar Gabriel para decir «esto está
          bien» o «a Sandra súbela a Personal». Escondida dentro de la ficha no
          se revisa, se descubre cuando alguien reclama que no ve una pantalla. */''}
    <thead><tr><th>N° Ficha</th><th>Rut</th><th>Cuenta</th><th>Cargo</th><th>Usuario</th>
      <th style="min-width:220px">Módulos a los que entra</th>
      <th>Teléfono</th><th>Dirección</th><th>Comuna</th><th>Etapas</th><th></th></tr></thead>
    <tbody>${filas.map((x) =>
      '<tr class="fila"' + (x.activo ? '' : ' style="opacity:.55"') + '>' +
      '<td class="num">' + (x.ficha || '—') + '</td>' +
      '<td class="cod">' + esc(Modelo.velar(x.rut, 'datos.rut_completo')) + '</td>' +
      '<td>' + esc((x.nombres + ' ' + (x.apellidos || '')).trim()) +
        (x.activo ? '' : ' <span class="et gris">baja</span>') + '</td>' +
      '<td>' + esc(x.cargo || '—') + '</td>' +
      '<td><span class="cod">' + esc(x.usuario || '—') + '</span></td>' +
      '<td>' + (x.modulos
        ? (x.modulos.length === Modelo.MODULOS_MENU.length
            ? '<span class="et verde">Todos los módulos</span>'
            : esc(x.modulos.join(' · ')))
        : '<span style="color:var(--gris-2)" title="Es una cuenta de puesto, no de ' +
          'la lista del cliente: entra a lo que su rol permita">Según su rol</span>') + '</td>' +
      '<td>' + esc(Modelo.velar(x.telefono, 'datos.rut_completo')) + '</td>' +
      '<td>' + esc(Modelo.velar(x.direccion, 'datos.rut_completo', 'todo')) + '</td>' +
      '<td>' + esc(x.comuna || '—') + '</td>' +
      '<td>' + (x.etapas.length
        ? x.etapas.map((e) => '<i class="punto" style="background:' + e.color + '" title="' + esc(e.nombre) + '"></i>').join('')
        : '<span style="color:var(--gris-2)">ninguna</span>') + '</td>' +
      '<td><button class="btn secundario" data-per-ficha="' + esc(x.id) + '">Abrir</button></td></tr>').join('')}
    </tbody>
  </table></div>
  <div class="pie-grid"><div class="info">${filas.length} de ${todos.length} cuentas del sistema</div></div>
`;
}

function personalFicha() {
  const p = personalEstado();
  const x = Modelo.personal().find((y) => y.id === p.personaId);
  if (!x) { p.pantalla = 'listado'; return personalListado(); }

  return `
  <div style="display:flex;gap:8px;align-items:center;margin-bottom:11px">
    <button class="btn secundario" id="per-volver">Volver</button>
    <strong>Ficha ${x.ficha} · ${esc((x.nombres + ' ' + (x.apellidos || '')).trim())}</strong>
    <span class="et gris">${esc(x.cargo || '')}</span>
    ${x.activo ? '<span class="et verde">activo</span>' : '<span class="et gris">desactivado</span>'}
  </div>

  <div class="ficha-rejilla">
    <fieldset class="bloque"><legend>Datos</legend>
      <div class="rejilla-campos">
        <div class="campo"><label>N° de ficha</label><input value="${esc(x.ficha)}" disabled>
          <span class="ayuda">Inmutable</span></div>
        <div class="campo"><label>RUT</label>
          <input value="${esc(Modelo.velar(x.rut, 'datos.rut_completo'))}" disabled>
          <span class="ayuda">Inmutable${Modelo.puede('datos.rut_completo') ? '' : ' · enmascarado para este rol'}</span></div>
        <div class="campo"><label>Nombre de la cuenta</label><input data-per-campo="nombres" value="${esc(x.nombres)}"></div>
        <div class="campo"><label>Apellidos</label><input data-per-campo="apellidos" value="${esc(x.apellidos || '')}">
          <span class="ayuda">Solo si la cuenta es de una persona</span></div>
        <div class="campo"><label>Correo</label><input data-per-campo="correo" value="${esc(x.correo || '')}"></div>
        <div class="campo"><label>Teléfono</label><input data-per-campo="telefono" value="${esc(x.telefono || '')}"></div>
        <div class="campo"><label>Dirección</label><input data-per-campo="direccion" value="${esc(x.direccion || '')}"></div>
        <div class="campo"><label>Comuna</label><input data-per-campo="comuna" value="${esc(x.comuna || '')}"></div>
      </div>
      ${Modelo.puede('personal.editar') ? `
      <div style="margin-top:9px;display:flex;gap:8px">
        <button class="btn" id="per-guardar">Guardar</button>
        ${x.activo
          ? '<button class="btn secundario" id="per-baja">Desactivar</button>'
          : '<button class="btn secundario" id="per-alta">Reactivar</button>'}
      </div>
      <div class="pie-nota">
        <strong>No se elimina una cuenta, se desactiva.</strong> Y no se puede desactivar una que
        tenga etapas abiertas: hay que reasignarlas primero. Una cuenta desactivada tampoco entra
        al sistema.
      </div>` : `
      <div class="pie-nota">Este perfil <strong>consulta</strong> la ficha, no la edita. Crear
      cuentas, desactivarlas y cambiar sus datos es de Administración.</div>`}
    </fieldset>

    ${(Modelo.personaActual() || {}).id === x.id ? `
    <fieldset class="bloque"><legend>Mi acceso al sistema</legend>
      <div class="dato"><span class="k">Usuario</span><span class="v"><span class="cod">${esc(x.usuario || '—')}</span></span></div>
      <div class="dato"><span class="k">También sirve</span><span class="v">la ficha ${esc(x.ficha)}</span></div>
      ${x.claveInicial ? '<div class="nota" style="margin-top:8px">Todavía tienes la <strong>clave ' +
        'inicial</strong>, que está a la vista en la pantalla de ingreso. Conviene cambiarla.</div>' : ''}
      <div class="rejilla-campos" style="margin-top:9px">
        <div class="campo"><label>Clave actual</label><input type="password" id="cl-actual" autocomplete="current-password"></div>
        <div class="campo"><label>Clave nueva</label><input type="password" id="cl-nueva" autocomplete="new-password">
          <span class="ayuda">Mínimo 6 caracteres</span></div>
        <div class="campo"><label>&nbsp;</label><button class="btn secundario" id="cl-guardar">Cambiar clave</button></div>
      </div>
    </fieldset>` : ''}

    <fieldset class="bloque"><legend>Qué etapas puede hacer</legend>
      <div class="inventario">
        ${ETAPAS.map((e) => '<label class="inv-item' +
          (x.etapas.some((h) => h.codigo === e.codigo) ? ' marcado' : '') + '">' +
          '<input type="checkbox" data-per-etapa="' + esc(e.id) + '"' +
          (x.etapas.some((h) => h.codigo === e.codigo) ? ' checked' : '') +
          (Modelo.puede('personal.editar') ? '' : ' disabled') + '>' +
          '<span><i class="punto" style="background:' + e.color + '"></i>' + esc(e.nombre) + '</span></label>').join('')}
      </div>
      ${Modelo.puede('personal.editar') ? '' :
        '<div class="pie-nota">Solo lectura: las habilidades las marca Administración.</div>'}
    </fieldset>
  </div>`;
}

/* ── Cableado ──────────────────────────────────────────────────────────── */

function pPersonal() {
  const p = personalEstado();

  document.querySelectorAll('[data-per]').forEach((b) => b.addEventListener('click', () => {
    p.pantalla = b.dataset.per; p.personaId = null; render();
  }));

  /* La clave la cambia cada uno, en su propia ficha y pidiendo la actual.
     Nadie cambia la clave de otro: en un taller chico eso termina siendo la
     forma de entrar con el nombre de un compañero. */
  const clGuardar = document.getElementById('cl-guardar');
  if (clGuardar) clGuardar.addEventListener('click', () => {
    const yo = Modelo.personaActual();
    if (!yo) return;
    const actual = document.getElementById('cl-actual').value;
    const nueva = document.getElementById('cl-nueva').value;
    ejecutar(() => Modelo.cambiar_clave(yo.id, actual, nueva),
      'Clave cambiada. La próxima vez se entra con la nueva.');
  });

  const q = document.getElementById('per-q');
  if (q) q.addEventListener('input', () => {
    p.busqueda = q.value; render();
    const n = document.getElementById('per-q');
    n.focus(); n.setSelectionRange(n.value.length, n.value.length);
  });
  const bajas = document.getElementById('per-bajas');
  if (bajas) bajas.addEventListener('change', () => { p.verBajas = bajas.checked; render(); });

  document.querySelectorAll('[data-per-ficha]').forEach((b) => b.addEventListener('click', () => {
    p.personaId = b.dataset.perFicha; p.pantalla = 'ficha'; render();
  }));
  const volver = document.getElementById('per-volver');
  if (volver) volver.addEventListener('click', () => { p.pantalla = 'listado'; p.personaId = null; render(); });

  const nuevo = document.getElementById('per-nuevo');
  if (nuevo) nuevo.addEventListener('click', () => {
    dialogo('Nueva cuenta', `
      <div class="rejilla-campos">
        <div class="campo"><label>RUT</label><input id="nt-rut" placeholder="11.111.111-1">
          <span class="ayuda">Después no se puede cambiar</span></div>
        <div class="campo"><label>Nombres</label><input id="nt-nombres"></div>
        <div class="campo"><label>Apellidos</label><input id="nt-apellidos"></div>
        <div class="campo"><label>&nbsp;</label><button class="btn" id="nt-crear">Crear</button></div>
      </div>`);
    // El diálogo ya está en el documento: recién ahora existe el botón.
    const crear = document.getElementById('nt-crear');
    if (!crear) return;
    crear.addEventListener('click', () => {
      const v = (id) => (document.getElementById(id) || {}).value || '';
      const r = Modelo.guardar_persona({ rut: v('nt-rut'), nombres: v('nt-nombres'),
        apellidos: v('nt-apellidos') });
      avisar(r, 'Trabajador creado.');
      if (r.ok) { document.querySelectorAll('.velo').forEach((x) => x.remove()); render(); }
    });
  });

  const guardar = document.getElementById('per-guardar');
  if (guardar) guardar.addEventListener('click', () => {
    const datos = { id: p.personaId };
    document.querySelectorAll('[data-per-campo]').forEach((el) => { datos[el.dataset.perCampo] = el.value; });
    ejecutar(() => Modelo.guardar_persona(datos), 'Ficha guardada.');
  });

  const baja = document.getElementById('per-baja');
  if (baja) baja.addEventListener('click', () =>
    ejecutar(() => Modelo.dar_de_baja_persona(p.personaId), 'Desactivado. No se elimina: se desactiva.'));
  const alta = document.getElementById('per-alta');
  if (alta) alta.addEventListener('click', () =>
    ejecutar(() => Modelo.reactivar_persona(p.personaId), 'Reactivado.'));

  document.querySelectorAll('[data-per-etapa]').forEach((cb) => cb.addEventListener('change', () =>
    ejecutar(() => Modelo.fijar_habilidad(p.personaId, cb.dataset.perEtapa, cb.checked),
      cb.checked ? 'Habilidad agregada.' : 'Habilidad quitada.')));
}
