import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiZodResponse } from '../../core/decorators/api-zod.decorator.js';
import { EAbility } from '../../modules/auth/casl/ability.enum.js';
import { CheckAbility } from '../../modules/auth/casl/check-ability.decorator.js';
import { BoardService } from './board.service.js';
import { BoardResponseSchema, type TBoardResponse } from './dtos/board-response.dto.js';

@ApiTags('BFF')
@Controller('bff/board')
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  @Get()
  @CheckAbility(EAbility.READ, 'Ticket')
  @ApiZodResponse(200, BoardResponseSchema)
  getBoard(): Promise<TBoardResponse> {
    return this.boardService.getBoard();
  }
}
