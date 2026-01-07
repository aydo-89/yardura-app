## AI Stool/Tool Library Card Images (Replicate)

This repo includes a small generator script to create **consistent, non-gross, “animated-style”** images for the stool library / tool library cards using Replicate.

### What it generates
- **Output format**: `.webp`
- **Output location**: `public/stool-library/<entryId>.webp`
- **Metadata**: `public/stool-library/_meta/<entryId>.json`

These files are then referenced by `imageUrl` in `src/data/stool-library.ts` and are served to:
- **Web**: `src/components/dashboard/mobile/MobileStoolLibrary.tsx`
- **Native**: `apps/native/app/(app)/(customer)/wellness-stool-library.tsx`

### Setup
Add a Replicate token in your local environment:

- `REPLICATE_API_TOKEN=...`

Pick a Replicate image model (owner/model slug). Set one of:
- `--model <owner/model>`
- or env var `REPLICATE_IMAGE_MODEL=<owner/model>`

### Run
Generate all stool library images:

```bash
REPLICATE_API_TOKEN=... npx tsx scripts/ai/generate-stool-library-images.ts \
  --model google/nano-banana-pro \
  --outDir public/stool-library
```

### Alternative: Google Gemini direct (no Replicate)
If Replicate billing is blocked, you can generate the same images directly via the Gemini API.

1. Add to `.env.local`:
- `GOOGLE_GEMINI_API_KEY=...`

2. Run (Nano Banana Pro):

```bash
npm run images:stool-library:gemini -- --model gemini-3-pro-image-preview --outDir public/stool-library --aspect 4:3 --resolution 2K
```

This writes:
- `public/stool-library/<entryId>.png`
- `public/stool-library/_meta/<entryId>.json`

Generate a subset:

```bash
REPLICATE_API_TOKEN=... npx tsx scripts/ai/generate-stool-library-images.ts \
  --model google/nano-banana-pro \
  --outDir public/stool-library \
  --only normal-1,red-1,black-1
```

Dry-run (prints prompts, no API calls):

```bash
npx tsx scripts/ai/generate-stool-library-images.ts \
  --model google/nano-banana-pro \
  --outDir public/stool-library \
  --dry-run
```

### Nano Banana Pro schema notes
`google/nano-banana-pro` supports:
- `prompt` (string)
- `image_input` (optional, up to 14 images)
- `aspect_ratio` (e.g. `4:3`)
- `resolution` (`2K` default)
- `output_format` (`png`/`jpg`)
- `safety_filter_level`

The generator exposes these via:
- `--aspect 4:3`
- `--resolution 2K`
- `--format png`
- `--safety block_only_high`

### Style constraints (important)
The prompts intentionally avoid graphic/realistic depiction. They use **abstract shape language** + small “badge” icons to communicate:
- firmness (hard → watery)
- color flags (yellow/red/black)
- action level (watch/monitor/vet)

If you want to switch to “Nano Banana Pro”, tell me:
- the Replicate model slug (or its required `version` id + input schema)
- required input keys (e.g. `prompt`, `negative_prompt`, size, etc.)

and I’ll update the script to match it precisely.


