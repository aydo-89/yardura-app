"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { quoteInputClass } from "@/components/quote/quoteStyles";
// Read public env directly so Next inlines it for the client bundle
const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// Declare global window interface for Google Maps

type AddressAutocompleteProps = {
  value: string;
  onSelect: (data: {
    formattedAddress: string;
    city?: string;
    state?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
  }) => void;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export default function AddressAutocomplete({
  value,
  onSelect,
  onChange,
  placeholder,
  className,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<any>(null);
  const attachedInputRef = useRef<HTMLInputElement | null>(null);
  const placeListenerRef = useRef<any>(null);
  const waitTimeoutRef = useRef<number | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Twin Cities bounds
  const bounds: any = {
    south: 44.73,
    west: -93.515,
    north: 45.12,
    east: -92.73,
  };
  const tryInit = useCallback(() => {
    const inputEl = inputRef.current;

    if (!inputEl) {
      console.log("AddressAutocomplete: Input ref not available");
      return;
    }

    const googleMaps = window.google?.maps?.places;
    if (!googleMaps) {
      console.log(
        "AddressAutocomplete: Google Maps Places not ready when tryInit ran",
      );
      return;
    }

    const needsNewInstance =
      !autocompleteRef.current || attachedInputRef.current !== inputEl;

    if (!needsNewInstance) {
      console.log(
        "AddressAutocomplete: Autocomplete already bound to input element",
      );
      return;
    }

    if (placeListenerRef.current?.remove) {
      placeListenerRef.current.remove();
      placeListenerRef.current = null;
    }

    try {
      autocompleteRef.current = new window.google!.maps!.places!.Autocomplete(
        inputEl,
        {
          types: ["address"],
          componentRestrictions: { country: "us" },
        },
      );

      attachedInputRef.current = inputEl;

      console.log(
        "AddressAutocomplete: Autocomplete instance created:",
        autocompleteRef.current,
      );

      placeListenerRef.current = autocompleteRef.current.addListener(
        "place_changed",
        () => {
          console.log("AddressAutocomplete: Place changed event fired");
          try {
            const place = autocompleteRef.current!.getPlace();
            console.log("AddressAutocomplete: Place data:", place);

            if (!place || !place.formatted_address) {
              console.log(
                "AddressAutocomplete: No place or formatted address found",
              );
              return;
            }

            const components: Record<string, string> = {};
            (place.address_components || []).forEach((c: any) => {
              for (const t of c.types) components[t] = c.long_name;
            });

            console.log(
              "AddressAutocomplete: Extracted components:",
              components,
            );
            console.log(
              "AddressAutocomplete: Place selected:",
              place.formatted_address,
            );
            onSelect({
              formattedAddress: place.formatted_address,
              city:
                components["locality"] ||
                components["sublocality"] ||
                components["postal_town"],
              state: components["administrative_area_level_1"],
              postalCode: components["postal_code"],
              latitude: place.geometry?.location?.lat?.(),
              longitude: place.geometry?.location?.lng?.(),
            });
          } catch (error) {
            console.error(
              "AddressAutocomplete: Error in place_changed handler:",
              error,
            );
          }
        },
      );

      console.log(
        "AddressAutocomplete: Autocomplete initialized successfully",
      );
    } catch (error) {
      console.error(
        "AddressAutocomplete: Error creating autocomplete:",
        error,
      );
      setLoadError(
        "We couldn’t start Google address suggestions. Please enter your address manually.",
      );
    }
  }, [onSelect]);

  const ensureAutocomplete = useCallback(() => {
    if (typeof window === "undefined") {
      return false;
    }

    if (!window.google?.maps?.places) {
      return false;
    }

    setLoadError(null);
    tryInit();
    return Boolean(autocompleteRef.current);
  }, [tryInit]);

  useEffect(() => {
    if (!GOOGLE_KEY) {
      return;
    }

    if (ensureAutocomplete()) {
      return;
    }

    let attempts = 0;
    let cancelled = false;

    const pollGoogleReady = () => {
      if (cancelled) {
        return;
      }

      attempts += 1;
      console.log(
        `AddressAutocomplete: Attempt ${attempts} - Checking Google Maps availability:`,
        {
          google: !!window.google,
          maps: !!window.google?.maps,
          places: !!window.google?.maps?.places,
        },
      );

      if (ensureAutocomplete()) {
        console.log("AddressAutocomplete: Google Maps is ready!");
        return;
      }

      if (attempts >= 150) {
        console.error(
          "AddressAutocomplete: Google Maps failed to load after maximum attempts",
        );
        setLoadError(
          "We’re having trouble loading Google address suggestions. You can keep typing your full address manually.",
        );
        return;
      }

      waitTimeoutRef.current = window.setTimeout(pollGoogleReady, 100);
    };

    pollGoogleReady();

    return () => {
      cancelled = true;
      if (waitTimeoutRef.current) {
        window.clearTimeout(waitTimeoutRef.current);
        waitTimeoutRef.current = null;
      }
    };
  }, [ensureAutocomplete]);

  useEffect(() => {
    if (!scriptLoaded) {
      return;
    }

    console.log(
      "AddressAutocomplete: Script loaded, ensuring Google Maps availability...",
    );
    ensureAutocomplete();
  }, [scriptLoaded, ensureAutocomplete]);

  useEffect(() => {
    console.log(
      "AddressAutocomplete: Component mounted, API key:",
      !!GOOGLE_KEY,
    );

    return () => {
      if (placeListenerRef.current?.remove) {
        placeListenerRef.current.remove();
        placeListenerRef.current = null;
      }

      autocompleteRef.current = null;
      attachedInputRef.current = null;

      if (waitTimeoutRef.current) {
        window.clearTimeout(waitTimeoutRef.current);
        waitTimeoutRef.current = null;
      }
    };
  }, []);

  return (
    <>
      {GOOGLE_KEY && (
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${GOOGLE_KEY}&libraries=places&v=weekly&loading=async`}
          strategy="afterInteractive"
          onLoad={() => {
            console.log(
              "AddressAutocomplete: Google Maps script loaded successfully",
            );
            console.log(
              "AddressAutocomplete: Google Maps object:",
              window.google,
            );
            setScriptLoaded(true);
            setLoadError(null);
            ensureAutocomplete();
          }}
          onReady={() => {
            console.log(
              "AddressAutocomplete: Google Maps script ready (from cache)",
            );
            setScriptLoaded(true);
            setLoadError(null);
            ensureAutocomplete();
          }}
          onError={(e) => {
            console.error(
              "AddressAutocomplete: Failed to load Google Maps script:",
              e,
            );
            setLoadError(
              "Google address suggestions failed to load. Please enter your address manually.",
            );
          }}
        />
      )}

      {!GOOGLE_KEY && (
        <div
          style={{
            color: "red",
            padding: "10px",
            border: "1px solid red",
            margin: "10px 0",
          }}
        >
          Google Maps API key not configured. Please add
          NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file.
        </div>
      )}
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Start typing your address"}
        className={cn(
          "h-auto min-h-[3.25rem]",
          quoteInputClass,
          "mt-2 bg-white text-slate-900 placeholder:text-slate-400 dark:bg-slate-900/50 dark:text-white dark:placeholder:text-slate-400 border-slate-200 dark:border-white/15",
          className,
        )}
        onFocus={() => console.log("AddressAutocomplete: Input focused")}
        onInput={(e) => {
          const target = e.target as HTMLInputElement;
          console.log("AddressAutocomplete: Input changed to:", target.value);
          onChange(target.value);
        }}
        onKeyDown={(e) =>
          console.log("AddressAutocomplete: Key pressed:", e.key)
        }
      />
      {loadError && (
        <p className="mt-2 text-sm text-red-600" data-error-for="address">
          {loadError}
        </p>
      )}

      {/* Debug info removed for production */}
    </>
  );
}
