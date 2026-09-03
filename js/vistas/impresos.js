/* LOS CUATRO DOCUMENTOS IMPRIMIBLES.

   Comprobante de recepción, presupuesto (la OR), acta de entrega y expediente.

   ⚠️ Ojo con el acento grave dentro de un comentario CSS en un template literal: termina
   el literal y el archivo entero deja de cargar SIN dar error en la consola.

   Detalle y decisiones: 00 Documentacion/DECISIONES.md · js/vistas/impresos.js */

const IMPRESOS = {
  recepcion:  { rot: 'Comprobante de recepción', archivo: (o) => 'recepcion-' + o.patente + '-' + o.numeroOT },
  presupuesto:{ rot: 'Presupuesto / OR',         archivo: (o, p) => 'presupuesto-' + (p ? p.numeroOR : o.numeroOT) },
  ficha:      { rot: 'Ficha completa de la OT',  archivo: (o) => 'ficha-completa-' + o.numeroOT },
  entrega:    { rot: 'Acta de entrega',          archivo: (o) => 'acta-entrega-' + o.patente + '-' + o.numeroOT },
  // El expediente se imprime porque es lo que se le entrega a la compañía
  // cuando pide cuenta de un vehículo. Es el documento, no un reporte.
  expediente: { rot: 'Expediente del vehículo',  archivo: (o) => 'expediente-' + o.patente + '-' + o.numeroOT }
};

/* El estilo del impreso va acá y no en estilos.css a propósito: es una hoja
   de papel, no una pantalla, y conviene que se lea junto al documento. */
