#!/usr/bin/env npx tsx
/**
 * Generate consistent illustration images for stool library cards.
 * These images are ONLY the visual - not the full card UI.
 *
 * Uses GOOGLE_GEMINI_API_KEY from .env.local/.env.
 *
 * VERSIONING: Each run creates a timestamped folder so you can compare and pick the best.
 *   Output: public/stool-library/run-YYYYMMDD-HHMMSS/
 *
 * Usage:
 *   npm run images:stool-library:gemini
 *   npm run images:stool-library:gemini -- --only normal-1,soft-1
 */

import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

import { STOOL_LIBRARY_ENTRIES } from '../../src/data/stool-library';

loadEnv({ path: path.resolve(process.cwd(), '.env.local') });
loadEnv({ path: path.resolve(process.cwd(), '.env') });

const args = process.argv.slice(2);
const getArg = (name: string): string | null => {
  const flag = `--${name}`;
  const idx = args.indexOf(flag);
  if (idx !== -1) return args[idx + 1] ?? null;
  const eq = args.find((a) => a.startsWith(`${flag}=`));
  return eq ? eq.slice(`${flag}=`.length) : null;
};
const hasFlag = (name: string) =>
  args.includes(`--${name}`) || args.some((a) => a.startsWith(`--${name}=`));

const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ Missing GOOGLE_GEMINI_API_KEY in .env.local');
  process.exit(1);
}

const model = getArg('model') || 'gemini-3-pro-image-preview';
const baseOutDir = getArg('outDir') || 'public/stool-library';
const aspect = getArg('aspect') || '1:1';
const resolution = getArg('resolution') || '1K';
const continueOnError = hasFlag('continue-on-error');
const only = (getArg('only') || '').split(',').map((v) => v.trim()).filter(Boolean);
const dryRun = hasFlag('dry-run');

// Generate timestamped run folder so we don't overwrite previous runs
const runTimestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
const outDir = path.join(baseOutDir, `run-${runTimestamp}`);

// ═══════════════════════════════════════════════════════════════════════════════
// VISUAL STYLE - Locked across ALL images for consistency
// ═══════════════════════════════════════════════════════════════════════════════
const VISUAL_STYLE = {
  // Art style - realistic organic shapes, NOT geometric
  style: 'clean semi-realistic illustration, medical education style',
  
  // CRITICAL: Shape guidance - organic, not geometric
  shapeGuidance: 'IMPORTANT: Use organic irregular shapes with natural lumpy edges, slight bulges, tapered ends. NOT perfect geometric cylinders or sharp clean edges. Real stool has uneven natural form like soft clay that was squeezed out.',
  
  // Color approach
  palette: 'realistic natural earth tones, true-to-life colors',
  
  // Background (same for all) - neutral so focus is on the stool
  background: 'plain solid light neutral gray (#F0F0F0) background, no textures or patterns',
  
  // Rendering
  rendering: 'soft shading with realistic form, gentle shadow underneath for grounding',
  
  // View angle - slightly elevated so you see the shape clearly
  viewAngle: 'slightly elevated 3/4 view, as if looking down at the ground',
  
  // What NOT to include
  avoid: [
    'text or labels',
    'cartoon faces or expressions', 
    'flies or insects',
    'smell lines or stink marks',
    'grass or outdoor environment',
    'overly gross or disgusting details',
    'perfect geometric shapes',
    'sharp clean cylinder edges',
    'machine-cut or manufactured looking shapes',
  ].join(', '),
};

// ═══════════════════════════════════════════════════════════════════════════════
// STOOL VISUALS - REALISTIC descriptions of what pet owners will actually see
// ═══════════════════════════════════════════════════════════════════════════════
// These are based on veterinary references for what each condition actually looks like

type StoolVisual = {
  id: string;
  shape: string;
  color: string;
  distinguishingFeature: string;
  surface: string;
  realLifeNote: string; // What this actually looks like IRL
};

