/* PERSONAL Y CARGA DE TRABAJO.

   Las cuentas del sistema, sus etapas habilitadas y a qué módulos entra cada una.

   ⚠️ La carga de trabajo por persona NO existe en el sistema actual. Es desarrollo nuevo.

   Detalle y decisiones: 00 Documentacion/DECISIONES.md · js/vistas/personal.js */

/* ── Los 31 permisos, agrupados para poder mirarlos ────────────────────
   23-08-2026. Puestos en fila son una lista de treinta y una casillas donde no
   se encuentra nada. Agrupados por lo que la persona HACE con ellos, se leen.

   Los grupos son de presentación y no cambian nada del motor: si mañana se
   agrega un permiso al catálogo y nadie lo pone en un grupo, igual aparece —
   al final, en «Otros»— en vez de desaparecer de la pantalla sin avisar. */
const GRUPOS_PERMISOS = [
  { nombre: 'Qué pantallas abre',
    codigos: ['torre.ver', 'historico.ver', 'taller.ver', 'repuesto.ver', 'espera.ver',
      'consolidado.ver', 'personal.ver', 'configuracion'] },
  { nombre: 'La ficha del vehículo',
    codigos: ['ficha.completa', 'documento.ver', 'documento.cargar', 'foto.ver', 'foto.cargar',
      'datos.rut_completo'] },
  { nombre: 'Las órdenes',
    codigos: ['ot.crear', 'ot.editar', 'salida.registrar', 'entrega.registrar',
      'detencion.gestionar'] },
  { nombre: 'El trabajo del taller',
    codigos: ['etapa.asignar', 'etapa.validar', 'etapa.finalizar'] },
  { nombre: 'Presupuesto y repuestos',
    codigos: ['presupuesto.ver', 'presupuesto.montos', 'presupuesto.crear', 'presupuesto.abrir',
      'perdida_total.declarar', 'repuesto.cargar', 'repuesto.devolver'] },
  { nombre: 'Administrar',
    codigos: ['personal.editar', 'exportar'] }
];

/* Los que no quedaron en ningún grupo. Se calcula, no se escribe: un permiso
   nuevo tiene que aparecer solo. */
