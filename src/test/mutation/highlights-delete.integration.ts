import { ApolloServer } from 'apollo-server-express';
import { getServer } from '../../server';
import sinon from 'sinon';
import { ContextManager } from '../../context';
import { readClient } from '../../database/client';
import { seedData } from '../query/highlights-fixtures';
import { DELETE_HIGHLIGHT } from './highlights-mutations';
import { HighlightEntity } from '../../types';

describe('Highlights creation', () => {
  let server: ApolloServer;
  let contextStub;
  const userId = 1;
  const db = readClient();
  const now = new Date();
  const testData = seedData(now);
  const truncateAndSeed = async () => {
    await Promise.all(
      Object.keys(testData).map((table) => db(table).truncate())
    );
    await Promise.all(
      Object.entries(testData).map(([table, data]) => db(table).insert(data))
    );
  };

  beforeAll(() => {
    contextStub = sinon.stub(ContextManager.prototype, 'userId').value(userId);
    server = getServer();
  });

  beforeEach(async () => {
    await truncateAndSeed();
  });

  afterAll(() => {
    contextStub.restore();
  });

  it('should delete an existing highlight', async () => {
    const variables = { id: '1' };
    const res = await server.executeOperation({
      query: DELETE_HIGHLIGHT,
      variables,
    });
    const dbRecord = await db<HighlightEntity>('user_annotations')
      .select()
      .where('annotation_id', variables.id);

    expect(res).toBeTruthy();
    expect(res?.data?.deleteSavedItemHighlight).toBe(variables.id);
    expect(dbRecord[0].status).toBe(0);
  });

  it('should throw NOT_FOUND error if the highlight ID does not exist', async () => {
    const variables = { id: '999' };
    const res = await server.executeOperation({
      query: DELETE_HIGHLIGHT,
      variables,
    });

    expect(res?.errors).toBeTruthy();

    if (res?.errors) {
      expect(res?.errors[0].message).toBe(
        'Error - Not Found: hightlight not found'
      );
    }
  });
});