const CSS_IMPRESO = `
/* 🔴 SE VEIAN DOS BARRAS Y NINGUNA MOVIA LA HOJA (30-08-2026, Marco: «no me
   deja arrastrar para ver toda la recepcion»).

   La hoja mide 1.386 px y la ventana 900: hay que desplazar. Y la caja SI
   desplazaba, pero al llegar a su fondo el gesto se encadenaba a la pagina de
   atras —la ficha, que es larga— asi que seguia moviendose algo que no era el
   documento. Con las dos barras dibujadas una al lado de la otra, la de la
   derecha era la de la pagina y no hacia nada sobre el papel.

   La regla overscroll-behavior:contain corta el encadenado, y al abrir se bloquea el
   desplazamiento del cuerpo: mientras se mira el documento, lo unico que se
   mueve es el documento. */
.velo-impreso{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9000;overflow:auto;
  padding:20px;overscroll-behavior:contain}
body.mirando-impreso{overflow:hidden}
.impreso{background:#fff;color:#111;width:210mm;min-height:297mm;margin:0 auto;padding:14mm 13mm;
  box-shadow:0 10px 40px rgba(0,0,0,.4);font-family:Arial,Helvetica,sans-serif;font-size:11px;
  position:relative;display:flex;flex-direction:column}
.impreso h1{font-size:17px;margin:0;color:#292D78;letter-spacing:.3px}
.impreso .logo-doc{height:34px;width:auto;display:block;margin-bottom:2px}
.impreso h2{font-size:11px;margin:14px 0 5px;color:#292D78;text-transform:uppercase;letter-spacing:.7px;
  border-bottom:1.5px solid #292D78;padding-bottom:3px}
.impreso .cab-doc{display:flex;justify-content:space-between;align-items:flex-start;
  border-bottom:2.5px solid #292D78;padding-bottom:8px}
.impreso .cab-doc .der{text-align:right;font-size:10px;color:#444}
.impreso .aviso-impreso{border:1px solid #292D78;background:#eef0f7;padding:6px 8px;margin-top:9px;
  font-size:10px;line-height:1.45}
.impreso .aviso-impreso ul{margin:4px 0 0;padding-left:16px}
.impreso .rej{display:grid;grid-template-columns:repeat(4,1fr);gap:3px 10px}
.impreso .rej.dos{grid-template-columns:repeat(2,1fr)}
.impreso .c{border-bottom:1px dotted #bbb;padding:2px 0;display:flex;justify-content:space-between;gap:6px}
.impreso .c .k{color:#666;font-size:9.5px;text-transform:uppercase;letter-spacing:.3px}
.impreso .c .v{font-weight:700;text-align:right}
.impreso table{width:100%;border-collapse:collapse;font-size:10px;margin-top:4px}
.impreso th{background:#eef0f7;color:#292D78;text-align:left;padding:3px 5px;border:1px solid #ccd;
  font-size:9px;text-transform:uppercase;letter-spacing:.3px}
.impreso td{padding:3px 5px;border:1px solid #ddd}
.impreso td.n{text-align:right}
.impreso .inv{display:grid;grid-template-columns:repeat(4,1fr);gap:1px 8px;font-size:9.5px}
.impreso .inv span{border-bottom:1px dotted #ddd;padding:1px 0}
/* Las cuatro marcas del inventario. Son cuatro estados, no un sí/no, así que
   son cuatro signos distintos: el cliente firma este papel y tiene que poder
   distinguir "no estaba" de "estaba roto" y de "no se alcanzó a revisar". */
.impreso .marca{color:#0a8a2a;font-weight:700}
.impreso .falta{color:#b00;font-weight:700}
.impreso .danado{color:#a35a00;font-weight:700}
.impreso .sinver{color:#888;font-weight:700}
.impreso .leyenda-inv{font-size:8.5px;color:#666;margin-top:3px}
/* Los tres espacios de firma del pie. La línea va arriba del rótulo, con 14 mm
   de aire encima: una firma de verdad no cabe en menos, y un recuadro cerrado
   obliga a firmar adentro —que es lo que hace que las firmas se salgan—. */
.impreso .firmas{display:flex;gap:10mm;margin-top:16mm;page-break-inside:avoid}
.impreso .firma-espacio{flex:1;text-align:center}
.impreso .firma-espacio .raya{border-top:1px solid #333;margin-bottom:1.5mm}
.impreso .firma-espacio .rot{
  font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;line-height:1.5}
.impreso .fotos{display:flex;gap:4px;flex-wrap:wrap}
.impreso .fotos img{width:44mm;height:32mm;object-fit:cover;border:1px solid #ccc}
/* Acá vivía la regla del sello «MODELO BORRADOR». Se borró con el rótulo el
   16-08-2026: una clase que nadie usa es una invitación a volver a ponerlo. */
.impreso .nota-legal{margin-top:8px;font-size:9.5px;color:#555;border-top:1px solid #ddd;
  padding-top:5px;line-height:1.45}
/* El pie en el FLUJO de la hoja, empujado abajo con margin-top:auto. Estaba en
   position:absolute con bottom:8mm, y cuando el documento crecía se montaba
   encima del contenido: en el presupuesto quedaba escrito sobre la barra azul
   del TOTAL. Sacado del posicionamiento absoluto, eso no puede volver a pasar. */
.impreso .pie{margin-top:auto;border-top:1px solid #ccd;padding-top:4px;
  font-size:8.5px;color:#777;display:flex;justify-content:space-between;gap:10px}
.impreso .contenido{position:relative;z-index:1;display:flex;flex-direction:column;flex:1}
.barra-impreso{position:sticky;top:0;z-index:9100;display:flex;gap:8px;justify-content:center;
  padding:0 0 14px}
.barra-impreso button{font-family:inherit;font-size:12px;padding:6px 14px;border-radius:3px;cursor:pointer;
  border:1px solid #292D78;background:#292D78;color:#fff;font-weight:600}
.barra-impreso button.sec{background:#fff;color:#292D78}

/* 🔴 EN EL TELEFONO, "CERRAR" SE IBA DE LA PANTALLA Y NO HABIA SALIDA
   (28-08-2026, de la auditoria de celular).

   OJO: en este bloque no se escribe ningun acento grave. Es un template literal
   de JavaScript y uno solo lo termina, dejando el archivo entero sin cargar.
   Me pase esta misma advertencia por alto al escribir este comentario.

   La hoja es A4: 210 mm, o sea 794 px. En un telefono de 390 sobran 444 px y
   hay que deslizar de lado para leerla. La barra estaba pegada SOLO en vertical
   -sticky con top y nada mas-, asi que al deslizar se iba con la hoja: medido,
   quedaba en x = -424, fuera de la pantalla. Y como es la unica salida del
   impreso, el que abria un presupuesto en el telefono se quedaba adentro:
   habia que recargar la pagina entera.

   Pegarla tambien en horizontal, con el ancho atado a la ventana, la deja
   completa a la vista sin importar cuanto se haya deslizado la hoja. Se le pone
   fondo propio porque queda encima del documento blanco.

   La hoja NO se achica a la fuerza: es un A4 y achicarlo lo vuelve ilegible. Se
   desliza, como cualquier PDF en un telefono, y ahora se puede salir. */
@media screen and (max-width: 860px){
  .velo-impreso{padding:10px}
  .barra-impreso{
    position:sticky; top:0; left:0; z-index:9100;
    width:calc(100vw - 20px); box-sizing:border-box;
    justify-content:flex-start; flex-wrap:wrap; gap:6px;
    padding:8px; margin-bottom:8px; border-radius:4px;
    background:rgba(20,24,30,.92);
  }
  .barra-impreso button{min-height:34px; font-size:13px}
}

/* ── El presupuesto, que es el documento que sale del taller ──────────────
   Se lee como planilla: columnas fijas, números tabulares y alineados a la
   derecha, bandas por bloque. Todo lo comparable queda en la misma columna. */
.impreso .cab-presu{display:flex;justify-content:space-between;align-items:flex-start;gap:10mm;
  border-bottom:3px solid #292D78;padding-bottom:6px;margin-bottom:7px}
.impreso .cab-presu .giro{font-size:10px;color:#555;margin-top:1px}
.impreso .cab-presu .dir{font-size:8.5px;color:#888;margin-top:1px}
.impreso .folio{border:1.5px solid #292D78;border-radius:2px;min-width:62mm}
.impreso .folio .tit{background:#292D78;color:#fff;font-size:11px;font-weight:800;letter-spacing:2px;
  text-align:center;padding:3px 8px}
.impreso .folio-t{width:100%;border-collapse:collapse;margin:0;font-size:9.5px}
.impreso .folio-t td{border:none;border-bottom:1px solid #e6e8f2;padding:2.4px 7px}
.impreso .folio-t td:first-child{color:#666;text-transform:uppercase;font-size:8px;letter-spacing:.4px}
.impreso .folio-t td:last-child{text-align:right;font-variant-numeric:tabular-nums}
.impreso .folio-t tr:last-child td{border-bottom:none}

.impreso .fichas{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin:6px 0 9px}
.impreso .ficha-doc{border:1px solid #d6d9e6;border-radius:2px;padding:5px 7px 6px}
.impreso .ficha-tit{font-size:8px;text-transform:uppercase;letter-spacing:.9px;color:#292D78;
  font-weight:800;border-bottom:1px solid #d6d9e6;padding-bottom:2px;margin-bottom:3px}
.impreso .ficha-doc .f{display:flex;justify-content:space-between;gap:5px;font-size:9.5px;
  padding:1.6px 0;border-bottom:1px dotted #e8eaf2}
.impreso .ficha-doc .f:last-child{border-bottom:none}
.impreso .ficha-doc .f span:first-child{color:#777;white-space:nowrap}
.impreso .ficha-doc .f span:last-child{text-align:right;font-weight:600}

/* El pie: observaciones a la izquierda y la cadena de totales a la derecha.
   Es donde se mira primero un presupuesto, asi que va sola en su caja y con la
   ultima linea destacada. */
.impreso .cierre-doc{display:grid;grid-template-columns:1fr 72mm;gap:6mm;
  margin-top:4mm;page-break-inside:avoid;align-items:start}
.impreso table.totales-doc{width:100%;border-collapse:collapse;font-size:10px;margin:0}
.impreso table.totales-doc td{border:none;padding:2.6px 7px}
.impreso table.totales-doc td:first-child{color:#555}
.impreso table.totales-doc td.n{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
.impreso table.totales-doc tr.raya td{border-top:1px solid #ccd;font-weight:700;color:#222}
.impreso table.totales-doc tr.resta td{color:#a35a00}
.impreso table.totales-doc tr.gran-total td{
  background:#292D78;color:#fff;font-weight:800;font-size:11.5px;padding:5px 7px}
.impreso table.totales-doc tr.gran-total td:first-child{
  color:#fff;text-transform:uppercase;letter-spacing:1px;font-size:9.5px}

/* ── EL DETALLE, EN UNA SOLA TABLA (28-08-2026) ──────────────────
   Marco: "no me gusta que sea como asi hacia abajo, la verdad deberia ser
   tabla completa". El 27 quedo partido en tres tablas apiladas y cada una
   traia su propia cabecera y sus propios anchos: al bajar por la hoja las
   columnas no calzaban entre un bloque y el siguiente.

   Una cabecera, un ancho de columna, todas las lineas corridas. Ninguna
   columna queda sistematicamente vacia y la plata cae toda en la misma.
   El <thead> se repite solo si el detalle pasa a la segunda hoja. */
.impreso table.detalle{width:100%;border-collapse:collapse;font-size:10px;margin:0;
  page-break-inside:auto}
.impreso table.detalle th{background:#292D78;color:#fff;border:1px solid #292D78;padding:4px 6px;
  font-size:8px;text-transform:uppercase;letter-spacing:.5px;text-align:left}
.impreso table.detalle th.der{text-align:right}
.impreso table.detalle th.cen{text-align:center}
.impreso table.detalle td{border:1px solid #dcdfe9;padding:4.2px 6px;vertical-align:top}
.impreso table.detalle tr{page-break-inside:avoid}
.impreso table.detalle td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.impreso table.detalle td.c{text-align:center;color:#666}
/* Las actividades de un mismo item se leen como un bloque: la linea que sigue
   no repite el numero ni la descripcion, y su borde superior se atenua para que
   se vea que cuelga de la de arriba y no que es otro item. */
.impreso table.detalle tr.sigue td{border-top-color:#f0f1f5}
.impreso table.detalle .prov{color:#666;font-size:9px}
/* Un item y sus actividades no se parten entre dos hojas. */
.impreso table.detalle tbody tr{page-break-inside:avoid}
.impreso table.detalle td.trabajo{font-size:9px;color:#333}
/* El proveedor, mas chico (27-08-2026, Marco: "en el PDF no puede aparecer
   lo pone sino mejor el detalle del Proveedor pero mas chico"). */
.impreso table.detalle td.prov{font-size:8.5px;color:#777}
.impreso table.detalle td.valor{font-weight:600}
.impreso table.detalle tbody tr:nth-child(even) td{background:#fafbfe}

.impreso .cierre{display:grid;grid-template-columns:1fr 62mm;gap:6mm;margin-top:8px;align-items:start}
.impreso .condiciones ul{margin:3px 0 0;padding-left:12px;font-size:8.6px;color:#555;line-height:1.5}
.impreso .totales{border:1.5px solid #292D78;border-radius:2px;overflow:hidden}
.impreso .totales .lin{display:flex;justify-content:space-between;gap:8px;padding:3px 8px;
  font-size:9.5px;border-bottom:1px solid #e6e8f2;font-variant-numeric:tabular-nums}
.impreso .totales .lin span:first-child{color:#666}
.impreso .totales .lin span:last-child{font-weight:700}
.impreso .totales .lin.total{background:#292D78;color:#fff;border-bottom:none;padding:5px 8px;
  font-size:12px;font-weight:800}
.impreso .totales .lin.total span:first-child{color:#fff;letter-spacing:1px}

/* El presupuesto no lleva firmas: se aprueba por la compañía y queda el
   estado registrado. Quien firma en papel es el comprobante de recepción y el
   acta de entrega, que sí tienen su recuadro. */
@media print{
  /* 🔴 LOS COLORES. El navegador, al imprimir o al "Guardar como PDF", DESCARTA
     los fondos por omisión para ahorrar tinta: la barra azul del TOTAL salía
     blanca, la cabecera de la tabla perdía el fondo y el documento llegaba a la
     compañía en blanco y negro, sin la marca del taller.

     print-color-adjust:exact es la única forma de decirle que los respete, y
     hay que ponerlo en TODO el árbol —no basta en el contenedor—, con el
     prefijo -webkit- porque Edge y Chrome todavía lo piden.

     OJO al editar este bloque: es un template literal de JavaScript, así que
     un acento grave dentro de un comentario CSS lo termina y el archivo entero
     deja de cargar. Acá se escribe sin acentos graves. */
  *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}

  /* 🔴 LOS GRAFICOS DE LA REPORTERIA, EN PAPEL. En pantalla los colores salen
     de las variables del tema, y en tema oscuro la tinta es casi blanca: sobre
     papel blanco los numeros del eje y los valores sobre las barras salian
     INVISIBLES. El grafico se imprimia lindo y mudo.

     Se descubrio recien al rehacer el panel, porque el defecto solo aparece
     imprimiendo desde el tema oscuro — que es el que trae el sistema por
     omision, o sea el caso normal. */
  .velo-impreso svg.graf .graf-valor{fill:#111 !important}
  .velo-impreso svg.graf .graf-eje{fill:#444 !important}
  .velo-impreso svg.graf .graf-eje-y{fill:#666 !important}
  .velo-impreso svg.graf .graf-guia{stroke:#d8d8d8 !important}
  .velo-impreso svg.graf .graf-punto{fill:#fff !important}
  .velo-impreso svg.graf.anillo .anillo-total{fill:#111 !important}
  .velo-impreso svg.graf.anillo .anillo-rot{fill:#666 !important}
  .velo-impreso svg.graf.anillo path{stroke:#fff !important}
  .velo-impreso svg.graf.anillo .anillo-pista{stroke:#eee !important}
  /* El grafico no se puede partir entre dos hojas: la mitad de una serie en la
     pagina 2 no se lee, se adivina. */
  .velo-impreso svg.graf{page-break-inside:avoid;break-inside:avoid}

  /* Las formulas del "como se calcula". Mismos colores del tema en pantalla,
     tinta en papel. La linea punteada entre filas se aclara: en pantalla
     separa, impresa en negro ensucia. */
  .velo-impreso .formulas{border-top-color:#ccc !important;page-break-inside:avoid}
  .velo-impreso .formulas .tit-f{color:#666 !important}
  .velo-impreso .formulas .que{color:#111 !important}
  .velo-impreso .formulas .exp{color:#444 !important}
  .velo-impreso .formulas .num{color:#111 !important}
  .velo-impreso .formulas .f{border-bottom-color:#ddd !important}

  /* El papel es BLANCO. Sin esto, el fondo oscuro de la aplicación se asoma
     bajo la hoja —el documento no llega hasta el borde de la página— y el PDF
     sale con una franja negra abajo. Hay que forzarlo en html y en body: el
     tema oscuro pinta los dos. */
  html,body{background:#fff !important;color:#111 !important}
  body>*{display:none !important}
  body>.velo-impreso{display:block !important;position:static;background:#fff !important;
    padding:0;margin:0;overflow:visible;inset:auto;height:auto}
  .velo-impreso .barra-impreso{display:none !important}
  /* min-height y margin en CERO: la hoja de pantalla mide 297mm de alto y eso,
     sumado al margen de @page, empujaba un par de milímetros fuera de la página
     y el PDF salía con una segunda hoja en blanco. En papel la altura la pone
     el contenido, no nosotros. */
  .impreso{width:auto;min-height:0;height:auto;box-shadow:none;padding:0;margin:0;
    background:#fff !important;display:block}
  .impreso .contenido{display:block}
  /* El pie va donde caiga al final del documento. Estaba en position:fixed, que
     en papel lo clava en la esquina de CADA página y lo monta encima de lo que
     haya ahí — así se metía sobre la barra del TOTAL. */
  .impreso .pie{margin-top:14px}
  /* Que la tabla no se parta dejando una fila huérfana al dar vuelta la hoja. */
  .impreso table{page-break-inside:auto}
  .impreso tr{page-break-inside:avoid}
  .impreso thead{display:table-header-group}
  .impreso tfoot{display:table-footer-group}
  @page{size:A4;margin:14mm 13mm}
}`;

