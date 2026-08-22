/* Automotora DyP — Modelo Borrador · Arttmize SpA
   ────────────────────────────────────────────────────────────────────────
   LA SILUETA DEL VEHÍCULO. Se usa en dos lados —la recepción, donde se marca,
   y la ficha de la orden, donde se consulta—, así que vive aparte.

   🔶 REHECHA EL 15-08-2026, pedido del cliente mirando el sistema real.

   Antes era un croquis de rectángulos con rótulos, y se marcaba haciendo clic
   en uno. El taller marca de otra manera: sobre un dibujo del auto con sus
   CINCO VISTAS —superior, frontal, trasera y los dos laterales— y rayando
   encima con el dedo, como en un papel. Eso es lo que hay ahora.

   ⚠️ Y acá hay una tensión que conviene tener escrita, porque la decisión
   anterior era al revés y por un motivo bueno: **un dibujo libre no se puede
   consultar**. Si el daño es un garabato, nadie puede preguntarle después al
   sistema cuántos vehículos de SURA llegaron con daño en la puerta delantera
   izquierda.

   Cómo se resolvió sin perder ninguna de las dos cosas: **el trazo se dibuja
   libre, pero no se guarda suelto**. Al soltar el dedo se calcula el centro del
   trazo, se mira en qué vista y en qué zona cayó, y la marca se guarda con
   `vista`, `zona`, `tipo`, `severidad` y coordenada normalizada —exactamente
   los mismos campos de antes— más el trazo para poder redibujarlo. El mapa de
   zonas existe, simplemente ya no se ve: el recepcionista raya, y el sistema
   clasifica solo.
   ──────────────────────────────────────────────────────────────────────── */

/* El lienzo mide 900×470 y ahí caben las cinco vistas, repartidas como en el
   dibujo del sistema real: la superior a la izquierda ocupando todo el alto, y
   a la derecha dos columnas — trasera y frontal, con su lateral al lado. */
const SILUETA_CAJA = { w: 900, h: 470 };

const SILUETA_VISTAS = [
  { id: 'superior',    nombre: 'Superior',        x: 24,  y: 34,  w: 172, h: 404 },
  { id: 'trasera',     nombre: 'Trasera',         x: 226, y: 44,  w: 176, h: 168 },
  { id: 'frontal',     nombre: 'Frontal',         x: 226, y: 258, w: 176, h: 168 },
  { id: 'lateral_der', nombre: 'Lateral derecho', x: 428, y: 44,  w: 448, h: 168 },
  { id: 'lateral_izq', nombre: 'Lateral izquierdo', x: 428, y: 258, w: 448, h: 168 }
];

/* El mapa de zonas, en coordenadas RELATIVAS a su vista (0..1 en cada eje).
   No se dibuja: solo sirve para clasificar dónde cayó el trazo. Por eso puede
   ser una cuadrícula tosca — lo que el usuario ve es el auto, no esto.

   El orden importa: se devuelve la primera que contenga el punto. */
/* ⚠️ LAS CAJAS TIENEN QUE CUBRIR LA VISTA ENTERA, sin huecos. La primera
   versión dejaba franjas sin asignar y un trazo que caía ahí se guardaba como
   "Sin zona" — o sea, el daño quedaba dibujado y sin dato consultable, que es
   exactamente lo que este mapa existe para evitar. Cada vista se reparte de
   0 a 1 en los dos ejes y no queda un milímetro afuera. */

