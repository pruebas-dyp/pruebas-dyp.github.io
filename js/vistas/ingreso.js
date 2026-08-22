/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   LA PANTALLA DE INGRESO.

   El sistema actual no tiene nada de esto: se entra y ya. Acá cada puesto
   entra con SU usuario y SU clave, y con eso el sistema sabe quién está
   trabajando —no solo qué rol tiene—, que es lo que permite mostrarle lo suyo
   y dejar registrado quién hizo cada cosa.

   Es la primera pantalla que ve alguien, así que es la que dice de qué calidad
   es el resto. Por eso va sobria y sin ruido: logo, dos campos y un botón.

   Las credenciales de demostración están OCULTAS por omisión (decisión del
   13-08-2026). Sirven la primera vez y estorban después: quien ya las tiene
   guardadas no necesita una lista de claves ocupando media pantalla delante
   del cliente. Se abren con un enlace discreto, y la elección se recuerda.

   ⚠️ Es un ingreso MODELADO. La clave vive en el mismo navegador que la
      revisa: cualquiera que abra las herramientas del desarrollador la lee.
      La autenticación de verdad vive en el servidor, con la clave cifrada y
      sin viajar nunca hasta acá.
   ──────────────────────────────────────────────────────────────────────── */

const CLAVE_VER_CREDENCIALES = 'dyp-ingreso-credenciales';

const CSS_INGRESO = `
.velo-ingreso{position:fixed;inset:0;z-index:9500;overflow:auto;
  background:radial-gradient(1200px 620px at 50% -10%, rgba(59,111,212,.16), transparent 62%), var(--fondo);
  display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 20px}
.caja-ingreso{width:100%;max-width:392px}

.marca-ing{text-align:center;margin-bottom:26px}
.marca-ing .placa{display:inline-flex;align-items:center;justify-content:center;
  background:#fff;border-radius:8px;padding:14px 20px;box-shadow:0 6px 22px rgba(0,0,0,.30)}
.marca-ing .placa img{height:64px;width:auto;display:block}
.marca-ing .nom{font-size:20px;font-weight:800;color:var(--tinta);letter-spacing:-.3px}
.marca-ing .sub{font-size:12px;color:var(--gris);margin-top:11px;
  text-transform:uppercase;letter-spacing:2.4px;font-weight:600}

.tarjeta-ing{background:var(--superficie);border:1px solid var(--borde);border-radius:7px;
  padding:24px 26px 26px;box-shadow:0 10px 34px rgba(0,0,0,.22)}
.tarjeta-ing h2{font-size:15px;margin:0 0 4px;color:var(--tinta);letter-spacing:-.2px}
.tarjeta-ing .ayuda-ing{font-size:12px;color:var(--gris);margin:0 0 18px;line-height:1.5}
.tarjeta-ing .campo{margin-bottom:13px}
.tarjeta-ing label{display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:.9px;
  color:var(--gris);margin-bottom:5px;font-weight:600}
.tarjeta-ing input{width:100%;height:38px;font-size:13.5px;padding:0 11px}
.tarjeta-ing input:focus{border-color:var(--acento);outline:none;
  box-shadow:0 0 0 3px var(--acento-bg)}
.tarjeta-ing .btn{width:100%;height:40px;font-size:13.5px;font-weight:600;margin-top:9px}
.tarjeta-ing .fallo{background:var(--rojo-bg);border:1px solid var(--rojo-borde);color:var(--rojo-texto);
  border-radius:4px;padding:9px 11px;font-size:12.2px;margin-bottom:14px;line-height:1.45}

.pie-ing{text-align:center;margin-top:20px}
.pie-ing .enlace{background:none;border:none;color:var(--gris);font:inherit;font-size:11.5px;
  cursor:pointer;padding:4px 8px;border-radius:3px}
.pie-ing .enlace:hover{color:var(--acento);background:var(--acento-bg)}
.pie-ing .firma{font-size:10.5px;color:var(--gris-2);margin-top:12px;line-height:1.6}

.claves-demo{margin-top:14px;border:1px solid var(--borde);border-radius:6px;
  background:var(--superficie-2);padding:13px 15px;text-align:left}
.claves-demo .tit{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--gris);
  font-weight:700;margin-bottom:9px;display:flex;justify-content:space-between;align-items:center;gap:8px}
.claves-demo .tit button{background:none;border:none;color:var(--acento);font:inherit;font-size:10.5px;
  cursor:pointer;padding:0;text-transform:none;letter-spacing:0}
.claves-demo table{width:100%;border-collapse:collapse;font-size:11.5px}
.claves-demo td{padding:5px 0;border-bottom:1px solid var(--borde);vertical-align:middle}
.claves-demo tr:last-child td{border-bottom:none}
.claves-demo td:last-child{text-align:right;white-space:nowrap}
.claves-demo .cargo{color:var(--gris-2);font-size:10.5px;margin-top:1px}
.claves-demo .entrar{background:none;border:1px solid var(--borde-fuerte);border-radius:3px;
  color:var(--acento);font:inherit;font-size:10.5px;cursor:pointer;padding:2px 8px}
.claves-demo .entrar:hover{border-color:var(--acento);background:var(--acento-bg)}
.claves-demo .aviso-demo{font-size:10px;color:var(--gris-2);margin-top:10px;line-height:1.5}

@media (max-width:480px){
  .velo-ingreso{padding:20px 14px}
  .marca-ing .placa img{height:52px}
}
`;

