import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { request, ClientError } from 'graphql-request';
import { getServer } from '../../server';
import sinon from 'sinon';
import { ContextManager, IContext, getMockContextManager } from '../../context';
import { readClient } from '../../database/client';
import { seedData } from '../query/highlights-fixtures';
import { DELETE_HIGHLIGHT } from './highlights-mutations';
import { HighlightEntity } from '../../types';
import { UsersMeta } from '../../dataservices/usersMeta';
import { mysqlTimeString } from '../../dataservices/utils';
import config from '../../config';

/**
 * HTTP Requests without generated types proposal
 *
 * Using the apollo standalone server, but it would be possible to
 * start up express servers instead.
 */

// helper to ensure we do not conflict with other tests
// this could live somewhere common and have retry helper
// for restarting the server if we want to really be careful
const getRandomPort = (min = 10000, max = 20000) =>
  Math.floor(Math.random() * (max - min) + min);

describe('Highlights deletion', () => {
  let server: ApolloServer<IContext>;
  let url: string;
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

  beforeAll(async () => {
    contextStub = sinon.stub(ContextManager.prototype, 'userId').value(userId);
    server = getServer();
    ({ url } = await startStandaloneServer(server, {
      // this could be the proper contextManager if we were using
      // the express server, and we could avoid mocks entirely.
      // using the mock to show how usage works below.
      context: async () => getMockContextManager(),
      listen: { port: getRandomPort() },
    }));
  });

  beforeEach(async () => {
    await truncateAndSeed();
  });

  afterAll(async () => {
    await server.stop();
    contextStub.restore();
  });

  it('should delete an existing highlight', async () => {
    const updateDate = new Date(2022, 3, 3);
    const clock = sinon.useFakeTimers({
      now: updateDate,
      shouldAdvanceTime: false,
    });

    const variables = { id: '1' };
    // request returns `any` without generic types specified
    // behaves just like `res.data` did before migration.
    const data = await request(url, DELETE_HIGHLIGHT, variables);
    const annotationRecord = await db<HighlightEntity>('user_annotations')
      .select()
      .where('annotation_id', variables.id);
    const usersMetaRecord = await db('users_meta')
      .where({ user_id: '1', property: UsersMeta.propertiesMap.account })
      .pluck('value');
    const listRecord = await db('list')
      .where({ user_id: '1', item_id: '1' })
      .pluck('time_updated');

    expect(data).toBeTruthy();
    expect(data?.deleteSavedItemHighlight).toBe(variables.id);
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
    // this client rejects on errors. There is a lot more returned
    // with the response, but this is a small snippet to extract the
    // error
    const res = (await request(url, DELETE_HIGHLIGHT, variables)
      // just catch inline and return, could also try / catch
      .catch((error) => error)) as ClientError;

    expect(res?.response?.errors).toBeTruthy();

    if (res?.response?.errors) {
      expect(res?.response?.errors[0].message).toBe(
        'Error - Not Found: No annotation found for the given ID'
      );
    }
  });
});
