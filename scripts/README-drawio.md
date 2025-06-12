# Draw.io Diagrams

이 디렉토리는 프로젝트의 아키텍처 다이어그램을 Draw.io 형식으로 관리합니다.

## 다이어그램 목록

### 1. 전체 아키텍처 (architecture.drawio)
![Architecture](architecture.svg)

ECS Fargate 고속 스케일링 솔루션의 전체 아키텍처를 보여줍니다.

- AWS VPC 구성
- ALB와 ECS Fargate 클러스터
- CloudWatch 모니터링
- Auto Scaling 구성

### 2. 스케일링 플로우 (scaling-flow.drawio)
![Scaling Flow](scaling-flow.svg)

실시간 스케일링이 작동하는 순서도를 보여줍니다.

- 5초 간격 메트릭 수집
- 10초 간격 알람 평가
- Step Scaling 정책 실행
- 스케일아웃/인 프로세스

## 🚀 빠른 시작

### 🎨 Draw.io 방식 (추천)

```bash
# Draw.io CLI 설치 (최초 1회)
make -f Makefile-drawio install

# SVG 다이어그램 생성
make -f Makefile-drawio generate

# 다이어그램 미리보기 (macOS)
make -f Makefile-drawio preview

# PNG 형식으로 생성
make -f Makefile-drawio png

# 파일 변경 감시 및 자동 생성
make -f Makefile-drawio watch
```

### 📝 Draw.io 스크립트 사용

```bash
# 실행 권한 부여 (최초 1회)
chmod +x generate-drawio.sh

# 다이어그램 생성 및 미리보기
./generate-drawio.sh
```

## 📝 다이어그램 편집

### 온라인 Draw.io 에디터

1. [draw.io](https://app.diagrams.net/) 접속
2. `.drawio` 파일 열기
3. 편집 후 저장
4. `make -f Makefile-drawio generate`로 SVG 생성

### VS Code 확장 프로그램

1. [Draw.io Integration](https://marketplace.visualstudio.com/items?itemName=hediet.vscode-drawio) 설치
2. `.drawio` 파일 열기
3. VS Code 내에서 직접 편집

### Desktop 앱

1. [draw.io Desktop](https://github.com/jgraph/drawio-desktop/releases) 다운로드
2. 설치 후 `.drawio` 파일 열기

## 🛠️ 설치 가이드

### macOS

```bash
# Node.js 설치 (Homebrew)
brew install node

# Draw.io CLI 설치
npm install -g @hediet/drawio-cli

# 또는 Makefile 사용
make -f Makefile-drawio install
```

### Ubuntu/Debian

```bash
# Node.js 설치
sudo apt-get update
sudo apt-get install -y nodejs npm

# Draw.io CLI 설치
npm install -g @hediet/drawio-cli
```

### Windows

1. [Node.js](https://nodejs.org/) 설치
2. 명령 프롬프트에서: `npm install -g @hediet/drawio-cli`

## 📦 파일 구조

```
diagrams/
├── README-drawio.md        # 이 파일
├── Makefile-drawio        # Draw.io 자동화 명령어
├── generate-drawio.sh     # Draw.io 생성 스크립트
├── package.json           # npm 설정
├── architecture.drawio    # 전체 아키텍처
├── scaling-flow.drawio    # 스케일링 플로우
├── architecture.svg       # 생성된 SVG (gitignore)
└── scaling-flow.svg       # 생성된 SVG (gitignore)
```

## 🎯 Draw.io 사용법

### AWS 아이콘 사용

1. Draw.io에서 왼쪽 사이드바 → More Shapes
2. AWS 검색 → AWS Architecture 2021 체크
3. AWS 서비스 아이콘 사용 가능

### 템플릿 활용

1. File → New → Template
2. AWS Architecture 템플릿 선택
3. 필요한 부분 수정

### 레이어 활용

1. View → Layers 활성화
2. Background, Network, Services 등으로 분리
3. 복잡한 다이어그램 관리 용이

## 🔄 자동화

### 파일 감시

```bash
# 파일 변경 감시 및 자동 SVG 생성
make -f Makefile-drawio watch
```

### npm 스크립트

```bash
# package.json에 정의된 스크립트 사용
npm run generate-svg
npm run generate-png
npm run watch
```

## 🌐 온라인 에디터 활용

Draw.io 파일을 온라인에서 바로 편집:

1. GitHub에서 `.drawio` 파일 클릭
2. "Open with" → draw.io 선택
3. 온라인에서 편집 후 저장
4. 로컬에서 `git pull` 후 SVG 생성

## 📚 참고 자료

- [Draw.io 공식 문서](https://www.diagrams.net/doc/)
- [Draw.io CLI GitHub](https://github.com/hediet/drawio-cli)
- [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/)
- [Draw.io VS Code Extension](https://marketplace.visualstudio.com/items?itemName=hediet.vscode-drawio)