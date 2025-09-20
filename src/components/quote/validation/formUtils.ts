/**
 * Form utilities for validation, focus management, and accessibility
 */

export interface FieldRef {
  current: HTMLElement | null;
}

/**
 * Scroll to and focus the first invalid field
 */
export function scrollToFirstError(
  fieldRefs: Record<string, FieldRef>,
  firstInvalidKey?: string
): void {
  if (!firstInvalidKey) return;

  const fieldRef = fieldRefs[firstInvalidKey];
  if (!fieldRef?.current) return;

  // Scroll into view
  fieldRef.current.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'nearest',
  });

  // Focus the field
  fieldRef.current.focus();

  // If it's an input, select all text for easy replacement
  if (fieldRef.current.tagName === 'INPUT' || fieldRef.current.tagName === 'TEXTAREA') {
    (fieldRef.current as HTMLInputElement).select();
  }
}

/**
 * Announce validation errors to screen readers
 */
export function announceValidationErrors(
  liveRegionRef: React.RefObject<HTMLDivElement>,
  message: string
): void {
  if (!liveRegionRef.current) return;

  liveRegionRef.current.textContent = message;

  // Clear the message after a delay to allow re-announcement
  setTimeout(() => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = '';
    }
  }, 1000);
}

/**
 * Generate a unique ID for form elements
 */
export function generateFieldId(fieldName: string, stepId: string): string {
  return `quote-${stepId}-${fieldName}`;
}

/**
 * Generate error ID for aria-describedby
 */
export function generateErrorId(fieldName: string, stepId: string): string {
  return `quote-${stepId}-${fieldName}-error`;
}


