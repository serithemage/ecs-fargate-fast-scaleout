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

## 🚀 빠른 시작

### 방법 1: Makefile 사용 (추천)

```bash
# PlantUML 설치 (최초 1회)
make install

# SVG 다이어그램 생성
make generate

# 다이어그램 미리보기 (macOS)
make preview

# PNG 형식으로 생성
make png

# 도움말 보기
make help
```

### 방법 2: 스크립트 사용

```bash
# 실행 권한 부여 (최초 1회)
chmod +x generate.sh

# 다이어그램 생성 및 미리보기
./generate.sh
```

### 방법 3: Docker 사용

```bash
# Docker Compose로 SVG 생성
make docker-generate

# 또는 직접 실행
docker-compose run --rm plantuml-cli
```

## 🌐 PlantUML 웹 서버

로컬에서 PlantUML 웹 에디터를 실행할 수 있습니다:

```bash
# 서버 시작
make server
# 또는
docker-compose up plantuml-server

# 브라우저에서 접속
open http://localhost:8080

# 서버 중지
make docker-stop
```

## 📝 다이어그램 편집

### VS Code 확장 프로그램

1. [PlantUML 확장](https://marketplace.visualstudio.com/items?itemName=jebbs.plantuml) 설치
2. `.puml` 파일 열기
3. `Alt+D` 또는 `Option+D`로 미리보기

### IntelliJ IDEA 플러그인

1. PlantUML Integration 플러그인 설치
2. `.puml` 파일에서 우클릭 → Show Diagram

## 🛠️ 설치 가이드

### macOS

```bash
# Homebrew로 설치
brew install plantuml graphviz

# 또는 Makefile 사용
make install
```

### Ubuntu/Debian

```bash
sudo apt-get update
sudo apt-get install -y plantuml graphviz
```

### Windows

1. [Java](https://www.java.com/) 설치
2. [Graphviz](https://graphviz.org/download/) 설치
3. [PlantUML JAR](https://plantuml.com/download) 다운로드

## 📦 파일 구조

```
diagrams/
├── README.md           # 이 파일
├── Makefile           # 자동화 명령어
├── generate.sh        # 생성 스크립트
├── docker-compose.yml # Docker 설정
├── architecture.puml  # 전체 아키텍처
├── scaling-flow.puml  # 스케일링 플로우
├── architecture.svg   # 생성된 SVG (gitignore)
└── scaling-flow.svg   # 생성된 SVG (gitignore)
```

## PlantUML 문법

- [PlantUML 공식 문서](https://plantuml.com/)
- [AWS Icons for PlantUML](https://github.com/awslabs/aws-icons-for-plantuml)

## 다이어그램 수정

1. `.puml` 파일 수정
2. 커밋 & 푸시
3. GitHub Actions가 자동으로 SVG 생성
4. 생성된 SVG는 자동으로 커밋됨