# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AWS ECS Fargate fast auto-scaling architecture that achieves 10-second response time to traffic spikes (vs standard 2-3 minutes). It uses high-resolution CloudWatch metrics and optimized scaling policies.

## Common Commands

### CDK Infrastructure (in `cdk/` directory)
```bash
# First time setup
npm install
npx cdk bootstrap

# Development
npm run build      # Compile TypeScript
npm run watch      # Watch mode compilation
npm run synth      # Synthesize CloudFormation

# Deployment
npm run deploy     # Deploy all stacks
npm run destroy    # Destroy all stacks
npm run diff       # Show deployment differences

# Testing
npm test           # Run Jest tests
```

### Application (in `app/` directory)
```bash
# Development
npm install
npm start          # Start server
npm run dev        # Start with hot reload

# Docker
npm run docker:build  # Build Docker image
npm run docker:run    # Run Docker container

# Testing
npm test           # Run Jest tests
```

### Documentation Diagrams (in `scripts/` directory)
```bash
# Generate diagrams from Draw.io files
npm install
npm run generate-svg  # Generate SVG diagrams
npm run watch        # Auto-generate on file changes
```

## Architecture

The system consists of 4 independent CDK stacks that must be deployed in order:

1. **NetworkStack** - VPC and Application Load Balancer
2. **EcsStack** - Fargate cluster, service, and task definition
3. **MonitoringStack** - CloudWatch metrics, alarms, and dashboard
4. **AutoScalingStack** - Fast scaling policies based on custom metrics

Key directories:
- `cdk/lib/` - CDK stack definitions
- `app/` - Express.js application with custom metrics collection
- `docs/diagrams/` - Architecture diagrams (Draw.io XML and generated SVG)

## Important Implementation Details

1. **Custom Metrics**: The application sends metrics to CloudWatch every 5 seconds using the AWS SDK
2. **Scaling Triggers**: Based on Requests Per Second (RPS), response time, and active connections
3. **Testing Endpoints**: 
   - `/load/{level}` - Simulate CPU load
   - `/memory/{mb}` - Simulate memory usage
   - `/metrics` - View current metrics
   - `/health` - Health check

4. **CloudWatch Dashboard**: Access "Fast-Scaling-Monitoring" dashboard after deployment

## Development Notes

- No linting is currently configured for this project
- Test files are not yet implemented despite Jest being configured
- The CDK uses TypeScript with strict compilation settings
- All infrastructure changes should be tested with `npm run diff` before deployment
- Custom metrics implementation is in `app/server.js`