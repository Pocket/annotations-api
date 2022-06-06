import { Resource } from 'cdktf';
import { Construct } from 'constructs';
import { config } from './config';
import { PocketVPC } from '@pocket-tools/terraform-modules';
import { PocketSQSWithLambdaTarget } from '@pocket-tools/terraform-modules';
import { LAMBDA_RUNTIMES } from '@pocket-tools/terraform-modules';
import { ssm } from '@cdktf/provider-aws';
import { PocketPagerDuty } from '@pocket-tools/terraform-modules';

export class SqsLambda extends Resource {
  constructor(
    scope: Construct,
    private name: string,
    vpc: PocketVPC,
    pagerDuty?: PocketPagerDuty
  ) {
    super(scope, name);

    const { sentryDsn, gitSha } = this.getEnvVariableValues();

    new PocketSQSWithLambdaTarget(this, 'sqs-event-consumer', {
      name: `${config.prefix}-Sqs-Event-Consumer`,
      batchSize: 10,
      batchWindow: 60,
      sqsQueue: {
        maxReceiveCount: 3,
        visibilityTimeoutSeconds: 300,
      },
      lambda: {
        runtime: LAMBDA_RUNTIMES.NODEJS14,
        handler: 'index.handler',
        timeout: 120,
        environment: {
          SENTRY_DSN: sentryDsn,
          GIT_SHA: gitSha,
          ENVIRONMENT:
            config.environment === 'Prod' ? 'production' : 'development',
          ANNOTATIONS_API_URI:
            config.environment === 'Prod'
              ? 'https://annotations-api.readitlater.com'
              : 'https://annotations-api.getpocket.dev',
        },
        vpcConfig: {
          securityGroupIds: vpc.defaultSecurityGroups.ids,
          subnetIds: vpc.privateSubnetIds,
        },
        codeDeploy: {
          region: vpc.region,
          accountId: vpc.accountId,
        },
        alarms: {
          // TODO: set proper alarm values, check dev
          /*
          errors: {
            evaluationPeriods: 3,
            period: 3600, // 1 hour
            threshold: 20,
            actions: config.isDev
              ? []
              : [pagerDuty!.snsNonCriticalAlarmTopic.arn],
          },
          */
        },
      },
      tags: config.tags,
    });
  }

  private getEnvVariableValues() {
    const sentryDsn = new ssm.DataAwsSsmParameter(this, 'sentry-dsn', {
      name: `/${config.name}/${config.environment}/SENTRY_DSN`,
    });

    const serviceHash = new ssm.DataAwsSsmParameter(this, 'service-hash', {
      name: `${config.circleCIPrefix}/SERVICE_HASH`,
    });

    return { sentryDsn: sentryDsn.value, gitSha: serviceHash.value };
  }
}
