import { EVIDENCE_MAX_BYTES, EVIDENCE_MAX_VIDEO_SECONDS, EVIDENCE_TYPES_TEXT, kindOfExtension } from './evidence.constants';
import type { TAttachmentKind } from './evidence.types';

/** Tamaño legible: «850 KB», «12,4 MB». */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${new Intl.NumberFormat('es', { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024))} MB`;
}

/** «1:05», «12:30»: duración de un video. */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Familia del archivo según su extensión; `null` si no es un tipo admitido. */
export function kindOfFile(file: Pick<File, 'name'>): TAttachmentKind | null {
  const extension = file.name.includes('.') ? (file.name.split('.').pop() ?? '') : '';
  return kindOfExtension(extension);
}

/** Duración (segundos) de un video leyendo SOLO sus metadatos en el navegador; `null` si no se puede. */
export function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    const done = (value: number | null): void => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      resolve(value);
    };
    video.preload = 'metadata';
    video.onloadedmetadata = () => done(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => done(null);
    video.src = url;
  });
}

export interface IEvidenceCheck {
  ok: boolean;
  kind: TAttachmentKind | null;
  /** Por qué se rechaza (solo si `ok` es `false`): texto listo para mostrar y pedir otro archivo. */
  message: string | null;
}

/**
 * Comprobación PREVIA a la subida (el servidor repite todas): tipo admitido, tope de tamaño de su familia y, en video,
 * duración ≤ 5 min. Así la persona ve el motivo al instante («solicita otro archivo», A2 de CU02) sin esperar la subida.
 * `probeDuration` se inyecta para poder probarlo sin un `<video>` real.
 */
export async function checkEvidenceFile(
  file: File,
  probeDuration: (file: File) => Promise<number | null> = readVideoDuration,
): Promise<IEvidenceCheck> {
  const kind = kindOfFile(file);
  if (!kind) return { ok: false, kind: null, message: `«${file.name}» no es un tipo admitido. Se aceptan: ${EVIDENCE_TYPES_TEXT}.` };
  const max = EVIDENCE_MAX_BYTES[kind];
  if (file.size > max) {
    return { ok: false, kind, message: `«${file.name}» pesa ${formatBytes(file.size)} y el máximo para ${kind === 'image' ? 'imágenes' : kind === 'video' ? 'videos' : 'documentos'} es ${formatBytes(max)}. Elige otro archivo.` };
  }
  if (file.size === 0) return { ok: false, kind, message: `«${file.name}» está vacío. Elige otro archivo.` };
  if (kind === 'video') {
    const seconds = await probeDuration(file);
    if (seconds === null) return { ok: false, kind, message: `No se pudo comprobar la duración de «${file.name}». Elige otro video.` };
    if (seconds > EVIDENCE_MAX_VIDEO_SECONDS) {
      return { ok: false, kind, message: `«${file.name}» dura ${formatDuration(seconds)} y el máximo es ${formatDuration(EVIDENCE_MAX_VIDEO_SECONDS)}. Elige un video más corto.` };
    }
  }
  return { ok: true, kind, message: null };
}
