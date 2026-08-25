/* CONFIGURACIÓN — los catálogos del sistema.

   Los once maestros que en el original están escritos en el código y acá se editan:
   etapas, estados, compañías, motivos de detención, asuntos de bitácora y los demás.

   Detalle y decisiones: 00 Documentacion/DECISIONES.md · js/vistas/configuracion.js */

/* Las secciones del panel. El orden es deliberado: primero lo que gobierna el
   flujo del taller, después los catálogos de datos, al final el acceso. */
/* ── Los catálogos, agrupados por cuánto se tocan ──────────────────────
   El cliente pidió el 15-08-2026 que la Configuración "no tenga tantos
   parámetros", para que el sistema sea más simple de cara al administrador.

   ⚠️ Y hay una contradicción que conviene tener presente: fue él mismo quien
   pidió *"cópialo, pero escalable"*, y escalable para él significaba
   exactamente poder crear maestros sin llamar a un programador
   (`HALLAZGOS-REUNION.md` §3.1). Por eso existen los diez catálogos.

   Así que no se elimina ninguno: **lo que sobraba era la pantalla, no las
   tablas**. Eran doce pestañas en una fila, todas al mismo nivel, y las que se
   tocan una vez al año se veían igual de importantes que las de todos los días.
   Ahora van en tres grupos por frecuencia de uso.

   🔷 PERO NO PLEGADOS (18-08-2026). Los dos últimos grupos arrancaban cerrados
   —"se sigue pudiendo todo; se ve un tercio"— y eso salió mal: Marco dijo que
   la Configuración "antes tenía distintas hojas para ir pinchando, ahora eso no
   está tan claro". El agrupado ayuda; esconder no. Los tres grupos van
   abiertos: se ven las doce hojas y se entiende de una que el sistema se
   configura entero desde acá.

   Si al mostrárselo él igual quiere sacar alguno, ahí sí se saca — pero
   sabiendo cuál y por qué, no borrando a ciegas lo que pidió poder editar. */
const CONFIG_GRUPOS = [
  { id: 'diario', nombre: 'Del día a día',
    ayuda: 'Lo que cambia cuando entra una compañía nueva o se agrega un color',
    secciones: [
      { id: 'compania',         nombre: 'Compañías' },
      { id: 'marca',            nombre: 'Marcas' },
      { id: 'modelo',           nombre: 'Modelos' },
      { id: 'prioridad',        nombre: 'Prioridades' },
      { id: 'color_vehiculo',   nombre: 'Colores' },
      { id: 'responsable_pago', nombre: 'Responsable de pago' }
    ] },
  { id: 'flujo', nombre: 'El flujo del taller',
    ayuda: 'Se define una vez y casi no se vuelve a tocar. Cambiarlo mueve cómo trabaja el taller',
    secciones: [
      { id: 'etapa',            nombre: 'Etapas' },
      { id: 'precedencia',      nombre: 'Precedencias' },
      { id: 'estado',           nombre: 'Estados' },
      { id: 'tipo_ingreso',     nombre: 'Tipos de ingreso' },
      { id: 'motivo_detencion', nombre: 'Motivos de detención' },
      { id: 'asunto_bitacora',  nombre: 'Asuntos y alertas' }
    ] },
  /* El grupo «Del sistema» tenía Parámetros y Roles y permisos, y los dos se
     fueron el 23-08-2026 — el porqué está más abajo, donde vivían las dos
     funciones. Sin secciones, el grupo entero se va: un encabezado que no
     abre nada es peor que no tenerlo. */
];

// Se conserva la lista plana: el resto del archivo la usa para resolver una
// sección por su id, y no tiene por qué saber en qué grupo cayó.
const CONFIG_SECCIONES = CONFIG_GRUPOS.reduce((t, g) => t.concat(g.secciones), []);

function cfg() {
  /* Ya no se guarda qué grupos están abiertos: están abiertos todos, siempre.
     Se plegaban hasta el 18-08-2026 y eso dejaba a la vista cuatro de las doce
     hojas. Ver el comentario en `vConfiguracion`. */
  ui.config = ui.config || { seccion: 'compania', editando: null, nuevo: false };
  return ui.config;
}

/* Marca de uso: cuántos registros dependen de esta fila. Es lo que convierte
   "eliminar" en "dar de baja" y lo que impide romper el histórico. */
