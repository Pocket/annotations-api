import { Resource } from 'cdktf';
import { Construct } from 'constructs';
import { config } from './config';
import {
  ApplicationDynamoDBTable,
  ApplicationDynamoDBTableCapacityMode,
} from '@pocket-tools/terraform-modules';

export class DynamoDB extends Resource {
  public readonly highlightNotesTable: ApplicationDynamoDBTable;

  constructor(scope: Construct, name: string) {
    super(scope, name);
    this.highlightNotesTable = this.setupHighlightNotesTable();
  }

  /**
   * Sets up the dynamodb table where the notes for highlights will live
   * @private
   */
  private setupHighlightNotesTable() {
    // note that this config is mirrored in .docker/localstack/dynamodb/
    // if config changes here, that file should also be updated
    return new ApplicationDynamoDBTable(this, `highlight-notes`, {
      tags: config.tags,
      prefix: `${config.shortName}-${config.environment}-highlight-notes`,
      capacityMode: ApplicationDynamoDBTableCapacityMode.ON_DEMAND,
      tableConfig: {
        hashKey: 'highlightId',
        writeCapacity: 5,
        readCapacity: 5,
        attribute: [
          {
            name: 'highlightId',
            type: 'S',
          },
          {
            name: 'note',
            type: 'S',
          },
        ],
      },
    });
  }
}
