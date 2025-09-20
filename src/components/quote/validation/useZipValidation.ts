import { useState, useMemo, useCallback } from "react";
import { track } from "@/lib/analytics";

export type ZipValidationStatus = "idle" | "validating" | "valid" | "invalid";

interface ZipValidationResult {
  status: ZipValidationStatus;
  validate: (zip: string) => Promise<boolean>;
  reset: () => void;
}

// Debounce utility
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return new Promise((resolve) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => resolve(func(...args)), wait);
    });
  };
}

export function useZipValidation(): ZipValidationResult {
  const [status, setStatus] = useState<ZipValidationStatus>("idle");

  const validateZip = useCallback(async (zip: string): Promise<boolean> => {
    if (!zip || zip.length !== 5 || !/^\d{5}$/.test(zip)) {
      return false;
    }

    try {
      // Call existing ZIP validation API
      const response = await fetch("/api/zip-eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zip }),
      });

      const result = await response.json();
      const isValid = result.eligible === true;

      track("zip_validated", { zip, result: isValid ? "ok" : "fail" });

      return isValid;
    } catch (error) {
      console.error("ZIP validation error:", error);
      track("zip_validated", { zip, result: "fail" });
      return false;
    }
  }, []);

  const debouncedValidate = useMemo(
    () => debounce(validateZip, 400),
    [validateZip],
  );

  const validate = useCallback(
    async (zip: string): Promise<boolean> => {
      setStatus("validating");

      try {
        const isValid = await debouncedValidate(zip);
        setStatus(isValid ? "valid" : "invalid");
        return isValid;
      } catch (error) {
        setStatus("invalid");
        return false;
      }
    },
    [debouncedValidate],
  );

  const reset = useCallback(() => {
    setStatus("idle");
  }, []);

  return { status, validate, reset };
}
