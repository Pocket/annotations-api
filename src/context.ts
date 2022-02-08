import { Knex } from 'knex';
// import { Highlight } from './types';
// import DataLoader from 'dataloader';
import { AuthenticationError } from 'apollo-server-errors';
import { Request } from 'express';
import { readClient, writeClient } from './database/client';

export interface IContext {
  userId: string;
  db: {
    readClient: Knex;
    writeClient: Knex;
  };
  //   dataLoaders: {
  //     highlightsByItemId: DataLoader<string, Highlight>;
  //   };
}

export class ContextManager implements IContext {
  //   public readonly dataLoaders: IContext['dataLoaders'];
  public readonly db: IContext['db'];

  constructor(
    private config: {
      request: any;
      db: { readClient: Knex; writeClient: Knex };
    }
  ) {
    this.db = config.db;
  }
  get userId(): string {
    const userId = this.config.request.headers.userid;

    if (!userId) {
      throw new AuthenticationError(
        'You must be logged in to use this service'
      );
    }

    return userId instanceof Array ? userId[0] : userId;
  }
}

/**
 * Context factory function. Creates a new context upon
 * every request
 * @param req server request
 * @param emitter a pre-initialized itemsEventEmitter
 * @returns ContextManager
 */
export function getContext(req: Request): ContextManager {
  return new ContextManager({
    request: req,
    db: {
      readClient: readClient(),
      writeClient: writeClient(),
    },
  });
}
