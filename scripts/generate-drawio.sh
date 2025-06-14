#!/bin/bash

# =============================================================================
# Draw.io 다이어그램 생성 스크립트 (범용)
# =============================================================================
# 사용법:
#   ./generate-drawio.sh [소스_디렉토리] [출력_디렉토리] [옵션]
#
# 옵션:
#   -h, --help       도움말 출력
#   -v, --verbose    상세 출력
#   -f, --force      기존 파일 덮어쓰기
#   -q, --quiet      최소한의 출력만
#   --format FORMAT  출력 형식 (svg, png, pdf) 기본값: svg
#   --clean          생성 전 기존 출력 파일 삭제
#   --preview        생성 후 미리보기 열기 (macOS만)
# =============================================================================

set -euo pipefail

# 기본 설정
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_SOURCE_DIR="$PROJECT_ROOT/docs/diagrams"
DEFAULT_OUTPUT_DIR="$PROJECT_ROOT/docs/diagrams"
DEFAULT_FORMAT="svg"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# 로그 레벨
VERBOSE=false
QUIET=false

# 옵션 변수
FORCE=false
CLEAN=false
PREVIEW=false
FORMAT="$DEFAULT_FORMAT"

# =============================================================================
# 유틸리티 함수들
# =============================================================================

log_info() {
    if [ "$QUIET" = false ]; then
        echo -e "${BLUE}ℹ️  $1${NC}"
    fi
}

log_success() {
    if [ "$QUIET" = false ]; then
        echo -e "${GREEN}✅ $1${NC}"
    fi
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}" >&2
}

log_error() {
    echo -e "${RED}❌ $1${NC}" >&2
}

log_verbose() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${PURPLE}🔍 $1${NC}"
    fi
}

print_help() {
    cat << EOF
${WHITE}Draw.io 다이어그램 생성 스크립트 (범용)${NC}

${CYAN}사용법:${NC}
  $0 [소스_디렉토리] [출력_디렉토리] [옵션]

${CYAN}매개변수:${NC}
  소스_디렉토리    .drawio 파일이 있는 디렉토리 (기본값: ../docs/diagrams)
  출력_디렉토리    생성된 파일을 저장할 디렉토리 (기본값: ../docs/diagrams)

${CYAN}옵션:${NC}
  -h, --help       이 도움말을 출력합니다
  -v, --verbose    상세한 출력을 표시합니다
  -f, --force      기존 파일을 덮어씁니다
  -q, --quiet      최소한의 출력만 표시합니다
  --format FORMAT  출력 형식을 지정합니다 (svg, png, pdf) [기본값: svg]
  --clean          생성 전 기존 출력 파일을 삭제합니다
  --preview        생성 후 미리보기를 엽니다 (macOS만)

${CYAN}예제:${NC}
  $0                                    # docs/diagrams 폴더의 모든 .drawio 파일을 SVG로 변환
  $0 ./src ./build/diagrams             # 특정 경로 지정
  $0 --format png --verbose            # PNG 형식으로 상세 출력
  $0 --clean --force                   # 기존 파일 정리 후 강제 생성

${CYAN}요구사항:${NC}
  - Node.js (npx 명령어 사용)
  - @mattiash/drawio-export 패키지 (자동 설치)

EOF
}

# =============================================================================
# 검증 함수
# =============================================================================

validate_output_file() {
    local output_file="$1"
    local source_file="$2"
    local format="$3"
    
    log_verbose "파일 검증 중: $output_file"
    
    # 파일 존재 확인
    if [ ! -f "$output_file" ]; then
        log_error "출력 파일이 생성되지 않았습니다: $output_file"
        return 1
    fi
    
    # 파일 크기 확인 (최소 100바이트)
    local file_size
    file_size=$(stat -f%z "$output_file" 2>/dev/null || stat -c%s "$output_file" 2>/dev/null || echo "0")
    if [ "$file_size" -lt 100 ]; then
        log_error "출력 파일이 너무 작습니다 (${file_size} bytes): $output_file"
        return 1
    fi
    
    # 형식별 검증
    case "$format" in
        svg)
            # SVG 헤더 확인
            if ! head -1 "$output_file" | grep -q "<?xml\|<svg"; then
                log_error "유효하지 않은 SVG 형식: $output_file"
                return 1
            fi
            
            # SVG 태그 확인
            if ! grep -q "<svg" "$output_file"; then
                log_error "SVG 태그가 없습니다: $output_file"
                return 1
            fi
            
            # 닫는 SVG 태그 확인
            if ! grep -q "</svg>" "$output_file"; then
                log_error "SVG 태그가 제대로 닫히지 않았습니다: $output_file"
                return 1
            fi
            
            # 시각적 요소 확인
            if ! grep -E "<(rect|circle|path|text|g|image|polygon|ellipse)" "$output_file" > /dev/null; then
                log_warning "SVG에 시각적 요소가 없을 수 있습니다: $output_file"
            fi
            ;;
        png)
            # PNG 헤더 확인
            if ! file "$output_file" | grep -q "PNG image"; then
                log_error "유효하지 않은 PNG 형식: $output_file"
                return 1
            fi
            ;;
        pdf)
            # PDF 헤더 확인
            if ! file "$output_file" | grep -q "PDF document"; then
                log_error "유효하지 않은 PDF 형식: $output_file"
                return 1
            fi
            ;;
    esac
    
    # 파일 수정 시간 비교 (소스 파일보다 새로워야 함)
    if [ -f "$source_file" ] && [ "$source_file" -nt "$output_file" ]; then
        log_warning "소스 파일이 출력 파일보다 최신입니다: $source_file"
    fi
    
    log_verbose "파일 검증 완료: $output_file (${file_size} bytes)"
    return 0
}

