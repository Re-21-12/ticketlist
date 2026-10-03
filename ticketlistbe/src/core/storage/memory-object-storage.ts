import { Injectable } from '@nestjs/common';
import type { IObjectStorage } from './object-storage.js';

/** Almacén en memoria: desarrollo y pruebas. Se pierde al reiniciar; producción exige un bucket real (`S3_*`). */
@Injectable()
export class MemoryObjectStorage implements IObjectStorage {
  private readonly objects = new Map<string, Buffer>();

  put(key: string, data: Buffer): Promise<void> {
    this.objects.set(key, Buffer.from(data));
    return Promise.resolve();
  }

  get(key: string): Promise<Buffer | null> {
    const found = this.objects.get(key);
    return Promise.resolve(found ? Buffer.from(found) : null);
  }

  remove(key: string): Promise<void> {
    this.objects.delete(key);
    return Promise.resolve();
  }

  healthy(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
