// ESLint plugin to enforce Yardura design system
// Prevents ad-hoc color classes and enforces design tokens

module.exports = {
  rules: {
    'no-adhoc-colors': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow ad-hoc color classes, enforce design tokens',
          category: 'Best Practices',
          recommended: true,
        },
        fixable: 'code',
        schema: [],
        messages: {
          noAdhocColor: 'Use design token classes instead of ad-hoc color "{{ color }}". Use {{ suggestion }} instead.',
          noArbitraryColor: 'Avoid arbitrary color values. Use design token classes.',
        },
      },
      create(context) {
        // Allowed color classes from design tokens
        const allowedColors = [
          // Text colors
          'text-ink', 'text-muted', 'text-accent', 'text-warning', 'text-red-600', 'text-green-600',

          // Background colors
          'bg-white', 'bg-accent', 'bg-accent-soft', 'bg-ink', 'bg-panel', 'bg-card',
          'bg-accent-soft/20', 'bg-accent-soft/30', 'bg-accent-soft/40', 'bg-accent/90',
          'bg-gradient-to-r', 'bg-gradient-to-br', 'bg-gradient-to-l', 'bg-gradient-to-t',

          // Border colors
          'border-accent', 'border-accent/10', 'border-black/5',

          // Hover states
          'hover:bg-accent-soft', 'hover:bg-accent', 'hover:bg-accent/90', 'hover:text-accent',

          // Focus states
          'focus:ring-accent', 'focus:ring-2', 'focus:outline-none',

          // Special cases
          'text-slate-500', 'text-blue-600', 'text-emerald-600', 'bg-blue-50', 'bg-green-50',
          'border-red-600', 'text-red-600', 'bg-red-50',
        ];

        // Forbidden patterns
        const forbiddenPatterns = [
          /^bg-\[(.*)\]$/, // Arbitrary background colors
          /^text-\[(.*)\]$/, // Arbitrary text colors
          /^border-\[(.*)\]$/, // Arbitrary border colors
          /^bg-(red|blue|green|yellow|purple|pink|indigo|gray|slate|zinc|neutral|stone|orange|amber|lime|emerald|teal|cyan|sky|violet|fuchsia|rose)-\d+$/, // Direct color scales
          /^text-(red|blue|green|yellow|purple|pink|indigo|gray|slate|zinc|neutral|stone|orange|amber|lime|emerald|teal|cyan|sky|violet|fuchsia|rose)-\d+$/,
          /^border-(red|blue|green|yellow|purple|pink|indigo|gray|slate|zinc|neutral|stone|orange|amber|lime|emerald|teal|cyan|sky|violet|fuchsia|rose)-\d+$/,
        ];

        return {
          JSXAttribute(node) {
            if (node.name.name === 'className' || node.name.name === 'class') {
              const value = node.value;

              if (value && value.type === 'Literal' && typeof value.value === 'string') {
                const classes = value.value.split(/\s+/);

                for (const className of classes) {
                  // Check against forbidden patterns
                  for (const pattern of forbiddenPatterns) {
                    if (pattern.test(className)) {
                      context.report({
                        node,
                        messageId: 'noArbitraryColor',
                        data: { color: className },
                        fix(fixer) {
                          // Suggest replacement based on color type
                          let suggestion = 'Use design token classes from tokens.css';
                          if (className.startsWith('bg-')) {
                            suggestion = 'bg-accent-soft or bg-accent';
                          } else if (className.startsWith('text-')) {
                            suggestion = 'text-ink, text-muted, or text-accent';
                          } else if (className.startsWith('border-')) {
                            suggestion = 'border-accent or border-accent/10';
                          }

                          // For now, just report - don't auto-fix complex cases
                          return null;
                        }
                      });
                      break;
                    }
                  }

                  // Check if class is allowed
                  if (!allowedColors.includes(className) && !className.startsWith('size-') &&
                      !className.startsWith('w-') && !className.startsWith('h-') &&
                      !className.startsWith('p-') && !className.startsWith('m-') &&
                      !className.startsWith('rounded-') && !className.startsWith('shadow-') &&
                      !className.startsWith('flex') && !className.startsWith('grid') &&
                      !className.startsWith('items-') && !className.startsWith('justify-') &&
                      !className.startsWith('gap-') && !className.startsWith('space-') &&
                      !className.includes('hover:') && !className.includes('focus:') &&
                      !className.includes('md:') && !className.includes('lg:') &&
                      !className.includes('xl:') && className !== 'sr-only' &&
                      className !== 'container' && !className.startsWith('max-w-') &&
                      !className.startsWith('min-w-') && !className.startsWith('font-') &&
                      !className.startsWith('text-') && !className.startsWith('leading-') &&
                      !className.startsWith('tracking-') && !className.startsWith('transition') &&
                      !className.startsWith('duration-') && !className.startsWith('ease-') &&
                      !className.startsWith('animate-') && !className.startsWith('delay-')) {

                    // Check for ad-hoc colors
                    if (className.includes('red-') || className.includes('blue-') ||
                        className.includes('green-') || className.includes('yellow-') ||
                        className.includes('purple-') || className.includes('pink-') ||
                        className.includes('indigo-') || className.includes('gray-') ||
                        className.includes('slate-') || className.includes('zinc-') ||
                        className.includes('neutral-') || className.includes('stone-') ||
                        className.includes('orange-') || className.includes('amber-') ||
                        className.includes('lime-') || className.includes('emerald-') ||
                        className.includes('teal-') || className.includes('cyan-') ||
                        className.includes('sky-') || className.includes('violet-') ||
                        className.includes('fuchsia-') || className.includes('rose-')) {

                      let suggestion = 'Use design token classes';
                      if (className.includes('red-')) suggestion = 'text-red-600 for errors';
                      else if (className.includes('blue-')) suggestion = 'text-blue-600 or bg-blue-50';
                      else if (className.includes('green-')) suggestion = 'text-green-600 or bg-green-50';
                      else if (className.includes('gray-') || className.includes('slate-') || className.includes('zinc-'))
                        suggestion = 'text-muted or text-ink';

                      context.report({
                        node,
                        messageId: 'noAdhocColor',
                        data: { color: className, suggestion },
                      });
                    }
                  }
                }
              }
            }
          },
        };
      },
    },
  },
};
