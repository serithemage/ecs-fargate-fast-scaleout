# PlantUML 다이어그램 Makefile

.PHONY: all clean generate preview server docker-generate docker-server install help

# 기본 타겟
all: generate

# PlantUML 설치 (macOS)
install:
	@echo "🔧 PlantUML 설치 중..."
	@brew install plantuml graphviz || echo "Homebrew가 필요합니다"
	@echo "✅ 설치 완료"

# SVG 생성 (로컬)
generate:
	@echo "🎨 다이어그램 생성 중..."
	@for file in *.puml; do \
		echo "  - $$file → $${file%.puml}.svg"; \
		plantuml -tsvg $$file || echo "❌ 실패: $$file"; \
	done
	@echo "✅ 완료!"

# PNG 생성 (로컬)
png:
	@echo "🎨 PNG 다이어그램 생성 중..."
	@for file in *.puml; do \
		echo "  - $$file → $${file%.puml}.png"; \
		plantuml -tpng $$file || echo "❌ 실패: $$file"; \
	done
	@echo "✅ 완료!"

# 미리보기 (macOS)
preview: generate
	@echo "🖼️  다이어그램 미리보기..."
	@open *.svg

# PlantUML 서버 실행
server:
	@echo "🌐 PlantUML 서버 시작..."
	@echo "📍 http://localhost:8080 에서 접속 가능"
	@docker-compose up plantuml-server

# Docker로 SVG 생성
docker-generate:
	@echo "🐳 Docker로 다이어그램 생성 중..."
	@docker-compose run --rm plantuml-cli
	@echo "✅ 완료!"

# Docker 서버 중지
docker-stop:
	@docker-compose down

# 생성된 파일 삭제
clean:
	@echo "🧹 생성된 파일 삭제 중..."
	@rm -f *.svg *.png
	@echo "✅ 완료!"

# 도움말
help:
	@echo "PlantUML 다이어그램 생성 도구"
	@echo ""
	@echo "사용법:"
	@echo "  make install         - PlantUML 설치 (macOS)"
	@echo "  make generate        - SVG 다이어그램 생성"
	@echo "  make png            - PNG 다이어그램 생성"
	@echo "  make preview        - 다이어그램 미리보기 (macOS)"
	@echo "  make server         - PlantUML 웹 서버 실행"
	@echo "  make docker-generate - Docker로 다이어그램 생성"
	@echo "  make clean          - 생성된 파일 삭제"
	@echo "  make help           - 이 도움말 표시"