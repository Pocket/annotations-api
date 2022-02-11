import { Knex } from 'knex';
import { IContext } from '../context';
import { Highlight, HighlightEntity, HighlightInput } from '../types';
import { NotFoundError } from '@pocket-tools/apollo-utils';
import { v4 as uuid } from 'uuid';

export class HighlightsDataService {
  public readonly userId: string;
  public readonly readDb: Knex;
  public readonly writeDb: Knex;
  constructor(context: IContext) {
    this.userId = context.userId;
    this.readDb = context.db.readClient;
    this.writeDb = context.db.writeClient;
  }
  private toGraphql(entity: HighlightEntity): Highlight {
    return {
      id: entity.annotation_id,
      quote: entity.quote,
      patch: entity.patch,
      version: entity.version,
      _createdAt: entity.created_at.getTime() / 1000,
      _updatedAt: entity.updated_at.getTime() / 1000,
    };
  }

  /**
   * Convert Create or Update highlight input to database entity
   * that can be inserted/updated.
   * Status is set to 1, so should not be used to delete or modify
   * deleted highlights.
   * If an ID is not provided, a UUID will be auto-generated.
   * @param input HighlightInput from create or update mutation
   * @param id Optional string ID, for updating an existing highlight.
   * If provided, will use this ID instead of generating a new one.
   * @returns HighlightEntity object (minus DB default fields created_at
   * and updated_at) which can be used for insert/updating the highlight
   * entry in the table.
   */
  private toDbEntity(
    input: HighlightInput,
    id?: string
  ): Omit<HighlightEntity, 'created_at' | 'updated_at'> {
    return {
      annotation_id: id ?? uuid(),
      user_id: parseInt(this.userId),
      item_id: parseInt(input.itemId),
      quote: input.quote,
      patch: input.patch,
      version: input.version,
      status: 1,
    };
  }

  /**
   * Get highlights associated with an item in a user's list
   * @param itemid the itemId in the user's list
   * @throws NotFoundError if the itemId doesn't exist in the user's list
   * Get highlights associated with an item in a user's list
   * @param itemid the itemId in the user's list
   * @returns a list of Highlights associated to the itemId, or an empty list
   * if there are no highlights on a given itemId
   */
  async getHighlightsByItemId(itemId: string): Promise<Highlight[]> {
    const rows = await this.readDb<HighlightEntity>('user_annotations')
      .select()
      .where('item_id', itemId)
      .andWhere('user_id', this.userId)
      .andWhere('status', 1);

    if (rows.length > 0) {
      return rows.map(this.toGraphql);
    }
    return [];
  }

  async deleteHighlightById(highlightId: string): Promise<string> {
    // This will throw and error if it doesn't like you
    const rowCount = await this.writeDb<HighlightEntity>('user_annotations')
      .update({ status: 0 })
      .where('user_id', this.userId)
      .andWhere('annotation_id', highlightId);

    // If no row is found throw an error
    if (!rowCount) throw new NotFoundError('hightlight not found');

    return highlightId;
  }
}
