import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandOutput,
  BatchGetCommand,
  BatchGetCommandInput,
  BatchGetCommandOutput,
} from '@aws-sdk/lib-dynamodb';
import config from '../config';
import { HighlightNote, HighlightNoteEntity } from '../types';
import { backoff } from './utils';

export class NotesDataService {
  private client: DynamoDBClient;
  // Easier to work with Document client since it abstracts the types
  public dynamo: DynamoDBDocumentClient;
  private table = config.dynamoDb.notesTable;

  constructor() {
    const dynamoClientConfig: DynamoDBClientConfig = {
      region: config.aws.region,
    };
    // Set endpoint for local client, otherwise provider default
    if (config.aws.endpoint != null) {
      dynamoClientConfig['endpoint'] = config.aws.endpoint;
    }
    this.client = new DynamoDBClient(dynamoClientConfig);
    this.dynamo = DynamoDBDocumentClient.from(this.client, {
      marshallOptions: { convertEmptyValues: true },
    });
  }

  /**
   * Destroy underlying DynamoDB client
   */
  public destroy() {
    this.client.destroy();
  }

  private toGraphQl(response: HighlightNoteEntity): HighlightNote {
    return {
      text: response[this.table.note],
      _createdAt: response[this.table._createdAt],
      _updatedAt: response[this.table._updatedAt],
    };
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
      ].join(','),
    });
    const response: GetCommandOutput = await this.dynamo.send(getItemCommand);
    if (response?.Item != null) {
      return this.toGraphQl(response.Item as HighlightNoteEntity);
    }
    return null;
  }

  public async getMany(ids: string[]): Promise<HighlightNote[] | null> {
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
        await backoff(tries, 3000);
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
      unprocessedKeys = response.UnprocessedKeys;
    }
    return itemResults.map((item) => this.toGraphQl(item));
  }
}
