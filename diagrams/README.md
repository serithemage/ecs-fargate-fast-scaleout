# PlantUML Diagrams

이 디렉토리는 프로젝트의 아키텍처 다이어그램을 PlantUML 형식으로 관리합니다.

## 다이어그램 목록

### 1. 전체 아키텍처 (architecture.puml)
![Architecture](architecture.svg)

ECS Fargate 고속 스케일링 솔루션의 전체 아키텍처를 보여줍니다.

- AWS VPC 구성
- ALB와 ECS Fargate 클러스터
- CloudWatch 모니터링
- Auto Scaling 구성

### 2. 스케일링 플로우 (scaling-flow.puml)
![Scaling Flow](scaling-flow.svg)

실시간 스케일링이 작동하는 순서도를 보여줍니다.

- 5초 간격 메트릭 수집
- 10초 간격 알람 평가
- Step Scaling 정책 실행
- 스케일아웃/인 프로세스

## 다이어그램 생성

GitHub Actions가 자동으로 `.puml` 파일을 SVG로 변환합니다.

### 로컬에서 생성하기

```bash
# PlantUML 설치
brew install plantuml

# SVG 생성
plantuml -tsvg diagrams/*.puml

# PNG 생성
plantuml -tpng diagrams/*.puml
```

### Docker로 생성하기

```bash
docker run --rm -v $(pwd)/diagrams:/diagrams plantuml/plantuml -tsvg /diagrams/*.puml
```

## PlantUML 문법

- [PlantUML 공식 문서](https://plantuml.com/)
- [AWS Icons for PlantUML](https://github.com/awslabs/aws-icons-for-plantuml)

## 다이어그램 수정

1. `.puml` 파일 수정
2. 커밋 & 푸시
3. GitHub Actions가 자동으로 SVG 생성
4. 생성된 SVG는 자동으로 커밋됨