# Multi-stage build for optimized image size
FROM node:18-alpine AS builder

# 작업 디렉토리 설정
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:18-alpine AS production

# 보안 강화를 위한 non-root 사용자 생성
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# 작업 디렉토리 설정
WORKDIR /app

# builder stage에서 node_modules 복사
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# 애플리케이션 코드 복사
COPY --chown=nextjs:nodejs . .

# 헬스체크를 위한 curl 설치
RUN apk add --no-cache curl

# 포트 설정
EXPOSE 8080

# 환경 변수 설정
ENV NODE_ENV=production
ENV PORT=8080

# non-root 사용자로 전환
USER nextjs

# 헬스체크 설정
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# 애플리케이션 시작
CMD ["node", "server.js"]