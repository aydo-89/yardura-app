#!/usr/bin/env npx tsx
/**
 * Generate consistent, non-gross “animated-style” illustration images for the stool/tool library cards.
 *
 * - Uses Replicate via the `replicate` npm package.
 * - Model is configurable (so you can plug in Nano Banana Pro once you provide the Replicate model slug).
 * - Outputs .webp images into public/ so both web + native can display them.
 *
 * Usage:
 *   REPLICATE_API_TOKEN=... npx tsx scripts/ai/generate-stool-library-images.ts \
 *     --model google/nano-banana-pro \
 *     --outDir public/stool-library
 *
 * Optional:
 *   --only normal-1,soft-1
 *   --aspect 4:3
 *   --resolution 2K
 *   --format png
 *   --safety block_only_high
 *   --continue-on-error
 *   --dry-run
 */

import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

import Replicate from 'replicate';

import { STOOL_LIBRARY_ENTRIES } from '../../src/data/stool-library';

loadEnv();

const args = process.argv.slice(2);

const getArg = (name: string): string | null => {
  const flag = `--${name}`;
  const index = args.indexOf(flag);
  if (index !== -1) return args[index + 1] ?? null;
  const withEquals = args.find((arg) => arg.startsWith(`${flag}=`));
  return withEquals ? withEquals.slice(`${flag}=`.length) : null;
};

const hasFlag = (name: string) =>
  args.includes(`--${name}`) || args.some((arg) => arg.startsWith(`--${name}=`));

const token = process.env.REPLICATE_API_TOKEN || process.env.VITE_REPLICATE_API_TOKEN;
if (!token) {
  console.error('❌ REPLICATE_API_TOKEN not found in environment variables');
  console.error('Add it to .env: REPLICATE_API_TOKEN=your_token_here');
  process.exit(1);
}

const modelArg = getArg('model') || process.env.REPLICATE_IMAGE_MODEL || '';
if (!modelArg) {
  console.error('❌ Missing model. Provide --model <owner/model> or set REPLICATE_IMAGE_MODEL.');
  process.exit(1);
}
const model = modelArg as `${string}/${string}`;

const outDir = getArg('outDir') || 'public/stool-library';
const aspect = getArg('aspect') || '4:3';
const resolution = getArg('resolution') || '2K';
const outputFormat = (getArg('format') || 'png').toLowerCase();
const safetyFilterLevel = getArg('safety') || 'block_only_high';
const continueOnError = hasFlag('continue-on-error') || hasFlag('keep-going');
const only = (getArg('only') || '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);
const dryRun = hasFlag('dry-run') || hasFlag('dryRun');

const replicate = new Replicate({ auth: token });

const STYLE_LOCK = [
  'friendly animated-style illustration',
  'clean minimal infographic',
  'rounded soft shapes',
  'pastel palette with subtle gradients',
  'high readability, simple composition',
  'no text, no captions, no watermark, no logo',
  'kid-friendly medical infographic vibe',
  'NOT gross, NOT photorealistic',
].join(', ');

const NEGATIVE = [
  'photorealistic',
  'graphic',
  'gore',
  'bodily fluids',
  'feces',
  'poop',
  'stool photo',
  'blood splatter',
  'mucus closeup',
  'worms',
  'text',
  'watermark',
  'logo',
].join(', ');

const promptForEntry = (id: string, label: string, color: string, firmnessScale: number) => {
  // We intentionally keep the subject abstract to be non-gross while still educational.
  // The “shape language” conveys firmness and flags without depicting anything explicit.
  const subjectBase = `A small abstract “sample” icon made of smooth rounded shapes, color theme ${color}, firmness scale ${firmnessScale}/7`;

  if (id === 'normal-1') {
    return `${STYLE_LOCK}. ${subjectBase}. Three smooth brown rounded forms with a gentle highlight, tiny sparkle, subtle green check icon, calm background.`;
  }
  if (id === 'soft-1') {
    return `${STYLE_LOCK}. ${subjectBase}. Softer rounded mound shapes with slightly softened edges, small “watch” badge icon, calm background.`;
  }
  if (id === 'watery-1') {
    return `${STYLE_LOCK}. ${subjectBase}. Abstract flowing wave-like shapes with a few droplets, small amber caution badge, calm background.`;
  }
  if (id === 'dry-1') {
    return `${STYLE_LOCK}. ${subjectBase}. Small pebble-like rounded pellets, subtle “hydrate” droplet icon, calm background.`;
  }
  if (id === 'yellow-1') {
    return `${STYLE_LOCK}. ${subjectBase}. Pale yellow rounded forms with a soft sheen, small “monitor” badge icon, calm background.`;
  }
  if (id === 'red-1') {
    return `${STYLE_LOCK}. ${subjectBase}. Brown rounded form with a thin red accent line (non-graphic), clear “vet” warning badge icon, calm background.`;
  }
  if (id === 'black-1') {
    return `${STYLE_LOCK}. ${subjectBase}. Dark charcoal rounded form with glossy highlight, clear “vet” warning badge icon, calm background.`;
  }
  if (id === 'mucus-1') {
    return `${STYLE_LOCK}. ${subjectBase}. Brown rounded form with a translucent swirl overlay (non-graphic), small “monitor” badge icon, calm background.`;
  }

  return `${STYLE_LOCK}. ${subjectBase}. Calm background.`;
};

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

type ReplicateRunError = Error & {
  response?: {
    status?: number;
    statusText?: string;
  };
};

const getStatusCode = (error: unknown): number | null => {
  const anyErr = error as ReplicateRunError | undefined;
  const status = anyErr?.response?.status;
  return typeof status === 'number' ? status : null;
};

const downloadToFile = async (url: string, filePath: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url} (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buf);
};

