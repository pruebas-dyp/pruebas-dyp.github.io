/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   EL PANEL DE REPORTERIA

   La pantalla que arma los graficos con las piezas de , mas el
   globo del dato y el impreso en PDF.

   Salio de su archivo el 22-08-2026 (COD-7), que pasaba las 1.500 lineas del
   umbral de la casa. No se movio ni una linea de logica: es corte y pegue.
   ─────────────────────────────────────────────────────────────────────── */

function vReporteria() {
  /* 🔴 LA PUERTA VA ACÁ, NO EN EL BOTÓN (23-08-2026, Marco: «que el panel de
     Reportería solo lo pueda ver administración y Gabriel Díaz. NADIE MÁS.
     SUMAMENTE IMPORTANTE»).

     Esconder el botón no es una regla: es una cortesía visual. Quien tenga la
     dirección, o quien llegue por el menú Reportes, entra igual. La única
     comprobación que sirve es la que hace la PANTALLA antes de dibujarse, y por
     eso está en la primera línea de la función y no en quien la llama.

     ⚠️ Y sigue valiendo lo de siempre: esto corre en el navegador, así que la
     fila igual llegó. Ocultarla es modelar la regla, no garantizarla — la
     garantía es RLS en la base, que es el hito H1. No decimos «cumple» donde
     corresponde decir «está modelado, falta la base». */
  if (!Modelo.puede('reporteria.ver')) {
    const yo = Modelo.personaActual();
    return `
    <div class="vacio" style="padding:34px">
      ${ico('candado', 'g')}
      <div class="titulo">La Reportería no está disponible para esta cuenta</div>
      <div class="texto">Muestra la venta, los márgenes y la rentabilidad del taller, y está
      reservada. ${yo ? 'Entraste como <strong>' + esc((yo.nombres + ' ' + (yo.apellidos || '')).trim()) +
        '</strong>.' : ''}
      Se habilita cuenta por cuenta en <strong>Personal</strong>, en la ficha de cada persona.</div>
    </div>`;
  }

  const r = repEstado();
  const lista = repUniverso();
  const meta = Modelo.metricas().metaDias;
  const g = repAgregados(lista, meta);
  const { meses, entregasMes, diasMes, ventaMes, top, dimDe, ventaPorCompania, venta, dentro,
    porEtapa, composicion, relojes, distribucion, compromiso, ticket, delta } = g;
  const d = repDinamica(lista);
  const hay = lista.length > 0;

  /* 🔴 EN UN CELULAR HASTA EL GRÁFICO ANCHO ES ANGOSTO. El `viewBox` de 1.200
     unidades metido en los 374 px útiles de un teléfono encoge la tipografía a
     un tercio: los valores sobre los puntos quedan en tres píxeles y el eje no
     se lee. Es el mismo defecto que ya se había corregido en los paneles de
     dos columnas, sólo que en pantalla chica alcanza también al de una.

     Se decide al pintar y con el ancho de VERDAD de la ventana. Si alguien
     gira el teléfono, el gráfico conserva la proporción hasta el próximo
     repintado — preferible a forzar un `render()` en el giro, que en mitad de
     un formulario borraría lo que la persona lleva escrito. */
  const chico = typeof window !== 'undefined' && window.innerWidth > 0 && window.innerWidth <= 860;
  const selDim = (id, valorActual, conVacio) => '<select id="' + id + '">' +
    (conVacio ? '<option value="">Sin abrir</option>' : '') +
    REP_DIMENSIONES.map((x) => '<option value="' + x.id + '"' +
      (valorActual === x.id ? ' selected' : '') + '>' + esc(x.rot) + '</option>').join('') + '</select>';
  const vacio = (t) => '<div class="vacio"><div class="titulo">' + esc(t) + '</div></div>';
  const pct = (n, de) => (de ? Math.round((n / de) * 100) : 0);

  const etapasApiladas = porEtapa.filas.map((f) => ({ k: f.k, v: f.v, color: f.color }));
  const peor = porEtapa.filas.slice().sort((a, b) => b.v - a.v)[0];

  return `
  <button class="btn volver" id="rep-volver"><span class="flecha-atras">&#8592;</span>
    Volver al buscador del histórico</button>

  <div class="panel">
    <div class="cab"><div><h2>${ico('consolidado', 'g')}Reportería</h2>
      <div class="desc">Sobre las ${lista.length} órdenes entregadas del período. Todo se calcula
        al mirarlo: no hay un reporte que alguien tenga que refrescar</div></div>
      <button class="btn secundario" id="rep-pdf">${ico('imprimir')}PDF</button></div>
    <div class="cuerpo">
      <div class="rejilla-campos">
        <div class="campo"><label>Entregadas desde</label>
          <input type="date" id="rep-desde" value="${esc(r.desde)}"></div>
        <div class="campo"><label>Hasta</label>
          <input type="date" id="rep-hasta" value="${esc(r.hasta)}"></div>
        <div class="campo"><label>Compañía</label>
          <select id="rep-compania"><option value="">Todas</option>${Modelo.catalogo('compania')
            .map((c) => '<option value="' + esc(c.id) + '"' + (r.compania_id === c.id ? ' selected' : '') +
            '>' + esc(c.nombre) + '</option>').join('')}</select></div>
        <div class="campo"><label>&nbsp;</label>
          <button class="btn secundario" id="rep-limpiar">Todo el período</button></div>
      </div>
    </div>
  </div>

  ${!hay ? vacio('Sin órdenes entregadas en el período elegido') : `

  ${/* El rótulo del delta dice contra QUÉ se compara. Sin eso, un «−8%» al lado
       de una cifra es una afirmación sin sujeto: nadie sabe si es contra el mes
       pasado, contra el año pasado o contra la meta. */''}
  <div class="tira-kpi">
    ${[{ rot: 'Órdenes entregadas', val: repMiles(lista.length),
        sub: meses.length + (meses.length === 1 ? ' mes con entregas' : ' meses con entregas'),
        serie: g.serieOrdenes, bueno: 'alto', tono: 'acento' },
       { rot: 'Venta del período', val: fMonto(venta), chico: true,
        sub: 'facturación de las órdenes cerradas',
        serie: g.serieVenta, bueno: 'alto', tono: 'acento' },
       { rot: 'Ticket promedio', val: fMonto(ticket), chico: true,
        sub: 'por orden entregada',
        serie: g.serieTicket, bueno: 'alto', tono: 'violeta' },
       { rot: 'Reparación promedio', val: Math.round(g.promReparacion) + ' d',
        sub: 'contra una meta de ' + meta + ' días',
        clase: g.promReparacion > meta ? 'mal' : 'bien',
        serie: g.serieDias, bueno: 'bajo', tono: 'rojo' },
       { rot: 'Dentro de la meta', val: pct(dentro, lista.length) + '%',
        sub: repMiles(dentro) + ' de ' + repMiles(lista.length) + ' órdenes',
        clase: pct(dentro, lista.length) < 50 ? 'mal' : 'bien',
        serie: g.serieCumple, bueno: 'alto', tono: 'verde' }
      ].map((t) => repTarjeta(Object.assign(t, {
        delta: delta(t.serie),
        rotDelta: g.hayMesEnCurso ? 'entre meses cerrados' : 'vs. mes anterior',
        notaDelta: g.mesesCerrados < 2
          ? 'hace falta un segundo mes cerrado para comparar'
          : 'sin mes anterior con que comparar'
      }))).join('')}
  </div>
  ${repFormulas([
    { que: 'Órdenes entregadas', exp: 'órdenes con estado final y fecha de entrega en el período',
      num: '= ' + repMiles(lista.length) },
    { que: 'Venta', exp: 'mano de obra + repuestos + T.O.T., sin las OR anuladas',
      num: composicion.map((p) => repPlataCorta(p.v)).join(' + ') + ' = ' + fMonto(venta) },
    { que: 'Ticket promedio', exp: 'venta ÷ órdenes',
      num: repPlataCorta(venta) + ' ÷ ' + repMiles(lista.length) + ' = ' + fMonto(ticket) },
    { que: 'Reparación promedio', exp: 'Σ días de reparación ÷ órdenes',
      num: repMiles(g.sumaDias) + ' ÷ ' + repMiles(lista.length) + ' = ' +
        Math.round(g.promReparacion) + ' d' },
    { que: 'Dentro de la meta', exp: 'órdenes con reparación ≤ ' + meta + ' d ÷ órdenes',
      num: repMiles(dentro) + ' ÷ ' + repMiles(lista.length) + ' = ' + pct(dentro, lista.length) + '%' },
    { que: 'Variación', exp: '(último mes cerrado − el anterior) ÷ el anterior',
      num: g.hayMesEnCurso
        ? 'sobre ' + g.mesesCerrados + ' de ' + meses.length + ' meses · ' + g.notaMesEnCurso
        : 'sobre los ' + meses.length + ' meses del período' }
  ])}

  <div class="panel destacado" style="margin-top:11px">
    <div class="cab"><div><h2>${ico('reloj', 'g')}Dónde se van los días</h2>
      <div class="desc">Los ${Math.round(g.promTotales)} días que dura una orden, abiertos etapa
        por etapa. <strong>El sistema actual no puede mostrar esto</strong>: guarda la etapa en la
        que está el auto, no cuándo entró y salió de cada una, así que no hay dos fechas que
        restar</div></div>
      <span class="et ${peor && peor.v > 0 ? 'roja' : 'gris'}">${peor
        ? 'Se pierde más tiempo en ' + esc(peor.k) : 'Sin etapas cerradas'}</span></div>
    <div class="cuerpo">
      ${porEtapa.filas.length ? repApilada(etapasApiladas, { fmt: (v) => Math.round(v) + ' d' }) +
        '<div class="rejilla-2 sep">' +
          '<div>' + svgBarrasH(porEtapa.filas.map((f) => ({ k: f.k, v: f.v,
            rot: (Math.round(f.v * 10) / 10).toString().replace('.', ',') + ' días', color: f.color })),
            { destacar: false }) + '</div>' +
          '<div>' + repFormulas([
            { que: 'Días de una etapa', exp: 'cierre − asignación, en calendario', num: '' },
            peor ? { que: 'Promedio · ' + peor.k, exp: 'Σ días ÷ etapas cerradas',
              num: repMiles(Math.round(peor.dias)) + ' ÷ ' + repMiles(peor.n) + ' = ' +
                (Math.round(peor.v * 10) / 10).toString().replace('.', ',') + ' d' } : null,
            { que: 'Etapas consideradas', exp: porEtapa.abiertas
                ? 'cerradas ÷ asignadas · las abiertas no tienen tiempo todavía'
                : 'cerradas ÷ asignadas',
              num: repMiles(porEtapa.cubiertas) + ' ÷ ' +
                repMiles(porEtapa.cubiertas + porEtapa.abiertas) },
            { que: 'Auto donde el cliente', exp: 'se carga a la etapa que estaba abierta',
              num: '' }
          ]) +
          '<div class="nota-panel"><p class="dato-demo">Dato de demostración: los tiempos por etapa ' +
          'salen de la base sembrada. Con la base real de DyP se calcula igual.</p></div></div>' +
        '</div>'
        : vacio('Ninguna orden del período tiene etapas cerradas')}
    </div>
  </div>

  <div class="panel destacado" style="margin-top:11px">
    <div class="cab"><div><h2>Días de reparación por mes</h2>
      <div class="desc">La otra vista que el sistema actual no puede tener: al entregar pierde el
        contador. La franja verde de abajo es cumplir; todo lo que queda sobre la línea de la meta
        va en vino</div></div></div>
    <div class="cuerpo">${meses.length
      ? svgSerie(diasMes, { compacto: chico, meta, metaRot: 'días', fmt: (v) => Math.round(v) + ' d' }) +
        repFormulas([
          { que: 'Punto del mes', exp: 'Σ días de reparación ÷ entregas de ese mes',
            num: (() => { const u = diasMes[diasMes.length - 1];
              return u ? u.etiqueta + ' = ' + u.v + ' d' : ''; })() },
          { que: 'Meta', exp: 'parámetro del sistema (Configuración → Parámetros)',
            num: meta + ' días' },
          g.hayMesEnCurso ? { que: 'Último punto', exp: 'mes incompleto',
            num: g.notaMesEnCurso } : null
        ])
      : vacio('Sin entregas en el período')}</div>
  </div>

  <div class="rejilla-2" style="margin-top:11px">
    <div class="panel">
      <div class="cab"><div><h2>Entregas por mes</h2>
        <div class="desc">Cuántos vehículos salieron cada mes</div></div></div>
      <div class="cuerpo">${meses.length ? svgBarras(entregasMes, { compacto: true }) +
        repFormulas([
          { que: 'Barra del mes', exp: 'órdenes con fecha de entrega en ese mes',
            num: '= ' + repMiles(lista.length) + ' en total' },
          g.hayMesEnCurso ? { que: 'Última barra', exp: 'mes incompleto', num: g.notaMesEnCurso } : null
        ])
        : vacio('Sin entregas')}</div>
    </div>
    <div class="panel">
      <div class="cab"><div><h2>Venta por mes</h2>
        <div class="desc">Lo facturado en las órdenes que se cerraron ese mes</div></div></div>
      <div class="cuerpo">${meses.length
        ? svgSerie(ventaMes, { compacto: true, fmt: (v) => repPlataCorta(v) }) +
          repFormulas([
            { que: 'Punto del mes', exp: 'Σ venta de las órdenes entregadas ese mes',
              num: '= ' + fMonto(venta) + ' en total' },
            g.hayMesEnCurso ? { que: 'Último punto', exp: 'mes incompleto', num: g.notaMesEnCurso } : null
          ])
        : vacio('Sin entregas')}</div>
    </div>
  </div>

  <div class="rejilla-2" style="margin-top:11px">
    <div class="panel">
      <div class="cab"><div><h2>De dónde sale la venta</h2>
        <div class="desc">Las tres columnas del presupuesto. Suman el total exacto</div></div></div>
      <div class="cuerpo">${svgAnillo(composicion,
        { fmt: (v) => fMonto(v), centro: repPlataCorta(venta), centroRot: 'venta del período' })}
        ${repFormulas([
          { que: 'Mano de obra', exp: 'Σ horas × tempario',
            num: '= ' + fMonto(composicion[0].v) },
          { que: 'Repuestos', exp: 'sólo los que pone el taller',
            num: '= ' + fMonto(composicion[1].v) },
          { que: 'T.O.T.', exp: 'trabajos externos',
            num: '= ' + fMonto(composicion[2].v) },
          { que: 'Venta', exp: 'las tres columnas, sin las OR anuladas',
            num: composicion.map((p) => repPlataCorta(p.v)).join(' + ') + ' = ' + fMonto(venta) }
        ])}</div>
    </div>
    <div class="panel">
      <div class="cab"><div><h2>${ico('reloj', 'g')}Los tres relojes</h2>
        <div class="desc">Días totales = reparación + fuera de taller. El sistema actual cuenta
          uno solo, y por eso un auto que se fue y volvió aparece con el reloj en cero</div></div></div>
      <div class="cuerpo">
        ${repApilada(relojes.partes, { fmt: (v) => Math.round(v) + ' d' })}
        <div class="rejilla-campos sep">
          <div class="campo"><label>Días totales (promedio)</label>
            <div class="lectura">${Math.round(g.promTotales)} días</div></div>
          <div class="campo"><label>De reparación</label>
            <div class="lectura">${Math.round(g.promReparacion)} días</div></div>
          <div class="campo"><label>Fuera de taller</label>
            <div class="lectura">${Math.round(g.promTotales - g.promReparacion)} días</div></div>
        </div>
        ${repFormulas([
          { que: 'Días totales', exp: 'entrega − ingreso',
            num: repMiles(g.sumaTotales) + ' ÷ ' + repMiles(lista.length) + ' = ' +
              Math.round(g.promTotales) + ' d' },
          { que: 'De reparación', exp: 'Σ (salida − entrada) de cada estadía',
            num: repMiles(g.sumaDias) + ' ÷ ' + repMiles(lista.length) + ' = ' +
              Math.round(g.promReparacion) + ' d' },
          { que: 'Fuera de taller', exp: 'totales − reparación',
            num: Math.round(g.promTotales) + ' − ' + Math.round(g.promReparacion) + ' = ' +
              Math.round(g.promTotales - g.promReparacion) + ' d' },
          relojes.conSalida
            ? { que: 'Se fueron y volvieron', exp: 'órdenes con más de una estadía',
                num: repMiles(relojes.conSalida) + ' de ' + repMiles(lista.length) + ' · ' +
                  Math.round(relojes.fueraDeEsas) + ' d afuera de ' +
                  Math.round(relojes.totalDeEsas) + ' d totales' }
            : { que: 'Se fueron y volvieron', exp: 'órdenes con más de una estadía',
                num: 'ninguna · los dos relojes dan lo mismo' },
          relojes.conSalida
            ? { que: 'Lo que pierde su sistema', exp: 'reinicia el contador al regrabar el estado',
                num: Math.round(relojes.fueraDeEsas) + ' d por orden' }
            : null
        ])}
      </div>
    </div>
  </div>

  <div class="rejilla-2" style="margin-top:11px">
    <div class="panel">
      <div class="cab"><div><h2>Cómo se reparten los días</h2>
        <div class="desc">El promedio esconde la forma: no es lo mismo un taller parejo que uno
          que entrega la mitad rápido y la otra mitad muy lento</div></div></div>
      <div class="cuerpo">${svgBarras(distribucion.cajas,
        { compacto: true, marcaX: distribucion.marcaX, marcaRot: 'meta ' + meta + ' d' })}
        ${repFormulas([
          { que: 'Cada barra', exp: 'órdenes cuya reparación cae en el tramo', num: '' },
          { que: 'Barra azul', exp: 'tramo dentro de la meta de ' + meta + ' d',
            num: repMiles(dentro) + ' ÷ ' + repMiles(lista.length) + ' = ' +
              pct(dentro, lista.length) + '%' },
          { que: 'Promedio', exp: 'la cola larga lo arrastra sobre el tramo más alto',
            num: Math.round(g.promReparacion) + ' d' }
        ])}</div>
    </div>
    <div class="panel">
      <div class="cab"><div><h2>La fecha que se le prometió al cliente</h2>
        <div class="desc">Entrega real contra la fecha de compromiso que escribió recepción</div></div></div>
      <div class="cuerpo">
        ${compromiso.pct === null
          ? vacio('Ninguna orden del período tiene fecha de compromiso escrita')
          : repApilada([
              { k: 'Entregadas a tiempo', v: compromiso.aTiempo, tono: 'verde' },
              { k: 'Entregadas con atraso', v: compromiso.con - compromiso.aTiempo, tono: 'rojo' }
            ], { fmt: (v) => repMiles(v) }) +
            '<div class="rejilla-campos sep">' +
              '<div class="campo"><label>Cumplimiento</label>' +
                '<div class="lectura ' + (compromiso.pct < 50 ? 'malo' : 'bueno') + '">' +
                compromiso.pct + '%</div></div>' +
              '<div class="campo"><label>Atraso promedio</label>' +
                '<div class="lectura">' + compromiso.atrasoProm + ' días</div></div>' +
              '<div class="campo"><label>Sin compromiso escrito</label>' +
                '<div class="lectura">' + repMiles(compromiso.sin) + ' de ' +
                repMiles(lista.length) + '</div></div>' +
            '</div>' +
            repFormulas([
              { que: 'A tiempo', exp: 'fecha de entrega ≤ fecha de compromiso',
                num: '= ' + repMiles(compromiso.aTiempo) },
              { que: 'Cumplimiento', exp: 'a tiempo ÷ órdenes CON compromiso escrito',
                num: repMiles(compromiso.aTiempo) + ' ÷ ' + repMiles(compromiso.con) + ' = ' +
                  compromiso.pct + '%' },
              { que: 'Base del cálculo', exp: 'las que no tienen fecha escrita quedan fuera',
                num: repMiles(compromiso.con) + ' de ' + repMiles(lista.length) +
                  (compromiso.sin ? ' · ' + repMiles(compromiso.sin) + ' sin compromiso' : '') },
              { que: 'Atraso promedio', exp: 'Σ (entrega − compromiso) ÷ órdenes atrasadas',
                num: '= ' + compromiso.atrasoProm + ' d' }
            ])}
      </div>
    </div>
  </div>

  <div class="panel destacado" style="margin-top:11px">
    <div class="cab"><div><h2>${ico('personal', 'g')}Quién demora menos</h2>
      <div class="desc">Días promedio desde que se le asigna la etapa hasta que la termina, y
        cuántas le devolvieron. <strong>El sistema actual no puede mostrar esto</strong>: no guarda
        quién hizo cada etapa, ni cuándo se la dieron, ni si hubo que rehacerla</div></div>
      ${g.porPersona.length ? '<span class="et verde">' + esc(g.porPersona[0].k) + ' es el más rápido</span>' : ''}</div>
    <div class="cuerpo">
      ${g.porPersona.length
        ? svgBarrasH(g.porPersona.map((p) => ({ k: p.k, v: p.v,
            rot: (Math.round(p.v * 10) / 10).toString().replace('.', ',') + ' d · ' + p.n + ' etapas' +
              (p.dev ? ' · ' + p.dev + ' devuelta' + (p.dev === 1 ? '' : 's') : '') })),
            { destacar: true }) +
          repFormulas([
            { que: 'Días de la persona', exp: 'Σ (terminó − se la asignaron) ÷ etapas que cerró',
              num: g.porPersona.length ? g.porPersona[0].k + ': ' +
                (Math.round(g.porPersona[0].v * 10) / 10).toString().replace('.', ',') + ' d' : '' },
            { que: 'Quién entra', exp: 'sólo con 3 etapas cerradas o más',
              num: g.porPersona.length + ' de ' + Modelo.base().persona.filter((p) => p.tipo === 'trabajador').length + ' del equipo' },
            /* Va ANTES de los promedios a propósito: es la advertencia de
               cuánto del taller no está en el ranking de arriba. */
            { que: 'Sin encargado', exp: 'etapas cerradas que no se le pueden atribuir a nadie',
              num: g.sinEncargado.total
                ? g.sinEncargado.sin + ' de ' + g.sinEncargado.total + ' = ' +
                  Math.round((g.sinEncargado.sin * 100) / g.sinEncargado.total) + '% del trabajo'
                : 'sin etapas cerradas' },
            { que: 'Reparto', exp: 'del ingreso del auto a que le asignen la PRIMERA etapa',
              num: (Math.round(g.tramos.reparto * 10) / 10).toString().replace('.', ',') + ' d · mide al que asigna' },
            { que: 'Revisión', exp: 'del término al visto bueno',
              num: (Math.round(g.tramos.revision * 10) / 10).toString().replace('.', ',') + ' d · mide al que valida' },
            /* Rápido y devuelto no es rápido. Va en la misma tabla que la
               velocidad a propósito: separadas, la primera se lee como un
               ranking de quién trabaja mejor, y no lo es. */
            { que: 'Se le devolvió', exp: 'etapas que el jefe rechazó ÷ etapas que cerró',
              num: (function () {
                const conDev = g.porPersona.filter((p) => p.dev > 0);
                if (!conDev.length) return 'ninguna en el período';
                const peor = conDev.slice().sort((a, b) => b.tasa - a.tasa)[0];
                return peor.k + ': ' + peor.dev + ' de ' + peor.n + ' = ' +
                  Math.round(peor.tasa) + '%';
              })() }
          ])
        : vacio('Todavía no hay etapas cerradas con encargado en el período')}
      <div class="nota-panel"><p class="dato-demo">Dato de demostración: los tiempos por persona
        salen de la base sembrada. Con la base real de DyP se calcula igual.</p></div>
    </div>
  </div>

  <div class="rejilla-2" style="margin-top:11px">
    <div class="panel">
      <div class="cab"><div><h2>Venta por compañía</h2></div></div>
      <div class="cuerpo">${svgBarrasH(ventaPorCompania, { destacar: true })}</div>
    </div>
    <div class="panel">
      <div class="cab"><div><h2>Modelos más siniestrados</h2></div></div>
      <div class="cuerpo">${svgBarrasH(top(dimDe('modelo'), 10), { destacar: true })}</div>
    </div>
    <div class="panel">
      <div class="cab"><div><h2>Clientes con más vehículos</h2></div></div>
      <div class="cuerpo">${svgBarrasH(top(dimDe('cliente'), 10), { destacar: true })}</div>
    </div>
    <div class="panel">
      <div class="cab"><div><h2>Marcas</h2></div></div>
      <div class="cuerpo">${svgBarrasH(top(dimDe('marca'), 10), { destacar: true })}</div>
    </div>
  </div>
  `}

  <div class="panel" style="margin-top:11px">
    <div class="cab"><div><h2>${ico('consolidado', 'g')}Tabla dinámica</h2>
      <div class="desc">Se elige qué agrupa las filas, qué abre las columnas y qué se suma adentro</div></div></div>
    <div class="cuerpo">
      <div class="rejilla-campos">
        <div class="campo"><label>Agrupar filas por</label>${selDim('rep-filas', r.filas)}</div>
        <div class="campo"><label>Abrir columnas por</label>${selDim('rep-columnas', r.columnas, true)}</div>
        <div class="campo"><label>Medida</label>
          <select id="rep-medida">${REP_MEDIDAS.map((m) => '<option value="' + m.id + '"' +
            (r.medida === m.id ? ' selected' : '') + '>' + esc(m.rot) + '</option>').join('')}</select>
          <span class="ayuda">${d.med.suma ? 'Se suma' : 'Se promedia'} dentro de cada celda</span></div>
      </div>
      ${repTablaDinamica(d)}
    </div>
  </div>

  <div class="globo-graf" id="rep-globo" hidden></div>`;
}