const SILUETA_ZONAS = {
  superior: [
    // franjas de proa a popa, cada una de ancho completo o repartida a los lados
    ['paragolpes_del', 0,    0,    1,    0.09],
    ['tapabarro_izq',  0,    0.09, 0.18, 0.16],
    ['capo',           0.18, 0.09, 0.64, 0.16],
    ['tapabarro_der',  0.82, 0.09, 0.18, 0.16],
    ['parabrisas',     0,    0.25, 1,    0.10],
    ['puerta_del_izq', 0,    0.35, 0.20, 0.16],
    ['techo',          0.20, 0.35, 0.60, 0.32],
    ['puerta_del_der', 0.80, 0.35, 0.20, 0.16],
    ['puerta_tra_izq', 0,    0.51, 0.20, 0.16],
    ['puerta_tra_der', 0.80, 0.51, 0.20, 0.16],
    ['costado_tra_izq',0,    0.67, 0.20, 0.24],
    ['luneta',         0.20, 0.67, 0.60, 0.10],
    ['costado_tra_der',0.80, 0.67, 0.20, 0.24],
    ['maletero',       0.20, 0.77, 0.60, 0.14],
    ['paragolpes_tra', 0,    0.91, 1,    0.09]
  ],
  frontal: [
    ['parabrisas',     0,    0,    1,    0.30],
    ['tapabarro_izq',  0,    0.30, 0.10, 0.28],
    ['capo',           0.10, 0.30, 0.80, 0.28],
    ['tapabarro_der',  0.90, 0.30, 0.10, 0.28],
    ['paragolpes_del', 0,    0.58, 1,    0.42]
  ],
  trasera: [
    ['luneta',         0,    0,    1,    0.30],
    ['costado_tra_izq',0,    0.30, 0.10, 0.28],
    ['maletero',       0.10, 0.30, 0.80, 0.28],
    ['costado_tra_der',0.90, 0.30, 0.10, 0.28],
    ['paragolpes_tra', 0,    0.58, 1,    0.42]
  ],
  /* El lateral se define UNA vez, con el auto mirando a la derecha, y el
     izquierdo se deriva reflejándolo — igual que el dibujo. Escribirlo dos
     veces fue el otro error: el dibujo se reflejaba y el mapa no, así que en el
     lateral izquierdo la puerta trasera caía donde se ve la delantera. */
  lateral_der: [
    ['costado_tra_der',0,    0,    0.20, 0.32],
    ['luneta',         0.20, 0,    0.18, 0.32],
    ['techo',          0.38, 0,    0.24, 0.32],
    ['parabrisas',     0.62, 0,    0.20, 0.32],
    ['capo',           0.82, 0,    0.18, 0.32],
    ['paragolpes_tra', 0,    0.32, 0.09, 0.68],
    ['costado_tra_der',0.09, 0.32, 0.16, 0.68],
    ['puerta_tra_der', 0.25, 0.32, 0.23, 0.68],
    ['puerta_del_der', 0.48, 0.32, 0.22, 0.68],
    ['tapabarro_der',  0.70, 0.32, 0.20, 0.68],
    ['paragolpes_del', 0.90, 0.32, 0.10, 0.68]
  ]
};

/* El lateral izquierdo, reflejado del derecho: la caja que estaba en `x` con
   ancho `w` pasa a `1 - x - w`, y las piezas que tienen lado cambian de lado. */
SILUETA_ZONAS.lateral_izq = SILUETA_ZONAS.lateral_der.map(([c, x, y, w, h]) =>
  [c.replace(/_der$/, '_izq'), Number((1 - x - w).toFixed(4)), y, w, h]);

/* Dónde cayó un punto del lienzo, en coordenadas normalizadas 0..1 sobre el
   SVG completo. Devuelve la vista y la zona, o la vista sola si el trazo quedó
   fuera de todo —que pasa, y es mejor guardar "superior sin zona" que mentir. */
function siluetaUbicar(nx, ny) {
  const px = nx * SILUETA_CAJA.w, py = ny * SILUETA_CAJA.h;
  const v = SILUETA_VISTAS.find((c) =>
    px >= c.x && px <= c.x + c.w && py >= c.y && py <= c.y + c.h);
  if (!v) return { vista: 'superior', zona: null };

  const rx = (px - v.x) / v.w, ry = (py - v.y) / v.h;
  const z = (SILUETA_ZONAS[v.id] || []).find(([, x, y, w, h]) =>
    rx >= x && rx <= x + w && ry >= y && ry <= y + h);
  return { vista: v.id, zona: z ? z[0] : null };
}

/* ── El dibujo ──────────────────────────────────────────────────────────
   Cinco vistas de un auto, en trazo limpio. Es un dibujo propio: no se copia
   el archivo del sistema actual porque no lo tenemos, y no se sale a buscar
   uno a internet porque este modelo funciona sin conexión y sin dependencias.
   Lo que importa es que se reconozca de un vistazo cuál es cada vista, y que
   haya superficie suficiente para rayar encima. */

