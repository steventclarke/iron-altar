import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks } from 'cdk-nag';
import { EnvironmentName } from '../config/environments';
import { ReleaseBucketStack } from '../lib/release-bucket-stack';
import { StaticSiteStack } from '../lib/static-site-stack';

const stackEnv = { account: '123456789012', region: 'us-east-2' };

function siteTemplate(environment: EnvironmentName): Template {
  const app = new cdk.App();
  const stack = new StaticSiteStack(app, `test-${environment}-site`, {
    env: stackEnv,
    environment,
  });
  return Template.fromStack(stack);
}

function releaseTemplate(environment: EnvironmentName): Template {
  const app = new cdk.App();
  const stack = new ReleaseBucketStack(app, `test-${environment}-release`, {
    env: stackEnv,
    environment,
  });
  return Template.fromStack(stack);
}

describe('StaticSiteStack', () => {
  test('creates a private, versioned, encrypted site bucket', () => {
    const template = siteTemplate('preview');

    template.resourceCountIs('AWS::S3::Bucket', 1);
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      VersioningConfiguration: { Status: 'Enabled' },
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          { ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } },
        ],
      },
    });
  });

  test('creates a CloudFront distribution with SPA fallback and TLS 1.2', () => {
    const template = siteTemplate('preview');

    template.resourceCountIs('AWS::CloudFront::Distribution', 1);
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultRootObject: 'index.html',
        ViewerCertificate: Match.objectLike({
          MinimumProtocolVersion: 'TLSv1.2_2021',
        }),
        CustomErrorResponses: Match.arrayWith([
          Match.objectLike({
            ErrorCode: 403,
            ResponseCode: 200,
            ResponsePagePath: '/index.html',
          }),
          Match.objectLike({
            ErrorCode: 404,
            ResponseCode: 200,
            ResponsePagePath: '/index.html',
          }),
        ]),
      }),
    });
    template.resourceCountIs('AWS::CloudFront::Function', 1);
    template.hasResourceProperties('AWS::CloudFront::Function', {
      FunctionConfig: Match.objectLike({
        Runtime: 'cloudfront-js-2.0',
      }),
    });
  });

  test('disables compression cache keys when caching is disabled', () => {
    const template = siteTemplate('preview');

    template.hasResourceProperties('AWS::CloudFront::CachePolicy', {
      CachePolicyConfig: Match.objectLike({
        Name: 'iron-altar-preview-site-no-cache',
        DefaultTTL: 0,
        MaxTTL: 0,
        MinTTL: 0,
        ParametersInCacheKeyAndForwardedToOrigin: Match.objectLike({
          EnableAcceptEncodingGzip: false,
          EnableAcceptEncodingBrotli: false,
        }),
      }),
    });
  });

  test('creates A and AAAA alias records', () => {
    const template = siteTemplate('preview');

    template.resourceCountIs('AWS::Route53::RecordSet', 2);
    template.hasResourceProperties('AWS::Route53::RecordSet', {
      Type: 'A',
      AliasTarget: Match.objectLike({
        DNSName: Match.anyValue(),
        HostedZoneId: Match.anyValue(),
      }),
    });
    template.hasResourceProperties('AWS::Route53::RecordSet', {
      Type: 'AAAA',
      AliasTarget: Match.objectLike({
        DNSName: Match.anyValue(),
        HostedZoneId: Match.anyValue(),
      }),
    });
  });

  test('creates a public PKCE client for Google sign-in', () => {
    const template = siteTemplate('preview');

    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      GenerateSecret: false,
      AllowedOAuthFlowsUserPoolClient: true,
      AllowedOAuthFlows: ['code'],
      AllowedOAuthScopes: Match.arrayWith(['openid', 'email', 'profile']),
      SupportedIdentityProviders: ['Google'],
      CallbackURLs: Match.arrayWith(['ironaltar://auth/callback']),
      LogoutURLs: Match.arrayWith(['http://localhost:8081/']),
      AccessTokenValidity: 60,
      IdTokenValidity: 60,
      RefreshTokenValidity: 43200,
    });
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      CallbackURLs: Match.arrayWith(['http://localhost:8081/auth/callback']),
    });
    const clients = JSON.stringify(template.findResources('AWS::Cognito::UserPoolClient'));
    expect(clients).toContain('https://iron-altar-preview.');
    expect(clients).toContain('/auth/callback');

    const prodClients = JSON.stringify(
      siteTemplate('prod').findResources('AWS::Cognito::UserPoolClient'),
    );
    expect(prodClients).toContain('https://iron-altar.');
    expect(prodClients).not.toContain('localhost');
    template.hasOutput('AuthClientId', {});
  });

  test('sets a CSP that allows the auth domain and Google avatars', () => {
    const template = siteTemplate('preview');

    const policies = JSON.stringify(
      template.findResources('AWS::CloudFront::ResponseHeadersPolicy'),
    );
    expect(policies).toContain("default-src 'self'");
    expect(policies).toContain('https://accounts.google.com');
    expect(policies).toContain('https://*.googleusercontent.com');
    expect(policies).toContain('form-action');
  });

  test('marks preview responses noindex and leaves prod indexable', () => {
    const preview = siteTemplate('preview');
    preview.hasResourceProperties('AWS::CloudFront::ResponseHeadersPolicy', {
      ResponseHeadersPolicyConfig: Match.objectLike({
        CustomHeadersConfig: {
          Items: Match.arrayWith([
            Match.objectLike({
              Header: 'X-Robots-Tag',
              Value: 'noindex, nofollow',
            }),
          ]),
        },
      }),
    });

    const prod = siteTemplate('prod');
    const policies = prod.findResources('AWS::CloudFront::ResponseHeadersPolicy');
    expect(JSON.stringify(policies)).not.toContain('X-Robots-Tag');
  });
});

describe('ReleaseBucketStack', () => {
  test('creates a retained, versioned, encrypted release bucket', () => {
    const template = releaseTemplate('prod');

    template.resourceCountIs('AWS::S3::Bucket', 1);
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      VersioningConfiguration: { Status: 'Enabled' },
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          { ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } },
        ],
      },
      LifecycleConfiguration: {
        Rules: Match.arrayWith([
          Match.objectLike({
            AbortIncompleteMultipartUpload: { DaysAfterInitiation: 7 },
          }),
        ]),
      },
    });
    template.hasResource('AWS::S3::Bucket', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
    });
  });
});

describe('cdk-nag', () => {
  test('preview and prod site stacks have no AwsSolutions violations', () => {
    for (const environment of ['preview', 'prod'] as const) {
      const app = new cdk.App();
      const pack = new AwsSolutionsChecks(app);
      new StaticSiteStack(app, `nag-${environment}-site`, {
        env: stackEnv,
        environment,
      });

      expect(pack.validateScope(app).violations).toHaveLength(0);
    }
  });

  test('release bucket stack has no AwsSolutions violations', () => {
    const app = new cdk.App();
    const pack = new AwsSolutionsChecks(app);
    new ReleaseBucketStack(app, 'nag-prod-release', {
      env: stackEnv,
      environment: 'prod',
    });

    expect(pack.validateScope(app).violations).toHaveLength(0);
  });
});
