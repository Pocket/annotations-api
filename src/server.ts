import { ApolloServer } from 'apollo-server-express';
import typeDefs from './typeDefs';
import { resolvers } from './resolvers';
import { buildFederatedSchema } from '@apollo/federation';
import { sentryPlugin } from '@pocket-tools/apollo-utils';
import {
  ApolloServerPluginLandingPageGraphQLPlayground,
  ApolloServerPluginLandingPageDisabled,
} from 'apollo-server-core';
import { ContextManager } from './context';
import { readClient, writeClient } from './database/client';

export function getServer(): ApolloServer {
  return new ApolloServer({
    mocks: true,
    mockEntireSchema: true,
    schema: buildFederatedSchema([{ typeDefs, resolvers }]),
    plugins: [
      sentryPlugin,
      process.env.NODE_ENV === 'production'
        ? ApolloServerPluginLandingPageDisabled()
        : ApolloServerPluginLandingPageGraphQLPlayground(),
    ],
    context: ({ req }) =>
      new ContextManager({
        request: req,
        db: { readClient: readClient(), writeClient: writeClient() },
      }),
  });
}
