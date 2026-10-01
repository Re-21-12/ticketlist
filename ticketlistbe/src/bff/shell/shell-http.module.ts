import { Module } from '@nestjs/common';
import { ShellController } from './shell.controller.js';
import { ShellService } from './shell.service.js';

@Module({
  controllers: [ShellController],
  providers: [ShellService],
  // El login responde el shell en la misma request (AuthController).
  exports: [ShellService],
})
export class ShellHttpModule {}
