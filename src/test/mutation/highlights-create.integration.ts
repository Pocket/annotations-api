import { ApolloServer } from 'apollo-server-express';
import { getServer } from '../../server';
import sinon from 'sinon';
import { ContextManager } from '../../context';
import { readClient } from '../../database/client';
import { seedData } from '../query/highlights-fixtures';
import {
  CREATE_HIGHLIGHTS,
  CREATE_HIGHLIGHTS_WITH_NOTE,
} from './highlights-mutations';
import { HighlightInput } from '../../types';
describe('Highlights creation', () => {
  let server: ApolloServer;
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
  afterAll(() => {
    contextStub.restore();
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
      const res = await server.executeOperation({
        query: CREATE_HIGHLIGHTS,
        variables,
      });
      const result = res.data?.createSavedItemHighlights;

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
      const res = await server.executeOperation({
        query: CREATE_HIGHLIGHTS,
        variables,
      });

      const result = res.data?.createSavedItemHighlights;

      expect(result.length).toEqual(1);
      expect(result[0].quote).toBe('provost Sail ho shrouds spirits boom');
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
      const res = await server.executeOperation({
        query: CREATE_HIGHLIGHTS,
        variables,
      });

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
      const res = await server.executeOperation({
        query: CREATE_HIGHLIGHTS,
        variables,
      });
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
      const res = await server.executeOperation({
        query: CREATE_HIGHLIGHTS,
        variables,
      });
      expect(res.errors).toBeUndefined;
      expect(res.data).toBeTruthy();
      expect(res.data?.createSavedItemHighlights.length).toEqual(1);
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
      const res = await server.executeOperation({
        query: CREATE_HIGHLIGHTS_WITH_NOTE,
        variables,
      });
      const result = res.data?.createSavedItemHighlights;

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
      const res = await server.executeOperation({
        query: CREATE_HIGHLIGHTS_WITH_NOTE,
        variables,
      });
      const result = res.data?.createSavedItemHighlights;

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
      const res = await server.executeOperation({
        query: CREATE_HIGHLIGHTS,
        variables,
      });
      const result = res.data?.createSavedItemHighlights;

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
        const res = await server.executeOperation({
          query: CREATE_HIGHLIGHTS,
          variables,
        });
        const result = res.data?.createSavedItemHighlights;

        expect(result.length).toEqual(2);
        const expectedQuotes = variables.input.map((_) => _.quote);
        const actualQuotes = result.map((_) => _.quote);
        expect(actualQuotes).toEqual(expect.arrayContaining(expectedQuotes));
      }
    );
  });
});
