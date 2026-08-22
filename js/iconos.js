/* Automotora DyP — Modelo Borrador · Arttmize SpA
   Set de iconos SVG propio, trazo 1.6 y caja de 16.
   Nada de emoji: son dependientes de la fuente, cambian entre equipos y no se
   pueden teñir con las variables del tema. */

const ICONOS = {
  // Módulos
  agenda:    '<rect x="3" y="4" width="10" height="9" rx="1"/><path d="M3 7h10M6 2v3M10 2v3"/>',
  recepcion: '<path d="M2 11h12M3.5 11V7.5l1.2-2.6a1 1 0 0 1 .9-.6h4.8a1 1 0 0 1 .9.6L12.5 7.5V11"/><path d="M3.5 7.5h9"/><circle cx="5" cy="12.5" r="1"/><circle cx="11" cy="12.5" r="1"/>',
  torre:     '<path d="M8 1.5 3 4v3.5c0 3 2.1 5.6 5 6.5 2.9-.9 5-3.5 5-6.5V4z"/><path d="M6 8l1.5 1.5L10.5 6.5"/>',
  taller:    '<path d="M10.5 2.5a3 3 0 0 0-4 4l-4 4a1.4 1.4 0 0 0 2 2l4-4a3 3 0 0 0 4-4l-1.8 1.8-1.4-.4-.4-1.4z"/>',
  repuesto:  '<path d="M8 1.8 3 4.3v4.4c0 .5.3 1 .7 1.2L8 12.6l4.3-2.7c.4-.2.7-.7.7-1.2V4.3z"/><path d="M3.2 4.3 8 6.8l4.8-2.5M8 6.8v5.8"/>',
  espera:    '<circle cx="8" cy="8" r="6"/><path d="M8 4.6V8l2.3 1.4"/>',
  presupuesto: '<rect x="3" y="1.8" width="10" height="12.4" rx="1"/><path d="M5.5 5h5M5.5 8h5M5.5 11h3"/>',
  historico: '<path d="M2.6 8a5.4 5.4 0 1 0 1.6-3.8"/><path d="M2.2 2.6v3h3"/><path d="M8 5.4V8l2 1.2"/>',
  personal:  '<circle cx="8" cy="5.2" r="2.4"/><path d="M3.4 13.2a4.6 4.6 0 0 1 9.2 0"/>',
  documento: '<path d="M9 1.8H4.5a1 1 0 0 0-1 1v10.4a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V5.4z"/><path d="M9 1.8v3.6h3.5"/>',
  bodega:    '<path d="M2 6.4 8 2.4l6 4V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z"/><rect x="6" y="8.6" width="4" height="5.4"/>',
  consolidado: '<path d="M2.4 13.6h11.2"/><rect x="3.4" y="8" width="2.4" height="4"/><rect x="6.8" y="5" width="2.4" height="7"/><rect x="10.2" y="2.6" width="2.4" height="9.4"/>',
  config:    '<circle cx="8" cy="8" r="2"/><path d="M12.8 9.6a1 1 0 0 0 .2 1.1l.1.1a1.2 1.2 0 1 1-1.7 1.7l-.1-.1a1 1 0 0 0-1.7.7v.2a1.2 1.2 0 1 1-2.4 0v-.1a1 1 0 0 0-1.8-.7l-.1.1a1.2 1.2 0 1 1-1.7-1.7l.1-.1a1 1 0 0 0-.7-1.7h-.2a1.2 1.2 0 1 1 0-2.4h.1a1 1 0 0 0 .7-1.8l-.1-.1a1.2 1.2 0 1 1 1.7-1.7l.1.1a1 1 0 0 0 1.7-.7v-.2a1.2 1.2 0 1 1 2.4 0v.1a1 1 0 0 0 1.8.7l.1-.1a1.2 1.2 0 1 1 1.7 1.7l-.1.1a1 1 0 0 0 .7 1.7h.2a1.2 1.2 0 1 1 0 2.4h-.1a1 1 0 0 0-.9.6z"/>',

  // Acciones
  nuevo:     '<path d="M8 3.2v9.6M3.2 8h9.6"/>',
  editar:    '<path d="M11.2 2.4a1.5 1.5 0 0 1 2.1 2.1L5.6 12.2l-2.9.8.8-2.9z"/>',
  refrescar: '<path d="M13.4 8a5.4 5.4 0 1 1-1.6-3.8"/><path d="M13.8 2.6v3h-3"/>',
  // Flecha que vuelve sobre sus pasos: es la de deshacer, al revés de refrescar.
  deshacer: '<path d="M2.6 8a5.4 5.4 0 1 0 1.6-3.8"/><path d="M2.2 2.6v3h3"/>',
  exportar:  '<path d="M8 10.4V2.6M5.2 5.4 8 2.6l2.8 2.8"/><path d="M2.8 10.8v1.6a1 1 0 0 0 1 1h8.4a1 1 0 0 0 1-1v-1.6"/>',
  imprimir:  '<path d="M4.4 6V2.4h7.2V6"/><path d="M4.4 12h-1a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h9.2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-1"/><rect x="4.4" y="9.6" width="7.2" height="4"/>',
  buscar:    '<circle cx="7.2" cy="7.2" r="4.4"/><path d="M10.4 10.4 13.6 13.6"/>',
  filtro:    '<path d="M2.4 3.2h11.2l-4.4 5.2v4.4l-2.4-1.2V8.4z"/>',
  guardar:   '<path d="M12.6 13.4H3.4a1 1 0 0 1-1-1V3.6a1 1 0 0 1 1-1h7l3.2 3.2v6.6a1 1 0 0 1-1 1z"/><path d="M5 13.4V9h6v4.4M5 2.6v3h4"/>',
  camara:    '<path d="M13.4 11.6a1 1 0 0 1-1 1H3.6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1.8l1-1.6h3.2l1 1.6h1.8a1 1 0 0 1 1 1z"/><circle cx="8" cy="8.6" r="2.2"/>',
  adjuntar:  '<path d="M13 7.4 8 12.4a3.2 3.2 0 0 1-4.6-4.6l5-5a2.1 2.1 0 0 1 3 3l-5 5a1 1 0 0 1-1.5-1.5l4.6-4.6"/>',
  check:     '<path d="M3 8.4 6.4 11.8 13 5.2"/>',
  // La cruz y la interrogación existen para el checklist de recepción: sus
  // cuatro estados se marcan con un icono cada uno, y tienen que distinguirse
  // de un vistazo sin leer el rótulo.
  cruz:      '<path d="M4.2 4.2 11.8 11.8M11.8 4.2 4.2 11.8"/>',
  pregunta:  '<path d="M5.9 6.1a2.1 2.1 0 1 1 2.6 2.05c-.5.15-.8.6-.8 1.15v.4"/><path d="M7.7 12.2h.01"/>',
  alerta:    '<path d="M8 2.4 14 12.8H2z"/><path d="M8 6.6v3M8 11.4h.01"/>',
  info:      '<circle cx="8" cy="8" r="6"/><path d="M8 7.4v3.4M8 5.2h.01"/>',
  reloj:     '<circle cx="8" cy="8" r="6"/><path d="M8 4.6V8l2.3 1.4"/>',
  auto:      '<path d="M2.4 10.6h11.2M3.8 10.6V7.2l1.3-2.8a1 1 0 0 1 .9-.6h4a1 1 0 0 1 .9.6l1.3 2.8v3.4"/><path d="M3.8 7.2h8.4"/><circle cx="5.4" cy="12" r="1.1"/><circle cx="10.6" cy="12" r="1.1"/>',
  usuario:   '<circle cx="8" cy="5.4" r="2.3"/><path d="M3.6 13a4.4 4.4 0 0 1 8.8 0"/>',
  candado:   '<rect x="3.4" y="7" width="9.2" height="6.6" rx="1"/><path d="M5.6 7V4.8a2.4 2.4 0 0 1 4.8 0V7"/>',
  chevron:   '<path d="M6 3.5 10.5 8 6 12.5"/>',
  base:      '<ellipse cx="8" cy="3.8" rx="5.2" ry="2"/><path d="M2.8 3.8v8.4c0 1.1 2.3 2 5.2 2s5.2-.9 5.2-2V3.8"/><path d="M13.2 8c0 1.1-2.3 2-5.2 2s-5.2-.9-5.2-2"/>'
};

// Devuelve el SVG listo para insertar. `g` lo hace de 16px en vez de 14px.
function ico(nombre, clase) {
  const d = ICONOS[nombre];
  if (!d) return '';
  return '<svg class="ico' + (clase ? ' ' + clase : '') + '" viewBox="0 0 16 16" aria-hidden="true">' + d + '</svg>';
}
