import * as Sentry from '@sentry/node';
import config from './config';
import { expressMiddleware } from '@apollo/server/express4';
import { getServer } from './server';
import AWSXRay from 'aws-xray-sdk-core';
import xrayExpress from 'aws-xray-sdk-express';
import express from 'express';
import https from 'https';
import cors from 'cors';
import { EventEmitter } from 'events';
import queueDeleteRouter from './server/routes/queueDelete';
import { BatchDeleteHandler } from './server/aws/batchDeleteHandler';
import { ContextManager } from './context';
import { dynamoClient, readClient, writeClient } from './database/client';

const serviceName = 'annotations-api';
const GRAPHQL_PATH = '/graphql';

//Set XRAY to just log if the context is missing instead of a runtime error
AWSXRay.setContextMissingStrategy('LOG_ERROR');

//Add the AWS XRAY ECS plugin that will add ecs specific data to the trace
AWSXRay.config([AWSXRay.plugins.ECSPlugin]);

//Capture all https traffic this service sends
//This is to auto capture node fetch requests (like to parser)
AWSXRay.captureHTTPsGlobal(https, true);

//Capture all promises that we make
AWSXRay.capturePromise();

Sentry.init({
  ...config.sentry,
  debug: config.sentry.environment == 'development',
});

(async () => {
  // Start BatchDelete queue polling
  new BatchDeleteHandler(new EventEmitter());

  const server = getServer();

  const app = express();

  app.use(express.json());
  app.use('/queueDelete', queueDeleteRouter);

  app.get('/.well-known/apollo/server-health', (req, res) => {
    res.status(200).send('ok');
  });

  //If there is no host header (really there always should be..) then use parser-wrapper as the name
  app.use(xrayExpress.openSegment(serviceName));

  //Set XRay to use the host header to open its segment name.
  AWSXRay.middleware.enableDynamicNaming('*');

  //Apply the GraphQL middleware into the express app
  await server.start();

  app.use(
    GRAPHQL_PATH,
    cors<cors.CorsRequest>,
    expressMiddleware(server, {
      context: async ({ req }) =>
        new ContextManager({
          request: req,
          db: { readClient: readClient(), writeClient: writeClient() },
          dynamoClient: dynamoClient(),
        }),
    })
  );

  //Make sure the express app has the xray close segment handler
  app.use(xrayExpress.closeSegment());

  // The `listen` method launches a web server.
  app.listen({ port: 4008 }, () =>
    console.log(`🚀 Server ready at http://localhost:4008${GRAPHQL_PATH}`)
  );
})();