function cfgUso(tabla, fila) {
  return Reglas.usosDeFila(Modelo.base(), tabla, fila);
}

function cfgBadgeUso(tabla, f) {
  const n = cfgUso(tabla, f);
  if (!n) return '<span class="et gris">sin uso</span>';
  return '<span class="et azul">' + n.toLocaleString('es-CL') + '</span>';
}

function cfgAcciones(tabla, f) {
  const editando = cfg().editando === f.id;
  if (editando) {
    return '<button class="btn" data-cfg-guardar="' + esc(f.id) + '">Guardar</button> ' +
           '<button class="btn secundario" data-cfg-cancelar="1">Cancelar</button>';
  }
  return '<button class="btn secundario" data-cfg-editar="' + esc(f.id) + '">Editar</button> ' +
    (f.vigente === false
      ? '<button class="btn secundario" data-cfg-alta="' + esc(f.id) + '">Reactivar</button>'
      : '<button class="btn secundario" data-cfg-baja="' + esc(f.id) + '">Dar de baja</button>') + ' ' +
    '<button class="btn secundario" data-cfg-eliminar="' + esc(f.id) + '">Eliminar</button>';
}

const cfgInput = (campo, valor, tipo) =>
  '<input type="' + (tipo || 'text') + '" data-cfg-campo="' + campo + '" value="' + esc(valor == null ? '' : valor) + '">';

const cfgCheck = (campo, valor, id) =>
  '<input type="checkbox" data-cfg-flag="' + campo + '" data-cfg-fila="' + esc(id) + '"' +
  (valor ? ' checked' : '') + '>';

/* ───────────────── La vista ───────────────── */

function vConfiguracion() {
  const c = cfg();

  /* 🔷 DOCE PESTAÑAS EN UNA FILA (18-08-2026, Marco: "la idea era tenerlo
     separado como antes por etapas, que íbamos pinchando arriba Etapas,
     Precedencia… y así todo lo configurable").

     Es como estaba el 14 de agosto, y es a lo que se vuelve. El 15 las agrupé
     en tres bloques por frecuencia de uso —y los dos últimos plegados— para
     que la pantalla se viera más simple. Salió al revés: agrupar y esconder
     hizo que el panel que sostiene la promesa de que NINGÚN valor está escrito
     en el código pareciera tener tres cosas configurables.

     Doce pestañas al mismo nivel se leen de una: esto es lo que se puede
     configurar, y es todo. Que las que se tocan una vez al año se vean igual
     de importantes que las de todos los días resultó ser un problema menor
     que no verlas. */
  const pestanas = '<div class="tabs cfg-tabs">' + CONFIG_SECCIONES.map((s) =>
    '<button class="' + (c.seccion === s.id ? 'activo' : '') +
    '" data-cfg-sec="' + s.id + '">' + esc(s.nombre) + '</button>').join('') + '</div>';

  const cuerpo = {
    etapa: cfgEtapas, precedencia: cfgPrecedencias, estado: cfgEstados
  }[c.seccion] || (() => cfgGenerico(c.seccion));

  return `
  <div class="panel">
    <div class="cab"><div><h2>${ico('config', 'g')}Catálogos del sistema</h2>
      <div class="desc">Las ${CONFIG_SECCIONES.length} tablas que gobiernan el sistema.
        Ningún valor de ellas está escrito en el código: se agregan, se editan y se dan
        de baja desde acá, sin programador</div></div>
    </div>
    <div class="cuerpo" style="padding-bottom:0">${pestanas}</div>
    <div class="cuerpo">${cuerpo()}</div>
  </div>`;
}

/* ───────────────── Etapas ───────────────── */