function siluetaLateral(x, y, w, h, espejo) {
  /* Se dibuja mirando a la derecha y, para el lado izquierdo, se refleja con
     una transformación en vez de duplicar todos los trazos: un auto dibujado
     dos veces a mano son dos autos distintos, y acá tienen que ser el mismo. */
  const t = espejo ? 'translate(' + (2 * x + w) + ',0) scale(-1,1)' : '';
  const X = (p) => x + p * w, Y = (p) => y + p * h;
  return '<g class="auto" transform="' + t + '">' +
    // carrocería
    '<path d="M ' + X(0.02) + ',' + Y(0.72) +
      ' L ' + X(0.03) + ',' + Y(0.42) +
      ' Q ' + X(0.05) + ',' + Y(0.33) + ' ' + X(0.14) + ',' + Y(0.31) +
      ' L ' + X(0.26) + ',' + Y(0.29) +
      ' Q ' + X(0.33) + ',' + Y(0.07) + ' ' + X(0.47) + ',' + Y(0.06) +
      ' L ' + X(0.62) + ',' + Y(0.07) +
      ' Q ' + X(0.72) + ',' + Y(0.10) + ' ' + X(0.78) + ',' + Y(0.31) +
      ' L ' + X(0.90) + ',' + Y(0.35) +
      ' Q ' + X(0.97) + ',' + Y(0.40) + ' ' + X(0.98) + ',' + Y(0.52) +
      ' L ' + X(0.98) + ',' + Y(0.72) + ' Z" />' +
    // ventanas
    '<path d="M ' + X(0.30) + ',' + Y(0.30) + ' Q ' + X(0.36) + ',' + Y(0.12) + ' ' +
      X(0.47) + ',' + Y(0.11) + ' L ' + X(0.47) + ',' + Y(0.30) + ' Z" />' +
    '<path d="M ' + X(0.50) + ',' + Y(0.11) + ' L ' + X(0.61) + ',' + Y(0.12) + ' Q ' +
      X(0.68) + ',' + Y(0.15) + ' ' + X(0.72) + ',' + Y(0.30) + ' L ' + X(0.50) + ',' + Y(0.30) + ' Z" />' +
    // línea de puertas
    '<path d="M ' + X(0.485) + ',' + Y(0.11) + ' L ' + X(0.485) + ',' + Y(0.70) + '" />' +
    '<path d="M ' + X(0.30) + ',' + Y(0.31) + ' L ' + X(0.30) + ',' + Y(0.69) + '" />' +
    '<path d="M ' + X(0.72) + ',' + Y(0.31) + ' L ' + X(0.72) + ',' + Y(0.62) + '" />' +
    // manillas
    '<path d="M ' + X(0.38) + ',' + Y(0.40) + ' l ' + (w * 0.05) + ',0" />' +
    '<path d="M ' + X(0.56) + ',' + Y(0.40) + ' l ' + (w * 0.05) + ',0" />' +
    // ruedas
    '<circle cx="' + X(0.24) + '" cy="' + Y(0.72) + '" r="' + (h * 0.19) + '" />' +
    '<circle cx="' + X(0.24) + '" cy="' + Y(0.72) + '" r="' + (h * 0.09) + '" />' +
    '<circle cx="' + X(0.80) + '" cy="' + Y(0.72) + '" r="' + (h * 0.19) + '" />' +
    '<circle cx="' + X(0.80) + '" cy="' + Y(0.72) + '" r="' + (h * 0.09) + '" />' +
    // piso
    '<path d="M ' + X(0.02) + ',' + Y(0.90) + ' L ' + X(0.98) + ',' + Y(0.90) + '" />' +
    '</g>';
}

