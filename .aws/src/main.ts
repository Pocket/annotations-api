import { Construct } from 'constructs';
import {
  App,
  DataTerraformRemoteState,
  RemoteBackend,
  TerraformStack,
} from 'cdktf';
import { AwsProvider, sqs } from '@cdktf/provider-aws';
import {
  DataAwsCallerIdentity,
  DataAwsRegion,
} from '@cdktf/provider-aws/lib/datasources';
import { DataAwsSnsTopic } from '@cdktf/provider-aws/lib/sns';
import { DataAwsKmsAlias } from '@cdktf/provider-aws/lib/kms';
import { config } from './config';
import {
  ApplicationRedis,
  ApplicationSQSQueue,
  PocketALBApplication,
  PocketECSCodePipeline,
  PocketPagerDuty,
  PocketVPC,
  ApplicationSqsSnsTopicSubscription,
} from '@pocket-tools/terraform-modules';
import { PagerdutyProvider } from '@cdktf/provider-pagerduty';
import { LocalProvider } from '@cdktf/provider-local';
import { NullProvider } from '@cdktf/provider-null';
import { ArchiveProvider } from '@cdktf/provider-archive';
import { DynamoDB } from './dynamodb';
import { SqsLambda } from './SqsLambda';

class AnnotationsAPI extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new AwsProvider(this, 'aws', { region: 'us-east-1' });
    new PagerdutyProvider(this, 'pagerduty_provider', { token: undefined });
    new LocalProvider(this, 'local_provider');
    new NullProvider(this, 'null_provider');
    new ArchiveProvider(this, 'archive-provider');

    new RemoteBackend(this, {
      hostname: 'app.terraform.io',
      organization: 'Pocket',
      workspaces: [{ prefix: `${config.name}-` }],
    });

    const region = new DataAwsRegion(this, 'region');
    const caller = new DataAwsCallerIdentity(this, 'caller');
    const pocketVPC = new PocketVPC(this, 'pocket-vpc');
    const cache = AnnotationsAPI.createElasticache(this, pocketVPC);
    const dynamodb = new DynamoDB(this, 'dynamodb');

    const sqsLambda = new SqsLambda(this, 'sqs-event-consumer', pocketVPC);

    const lambda = sqsLambda.lambda;

    new ApplicationSqsSnsTopicSubscription(
      this,
      'user-events-sns-subscription',
      {
        name: config.prefix,
        snsTopicArn: `arn:aws:sns:${pocketVPC.region}:${pocketVPC.accountId}:${config.lambda.snsTopicName.userEvents}`,
        sqsQueue: lambda.sqsQueueResource,
        tags: config.tags,
        dependsOn: [lambda.sqsQueueResource as sqs.SqsQueue],
      }
    );

    new ApplicationSQSQueue(this, 'batch-delete-consumer-queue', {
      name: config.envVars.sqsBatchDeleteQueueName,
      tags: config.tags,
      //need to set maxReceiveCount to enable DLQ
      maxReceiveCount: 2,
    });

    const pocketApp = this.createPocketAlbApplication({
      pagerDuty: this.createPagerDuty(),
      secretsManagerKmsAlias: this.getSecretsManagerKmsAlias(),
      snsTopic: this.getCodeDeploySnsTopic(),
      region,
      caller,
      cache,
      dynamodb,
    });

    this.createApplicationCodePipeline(pocketApp);
  }

  /**
   * Creates the elasticache and returns the node address list
   * @param scope
   * @private
   */
  private static createElasticache(
    scope: Construct,
    vpc: PocketVPC
  ): {
    primaryEndpoint: string;
    readerEndpoint: string;
  } {
    const elasticache = new ApplicationRedis(scope, 'redis', {
      //Usually we would set the security group ids of the service that needs to hit this.
      //However we don't have the necessary security group because it gets created in PocketALBApplication
      //So instead we set it to null and allow anything within the vpc to access it.
      //This is not ideal..
      //Ideally we need to be able to add security groups to the ALB application.
      allowedIngressSecurityGroupIds: undefined,
      node: {
        count: config.cacheNodes,
        size: config.cacheSize,
      },
      subnetIds: vpc.privateSubnetIds,
      tags: config.tags,
      vpcId: vpc.vpc.id,
      prefix: config.prefix,
    });

    return {
      primaryEndpoint:
        elasticache.elasticacheReplicationGroup.primaryEndpointAddress,
      readerEndpoint:
        elasticache.elasticacheReplicationGroup.readerEndpointAddress,
    };
  }

  /**
   * Get the sns topic for code deploy
   * @private
   */
  private getCodeDeploySnsTopic() {
    return new DataAwsSnsTopic(this, 'backend_notifications', {
      name: `Backend-${config.environment}-ChatBot`,
    });
  }

  /**
   * Get secrets manager kms alias
   * @private
   */
  private getSecretsManagerKmsAlias() {
    return new DataAwsKmsAlias(this, 'kms_alias', {
      name: 'alias/aws/secretsmanager',
    });
  }

  /**
   * Create CodePipeline to build and deploy terraform and ecs
   * @param app
   * @private
   */
  private createApplicationCodePipeline(app: PocketALBApplication) {
    new PocketECSCodePipeline(this, 'code-pipeline', {
      prefix: config.prefix,
      source: {
        codeStarConnectionArn: config.codePipeline.githubConnectionArn,
        repository: config.codePipeline.repository,
        branchName: config.codePipeline.branch,
      },
    });
  }

  /**
   * Create PagerDuty service for alerts
   * @private
   */
  private createPagerDuty() {
    // don't create any pagerduty resources if in dev
    if (config.isDev) {
      return undefined;
    }

    const incidentManagement = new DataTerraformRemoteState(
      this,
      'incident_management',
      {
        organization: 'Pocket',
        workspaces: {
          name: 'incident-management',
        },
      }
    );

    return new PocketPagerDuty(this, 'pagerduty', {
      prefix: config.prefix,
      service: {
        criticalEscalationPolicyId: incidentManagement
          .get('policy_backend_critical_id')
          .toString(),
        nonCriticalEscalationPolicyId: incidentManagement
          .get('policy_backend_non_critical_id')
          .toString(),
      },
    });
  }

  private createPocketAlbApplication(dependencies: {
    pagerDuty: PocketPagerDuty;
    region: DataAwsRegion;
    caller: DataAwsCallerIdentity;
    secretsManagerKmsAlias: DataAwsKmsAlias;
    snsTopic: DataAwsSnsTopic;
    cache: { primaryEndpoint: string; readerEndpoint: string };
    dynamodb: DynamoDB;
  }): PocketALBApplication {
    const {
      region,
      caller,
      secretsManagerKmsAlias,
      snsTopic,
      cache,
      dynamodb,
    } = dependencies;

    const databaseSecretsArn = `arn:aws:secretsmanager:${region.name}:${caller.accountId}:secret:${config.name}/${config.environment}/READITLA_DB`;

    return new PocketALBApplication(this, 'application', {
      internal: true,
      prefix: config.prefix,
      alb6CharacterPrefix: config.shortName,
      tags: config.tags,
      cdn: false,
      domain: config.domain,
      containerConfigs: [
        {
          name: 'app',
          portMappings: [
            {
              hostPort: config.port,
              containerPort: config.port,
            },
          ],
          healthCheck: config.healthCheck,
          envVars: [
            {
              name: 'NODE_ENV',
              value: process.env.NODE_ENV,
            },
            {
              name: 'ENVIRONMENT',
              value: process.env.NODE_ENV, // this gives us a nice lowercase production and development
            },
            {
              name: 'REDIS_PRIMARY_ENDPOINT',
              value: cache.primaryEndpoint,
            },
            {
              name: 'REDIS_READER_ENDPOINT',
              value: cache.readerEndpoint,
            },
            {
              name: 'DATABASE_READ_PORT',
              value: config.envVars.databasePort,
            },
            {
              name: 'DATABASE_WRITE_PORT',
              value: config.envVars.databasePort,
            },
            {
              name: 'DATABASE_TZ',
              value: config.envVars.databaseTz,
            },
            {
              name: 'AWS_REGION',
              value: region.name,
            },
            {
              name: 'HIGHLIGHT_NOTES_TABLE',
              value: dynamodb.highlightNotesTable.dynamodb.name,
            },
            {
              name: 'HIGHLIGHT_NOTES_KEY',
              value: config.dynamodb.notesTable.key,
            },
            {
              name: 'HIGHLIGHT_NOTES_NOTE',
              value: config.dynamodb.notesTable.note,
            },
          ],
          secretEnvVars: [
            {
              name: 'SENTRY_DSN',
              valueFrom: `arn:aws:ssm:${region.name}:${caller.accountId}:parameter/${config.name}/${config.environment}/SENTRY_DSN`,
            },
            {
              name: 'DATABASE_READ_HOST',
              valueFrom: `${databaseSecretsArn}:read_host::`,
            },
            {
              name: 'DATABASE_READ_USER',
              valueFrom: `${databaseSecretsArn}:read_username::`,
            },
            {
              name: 'DATABASE_READ_PASSWORD',
              valueFrom: `${databaseSecretsArn}:read_password::`,
            },
            {
              name: 'DATABASE_WRITE_HOST',
              valueFrom: `${databaseSecretsArn}:write_host::`,
            },
            {
              name: 'DATABASE_WRITE_USER',
              valueFrom: `${databaseSecretsArn}:write_username::`,
            },
            {
              name: 'DATABASE_WRITE_PASSWORD',
              valueFrom: `${databaseSecretsArn}:write_password::`,
            },
          ],
        },
        {
          name: 'xray-daemon',
          containerImage: 'public.ecr.aws/xray/aws-xray-daemon:latest',
          portMappings: [
            {
              hostPort: 2000,
              containerPort: 2000,
              protocol: 'udp',
            },
          ],
          command: ['--region', 'us-east-1', '--local-mode'],
        },
      ],
      codeDeploy: {
        useCodeDeploy: true,
        useCodePipeline: true,
        snsNotificationTopicArn: snsTopic.arn,
        notifications: {
          //only notify on failed deploys
          notifyOnFailed: true,
          notifyOnStarted: false,
          notifyOnSucceeded: false,
        },
      },
      exposedContainer: {
        name: 'app',
        port: 4008,
        healthCheckPath: '/.well-known/apollo/server-health',
      },
      ecsIamConfig: {
        prefix: config.prefix,
        taskExecutionRolePolicyStatements: [
          //This policy could probably go in the shared module in the future.
          {
            actions: ['secretsmanager:GetSecretValue', 'kms:Decrypt'],
            resources: [
              `arn:aws:secretsmanager:${region.name}:${caller.accountId}:secret:Shared`,
              `arn:aws:secretsmanager:${region.name}:${caller.accountId}:secret:Shared/*`,
              secretsManagerKmsAlias.targetKeyArn,
              `arn:aws:secretsmanager:${region.name}:${caller.accountId}:secret:${config.name}/${config.environment}`,
              `arn:aws:secretsmanager:${region.name}:${caller.accountId}:secret:${config.name}/${config.environment}/*`,
              `arn:aws:secretsmanager:${region.name}:${caller.accountId}:secret:${config.prefix}`,
              `arn:aws:secretsmanager:${region.name}:${caller.accountId}:secret:${config.prefix}/*`,
            ],
            effect: 'Allow',
          },
          //This policy could probably go in the shared module in the future.
          {
            actions: ['ssm:GetParameter*'],
            resources: [
              `arn:aws:ssm:${region.name}:${caller.accountId}:parameter/${config.name}/${config.environment}`,
              `arn:aws:ssm:${region.name}:${caller.accountId}:parameter/${config.name}/${config.environment}/*`,
            ],
            effect: 'Allow',
          },
        ],
        taskRolePolicyStatements: [
          {
            actions: [
              'dynamodb:BatchGet*',
              'dynamodb:DescribeTable',
              'dynamodb:Get*',
              'dynamodb:Query',
              'dynamodb:Scan',
              'dynamodb:UpdateItem',
              'dynamodb:BatchWrite*',
              'dynamodb:Delete*',
              'dynamodb:PutItem',
            ],
            resources: [
              dynamodb.highlightNotesTable.dynamodb.arn,
              `${dynamodb.highlightNotesTable.dynamodb.arn}/*`,
            ],
            effect: 'Allow',
          },
          {
            actions: [
              'xray:PutTraceSegments',
              'xray:PutTelemetryRecords',
              'xray:GetSamplingRules',
              'xray:GetSamplingTargets',
              'xray:GetSamplingStatisticSummaries',
            ],
            resources: ['*'],
            effect: 'Allow',
          },
          {
            //no permission for batchReceive as we want only one message polled at a time
            actions: [
              'sqs:ReceiveMessage',
              'sqs:DeleteMessage',
              'sqs:SendMessage',
              'sqs:SendMessageBatch',
            ],
            resources: [
              `arn:aws:sqs:${region.name}:${caller.accountId}:${config.envVars.sqsBatchDeleteQueueName}`,
            ],
            effect: 'Allow',
          },
        ],
        taskExecutionDefaultAttachmentArn:
          'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy',
      },
      autoscalingConfig: {
        targetMinCapacity: 2,
        targetMaxCapacity: 10,
      },
      alarms: {
        //TODO: When you start using the service add the pagerduty arns as an action `pagerDuty.snsNonCriticalAlarmTopic.arn`
        http5xxErrorPercentage: {
          threshold: 25,
          evaluationPeriods: 4,
          period: 300,
          actions: config.isDev ? [] : [],
        },
      },
    });
  }
}

const app = new App();
new AnnotationsAPI(app, 'annotations-api');
app.synth();