/* La silueta en el papel. Se reusa el MISMO dibujo de la pantalla —no una
   versión aparte, que se despegaría al primer cambio— con los colores forzados
   para tinta: el auto en negro fino y los trazos del daño en su color.

   Los trazos van con `stroke` y sin relleno; los daños viejos, que se marcaban
   con un clic y no tienen trazo, se siguen dibujando como un punto. */
function svgSiluetaImpresa(danos) {
  // En papel el trazo va en rojo fijo: el tema del navegador no llega acá.
  const TINTA = '#c4362f';
  const marcas = (danos || []).map((d) => {
    if (d.trazo && d.trazo.length) {
      return '<path d="' + siluetaTrazoD(d.trazo) + '" fill="none" stroke="' + TINTA +
        '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>';
    }
    // Sin trazo: se dibuja en el centro de su zona, que es el dato que sí tiene.
    const p = siluetaPuntoDeZona(d.vista, d.zona);
    return '<circle cx="' + (p.x * SILUETA_CAJA.w).toFixed(1) + '" cy="' + (p.y * SILUETA_CAJA.h).toFixed(1) +
      '" r="7" fill="' + TINTA + '" fill-opacity=".8" stroke="#111" stroke-width="1.5"></circle>';
  }).join('');

  return '<div style="width:104mm">' +
    svgSilueta().replace('<svg ', '<svg style="width:100%;height:auto" ')
      .replace('<g id="marcas"></g>', '<g>' + marcas + '</g>')
      .replace(/class="auto"/g, 'class="auto" fill="none" stroke="#333" stroke-width="1.4"')
      .replace(/class="vista-rotulo"/g, 'class="vista-rotulo" fill="#889" font-size="11"') +
    '</div>';
}

/* El logo va en los cuatro impresos y se toma solo del archivo del taller.
   Si `img/logo-dyp.png` no está, el bloque cae al nombre en texto: nunca se
   dibuja una imitación del logo. Es el mismo criterio de la barra superior. */
function logoImpreso() {
  return '<img src="img/logo-dyp.png" alt="Automotora D y P" class="logo-doc" ' +
    'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\'">' +
    '<h1 style="display:none">Automotora D y P</h1>';
}

function cabeceraImpreso(o, titulo, extra) {
  return `
  <div class="cab-doc">
    <div>
      ${logoImpreso()}
      <div style="font-size:10px;color:#555">Desabolladura y pintura</div>
      <div style="margin-top:5px;font-size:13px;font-weight:700">${esc(titulo)}</div>
    </div>
    <div class="der">
      ${/* En el comprobante que se imprime antes de guardar no hay número de OT
           todavía, y va rotulado en vez de inventado. */''}
      <div><strong>OT N° ${esc(String(o.numeroOT))}</strong></div>
      <div>Patente <strong>${esc(o.patente || 'sin patente')}</strong></div>
      ${extra || ''}
      <div>Emitido ${fFechaHora(HOY)}</div>
    </div>
  </div>`;
}

function pieImpreso() {
  return '<div class="pie"><span>Automotora D y P · documento generado por el sistema de control de taller</span>' +
    '<span>Arttmize SpA</span></div>';
}

const campoImpreso = (k, v) => '<div class="c"><span class="k">' + esc(k) + '</span><span class="v">' + v + '</span></div>';

