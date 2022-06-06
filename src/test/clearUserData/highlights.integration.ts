import { seedData } from '../query/highlights-fixtures';
import { readClient } from '../../database/client';
import { HighlightsDataService } from '../../dataservices/highlights';

describe('clearUserData for Highlights data', () => {
  // Stubs/mocks
  // Variables/data
  const userId = 1;
  const db = readClient();
  const now = new Date();
  const testData = seedData(now);

  beforeAll(async () => {
    await Promise.all(
      Object.keys(testData).map((table) => db(table).truncate())
    );
    await Promise.all(
      Object.entries(testData).map(([table, data]) => db(table).insert(data))
    );
  });
  it('deletes all records for a user id', async () => {
    const highlightService = new HighlightsDataService({
      db: { readClient: db, writeClient: db },
      userId: userId.toString(),
      isPremium: true,
      apiId: '123',
    });
    await highlightService.clearUserData();
    const res = await db('user_annotations')
      .select()
      .where('user_id', userId)
      .pluck('user_id');

    expect(res.length).toEqual(0);
  });
  it('does not throw an error if there are no records to delete', async () => {
    const randomId = 8675309666;
    const highlightService = new HighlightsDataService({
      db: { readClient: db, writeClient: db },
      userId: randomId.toString(),
      isPremium: true,
      apiId: '123',
    });
    const res = await db('user_annotations')
      .select()
      .where('user_id', randomId)
      .pluck('user_id');
    await highlightService.clearUserData();
    expect(res.length).toEqual(0);
  });
});
