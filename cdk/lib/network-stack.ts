import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly albTargetGroup: elbv2.ApplicationTargetGroup;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC 생성
    this.vpc = new ec2.Vpc(this, 'FastScalingVpc', {
      maxAzs: 3,
      cidr: '10.0.0.0/16',
      natGateways: 1, // 비용 최적화를 위해 1개만 사용
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    // ALB 보안 그룹
    const albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Application Load Balancer',
      allowAllOutbound: true,
    });

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP traffic'
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS traffic'
    );

    // Application Load Balancer
    this.alb = new elbv2.ApplicationLoadBalancer(this, 'FastScalingAlb', {
      vpc: this.vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
      loadBalancerName: 'fast-scaling-alb',
    });

    // ALB 액세스 로그 활성화
    const accessLogBucket = new cdk.aws_s3.Bucket(this, 'AlbAccessLogBucket', {
      bucketName: `fast-scaling-alb-logs-${this.account}-${this.region}`,
      encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: 'DeleteOldLogs',
          expiration: cdk.Duration.days(30),
        },
      ],
    });

    this.alb.logAccessLogs(accessLogBucket, 'alb-access-logs');

    // Target Group 생성 (ECS 서비스용)
    this.albTargetGroup = new elbv2.ApplicationTargetGroup(this, 'EcsTargetGroup', {
      vpc: this.vpc,
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        enabled: true,
        healthyHttpCodes: '200',
        interval: cdk.Duration.seconds(5), // 5초 간격 헬스체크
        timeout: cdk.Duration.seconds(4),
        healthyThresholdCount: 2, // 2회 성공 시 healthy
        unhealthyThresholdCount: 2, // 2회 실패 시 unhealthy
        path: '/health',
        protocol: elbv2.Protocol.HTTP,
      },
      deregistrationDelay: cdk.Duration.seconds(10), // 빠른 deregistration
    });

    // ALB 리스너
    const listener = this.alb.addListener('HttpListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultTargetGroups: [this.albTargetGroup],
    });

    // CloudWatch 로그 그룹 (ECS용)
    const ecsLogGroup = new logs.LogGroup(this, 'EcsLogGroup', {
      logGroupName: '/ecs/fast-scaling-app',
      retention: logs.RetentionDays.ONE_WEEK,
    });

    // VPC Endpoints (비용 최적화를 위해 선택적 사용)
    // ECR과 CloudWatch Logs를 위한 VPC Endpoints
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    // Outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: 'FastScaling-VpcId',
    });

    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: this.alb.loadBalancerDnsName,
      description: 'ALB DNS Name',
      exportName: 'FastScaling-AlbDnsName',
    });

    new cdk.CfnOutput(this, 'AlbArn', {
      value: this.alb.loadBalancerArn,
      description: 'ALB ARN',
      exportName: 'FastScaling-AlbArn',
    });

    new cdk.CfnOutput(this, 'TargetGroupArn', {
      value: this.albTargetGroup.targetGroupArn,
      description: 'Target Group ARN',
      exportName: 'FastScaling-TargetGroupArn',
    });

    new cdk.CfnOutput(this, 'EcsLogGroupName', {
      value: ecsLogGroup.logGroupName,
      description: 'ECS Log Group Name',
      exportName: 'FastScaling-EcsLogGroupName',
    });
  }
}