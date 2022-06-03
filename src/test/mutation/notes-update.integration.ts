import { ApolloServer } from 'apollo-server-express';
import { getServer } from '../../server';
import sinon from 'sinon';
import { ContextManager } from '../../context';
import { dynamoClient, readClient } from '../../database/client';
import { seedData } from '../query/highlights-fixtures';
import { UPDATE_NOTE } from './notes-mutations';
import { NoteInput } from '../../types';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import config from '../../config';
import { noteSeedCommand } from '../query/notes-fixtures';
import { NotesDataService } from '../../dataservices/notes';

describe('Notes update', () => {
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
    it('adds a note to an existing higlight without any notes', async () => {
      const variables: NoteInput = {
        id: '3',
        input: 'sweeter than a bucket full of strawberries',
      };
      const res = await server.executeOperation({
        query: UPDATE_NOTE,
        variables,
      });
      const result = res.data?.updateSavedItemHighlightNote;
      const expectedHighlight = {
        text: 'sweeter than a bucket full of strawberries',
      };
      expect(result).toEqual(expect.objectContaining(expectedHighlight));
    });
    it('updates a note on an existing higlight that already has a note', async () => {
      const variables: NoteInput = {
        id: '1',
        input: 'sweeter than a bucket full of strawberries',
      };
      const res = await server.executeOperation({
        query: UPDATE_NOTE,
        variables,
      });
      const result = res.data?.updateSavedItemHighlightNote;
      const expectedHighlight = {
        text: 'sweeter than a bucket full of strawberries',
      };
      expect(result).toEqual(expect.objectContaining(expectedHighlight));
      const dbRecord = await new NotesDataService(dynamoClient(), '1').get('1');
      expect(dbRecord?.text).toEqual(
        'sweeter than a bucket full of strawberries'
      );
    });
    it('returns NOT_FOUND if the highlight does not exist', async () => {
      const variables: NoteInput = {
        id: '99999',
        input: 'sweeter than a bucket full of strawberries',
      };
      const res = await server.executeOperation({
        query: UPDATE_NOTE,
        variables,
      });
      expect(res.data?.updateSavedItemHighlightNote).toBeNull();
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
        query: UPDATE_NOTE,
        variables,
      });

      expect(res.data?.updateSavedItemHighlightNote).toBeNull();
      expect(res.errors?.length).toEqual(1);
      expect(res.errors?.[0].message).toContain('Premium account required');
    });
  });
});
