import { ApolloServer } from 'apollo-server-express';
import { getServer } from '../../server';
import sinon from 'sinon';
import { ContextManager } from '../../context';
import { readClient } from '../../database/client';
import { GET_HIGHLIGHTS } from './highlights.graphql';

describe('Highlights on a SavedItem', () => {
  let server: ApolloServer;
  let contextStub;
  const userId = 1;
  const db = readClient();
  const now = new Date();
  const seedData = {
    user_annotations: [
      {
        // One highlight on an item
        annotation_id: 1,
        user_id: 1,
        item_id: 1,
        quote: "'We should rewrite it all,' said Pham.",
        patch: 'patch1',
        version: 1,
        updated_at: now,
        created_at: now,
      },
      {
        // > 1 annotations on an item
        annotation_id: 2,
        user_id: 1,
        item_id: 2,
        quote:
          'You and a thousand of your friends would have to work for a century or so to reproduce it.',
        patch: 'patch2',
        version: 1,
        updated_at: now,
        created_at: now,
      },
      {
        annotation_id: 3,
        user_id: 1,
        item_id: 2,
        quote: "The word for all this is 'mature programming environment.'",
        patch: 'patch3',
        version: 1,
        updated_at: now,
        created_at: now,
      },
    ],
    list: [
      { item_id: 1, user_id: 1 },
      { item_id: 2, user_id: 1 },
      { item_id: 3, user_id: 1 }, // no highlights
    ],
  };

  beforeAll(async () => {
    await db('user_annotations').truncate();
    await db('list').truncate();
    await Promise.all(
      Object.entries(seedData).map(([table, data]) => db(table).insert(data))
    );
    contextStub = sinon
      .stub(ContextManager.prototype, 'userId')
      .returns(userId);
    server = getServer();
  });
  afterAll(() => {
    contextStub.restore();
  });
  it('should return singleton Highlights array when a SavedItem has one highlight', async () => {
    const variables = { itemId: 1 };
    const res = await server.executeOperation({
      query: GET_HIGHLIGHTS,
      variables,
    });
  });
  it('should return an array of all highlights associated with a SavedItem', async () => {
    const variables = { itemId: 2 };
    const res = await server.executeOperation({
      query: GET_HIGHLIGHTS,
      variables,
    });
  });
  it(`should throw NOT_FOUND error when the ItemId is not in the User's list`, async () => {
    const variables = { itemId: 999 };
    const res = await server.executeOperation({
      query: GET_HIGHLIGHTS,
      variables,
    });
  });
  it('should return an empty Highlights array if there are no highlights on a SavedItem', async () => {
    const variables = { itemId: 3 };
    const res = await server.executeOperation({
      query: GET_HIGHLIGHTS,
      variables,
    });
  });
});