/* Las piezas rayadas, sin repetir. El croquis impreso en blanco y negro no
   siempre deja claro cuál es cuál, así que van también en palabras. */
function impresoPiezas(danos) {
  const vistas = [];
  (danos || []).forEach((d) => {
    const n = d.zonaNombre || 'Sin zona';
    if (vistas.indexOf(n) < 0) vistas.push(n);
  });
  return vistas.join(' · ');
}

/* ── 1 · Comprobante de recepción ──────────────────────────────────────── */

/* `o` puede ser una OT de verdad o el BORRADOR del formulario de recepción, que
   todavía no creó nada: en ese caso trae `fotosIngreso` con las fotos del
   borrador y `numeroOT` rotulado, no un número inventado. El documento es el
   mismo, y eso es lo importante — lo que el cliente firma en el mesón tiene que
   ser lo que queda guardado. */
function impresoRecepcion(o) {
  const inv = o.inventario;
  const fotos = o.fotosIngreso || Modelo.mediaDe(o.id).filter((m) => m.momento === 'ingreso');
  const MARCA_INV = {
    presente:     '<span class="marca">✔</span>',
    no_presente:  '<span class="falta">✘</span>',
    danado:       '<span class="danado">△</span>',
    sin_verificar:'<span class="sinver">–</span>'
  };
  const cuenta = (cod) => inv.filter((i) => (i.estado || (i.presente ? 'presente' : 'no_presente')) === cod).length;
  /* 🔶 QUÉ VERSIÓN ES ESTE COMPROBANTE (15-08-2026).
     Desde que la recepción se puede corregir, el papel tiene que decir cuál
     es. Si no, quedan dos comprobantes de la misma recepción con datos
     distintos y ninguno de los dos dice cuál manda. El original firmado sigue
     siendo el original: acá se declara qué se corrigió después, con su fecha,
     su autor y su motivo. Sin correcciones no aparece nada. */
  const correcciones = (o.recepcion && o.recepcion.id && Modelo.correccionesDeRecepcion)
    ? Modelo.correccionesDeRecepcion(o.recepcion.id) : [];
  const version = correcciones.length ? correcciones[0].version : 1;

  return cabeceraImpreso(o, 'Comprobante de recepción' + (version > 1 ? ' · versión ' + version : '')) +
  (correcciones.length ? `
  <div class="aviso-impreso">
    <strong>Este comprobante es la versión ${version}.</strong> El documento que firmó el cliente es
    la versión 1 y no se modificó. Lo corregido después:
    <ul>${correcciones.slice().reverse().map((c) => '<li>v' + c.version + ' · ' + esc(fFechaHora(c.fecha)) +
      ' · ' + esc(c.quien) + ' — ' + c.cambios.map((x) => esc(x.campo) + ': «' +
      esc(x.antes || '—') + '» → «' + esc(x.despues || '—') + '»').join('; ') +
      ' (' + esc(c.motivo) + ')</li>').join('')}</ul>
  </div>` : '') + `
  <h2>Datos del cliente y del vehículo</h2>
  <div class="rej">
    ${campoImpreso('Cliente', esc(o.cliente))}
    ${campoImpreso('RUT', esc(o.rut || '—'))}
    ${campoImpreso('Teléfono', esc(o.telefono || '—'))}
    ${campoImpreso('Dirección', esc(o.direccion || '—'))}
    ${campoImpreso('Patente', esc(o.patente))}
    ${campoImpreso('Marca', esc(o.marca || '—'))}
    ${campoImpreso('Modelo', esc(o.modelo || '—'))}
    ${campoImpreso('Año', o.anio || '—')}
    ${campoImpreso('Color', esc(o.color || '—'))}
    ${campoImpreso('VIN', esc(o.vin || '—'))}
    ${campoImpreso('Kilometraje', fKm(o.recepcion && o.recepcion.km))}
    ${campoImpreso('Combustible', fComb(o.recepcion && o.recepcion.combustible))}
    ${campoImpreso('Tipo de ingreso', esc(o.origenIngresoNombre || '—'))}
    ${campoImpreso('Compañía', esc(o.compania))}
    ${campoImpreso('N° siniestro', esc(o.siniestro || '—'))}
    ${campoImpreso('Fecha de Ingreso', fFechaHora(o.fechaIngreso))}
  </div>

  ${/* El croquis rayado y, debajo, lo que se escribió. Ya no hay tabla de daños
       con tipo y severidad: desde el 15-08-2026 se raya y se cuenta en una sola
       observación, así que el papel muestra exactamente eso. Las piezas van
       listadas porque el croquis impreso en blanco y negro no siempre deja
       claro cuál es cuál. */''}
  <h2>Estado descriptivo</h2>
  ${svgSiluetaImpresa(o.danos)}
  <div style="margin-top:5px">
    <strong>Piezas marcadas:</strong>
    ${o.danos.length ? esc(impresoPiezas(o.danos))
      : (o.ventaGuardada
          /* `ventaGuardada` sólo la tienen las órdenes que vinieron de la
             migración: el total se calculó al traerlas. Sirve de marca de
             origen sin agregar un campo nuevo ni volver a subir 15.534
             documentos — y sin un número mágico que alguien tenga que
             acordarse de mover. */
          ? 'el sistema anterior no marcaba los daños sobre la silueta'
          : 'ninguna')}
  </div>

  <h2>Inventario del vehículo${inv.length ? ' · ' + inv.length + ' ítems' : ''}</h2>
  ${!inv.length ? `
  <!-- 🔴 UN CERO EN ESTE PAPEL NO ES UN CERO (30-08-2026).

       Éste es el comprobante que el cliente FIRMA. Con la data migrada, las
       órdenes que vienen del sistema viejo no traen checklist —lo dejaron de
       usar en 2019— y la leyenda salía «✔ presente 0 · ✘ no presente 0 ·
       △ dañado 0 · – sin verificar 0».

       Eso no se lee como «no hay dato»: se lee como SE REVISÓ Y NO HABÍA NADA.
       Y va firmado. Si después el cliente reclama que le faltó la rueda de
       repuesto, ese papel dice que se revisó y que no estaba.

       Cuando no hay checklist se dice que no lo hay, con todas sus letras. */ -->
  <div class="leyenda-inv" style="font-style:italic">
    Esta orden viene del sistema anterior, que no registraba el inventario del
    vehículo. No es que se haya revisado y no hubiera nada: no se registró.
  </div>` : `
  <div class="inv">
    ${inv.map((i) => {
      const cod = i.estado || (i.presente ? 'presente' : 'no_presente');
      return '<span>' + (MARCA_INV[cod] || MARCA_INV.sin_verificar) + ' ' + esc(i.item) +
        (String(i.observacion || '').trim() ? ' <em>(' + esc(i.observacion) + ')</em>' : '') + '</span>';
    }).join('')}
  </div>
  <div class="leyenda-inv">
    <span class="marca">✔</span> presente ${cuenta('presente')} ·
    <span class="falta">✘</span> no presente ${cuenta('no_presente')} ·
    <span class="danado">△</span> dañado ${cuenta('danado')} ·
    <span class="sinver">–</span> sin verificar ${cuenta('sin_verificar')}
  </div>`}

  ${o.recepcion && o.recepcion.observaciones ?
    '<h2>Observaciones</h2><div>' + esc(o.recepcion.observaciones) + '</div>' : ''}

  ${fotos.length ? '<h2>Fotografías de ingreso</h2><div class="fotos">' +
    fotos.slice(0, 6).map((f) => '<img data-media="' + esc(f.id) + '" alt="">').join('') + '</div>' : ''}

  ${/* 🔴 TRES ESPACIOS PARA FIRMAR A MANO (27-08-2026, Marco, con la foto de
       su papel al lado: «quiero que quede un espacio abajo nomás para la firma
       del que está en recepción y firma del cliente, pero que no se haga
       digital, ya que cuando estuvimos allá básicamente imprimían el documento
       y se firmaba físico»).

       Acá se estampaba la firma que el cliente hacía en la tablet. Se fue con el
       lienzo; ver el comentario en `recepcion-pasos.js`.

       Los tres rótulos y su orden son los del papel de ellos, tal cual:
       RECEPCIONADO / NOMBRE INGRESA · NOMBRE Y FIRMA / CLIENTE · NOMBRE Y FIRMA
       / ENTREGA. La tercera es la que se llena el día de la entrega, con el
       mismo papel: por eso va en el comprobante de ingreso y no en otro.

       ⚠️ La línea va ARRIBA del rótulo y con aire suficiente para una firma de
       verdad —14 mm—. Un recuadro cerrado obliga a firmar adentro y las firmas
       se salen; una línea no reclama. */''}
  <div class="firmas">
    ${[['Recepcionado', 'Nombre ingresa'],
       ['Nombre y firma', 'Cliente'],
       ['Nombre y firma', 'Entrega']]
      .map(([a, b]) => '<div class="firma-espacio"><div class="raya"></div>' +
        '<div class="rot">' + esc(a) + '</div><div class="rot">' + esc(b) + '</div></div>').join('')}
  </div>

  <div style="font-size:8.5px;color:#666;margin-top:6px">
    El cliente declara haber revisado el inventario y el estado descriptivo del vehículo.
    Los datos personales se tratan conforme a la Ley 21.719.
  </div>` + pieImpreso();
}