function cfgEtapas() {
  const c = cfg();
  const filas = Modelo.catalogo('etapa');

  const fila = (f) => {
    const ed = c.editando === f.id;
    return '<tr class="fila' + (f.vigente === false ? ' baja' : '') + '" data-cfg-id="' + esc(f.id) + '">' +
      '<td class="num">' + (ed ? cfgInput('orden', f.orden, 'number') : f.orden) + '</td>' +
      '<td>' + (ed ? cfgInput('nombre', f.nombre) : '<strong>' + esc(f.nombre) + '</strong>' +
        (f.vigente === false ? ' <span class="et gris">de baja</span>' : '')) + '</td>' +
      '<td><span class="cod">' + (ed ? cfgInput('codigo', f.codigo) : esc(f.codigo)) + '</span></td>' +
      '<td>' + (ed ? cfgInput('color', f.color, 'color')
        : '<span class="punto" style="background:' + esc(f.color) + '"></span> ' + esc(f.color)) + '</td>' +
      '<td style="text-align:center">' + cfgCheck('aplica_siempre', f.aplica_siempre, f.id) + '</td>' +
      '<td style="text-align:center">' + cfgCheck('exige_precedencia', f.exige_precedencia, f.id) + '</td>' +
      '<td style="text-align:center">' + cfgCheck('requiere_repuestos_completos', f.requiere_repuestos_completos, f.id) + '</td>' +
      '<td class="num">' + cfgBadgeUso('etapa', f) + '</td>' +
      '<td>' + cfgAcciones('etapa', f) + '</td></tr>';
  };

  return `
  <div class="grid-envoltorio"><table class="grid">
    <thead><tr>
      <th>Orden</th><th>Etapa</th><th>Código</th><th>Color</th>
      <th title="Si se desmarca, la etapa no se asigna a todos los vehículos: un tapabarro no pasa por mecánica">Aplica siempre</th>
      <th title="Si se marca, la etapa no se puede cerrar sin haber cerrado antes las que la preceden">Exige precedencia</th>
      <th title="Si se marca, la etapa no se puede cerrar con repuestos sin llegar">Exige repuestos</th>
      <th>En uso</th><th style="min-width:230px">Acciones</th>
    </tr></thead>
    <tbody>${filas.map(fila).join('')}</tbody>
  </table></div>

  ${cfgFormNuevo('etapa', 'Agregar etapa', [
    ['nombre', 'Nombre', 'text'], ['codigo', 'Código', 'text'], ['color', 'Color', 'color']
  ])}`;
}

/* ───────────────── Precedencias ───────────────── */

function cfgPrecedencias() {
  const etapas = Modelo.catalogo('etapa');
  const pres = Modelo.base().etapa_prerrequisito;
  const nom = (id) => (etapas.find((e) => e.id === id) || {}).nombre || id;

  const filas = pres.map((p) => {
    // OJO con el paréntesis: `+` liga más fuerte que `?:`, y sin él la condición
    // termina siendo la cadena completa, que siempre es verdadera.
    const activa = !!(etapas.find((e) => e.id === p.etapa_id) || {}).exige_precedencia;
    return '<tr class="fila"><td><strong>' + esc(nom(p.etapa_id)) + '</strong></td>' +
      '<td><strong>' + esc(nom(p.requiere_etapa_id)) + '</strong></td>' +
      '<td>' + (activa
        ? '<span class="et verde">activa</span>'
        : '<span class="et gris">apagada</span>') + '</td>' +
      '<td><button class="btn secundario" data-cfg-quitar-pre="' +
        esc(p.etapa_id) + '|' + esc(p.requiere_etapa_id) + '">Quitar</button></td></tr>';
  }).join('');

  const opciones = (n) => etapas.map((e) =>
    '<option value="' + esc(e.id) + '">' + esc(e.nombre) + '</option>').join('');

  return `
  <div class="grid-envoltorio"><table class="grid">
    <thead><tr>
      <th style="width:26%">Para finalizar esta etapa</th>
      <th style="width:26%">Antes hay que cerrar</th>
      <th style="width:16%">Estado de la regla</th>
      <th>Acciones</th>
    </tr></thead>
    <tbody>${filas || '<tr><td colspan="4" class="vacio">Sin precedencias declaradas.</td></tr>'}</tbody>
  </table></div>

  <div class="rejilla-campos" style="margin-top:11px">
    <div class="campo"><label>Para finalizar</label><select id="cfg-pre-a">${opciones()}</select></div>
    <div class="campo"><label>Antes hay que cerrar</label><select id="cfg-pre-b">${opciones()}</select></div>
    <div class="campo"><label>&nbsp;</label><button class="btn" id="cfg-pre-add">Agregar precedencia</button></div>
  </div>`;
}

/* ───────────────── Estados ───────────────── */

