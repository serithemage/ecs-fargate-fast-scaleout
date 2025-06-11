import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface EcsStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  alb: elbv2.ApplicationLoadBalancer;
  albTargetGroup: elbv2.ApplicationTargetGroup;
}

export class EcsStack extends cdk.Stack {
  public readonly ecsCluster: ecs.Cluster;
  public readonly ecsService: ecs.FargateService;
  public readonly taskDefinition: ecs.FargateTaskDefinition;

  constructor(scope: Construct, id: string, props: EcsStackProps) {
    super(scope, id, props);

    const { vpc, alb, albTargetGroup } = props;

    // ECS 클러스터
    this.ecsCluster = new ecs.Cluster(this, 'FastScalingCluster', {
      vpc,
      clusterName: 'fast-scaling-cluster',
      containerInsights: true,
    });

    // ECS 태스크 실행 역할
    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // ECS 태스크 역할 (CloudWatch 메트릭 발행 권한 포함)
    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      inlinePolicies: {
        CloudWatchMetrics: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'cloudwatch:PutMetricData',
                'cloudwatch:GetMetricStatistics',
                'cloudwatch:ListMetrics',
              ],
              resources: ['*'],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    // 태스크 정의
    this.taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDefinition', {
      family: 'fast-scaling-app',
      cpu: 256,
      memoryLimitMiB: 512,
      executionRole: taskExecutionRole,
      taskRole: taskRole,
    });

    // 컨테이너 로그 그룹
    const logGroup = new logs.LogGroup(this, 'AppLogGroup', {
      logGroupName: '/ecs/fast-scaling-app',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 애플리케이션 컨테이너
    const appContainer = this.taskDefinition.addContainer('AppContainer', {
      // 나중에 ECR 이미지로 교체할 예정
      image: ecs.ContainerImage.fromRegistry('nginx:alpine'),
      logging: ecs.LogDrivers.awsLogs({
        logGroup,
        streamPrefix: 'app',
      }),
      environment: {
        NODE_ENV: 'production',
        AWS_REGION: this.region,
        CLOUDWATCH_NAMESPACE: 'FastScaling/Application',
      },
      portMappings: [
        {
          containerPort: 8080,
          protocol: ecs.Protocol.TCP,
        },
      ],
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:8080/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // ECS 서비스 보안 그룹
    const ecsSecurityGroup = new ec2.SecurityGroup(this, 'EcsSecurityGroup', {
      vpc,
      description: 'Security group for ECS tasks',
      allowAllOutbound: true,
    });

    // ALB에서 ECS로의 트래픽 허용
    ecsSecurityGroup.addIngressRule(
      ec2.Peer.securityGroupId(alb.connections.securityGroups[0].securityGroupId),
      ec2.Port.tcp(8080),
      'Allow traffic from ALB'
    );

    // ECS 서비스
    this.ecsService = new ecs.FargateService(this, 'EcsService', {
      cluster: this.ecsCluster,
      taskDefinition: this.taskDefinition,
      serviceName: 'fast-scaling-service',
      desiredCount: 2, // 최소 2개 태스크로 시작
      minHealthyPercent: 50,
      maxHealthyPercent: 200,
      securityGroups: [ecsSecurityGroup],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      enableLogging: true,
      platformVersion: ecs.FargatePlatformVersion.LATEST,
      deploymentConfiguration: {
        minimumHealthyPercent: 50,
        maximumPercent: 200,
        deploymentCircuitBreaker: {
          enable: true,
          rollback: true,
        },
      },
      enableExecuteCommand: true, // 디버깅을 위한 ECS Exec 활성화
    });

    // ALB 타겟 그룹에 ECS 서비스 연결
    this.ecsService.attachToApplicationTargetGroup(albTargetGroup);

    // Auto Scaling 설정 (기본 설정, 나중에 AutoScalingStack에서 정책 추가)
    const autoScalingGroup = this.ecsService.autoScaleTaskCount({
      minCapacity: 2,
      maxCapacity: 100,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ClusterName', {
      value: this.ecsCluster.clusterName,
      description: 'ECS Cluster Name',
      exportName: 'FastScaling-ClusterName',
    });

    new cdk.CfnOutput(this, 'ServiceName', {
      value: this.ecsService.serviceName,
      description: 'ECS Service Name',
      exportName: 'FastScaling-ServiceName',
    });

    new cdk.CfnOutput(this, 'ServiceArn', {
      value: this.ecsService.serviceArn,
      description: 'ECS Service ARN',
      exportName: 'FastScaling-ServiceArn',
    });

    new cdk.CfnOutput(this, 'TaskDefinitionArn', {
      value: this.taskDefinition.taskDefinitionArn,
      description: 'Task Definition ARN',
      exportName: 'FastScaling-TaskDefinitionArn',
    });

    // 태그 추가
    cdk.Tags.of(this.ecsCluster).add('Component', 'ECS-Cluster');
    cdk.Tags.of(this.ecsService).add('Component', 'ECS-Service');
  }
}