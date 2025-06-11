#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network-stack';
import { EcsStack } from '../lib/ecs-stack';
import { MonitoringStack } from '../lib/monitoring-stack';
import { AutoScalingStack } from '../lib/autoscaling-stack';

const app = new cdk.App();

// 환경 설정
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-2',
};

// 네트워크 스택 (VPC, ALB)
const networkStack = new NetworkStack(app, 'EcsFastScaling-Network', {
  env,
  description: 'Network infrastructure for ECS fast scaling solution',
});

// ECS 스택 (클러스터, 서비스, 태스크 정의)
const ecsStack = new EcsStack(app, 'EcsFastScaling-Ecs', {
  env,
  description: 'ECS Fargate cluster and service for fast scaling',
  vpc: networkStack.vpc,
  alb: networkStack.alb,
  albTargetGroup: networkStack.albTargetGroup,
});

// 모니터링 스택 (CloudWatch 메트릭, 알람)
const monitoringStack = new MonitoringStack(app, 'EcsFastScaling-Monitoring', {
  env,
  description: 'CloudWatch monitoring and alarms for fast scaling',
  ecsService: ecsStack.ecsService,
  alb: networkStack.alb,
  albTargetGroup: networkStack.albTargetGroup,
});

// 오토스케일링 스택 (스케일링 정책)
const autoScalingStack = new AutoScalingStack(app, 'EcsFastScaling-AutoScaling', {
  env,
  description: 'Auto scaling policies for fast response',
  ecsService: ecsStack.ecsService,
  alarms: monitoringStack.alarms,
});

// 스택 간 의존성 설정
ecsStack.addDependency(networkStack);
monitoringStack.addDependency(ecsStack);
autoScalingStack.addDependency(monitoringStack);

// 태깅
cdk.Tags.of(app).add('Project', 'ECS-Fargate-Fast-Scaling');
cdk.Tags.of(app).add('Environment', 'dev');
cdk.Tags.of(app).add('Owner', 'DevOps');