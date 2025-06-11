# ECS Fargate Fast Scaling CDK

이 CDK 프로젝트는 ECS Fargate 환경에서 10초 이내의 고속 자동 스케일링을 구현합니다.

## 📋 프로젝트 구조

```
cdk/
├── bin/
│   └── app.ts              # CDK 애플리케이션 진입점
├── lib/
│   ├── network-stack.ts    # VPC, ALB, 보안 그룹
│   ├── ecs-stack.ts        # ECS 클러스터, 서비스, 태스크 정의
│   ├── monitoring-stack.ts # CloudWatch 메트릭, 알람, 대시보드
│   └── autoscaling-stack.ts # 자동 스케일링 정책
├── package.json
├── tsconfig.json
└── cdk.json
```

## 🚀 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. CDK 부트스트랩 (최초 1회)

```bash
npx cdk bootstrap
```

### 3. 배포

전체 스택 배포:
```bash
npm run deploy
```

개별 스택 배포:
```bash
npx cdk deploy EcsFastScaling-Network
npx cdk deploy EcsFastScaling-Ecs
npx cdk deploy EcsFastScaling-Monitoring
npx cdk deploy EcsFastScaling-AutoScaling
```

### 4. 스택 확인

```bash
npx cdk list
npx cdk diff
```

### 5. 삭제

```bash
npm run destroy
```

## 🏗️ 아키텍처 상세

### NetworkStack
- **VPC**: 3개 AZ에 걸친 프라이빗/퍼블릭 서브넷
- **ALB**: 인터넷 게이트웨이와 연결된 로드밸런서
- **보안 그룹**: 최소 권한 원칙 적용
- **VPC 엔드포인트**: ECR, CloudWatch Logs 액세스

### EcsStack
- **클러스터**: Container Insights 활성화
- **서비스**: 최소 2개, 최대 100개 태스크
- **태스크 정의**: 256 CPU, 512MB 메모리
- **IAM 역할**: CloudWatch 메트릭 발행 권한

### MonitoringStack
- **커스텀 메트릭**: RPS, 응답 시간, 활성 연결 수
- **CloudWatch 알람**: 5가지 스케일링 트리거
- **대시보드**: 실시간 모니터링 뷰
- **SNS 알림**: 알람 상태 변경 시 알림

### AutoScalingStack
- **Step Scaling**: 트래픽 수준별 단계적 확장
- **Target Tracking**: CPU 기반 백업 스케일링
- **Scheduled Scaling**: 예측적 스케일링
- **정책**: 10초 스케일아웃, 5분 스케일인

## 📊 주요 메트릭

| 메트릭 | 임계값 | 동작 |
|--------|--------|------|
| CustomRPS | > 100/초 | 즉시 스케일아웃 |
| CPU 사용률 | > 70% | 1분 후 스케일아웃 |
| 메모리 사용률 | > 80% | 1분 후 스케일아웃 |
| 응답 시간 | > 500ms | 알림 발송 |
| CustomRPS | < 50/초 | 3분 후 스케일인 |

## ⚙️ 스케일링 정책

### Scale Out (확장)
- **RPS 100-150**: +1 태스크
- **RPS 150-200**: +2 태스크  
- **RPS 200+**: +4 태스크
- **쿨다운**: 10초

### Scale In (축소)
- **RPS < 50**: -1 태스크
- **쿨다운**: 5분 (보수적 접근)

### Scheduled Scaling
- **아침 8:30**: 최소 5개 태스크
- **저녁 22:00**: 최소 2개 태스크
- **주말**: 최소 1개 태스크

## 🔧 환경 변수

CDK 배포 시 다음 환경 변수를 설정할 수 있습니다:

```bash
export CDK_DEFAULT_ACCOUNT=123456789012
export CDK_DEFAULT_REGION=ap-northeast-2
```

## 📈 모니터링

배포 후 다음 리소스에서 모니터링할 수 있습니다:

1. **CloudWatch 대시보드**: `Fast-Scaling-Monitoring`
2. **알람**: `FastScaling-*` 패턴으로 명명
3. **로그**: `/ecs/fast-scaling-app` 로그 그룹

## 🧪 테스트

부하 테스트를 위한 엔드포인트:

```bash
# ALB DNS 확인
aws elbv2 describe-load-balancers --names fast-scaling-alb

# 부하 테스트
curl http://<ALB-DNS>/load/5    # CPU 부하 생성
curl http://<ALB-DNS>/memory/10 # 메모리 부하 생성
curl http://<ALB-DNS>/metrics   # 현재 메트릭 확인
```

## 🛠️ 문제 해결

### 일반적인 문제

1. **배포 실패**: IAM 권한 확인
2. **알람 미작동**: 메트릭 발행 확인
3. **스케일링 안됨**: 쿨다운 시간 확인

### 로그 확인

```bash
# ECS 서비스 로그
aws logs tail /ecs/fast-scaling-app --follow

# CloudWatch 메트릭 확인
aws cloudwatch get-metric-statistics \
  --namespace FastScaling/Application \
  --metric-name RequestsPerSecond \
  --start-time 2023-01-01T00:00:00Z \
  --end-time 2023-01-01T01:00:00Z \
  --period 60 \
  --statistics Average
```

## 💰 비용 최적화

- **NAT 게이트웨이**: 1개만 사용 (가용성 vs 비용)
- **VPC 엔드포인트**: 필수 서비스만 설정
- **로그 보존**: 1주일로 제한
- **스케일인 정책**: 보수적 설정으로 과금 최소화

## 🔒 보안 고려사항

- **최소 권한 원칙**: IAM 역할 최소 권한
- **보안 그룹**: 필요한 포트만 개방
- **컨테이너**: non-root 사용자 실행
- **VPC**: 프라이빗 서브넷에 ECS 배치

## 📝 추가 자료

- [AWS CDK 공식 문서](https://docs.aws.amazon.com/cdk/)
- [ECS 스케일링 가이드](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-auto-scaling.html)
- [CloudWatch 고해상도 메트릭](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/publishingMetrics.html)