function repTablaDinamica(d) {
  if (!d.filasOrd.length) {
    return '<div class="vacio" style="margin-top:11px"><div class="titulo">Sin datos en el período</div></div>';
  }
  const cel = (f, c) => {
    const v = d.valor(d.celdas.get(f + '|' + c));
    return v === null ? '<span style="color:var(--gris-2)">—</span>' : d.med.fmt(v);
  };

  return '<div class="grid-envoltorio" style="margin-top:11px"><table class="grid">' +
    '<thead><tr><th>' + esc(d.dimF.rot) + '</th>' +
    (d.dimC ? d.columnasOrd.map(([c]) => '<th class="num">' +
      esc(d.dimC.id === 'mes' ? repMesCorto(c) : c) + '</th>').join('') : '') +
    '<th class="num">' + esc(d.med.rot) + '</th></tr></thead><tbody>' +
    d.filasOrd.map(([f, tot]) => '<tr><td>' +
      esc(d.dimF.id === 'mes' ? repMesCorto(f) : f) + '</td>' +
      (d.dimC ? d.columnasOrd.map(([c]) => '<td class="num">' + cel(f, c) + '</td>').join('') : '') +
      '<td class="num"><strong>' + d.med.fmt(d.valor(tot)) + '</strong></td></tr>').join('') +
    '</tbody><tfoot><tr><td><strong>Total</strong></td>' +
    (d.dimC ? d.columnasOrd.map(() => '<td></td>').join('') : '') +
    '<td class="num"><strong>' + (d.totalGeneral === null ? '—' : d.med.fmt(d.totalGeneral)) +
    '</strong></td></tr></tfoot></table></div>' +
    (d.med.suma ? '' : '<div class="pie-nota">Es un <strong>promedio</strong>: el total de abajo ' +
      'promedia todas las órdenes del período, no la suma de la columna. Sumar promedios da un ' +
      'número que no significa nada.</div>');
}

