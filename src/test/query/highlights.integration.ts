import { ApolloServer } from 'apollo-server-express';
import { getServer } from '../../server';
import sinon from 'sinon';
import { ContextManager } from '../../context';
import { readClient } from '../../database/client';
import { GET_HIGHLIGHTS, seedData } from './highlights-fixtures';

describe('Highlights on a SavedItem', () => {
  let server: ApolloServer;
  let contextStub;
  const userId = 1;
  const db = readClient();
  const now = new Date();
  const testData = seedData(now);
  const expectedFields = [
    'id',
    'patch',
    'version',
    'quote',
    '_createdAt',
    '_updatedAt',
  ];

  beforeAll(async () => {
    await Promise.all(
      Object.keys(testData).map((table) => db(table).truncate())
    );
    await Promise.all(
      Object.entries(testData).map(([table, data]) => db(table).insert(data))
    );
    contextStub = sinon.stub(ContextManager.prototype, 'userId').value(userId);
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

    // const expectedAnnotations = {
    //   highlights: [{ id: '1', quote: 'abc' }],
    // };

    const annotations = res?.data?._entities[0].annotations.highlights;

    expect(res).toBeTruthy();
    expect(annotations).toHaveLength(1);
    //
    // {data: {_entities: [{annotations: {highlights: [{id: etc.}]}}, {}]}}
  });
  it('should return an array of all active (not-deleted) highlights associated with a SavedItem', async () => {
    const variables = { itemId: 2 };
    const res = await server.executeOperation({
      query: GET_HIGHLIGHTS,
      variables,
    });
    // const expectedAnnotations = {
    //   highlights: [{ id: '1', quote: 'abc' }],
    // };

    const annotations = res?.data?._entities[0].annotations.highlights;

    expect(res).toBeTruthy();
    expect(annotations).toHaveLength(2);
  });
  it(`should throw NOT_FOUND error when the ItemId is not in the User's list`, async () => {
    const variables = { itemId: 999 };
    const res = await server.executeOperation({
      query: GET_HIGHLIGHTS,
      variables,
    });
    expect(res.errors).toBeTruthy();
    expect(res.errors).toHaveLength(1);
    // Linter/compiler really shouldn't be complaining but... make it conditional
    if (res.errors) {
      expect(res.errors[0].extensions?.code).toEqual('NOT_FOUND');
    }
  });
  it('should return an empty Highlights array if there are no highlights on a SavedItem', async () => {
    const variables = { itemId: 3 };
    const res = await server.executeOperation({
      query: GET_HIGHLIGHTS,
      variables,
    });

    const annotations = res?.data?._entities[0].annotations?.highlights;

    expect(res).toBeTruthy();
    expect(annotations).toHaveLength(0);
  });
});
