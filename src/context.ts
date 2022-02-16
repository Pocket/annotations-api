import { Knex } from 'knex';
import { HighlightNote } from './types';
import DataLoader from 'dataloader';
import { AuthenticationError } from 'apollo-server-errors';
import { Request } from 'express';
import { dynamoClient, readClient, writeClient } from './database/client';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { createNotesLoader } from './dataservices/dataloaders';

export interface IContext {
  userId: string;
  isPremium: boolean;
  db: {
    readClient: Knex;
    writeClient: Knex;
  };
  dynamoClient: DynamoDBClient;
  dataLoaders: {
    noteByHighlightId: DataLoader<string, HighlightNote | undefined>;
  };
}

export class ContextManager implements IContext {
  public readonly db: IContext['db'];
  public readonly dataLoaders: IContext['dataLoaders'];

  constructor(
    private config: {
      request: any;
      db: { readClient: Knex; writeClient: Knex };
      dynamoClient: DynamoDBClient;
    }
  ) {
    this.db = config.db;
    this.config = config;
    this.dynamoClient = config.dynamoClient;
    this.dataLoaders = {
      noteByHighlightId: createNotesLoader(config.dynamoClient),
    };
  }
  dynamoClient: DynamoDBClient;
  get isPremium(): boolean {
    // Using getter to make it easier to stub in tests
    return this.config.request?.headers.premium ?? false;
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
    dynamoClient: dynamoClient(),
  });
}