function pReporteria() {
  const r = repEstado();
  const volver = document.getElementById('rep-volver');
  if (volver) volver.addEventListener('click', () => {
    historicoEstado().vista = 'buscador'; render();
  });

  const leer = () => {
    r.desde = (document.getElementById('rep-desde') || {}).value || '';
    r.hasta = (document.getElementById('rep-hasta') || {}).value || '';
    r.compania_id = (document.getElementById('rep-compania') || {}).value || '';
    r.filas = (document.getElementById('rep-filas') || {}).value || 'compania';
    r.columnas = (document.getElementById('rep-columnas') || {}).value || '';
    r.medida = (document.getElementById('rep-medida') || {}).value || 'ordenes';
  };
  ['rep-desde', 'rep-hasta', 'rep-compania', 'rep-filas', 'rep-columnas', 'rep-medida']
    .forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => { leer(); render(); });
    });

  const limpiar = document.getElementById('rep-limpiar');
  if (limpiar) limpiar.addEventListener('click', () => {
    r.desde = r.hasta = r.compania_id = ''; render();
  });

  const pdf = document.getElementById('rep-pdf');
  if (pdf) pdf.addEventListener('click', () => mostrarImpreso(impresoReporteria(), 'Reportería'));

  repEngancharGlobo();
}

