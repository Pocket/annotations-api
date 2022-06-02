import { ApolloServer } from 'apollo-server-express';
import { getServer } from '../../server';
import sinon from 'sinon';
import { ContextManager, IContext } from '../../context';
import { readClient } from '../../database/client';
import { seedData } from '../query/highlights-fixtures';
import { DELETE_NOTE } from './notes-mutations';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import config from '../../config';
import { noteSeedCommand } from '../query/notes-fixtures';
import { NotesDataService } from '../../dataservices/notes';

describe('Notes delete', () => {
  let server: ApolloServer;
  // Stubs/mocks
  let contextStub;
  let premiumStub;
  // Variables/data
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
    contextStub = sinon.stub(ContextManager.prototype, 'userId').value(userId);
    server = getServer();
    await Promise.all(
      Object.keys(testData).map((table) => db(table).truncate())
    );
    await Promise.all(
      Object.entries(testData).map(([table, data]) => db(table).insert(data))
    );
    await dynamodb.send(noteSeedCommand(now));
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
    it('returns NOT_FOUND error if attempting to delete a note from a highlight that has no notes', async () => {
      const variables = { id: '2' };
      const res = await server.executeOperation({
        query: DELETE_NOTE,
        variables,
      });
      expect(res.data).toBeNull();
      expect(res.errors?.length).toEqual(1);
      expect(res.errors?.[0].message).toContain('Not Found');
    });
    it('deletes a note on a highlight that has a note', async () => {
      const variables = { id: '1' };
      const res = await server.executeOperation({
        query: DELETE_NOTE,
        variables,
      });
      const result = res.data?.deleteSavedItemHighlightNote;
      expect(result).toEqual('1');
      const dbRecord = await new NotesDataService(client, '1').get('1');
      expect(dbRecord).toBeNull();
    });
    it('returns NOT_FOUND if the highlight does not exist', async () => {
      const variables = { id: '99999' };
      const res = await server.executeOperation({
        query: DELETE_NOTE,
        variables,
      });
      expect(res.data).toBeNull();
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
      const variables = {
        id: '3',
      };
      const res = await server.executeOperation({
        query: DELETE_NOTE,
        variables,
      });

      expect(res.data).toBeNull();
      expect(res.errors?.length).toEqual(1);
      expect(res.errors?.[0].message).toContain('Premium account required');
    });
  });
});