# =============================================================================
# 설치 확인 함수
# =============================================================================

check_dependencies() {
    log_verbose "의존성 확인 중..."
    
    # Node.js 확인
    if ! command -v node &> /dev/null; then
        log_error "Node.js가 설치되어 있지 않습니다."
        log_info "다음에서 설치하세요: https://nodejs.org/"
        exit 1
    fi
    
    # npx 확인
    if ! command -v npx &> /dev/null; then
        log_error "npx가 설치되어 있지 않습니다."
        log_info "Node.js를 최신 버전으로 업데이트하세요: https://nodejs.org/"
        exit 1
    fi
    
    # @mattiash/drawio-export 확인 및 설치
    if ! npm list -g @mattiash/drawio-export &> /dev/null; then
        log_info "@mattiash/drawio-export 패키지를 설치하는 중..."
        if ! npm install -g @mattiash/drawio-export; then
            log_error "@mattiash/drawio-export 설치에 실패했습니다."
            log_info "수동으로 설치하세요: npm install -g @mattiash/drawio-export"
            exit 1
        fi
        log_success "@mattiash/drawio-export 설치 완료"
    fi
    
    log_verbose "모든 의존성이 충족되었습니다."
}

# =============================================================================
# 파일 변환 함수
# =============================================================================

convert_drawio_file() {
    local source_file="$1"
    local output_file="$2"
    local format="$3"
    
    local base_name
    base_name=$(basename "$source_file" .drawio)
    
    log_verbose "변환 시작: $source_file → $output_file"
    
    # 출력 디렉토리의 임시 작업 공간
    local temp_dir
    temp_dir=$(dirname "$output_file")
    local original_dir
    original_dir=$(pwd)
    
    cd "$temp_dir" || {
        log_error "출력 디렉토리로 이동할 수 없습니다: $temp_dir"
        return 1
    }
    
    # Draw.io 변환 실행
    if npx @mattiash/drawio-export -f "$format" -o . "$source_file" 2>/dev/null; then
        log_verbose "Draw.io 변환 성공"
        
        # 생성된 파일 찾기 및 이름 변경
        # Draw.io는 다이어그램 이름을 기반으로 파일을 생성하므로 패턴 매칭이 필요
        local generated_files
        generated_files=$(find . -name ".*.$format" -newer "$source_file" 2>/dev/null | head -5)
        
        if [ -n "$generated_files" ]; then
            # 가장 최근 생성된 파일 선택
            local generated_file
            generated_file=$(echo "$generated_files" | head -1)
            
            if [ -f "$generated_file" ]; then
                mv "$generated_file" "$(basename "$output_file")"
                log_verbose "파일 이름 변경: $generated_file → $(basename "$output_file")"
            fi
        fi
        
        cd "$original_dir"
        
        # 검증
        if validate_output_file "$output_file" "$source_file" "$format"; then
            return 0
        else
            return 1
        fi
    else
        cd "$original_dir"
        log_error "Draw.io 변환 실패: $source_file"
        return 1
    fi
}

# =============================================================================
# 메인 처리 함수
# =============================================================================

