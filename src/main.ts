import config from './config';
import { startServer } from './server';
import AWSXRay from 'aws-xray-sdk-core';
import https from 'https';
import { EventEmitter } from 'events';
import { BatchDeleteHandler } from './server/aws/batchDeleteHandler';

//Set XRAY to just log if the context is missing instead of a runtime error
AWSXRay.setContextMissingStrategy('LOG_ERROR');

//Add the AWS XRAY ECS plugin that will add ecs specific data to the trace
AWSXRay.config([AWSXRay.plugins.ECSPlugin]);

//Capture all https traffic this service sends
//This is to auto capture node fetch requests (like to parser)
AWSXRay.captureHTTPsGlobal(https, true);

//Capture all promises that we make
AWSXRay.capturePromise();

//Set XRay to use the host header to open its segment name.
AWSXRay.middleware.enableDynamicNaming('*');

// init BatchDeleteHandler outside server, SQS queue is not
// present in localstack for integration testing
// Start BatchDelete queue polling
new BatchDeleteHandler(new EventEmitter());

(async () => {
  await startServer(config.app.port);
  console.log(`🚀 Server ready at http://localhost:${config.app.port}/`);
})();
