import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { applyTags, environments, EnvironmentName, ssmPaths } from '../config/environments';

export interface StaticSiteStackProps extends cdk.StackProps {
  readonly environment: EnvironmentName;
}

export class StaticSiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: StaticSiteStackProps) {
    super(scope, id, props);

    const config = environments[props.environment];

    const domainName = ssm.StringParameter.valueForTypedStringParameterV2(
      this,
      ssmPaths.domainName,
    );
    const hostedZoneId = ssm.StringParameter.valueForTypedStringParameterV2(
      this,
      ssmPaths.hostedZoneId,
    );
    const certificateArn = ssm.StringParameter.valueForTypedStringParameterV2(
      this,
      ssmPaths.certificateArn,
    );
    const hostname = `${config.hostnamePrefix}.${domainName}`;

    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      removalPolicy: config.removalPolicy,
    });

    const origin = origins.S3BucketOrigin.withOriginAccessControl(siteBucket);

    const immutableCachePolicy = new cloudfront.CachePolicy(this, 'ImmutableCachePolicy', {
      cachePolicyName: `${config.stackName}-immutable`,
      comment: 'Immutable cache for hashed Expo bundles',
      defaultTtl: cdk.Duration.days(365),
      maxTtl: cdk.Duration.days(365),
      minTtl: cdk.Duration.seconds(1),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    const assetCachePolicy = new cloudfront.CachePolicy(this, 'AssetCachePolicy', {
      cachePolicyName: `${config.stackName}-assets`,
      comment: 'Short cache for non-hashed static assets',
      defaultTtl: cdk.Duration.hours(1),
      maxTtl: cdk.Duration.hours(1),
      minTtl: cdk.Duration.seconds(0),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    const noCachePolicy = new cloudfront.CachePolicy(this, 'NoCachePolicy', {
      cachePolicyName: `${config.stackName}-no-cache`,
      comment: 'No cache for HTML and deployment metadata',
      defaultTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.seconds(0),
      minTtl: cdk.Duration.seconds(0),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
      this,
      'SecurityHeadersPolicy',
      {
        responseHeadersPolicyName: `${config.stackName}-security-headers`,
        securityHeadersBehavior: {
          contentTypeOptions: { override: true },
          frameOptions: {
            frameOption: cloudfront.HeadersFrameOption.DENY,
            override: true,
          },
          referrerPolicy: {
            referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
            override: true,
          },
          strictTransportSecurity: {
            accessControlMaxAge: cdk.Duration.days(365),
            includeSubdomains: true,
            preload: true,
            override: true,
          },
          xssProtection: { protection: true, modeBlock: true, override: true },
        },
        customHeadersBehavior: config.production
          ? undefined
          : {
              customHeaders: [
                {
                  header: 'X-Robots-Tag',
                  value: 'noindex, nofollow',
                  override: true,
                },
              ],
            },
      },
    );

    const spaRewriteFunction = new cloudfront.Function(this, 'SpaRewriteFunction', {
      functionName: `${config.stackName}-spa-rewrite`,
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(`function handler(event) {
  var request = event.request;
  var uri = request.uri;
  var lastSegment = uri.substring(uri.lastIndexOf('/') + 1);
  if (lastSegment.indexOf('.') === -1) {
    request.uri = '/index.html';
  }
  return request;
}`),
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `Iron Altar ${config.name} static site`,
      defaultRootObject: 'index.html',
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      defaultBehavior: {
        origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: noCachePolicy,
        responseHeadersPolicy,
        compress: true,
        functionAssociations: [
          {
            function: spaRewriteFunction,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      additionalBehaviors: {
        '/_expo/static/*': {
          origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: immutableCachePolicy,
          responseHeadersPolicy,
          compress: true,
        },
        '/assets/*': {
          origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: assetCachePolicy,
          responseHeadersPolicy,
          compress: true,
        },
        '*.html': {
          origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: noCachePolicy,
          responseHeadersPolicy,
          compress: true,
        },
        '/deployment.json': {
          origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: noCachePolicy,
          responseHeadersPolicy,
          compress: true,
        },
      },
      domainNames: [hostname],
      certificate: acm.Certificate.fromCertificateArn(this, 'SiteCertificate', certificateArn),
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId,
      zoneName: domainName,
    });
    const cloudFrontTarget = route53.RecordTarget.fromAlias(
      new targets.CloudFrontTarget(distribution),
    );

    new route53.ARecord(this, 'AliasRecord', {
      zone,
      recordName: hostname,
      target: cloudFrontTarget,
    });
    new route53.AaaaRecord(this, 'AliasRecordIpv6', {
      zone,
      recordName: hostname,
      target: cloudFrontTarget,
    });

    new cdk.CfnOutput(this, 'BucketName', { value: siteBucket.bucketName });
    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
    });
    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
    });
    new cdk.CfnOutput(this, 'SiteUrl', { value: `https://${hostname}` });

    applyTags(this, config.name);

    cdk.Validations.of(siteBucket).acknowledge({
      id: 'AwsSolutions-S1',
      reason:
        'Static site bucket access logs are not required; CloudFront logging is deferred to keep costs within budget.',
    });

    cdk.Validations.of(distribution).acknowledge(
      {
        id: 'AwsSolutions-CFR1',
        reason: 'Public static app; geo restrictions are not required.',
      },
      {
        id: 'AwsSolutions-CFR2',
        reason: 'No WAF for a low-traffic static site; keeps costs within budget.',
      },
      {
        id: 'AwsSolutions-CFR3',
        reason:
          'Access logging is not required for this low-traffic static site; keeps costs within budget.',
      },
      {
        id: 'CloudFormation-Validate::E3013',
        reason:
          'CloudFront aliases are resolved from the platform SSM domain-name parameter at deploy time; the synthesized placeholder is not a literal domain name.',
      },
    );
  }
}
