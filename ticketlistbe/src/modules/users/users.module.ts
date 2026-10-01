import { Global, Module } from '@nestjs/common';
import { UsersRepository } from './users.repository.js';

@Global()
@Module({
  providers: [UsersRepository],
  exports: [UsersRepository],
})
export class UsersModule {}
