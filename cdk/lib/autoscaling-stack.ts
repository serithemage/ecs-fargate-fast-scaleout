import * as cdk from 'aws-cdk-lib';
import * as applicationautoscaling from 'aws-cdk-lib/aws-applicationautoscaling';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface AutoScalingStackProps extends cdk.StackProps {
  ecsService: ecs.FargateService;
  alarms: {
    highCpuAlarm: cloudwatch.Alarm;
    highMemoryAlarm: cloudwatch.Alarm;
    highRequestRateAlarm: cloudwatch.Alarm;
    highResponseTimeAlarm: cloudwatch.Alarm;
    customRpsAlarm: cloudwatch.Alarm;
  };
}

export class AutoScalingStack extends cdk.Stack {
  public readonly scalingTarget: applicationautoscaling.ScalableTarget;
  public readonly scaleOutPolicy: applicationautoscaling.StepScalingPolicy;
  public readonly scaleInPolicy: applicationautoscaling.StepScalingPolicy;

  constructor(scope: Construct, id: string, props: AutoScalingStackProps) {
    super(scope, id, props);

    const { ecsService, alarms } = props;

    // Auto Scaling 대상 설정
    this.scalingTarget = new applicationautoscaling.ScalableTarget(this, 'EcsScalingTarget', {
      serviceNamespace: applicationautoscaling.ServiceNamespace.ECS,
      resourceId: `service/${ecsService.cluster.clusterName}/${ecsService.serviceName}`,
      scalableDimension: 'ecs:service:DesiredCount',
      minCapacity: 2,
      maxCapacity: 100,
      role: iam.Role.fromRoleArn(
        this,
        'ApplicationAutoScalingECSServiceRole',
        `arn:aws:iam::${this.account}:role/aws-service-role/ecs.application-autoscaling.amazonaws.com/AWSServiceRoleForApplicationAutoScaling_ECSService`
      ),
    });

    // === Step Scaling 정책 - Scale Out (확장) ===
    this.scaleOutPolicy = new applicationautoscaling.StepScalingPolicy(this, 'ScaleOutPolicy', {
      scalingTarget: this.scalingTarget,
      policyName: 'FastScaling-ScaleOut',
      adjustmentType: applicationautoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
      cooldown: cdk.Duration.seconds(10), // 10초 쿨다운 (매우 빠른 반응)
      metricAggregationType: applicationautoscaling.MetricAggregationType.AVERAGE,
      stepAdjustments: [
        {
          // RPS 100-150: +1 태스크
          metricIntervalLowerBound: 0,
          metricIntervalUpperBound: 50,
          scalingAdjustment: 1,
        },
        {
          // RPS 150-200: +2 태스크
          metricIntervalLowerBound: 50,
          metricIntervalUpperBound: 100,
          scalingAdjustment: 2,
        },
        {
          // RPS 200+: +4 태스크
          metricIntervalLowerBound: 100,
          scalingAdjustment: 4,
        },
      ],
    });

    // === Step Scaling 정책 - Scale In (축소) ===
    this.scaleInPolicy = new applicationautoscaling.StepScalingPolicy(this, 'ScaleInPolicy', {
      scalingTarget: this.scalingTarget,
      policyName: 'FastScaling-ScaleIn',
      adjustmentType: applicationautoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
      cooldown: cdk.Duration.seconds(300), // 5분 쿨다운 (보수적 축소)
      metricAggregationType: applicationautoscaling.MetricAggregationType.AVERAGE,
      stepAdjustments: [
        {
          // RPS가 50 이하로 떨어질 때 -1 태스크
          metricIntervalUpperBound: 0,
          scalingAdjustment: -1,
        },
      ],
    });

    // === 추가 스케일링 정책들 ===

    // CPU 기반 스케일링 정책
    const cpuScaleOutPolicy = new applicationautoscaling.StepScalingPolicy(this, 'CpuScaleOutPolicy', {
      scalingTarget: this.scalingTarget,
      policyName: 'FastScaling-CpuScaleOut',
      adjustmentType: applicationautoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
      cooldown: cdk.Duration.seconds(60),
      metricAggregationType: applicationautoscaling.MetricAggregationType.AVERAGE,
      stepAdjustments: [
        {
          metricIntervalLowerBound: 0,
          metricIntervalUpperBound: 20, // 70-90% CPU
          scalingAdjustment: 1,
        },
        {
          metricIntervalLowerBound: 20, // 90%+ CPU
          scalingAdjustment: 2,
        },
      ],
    });

    // 메모리 기반 스케일링 정책
    const memoryScaleOutPolicy = new applicationautoscaling.StepScalingPolicy(this, 'MemoryScaleOutPolicy', {
      scalingTarget: this.scalingTarget,
      policyName: 'FastScaling-MemoryScaleOut',
      adjustmentType: applicationautoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
      cooldown: cdk.Duration.seconds(60),
      metricAggregationType: applicationautoscaling.MetricAggregationType.AVERAGE,
      stepAdjustments: [
        {
          metricIntervalLowerBound: 0,
          scalingAdjustment: 2, // 메모리 부족은 더 적극적으로 확장
        },
      ],
    });

    // === 알람과 스케일링 정책 연결 ===

    // 커스텀 RPS 알람 - 주요 스케일링 트리거
    alarms.customRpsAlarm.addAlarmAction(
      new applicationautoscaling.StepScalingAction(this.scaleOutPolicy)
    );

    // RPS 감소에 대한 스케일 인 알람 생성
    const lowRpsAlarm = new cloudwatch.Alarm(this, 'LowRpsAlarm', {
      alarmName: 'FastScaling-LowRPS',
      alarmDescription: 'Low requests per second - scale in trigger',
      metric: new cloudwatch.Metric({
        namespace: 'FastScaling/Application',
        metricName: 'RequestsPerSecond',
        statistic: 'Average',
        period: cdk.Duration.seconds(60), // 스케일 인은 더 긴 주기로 측정
      }),
      threshold: 50,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods: 3, // 3분 연속 낮은 RPS 시 스케일 인
      dataPointsToAlarm: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    lowRpsAlarm.addAlarmAction(
      new applicationautoscaling.StepScalingAction(this.scaleInPolicy)
    );

    // CPU 알람 연결
    alarms.highCpuAlarm.addAlarmAction(
      new applicationautoscaling.StepScalingAction(cpuScaleOutPolicy)
    );

    // 메모리 알람 연결
    alarms.highMemoryAlarm.addAlarmAction(
      new applicationautoscaling.StepScalingAction(memoryScaleOutPolicy)
    );

    // === Target Tracking 스케일링 (보조적 역할) ===
    
    // CPU 기반 Target Tracking (백업용)
    this.scalingTarget.scaleToTrackMetric('CpuTargetTracking', {
      targetValue: 60,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'CPUUtilization',
        dimensionsMap: {
          ServiceName: ecsService.serviceName,
          ClusterName: ecsService.cluster.clusterName,
        },
        statistic: 'Average',
      }),
      scaleInCooldown: cdk.Duration.seconds(300),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // === 예측적 스케일링 (Scheduled Scaling) ===
    
    // 비즈니스 시간 대비 사전 스케일링
    this.scalingTarget.scaleOnSchedule('MorningScaleOut', {
      schedule: applicationautoscaling.Schedule.cron({
        hour: '8',
        minute: '30',
      }),
      minCapacity: 5, // 아침 9시 전에 미리 확장
      maxCapacity: 100,
    });

    // 야간 시간 스케일 다운
    this.scalingTarget.scaleOnSchedule('EveningScaleIn', {
      schedule: applicationautoscaling.Schedule.cron({
        hour: '22',
        minute: '0',
      }),
      minCapacity: 2, // 밤 10시 이후 최소 유지
      maxCapacity: 100,
    });

    // 주말 최소 운영
    this.scalingTarget.scaleOnSchedule('WeekendScaleDown', {
      schedule: applicationautoscaling.Schedule.cron({
        hour: '23',
        minute: '0',
        weekDay: 'FRI',
      }),
      minCapacity: 1, // 주말은 최소 운영
      maxCapacity: 100,
    });

    this.scalingTarget.scaleOnSchedule('WeekendScaleUp', {
      schedule: applicationautoscaling.Schedule.cron({
        hour: '7',
        minute: '0',
        weekDay: 'MON',
      }),
      minCapacity: 2, // 월요일 아침 복원
      maxCapacity: 100,
    });

    // === CloudWatch 커스텀 메트릭 (스케일링 이벤트 추적) ===
    
    new cloudwatch.Metric({
      namespace: 'FastScaling/AutoScaling',
      metricName: 'ScalingEvents',
      dimensionsMap: {
        ServiceName: ecsService.serviceName,
      },
    });

    // Outputs
    new cdk.CfnOutput(this, 'ScalingTargetId', {
      value: this.scalingTarget.scalableTargetId,
      description: 'Auto Scaling Target ID',
      exportName: 'FastScaling-ScalingTargetId',
    });

    new cdk.CfnOutput(this, 'ScaleOutPolicyName', {
      value: this.scaleOutPolicy.scalingPolicyName,
      description: 'Scale Out Policy Name',
      exportName: 'FastScaling-ScaleOutPolicyName',
    });

    new cdk.CfnOutput(this, 'ScaleInPolicyName', {
      value: this.scaleInPolicy.scalingPolicyName,
      description: 'Scale In Policy Name',
      exportName: 'FastScaling-ScaleInPolicyName',
    });

    new cdk.CfnOutput(this, 'LowRpsAlarmName', {
      value: lowRpsAlarm.alarmName,
      description: 'Low RPS Alarm Name for Scale In',
      exportName: 'FastScaling-LowRpsAlarmName',
    });

    // 태그 추가
    cdk.Tags.of(this.scalingTarget).add('Component', 'AutoScaling');
  }
}