function siluetaFrente(x, y, w, h, atras) {
  const X = (p) => x + p * w, Y = (p) => y + p * h;
  return '<g class="auto">' +
    // techo y carrocería
    '<path d="M ' + X(0.20) + ',' + Y(0.30) +
      ' Q ' + X(0.24) + ',' + Y(0.07) + ' ' + X(0.50) + ',' + Y(0.06) +
      ' Q ' + X(0.76) + ',' + Y(0.07) + ' ' + X(0.80) + ',' + Y(0.30) +
      ' L ' + X(0.93) + ',' + Y(0.34) +
      ' Q ' + X(0.99) + ',' + Y(0.40) + ' ' + X(0.99) + ',' + Y(0.60) +
      ' L ' + X(0.99) + ',' + Y(0.80) + ' L ' + X(0.01) + ',' + Y(0.80) +
      ' L ' + X(0.01) + ',' + Y(0.60) +
      ' Q ' + X(0.01) + ',' + Y(0.40) + ' ' + X(0.07) + ',' + Y(0.34) + ' Z" />' +
    // luneta o parabrisas
    '<path d="M ' + X(0.24) + ',' + Y(0.29) + ' Q ' + X(0.28) + ',' + Y(0.11) + ' ' +
      X(0.50) + ',' + Y(0.10) + ' Q ' + X(0.72) + ',' + Y(0.11) + ' ' +
      X(0.76) + ',' + Y(0.29) + ' Z" />' +
    // espejos
    '<path d="M ' + X(0.17) + ',' + Y(0.32) + ' l ' + (-w * 0.06) + ',' + (h * 0.03) + '" />' +
    '<path d="M ' + X(0.83) + ',' + Y(0.32) + ' l ' + (w * 0.06) + ',' + (h * 0.03) + '" />' +
    // ópticos
    '<path d="M ' + X(0.08) + ',' + Y(0.47) + ' l ' + (w * 0.17) + ',0 l 0,' + (h * 0.08) +
      ' l ' + (-w * 0.17) + ',0 Z" />' +
    '<path d="M ' + X(0.75) + ',' + Y(0.47) + ' l ' + (w * 0.17) + ',0 l 0,' + (h * 0.08) +
      ' l ' + (-w * 0.17) + ',0 Z" />' +
    // parrilla o tapa, y patente
    (atras
      ? '<path d="M ' + X(0.30) + ',' + Y(0.44) + ' l ' + (w * 0.40) + ',0" />'
      : '<path d="M ' + X(0.32) + ',' + Y(0.47) + ' l ' + (w * 0.36) + ',0 l 0,' + (h * 0.07) +
        ' l ' + (-w * 0.36) + ',0 Z" />') +
    '<path d="M ' + X(0.37) + ',' + Y(0.62) + ' l ' + (w * 0.26) + ',0 l 0,' + (h * 0.09) +
      ' l ' + (-w * 0.26) + ',0 Z" />' +
    // paragolpes
    '<path d="M ' + X(0.01) + ',' + Y(0.72) + ' l ' + (w * 0.98) + ',0" />' +
    '</g>';
}

function siluetaSuperior(x, y, w, h) {
  const X = (p) => x + p * w, Y = (p) => y + p * h;
  return '<g class="auto">' +
    // contorno
    '<path d="M ' + X(0.50) + ',' + Y(0.01) +
      ' Q ' + X(0.86) + ',' + Y(0.03) + ' ' + X(0.93) + ',' + Y(0.14) +
      ' L ' + X(0.96) + ',' + Y(0.40) + ' L ' + X(0.96) + ',' + Y(0.76) +
      ' Q ' + X(0.94) + ',' + Y(0.94) + ' ' + X(0.50) + ',' + Y(0.99) +
      ' Q ' + X(0.06) + ',' + Y(0.94) + ' ' + X(0.04) + ',' + Y(0.76) +
      ' L ' + X(0.04) + ',' + Y(0.40) + ' L ' + X(0.07) + ',' + Y(0.14) +
      ' Q ' + X(0.14) + ',' + Y(0.03) + ' ' + X(0.50) + ',' + Y(0.01) + ' Z" />' +
    // capó y parabrisas
    '<path d="M ' + X(0.16) + ',' + Y(0.09) + ' L ' + X(0.84) + ',' + Y(0.09) + '" />' +
    '<path d="M ' + X(0.15) + ',' + Y(0.25) + ' Q ' + X(0.50) + ',' + Y(0.22) + ' ' +
      X(0.85) + ',' + Y(0.25) + '" />' +
    '<path d="M ' + X(0.19) + ',' + Y(0.35) + ' Q ' + X(0.50) + ',' + Y(0.32) + ' ' +
      X(0.81) + ',' + Y(0.35) + '" />' +
    // techo
    '<path d="M ' + X(0.19) + ',' + Y(0.35) + ' L ' + X(0.19) + ',' + Y(0.67) + '" />' +
    '<path d="M ' + X(0.81) + ',' + Y(0.35) + ' L ' + X(0.81) + ',' + Y(0.67) + '" />' +
    // luneta y maletero
    '<path d="M ' + X(0.19) + ',' + Y(0.67) + ' Q ' + X(0.50) + ',' + Y(0.70) + ' ' +
      X(0.81) + ',' + Y(0.67) + '" />' +
    '<path d="M ' + X(0.15) + ',' + Y(0.77) + ' Q ' + X(0.50) + ',' + Y(0.80) + ' ' +
      X(0.85) + ',' + Y(0.77) + '" />' +
    '<path d="M ' + X(0.16) + ',' + Y(0.91) + ' L ' + X(0.84) + ',' + Y(0.91) + '" />' +
    // puertas
    '<path d="M ' + X(0.04) + ',' + Y(0.51) + ' L ' + X(0.19) + ',' + Y(0.51) + '" />' +
    '<path d="M ' + X(0.96) + ',' + Y(0.51) + ' L ' + X(0.81) + ',' + Y(0.51) + '" />' +
    // espejos
    '<path d="M ' + X(0.04) + ',' + Y(0.29) + ' l ' + (-w * 0.06) + ',' + (h * 0.01) + '" />' +
    '<path d="M ' + X(0.96) + ',' + Y(0.29) + ' l ' + (w * 0.06) + ',' + (h * 0.01) + '" />' +
    '</g>';
}

