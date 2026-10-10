import { Global, Module } from '@nestjs/common';

import { createDb, type Database } from './client.js';

export const DB = Symbol('DB');

@Global()
@Module({
  providers: [{ provide: DB, useFactory: (): Database => createDb(process.env.DATABASE_URL!) }],
  exports: [DB],
})
export class DbModule {}
