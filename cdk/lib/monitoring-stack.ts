import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  ecsService: ecs.FargateService;
  alb: elbv2.ApplicationLoadBalancer;
  albTargetGroup: elbv2.ApplicationTargetGroup;
}

export class MonitoringStack extends cdk.Stack {
  public readonly alarms: {
    highCpuAlarm: cloudwatch.Alarm;
    highMemoryAlarm: cloudwatch.Alarm;
    highRequestRateAlarm: cloudwatch.Alarm;
    highResponseTimeAlarm: cloudwatch.Alarm;
    customRpsAlarm: cloudwatch.Alarm;
  };

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { ecsService, alb, albTargetGroup } = props;

    // SNS 토픽 (알림용)
    const alertTopic = new sns.Topic(this, 'FastScalingAlerts', {
      topicName: 'fast-scaling-alerts',
      displayName: 'Fast Scaling Alerts',
    });

    // 이메일 구독 (실제 사용 시 이메일 주소 설정 필요)
    // alertTopic.addSubscription(
    //   new snsSubscriptions.EmailSubscription('your-email@example.com')
    // );

    // CloudWatch 대시보드
    const dashboard = new cloudwatch.Dashboard(this, 'FastScalingDashboard', {
      dashboardName: 'Fast-Scaling-Monitoring',
    });

    // 커스텀 메트릭 네임스페이스
    const customMetricNamespace = 'FastScaling/Application';

    // === 커스텀 메트릭 ===

    // 커스텀 RPS 메트릭 (애플리케이션에서 발행)
    const customRpsMetric = new cloudwatch.Metric({
      namespace: customMetricNamespace,
      metricName: 'RequestsPerSecond',
      statistic: 'Average',
      period: cdk.Duration.seconds(10), // 10초 주기
    });

    // 커스텀 응답 시간 메트릭
    const customResponseTimeMetric = new cloudwatch.Metric({
      namespace: customMetricNamespace,
      metricName: 'AverageResponseTime',
      statistic: 'Average',
      period: cdk.Duration.seconds(10),
    });

    // 커스텀 활성 연결 수 메트릭
    const customActiveConnectionsMetric = new cloudwatch.Metric({
      namespace: customMetricNamespace,
      metricName: 'ActiveConnections',
      statistic: 'Average',
      period: cdk.Duration.seconds(10),
    });

    // === ECS 메트릭 ===

    // CPU 사용률
    const cpuMetric = new cloudwatch.Metric({
      namespace: 'AWS/ECS',
      metricName: 'CPUUtilization',
      dimensionsMap: {
        ServiceName: ecsService.serviceName,
        ClusterName: ecsService.cluster.clusterName,
      },
      statistic: 'Average',
      period: cdk.Duration.seconds(60),
    });

    // 메모리 사용률
    const memoryMetric = new cloudwatch.Metric({
      namespace: 'AWS/ECS',
      metricName: 'MemoryUtilization',
      dimensionsMap: {
        ServiceName: ecsService.serviceName,
        ClusterName: ecsService.cluster.clusterName,
      },
      statistic: 'Average',
      period: cdk.Duration.seconds(60),
    });

    // === ALB 메트릭 ===

