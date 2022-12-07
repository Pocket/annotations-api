import { ApolloServer } from '@apollo/server';
import { getServer } from '../../server';
import sinon from 'sinon';
import { ContextManager, getMockContextManager, IContext } from '../../context';
import { readClient } from '../../database/client';
import { seedData } from '../query/highlights-fixtures';
import {
  CREATE_HIGHLIGHTS,
  CREATE_HIGHLIGHTS_WITH_NOTE,
} from './highlights-mutations';
import { Highlight, HighlightInput } from '../../types';
import { UsersMeta } from '../../dataservices/usersMeta';
import { mysqlTimeString } from '../../dataservices/utils';
import config from '../../config';
import assert from 'assert';
// import { GraphQLResponseBody } from '@apollo/server/dist/esm/externalTypes/graphql';

/**
 * executeOperation proposal
 *
 * continue using server.executeOperation, providing it with a
 * real context object with mocks replacing any class members
 * that access the express.Request
 */
describe('Highlights creation', () => {
  let server: ApolloServer<IContext>;
  // Stubs/mocks
  let contextStub;
  let premiumStub;
  // Variables/data
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
  afterAll(async () => {
    contextStub.restore();
    await db.destroy();
  });
  describe('any user', () => {
    beforeEach(async () => {
      await truncateAndSeed();
    });
    beforeAll(() => {
      premiumStub = sinon
        .stub(ContextManager.prototype, 'isPremium')
        .value(false);
    });
    afterAll(() => premiumStub.restore());
    it('should create a highlight on a SavedItem without any existing highlights', async () => {
      const variables: { input: HighlightInput[] } = {
        input: [
          {
            itemId: '3',
            version: 2,
            patch: 'Prow scuttle parrel',
            quote: 'provost Sail ho shrouds spirits boom',
          },
        ],
      };
      /*
      Notes:
      The server has changed a good bit architecturally. The server is now more
      of a plugin for HTTP servers, rather than having internal plugins that act
      as a HTTP server. They've probably done this to simplify their plugin
      interfaces more stable, but everything that touches an Express.Request (or
      anything HTTP really) is external to the ApolloServer.  Consequently, this
      parts of ContextManager or the entire context value have to be mocked.

      executeOperation also now handles @defer, and returns a discriminated union
      that may be a single result or an async iterator.
      */
      const { body } = await server.executeOperation(
        {
          query: CREATE_HIGHLIGHTS,
          variables,
        },
        {
          // context value must be manually provided
          contextValue: getMockContextManager(),
        }
      );
      /*
      this assert specifies to typescript that the response is not using
      a query that uses @defer.

      (body as Extract<GraphQLResponseBody, { kind: 'single' }>).singleResult
      is also viable if we don't want to use node assert, but isn't any more
      readable. This type is not defined and exported and must be extracted
      from the union if we want to use it.
      */
      assert(body.kind === 'single');

      // body could be typed using GraphQLResponseBody<mutationType> instead if
      // mutation types were available, casting instead.
      const result = body.singleResult.data?.createSavedItemHighlights as [
        Highlight
      ];

      // Check the whole object and its fields
      const expectedHighlight = {
        version: 2,
        patch: 'Prow scuttle parrel',
        quote: 'provost Sail ho shrouds spirits boom',
      };
      expect(result.length).toEqual(1);
      expect(result[0]).toEqual(expect.objectContaining(expectedHighlight));
      // Check properties we don't know ahead of time
      expect(typeof result[0].id).toBe('string');
      expect(result[0].id).toBeTruthy();
      // CreatedAt and updatedAt are set on the DB server so difficult to mock
      expect(typeof result[0]._createdAt).toBe('number');
      expect(typeof result[0]._updatedAt).toBe('number');
      expect(result[0]._createdAt).toBeTruthy();
      expect(result[0]._updatedAt).toBeTruthy();
    });
    it('should create a highlight on a SavedItem with existing highlights', async () => {
      const variables: { input: HighlightInput[] } = {
        input: [
          {
            itemId: '1',
            version: 2,
            patch: 'Prow scuttle parrel',
            quote: 'provost Sail ho shrouds spirits boom',
          },
        ],
      };
      const { body } = await server.executeOperation(
        {
          query: CREATE_HIGHLIGHTS,
          variables,
        },
        {
          contextValue: getMockContextManager(),
        }
      );
      assert(body.kind === 'single');
      const result = body.singleResult.data?.createSavedItemHighlights as [
        Highlight
      ];

      expect(result.length).toEqual(1);
      expect(result[0].quote).toBe('provost Sail ho shrouds spirits boom');
    });

    it('should mark the list item as updated and log the highlight mutation', async () => {
      const updateDate = new Date(2022, 3, 3);
      const clock = sinon.useFakeTimers({
        now: updateDate,
        shouldAdvanceTime: false,
      });

      const variables: { input: HighlightInput[] } = {
        input: [
          {
            itemId: '3',
            version: 2,
            patch: 'Prow scuttle parrel',
            quote: 'provost Sail ho shrouds spirits boom',
          },
        ],
      };
      await server.executeOperation(
        {
          query: CREATE_HIGHLIGHTS,
          variables,
        },
        {
          contextValue: getMockContextManager(),
        }
      );

      const usersMetaRecord = await db('users_meta')
        .where({ user_id: '1', property: UsersMeta.propertiesMap.account })
        .pluck('value');

      const listRecord = await db('list')
        .where({ user_id: '1', item_id: '3' })
        .pluck('time_updated');

      expect(mysqlTimeString(listRecord[0])).toEqual(
        mysqlTimeString(updateDate, config.database.tz)
      );
      expect(usersMetaRecord[0]).toEqual(
        mysqlTimeString(updateDate, config.database.tz)
      );

      clock.restore();
    });
  });
  describe('non-premium users', () => {
    beforeAll(() => {
      premiumStub = sinon
        .stub(ContextManager.prototype, 'isPremium')
        .value(false);
    });
    afterAll(() => premiumStub.restore());
    beforeEach(async () => {
      await truncateAndSeed();
    });
    it('should not allow non-premium users to create more than three highlights at once', async () => {
      const variables: { input: HighlightInput[] } = {
        input: [
          {
            itemId: '3',
            version: 2,
            patch: 'Prow scuttle parrel',
            quote: 'provost Sail ho shrouds spirits boom',
          },
          {
            itemId: '3',
            version: 2,
            patch: 'hempen jig carouser',
            quote: 'Bring a spring upon her cable holystone',
          },
          {
            itemId: '3',
            version: 2,
            patch: 'Swab barque interloper',
            quote: 'chantey doubloon starboard grog black jack',
          },
          {
            itemId: '3',
            version: 2,
            patch: 'Trysail Sail ho',
            quote: 'Corsair red ensign hulk smartly boom jib rum',
          },
        ],
      };
      const { body } = await server.executeOperation(
        {
          query: CREATE_HIGHLIGHTS,
          variables,
        },
        {
          contextValue: getMockContextManager(),
        }
      );
      assert(body.kind === 'single');
      const res = body.singleResult;

      expect(res.errors).not.toBeUndefined;
      expect(res.errors!.length).toEqual(1);
      expect(res.errors![0].extensions?.code).toEqual('BAD_USER_INPUT');
      expect(res.errors![0].message).toContain('Too many highlights');
    });
    it('should not allow non-premium users to create additional highlights on a SavedItem that already has highlights, if it would put them over the three-highlight limit', async () => {
      const variables: { input: HighlightInput[] } = {
        input: [
          {
            itemId: '2',
            version: 2,
            patch: 'Prow scuttle parrel',
            quote: 'provost Sail ho shrouds spirits boom',
          },
          {
            itemId: '2',
            version: 2,
            patch: 'hempen jig carouser',
            quote: 'Bring a spring upon her cable holystone',
          },
        ],
      };
      const { body } = await server.executeOperation(
        {
          query: CREATE_HIGHLIGHTS,
          variables,
        },
        {
          contextValue: getMockContextManager(),
        }
      );
      assert(body.kind === 'single');
      const res = body.singleResult;

      expect(res.errors).not.toBeUndefined;
      expect(res.errors!.length).toEqual(1);
      expect(res.errors![0].extensions?.code).toEqual('BAD_USER_INPUT');
      expect(res.errors![0].message).toContain('Too many highlights');
    });
    it('should not include deleted highlights in the limit', async () => {
      const variables: { input: HighlightInput[] } = {
        input: [
          {
            itemId: '2',
            version: 2,
            patch: 'Prow scuttle parrel',
            quote: 'provost Sail ho shrouds spirits boom',
          },
        ],
      };
      const { body } = await server.executeOperation(
        {
          query: CREATE_HIGHLIGHTS,
          variables,
        },
        {
          contextValue: getMockContextManager(),
        }
      );
      assert(body.kind === 'single');
      const res = body.singleResult;

      expect(res.errors).toBeUndefined;
      expect(res.data).toBeTruthy();
      expect(
        (res.data?.createSavedItemHighlights as [Highlight]).length
      ).toEqual(1);
    });
  });
  describe('premium users', () => {
    beforeAll(() => {
      premiumStub = sinon
        .stub(ContextManager.prototype, 'isPremium')
        .value(true);
    });
    afterAll(() => premiumStub.restore());
    beforeEach(async () => {
      await truncateAndSeed();
    });
    it('should be able to create a note at the same time as a highlight', async () => {
      const variables: { input: HighlightInput[] } = {
        input: [
          {
            itemId: '3',
            version: 2,
            patch: 'Prow scuttle parrel',
            quote: 'provost Sail ho shrouds spirits boom',
            note: 'This is the coolest of notes',
          },
        ],
      };
      const { body } = await server.executeOperation(
        {
          query: CREATE_HIGHLIGHTS_WITH_NOTE,
          variables,
        },
        {
          contextValue: getMockContextManager(),
        }
      );
      assert(body.kind === 'single');
      const result = body.singleResult.data?.createSavedItemHighlights as [
        Highlight
      ];

      // Check the whole object and its fields
      const expectedHighlight = {
        version: 2,
        patch: 'Prow scuttle parrel',
        quote: 'provost Sail ho shrouds spirits boom',
        note: {
          text: 'This is the coolest of notes',
        },
      };
      expect(result.length).toEqual(1);
      expect(result[0]).toEqual(expect.objectContaining(expectedHighlight));
      // Check properties we don't know ahead of time
      expect(typeof result[0].id).toBe('string');
      expect(result[0].id).toBeTruthy();
      // CreatedAt and updatedAt are set on the DB server so difficult to mock
      expect(typeof result[0]._createdAt).toBe('number');
      expect(typeof result[0]._updatedAt).toBe('number');
      expect(result[0]._createdAt).toBeTruthy();
      expect(result[0]._updatedAt).toBeTruthy();
      expect(result[0].note?.text).toBe('This is the coolest of notes');
    });
    it('should create multiple highlights with and without notes', async () => {
      const variables: { input: HighlightInput[] } = {
        input: [
          {
            itemId: '3',
            version: 2,
            patch: 'Prow scuttle parrel',
            quote: 'provost Sail ho shrouds spirits boom',
            note: 'This is the coolest of notes',
          },
          {
            itemId: '2',
            version: 2,
            patch: 'Prow scuttle parrel',
            quote: 'provost Sail ho shrouds spirits boom',
          },
          {
            itemId: '2',
            version: 2,
            patch: 'Trysail Sail ho',
            quote: 'Corsair red ensign hulk smartly boom jib rum',
            note: 'An even cooler note???',
          },
        ],
      };
      const { body } = await server.executeOperation(
        {
          query: CREATE_HIGHLIGHTS_WITH_NOTE,
          variables,
        },
        {
          contextValue: getMockContextManager(),
        }
      );
      assert(body.kind === 'single');
      const result = body.singleResult.data
        ?.createSavedItemHighlights as Highlight[];

      expect(result.length).toEqual(3);
      expect(result[0].note?.text).toBe('This is the coolest of notes');
      expect(result[1].note).toBeNull();
      expect(result[2].note.text).toBe('An even cooler note???');
    });
    it('should not restrict the number of highlights a premium user can create at once', async () => {
      const variables: { input: HighlightInput[] } = {
        input: [
          {
            itemId: '3',
            version: 2,
            patch: 'Prow scuttle parrel',
            quote: 'provost Sail ho shrouds spirits boom',
          },
          {
            itemId: '3',
            version: 2,
            patch: 'hempen jig carouser',
            quote: 'Bring a spring upon her cable holystone',
          },
          {
            itemId: '3',
            version: 2,
            patch: 'Swab barque interloper',
            quote: 'chantey doubloon starboard grog black jack',
          },
          {
            itemId: '3',
            version: 2,
            patch: 'Trysail Sail ho',
            quote: 'Corsair red ensign hulk smartly boom jib rum',
          },
        ],
      };
      const { body } = await server.executeOperation(
        {
          query: CREATE_HIGHLIGHTS,
          variables,
        },
        {
          contextValue: getMockContextManager(),
        }
      );
      assert(body.kind === 'single');
      const result = body.singleResult.data
        ?.createSavedItemHighlights as Highlight[];

      expect(result.length).toEqual(4);
      const expectedQuotes = variables.input.map((_) => _.quote);
      const actualQuotes = result.map((_) => _.quote);
      expect(actualQuotes).toEqual(expect.arrayContaining(expectedQuotes));
    });
    it(
      'should not restrict the number of highlights a premium user can add to a SavedItem' +
        'that already has highlights',
      async () => {
        const variables: { input: HighlightInput[] } = {
          input: [
            {
              itemId: '2',
              version: 2,
              patch: 'Prow scuttle parrel',
              quote: 'provost Sail ho shrouds spirits boom',
            },
            {
              itemId: '2',
              version: 2,
              patch: 'hempen jig carouser',
              quote: 'Bring a spring upon her cable holystone',
            },
          ],
        };
        const { body } = await server.executeOperation(
          {
            query: CREATE_HIGHLIGHTS,
            variables,
          },
          {
            contextValue: getMockContextManager(),
          }
        );
        assert(body.kind === 'single');
        const result = body.singleResult.data
          ?.createSavedItemHighlights as Highlight[];

        expect(result.length).toEqual(2);
        const expectedQuotes = variables.input.map((_) => _.quote);
        const actualQuotes = result.map((_) => _.quote);
        expect(actualQuotes).toEqual(expect.arrayContaining(expectedQuotes));
      }
    );
  });
});
