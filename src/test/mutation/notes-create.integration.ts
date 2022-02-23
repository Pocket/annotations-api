import { ApolloServer } from 'apollo-server-express';
import { getServer } from '../../server';
import sinon from 'sinon';
import { ContextManager } from '../../context';
import { readClient } from '../../database/client';
import { seedData } from '../query/highlights-fixtures';
import { CREATE_NOTE } from './notes-mutations';
import { NoteInput } from '../../types';

describe('Notes creation', () => {
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
  beforeEach(async () => {
    await truncateAndSeed();
  });
  afterAll(() => {
    contextStub.restore();
  });
  describe('for premium users', () => {
    beforeAll(() => {
      premiumStub = sinon
        .stub(ContextManager.prototype, 'isPremium')
        .value(true);
    });
    afterAll(() => premiumStub.restore());
    it('adds a note to an existing higlight', async () => {
      const variables: NoteInput = {
        id: '3',
        input: 'sweeter than a bucket full of strawberries',
      };
      const res = await server.executeOperation({
        query: CREATE_NOTE,
        variables,
      });
      const result = res.data?.createSavedItemHighlightNote;
      const expectedHighlight = {
        text: 'sweeter than a bucket full of strawberries',
      };
      expect(result).toEqual(expect.objectContaining(expectedHighlight));
    });
    it('returns NOT_FOUND if the highlight does not exist', async () => {
      const variables: NoteInput = {
        id: '99999',
        input: 'sweeter than a bucket full of strawberries',
      };
      const res = await server.executeOperation({
        query: CREATE_NOTE,
        variables,
      });

      expect(res.data?.createSavedItemHighlightNote).toBeNull();
      expect(res.errors?.length).toEqual(1);
      expect(res.errors?.[0].message).toContain('Not Found');
    });
  });

  describe('for non-premium users', () => {
    beforeAll(() => {
      premiumStub = sinon
        .stub(ContextManager.prototype, 'isPremium')
        .value(false);
    });
    afterAll(() => premiumStub.restore());
    it('should throw an invalid permissions error', async () => {
      const variables: NoteInput = {
        id: '3',
        input: 'sweeter than a bucket full of strawberries',
      };
      const res = await server.executeOperation({
        query: CREATE_NOTE,
        variables,
      });

      expect(res.data?.createSavedItemHighlightNote).toBeNull();
      expect(res.errors?.length).toEqual(1);
      expect(res.errors?.[0].message).toContain('Premium account required');
    });
  });
});
