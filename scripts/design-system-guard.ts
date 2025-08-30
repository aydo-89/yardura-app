#!/usr/bin/env tsx

/**
 * Design System Guard Script
 * Scans the codebase for design system violations and suggests fixes
 * Run with: npm run design-system:check
 */

import { glob } from 'glob';
import { readFileSync } from 'fs';
import { resolve, extname } from 'path';

interface Violation {
  file: string;
  line: number;
  column: number;
  violation: string;
  suggestion: string;
  severity: 'error' | 'warning';
}

// Design system rules
const DESIGN_SYSTEM_RULES = {
  // Allowed color classes
  allowedColors: [
    'text-ink', 'text-muted', 'text-accent', 'text-warning',
    'bg-white', 'bg-accent', 'bg-accent-soft', 'bg-ink', 'bg-panel', 'bg-card',
    'border-accent', 'border-accent/10', 'border-black/5',
    'hover:bg-accent-soft', 'hover:bg-accent', 'hover:text-accent',
    'focus:ring-accent', 'focus:ring-2', 'focus:outline-none',
    'text-slate-500', 'text-blue-600', 'text-emerald-600',
    'bg-blue-50', 'bg-green-50', 'bg-red-50',
    'border-red-600', 'text-red-600', 'text-green-600'
  ],

  // Forbidden color patterns
  forbiddenPatterns: [
    /^bg-\[(.*)\]$/, // Arbitrary background colors
    /^text-\[(.*)\]$/, // Arbitrary text colors
    /^border-\[(.*)\]$/, // Arbitrary border colors
    /^bg-(red|blue|green|yellow|purple|pink|indigo|gray|slate|zinc|neutral|stone|orange|amber|lime|emerald|teal|cyan|sky|violet|fuchsia|rose)-\d+$/,
    /^text-(red|blue|green|yellow|purple|pink|indigo|gray|slate|zinc|neutral|stone|orange|amber|lime|emerald|teal|cyan|sky|violet|fuchsia|rose)-\d+$/,
    /^border-(red|blue|green|yellow|purple|pink|indigo|gray|slate|zinc|neutral|stone|orange|amber|lime|emerald|teal|cyan|sky|violet|fuchsia|rose)-\d+$/,
  ],

  // Utility classes that are allowed
  allowedUtilities: [
    'size-', 'w-', 'h-', 'p-', 'm-', 'rounded-', 'shadow-',
    'flex', 'grid', 'items-', 'justify-', 'gap-', 'space-',
    'hover:', 'focus:', 'md:', 'lg:', 'xl:',
    'sr-only', 'container', 'max-w-', 'min-w-', 'font-',
    'text-', 'leading-', 'tracking-', 'transition', 'duration-', 'ease-',
    'animate-', 'delay-', 'opacity-', 'scale-', 'translate-',
  ]
};

function scanFile(filePath: string): Violation[] {
  const violations: Violation[] = [];
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, lineIndex) => {
    // Look for className or class attributes
    const classMatches = line.match(/(?:className|class)="([^"]*)"/g);
    if (!classMatches) return;

    classMatches.forEach(match => {
      const classValue = match.match(/"([^"]*)"/)?.[1];
      if (!classValue) return;

      const classes = classValue.split(/\s+/);

      classes.forEach(className => {
        let violation: Violation | null = null;

        // Check against forbidden patterns
        for (const pattern of DESIGN_SYSTEM_RULES.forbiddenPatterns) {
          if (pattern.test(className)) {
            violation = {
              file: filePath,
              line: lineIndex + 1,
              column: line.indexOf(className) + 1,
              violation: `Arbitrary color class: ${className}`,
              suggestion: 'Use design token classes from tokens.css',
              severity: 'error'
            };
            break;
          }
        }

        // Check for ad-hoc color usage
        if (!violation) {
          const isAllowedUtility = DESIGN_SYSTEM_RULES.allowedUtilities.some(util =>
            className.startsWith(util) || className.includes(util)
          );

          const isAllowedColor = DESIGN_SYSTEM_RULES.allowedColors.includes(className);

          if (!isAllowedUtility && !isAllowedColor) {
            // Check for color-related classes
            const colorClasses = ['red-', 'blue-', 'green-', 'yellow-', 'purple-', 'pink-',
                                'indigo-', 'gray-', 'slate-', 'zinc-', 'neutral-', 'stone-',
                                'orange-', 'amber-', 'lime-', 'emerald-', 'teal-', 'cyan-',
                                'sky-', 'violet-', 'fuchsia-', 'rose-'];

            for (const colorClass of colorClasses) {
              if (className.includes(colorClass)) {
                let suggestion = 'Use design token classes';
                if (className.includes('red-')) suggestion = 'text-red-600 for errors';
                else if (className.includes('blue-')) suggestion = 'text-blue-600 or bg-blue-50';
                else if (className.includes('green-')) suggestion = 'text-green-600 or bg-green-50';
                else if (className.includes('gray-') || className.includes('slate-') || className.includes('zinc-'))
                  suggestion = 'text-muted or text-ink';

                violation = {
                  file: filePath,
                  line: lineIndex + 1,
                  column: line.indexOf(className) + 1,
                  violation: `Ad-hoc color class: ${className}`,
                  suggestion,
                  severity: 'warning'
                };
                break;
              }
            }
          }
        }

        if (violation) {
          violations.push(violation);
        }
      });
    });
  });

  return violations;
}

async function scanCodebase(): Promise<Violation[]> {
  const allViolations: Violation[] = [];

  // Scan TypeScript/React files
  const files = await glob('src/**/*.{ts,tsx,js,jsx}', {
    cwd: process.cwd(),
    absolute: true
  });

  console.log(`🔍 Scanning ${files.length} files for design system violations...`);

  for (const file of files) {
    const violations = scanFile(file);
    allViolations.push(...violations);
  }

  return allViolations;
}

function printReport(violations: Violation[]): void {
  if (violations.length === 0) {
    console.log('✅ No design system violations found!');
    return;
  }

  console.log(`🚨 Found ${violations.length} design system violations:\n`);

  const errors = violations.filter(v => v.severity === 'error');
  const warnings = violations.filter(v => v.severity === 'warning');

  if (errors.length > 0) {
    console.log('❌ ERRORS:');
    errors.forEach(violation => {
      console.log(`  ${violation.file}:${violation.line}:${violation.column}`);
      console.log(`    ${violation.violation}`);
      console.log(`    💡 ${violation.suggestion}\n`);
    });
  }

  if (warnings.length > 0) {
    console.log('⚠️  WARNINGS:');
    warnings.forEach(violation => {
      console.log(`  ${violation.file}:${violation.line}:${violation.column}`);
      console.log(`    ${violation.violation}`);
      console.log(`    💡 ${violation.suggestion}\n`);
    });
  }

  console.log('📖 Design System Reference:');
  console.log('  • Colors: text-ink, text-muted, text-accent, bg-accent-soft, bg-accent');
  console.log('  • Borders: border-accent, border-accent/10');
  console.log('  • Focus: focus:ring-accent, focus:outline-none');
  console.log('  • See src/app/styles/tokens.css for full token list');

  if (errors.length > 0) {
    console.log(`\n❌ ${errors.length} errors must be fixed before commit`);
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log(`\n⚠️  ${warnings.length} warnings should be addressed`);
  }
}

async function main() {
  try {
    const violations = await scanCodebase();
    printReport(violations);
  } catch (error) {
    console.error('Error scanning codebase:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { scanCodebase, printReport, Violation };
