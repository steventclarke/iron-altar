import * as cdk from 'aws-cdk-lib';

export type EnvironmentName = 'preview' | 'prod';

export const appName = 'iron-altar';

export const ssmPaths = {
  domainName: '/platform/dns/domain-name',
  hostedZoneId: '/platform/dns/hosted-zone-id',
  certificateArn: '/platform/certs/us-east-1/wildcard-arn',
  previewDeployRoleArn: '/platform/roles/iron-altar/preview/deploy-role-arn',
  prodDeployRoleArn: '/platform/roles/iron-altar/prod/deploy-role-arn',
} as const;

export interface AppEnvironment {
  readonly name: EnvironmentName;
  readonly production: boolean;
  readonly stackName: string;
  readonly releaseStackName?: string;
  readonly hostnamePrefix: string;
  readonly removalPolicy: cdk.RemovalPolicy;
}

export const environments: Record<EnvironmentName, AppEnvironment> = {
  preview: {
    name: 'preview',
    production: false,
    stackName: 'iron-altar-preview-site',
    hostnamePrefix: 'iron-altar-preview',
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  },
  prod: {
    name: 'prod',
    production: true,
    stackName: 'iron-altar-prod-site',
    releaseStackName: 'iron-altar-prod-release',
    hostnamePrefix: 'iron-altar',
    removalPolicy: cdk.RemovalPolicy.RETAIN,
  },
};

export const resourceTags = {
  project: appName,
  owner: 'steventclarke',
  application: appName,
  'managed-by': 'cdk',
} as const;

export function applyTags(scope: cdk.Stack, environment: EnvironmentName): void {
  for (const [key, value] of Object.entries(resourceTags)) {
    cdk.Tags.of(scope).add(key, value);
  }
  cdk.Tags.of(scope).add('environment', environment);
  cdk.Tags.of(scope).add('Environment', environment);
}
