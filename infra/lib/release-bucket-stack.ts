import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { applyTags, environments, EnvironmentName } from '../config/environments';

export interface ReleaseBucketStackProps extends cdk.StackProps {
  readonly environment: EnvironmentName;
}

export class ReleaseBucketStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ReleaseBucketStackProps) {
    super(scope, id, props);

    const config = environments[props.environment];

    const releaseBucket = new s3.Bucket(this, 'ReleaseBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
      ],
    });

    new cdk.CfnOutput(this, 'ReleaseBucketName', {
      value: releaseBucket.bucketName,
    });

    applyTags(this, config.name);

    cdk.Validations.of(releaseBucket).acknowledge({
      id: 'AwsSolutions-S1',
      reason: 'Mobile release artifacts are low-volume; access logging is not required.',
    });
  }
}
