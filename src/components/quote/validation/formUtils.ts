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
  firstInvalidKey?: string,
): void {
  if (!firstInvalidKey) return;

  const fieldRef = fieldRefs[firstInvalidKey];

  const focusElement = (element: HTMLElement) => {
    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });

    if (typeof element.focus === "function") {
      const hadTabIndex = element.hasAttribute("tabindex");
      if (!hadTabIndex) {
        element.setAttribute("tabindex", "-1");
      }
      element.focus({ preventScroll: true });
      if (!hadTabIndex) {
        element.addEventListener(
          "blur",
          () => element.removeAttribute("tabindex"),
          { once: true },
        );
      }
    }
  };

  if (fieldRef?.current) {
    focusElement(fieldRef.current);
    if (
      fieldRef.current.tagName === "INPUT" ||
      fieldRef.current.tagName === "TEXTAREA"
    ) {
      (fieldRef.current as HTMLInputElement).select();
    }
    return;
  }

  const datasetTarget = document.querySelector<HTMLElement>(
    `[data-quote-field="${firstInvalidKey}"]`,
  );
  if (datasetTarget) {
    focusElement(datasetTarget);
    return;
  }

  const errorMessageTarget = document.querySelector<HTMLElement>(
    `[data-error-for="${firstInvalidKey}"]`,
  );
  if (errorMessageTarget) {
    focusElement(errorMessageTarget);
  }
}

/**
 * Announce validation errors to screen readers
 */
export function announceValidationErrors(
  liveRegionRef: React.RefObject<HTMLDivElement>,
  message: string,
): void {
  if (!liveRegionRef.current) return;

  liveRegionRef.current.textContent = message;

  // Clear the message after a delay to allow re-announcement
  setTimeout(() => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = "";
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

