function gruposDePermisos(todos) {
  const puestos = {};
  GRUPOS_PERMISOS.forEach((g) => g.codigos.forEach((c) => { puestos[c] = true; }));
  const sueltos = todos.filter((p) => !puestos[p.codigo]).map((p) => p.codigo);
  return sueltos.length
    ? GRUPOS_PERMISOS.concat([{ nombre: 'Otros', codigos: sueltos }])
    : GRUPOS_PERMISOS;
}

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
    ${Modelo.puede('personal.editar') ? '<button class="btn secundario" id="per-nuevo" data-crea>Nueva cuenta</button>' : ''}
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
  /* Se resuelven una vez y valen para los dos bloques nuevos. */
  const TODOS_PERMISOS = Modelo.base().permiso;
  const GRUPOS = gruposDePermisos(TODOS_PERMISOS);
  const puedeEditar = Modelo.puede('personal.editar');

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


    ${/* 🔷 QUÉ VE Y QUÉ HACE, POR PERSONA (23-08-2026, Marco).

         Esto vivía en `Configuración → Roles y permisos`, como una matriz de 31
         permisos por 8 roles, y se fue de ahí a pedido suyo: «quiero que en el
         panel de Personal podamos hacer el tema de Roles y Permisos por cada
         colaborador — qué puede ver, qué puede hacer».

         Y tiene razón, porque es el mismo movimiento que Andrés Guzmán ya había
         hecho con los MÓDULOS el 17-08: dos personas con el mismo cargo no hacen
         lo mismo. Nancy y Sandra son las dos de administración y una ve Personal
         y la otra no. Con la matriz por rol, cada persona que se salía del molde
         obligaba a inventar un rol nuevo.

         Van los dos bloques juntos y en este orden porque es el orden en que se
         piensa: primero a qué pantalla entra, después qué puede hacer adentro. */''}

    <fieldset class="bloque"><legend>Qué puede ver</legend>
      <div class="pie-nota" style="margin:0 0 9px">Los módulos que le aparecen en la barra.
      Una cuenta sin ninguno entraría al sistema a mirar una pared, así que el sistema no
      deja dejarla en cero: si la idea es que no entre, se desactiva la cuenta.</div>
      <div class="inventario">
        ${Modelo.MODULOS_MENU.map((m) => {
          const tiene = !Array.isArray(x.modulosCrudos) || x.modulosCrudos.indexOf(m.id) >= 0;
          return '<label class="inv-item' + (tiene ? ' marcado' : '') + '">' +
            '<input type="checkbox" data-per-modulo="' + esc(m.id) + '"' +
            (tiene ? ' checked' : '') + (puedeEditar ? '' : ' disabled') + '>' +
            '<span>' + esc(m.nombre) + '</span></label>';
        }).join('')}
      </div>
    </fieldset>

    <fieldset class="bloque"><legend>Qué puede hacer</legend>
      ${x.accesoTotal ? `
      <div class="nota">Esta cuenta tiene el rol <strong>${esc(x.rolNombre || '—')}</strong>, que
      alcanza <strong>todo el sistema</strong> y no se le puede recortar. Si se pudiera, bastaría
      con desmarcarle «Administrar los catálogos» para que nadie pudiera volver a entrar a
      Configuración, y la única salida sería reiniciar el sistema y perder todo.</div>` : `
      <div class="pie-nota" style="margin:0 0 9px">Marcado ${x.permisos.length} de
      ${TODOS_PERMISOS.length}. Nace copiado del rol <strong>${esc(x.rolNombre || '—')}</strong>
      y desde ahí se mueve uno por uno: el rol es la plantilla, no la jaula.</div>`}
      <div class="permisos-persona">
        ${GRUPOS.map((g) => {
          const items = TODOS_PERMISOS.filter((p) => g.codigos.indexOf(p.codigo) >= 0);
          if (!items.length) return '';
          return '<div class="permiso-grupo"><div class="permiso-grupo-tit">' + esc(g.nombre) + '</div>' +
            items.map((p) => {
              const tiene = x.accesoTotal || x.permisos.indexOf(p.codigo) >= 0;
              return '<label class="inv-item' + (tiene ? ' marcado' : '') + '">' +
                '<input type="checkbox" data-per-permiso="' + esc(p.codigo) + '"' +
                (tiene ? ' checked' : '') +
                (puedeEditar && !x.accesoTotal ? '' : ' disabled') + '>' +
                '<span>' + esc(p.descripcion) + '<br><span class="cod">' + esc(p.codigo) +
                '</span></span></label>';
            }).join('') + '</div>';
        }).join('')}
      </div>
      ${puedeEditar ? '' :
        '<div class="pie-nota">Solo lectura: los accesos los marca Administración.</div>'}
    </fieldset>

    <fieldset class="bloque"><legend>Sobre qué órdenes trabaja</legend>
      <div class="dato"><span class="k">Rol</span><span class="v">${esc(x.rolNombre || '—')}</span></div>
      <div class="dato"><span class="k">Alcance</span><span class="v">${esc(x.alcanceTexto)}</span></div>
      <div class="pie-nota" style="margin-top:8px">El alcance sigue viniendo del rol y no se
      edita acá: los permisos dicen qué <strong>pantallas</strong> abre, el alcance dice qué
      <strong>filas</strong> trae cada pantalla. Un operario con los ${TODOS_PERMISOS.length}
      permisos marcados y alcance «solo las asignadas» sigue viendo únicamente sus autos.</div>
    </fieldset>

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

  /* ⚠️ Si el motor rechaza el cambio —la última cuenta que puede entrar a
     Configuración, o dejar a alguien sin ningún módulo— la casilla ya se movió
     sola en la pantalla y quedaría mintiendo. Se devuelve a donde estaba.
     `ejecutar` repinta cuando el cambio SÍ entra, así que sólo hay que
     ocuparse del caso en que no. */
  document.querySelectorAll('[data-per-modulo]').forEach((cb) => cb.addEventListener('change', () => {
    const r = Modelo.fijar_persona_modulo(p.personaId, cb.dataset.perModulo, cb.checked);
    if (!r.ok) { cb.checked = !cb.checked; return avisar(r); }
    avisar(r, cb.checked ? 'Módulo habilitado.' : 'Módulo quitado.');
    render();
  }));

  document.querySelectorAll('[data-per-permiso]').forEach((cb) => cb.addEventListener('change', () => {
    const r = Modelo.fijar_persona_permiso(p.personaId, cb.dataset.perPermiso, cb.checked);
    if (!r.ok) { cb.checked = !cb.checked; return avisar(r); }
    avisar(r, cb.checked ? 'Permiso otorgado.' : 'Permiso quitado.');
    render();
  }));
}
