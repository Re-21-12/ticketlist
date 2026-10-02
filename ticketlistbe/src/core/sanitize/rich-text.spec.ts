import { sanitizeRichText } from './rich-text.js';

describe('sanitizeRichText', () => {
  it('conserva el formato permitido', () => {
    expect(sanitizeRichText('<p><strong>Hola</strong> <em>mundo</em></p><ul><li>uno</li></ul>')).toBe(
      '<p><strong>Hola</strong> <em>mundo</em></p><ul><li>uno</li></ul>',
    );
  });

  it('descarta scripts, eventos y estilos', () => {
    const dirty = '<p style="color:red" onclick="x()">Hola<script>alert(1)</script><img src=x onerror="alert(1)"></p>';
    const clean = sanitizeRichText(dirty);
    expect(clean).toBe('<p>Hola</p>');
  });

  it('los enlaces solo http(s)/mailto y siempre con rel seguro', () => {
    expect(sanitizeRichText('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript');
    const link = sanitizeRichText('<a href="https://ejemplo.com" onclick="x()">sitio</a>');
    expect(link).toContain('href="https://ejemplo.com"');
    expect(link).toContain('rel="noopener noreferrer"');
    expect(link).not.toContain('onclick');
  });

  it('un editor vacío queda como cadena vacía', () => {
    expect(sanitizeRichText('<p><br></p>')).toBe('');
    expect(sanitizeRichText('   ')).toBe('');
  });

  it('texto plano de tickets anteriores sigue funcionando', () => {
    expect(sanitizeRichText('Ocurre solo con cuentas de Workspace.')).toBe('Ocurre solo con cuentas de Workspace.');
  });
});
