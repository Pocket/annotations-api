import { ApolloServer } from 'apollo-server-express';
import { getServer } from '../../server';
import sinon from 'sinon';
import { ContextManager } from '../../context';
import { readClient } from '../../database/client';
import { seedData } from '../query/highlights-fixtures';
import { UPDATE_HIGHLIGHT } from './highlights-mutations';
import { HighlightEntity, HighlightInput } from '../../types';

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
  beforeAll(async () => {
    contextStub = sinon.stub(ContextManager.prototype, 'userId').value(userId);
    server = getServer();
  });
  afterAll(() => {
    contextStub.restore();
  });
  beforeEach(async () => {
    await truncateAndSeed();
  });
  it('should update an existing highlight owned by the user', async () => {
    const variables: { id: string; input: HighlightInput[] } = {
      id: '1',
      input: [
        {
          itemId: '1',
          version: 2,
          patch: 'Prow scuttle parrel',
          quote: 'provost Sail ho shrouds spirits boom',
        },
      ],
    };
    const res = await server.executeOperation({
      query: UPDATE_HIGHLIGHT,
      variables,
    });
    const dbRow = await db<HighlightEntity>('user_annotations')
      .select()
      .where('annotation_id', variables.id);
  });
  it('should throw a NOT_FOUND error if the annotation_id does not exist', async () => {
    const variables: { id: string; input: HighlightInput[] } = {
      id: '999',
      input: [
        {
          itemId: '1',
          version: 2,
          patch: 'Prow scuttle parrel',
          quote: 'provost Sail ho shrouds spirits boom',
        },
      ],
    };
    const res = await server.executeOperation({
      query: UPDATE_HIGHLIGHT,
      variables,
    });
  });
  it('should throw a NOT_FOUND error if the annotation_id is not owned by the user, and not update', async () => {
    await db('user_annotations').insert({
      annotation_id: 55,
      user_id: 2,
      item_id: 2,
      patch: 'Prow scuttle parrel',
      quote: 'provost Sail ho shrouds spirits boom',
      version: 1,
      status: 1,
      updated_at: now,
      created_at: now,
    });
    const variables: { id: string; input: HighlightInput[] } = {
      id: '55',
      input: [
        {
          itemId: '2',
          version: 2,
          patch: 'wherry doubloon chase',
          quote: 'Belay yo-ho-ho keelhaul squiffy black spot',
        },
      ],
    };
    const res = await server.executeOperation({
      query: UPDATE_HIGHLIGHT,
      variables,
    });
    const dbRow = await db<HighlightEntity>('user_annotations')
      .select()
      .where('annotation_id', variables.id);
  });
});
