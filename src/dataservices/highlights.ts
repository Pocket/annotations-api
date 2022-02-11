import { Knex } from 'knex';
import { IContext } from '../context';
import { Highlight, HighlightEntity, HighlightInput } from '../types';
import { v4 as uuid } from 'uuid';
import config from '../config';
import { UserInputError } from 'apollo-server-errors';
import { groupByCount, sumByKey } from '../utils/dataAggregation';

export class HighlightsDataService {
  public readonly userId: string;
  public readonly readDb: Knex;
  constructor(private context: IContext) {
    this.userId = context.userId;
    this.readDb = context.db.readClient;
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

  async highlightsCountByItemIds(
    itemIds: number[]
  ): Promise<{ [itemId: string]: number }> {
    const result = await this.readDb<HighlightEntity>('user_annotations')
      .select('item_id')
      .groupBy('item_id')
      .whereIn('item_id', itemIds)
      .andWhere('user_id', this.userId)
      .andWhere('status', 1)
      .count<{ item_id: string; count: number }[]>('* as count');
    return result.reduce((acc, row) => {
      acc[row.item_id.toString()] = row.count;
      return acc;
    }, {});
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

  async checkHighlightLimit(highlightInput: HighlightInput[]) {
    const additionalCounts = groupByCount(highlightInput, 'itemId');
    const uniqueItemIds = Object.keys(additionalCounts).map(parseInt);
    const currentCounts = await this.highlightsCountByItemIds(uniqueItemIds);
    const totalDesiredCounts = sumByKey(currentCounts, additionalCounts);
    const exceedsLimit = Object.entries(totalDesiredCounts).find(
      ([_, count]) => count > config.basicHighlightLimit
    );
    if (exceedsLimit != null) {
      throw new UserInputError(
        `Too many highlights for itemId: ${exceedsLimit[0]}`
      );
    }
  }

  async createHighlight(
    highlightInput: HighlightInput[]
  ): Promise<Highlight[]> {
    console.log('i did stuff');
    // Ensure non-premium users don't exceed highlight limits
    if (!this.context.isPremium) {
      await this.checkHighlightLimit(highlightInput);
    }

    const formattedHighlights = highlightInput.map((highlight) =>
      this.toDbEntity(highlight)
    );
    // Insert into the db
    await this.readDb<HighlightEntity>('user_annotations').insert(
      formattedHighlights
    );
    // Query back the inserted rows
    const rows = await this.readDb<HighlightEntity>('user_annotations')
      .select()
      .whereIn(
        'annotation_id',
        formattedHighlights.map((highlight) => highlight.annotation_id)
      );
    return rows.map(this.toGraphql);
  }
}
