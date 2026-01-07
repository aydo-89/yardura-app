// PM2 Ecosystem Configuration
// This file defines environment variables and process settings for production

module.exports = {
  apps: [
    {
    name: 'insightscoop',
    script: 'npm',
    args: 'start',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
      // CRITICAL: Prevent infinite restart loops that freeze the server
      max_restarts: 10,              // Stop after 10 crashes
      min_uptime: '10s',             // Must run 10s to count as "started"
      restart_delay: 5000,           // Wait 5s between restarts
      exp_backoff_restart_delay: 100, // Exponential backoff on repeated crashes
    env: {
      NODE_ENV: 'production'
    }
    },
    // Workers - start separately with limits
    {
      name: 'worker-billing',
      script: 'npx',
      args: 'tsx -r dotenv/config jobs/start-billing-automation.ts',
      instances: 1,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000,
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'worker-visit-summary',
      script: 'npx',
      args: 'tsx -r dotenv/config jobs/start-visit-summary-worker.ts',
      instances: 1,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000,
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'worker-media-analysis',
      script: 'npx',
      args: 'tsx -r dotenv/config jobs/start-media-analysis-worker.ts',
      instances: 1,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000,
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'worker-push-notifications',
      script: 'npx',
      args: 'tsx -r dotenv/config jobs/start-push-notifications.ts',
      instances: 1,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000,
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'worker-offers',
      script: 'npx',
      args: 'tsx -r dotenv/config jobs/start-marketplace-offers.ts',
      instances: 1,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000,
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'worker-quickbooks',
      script: 'npx',
      args: 'tsx -r dotenv/config jobs/start-quickbooks-sync.ts',
      instances: 1,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000,
      env: { NODE_ENV: 'production' }
    },
    // Visit generation worker - handles async visit creation
    {
      name: 'worker-visit-generator',
      script: 'npx',
      args: 'tsx -r dotenv/config jobs/start-visit-generator-worker.ts',
      instances: 1,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000,
      env: { NODE_ENV: 'production' }
    },
    // Outbound transcription worker - processes call recordings
    {
      name: 'worker-outbound-transcription',
      script: 'npx',
      args: 'tsx -r dotenv/config jobs/start-outbound-transcription-worker.ts',
      instances: 1,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000,
      env: { NODE_ENV: 'production' }
    },
    // Tile generation worker - generates service area tiles
    {
      name: 'worker-tile-generation',
      script: 'npx',
      args: 'tsx -r dotenv/config jobs/start-tile-generation-worker.ts',
      instances: 1,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000,
      env: { NODE_ENV: 'production' }
    },
    // Tile publish worker - publishes tiles to production
    {
      name: 'worker-tile-publish',
      script: 'npx',
      args: 'tsx -r dotenv/config jobs/start-tile-publish-worker.ts',
      instances: 1,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000,
      env: { NODE_ENV: 'production' }
    },
    // Marketplace offer sweeper - cleans up expired offers
    {
      name: 'worker-offer-sweeper',
      script: 'npx',
      args: 'tsx -r dotenv/config jobs/start-marketplace-offer-sweeper.ts',
      instances: 1,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000,
      env: { NODE_ENV: 'production' }
    },
    // Marketplace offer auto-assign - escalates unclaimed offers to top scooper
    {
      name: 'worker-offer-auto-assign',
      script: 'npx',
      args: 'tsx -r dotenv/config jobs/start-marketplace-offer-auto-assign.ts',
      instances: 1,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000,
      env: { NODE_ENV: 'production' }
    },
    // Geo snapshot worker - caches geographic data for dispatch
    {
      name: 'worker-geo-snapshot',
      script: 'npx',
      args: 'tsx -r dotenv/config jobs/start-geo-snapshot-worker.ts',
      instances: 1,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000,
      env: { NODE_ENV: 'production' }
    },
    // Route drafts worker - generates route draft suggestions
    {
      name: 'worker-route-drafts',
      script: 'npx',
      args: 'tsx -r dotenv/config jobs/start-route-drafts-worker.ts',
      instances: 1,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000,
      env: { NODE_ENV: 'production' }
    },
    // Outbound cadence worker - schedules outbound call cadences
    {
      name: 'worker-outbound-cadence',
      script: 'npx',
      args: 'tsx -r dotenv/config jobs/start-outbound-cadence-worker.ts',
      instances: 1,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000,
      env: { NODE_ENV: 'production' }
    },
    // Outbound SLA worker - monitors SLA compliance
    {
      name: 'worker-outbound-sla',
      script: 'npx',
      args: 'tsx -r dotenv/config jobs/start-outbound-sla-worker.ts',
      instances: 1,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000,
      env: { NODE_ENV: 'production' }
    },
    // Scooper payout release worker - releases ready payouts on schedule
    {
      name: 'worker-payout-release',
      script: 'npx',
      args: 'tsx -r dotenv/config jobs/start-payout-release.ts',
      instances: 1,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000,
      env: { NODE_ENV: 'production' }
    },
    // Customer email wellness reports - scheduled summaries sent hourly (BullMQ + Redis)
    {
      name: 'worker-customer-email-reports',
      script: 'npx',
      args: 'tsx -r dotenv/config jobs/start-customer-email-reports.ts',
      instances: 1,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000,
      env: { NODE_ENV: 'production' }
    }
  ]
};

// Note: Sensitive environment variables (DATABASE_URL, API keys, etc.) 
// are loaded from .env file on the server which is not committed to git


// are loaded from .env.production file which is not committed to git
// The .env file on the server should contain:
// - NEXTAUTH_URL
// - NEXTAUTH_SECRET  
// - DATABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - STORAGE_BUCKET
// - OPENAI_API_KEY
// - TWILIO_ACCOUNT_SID
// - TWILIO_AUTH_TOKEN
// - TWILIO_PHONE_NUMBER
// - TWILIO_YARDURA_SID
// - TWILIO_YARDURA_SECRET




