import { Global, Module } from '@nestjs/common';
import { PersistenceService } from './persistence.service.js';

/** Persistencia TypeORM compartida por todos los repositorios (global: ninguno tiene que importarla). */
@Global()
@Module({ providers: [PersistenceService], exports: [PersistenceService] })
export class DatabaseModule {}
