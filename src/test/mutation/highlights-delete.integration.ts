import { ApolloServer } from 'apollo-server-express';
import { getServer } from '../../server';
import sinon from 'sinon';
import { ContextManager } from '../../context';
import { readClient } from '../../database/client';
import { seedData } from '../query/highlights-fixtures';
import { DELETE_HIGHLIGHT } from './highlights-mutations';
import { HighlightEntity } from '../../types';
import { UsersMeta } from '../../dataservices/usersMeta';
import { mysqlTimeString } from '../../dataservices/utils';
import config from '../../config';

describe('Highlights deletion', () => {
  let server: ApolloServer;
  let contextStub;
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

  beforeAll(() => {
    contextStub = sinon.stub(ContextManager.prototype, 'userId').value(userId);
    server = getServer();
  });

  beforeEach(async () => {
    await truncateAndSeed();
  });

  afterAll(() => {
    contextStub.restore();
  });

  it('should delete an existing highlight', async () => {
    const updateDate = new Date(2022, 3, 3);
    const clock = sinon.useFakeTimers({
      now: updateDate,
      shouldAdvanceTime: false,
    });

    const variables = { id: '1' };
    const res = await server.executeOperation({
      query: DELETE_HIGHLIGHT,
      variables,
    });
    const annotationRecord = await db<HighlightEntity>('user_annotations')
      .select()
      .where('annotation_id', variables.id);
    const usersMetaRecord = await db('users_meta')
      .where({ user_id: '1', property: UsersMeta.propertiesMap.account })
      .pluck('value');
    const listRecord = await db('list')
      .where({ user_id: '1', item_id: '1' })
      .pluck('time_updated');

    expect(res).toBeTruthy();
    expect(res?.data?.deleteSavedItemHighlight).toBe(variables.id);
    expect(annotationRecord[0].status).toBe(0);
    expect(usersMetaRecord[0]).toEqual(
      mysqlTimeString(updateDate, config.database.tz)
    );
    expect(mysqlTimeString(listRecord[0])).toEqual(
      mysqlTimeString(updateDate, config.database.tz)
    );

    clock.restore();
  });

  it('should throw NOT_FOUND error if the highlight ID does not exist', async () => {
    const variables = { id: '999' };
    const res = await server.executeOperation({
      query: DELETE_HIGHLIGHT,
      variables,
    });

    expect(res?.errors).toBeTruthy();

    if (res?.errors) {
      expect(res?.errors[0].message).toBe(
        'Error - Not Found: No annotation found for the given ID'
      );
    }
  });
});