function cfgEstados() {
  const c = cfg();
  const filas = Modelo.catalogo('estado');

  const fila = (f) => {
    const ed = c.editando === f.id;
    const huerfano = f.es_final && (!f.alcanzable_en || !f.alcanzable_en.length);
    return '<tr class="fila" data-cfg-id="' + esc(f.id) + '">' +
      '<td class="num">' + (ed ? cfgInput('orden', f.orden, 'number') : f.orden) + '</td>' +
      '<td>' + (ed ? cfgInput('nombre', f.nombre) : '<strong>' + esc(f.nombre) + '</strong>') +
        (huerfano ? ' <span class="et roja" title="Está en el maestro y en el filtro del Histórico, pero ninguna pantalla lo ofrece">sin origen declarado</span>' : '') + '</td>' +
      '<td><span class="cod">' + (ed ? cfgInput('codigo', f.codigo) : esc(f.codigo)) + '</span></td>' +
      '<td style="text-align:center">' + cfgCheck('es_final', f.es_final, f.id) + '</td>' +
      '<td style="text-align:center">' + cfgCheck('cierra_orden', f.cierra_orden, f.id) + '</td>' +
      '<td>' + ((f.alcanzable_en || []).length
        ? (f.alcanzable_en || []).map((x) => '<span class="et gris">' + esc(x) + '</span>').join(' ')
        : '<span class="et roja">ninguna</span>') + '</td>' +
      '<td class="num">' + cfgBadgeUso('estado', f) + '</td>' +
      '<td>' + cfgAcciones('estado', f) + '</td></tr>';
  };

  return `
  <div class="grid-envoltorio"><table class="grid">
    <thead><tr><th>Orden</th><th>Estado</th><th>Código</th>
      <th title="Decide si la orden sigue en la Torre o se va al Histórico">Estado final</th>
      <th title="Decide si la orden admite cambios">Cierra la orden</th>
      <th>Se alcanza desde</th><th>En uso</th><th style="min-width:230px">Acciones</th></tr></thead>
    <tbody>${filas.map(fila).join('')}</tbody>
  </table></div>

  ${cfgFormNuevo('estado', 'Agregar estado', [['nombre', 'Nombre', 'text'], ['codigo', 'Código', 'text']])}`;
}

/* ───────────────── Catálogos simples ───────────────── */

function cfgGenerico(tabla) {
  const c = cfg();
  const meta = Modelo.CATALOGOS.find((x) => x.tabla === tabla);
  if (!meta) return '<div class="vacio">Catálogo desconocido.</div>';
  const filas = Modelo.catalogo(tabla);
  // Columna extra propia de un catálogo. La usaba Temparios con su valor hora;
  // ese catálogo se eliminó el 13-08-2026 y hoy ninguno la necesita. El
  // mecanismo queda porque el próximo catálogo con un campo propio lo va a usar.
  const extra = null;

  const fila = (f) => {
    const ed = c.editando === f.id;
    return '<tr class="fila" data-cfg-id="' + esc(f.id) + '">' +
      '<td>' + (ed ? cfgInput('nombre', f.nombre) : '<strong>' + esc(f.nombre) + '</strong>' +
        (f.vigente === false ? ' <span class="et gris">de baja</span>' : '')) + '</td>' +
      // El modelo no tiene código en la base: su llave es la marca a la que
      // cuelga. Sin esto quedaba una columna vacía y todo corrido una celda.
      (tabla === 'modelo' ? '' :
        '<td><span class="cod">' + (ed ? cfgInput('codigo', f.codigo) : esc(f.codigo)) + '</span></td>') +
      (extra ? '<td class="num">' + (ed ? cfgInput(extra, f[extra], 'number') : fMonto(f[extra] || 0)) + '</td>' : '') +
      (tabla === 'compania' ? '<td>' + ((f.alias || []).length
        ? (f.alias || []).map((a) => '<span class="et ambar">' + esc(a) + '</span>').join(' ')
        : '<span class="et gris">—</span>') + '</td>' : '') +
      (tabla === 'asunto_bitacora' ? '<td style="text-align:center"><span class="cod">' +
        esc(String(f.nombre).charAt(0).toUpperCase()) + '</span></td>' +
        '<td style="text-align:center">' + cfgCheck('genera_alerta', f.genera_alerta, f.id) + '</td>' : '') +
      (tabla === 'motivo_detencion' ? '<td>' + esc(f.imputable_a || '—') + '</td>' : '') +
      (tabla === 'responsable_pago' ? '<td style="text-align:center">' + cfgCheck('es_taller', f.es_taller, f.id) + '</td>' : '') +
      /* El modelo cuelga de una marca, y esa es la columna que hay que poder
         mirar y cambiar: un modelo sin marca no se ofrece en ningún combo de
         Recepción. Al editar se elige de la lista de marcas, no se escribe:
         escribirla a mano es como el sistema actual terminó con cuatro
         grafías de la misma compañía. */
      (tabla === 'modelo' ? '<td>' + (ed ? cfgSelectMarca(f.marca_id) :
        esc(cfgNombreMarca(f.marca_id))) + '</td>' : '') +
      '<td class="num">' + cfgBadgeUso(tabla, f) + '</td>' +
      '<td>' + cfgAcciones(tabla, f) + '</td></tr>';
  };

  const cabExtra =
    (extra ? '<th>Valor hora</th>' : '') +
    (tabla === 'compania' ? '<th title="Cómo estaba escrito en el sistema actual">Se unificó con</th>' : '') +
    (tabla === 'asunto_bitacora' ? '<th>Letra</th><th>Genera alerta</th>' : '') +
    (tabla === 'motivo_detencion' ? '<th>Imputable a</th>' : '') +
    (tabla === 'responsable_pago' ? '<th>Lo paga el taller</th>' : '') +
    (tabla === 'modelo' ? '<th>Marca</th>' : '');

  return `
  <div class="grid-envoltorio"><table class="grid">
    <thead><tr><th>${esc(meta.nombre)}</th>${tabla === 'modelo' ? '' : '<th>Código</th>'}${cabExtra}<th>En uso</th><th style="min-width:230px">Acciones</th></tr></thead>
    <tbody>${filas.map(fila).join('')}</tbody>
  </table></div>
  ${tabla === 'modelo'
    ? cfgFormNuevoModelo()
    : cfgFormNuevo(tabla, 'Agregar', [['nombre', 'Nombre', 'text'], ['codigo', 'Código', 'text']]
        .concat(extra ? [[extra, 'Valor hora', 'number']] : []))}`;
}

