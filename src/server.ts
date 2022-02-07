import { ApolloServer } from 'apollo-server-express';
import typeDefs from './typeDefs';
import { resolvers } from './resolvers';
import { buildFederatedSchema } from '@apollo/federation';
import { sentryPlugin } from '@pocket-tools/apollo-utils';
import {
  ApolloServerPluginLandingPageGraphQLPlayground,
  ApolloServerPluginLandingPageDisabled,
} from 'apollo-server-core';

export function startServer(): ApolloServer {
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
    context: {
      // Example request context. This context is accessible to all resolvers.
      // Typically a new context object is created for every request.
      // dataLoaders: {
      //   itemIdLoader: itemIdLoader,
      //   itemUrlLoader: itemUrlLoader,
      // },
      // repositories: {
      //   itemResolver: getItemResolverRepository(),
      // },
    },
  });
}