/* ── 2 · Presupuesto (la OR) ───────────────────────────────
   El documento que sale del taller. Rehecho el 16-08-2026 sobre la OR real
   que trajo Marco —la 23505-18401-001—, y otra vez el 27 y el 28-08-2026,
   que es cuando quedó como está.

   La lógica del original, que se respeta al pie:

   · Mano de obra valorizada en `horas × tempario`; repuestos con su
     proveedor; trabajos externos (T.O.T.) aparte.
   · El cierre: mano de obra + repuestos + T.O.T. = subtotal, menos el
     descuento y el deducible = neto, más IVA = total.

   Las vueltas que dio, y por qué:

   🔶 27-08 · SE SACÓ EL TEMPARIO (Marco: «sácame el tempario, eso no debe
      quedar visible en el PDF»). Es el costo de la hora del taller y no tiene
      por qué viajar a la compañía; sigue en la pantalla, que es donde se
      trabaja. Las HORAS sí se muestran: son lo que se está cobrando, y un
      número que se explica solo es más difícil de regatear.
   🔶 27-08 · UNA SOLA COLUMNA DE PLATA (Marco: «parece casi un excel feo y
      desordenado»). Antes cada fila cruzaba NUEVE columnas numéricas
      —desmontar, reparar, pintar, repuestos, externos, neto, IVA, total— y
      ocho iban vacías. El IVA es del documento, no del tornillo: va abajo.
   🔶 28-08 · UNA SOLA TABLA (Marco: «no me gusta que sea como así hacia
      abajo, la verdad debería ser tabla completa»). El 27 lo partí en tres
      tablas apiladas —mano de obra, repuestos, externos—, cada una con su
      cabecera y sus anchos, y las columnas no calzaban entre un bloque y el
      siguiente. Ahora es UNA tabla corrida: lo que cada línea es lo dice su
      columna Trabajo, y los tres subtotales viven en el recuadro del pie, que
      es donde se miran.
   🔶 28-08 · LA PIEZA QUE PONE LA COMPAÑÍA VALE $0 (Marco: «donde sale Valor
      no se cobra debe decir $0»). Decía «no se cobra» en letra chica: es lo
      mismo dicho en palabras, y en un presupuesto las palabras no suman. La
      columna Valor tiene que poder recorrerse de arriba abajo sumando.
      Quién la pone lo sigue diciendo la columna Proveedor.
      ⚠️ Lo que se pierde: el precio de referencia de esa pieza ya no viaja en
      el papel. Queda en la pantalla, en la línea del presupuesto. */