/* ── Marcas y modelos ─────────────────────────────────────────────────
   El modelo es el único catálogo que apunta a otro. Estos tres ayudantes son
   todo lo que hace falta para eso: el nombre de su marca, el desplegable para
   elegirla, y su propio formulario de alta —que pide marca y no código—. */
const cfgNombreMarca = (id) =>
  (Modelo.catalogo('marca').find((m) => m.id === id) || {}).nombre || '— sin marca —';

const cfgSelectMarca = (id, campo) =>
  '<select data-cfg-campo="' + esc(campo || 'marca_id') + '">' +
  Modelo.catalogo('marca').map((m) =>
    '<option value="' + esc(m.id) + '"' + (m.id === id ? ' selected' : '') + '>' +
    esc(m.nombre) + '</option>').join('') + '</select>';

function cfgFormNuevoModelo() {
  return `
  <div class="rejilla-campos" style="margin-top:11px">
    <div class="campo"><label>Nombre del modelo</label>
      <input type="text" data-cfg-nuevo="nombre"></div>
    <div class="campo"><label>Marca</label>
      <select data-cfg-nuevo="marca_id">${Modelo.catalogo('marca').map((m) =>
        '<option value="' + esc(m.id) + '">' + esc(m.nombre) + '</option>').join('')}</select></div>
    <div class="campo"><label>&nbsp;</label>
      <button class="btn" data-cfg-crear="modelo">Agregar modelo</button></div>
  </div>`;
}

function cfgFormNuevo(tabla, rotulo, campos) {
  return `
  <div class="rejilla-campos" style="margin-top:11px">
    ${campos.map(([c, r, t]) =>
      '<div class="campo"><label>' + esc(r) + '</label>' +
      '<input type="' + t + '" data-cfg-nuevo="' + esc(c) + '"></div>').join('')}
    <div class="campo"><label>&nbsp;</label>
      <button class="btn" data-cfg-crear="${esc(tabla)}">${esc(rotulo)}</button></div>
  </div>`;
}

