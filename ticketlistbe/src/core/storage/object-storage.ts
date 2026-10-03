/** Token de inyección del almacén de objetos (bucket). */
export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

/**
 * Almacén de objetos (bucket S3-compatible): ahí vive el CONTENIDO de la evidencia de los tickets; en la base solo queda
 * su metadata. Dos implementaciones: `MemoryObjectStorage` (desarrollo y pruebas) y `S3ObjectStorage` (MinIO/S3, como
 * wallet-api). Una clave NUNCA sale del cliente: la arma el servidor (`tickets/<ticket>/<id>`).
 */
export interface IObjectStorage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  /** `null` si el objeto no existe. */
  get(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
  /** ¿El bucket responde? (`/api/health/ready`). */
  healthy(): Promise<boolean>;
}
