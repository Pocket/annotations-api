import * as Sentry from '@sentry/node';
import express from 'express';
import http from 'http';
import cors from 'cors';
import xrayExpress from 'aws-xray-sdk-express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { errorHandler, sentryPlugin } from '@pocket-tools/apollo-utils';
import { ApolloServerPluginLandingPageGraphQLPlayground } from '@apollo/server-plugin-landing-page-graphql-playground';
import {
  ApolloServerPluginLandingPageDisabled,
  ApolloServerPluginInlineTraceDisabled,
  ApolloServerPluginUsageReportingDisabled,
} from '@apollo/server/plugin/disabled';
import { ApolloServerPluginInlineTrace } from '@apollo/server/plugin/inlineTrace';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';

import typeDefs from '../typeDefs';
import { resolvers } from '../resolvers';
import config from '../config';
import { getContext, IContext } from '../context';
import queueDeleteRouter from './routes/queueDelete';

const serviceName = 'annotations-api';

export async function startServer(port: number): Promise<{
  app: Express.Application;
  server: ApolloServer<IContext>;
  url: string;
}> {
  Sentry.init({
    ...config.sentry,
    debug: config.sentry.environment == 'development',
  });

  // initialize express with exposed httpServer so that it may be
  // provided to drain plugin for graceful shutdown.
  const app = express();
  const httpServer = http.createServer(app);

  // expose a health check url
  app.get('/.well-known/apollo/server-health', (req, res) => {
    res.status(200).send('ok');
  });

  app.use(express.json());
  app.use('/queueDelete', queueDeleteRouter);

  //If there is no host header (really there always should be..) then use parser-wrapper as the name
  app.use(xrayExpress.openSegment(serviceName));

  const basePlugins = [
    sentryPlugin,
    ApolloServerPluginDrainHttpServer({ httpServer }),
  ];
  const prodPlugins = [
    ApolloServerPluginLandingPageDisabled(),
    ApolloServerPluginInlineTrace(),
  ];
  const nonProdPlugins = [
    ApolloServerPluginLandingPageGraphQLPlayground(),
    ApolloServerPluginInlineTraceDisabled(),
    ApolloServerPluginUsageReportingDisabled(),
  ];
  const plugins =
    config.app.environment === 'production'
      ? basePlugins.concat(prodPlugins)
      : basePlugins.concat(nonProdPlugins);

  const server = new ApolloServer<IContext>({
    schema: buildSubgraphSchema([{ typeDefs, resolvers }]),
    plugins,
    formatError: config.app.environment !== 'test' ? errorHandler : undefined,
  });

  await server.start();

  // graphql endpoint is at server base route
  const url = '/';

  app.use(
    url,
    cors<cors.CorsRequest>(),
    expressMiddleware<IContext>(server, {
      context: getContext,
    })
  );

  //Make sure the express app has the xray close segment handler
  app.use(xrayExpress.closeSegment());

  await new Promise<void>((resolve) => httpServer.listen({ port }, resolve));
  return { app, server, url };
}