    // ALB 요청 수
    const albRequestCountMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'RequestCount',
      dimensionsMap: {
        LoadBalancer: alb.loadBalancerFullName,
      },
      statistic: 'Sum',
      period: cdk.Duration.seconds(60),
    });

    // ALB 응답 시간
    const albResponseTimeMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'TargetResponseTime',
      dimensionsMap: {
        LoadBalancer: alb.loadBalancerFullName,
      },
      statistic: 'Average',
      period: cdk.Duration.seconds(60),
    });

    // ALB 5XX 에러율
    const alb5xxMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'HTTPCode_ELB_5XX_Count',
      dimensionsMap: {
        LoadBalancer: alb.loadBalancerFullName,
      },
      statistic: 'Sum',
      period: cdk.Duration.seconds(60),
    });

    // === 알람 설정 ===

    // 1. 높은 CPU 사용률 알람
    this.alarms = {
      highCpuAlarm: new cloudwatch.Alarm(this, 'HighCpuAlarm', {
        alarmName: 'FastScaling-HighCPU',
        alarmDescription: 'High CPU utilization detected',
        metric: cpuMetric,
        threshold: 70,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        evaluationPeriods: 2,
        dataPointsToAlarm: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }),

      // 2. 높은 메모리 사용률 알람
      highMemoryAlarm: new cloudwatch.Alarm(this, 'HighMemoryAlarm', {
        alarmName: 'FastScaling-HighMemory',
        alarmDescription: 'High memory utilization detected',
        metric: memoryMetric,
        threshold: 80,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        evaluationPeriods: 2,
        dataPointsToAlarm: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }),

      // 3. 높은 요청 비율 알람 (ALB 기반)
      highRequestRateAlarm: new cloudwatch.Alarm(this, 'HighRequestRateAlarm', {
        alarmName: 'FastScaling-HighRequestRate',
        alarmDescription: 'High request rate detected from ALB',
        metric: albRequestCountMetric,
        threshold: 1000, // 분당 1000 요청
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        evaluationPeriods: 1,
        dataPointsToAlarm: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }),

      // 4. 높은 응답 시간 알람
      highResponseTimeAlarm: new cloudwatch.Alarm(this, 'HighResponseTimeAlarm', {
        alarmName: 'FastScaling-HighResponseTime',
        alarmDescription: 'High response time detected',
        metric: albResponseTimeMetric,
        threshold: 0.5, // 500ms
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        evaluationPeriods: 2,
        dataPointsToAlarm: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }),

      // 5. 커스텀 RPS 알람 (가장 중요한 스케일링 트리거)
      customRpsAlarm: new cloudwatch.Alarm(this, 'CustomRpsAlarm', {
        alarmName: 'FastScaling-CustomRPS',
        alarmDescription: 'High requests per second from custom metrics',
        metric: customRpsMetric,
        threshold: 100, // 초당 100 요청
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        evaluationPeriods: 1, // 10초 내에 1번 측정으로 즉시 반응
        dataPointsToAlarm: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }),
    };

    // 알람에 SNS 알림 추가
    Object.values(this.alarms).forEach(alarm => {
      alarm.addAlarmAction(new cloudwatch.SnsAction(alertTopic));
      alarm.addOkAction(new cloudwatch.SnsAction(alertTopic));
    });

    // === 대시보드 위젯 ===

    // 커스텀 메트릭 위젯
    const customMetricsWidget = new cloudwatch.GraphWidget({
      title: 'Custom Application Metrics',
      left: [customRpsMetric],
      right: [customResponseTimeMetric],
      width: 12,
      height: 6,
    });

    // ECS 메트릭 위젯
    const ecsMetricsWidget = new cloudwatch.GraphWidget({
      title: 'ECS Service Metrics',
      left: [cpuMetric, memoryMetric],
      width: 12,
      height: 6,
    });

    // ALB 메트릭 위젯
    const albMetricsWidget = new cloudwatch.GraphWidget({
      title: 'ALB Metrics',
      left: [albRequestCountMetric],
      right: [albResponseTimeMetric],
      width: 12,
      height: 6,
    });

    // 에러율 위젯
    const errorRateWidget = new cloudwatch.GraphWidget({
      title: 'Error Rate',
      left: [alb5xxMetric],
      width: 12,
      height: 6,
    });

    // 알람 상태 위젯
    const alarmWidget = new cloudwatch.AlarmStatusWidget({
      title: 'Alarm Status',
      alarms: Object.values(this.alarms),
      width: 24,
      height: 4,
    });

    // 대시보드에 위젯 추가
    dashboard.addWidgets(
      alarmWidget,
      customMetricsWidget,
      ecsMetricsWidget,
      albMetricsWidget,
      errorRateWidget
    );

    // Outputs
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
      exportName: 'FastScaling-DashboardUrl',
    });

    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: alertTopic.topicArn,
      description: 'SNS Alert Topic ARN',
      exportName: 'FastScaling-AlertTopicArn',
    });

    // 태그 추가
    cdk.Tags.of(dashboard).add('Component', 'Monitoring');
    cdk.Tags.of(alertTopic).add('Component', 'Alerts');
  }
}