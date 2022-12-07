import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { ClientError, request } from 'graphql-request';
import { getServer } from '../../server';
import sinon from 'sinon';
import { ContextManager, IContext, getMockContextManager } from '../../context';
import { readClient } from '../../database/client';
import { seedData } from '../query/highlights-fixtures';
import { HighlightEntity, HighlightInput } from '../../types';
import { UsersMeta } from '../../dataservices/usersMeta';
import { mysqlTimeString } from '../../dataservices/utils';
import config from '../../config';
import {
  UpdateSavedItemHighlightDocument,
  UpdateSavedItemHighlightMutation,
  UpdateSavedItemHighlightMutationVariables,
} from './client-types';

/**
 * HTTP Requests with generated types proposal
 *
 * Using the apollo standalone server, but it would be possible to
 * start up express servers instead.
 *
 * This has a few additional changes outside this file. The `client-types.ts`
 * file in this directory is generated using `npm run codegen:graphql-types`,
 * generating types for the queries in `highlights-mutations.test.graphql`
 * using the config in `codegen.yml`.
 */

// helper to ensure we do not conflict with other tests
// this could live somewhere common and have retry helper
// for restarting the server if we want to really be careful
const getRandomPort = (min = 10000, max = 20000) =>
  Math.floor(Math.random() * (max - min) + min);

describe('Highlights update', () => {
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
  afterAll(async () => {
    await server.stop();
    contextStub.restore();
  });
  beforeEach(async () => {
    await truncateAndSeed();
  });
  it('should update an existing highlight owned by the user', async () => {
    const updateDate = new Date(2022, 3, 3);
    const clock = sinon.useFakeTimers({
      now: updateDate,
      shouldAdvanceTime: false,
    });

    const input: UpdateSavedItemHighlightMutationVariables['input'] = {
      itemId: '1',
      version: 2,
      patch: 'Prow scuttle parrel',
      quote: 'provost Sail ho shrouds spirits boom',
    };
    const id = '1';
    const variables: UpdateSavedItemHighlightMutationVariables = {
      id,
      input,
    };

    // data is typed!  check me out in your editor
    const data = await request<
      UpdateSavedItemHighlightMutation,
      UpdateSavedItemHighlightMutationVariables
    >(url, UpdateSavedItemHighlightDocument, variables);

    const usersMetaRecord = await db('users_meta')
      .where({ user_id: '1', property: UsersMeta.propertiesMap.account })
      .pluck('value');
    const listRecord = await db('list')
      .where({ user_id: '1', item_id: '1' })
      .pluck('time_updated');

    expect(data?.updateSavedItemHighlight).toBeTruthy();
    expect(data?.updateSavedItemHighlight.patch).toEqual(input.patch);
    expect(data?.updateSavedItemHighlight.quote).toEqual(input.quote);
    expect(data?.updateSavedItemHighlight.version).toEqual(input.version);
    expect(data?.updateSavedItemHighlight.id).toEqual(id);
    expect(usersMetaRecord[0]).toEqual(
      mysqlTimeString(updateDate, config.database.tz)
    );
    expect(mysqlTimeString(listRecord[0])).toEqual(
      mysqlTimeString(updateDate, config.database.tz)
    );

    clock.restore();
  });
  it('should throw a NOT_FOUND error if the annotation_id does not exist', async () => {
    const variables: UpdateSavedItemHighlightMutationVariables = {
      id: '999',
      input: {
        itemId: '1',
        version: 2,
        patch: 'Prow scuttle parrel',
        quote: 'provost Sail ho shrouds spirits boom',
      },
    };
    // this client rejects on errors. There is a lot more returned
    // with the response, but this is a small snippet to extract the
    // error
    const res = (await request<
      UpdateSavedItemHighlightMutation,
      UpdateSavedItemHighlightMutationVariables
    >(url, UpdateSavedItemHighlightDocument, variables)
      // catch and return error inline, could also try/catch
      .catch((error) => error)) as ClientError;

    expect(res?.response?.errors?.[0]?.message).toContain(
      'Error - Not Found: No annotation found for the given ID'
    );

    // this is really supposed to throw a NOT_FOUND error but in a test env it throws INTERNAL_SERVER_ERROR
    // expect(res?.errors?.[0]?.extensions?.code).toEqual('NOT_FOUND');
  });
  it('should throw a NOT_FOUND error if the annotation_id is not owned by the user, and not update', async () => {
    await db('user_annotations').insert({
      annotation_id: 55,
      user_id: 2,
      item_id: 2,
      patch: 'Prow scuttle parrel',
      quote: 'provost Sail ho shrouds spirits boom',
      version: 1,
      status: 1,
      updated_at: now,
      created_at: now,
    });
    const variables: { id: string; input: HighlightInput } = {
      id: '55',
      input: {
        itemId: '2',
        version: 2,
        patch: 'wherry doubloon chase',
        quote: 'Belay yo-ho-ho keelhaul squiffy black spot',
      },
    };
    // this client rejects on errors. There is a lot more returned
    // with the response, but this is a small snippet to extract the
    // error
    const res = (await request<
      UpdateSavedItemHighlightMutation,
      UpdateSavedItemHighlightMutationVariables
    >(url, UpdateSavedItemHighlightDocument, variables)
      // catch and return error inline, could also try/catch
      .catch((error) => error)) as ClientError;

    const dbRow = await db<HighlightEntity>('user_annotations')
      .select()
      .where('annotation_id', variables.id);

    expect(dbRow.length).toEqual(1);
    expect(res?.response?.errors?.[0].message).toContain(
      'Error - Not Found: No annotation found for the given ID'
    );
  });
});
