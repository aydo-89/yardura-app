#!/bin/bash
# Test script to verify Google Maps API quotas and functionality

set -e

echo "🧪 Testing Google Maps API Setup with New Quotas"
echo "================================================"
echo ""

# Check environment variables
echo "📋 Checking Environment Variables..."
if [ -f .env.local ]; then
  echo "✅ .env.local exists"
  if grep -q "GOOGLE_MAPS_SERVER_KEY" .env.local; then
    echo "✅ GOOGLE_MAPS_SERVER_KEY found in .env.local"
  else
    echo "⚠️  GOOGLE_MAPS_SERVER_KEY not found in .env.local"
  fi
else
  echo "⚠️  .env.local not found"
fi

if [ -f .env ]; then
  echo "✅ .env exists"
  if grep -q "GOOGLE_MAPS_SERVER_KEY" .env; then
    echo "✅ GOOGLE_MAPS_SERVER_KEY found in .env"
  else
    echo "⚠️  GOOGLE_MAPS_SERVER_KEY not found in .env"
  fi
else
  echo "⚠️  .env not found"
fi

echo ""
echo "🧹 Clearing caches..."
./scripts/clear-google-cache.sh

echo ""
echo "🚀 Starting dev server with API tracking enabled..."
echo "   This will start the server and enable API call tracking."
echo "   Press Ctrl+C to stop when testing is complete."
echo ""
echo "📊 Watch for:"
echo "   - Google API call logs (Distance Matrix, Routes, Geocoding)"
echo "   - API call summary at the end"
echo "   - No OVER_QUERY_LIMIT errors"
echo ""

export TRACK_GOOGLE_API_CALLS=true
npm run dev 2>&1 | grep -E "(Google API|ready|Local:|USAGE SUMMARY|Distance Matrix|Directions|Geocoding|TOTAL API|CACHE SAVINGS|OVER_QUERY_LIMIT|⚠)" --line-buffered