/* ⛔ ACÁ VIVÍAN «PARÁMETROS» Y «ROLES Y PERMISOS», Y SE FUERON (23-08-2026, Marco).

   **Parámetros** — «eliminar Parámetros no me sirve, eso dejalo fijo». Los doce
   valores siguen existiendo y gobernando los cálculos —la meta de días, el IVA,
   el correlativo de OT, el tamaño de las fotos—: lo que se fue es la pantalla
   para editarlos. Quedan como los siembra `semilla.js` y no se tocan desde el sistema.

   ⚠️ La TABLA `parametro` no se puede sacar y no se sacó: `correlativo_ot` se
   incrementa con cada orden que nace. Lo que desapareció es el formulario.

   **Roles y permisos** — se fue a Personal, que es donde Marco lo quiere: «que
   en el panel de Personal podamos hacer el tema de Roles y Permisos por cada
   colaborador — qué puede ver, qué puede hacer».

   Es el mismo movimiento que Andrés Guzmán ya había hecho con los módulos el
   17-08: dos personas con el mismo cargo no hacen lo mismo. La matriz por ROL
   obligaba a inventar un rol nuevo cada vez que alguien se salía del molde.

   El ROL no desapareció: sigue diciendo el ALCANCE —sobre qué órdenes trabaja—
   y sigue siendo la plantilla con la que nace una cuenta. Lo que se mueve por
   persona son los permisos, en `Personal` → la ficha de cada uno. */

/* ───────────────── Cableado ───────────────── */

function pConfiguracion() {
  const c = cfg();

  document.querySelectorAll('[data-cfg-sec]').forEach((b) => b.addEventListener('click', () => {
    c.seccion = b.dataset.cfgSec; c.editando = null; render();
  }));

  document.querySelectorAll('[data-cfg-editar]').forEach((b) => b.addEventListener('click', () => {
    c.editando = b.dataset.cfgEditar; render();
  }));
  document.querySelectorAll('[data-cfg-cancelar]').forEach((b) => b.addEventListener('click', () => {
    c.editando = null; render();
  }));

  const tabla = c.seccion;

  document.querySelectorAll('[data-cfg-guardar]').forEach((b) => b.addEventListener('click', () => {
    const tr = b.closest('tr');
    const fila = { id: b.dataset.cfgGuardar };
    tr.querySelectorAll('[data-cfg-campo]').forEach((i) => {
      const v = i.value;
      fila[i.dataset.cfgCampo] = i.type === 'number' ? Number(v) : v;
    });
    ejecutar(() => Modelo.guardar_catalogo(tabla, fila), 'Guardado.', () => { c.editando = null; render(); });
  }));

  document.querySelectorAll('[data-cfg-flag]').forEach((i) => i.addEventListener('change', () => {
    const fila = { id: i.dataset.cfgFila };
    fila[i.dataset.cfgFlag] = i.checked;
    ejecutar(() => Modelo.guardar_catalogo(tabla, fila),
      i.checked ? 'Activado.' : 'Desactivado.');
  }));

  document.querySelectorAll('[data-cfg-baja]').forEach((b) => b.addEventListener('click', () =>
    ejecutar(() => Modelo.dar_de_baja_catalogo(tabla, b.dataset.cfgBaja),
      'Dado de baja. Deja de ofrecerse en los formularios; el histórico se sigue leyendo.')));

  document.querySelectorAll('[data-cfg-alta]').forEach((b) => b.addEventListener('click', () =>
    ejecutar(() => Modelo.reactivar_catalogo(tabla, b.dataset.cfgAlta), 'Reactivado.')));

  document.querySelectorAll('[data-cfg-eliminar]').forEach((b) => b.addEventListener('click', () =>
    ejecutar(() => Modelo.eliminar_catalogo(tabla, b.dataset.cfgEliminar), 'Eliminado.')));

  document.querySelectorAll('[data-cfg-crear]').forEach((b) => b.addEventListener('click', () => {
    const fila = {};
    document.querySelectorAll('[data-cfg-nuevo]').forEach((i) => {
      const v = i.value;
      if (v !== '') fila[i.dataset.cfgNuevo] = i.type === 'number' ? Number(v) : v;
    });
    ejecutar(() => Modelo.guardar_catalogo(b.dataset.cfgCrear, fila), 'Creado.');
  }));

  const add = document.getElementById('cfg-pre-add');
  if (add) add.addEventListener('click', () => ejecutar(() => Modelo.agregar_prerrequisito(
    document.getElementById('cfg-pre-a').value,
    document.getElementById('cfg-pre-b').value), 'Precedencia agregada.'));

  document.querySelectorAll('[data-cfg-quitar-pre]').forEach((b) => b.addEventListener('click', () => {
    const [a, r] = b.dataset.cfgQuitarPre.split('|');
    ejecutar(() => Modelo.quitar_prerrequisito(a, r), 'Precedencia quitada.');
  }));

}