const STOOL_VISUALS: StoolVisual[] = [
  {
    // IDEAL/NORMAL: What healthy dog poop looks like
    id: 'normal-1',
    shape: 'firm organic log shape with natural lumpy irregular edges, slightly tapered ends, NOT a perfect cylinder',
    color: 'chocolate brown, consistent color throughout',
    distinguishingFeature: 'holds shape firmly, can be picked up easily without leaving residue',
    surface: 'smooth with slight natural sheen, organic texture with natural bumps and variation',
    realLifeNote: 'Like a firm sausage with natural irregular shape - organic lumps, tapered ends, not machine-cut',
  },
  {
    // SOFT: Still has form but softer - like soft-serve ice cream consistency
    id: 'soft-1',
    shape: 'coiled soft pile that still has some structure but is visibly drooping and settling, like soft-serve ice cream',
    color: 'medium brown, natural color',
    distinguishingFeature: 'still has log-like coiled form but edges are soft and rounding out, slightly flattening at the base',
    surface: 'moist looking, slightly glossy from moisture, soft texture visible, edges are losing definition',
    realLifeNote: 'Like soft-serve ice cream just dispensed - still has a coiled/swirled shape but soft, sagging, would smear if touched',
  },
  {
    // WATERY/DIARRHEA: Very loose but still has some substance
    id: 'watery-1',
    shape: 'very loose mushy pile with no defined form, flat and spreading but still has some texture and small soft chunks',
    color: 'medium brown, slightly lighter than normal due to moisture',
    distinguishingFeature: 'lost log shape completely, flat mushy mess, but still has some chunky texture - not pure liquid',
    surface: 'wet and glossy, uneven lumpy texture, spreading at edges',
    realLifeNote: 'Like very loose oatmeal or thick muddy slurry - has substance but no form, messy pile',
  },
  {
    // WATERY-2: Very liquid diarrhea - more severe than watery-1 but not pure water
    id: 'watery-2',
    shape: 'flat spreading mess with visible small chunks and bits suspended in liquid, not a clean puddle',
    color: 'murky opaque brown, not translucent - more like muddy water with suspended particles',
    distinguishingFeature: 'mostly liquid but with visible small solid bits and chunks floating in it, uneven murky texture',
    surface: 'wet but murky and opaque, has visible specks and small lumps of solid matter throughout',
    realLifeNote: 'Like muddy water with debris in it - liquid but cloudy/murky with visible bits, not a clean puddle',
  },
  {
    // DRY/CONSTIPATED: Hard pellets
    id: 'dry-1',
    shape: 'small hard round pellets or short broken segments, scattered pieces not connected',
    color: 'dark brown, drier looking',
    distinguishingFeature: 'broken into multiple small hard pieces instead of connected logs',
    surface: 'dry, slightly rough or cracked looking, no moisture',
    realLifeNote: 'Like rabbit droppings or dry crumbly pieces - hard nuggets with gaps between',
  },
  {
    // YELLOW/GRAY (PALE): Indicates liver/gallbladder issues
    id: 'yellow-1',
    shape: 'organic log shape with natural lumpy irregular edges, similar form to normal but wrong color',
    color: 'pale grayish-tan or clay-colored with slight yellow tint, noticeably lighter than healthy brown',
    distinguishingFeature: 'abnormally pale color - gray, tan, or clay-like instead of normal brown',
    surface: 'may appear slightly greasy or fatty looking, organic natural texture',
    realLifeNote: 'Like wet clay or putty color - grayish-tan, organic irregular shape, clearly not normal brown',
  },
  {
    // RED STREAKS: Fresh blood - needs to look realistic, not cartoonish
    id: 'red-1',
    shape: 'organic log shape with natural lumpy irregular edges, NOT a perfect cylinder',
    color: 'chocolate brown base with subtle red-tinged areas or thin red marks',
    distinguishingFeature: 'thin streaks or small spots of fresh red blood on the surface - subtle but noticeable, realistic looking',
    surface: 'organic brown texture with a few areas where red is visible - natural blood marks, not cartoon stripes',
    realLifeNote: 'Normal organic-shaped brown stool with thin realistic blood marks - subtle red, natural irregular form',
  },
  {
    // BLACK/TARRY: Digested blood (melena) - very dark brown-black, not pure black
    id: 'black-1',
    shape: 'organic log shape with natural lumpy irregular edges, slightly sticky or tarry looking',
    color: 'very dark brownish-black, like dark coffee grounds or very dark chocolate - NOT pure jet black',
    distinguishingFeature: 'unusually dark color that is darker than normal brown but has brown undertones, sticky looking',
    surface: 'slightly shiny, tar-like sheen, looks sticky and wet, organic irregular form',
    realLifeNote: 'Like dark coffee grounds or very dark chocolate brownie - brownish-black, shiny, sticky looking',
  },
  {
    // MUCUS: Slimy coating - needs to look like a wet glossy sheen, not white frosting
    id: 'mucus-1',
    shape: 'organic log shape with natural lumpy irregular edges, normal stool form',
    color: 'normal brown stool with a wet, glossy, translucent sheen on parts of the surface',
    distinguishingFeature: 'visible wet slimy coating like clear snot or saliva on parts of the stool - translucent and shiny, NOT opaque white',
    surface: 'some areas look normal matte brown, other areas have a visible wet glossy sheen like the stool passed through something slimy',
    realLifeNote: 'Brown stool that looks partially wet/slimy - like someone dripped clear hair gel or egg white on it, with visible wet shiny patches',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// BUILD PROMPT
// ═══════════════════════════════════════════════════════════════════════════════
const buildPrompt = (visual: StoolVisual): string => {
  return [
    // What we're creating
    `Create a ${VISUAL_STYLE.style} of dog stool for a veterinary education app.`,
    
    // CRITICAL shape guidance - organic not geometric
    `${VISUAL_STYLE.shapeGuidance}`,
    
    // Style elements
    `Use ${VISUAL_STYLE.palette}.`,
    `Background: ${VISUAL_STYLE.background}.`,
    `Rendering: ${VISUAL_STYLE.rendering}.`,
    `Camera angle: ${VISUAL_STYLE.viewAngle}.`,
    
    // The specific stool - be very explicit
    `SHAPE: ${visual.shape}.`,
    `COLOR: ${visual.color}.`,
    `KEY IDENTIFYING FEATURE: ${visual.distinguishingFeature}.`,
    `SURFACE/TEXTURE: ${visual.surface}.`,
    `REAL LIFE REFERENCE: ${visual.realLifeNote}.`,
    
    // Avoid
    `Do NOT include: ${VISUAL_STYLE.avoid}.`,
    
    // Guidance
    `This must look realistic enough that a pet owner can compare it to their dog's actual stool.`,
    `The image should clearly show the distinguishing characteristics so owners know what to look for.`,
    `Remember: ORGANIC irregular shapes like squeezed-out soft material, NOT perfect geometric cylinders.`,
  ].join(' ');
};

// ═══════════════════════════════════════════════════════════════════════════════
// API HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const postJson = async (url: string, body: unknown) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { ok: res.ok, status: res.status, body: parsed };
};

const extractImageBase64 = (responseBody: any): string | null => {
  const parts = responseBody?.candidates?.[0]?.content?.parts ?? [];
  if (!Array.isArray(parts)) return null;
  for (const part of parts) {
    const data = part?.inline_data?.data ?? part?.inlineData?.data;
    if (typeof data === 'string') return data;
  }
  return null;
};

const buildRequest = (prompt: string) => ({
  contents: [{ role: 'user', parts: [{ text: prompt }] }],
  generationConfig: {
    responseModalities: ['IMAGE'],
    imageConfig: { aspectRatio: aspect, imageSize: resolution },
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  const selected = STOOL_LIBRARY_ENTRIES.filter((e) =>
    only.length ? only.includes(e.id) : true,
  );
  
  ensureDir(outDir);

  console.log(`\n🎨 Stool Library Image Generator`);
  console.log(`   Model: ${model}`);
  console.log(`   Output: ${outDir}`);
  console.log(`   Entries: ${selected.length}`);
  console.log(`   Format: ${aspect} @ ${resolution}\n`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const prompts: any[] = [];

  for (const entry of selected) {
    const visual = STOOL_VISUALS.find((v) => v.id === entry.id);
    if (!visual) {
      console.log(`⚠️  No visual spec for ${entry.id}, skipping`);
      continue;
    }

    const prompt = buildPrompt(visual);
    const outPath = path.join(outDir, `${entry.id}.png`);
    
    prompts.push({ id: entry.id, label: entry.label, visual, prompt });

    console.log(`→ ${entry.id}: ${entry.label}`);
    console.log(`  Real-life: ${visual.realLifeNote.slice(0, 70)}...`);

    if (dryRun) {
      console.log(`  [dry-run] skipped\n`);
      continue;
    }

    const res = await postJson(url, buildRequest(prompt));
    
    if (!res.ok) {
      const msg = res.body?.error?.message || JSON.stringify(res.body);
      console.error(`  ❌ Failed: ${msg}\n`);
      if (!continueOnError) process.exit(1);
      continue;
    }

    const imageBase64 = extractImageBase64(res.body);
    if (!imageBase64) {
      console.error(`  ❌ No image in response\n`);
      if (!continueOnError) process.exit(1);
      continue;
    }

    fs.writeFileSync(outPath, Buffer.from(imageBase64, 'base64'));
    console.log(`  ✅ saved\n`);
  }

  // Save prompts for reference
  fs.writeFileSync(
    path.join(outDir, `_prompts.json`),
    JSON.stringify({ timestamp: runTimestamp, model, aspect, resolution, prompts }, null, 2),
  );

  console.log(`📁 Run complete: ${outDir}`);
  console.log(`   To use: cp ${outDir}/<file>.png public/stool-library/\n`);
}

main().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
