#!/bin/bash
# Clear Google Maps API caches for testing

echo "🧹 Clearing Google Maps API Caches"
echo "===================================="
echo ""

# Check if Redis is running
if redis-cli ping > /dev/null 2>&1; then
    echo "Clearing Redis cache..."
    
    # Count keys before deletion
    GEOCODE_COUNT=$(redis-cli --scan --pattern "geocode:*" | wc -l | tr -d ' ')
    DISTANCE_COUNT=$(redis-cli --scan --pattern "distance-matrix:*" | wc -l | tr -d ' ')
    DIRECTIONS_COUNT=$(redis-cli --scan --pattern "directions:*" | wc -l | tr -d ' ')
    
    echo "  Geocode keys: $GEOCODE_COUNT"
    echo "  Distance Matrix keys: $DISTANCE_COUNT"
    echo "  Directions keys: $DIRECTIONS_COUNT"
    
    # Delete the keys
    redis-cli --scan --pattern "geocode:*" | xargs -r redis-cli DEL > /dev/null 2>&1
    redis-cli --scan --pattern "distance-matrix:*" | xargs -r redis-cli DEL > /dev/null 2>&1
    redis-cli --scan --pattern "directions:*" | xargs -r redis-cli DEL > /dev/null 2>&1
    
    echo "✅ Redis cache cleared"
else
    echo "⚠️  Redis is not running - skipping Redis cache clear"
fi

echo ""
echo "Clearing database route plan cache..."

# Use psql to clear ScooperRoutePlan table
if command -v psql > /dev/null 2>&1; then
    # Load DATABASE_URL from .env.local
    if [ -f .env.local ]; then
        export $(cat .env.local | grep DATABASE_URL | xargs)
    fi
    
    if [ -n "$DATABASE_URL" ]; then
        ROUTE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM \"ScooperRoutePlan\";")
        echo "  Current route plans: $(echo $ROUTE_COUNT | tr -d ' ')"
        
        psql "$DATABASE_URL" -c "DELETE FROM \"ScooperRoutePlan\";" > /dev/null 2>&1
        echo "✅ Database route plans cleared"
    else
        echo "⚠️  DATABASE_URL not found - skipping database clear"
    fi
else
    echo "⚠️  psql not found - skipping database clear"
fi

echo ""
echo "✅ All caches cleared! Next API request will hit Google Maps APIs."
echo ""
echo "To test fresh API calls:"
echo "  ./scripts/test-api-tracking.sh"









