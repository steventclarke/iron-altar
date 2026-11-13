#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { environments, EnvironmentName } from '../config/environments';
import { ReleaseBucketStack } from '../lib/release-bucket-stack';
import { StaticSiteStack } from '../lib/static-site-stack';

const app = new cdk.App();

const environment = (app.node.tryGetContext('environment') ?? 'preview') as EnvironmentName;
if (!(environment in environments)) {
  throw new Error(
    `Unknown environment "${environment}". Use -c environment=preview or -c environment=prod.`,
  );
}

const config = environments[environment];
const stackEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-east-2',
};

new StaticSiteStack(app, config.stackName, {
  env: stackEnv,
  environment,
  description: `Iron Altar ${environment} static site`,
});

if (config.releaseStackName) {
  new ReleaseBucketStack(app, config.releaseStackName, {
    env: stackEnv,
    environment,
    description: `Iron Altar ${environment} mobile release bucket`,
  });
}

cdk.Validations.of(app).addPlugins(new AwsSolutionsChecks(app, { verbose: true }));