function impresoPresupuesto(o, p) {
  const db = Modelo.base();
  const ivaPct = Reglas.parametro(db, 'iva', 19);
  const estado = ESTADO_PRESUPUESTO[p.estado] ? ESTADO_PRESUPUESTO[p.estado].txt : p.estado;
  const t = p.totales || Reglas.totalesPresupuesto(p.lineas, p.tempario, o.deducible, ivaPct, p.descuento);
  const lineas = p.lineas || [];
  const hs = (n) => (Number(n) || 0).toFixed(2).replace('.', ',');

  const OPS = { cambio: 'Cambio', reparar: 'Reparar', externo: 'Externo' };

  /* Qué se le hace a la pieza. En mano de obra sale de las HORAS —que es lo
     que se está cobrando— y no del rótulo del proceso: una puerta que se
     repara casi siempre además se pinta, y son dos tiempos distintos que el
     documento tiene que decir. Es la información que antes daban las tres
     columnas de plata separadas, dicha en la columna que nunca va vacía. */
  const trabajoDe = (l) => {
    if (Reglas.esRepuesto(l)) return 'Repuesto';
    if (Reglas.esExterno(l)) return 'Externo';
    const partes = [];
    if (Number(l.horas_dm) > 0) partes.push('Desmontar y montar');
    if (Number(l.horas_rep) > 0) partes.push('Reparar');
    if (Number(l.horas_pint) > 0) partes.push('Pintar');
    return partes.length ? partes.join(' + ') : (OPS[l.proceso] || l.proceso || '—');
  };

  /* El orden del documento: primero el trabajo del taller, después las piezas
     que hay que comprar, al final lo que se manda afuera. Es el mismo orden
     del original y el mismo del recuadro de totales. */
  const grupo = (l) => Reglas.esManoObra(l) ? 0 : (Reglas.esRepuesto(l) ? 1 : 2);

  /* 🔴 EL DETALLE, AGRUPADO POR LO QUE SE LE HACE AL AUTO (30-08-2026, Marco,
     con un Excel de ejemplo).

     Antes cada linea del presupuesto era una fila numerada suelta, y la mano de
     obra de «Cambio parachoque» quedaba en la fila 1 mientras su repuesto —el
     parachoque— caia en la 5, despues de todas las demas. Quien lee el
     documento no puede sumar lo que cuesta cambiar un parachoque sin ir
     saltando por la hoja.

     Ahora manda el ITEM: «Cambio parachoque» es el numero 1, y debajo van sus
     actividades con sus valores separados —la mano de obra por un lado, el
     repuesto por otro—. Es como lo pidio y es como se lee un presupuesto de
     taller: por trabajo, no por tipo de gasto.

     El agrupador es la DESCRIPCION, que es lo que ya usan para relacionarlas:
     en su prueba «Cambio parachoque» aparecia identico en la linea de obra y en
     la de repuesto. Lo que no calza con nada queda solo en su propio numero,
     que tampoco esta mal.

     Y el proveedor se fue a la columna de actividad —«Repuesto · Sura»— porque
     el formato pedido tiene siete columnas y una octava en A4 aprieta el
     documento. No se pierde: decide si la pieza se cobra o va en cero. */
  const linea = (l) => {
    const horas = (Number(l.horas_dm) || 0) + (Number(l.horas_rep) || 0) + (Number(l.horas_pint) || 0);
    if (Reglas.esManoObra(l))
      return { valor: Math.round(horas * p.tempario), cant: horas ? hs(horas) + ' h' : '—' };
    if (Reglas.esRepuesto(l))
      return { valor: Reglas.cobroRepuesto(l), cant: String(l.cantidad || 1) };
    return { valor: Number(l.precio_unitario) || 0, cant: String(l.cantidad || 1) };
  };

  const clave = (l) => String(l.descripcion || '').trim().toLowerCase();
  const orden = new Map();          // conserva el orden de aparicion
  lineas.slice()
    .sort((a, b) => grupo(a) - grupo(b) || (Number(a.orden) || 0) - (Number(b.orden) || 0))
    .forEach((l) => {
      const v = linea(l);
      /* Una linea en cero no se imprime: alarga el documento y no dice nada. La
         pieza que pone la compañia SI va —es parte del trabajo— con $0, que es
         exactamente lo que el taller cobra por ella. */
      if (!v.valor && !Reglas.esRepuesto(l)) return;
      /* 🔴 Y LA FILA DE ARRANQUE TAMPOCO (30-08-2026).

         Desde que el presupuesto nace con una fila lista en Repuestos y otra en
         Trabajos externos, la que nadie llenó llegaba al documento como
         «4 · — · Repuesto · 1 · $0». Un item numerado que no dice nada, en el
         papel que se le manda al cliente.

         Vacia de verdad: sin descripcion, sin codigo, sin proveedor y sin
         precio. Con cualquiera de las cuatro cosas escritas es una linea que
         alguien puso a proposito y se respeta. */
      const vacia = !String(l.descripcion || '').trim() && !String(l.codigo || '').trim() &&
        !String(l.proveedor || '').trim() && !Number(l.precio_unitario);
      if (vacia) return;
      const k = clave(l) || ('__' + (orden.size + 1));
      if (!orden.has(k)) orden.set(k, { desc: l.descripcion || '—', actos: [] });
      orden.get(k).actos.push({ l, v });
    });

  let n = 0;
  const filas = [...orden.values()].map((g) => {
    n++;
    return g.actos.map((a, i) => {
      const iva = Math.round(a.v.valor * (Number(ivaPct) || 0) / 100);
      const prov = String(a.l.proveedor || '').trim();
      return '<tr' + (i ? ' class="sigue"' : '') + '>' +
        '<td class="c">' + (i ? '' : n) + '</td>' +
        '<td>' + (i ? '' : esc(g.desc)) + '</td>' +
        '<td class="trabajo">' + esc(trabajoDe(a.l)) +
          (prov ? ' <span class="prov">· ' + esc(prov) + '</span>' : '') + '</td>' +
        '<td class="n">' + esc(a.v.cant) + '</td>' +
        '<td class="n valor">' + fMonto(a.v.valor) + '</td>' +
        '<td class="n">' + fMonto(iva) + '</td>' +
        '<td class="n valor">' + fMonto(a.v.valor + iva) + '</td></tr>';
    }).join('');
  }).join('');

  const tabla = !filas ? '' : `
    <table class="detalle">
      <thead><tr>
        <th class="cen" style="width:8mm">N°</th>
        <th>Descripción</th>
        <th style="width:38mm">Actividad</th>
        <th class="der" style="width:15mm">Cant.</th>
        <th class="der" style="width:23mm">Valor neto</th>
        <th class="der" style="width:19mm">IVA</th>
        <th class="der" style="width:24mm">Valor total</th>
      </tr></thead>
      <tbody>${filas}</tbody>
    </table>`;

  /* Los totales, al pie y a la derecha. Los tres subtotales por bloque van
     acá —ya no dentro de la tabla—, y cada línea de descuento se muestra SÓLO
     si existe: un «Descuento $0» en un presupuesto sin descuento es una
     pregunta que nadie hizo. Lo que siempre va es subtotal, neto, IVA y
     total. */
  const fila = (rot, val, cls) => '<tr' + (cls ? ' class="' + cls + '"' : '') +
    '><td>' + esc(rot) + '</td><td class="n">' + val + '</td></tr>';

  const totales = `
    <table class="totales-doc">
      ${fila('Mano de obra', fMonto(t.manoObra))}
      ${t.repuestos ? fila('Repuestos', fMonto(t.repuestos)) : ''}
      ${t.tot ? fila('Trabajos externos', fMonto(t.tot)) : ''}
      ${fila('Subtotal', fMonto(t.subtotalNeto), 'raya')}
      ${t.descuento ? fila('Descuento', '− ' + fMonto(t.descuento), 'resta') : ''}
      ${t.deducible ? fila('Deducible de la póliza', '− ' + fMonto(t.deducible), 'resta') : ''}
      ${fila('Neto', fMonto(t.neto), 'raya')}
      ${fila('IVA ' + ivaPct + '%', fMonto(t.iva))}
      ${fila('Total', fMonto(t.total), 'gran-total')}
    </table>`;

  return `
  <div class="cab-presu">
    <div class="marca">
      ${logoImpreso()}
      <div class="giro">Desabolladura y pintura</div>
      <div class="dir">Taller de reparación automotriz · Chile</div>
    </div>
    <div class="folio">
      <div class="tit">PRESUPUESTO</div>
      <table class="folio-t">
        <tr><td>N° OR</td><td><strong>${esc(p.numeroOR)}</strong></td></tr>
        <tr><td>Versión</td><td>${p.version}</td></tr>
        <tr><td>Orden de trabajo</td><td>${o.numeroOT}</td></tr>
        <tr><td>Fecha</td><td>${fFechaHora(HOY)}</td></tr>
        <tr><td>Estado</td><td><strong>${esc(estado)}</strong></td></tr>
      </table>
    </div>
  </div>

  <div class="fichas">
    <div class="ficha-doc">
      <div class="ficha-tit">Cliente</div>
      <div class="f"><span>Nombre</span><span>${esc(o.cliente)}</span></div>
      <div class="f"><span>RUT</span><span>${esc(o.rut || '—')}</span></div>
      <div class="f"><span>Teléfono</span><span>${esc(o.telefono || '—')}</span></div>
      <div class="f"><span>Domicilio</span><span>${esc(o.direccion || '—')}</span></div>
    </div>
    <div class="ficha-doc">
      <div class="ficha-tit">Vehículo</div>
      <div class="f"><span>Patente</span><span><strong>${esc(o.patente)}</strong></span></div>
      <div class="f"><span>Marca y modelo</span><span>${esc([o.marca, o.modelo].filter(Boolean).join(' ') || '—')}</span></div>
      <div class="f"><span>Año</span><span>${o.anio || '—'}</span></div>
      <div class="f"><span>VIN</span><span>${esc(o.vin || '—')}</span></div>
    </div>
    <div class="ficha-doc">
      <div class="ficha-tit">Siniestro</div>
      <div class="f"><span>Compañía</span><span>${esc(o.compania)}</span></div>
      <div class="f"><span>N° siniestro</span><span>${esc(o.siniestro || '—')}</span></div>
      <div class="f"><span>Deducible</span><span>${fMonto(o.deducible)}</span></div>
      <div class="f"><span>Liquidador</span><span>${esc(o.liquidador || '—')}</span></div>
    </div>
  </div>

  ${tabla}

  ${!filas ? '<div style="text-align:center;padding:8mm;color:#888">' +
    'Este presupuesto todavía no tiene líneas cargadas.</div>' : ''}

  <div class="cierre-doc">
    <div class="condiciones">
      <div class="ficha-tit">Observaciones</div>
      ${p.observacion
        ? '<div style="white-space:pre-wrap">' + esc(p.observacion) + '</div>'
        : '<div style="color:#888">Sin observaciones.</div>'}
    </div>
    ${filas ? totales : ''}
  </div>

` + pieImpreso();
}

/* ── 3 · Ficha completa ────────────────────────────────────────────────── */

