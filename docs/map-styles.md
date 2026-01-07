# Field Tech Route Map Styles

The schedule map now uses MapLibre with MapTiler styles. To see the full light/dark/satellite basemaps you’ll need a MapTiler API key (free tier is plenty).

## Setup
1. Create a free key at https://cloud.maptiler.com/
2. Add it to your environment:
   ```bash
   NEXT_PUBLIC_MAPTILER_KEY=pk_YOUR_KEY_HERE
   ```
3. Restart the dev server / redeploy.

If no key is provided we fall back to the public MapLibre demo style. It works for basic map rendering but doesn’t offer the darker or satellite variants.

Whenever MapLibre emits a tile error you’ll see a note on the map along with a reminder to set the key.
