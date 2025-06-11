#!/bin/bash

# PlantUML 다이어그램 생성 스크립트

echo "🎨 PlantUML 다이어그램 생성 시작..."

# PlantUML JAR 파일 확인
PLANTUML_JAR="plantuml.jar"

# PlantUML 다운로드 (없는 경우)
if [ ! -f "$PLANTUML_JAR" ]; then
    echo "📥 PlantUML 다운로드 중..."
    curl -L -o "$PLANTUML_JAR" https://github.com/plantuml/plantuml/releases/download/v1.2024.0/plantuml-1.2024.0.jar
fi

# Java 설치 확인
if ! command -v java &> /dev/null; then
    echo "❌ Java가 설치되어 있지 않습니다. Java를 먼저 설치해주세요."
    exit 1
fi

# Graphviz 설치 확인 (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    if ! command -v dot &> /dev/null; then
        echo "📦 Graphviz 설치 중..."
        brew install graphviz
    fi
fi

# 모든 .puml 파일을 SVG로 변환
echo "🔄 다이어그램 변환 중..."
for puml_file in *.puml; do
    if [ -f "$puml_file" ]; then
        echo "  - $puml_file → ${puml_file%.puml}.svg"
        java -jar "$PLANTUML_JAR" -tsvg "$puml_file"
    fi
done

echo "✅ 다이어그램 생성 완료!"
echo ""
echo "📁 생성된 파일:"
ls -la *.svg 2>/dev/null || echo "  (생성된 SVG 파일 없음)"

# 미리보기 열기 (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo ""
    echo "🖼️  미리보기 열기 (y/n)?"
    read -r answer
    if [ "$answer" = "y" ]; then
        open *.svg
    fi
fi