/* El SVG completo. `marcas` es el grupo donde se pintan los trazos. */
function svgSilueta() {
  const v = (id) => SILUETA_VISTAS.find((x) => x.id === id);
  const rot = (c) => '<text class="vista-rotulo" x="' + (c.x + c.w / 2) + '" y="' + (c.y - 9) +
    '" text-anchor="middle">' + esc(c.nombre) + '</text>';

  const sup = v('superior'), tra = v('trasera'), fro = v('frontal');
  const ldr = v('lateral_der'), liz = v('lateral_izq');

  return '<svg viewBox="0 0 ' + SILUETA_CAJA.w + ' ' + SILUETA_CAJA.h + '" id="silueta">' +
    [sup, tra, fro, ldr, liz].map(rot).join('') +
    siluetaSuperior(sup.x, sup.y, sup.w, sup.h) +
    siluetaFrente(tra.x, tra.y, tra.w, tra.h, true) +
    siluetaFrente(fro.x, fro.y, fro.w, fro.h, false) +
    siluetaLateral(ldr.x, ldr.y, ldr.w, ldr.h, false) +
    siluetaLateral(liz.x, liz.y, liz.w, liz.h, true) +
    '<g id="marcas"></g></svg>';
}

// El nombre de cada vista, para no andar reemplazando guiones bajos por ahí.
const SILUETA_NOMBRE_VISTA = SILUETA_VISTAS.reduce((m, v) => {
  m[v.id] = v.nombre; return m;
}, {});

/* El centro de una zona, en coordenadas normalizadas del lienzo completo.

   Sirve para los daños que NO tienen trazo: los que se marcaron con un clic
   antes del 15-08-2026, y los 222 que trae la semilla. Sus coordenadas venían
   de la silueta vieja y sobre este dibujo caerían en cualquier parte —incluso
   fuera del auto—. Dibujarlos en el centro de SU zona los deja donde
   corresponde: la pieza es el dato que sí guardaron. */
function siluetaPuntoDeZona(vista, zonaCodigo) {
  const v = SILUETA_VISTAS.find((x) => x.id === vista) ||
            SILUETA_VISTAS.find((x) => x.id === 'superior');
  const z = (SILUETA_ZONAS[v.id] || []).find(([c]) => c === zonaCodigo);
  if (!z) return { x: (v.x + v.w / 2) / SILUETA_CAJA.w, y: (v.y + v.h / 2) / SILUETA_CAJA.h };
  return { x: (v.x + (z[1] + z[3] / 2) * v.w) / SILUETA_CAJA.w,
           y: (v.y + (z[2] + z[4] / 2) * v.h) / SILUETA_CAJA.h };
}

/* Un trazo, de puntos normalizados a `d` de SVG. Se usa en la pantalla y en el
   impreso, así que vive acá y no en ninguna de las dos. */
function siluetaTrazoD(puntos) {
  if (!puntos || !puntos.length) return '';
  const px = (p) => (p.x * SILUETA_CAJA.w).toFixed(1) + ',' + (p.y * SILUETA_CAJA.h).toFixed(1);
  if (puntos.length === 1) {
    // Un toque sin arrastre: un punto se dibuja como un trazo mínimo, porque
    // marcar con un toque es lo que se hace cuando el daño es chico.
    const p = puntos[0];
    return 'M ' + px(p) + ' l 0.6,0';
  }
  return 'M ' + px(puntos[0]) + ' ' + puntos.slice(1).map((p) => 'L ' + px(p)).join(' ');
}