process_directory() {
    local source_dir="$1"
    local output_dir="$2"
    local format="$3"
    
    # 디렉토리 검증
    if [ ! -d "$source_dir" ]; then
        log_error "소스 디렉토리가 존재하지 않습니다: $source_dir"
        exit 1
    fi
    
    # 출력 디렉토리 생성
    if [ ! -d "$output_dir" ]; then
        log_info "출력 디렉토리를 생성합니다: $output_dir"
        mkdir -p "$output_dir" || {
            log_error "출력 디렉토리를 생성할 수 없습니다: $output_dir"
            exit 1
        }
    fi
    
    # 정리 옵션 처리
    if [ "$CLEAN" = true ]; then
        log_info "기존 $format 파일들을 정리합니다..."
        find "$output_dir" -name "*.$format" -type f -delete 2>/dev/null || true
    fi
    
    # .drawio 파일 찾기
    local drawio_files=()
    while IFS= read -r -d '' file; do
        drawio_files+=("$file")
    done < <(find "$source_dir" -name "*.drawio" -type f -print0)
    
    if [ ${#drawio_files[@]} -eq 0 ]; then
        log_warning "소스 디렉토리에서 .drawio 파일을 찾을 수 없습니다: $source_dir"
        exit 1
    fi
    
    log_info "${#drawio_files[@]}개의 .drawio 파일을 발견했습니다."
    
    # 변환 처리
    local success_count=0
    local total_count=${#drawio_files[@]}
    local failed_files=()
    
    for drawio_file in "${drawio_files[@]}"; do
        local base_name
        base_name=$(basename "$drawio_file" .drawio)
        local output_file="$output_dir/${base_name}.$format"
        
        # 기존 파일 확인
        if [ -f "$output_file" ] && [ "$FORCE" = false ]; then
            log_warning "출력 파일이 이미 존재합니다: $output_file (--force로 덮어쓰기 가능)"
            continue
        fi
        
        if [ "$QUIET" = false ]; then
            echo -n "  🔄 $(basename "$drawio_file") → $(basename "$output_file") ... "
        fi
        
        if convert_drawio_file "$drawio_file" "$output_file" "$format"; then
            success_count=$((success_count + 1))
            if [ "$QUIET" = false ]; then
                echo -e "${GREEN}✅${NC}"
            fi
        else
            failed_files+=("$(basename "$drawio_file")")
            if [ "$QUIET" = false ]; then
                echo -e "${RED}❌${NC}"
            fi
        fi
    done
    
    # 결과 요약
    echo ""
    if [ "$QUIET" = false ]; then
        echo "📊 변환 결과 요약:"
        echo "  - 성공: $success_count/$total_count"
        echo "  - 실패: $((total_count - success_count))/$total_count"
        
        if [ ${#failed_files[@]} -gt 0 ]; then
            echo ""
            log_error "실패한 파일들:"
            printf '  - %s\n' "${failed_files[@]}"
        fi
        
        echo ""
        echo "📁 생성된 파일들:"
        for output_file in "$output_dir"/*."$format"; do
            if [ -f "$output_file" ]; then
                local file_size
                file_size=$(stat -f%z "$output_file" 2>/dev/null || stat -c%s "$output_file" 2>/dev/null || echo "0")
                echo "  - $(basename "$output_file") (${file_size} bytes)"
            fi
        done
        
        if ! ls "$output_dir"/*."$format" >/dev/null 2>&1; then
            echo "  (생성된 파일 없음)"
        fi
    fi
    
    # 성공 여부 판단
    if [ $success_count -eq $total_count ] && [ $total_count -gt 0 ]; then
        log_success "모든 다이어그램 생성 완료!"
        exit_code=0
    elif [ $success_count -gt 0 ]; then
        log_warning "일부 다이어그램 생성 완료 ($success_count/$total_count)"
        exit_code=1
    else
        log_error "다이어그램 생성 실패"
        exit_code=1
    fi
    
    # 미리보기
    if [ "$PREVIEW" = true ] && [[ "$OSTYPE" == "darwin"* ]] && [ $success_count -gt 0 ]; then
        log_info "미리보기를 엽니다..."
        open "$output_dir"/*."$format" 2>/dev/null || log_warning "미리보기를 열 수 없습니다."
    fi
    
    return $exit_code
}

# =============================================================================
# 메인 실행부
# =============================================================================

main() {
    local source_dir="$DEFAULT_SOURCE_DIR"
    local output_dir="$DEFAULT_OUTPUT_DIR"
    
    # 인자 파싱
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                print_help
                exit 0
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -f|--force)
                FORCE=true
                shift
                ;;
            -q|--quiet)
                QUIET=true
                shift
                ;;
            --format)
                if [[ $# -lt 2 ]]; then
                    log_error "--format 옵션에는 값이 필요합니다."
                    exit 1
                fi
                FORMAT="$2"
                if [[ ! "$FORMAT" =~ ^(svg|png|pdf)$ ]]; then
                    log_error "지원되지 않는 형식입니다: $FORMAT (지원: svg, png, pdf)"
                    exit 1
                fi
                shift 2
                ;;
            --clean)
                CLEAN=true
                shift
                ;;
            --preview)
                PREVIEW=true
                shift
                ;;
            -*)
                log_error "알 수 없는 옵션: $1"
                print_help
                exit 1
                ;;
            *)
                if [ "$source_dir" = "$DEFAULT_SOURCE_DIR" ]; then
                    source_dir="$1"
                elif [ "$output_dir" = "$DEFAULT_OUTPUT_DIR" ]; then
                    output_dir="$1"
                else
                    log_error "너무 많은 인자입니다: $1"
                    print_help
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    # 상대 경로를 절대 경로로 변환
    if [[ ! "$source_dir" = /* ]]; then
        source_dir="$PROJECT_ROOT/$source_dir"
    fi
    if [[ ! "$output_dir" = /* ]]; then
        output_dir="$PROJECT_ROOT/$output_dir"
    fi
    
    # 시작 메시지
    if [ "$QUIET" = false ]; then
        echo -e "${WHITE}🎨 Draw.io 다이어그램 생성 시작...${NC}"
        echo "📂 소스: $source_dir"
        echo "📁 출력: $output_dir"
        echo "📋 형식: $FORMAT"
        echo ""
    fi
    
    # 의존성 확인
    check_dependencies
    
    # 메인 처리
    process_directory "$source_dir" "$output_dir" "$FORMAT"
}

# 스크립트가 직접 실행된 경우에만 main 함수 호출
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi