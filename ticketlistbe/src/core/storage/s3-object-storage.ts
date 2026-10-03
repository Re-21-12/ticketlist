import { Logger, type OnModuleInit } from '@nestjs/common';
import * as Minio from 'minio';
import type { IObjectStorage } from './object-storage.js';

export interface IS3Options {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region?: string;
}

/**
 * Almacén sobre MinIO / S3 (mismo cliente `minio` que wallet-api). Al arrancar crea el bucket si no existe (idempotente) y
 * un fallo ahí NO tumba la API: `healthy()` lo reporta en `/api/health/ready` y cada subida falla con su propio error.
 * Los objetos son PRIVADOS: solo la API los lee y los entrega tras comprobar el permiso sobre el ticket.
 */
export class S3ObjectStorage implements IObjectStorage, OnModuleInit {
  private readonly logger = new Logger('ObjectStorage');
  private readonly client: Minio.Client;
  private ready = false;

  constructor(private readonly options: IS3Options) {
    this.client = new Minio.Client({
      endPoint: options.endPoint,
      port: options.port,
      useSSL: options.useSSL,
      accessKey: options.accessKey,
      secretKey: options.secretKey,
      ...(options.region ? { region: options.region } : {}),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucket().catch((error: unknown) => this.logger.error(`No se pudo preparar el bucket «${this.options.bucket}»: ${error instanceof Error ? error.message : String(error)}`));
  }

  private async ensureBucket(): Promise<void> {
    if (this.ready) return;
    if (!(await this.client.bucketExists(this.options.bucket))) {
      await this.client.makeBucket(this.options.bucket, this.options.region ?? '');
      this.logger.log(`Bucket «${this.options.bucket}» creado`);
    }
    this.ready = true;
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    await this.ensureBucket();
    await this.client.putObject(this.options.bucket, key, data, data.length, { 'Content-Type': contentType });
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const stream = await this.client.getObject(this.options.bucket, key);
      return await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
    } catch (error) {
      // Un objeto que no existe es una ausencia normal; cualquier otra falla se propaga.
      if ((error as { code?: string }).code === 'NoSuchKey') return null;
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    await this.client.removeObject(this.options.bucket, key);
  }

  async healthy(): Promise<boolean> {
    try {
      await this.ensureBucket();
      return true;
    } catch {
      return false;
    }
  }
}