type ReplicateFileLike = {
  url?: () => string;
};

const isBinaryLike = (value: unknown): value is Uint8Array =>
  value instanceof Uint8Array || Buffer.isBuffer(value);

const asUrlFromOutput = (output: unknown): string | null => {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) {
    const first = output[0];
    if (typeof first === 'string') return first;
    if (first && typeof (first as ReplicateFileLike).url === 'function') {
      return (first as ReplicateFileLike).url!();
    }
  }
  if (output && typeof (output as ReplicateFileLike).url === 'function') {
    return (output as ReplicateFileLike).url!();
  }
  return null;
};

const saveOutputToFile = async (output: unknown, filePath: string) => {
  if (isBinaryLike(output)) {
    fs.writeFileSync(filePath, Buffer.from(output));
    return { url: null as string | null };
  }
  const url = asUrlFromOutput(output);
  if (!url) {
    throw new Error(
      `Unexpected Replicate output shape. Got: ${JSON.stringify(output).slice(0, 500)}`,
    );
  }
  await downloadToFile(url, filePath);
  return { url };
};

async function main() {
  const selected = STOOL_LIBRARY_ENTRIES.filter((entry) =>
    only.length ? only.includes(entry.id) : true,
  );

  if (!selected.length) {
    console.error('No entries selected.');
    process.exit(1);
  }

  ensureDir(outDir);
  const metaDir = path.join(outDir, '_meta');
  ensureDir(metaDir);
  const promptDumpPath = path.join(
    metaDir,
    `prompts_${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  const promptDump: Array<{
    id: string;
    label: string;
    prompt: string;
    model: string;
    aspectRatio: string;
    resolution: string;
    outputFormat: string;
    safetyFilterLevel: string;
  }> = [];

  console.log(`🎨 Model: ${model}`);
  console.log(`📁 Output: ${outDir}`);
  console.log(`🧾 Entries: ${selected.length}`);
  console.log(`🖼️  aspect=${aspect} resolution=${resolution} format=${outputFormat}`);
  if (dryRun) console.log('🟡 DRY RUN (no API calls)');
  if (continueOnError) console.log('🟡 continue-on-error enabled');

  for (const entry of selected) {
    const prompt = promptForEntry(entry.id, entry.label, entry.color, entry.firmnessScale);
    const outPath = path.join(outDir, `${entry.id}.${outputFormat}`);
    const metaPath = path.join(metaDir, `${entry.id}.json`);

    console.log(`\n→ ${entry.id}: ${entry.label}`);
    console.log(`   prompt: ${prompt}`);
    console.log(`   file: ${outPath}`);

    promptDump.push({
      id: entry.id,
      label: entry.label,
      prompt,
      model,
      aspectRatio: aspect,
      resolution,
      outputFormat,
      safetyFilterLevel,
    });

    if (dryRun) continue;

    // google/nano-banana-pro schema:
    // prompt, image_input[], aspect_ratio, resolution, output_format, safety_filter_level
    // (No negative_prompt field.)
    let output: unknown;
    let url: string | null = null;
    try {
      output = await replicate.run(model, {
        input: {
          prompt,
          aspect_ratio: aspect,
          resolution,
          output_format: outputFormat,
          safety_filter_level: safetyFilterLevel,
        },
      });

      const saved = await saveOutputToFile(output, outPath);
      url = saved.url;
    } catch (error) {
      const status = getStatusCode(error);
      if (status === 402) {
        console.error('\n❌ Replicate returned 402 (Insufficient credit).');
        console.error(
          'Fix: add a payment method + purchase credit, then retry (it can take a couple minutes to activate).',
        );
      } else if (status === 403) {
        console.error('\n❌ Replicate returned 403 (Forbidden / account disabled).');
        console.error('Fix: re-enable the account (billing/invoices/credit), then retry.');
      }

      // Always persist prompts so you can rerun later without losing the batch.
      fs.writeFileSync(promptDumpPath, JSON.stringify(promptDump, null, 2));
      console.error(`🧾 Saved prompts: ${promptDumpPath}`);

      if (continueOnError) {
        console.error(`↪︎ Skipping ${entry.id} due to error.\n`);
        continue;
      }
      throw error;
    }

    fs.writeFileSync(
      metaPath,
      JSON.stringify(
        {
          id: entry.id,
          label: entry.label,
          imageUrl: `/${path.posix.join(path.basename(outDir), `${entry.id}.${outputFormat}`)}`,
          model,
          prompt,
          aspectRatio: aspect,
          resolution,
          outputFormat,
          safetyFilterLevel,
          generatedAt: new Date().toISOString(),
          outputUrl: url,
        },
        null,
        2,
      ),
    );

    console.log(`   ✅ saved`);
  }

  fs.writeFileSync(promptDumpPath, JSON.stringify(promptDump, null, 2));
  console.log(`\n🧾 Saved prompts: ${promptDumpPath}`);
  console.log('\nDone.');
  console.log('Tip: commit the generated images under public/ so they ship to prod + native.');
}

main().catch((err) => {
  console.error('\n❌ Image generation failed');
  console.error(err);
  process.exit(1);
});