function verCredenciales() {
  try { return localStorage.getItem(CLAVE_VER_CREDENCIALES) === 'si'; } catch (e) { return false; }
}

function fijarVerCredenciales(v) {
  try { localStorage.setItem(CLAVE_VER_CREDENCIALES, v ? 'si' : 'no'); } catch (e) { /* nada */ }
}

function pantallaIngreso(motivo) {
  if (!document.getElementById('css-ingreso')) {
    const s = document.createElement('style');
    s.id = 'css-ingreso'; s.textContent = CSS_INGRESO;
    document.head.appendChild(s);
  }
  document.querySelectorAll('.velo-ingreso').forEach((v) => v.remove());

  const gente = Modelo.sesionesPosibles();
  const mostrar = verCredenciales();

  const velo = document.createElement('div');
  velo.className = 'velo-ingreso';
  velo.innerHTML = `
  <div class="caja-ingreso">
    <div class="marca-ing">
      <span class="placa" id="ing-placa"><img src="img/logo-dyp.png" alt="Automotora D y P" id="ing-logo"></span>
      <div class="nom" id="ing-nombre" style="display:none">Automotora D y P</div>
      <div class="sub">Control de Taller</div>
    </div>

    <form class="tarjeta-ing" id="frm-ingreso" autocomplete="on">
      <h2>Ingresar al sistema</h2>
      <p class="ayuda-ing">Con el correo del puesto o su número de ficha.</p>
      ${motivo ? '<div class="fallo">' + esc(motivo) + '</div>' : ''}
      <div class="campo"><label for="ing-usuario">Usuario</label>
        <input id="ing-usuario" name="username" type="text" placeholder="recepcion@dyp.cl"
               autocomplete="username" autocapitalize="off" spellcheck="false"></div>
      <div class="campo"><label for="ing-clave">Clave</label>
        <input id="ing-clave" name="password" type="password" autocomplete="current-password"></div>
      <button class="btn" type="submit">Entrar</button>
    </form>

    <div class="pie-ing">
      <button type="button" class="enlace" id="ing-ver">
        ${mostrar ? 'Ocultar las credenciales de demostración' : 'Ver credenciales de demostración'}
      </button>

      ${mostrar ? `
      <div class="claves-demo">
        <div class="tit"><span>Cuentas de demostración</span>
          <button type="button" id="ing-nunca">No mostrarlas más</button></div>
        <table><tbody>
          ${gente.map((p) => '<tr><td><strong>' + esc(p.nombre) + '</strong>' +
            '<div class="cargo">' + esc(p.cargo) + ' · ficha ' + esc(p.ficha) + '</div></td>' +
            '<td><span class="cod">' + esc(p.usuario) + '</span><br>' +
            (p.claveDemo
              ? '<button type="button" class="entrar" data-ing-como="' + esc(p.id) + '">' +
                esc(p.claveDemo) + ' · entrar</button>'
              : '<span class="cargo">clave cambiada</span>') +
            '</td></tr>').join('')}
        </tbody></table>
        <div class="aviso-demo">Están a la vista a propósito: esto corre en el navegador y una clave
        guardada acá se puede leer. <strong>Es un ingreso modelado, no una autenticación.</strong></div>
      </div>` : ''}

      <div class="firma">Automotora D y P · Sistema de control de taller<br>
        Arttmize SpA</div>
    </div>
  </div>`;

  document.body.appendChild(velo);

  /* Si el archivo del logo no está, cae al nombre en texto. Nunca se dibuja
     una imitación del logo del taller — mismo criterio que la barra superior
     y los impresos. */
  const logo = document.getElementById('ing-logo');
  logo.addEventListener('error', () => {
    document.getElementById('ing-placa').style.display = 'none';
    document.getElementById('ing-nombre').style.display = 'block';
  });
  if (logo.complete && !logo.naturalWidth) logo.dispatchEvent(new Event('error'));

  const usuario = document.getElementById('ing-usuario');
  const clave = document.getElementById('ing-clave');
  usuario.focus();

  const entrar = (u, c) => {
    const r = Modelo.iniciar_sesion(u, c);
    if (!r.ok) { pantallaIngreso(r.motivo); return; }
    velo.remove();
    arrancarSesion(r);
  };

  document.getElementById('frm-ingreso').addEventListener('submit', (ev) => {
    ev.preventDefault();
    entrar(usuario.value, clave.value);
  });

  document.getElementById('ing-ver').addEventListener('click', () => {
    fijarVerCredenciales(!verCredenciales());
    pantallaIngreso(motivo);
  });

  const nunca = document.getElementById('ing-nunca');
  if (nunca) nunca.addEventListener('click', () => {
    fijarVerCredenciales(false);
    pantallaIngreso(motivo);
  });

  // Entrar de un clic desde la lista: en una presentación en vivo, escribir la
  // clave letra por letra no aporta nada.
  velo.querySelectorAll('[data-ing-como]').forEach((b) => b.addEventListener('click', () => {
    const p = gente.find((x) => x.id === b.dataset.ingComo);
    if (p) entrar(p.usuario, p.claveDemo);
  }));
}

