import * as Sentry from '@sentry/node';
import config from './config';
import { startServer } from './server';
import AWSXRay from 'aws-xray-sdk-core';
import xrayExpress from 'aws-xray-sdk-express';
import express from 'express';
import https from 'https';

const serviceName = 'Acme';
//todo: change service name

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

const server = startServer();

const app = express();

//If there is no host header (really there always should be..) then use parser-wrapper as the name
app.use(xrayExpress.openSegment(serviceName));

//Set XRay to use the host header to open its segment name.
AWSXRay.middleware.enableDynamicNaming('*');

//Apply the GraphQL middleware into the express app
server.start().then(() => {
  server.applyMiddleware({ app, path: '/' });
});

//Make sure the express app has the xray close segment handler
app.use(xrayExpress.closeSegment());

// The `listen` method launches a web server.
app.listen({ port: 4008 }, () =>
  console.log(`🚀 Server ready at http://localhost:4008${server.graphqlPath}`)
);
