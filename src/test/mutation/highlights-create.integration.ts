import { ApolloServer } from 'apollo-server-express';
import { getServer } from '../../server';
import sinon from 'sinon';
import { ContextManager } from '../../context';
import { readClient } from '../../database/client';
import { seedData } from '../query/highlights-fixtures';
import { CREATE_HIGHLIGHTS } from './highlights-mutations';
import { HighlightInput } from '../../types';

describe('Highlights creation', () => {
  let server: ApolloServer;
  let contextStub;
  let premiumStub;
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

      expect(result.length).toEqual(1);
      expect(result[0].quote).toBe('provost Sail ho shrouds spirits boom');
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
      }
    );
  });
});