/* Lo que pasa una vez adentro: se dibuja el marco con el menú que le
   corresponde a esa cuenta y se la deja en lo suyo. */
function arrancarSesion(r) {
  pintarMenu();
  montarRol();

  /* 🔴 A DÓNDE ENTRA CADA CUENTA (17-08-2026). Acá decía `ir('mitrabajo')` a
     secas, y con las cuentas del cliente eso quedó roto: «Mi trabajo» no está
     en la lista de módulos de ninguna de las catorce, así que la navegación
     rebotaba y pasaban tres cosas a la vez —las tres se ven al entrar como
     Andrés Guzmán—:

       · la persona quedaba en la pantalla que hubiera pintada de antes, no en
         la suya;
       · le salía un aviso diciéndole que no tiene un módulo que nunca pidió;
       · y como el rebote no repinta, la barra de estado se quedaba con lo de
         antes de entrar: abajo decía «Dueño» mientras arriba decía «Andrés
         Guzmán · Jefe de Recepción».

     Ahora entra a SU primer módulo, en el orden en que los ve en el menú. Las
     cuentas sin lista —los operarios, que no usan la web hoy— siguen entrando
     a «Mi trabajo», que es su pantalla. */
  const lista = Modelo.modulosDe((Modelo.personaActual() || {}).id);
  const primero = lista
    ? (MENU.find((m) => m.id && entraAlModulo(m.id)) || {}).id
    : 'mitrabajo';
  ir(primero || 'mitrabajo');
  const p = Modelo.personaActual();
  avisar({ ok: true, motivo: '' }, 'Entraste como ' +
    (p.cargo || Modelo.rolActual().nombre) + '.');
  if (r && r.claveInicial) {
    // El aviso manda a un botón que TODAS las cuentas tienen, arriba a la
    // derecha. Antes mandaba a Personal, que solo abren dos de las seis.
    avisar({ ok: false, motivo: 'Esta cuenta todavía tiene la clave inicial. Conviene cambiarla ' +
      'con el botón «Cambiar mi clave», arriba a la derecha.' });
  }
}
