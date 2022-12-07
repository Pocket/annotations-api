import { ApolloServer } from '@apollo/server';
import typeDefs from '../typeDefs';
import { resolvers } from '../resolvers';
import { buildSubgraphSchema } from '@apollo/subgraph';
// import { sentryPlugin } from '@pocket-tools/apollo-utils';
import {
  ApolloServerPluginLandingPageDisabled,
  ApolloServerPluginInlineTraceDisabled,
} from '@apollo/server/plugin/disabled';
import { ApolloServerPluginInlineTrace } from '@apollo/server/plugin/inlineTrace';
import { ApolloServerPluginLandingPageGraphQLPlayground } from '@apollo/server-plugin-landing-page-graphql-playground';
import { IContext } from '../context';

export function getServer(): ApolloServer<IContext> {
  return new ApolloServer<IContext>({
    csrfPrevention: true,
    schema: buildSubgraphSchema([{ typeDefs, resolvers }]),
    plugins: [
      // TODO: this needs to be re-enabled after sentryPlugin is updated
      // sentryPlugin,
      process.env.NODE_ENV === 'production'
        ? ApolloServerPluginLandingPageDisabled()
        : ApolloServerPluginLandingPageGraphQLPlayground(),
      process.env.NODE_ENV === 'production'
        ? ApolloServerPluginInlineTrace()
        : ApolloServerPluginInlineTraceDisabled(),
    ],
  });
}
