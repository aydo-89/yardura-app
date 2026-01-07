# Tile Generation Background Jobs

## Overview

Tile generation has been moved to a background job queue system using **BullMQ** and Redis. This prevents the UI from blocking while tiles are being generated, especially for large cities with many ZIP codes.

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────┐      ┌────────────┐
│   Browser   │─────▶│ API Endpoint │─────▶│  Redis  │─────▶│   Worker   │
│    (UI)     │◀─────│   /generate  │      │  Queue  │      │  Process   │
└─────────────┘      └──────────────┘      └─────────┘      └────────────┘
       │                     │                                      │
       │                     │                                      │
       └─────────────────────┴──────────────────────────────────────┘
                      Polls /status endpoint every 2s
```

### Components

1. **Queue** (`src/lib/jobs/tileGenerationQueue.ts`)
   - Manages tile generation jobs
   - Stores job state in Redis
   - Supports job retry and failure handling

2. **API Endpoints**
   - `POST /api/admin/tiles/generate` - Enqueues a tile generation job
   - `GET /api/admin/tiles/generate/status?jobId=xxx` - Check job status

3. **Worker** (`jobs/start-tile-generation-worker.ts`)
   - Processes jobs from the queue
   - Runs as a separate process
   - Concurrent processing (2 jobs at a time)

4. **Client** (`src/lib/tiles/studio-client.ts`)
   - Automatically polls for job completion
   - Returns result when complete
   - Transparent to UI code

## Usage

### Starting the Worker

In production, start the worker as a PM2 process:

```bash
pm2 start npm --name "tile-worker" -- run jobs:tiles
```

Or manually:

```bash
npm run jobs:tiles
```

### Environment Variables

The system requires `REDIS_URL` to be set:

```bash
REDIS_URL="redis://localhost:6379"  # Local development
REDIS_URL="rediss://user:pass@host:port"  # Production with TLS
```

### Fallback Behavior

If Redis is not available:
- Jobs run **synchronously** (old behavior)
- A warning is logged: `[queue] Tile generation queue disabled`
- The UI will block until tiles are generated

This ensures the system still works in environments without Redis.

## Development

### Testing Locally

1. **Start Redis** (via Docker Compose):
   ```bash
   docker-compose up -d
   ```

2. **Start the worker**:
   ```bash
   npm run jobs:tiles
   ```

3. **Start Next.js dev server**:
   ```bash
   npm run dev
   ```

4. **Generate tiles** from the UI:
   - Navigate to Tile Studio
   - Search for a city
   - Click "Generate Tiles"
   - Watch the console logs in both the Next.js and worker terminals

### Monitoring

**Worker logs** show:
```
🚀 Starting Tile Generation Worker...
   Queue: tile-generation
   Concurrency: 2 jobs

✅ Tile Generation Worker started and listening for jobs...

[TileGenWorker] Processing job 123abc for place place_xyz
🗺️  Starting tile generation for Minneapolis, MN
   Place ID: place_xyz
   Tile Count: 8
   Mode: cluster
✅ Generated 8 tiles
[TileGenWorker] Job 123abc completed successfully. Generated 8 tiles
```

**API logs** show:
```
[TileGen] Job tgen_xyz123 queued for Minneapolis, MN
```

**Browser console** shows:
```
[TileGen] Job tgen_xyz123 queued, polling for completion...
```

## Production Deployment

### PM2 Configuration

Add to your PM2 ecosystem file:

```javascript
module.exports = {
  apps: [
    {
      name: 'yardura-web',
      script: 'npm',
      args: 'start',
      // ... other web config
    },
    {
      name: 'tile-worker',
      script: 'npm',
      args: 'run jobs:tiles',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        REDIS_URL: process.env.REDIS_URL,
      },
    },
  ],
};
```

### Deployment Script

Update `deploy.sh` to restart the worker:

```bash
echo '🔄 Restarting services...'
pm2 restart yardura-web
pm2 restart tile-worker
```

### Health Checks

Monitor the worker process:

```bash
pm2 status tile-worker
pm2 logs tile-worker --lines 50
```

## Troubleshooting

### Worker Not Processing Jobs

1. **Check Redis connection**:
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

2. **Check worker is running**:
   ```bash
   pm2 status tile-worker
   ```

3. **Check worker logs**:
   ```bash
   pm2 logs tile-worker
   ```

### Jobs Timing Out

- Default timeout: 2 minutes (60 polls × 2 seconds)
- Adjust in `src/lib/tiles/studio-client.ts`:
  ```typescript
  const maxAttempts = 90; // 3 minutes
  ```

### Redis Connection Issues

If you see:
```
[queue] Tile generation queue disabled (REDIS_URL is not configured)
```

Ensure `REDIS_URL` is set in your `.env`:
```bash
REDIS_URL="redis://localhost:6379"
```

### Jobs Failing Silently

Check the queue for failed jobs:

```typescript
// In Node REPL or script
import { getTileGenerationQueue } from '@/lib/jobs/tileGenerationQueue';

const queue = getTileGenerationQueue();
const failed = await queue.getFailed();
console.log(failed);
```

## Performance

- **Concurrency**: 2 jobs at a time (configurable in worker)
- **Retry**: 2 attempts with exponential backoff
- **Job retention**: Last 100 completed, last 50 failed
- **Memory**: ~50-100 MB per worker process
- **Response time**: Immediate (job queued), 10-60s for completion

## Future Improvements

- [ ] WebSocket support for real-time progress updates (eliminate polling)
- [ ] Progress bars showing tile generation percentage
- [ ] Job priority (e.g., prioritize smaller jobs)
- [ ] Batch job submission (multiple cities at once)
- [ ] Admin dashboard to view queue status
- [ ] Metrics and monitoring (job success rate, average time, etc.)