/* ── El globo del dato ─────────────────────────────────────────────────
   Un solo recuadro flotante para TODOS los gráficos, no uno por dibujo. Se
   engancha en el contenedor y pregunta al vuelo qué hay debajo del mouse
   (delegación): si se enganchara elemento por elemento habría que volver a
   recorrer cientos de figuras en cada repintado.

   Los `<title>` de cada figura se dejan puestos igual: son el globo del
   navegador, funcionan sin JavaScript y son los que salen al imprimir. */
function repEngancharGlobo() {
  const caja = document.getElementById('contenido');
  if (!caja) return;

  /* ⚠️ EL OYENTE SE ENGANCHA UNA SOLA VEZ EN LA VIDA DE LA PANTALLA.

     `#contenido` NO se reemplaza en cada repintado: se le cambia el `innerHTML`
     y el nodo es siempre el mismo. Enganchando sin marca, cada vez que alguien
     tocaba un filtro se sumaba otro `mousemove` sobre el mismo elemento, y
     después de veinte cambios de filtro había veinte funciones corriendo por
     cada píxel que el mouse recorre. No se ve —el globo dice lo mismo veinte
     veces— hasta que el panel se pone lento y nadie sabe por qué.

     La marca va en el nodo y no en una variable de módulo porque lo que hay
     que recordar es si ESE nodo ya está enganchado. */
  if (caja.dataset.globoEnganchado === '1') return;
  caja.dataset.globoEnganchado = '1';

  // El globo se busca en cada movimiento, no acá: el de ahora se va a ir con
  // el próximo repintado y el oyente tiene que encontrar el nuevo.
  const mostrar = (ev) => {
    const globo = document.getElementById('rep-globo');
    if (!globo) return;
    const el = ev.target && ev.target.closest ? ev.target.closest('[data-tip]') : null;
    if (!el) { globo.hidden = true; return; }
    globo.textContent = el.getAttribute('data-tip');
    globo.hidden = false;
    // Se corre solo para no salirse por el borde derecho de la ventana.
    const ancho = globo.offsetWidth || 160;
    const x = Math.min(ev.clientX + 14, (window.innerWidth || 1200) - ancho - 10);
    globo.style.left = Math.max(8, x) + 'px';
    globo.style.top = Math.max(8, ev.clientY - 34) + 'px';
  };
  caja.addEventListener('mousemove', mostrar);
  caja.addEventListener('mouseleave', () => {
    const globo = document.getElementById('rep-globo');
    if (globo) globo.hidden = true;
  });
}

