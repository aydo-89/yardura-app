#!/usr/bin/env node

/**
 * Yardura Smoke Tests
 *
 * Basic health checks for deployed application
 * Usage: node scripts/smoke-tests.js [app-url]
 */

const https = require('https');
const http = require('http');

const APP_URL = process.argv[2] || process.env.APP_URL || 'http://localhost:3000';

console.log(`🧪 Running smoke tests against ${APP_URL}\n`);

// Test configurations
const TESTS = [
  {
    name: 'Homepage loads',
    url: '/',
    expectedStatus: 200,
    checkContent: (body) => body.includes('Yardura'),
  },
  {
    name: 'API health check',
    url: '/api/health',
    expectedStatus: 200,
  },
  {
    name: 'Quote page loads',
    url: '/quote',
    expectedStatus: 200,
    checkContent: (body) => body.includes('quote') || body.includes('Quote'),
  },
  {
    name: 'Services page loads',
    url: '/services',
    expectedStatus: 200,
  },
  {
    name: 'Contact page loads',
    url: '/contact',
    expectedStatus: 200,
  },
  {
    name: 'Signin page loads',
    url: '/signin',
    expectedStatus: 200,
  },
  {
    name: 'Signup page loads',
    url: '/signup',
    expectedStatus: 200,
  },
];

// HTTP request helper
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    const requestUrl = new URL(url);

    const req = protocol.request({
      hostname: requestUrl.hostname,
      port: requestUrl.port,
      path: requestUrl.pathname + requestUrl.search,
      method: 'GET',
      timeout: 10000,
      ...options,
    }, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body,
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Run individual test
async function runTest(test) {
  const fullUrl = `${APP_URL}${test.url}`;

  try {
    console.log(`  Testing: ${test.name} (${fullUrl})`);

    const response = await makeRequest(fullUrl);

    // Check status code
    if (response.status !== test.expectedStatus) {
      throw new Error(`Expected status ${test.expectedStatus}, got ${response.status}`);
    }

    // Check content if specified
    if (test.checkContent && !test.checkContent(response.body)) {
      throw new Error('Content validation failed');
    }

    console.log(`    ✅ PASS`);
    return { success: true, test: test.name };

  } catch (error) {
    console.log(`    ❌ FAIL: ${error.message}`);
    return { success: false, test: test.name, error: error.message };
  }
}

// Performance test
async function runPerformanceTest() {
  console.log(`\n⚡ Running performance test...`);

  try {
    const startTime = Date.now();
    const response = await makeRequest(`${APP_URL}/`);
    const loadTime = Date.now() - startTime;

    console.log(`  Homepage load time: ${loadTime}ms`);

    if (loadTime > 3000) {
      console.log(`    ⚠️  SLOW: Load time exceeds 3 seconds`);
      return { success: false, test: 'Performance', error: `Load time: ${loadTime}ms` };
    } else {
      console.log(`    ✅ PASS: Load time within acceptable range`);
      return { success: true, test: 'Performance', loadTime };
    }

  } catch (error) {
    console.log(`    ❌ FAIL: ${error.message}`);
    return { success: false, test: 'Performance', error: error.message };
  }
}

// Main test runner
async function runSmokeTests() {
  const results = {
    passed: 0,
    failed: 0,
    total: TESTS.length + 1, // +1 for performance test
  };

  console.log('Running smoke tests...\n');

  // Run functional tests
  for (const test of TESTS) {
    const result = await runTest(test);
    if (result.success) {
      results.passed++;
    } else {
      results.failed++;
    }
  }

  // Run performance test
  const perfResult = await runPerformanceTest();
  if (perfResult.success) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('SMOKE TEST RESULTS');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${results.total}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Success Rate: ${Math.round((results.passed / results.total) * 100)}%`);

  if (results.failed === 0) {
    console.log('\n🎉 All smoke tests passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Some smoke tests failed!');
    process.exit(1);
  }
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

// Run tests
if (require.main === module) {
  runSmokeTests().catch((error) => {
    console.error('❌ Smoke tests failed:', error);
    process.exit(1);
  });
}

module.exports = { runSmokeTests, runTest };