function impresoFicha(o) {
  const eventos = Modelo.historialDe(o.id);
  const fotos = Modelo.mediaDe(o.id);

  return cabeceraImpreso(o, 'Ficha completa de la orden') + `
  <h2>Resumen</h2>
  <div class="rej">
    ${campoImpreso('Cliente', esc(o.cliente))}
    ${campoImpreso('Patente', esc(o.patente))}
    ${campoImpreso('Vehículo', esc([o.marca, o.modelo].filter(Boolean).join(' ') || '—'))}
    ${campoImpreso('Compañía', esc(o.compania))}
    ${campoImpreso('Estado', esc(o.estadoNombre))}
    ${campoImpreso('Etapa actual', esc(o.etapaNombre))}
    ${campoImpreso('Fecha de Ingreso', fFechaHora(o.fechaIngreso))}
    ${campoImpreso('Fecha de Salida', o.fechaSalida ? fFechaHora(o.fechaSalida) : 'sin registrar')}
  </div>

  <h2>Los tres relojes</h2>
  <div class="rej">
    ${campoImpreso('Días desde el ingreso', o.diasTotales)}
    ${campoImpreso('Reparación acumulada', o.diasReparacion)}
    ${campoImpreso('Estadía actual', o.diasEstadiaActual)}
    ${campoImpreso('Fuera del taller', o.diasFuera)}
  </div>
  <div style="font-size:8.5px;color:#666">El reloj de reparación se detiene cuando el vehículo sale
  y se reanuda al reingresar. Ningún contador se reinicia al regrabar un estado.</div>

  <h2>Etapas</h2>
  <table><thead><tr><th>Etapa</th><th>Situación</th><th>Responsable</th><th style="width:24mm">Cerrada</th></tr></thead>
  <tbody>${o.etapasAsignadas.length ? o.etapasAsignadas.map((e) =>
    '<tr><td>' + esc(e.nombre) + '</td><td>' + (e.finalizada ? 'Completado' : 'Pendiente') + '</td>' +
    '<td>' + esc(e.responsable || '—') + '</td><td class="n">' +
    (e.finalizadaAt ? fFechaHora(e.finalizadaAt) : '—') + '</td></tr>').join('')
    : '<tr><td colspan="4">Sin etapas asignadas</td></tr>'}</tbody></table>

  <h2>Repuestos</h2>
  <table><thead><tr><th>Descripción</th><th style="width:12mm">Cant.</th><th style="width:22mm">Paga</th>
    <th style="width:22mm">Solicitado</th><th style="width:22mm">A bodega</th><th style="width:22mm">Al área</th></tr></thead>
  <tbody>${o.repuestos.length ? o.repuestos.map((r) =>
    '<tr><td>' + esc(r.descripcion) + '</td><td class="n">' + r.cantidad + '</td>' +
    '<td>' + esc(r.responsablePago || '—') + '</td>' +
    '<td class="n">' + (r.fechaSolicitud ? fFechaHora(r.fechaSolicitud) : '—') + '</td>' +
    '<td class="n">' + (r.fechaBodega ? fFechaHora(r.fechaBodega) : 'pendiente') + '</td>' +
    '<td class="n">' + (r.fechaEntregaArea ? fFechaHora(r.fechaEntregaArea) : '—') + '</td></tr>').join('')
    : '<tr><td colspan="6">Sin repuestos</td></tr>'}</tbody></table>

  <h2>Historial</h2>
  <table><thead><tr><th style="width:32mm">Fecha</th><th>Detalle</th><th style="width:26mm">Tipo</th>
    <th style="width:34mm">Responsable</th></tr></thead>
  <tbody>${eventos.slice(0, 24).map((e) => {
    const t = TIPO_EVENTO[e.tipo] || { txt: e.tipo };
    return '<tr><td>' + fFechaHora(e.fecha) + '</td><td>' +
      esc(e.tipo === 'etapa' ? e.etapa : e.detalle) + '</td><td>' + esc(t.txt) + '</td>' +
      '<td>' + esc(e.usuario) + '</td></tr>';
  }).join('')}</tbody></table>

  ${fotos.length ? '<h2>Fotografías</h2><div class="fotos">' +
    fotos.slice(0, 6).map((f) => '<img data-media="' + esc(f.id) + '" alt="">').join('') + '</div>' : ''}
  ` + pieImpreso();
}

/* ── 4 · Acta de entrega ───────────────────────────────────────────────── */

/* El expediente impreso. Es el documento que el taller le manda a la compañía
   cuando le piden cuenta de un vehículo, así que no se resume: van todos los
   hechos, con su fecha y con quién los hizo. Un expediente recortado no sirve
   para lo que se usa. */
function impresoExpediente(o) {
  const ex = Modelo.expedienteDe(o.numeroOT);
  if (!ex) return cabeceraImpreso(o, 'Expediente del vehículo') +
    '<h2>Sin datos</h2><p>No se pudo armar el expediente de esta orden.</p>';

  const r = ex.resumen;

  const porDia = hechosPorDia(ex.hechos);

  return cabeceraImpreso(o, 'Expediente del vehículo') + `
  <h2>Identificación</h2>
  <div class="rej">
    ${campoImpreso('Patente', esc(o.patente))}
    ${campoImpreso('Orden de trabajo', esc(o.numeroOT))}
    ${campoImpreso('Vehículo', esc([o.marca, o.modelo, o.color].filter(Boolean).join(' ') || '—'))}
    ${campoImpreso('VIN', esc(o.vin || '—'))}
    ${campoImpreso('Cliente', esc(o.cliente))}
    ${campoImpreso('RUT', esc(o.rut || '—'))}
    ${campoImpreso('Compañía', esc(o.compania && o.compania !== '—' ? o.compania : 'Particular'))}
    ${campoImpreso('N° de siniestro', esc(o.siniestro || '—'))}
    ${campoImpreso('Fecha de Ingreso', fFechaHora(o.fechaIngreso))}
    ${campoImpreso('Estado', esc(o.estadoNombre))}
  </div>

  <h2>Resumen del expediente</h2>
  <div class="rej">
    ${campoImpreso('Hechos registrados', r.hechos)}
    ${campoImpreso('Período', fFechaHora(r.desde) + ' al ' + fFechaHora(r.hasta))}
    ${campoImpreso('Etapas cerradas', r.etapasCerradas + ' de ' + r.etapas)}
    ${campoImpreso('Presupuestos', r.presupuestos)}
    ${campoImpreso('Repuestos', r.repuestos)}
    ${campoImpreso('Archivos adjuntos', r.archivos)}
  </div>

  <h2>Historia del vehículo</h2>
  <table>
    <thead><tr>
      <th style="width:20mm">Fecha</th>
      <th style="width:38mm">Hecho</th>
      <th>Detalle</th>
      <th style="width:30mm">Quién</th>
    </tr></thead>
    <tbody>${porDia.map((d) => d.hechos.map((h, i) =>
      '<tr><td class="n">' + (i === 0 ? fCorta(h.fecha) : '') + '</td>' +
      '<td>' + esc(h.titulo) + '</td>' +
      '<td>' + esc(h.detalle || '—') + '</td>' +
      '<td>' + esc(h.quien || 'sin autor registrado') + '</td></tr>').join('')).join('') ||
      '<tr><td colspan="4">Sin hechos registrados</td></tr>'}</tbody>
  </table>

  <p class="nota-legal">Este expediente se genera desde el registro de hechos del sistema. Los
  hechos se agregan y no se editan ni se eliminan: cada línea conserva la fecha en que ocurrió y
  quién la ejecutó.</p>`;
}

