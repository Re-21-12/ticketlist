import sanitizeHtml from 'sanitize-html';

/**
 * La descripción de un ticket es texto ENRIQUECIDO (HTML del editor). Nunca se guarda tal cual: solo pasa
 * una lista corta de etiquetas de formato, sin atributos de eventos ni estilos, y los enlaces solo
 * `http(s)` / `mailto` con `rel="noopener noreferrer"`. Todo lo demás (`<script>`, `<img onerror>`,
 * `javascript:`…) se descarta. Un editor vacío (`<p><br></p>`) se guarda como `''`.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'h1', 'h2', 'h3', 'a'],
  allowedAttributes: { a: ['href', 'target', 'rel'], li: ['data-list'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    a: (_tag, attribs) => ({ tagName: 'a', attribs: { ...(attribs['href'] ? { href: attribs['href'] } : {}), target: '_blank', rel: 'noopener noreferrer' } }),
  },
};

export function sanitizeRichText(html: string): string {
  const clean = sanitizeHtml(html, OPTIONS).trim();
  const text = clean.replace(/<[^>]*>/g, '').trim();
  // Sin texto ni enlaces (solo párrafos vacíos del editor): se guarda vacío.
  return text === '' && !/<a\s/.test(clean) ? '' : clean;
}
