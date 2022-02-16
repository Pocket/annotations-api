import { ApolloServer } from 'apollo-server-express';
import { getServer } from '../../server';
import sinon from 'sinon';
import { ContextManager } from '../../context';
import { readClient } from '../../database/client';
import { seedData } from '../query/highlights-fixtures';

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
    premiumStub = sinon
      .stub(ContextManager.prototype, 'isPremium')
      .value(false);
  });
  beforeEach(async () => {
    await truncateAndSeed();
  });
  afterAll(() => {
    contextStub.restore();
    afterAll(() => premiumStub.restore());
  });
  it('adds a note to an existing higlight', async () => {});
  it('updates a note if one already exists on the highlight', async () => {});
  it('returns NOT_FOUND if the highlight does not exist', async () => {});
  it('should throw an invalid permissions error for non-premium users', async () => {});
});
