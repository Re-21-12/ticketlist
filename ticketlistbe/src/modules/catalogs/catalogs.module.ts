import { Module } from '@nestjs/common';
import { CatalogsController } from './catalogs.controller.js';
import { CatalogsRepository } from './catalogs.repository.js';
import { CatalogsService } from './catalogs.service.js';

/** Catálogos: repositorio + servicio + transporte (`/api/catalogs`). Nadie más los lee todavía. */
@Module({
  controllers: [CatalogsController],
  providers: [CatalogsRepository, CatalogsService],
  exports: [CatalogsService],
})
export class CatalogsModule {}
