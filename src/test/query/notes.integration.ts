import { ApolloServer } from 'apollo-server-express';
import { getServer } from '../../server';
import sinon from 'sinon';
import { ContextManager } from '../../context';
import { readClient } from '../../database/client';
import { seedData } from './highlights-fixtures';
import { noteSeedCommand, GET_NOTES } from './notes-fixtures';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import config from '../../config';

// TODO: tests must be migrated after a migration route is chosen, skip for now.
describe.skip('Notes on a Highlight', () => {
  let server: ApolloServer;
  let contextStub;
  let premiumStub;
  const userId = 1;
  const db = readClient();
  const now = new Date();
  const testData = seedData(now);
  const client = new DynamoDBClient({
    region: config.aws.region,
    endpoint: config.aws.endpoint,
  });
  const dynamodb = DynamoDBDocumentClient.from(client);

  beforeAll(async () => {
    await Promise.all(
      Object.keys(testData).map((table) => db(table).truncate())
    );
    await Promise.all(
      Object.entries(testData).map(([table, data]) => db(table).insert(data))
    );
    await dynamodb.send(noteSeedCommand(now));
    contextStub = sinon.stub(ContextManager.prototype, 'userId').value(userId);
    premiumStub = sinon.stub(ContextManager.prototype, 'isPremium').value(true);
    server = getServer();
  });
  afterAll(() => {
    contextStub.restore();
    premiumStub.restore();
    client.destroy();
  });
  it('should return a highlight with note when available', async () => {
    const variables = { itemId: 1 };
    const res = await server.executeOperation({
      query: GET_NOTES,
      variables,
    });

    const expectedHighlightWithNote = {
      id: '1',
      note: {
        _createdAt: Math.round(now.getTime() / 1000),
        _updatedAt: Math.round(now.getTime() / 1000),
        text: `there you have it, that's great`,
      },
    };

    const highlights = res?.data?._entities[0].annotations.highlights;
    // Check all fields are resolved
    expect(res).toBeTruthy();
    expect(res.errors).toBeUndefined();
    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toMatchObject(expectedHighlightWithNote);
  });
  it('should return null notes field if highlight has no notes', async () => {
    const variables = { itemId: 2 };
    const res = await server.executeOperation({
      query: GET_NOTES,
      variables,
    });
    const highlights = res?.data?._entities[0].annotations?.highlights;
    expect(res).toBeTruthy();
    expect(highlights.length).toBeGreaterThanOrEqual(1); // don't care how much, just that there is one or more
    expect(highlights[0].note).toBeNull();
  });
});
