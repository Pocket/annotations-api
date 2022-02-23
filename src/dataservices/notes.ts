import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandOutput,
  BatchGetCommand,
  BatchGetCommandInput,
  BatchGetCommandOutput,
  BatchWriteCommand,
  BatchWriteCommandInput,
  BatchWriteCommandOutput,
  PutCommand,
  PutCommandOutput,
} from '@aws-sdk/lib-dynamodb';
import config from '../config';
import { Highlight, HighlightNote, HighlightNoteEntity } from '../types';
import { backoff } from './utils';
import { IContext } from '../context';
import { ForbiddenError } from 'apollo-server-errors';

export class NotesDataService {
  // Easier to work with Document client since it abstracts the types
  public dynamo: DynamoDBDocumentClient;
  private table = config.dynamoDb.notesTable;

  constructor(private client: DynamoDBClient, private context: IContext) {
    if (!this.context.isPremium) {
      throw new ForbiddenError(
        'Premium account required to access this feature'
      );
    }

    const dynamoClientConfig: DynamoDBClientConfig = {
      region: config.aws.region,
    };
    // Set endpoint for local client, otherwise provider default
    if (config.aws.endpoint != null) {
      dynamoClientConfig['endpoint'] = config.aws.endpoint;
    }
    this.client = new DynamoDBClient(dynamoClientConfig);
    this.dynamo = DynamoDBDocumentClient.from(this.client, {
      marshallOptions: {
        convertEmptyValues: true,
        removeUndefinedValues: true,
      },
    });
  }

  private toGraphQl(response: HighlightNoteEntity): HighlightNote {
    return {
      highlightId: response[this.table.key],
      text: response[this.table.note],
      _createdAt: response[this.table._createdAt],
      _updatedAt: response[this.table._updatedAt],
    };
  }

  private toEntity(id: string, text: string): HighlightNoteEntity {
    const timeStamp = new Date().getTime() / 1000;
    const noteEntity = {
      [this.table.key]: id,
      [this.table.note]: text,
      [this.table._createdAt]: timeStamp,
      [this.table._updatedAt]: timeStamp,
    } as HighlightNoteEntity;
    return noteEntity;
  }

  /**
   * Fetch a note attached to a highlight
   * @param id the highlight's id (annotation_id in the Pocket db)
   * @returns HighlightNote, or null if one does not exist for the highlightId
   */
  public async get(id: string): Promise<HighlightNote | null> {
    const getItemCommand = new GetCommand({
      TableName: this.table.name,
      Key: { [this.table.key]: id },
      ProjectionExpression: [
        this.table.note,
        this.table._createdAt,
        this.table._updatedAt,
        this.table.key,
      ].join(','),
    });
    const response: GetCommandOutput = await this.dynamo.send(getItemCommand);
    if (response?.Item != null) {
      return this.toGraphQl(response.Item as HighlightNoteEntity);
    }
    return null;
  }
  /**
   * Fetch a batch of notes attached to a highlight
   * @param ids array of highlight's ids to fetch (annotation_id in the Pocket db)
   * @returns array of HighlightNote objects
   */
  public async getMany(ids: string[]): Promise<Array<HighlightNote>> {
    const keyList = ids.map((id) => ({ [this.table.key]: id }));
    let unprocessedKeys: BatchGetCommandInput['RequestItems'] = {
      [this.table.name]: {
        Keys: keyList,
      },
    };
    let tries = 0;
    const itemResults: HighlightNoteEntity[] = [];
    // Make requests until entire batch is completed, since size limits
    // may require multiple batch requests
    while (unprocessedKeys) {
      const batchItemCommand = new BatchGetCommand({
        RequestItems: unprocessedKeys,
      });
      // Exponential backoff between requests
      if (tries > 0) {
        await backoff(tries, config.aws.maxBackoff);
      }
      const response: BatchGetCommandOutput = await this.dynamo.send(
        batchItemCommand
      );
      if (response.Responses) {
        itemResults.push(
          ...(response.Responses?.[this.table.name] as HighlightNoteEntity[])
        );
      }
      // Increment tries for backoff, and reset unprocessed key list
      tries += 1;
      // Might get an empty object which is truthy in JS...
      if (
        response.UnprocessedKeys &&
        Object.keys(response.UnprocessedKeys).length > 0
      ) {
        unprocessedKeys = response.UnprocessedKeys;
      } else {
        unprocessedKeys = undefined;
      }
    }
    return itemResults.map((item) => this.toGraphQl(item));
  }

  public async create(id: string, text: string): Promise<HighlightNote> {
    const noteEntity = this.toEntity(id, text);
    const putItemCommand = new PutCommand({
      Item: noteEntity,
      TableName: this.table.name,
    });

    const response: PutCommandOutput = await this.dynamo.send(putItemCommand);
    if (response?.$metadata.httpStatusCode === 200) {
      return this.toGraphQl(noteEntity as HighlightNoteEntity);
    }
    throw new Error(
      `Unable to create highlight note (dynamoDB request ID = ${response?.$metadata.requestId}`
    );
  }

  // public async batchWrite(
  //   notes: { id: string; text: string }[]
  // ): Promise<HighlightNote[]> {
  //   const noteRequests = notes.map((note) => {
  //     return {
  //       PutRequest: {
  //         Item: this.toEntity(note.id, note.text),
  //       },
  //     };
  //   });
  //   const batchWriteCommand = new BatchWriteCommand({
  //     RequestItems: {
  //       [this.table.name]: noteRequests,
  //     },
  //   });
  // }
}
