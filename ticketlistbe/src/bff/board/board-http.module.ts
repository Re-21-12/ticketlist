import { Module } from '@nestjs/common';
import { TicketsModule } from '../../modules/tickets/tickets.module.js';
import { BoardController } from './board.controller.js';
import { BoardService } from './board.service.js';

@Module({
  imports: [TicketsModule],
  controllers: [BoardController],
  providers: [BoardService],
})
export class BoardHttpModule {}