function impresoEntrega(o) {
  const fotos = Modelo.mediaDe(o.id).filter((m) => m.momento === 'entrega' || m.momento === 'ingreso');

  return cabeceraImpreso(o, 'Acta de entrega') + `
  <h2>Entrega del vehículo</h2>
  <div class="rej">
    ${campoImpreso('Cliente', esc(o.cliente))}
    ${campoImpreso('RUT', esc(o.rut || '—'))}
    ${campoImpreso('Patente', esc(o.patente))}
    ${campoImpreso('Vehículo', esc([o.marca, o.modelo].filter(Boolean).join(' ') || '—'))}
    ${campoImpreso('Tipo de entrega', esc(o.estadoNombre))}
    ${campoImpreso('Fecha de Entrega', o.fechaEntrega ? fFechaHora(o.fechaEntrega) : '—')}
    ${campoImpreso('Fecha de Ingreso', fFechaHora(o.fechaIngreso))}
    ${campoImpreso('Días en el taller', o.diasReparacion)}
  </div>

  <h2>Trabajo realizado</h2>
  <table><thead><tr><th>Etapa</th><th style="width:34mm">Responsable</th><th style="width:26mm">Cerrada</th></tr></thead>
  <tbody>${o.etapasAsignadas.filter((e) => e.finalizada).map((e) =>
    '<tr><td>' + esc(e.nombre) + '</td><td>' + esc(e.responsable || '—') + '</td>' +
    '<td class="n">' + fFechaHora(e.finalizadaAt) + '</td></tr>').join('') ||
    '<tr><td colspan="3">Sin etapas cerradas</td></tr>'}</tbody></table>

  ${fotos.length ? '<h2>Fotografías</h2><div class="fotos">' +
    fotos.slice(0, 4).map((f) => '<img data-media="' + esc(f.id) + '" alt="">').join('') + '</div>' : ''}

  <h2>Conformidad</h2>
  <div class="rej dos" style="align-items:end">
    <div class="firma"></div>
    <div>
      ${campoImpreso('Recibe', esc(o.cliente))}
      ${campoImpreso('RUT', esc(o.rut || '—'))}
      ${campoImpreso('Fecha', o.fechaEntrega ? fFechaHora(o.fechaEntrega) : fFechaHora(HOY))}
    </div>
  </div>
  <div style="font-size:8.5px;color:#666;margin-top:6px">
    El cliente declara recibir el vehículo conforme al trabajo detallado en esta acta.
  </div>` + pieImpreso();
}

/* ── Abrir un impreso ──────────────────────────────────────────────────── */

/* Qué permiso pide cada documento. Los cuatro llevan el nombre y el RUT del
   cliente impresos en la cabecera, así que abrirlos es ver la ficha completa
   aunque se llegue por otro camino. El presupuesto pide además el permiso de
   los MONTOS: es el documento comercial, con los valores línea por línea. */
const PERMISO_IMPRESO = {
  recepcion:   'ficha.completa',
  presupuesto: 'presupuesto.montos',
  ficha:       'ficha.completa',
  entrega:     'ficha.completa',
  expediente:  'ficha.completa'
};

function abrirImpreso(tipo, ot_id, presupuesto_id) {
  // Acepta el id de la orden o su número: el expediente trabaja con el número
  // —es lo que el usuario escribe— y el resto de las pantallas con el id.
  const o = Modelo.otPorId(ot_id) || Modelo.otPorNumero(ot_id);
  if (!o) return avisar({ ok: false, motivo: 'Esa orden no existe o no está asignada a ti.' });
  const pide = PERMISO_IMPRESO[tipo];
  if (pide && !Modelo.puede(pide)) {
    return avisar({ ok: false, motivo: 'El rol ' + (Modelo.rolActual().nombre || '—') +
      ' no puede abrir este documento: lleva los datos del cliente' +
      (tipo === 'presupuesto' ? ' y los valores del presupuesto' : '') +
      '. Se administra en Configuración → Roles y permisos.' });
  }
  const meta = IMPRESOS[tipo];
  const pr = presupuesto_id ? o.presupuestos.find((x) => x.id === presupuesto_id)
                            : o.presupuestos[o.presupuestos.length - 1];

  const cuerpo = { recepcion: () => impresoRecepcion(o), presupuesto: () => impresoPresupuesto(o, pr),
                   ficha: () => impresoFicha(o), entrega: () => impresoEntrega(o),
                   expediente: () => impresoExpediente(o) }[tipo]();

  mostrarImpreso(cuerpo, meta.archivo(o, pr));
}

/* Poner un documento en pantalla. Está separado de `abrirImpreso` porque hay un
   caso que no viene de una OT: el comprobante que la recepción imprime ANTES de
   guardar, desde el paso Verificar. Ahí no hay orden todavía —y no la puede
   haber: el papel se revisa con el cliente delante y recién después se ingresa—
   así que el cuerpo lo arma quien llama y esta función solo lo muestra. */
function mostrarImpreso(cuerpo, nombre) {
  if (!document.getElementById('css-impreso')) {
    const s = document.createElement('style');
    s.id = 'css-impreso'; s.textContent = CSS_IMPRESO;
    document.head.appendChild(s);
  }

  document.querySelectorAll('.velo-impreso').forEach((v) => v.remove());
  const velo = document.createElement('div');
  velo.className = 'velo-impreso';
  velo.innerHTML =
    '<div class="barra-impreso">' +
      '<button id="imp-print">Imprimir o guardar como PDF</button>' +
      '<button class="sec" id="imp-cerrar">Cerrar</button>' +
    '</div>' +
    /* 🔷 SIN EL SELLO «MODELO BORRADOR» (16-08-2026, Marco, por segunda vez:
       "acuérdate que te pedí que en todos los PDF sacaras lo del modelo
       borrador, acá sigue apareciendo").

       La primera vez lo saqué del cuerpo de cada documento —del presupuesto, de
       la ficha— pero no de acá, que es el marco que envuelve a los CUATRO y les
       agregaba el rótulo al final. Por eso reaparecía: se estaba quitando en
       cuatro lugares y poniendo en uno solo. */
    '<div class="impreso">' +
    '<div class="contenido">' + cuerpo + '</div></div>';
  document.body.appendChild(velo);
  Media.pintar(velo);

  // El nombre del archivo que propone el navegador sale del título del
  // documento. Es lo que hace que el guion pueda decir cuál debe quedar.
  const tituloPrevio = document.title;

  document.body.classList.add('mirando-impreso');
  const cerrar = () => {
    velo.remove();
    document.body.classList.remove('mirando-impreso');
    document.title = tituloPrevio;
  };
  velo.querySelector('#imp-cerrar').addEventListener('click', cerrar);
  velo.addEventListener('click', (ev) => { if (ev.target === velo) cerrar(); });
  /* 🔴 SE IMPRIMIA A LOS 250 ms Y LAS FOTOS NO ESTABAN (30-08-2026, Marco:
     «es super lento como para guardarlo como PDF»).

     Las fotos se resuelven de IndexedDB y se pintan cuando llegan. El codigo
     esperaba un cuarto de segundo fijo y mandaba a imprimir: con un comprobante
     de siete fotos de 300 KB eso es demasiado pronto, asi que el navegador
     abria el dialogo y se quedaba pensando ahi —con la ventana ya bloqueada—
     mientras terminaba de decodificarlas. Se ve como lentitud del sistema y en
     realidad es una espera mal puesta.

     Ahora se espera a que cada imagen este DECODIFICADA. El boton lo dice
     mientras tanto, que es la diferencia entre esperar y no saber si se
     apreto. `decode()` puede rechazar en una imagen rota: se ignora, porque una
     foto que no carga no puede impedir que se imprima el documento. */
  velo.querySelector('#imp-print').addEventListener('click', async (ev) => {
    const boton = ev.currentTarget;
    const rotulo = boton.textContent;
    const fotos = [...velo.querySelectorAll('img')];
    if (fotos.length) {
      boton.disabled = true;
      boton.textContent = 'Preparando ' + fotos.length +
        (fotos.length === 1 ? ' imagen…' : ' imágenes…');
      await Promise.all(fotos.map((im) => {
        if (!im.src) return Promise.resolve();
        return (im.decode ? im.decode() : Promise.resolve()).catch(() => {});
      }));
      boton.disabled = false;
      boton.textContent = rotulo;
    }
    document.title = nombre;
    window.print();
    document.title = tituloPrevio;
  });
  document.addEventListener('keydown', function esc_(ev) {
    if (ev.key === 'Escape') { cerrar(); document.removeEventListener('keydown', esc_); }
  });

  avisar({ ok: true, motivo: '' }, 'Al guardar como PDF, el archivo debería quedar como “' + nombre + '.pdf”.');
}
