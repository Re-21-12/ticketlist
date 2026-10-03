/**
 * Evidencia del mock: el navegador no puede pedirle una imagen o un video a un `HttpClient` falso, así que cada archivo
 * «subido» se guarda aquí como un `blob:` y la pantalla lo usa como `src`. Solo existe en modo mock (el backend real
 * sirve `GET /api/tickets/:uuid/attachments/:id` de su bucket).
 */
const urls = new Map<string, string>();

export function registerMockAttachment(id: string, file: Blob): void {
  try {
    urls.set(id, URL.createObjectURL(file));
  } catch {
    // Un entorno sin `createObjectURL` (pruebas) simplemente no tiene vista previa: el adjunto igual queda registrado.
  }
}

export function mockAttachmentUrl(id: string): string | null {
  return urls.get(id) ?? null;
}

export function resetMockAttachments(): void {
  for (const url of urls.values()) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // idem
    }
  }
  urls.clear();
}