/* El PDF de la reportería. Los gráficos van tal cual —son SVG, y el SVG se
   imprime nítido a cualquier tamaño, que es la otra razón para dibujarlos acá
   en vez de traer una librería que pinta sobre un lienzo de píxeles. */
function impresoReporteria() {
  const lista = repUniverso();
  const d = repDinamica(lista);
  const meta = Modelo.metricas().metaDias;
  const r = repEstado();
  // Los mismos agregados que la pantalla, calculados una sola vez y en un solo
  // lugar: el papel no puede decir algo distinto de lo que se está mirando.
  const g = repAgregados(lista, meta);
  const { meses, entregasMes, diasMes, top, dimDe, ventaPorCompania, venta, dentro,
    porEtapa, composicion, compromiso, ticket } = g;

  const periodo = (r.desde || r.hasta)
    ? (r.desde || 'el inicio') + ' a ' + (r.hasta || 'hoy')
    : 'Todo el período';

  const cel = (f, c) => {
    const v = d.valor(d.celdas.get(f + '|' + c));
    return v === null ? '—' : d.med.fmt(v);
  };

  // Una tabla de dos columnas para los rankings del papel.
  const tabla = (cabs, filas) => '<table><thead><tr>' +
    cabs.map((c, i) => '<th' + (i ? ' class="n"' : '') + '>' + esc(c) + '</th>').join('') +
    '</tr></thead><tbody>' + filas + '</tbody></table>';

  return `
  <div class="cab-doc">
    <div>${logoImpreso()}
      <div style="font-size:10px;color:#555">Desabolladura y pintura</div>
      <div style="margin-top:5px;font-size:13px;font-weight:700">Reportería</div></div>
    <div class="der"><div><strong>${lista.length} órdenes entregadas</strong></div>
      <div>${esc(periodo)}</div><div>Emitido ${fFechaHora(HOY)}</div></div>
  </div>

  <h2>Indicadores</h2>
  <div class="rej">
    ${campoImpreso('Órdenes entregadas', lista.length)}
    ${campoImpreso('Venta', fMonto(venta))}
    ${campoImpreso('Ticket promedio', fMonto(ticket))}
    ${campoImpreso('Reparación promedio', lista.length
      ? Math.round(g.promReparacion) + ' días' : '—')}
    ${campoImpreso('Dentro de la meta de ' + meta + ' días',
      (lista.length ? Math.round((dentro / lista.length) * 100) : 0) + '%')}
    ${campoImpreso('Entregadas en la fecha comprometida', compromiso.pct === null
      ? 'sin compromiso escrito'
      : compromiso.pct + '% (' + compromiso.aTiempo + ' de ' + compromiso.con + ')')}
  </div>

  ${/* 🔴 EL PDF LLEVA LOS GRÁFICOS, no sólo la tabla. Salía con una sola y era
       un reporte a medias: el gráfico de días contra la meta es justamente lo
       que se le muestra al dueño, y es lo que faltaba en el papel.

       Los SVG se imprimen tal cual —vectoriales, nítidos a cualquier tamaño—,
       que es la otra razón por la que estos gráficos se dibujaron a mano en
       vez de traer una librería que pinta sobre un lienzo de píxeles. */''}
  <h2>Dónde se van los días</h2>
  ${porEtapa.filas.length
    ? repFormulas([
        { que: 'Días de una etapa', exp: 'fecha de cierre - fecha de asignación',
          num: 'calendario, no horas trabajadas' },
        { que: 'Promedio de la etapa', exp: 'suma de días / etapas cerradas', num: 'ver la tabla' },
        { que: 'Etapas consideradas', exp: 'cerradas / asignadas',
          num: repMiles(porEtapa.cubiertas) + ' / ' +
            repMiles(porEtapa.cubiertas + porEtapa.abiertas) }
      ]) +
      tabla(['Etapa', 'Días promedio', 'Etapas cerradas'], porEtapa.filas
        .map((f) => '<tr><td>' + esc(f.k) + '</td><td class="n">' +
          (Math.round(f.v * 10) / 10).toString().replace('.', ',') + '</td><td class="n">' +
          f.n + '</td></tr>').join(''))
    : '<p>Ninguna orden del período tiene etapas cerradas.</p>'}

  ${/* Los tres relojes van en el papel porque es LA corrección del sistema. El
       gráfico no aporta —son dos números—, así que va como tabla y con la
       frase que explica qué se pierde. */''}
  <h2>Los tres relojes</h2>
  ${tabla(['Reloj', 'Promedio'], [
    ['Días totales (del ingreso a la entrega)', Math.round(g.promTotales)],
    ['De reparación (el vehículo en el taller)', Math.round(g.promReparacion)],
    ['Fuera de taller (con el cliente)', Math.round(g.promTotales - g.promReparacion)]
  ].map((f) => '<tr><td>' + esc(f[0]) + '</td><td class="n">' + f[1] + ' días</td></tr>').join(''))}
  ${repFormulas([
    { que: 'Días totales', exp: 'entrega - ingreso',
      num: repMiles(g.sumaTotales) + ' / ' + repMiles(lista.length) + ' = ' +
        Math.round(g.promTotales) + ' d' },
    { que: 'De reparación', exp: 'suma de (salida - entrada) de cada estadía',
      num: repMiles(g.sumaDias) + ' / ' + repMiles(lista.length) + ' = ' +
        Math.round(g.promReparacion) + ' d' },
    { que: 'Fuera de taller', exp: 'totales - reparación',
      num: Math.round(g.promTotales) + ' - ' + Math.round(g.promReparacion) + ' = ' +
        Math.round(g.promTotales - g.promReparacion) + ' d' },
    { que: 'Se fueron y volvieron', exp: 'órdenes con más de una estadía',
      num: g.relojes.conSalida
        ? repMiles(g.relojes.conSalida) + ' de ' + repMiles(lista.length) + ' · ' +
          Math.round(g.relojes.fueraDeEsas) + ' d afuera de ' +
          Math.round(g.relojes.totalDeEsas) + ' d totales'
        : 'ninguna · los dos relojes dan lo mismo' },
    g.relojes.conSalida
      ? { que: 'Lo que pierde su sistema', exp: 'el contador se reinicia al regrabar el estado',
          num: Math.round(g.relojes.fueraDeEsas) + ' d por orden' }
      : null
  ])}

  <h2>Días de reparación por mes</h2>
  ${meses.length ? svgSerie(diasMes, { meta, metaRot: 'días', fmt: (v) => Math.round(v) + ' d' })
    : '<p>Sin entregas en el período.</p>'}
  ${repFormulas([
    { que: 'Punto del mes', exp: 'suma de días de reparación / entregas de ese mes',
      num: 'meta ' + meta + ' días' },
    g.hayMesEnCurso ? { que: 'Último punto', exp: 'mes incompleto', num: g.notaMesEnCurso } : null
  ])}

  <h2>Entregas por mes</h2>
  ${meses.length ? svgBarras(entregasMes) : '<p>Sin entregas en el período.</p>'}

  <h2>De dónde sale la venta</h2>
  ${tabla(['Concepto', 'Monto'], composicion.map((p) => '<tr><td>' + esc(p.k) +
    '</td><td class="n">' + esc(fMonto(p.v)) + '</td></tr>').join('') +
    '<tr><td><strong>Total</strong></td><td class="n"><strong>' + esc(fMonto(venta)) +
    '</strong></td></tr>')}

  <h2>Modelos más siniestrados</h2>
  ${tabla(['Modelo', 'Órdenes'], top(dimDe('modelo'), 10)
    .map((x) => '<tr><td>' + esc(x.k) + '</td><td class="n">' + x.v + '</td></tr>').join(''))}

  <h2>Venta por compañía</h2>
  ${tabla(['Compañía', 'Venta'], ventaPorCompania
    .map((x) => '<tr><td>' + esc(x.k) + '</td><td class="n">' + esc(x.rot) + '</td></tr>').join(''))}

  <h2>Clientes con más vehículos</h2>
  ${tabla(['Cliente', 'Órdenes'], top(dimDe('cliente'), 10)
    .map((x) => '<tr><td>' + esc(x.k) + '</td><td class="n">' + x.v + '</td></tr>').join(''))}

  <h2>${esc(d.med.rot)} por ${esc(d.dimF.rot.toLowerCase())}${
    d.dimC ? ', abierto por ' + esc(d.dimC.rot.toLowerCase()) : ''}</h2>
  <table><thead><tr><th>${esc(d.dimF.rot)}</th>
    ${d.dimC ? d.columnasOrd.map(([c]) => '<th class="n">' +
      esc(d.dimC.id === 'mes' ? repMesCorto(c) : c) + '</th>').join('') : ''}
    <th class="n">${esc(d.med.rot)}</th></tr></thead><tbody>
    ${d.filasOrd.map(([f, tot]) => '<tr><td>' +
      esc(d.dimF.id === 'mes' ? repMesCorto(f) : f) + '</td>' +
      (d.dimC ? d.columnasOrd.map(([c]) => '<td class="n">' + cel(f, c) + '</td>').join('') : '') +
      '<td class="n"><strong>' + d.med.fmt(d.valor(tot)) + '</strong></td></tr>').join('')}
  </tbody></table>
  ${pieImpreso()}`;
}
