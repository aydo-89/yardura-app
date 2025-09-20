"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { Input } from "@/components/ui/input";
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
};

export default function AddressAutocomplete({
  value,
  onSelect,
  onChange,
  placeholder,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<any>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Twin Cities bounds
  const bounds: any = {
    south: 44.73,
    west: -93.515,
    north: 45.12,
    east: -92.73,
  };

  const waitForGoogleMaps = (
    callback: () => void,
    maxAttempts: number = 50,
  ) => {
    let attempts = 0;

    const checkGoogleMaps = () => {
      attempts++;
      console.log(
        `AddressAutocomplete: Attempt ${attempts} - Checking Google Maps availability:`,
        {
          google: !!window.google,
          maps: !!window.google?.maps,
          places: !!window.google?.maps?.places,
        },
      );

      if (window.google && window.google.maps && window.google.maps.places) {
        console.log("AddressAutocomplete: Google Maps is ready!");
        callback();
      } else if (attempts < maxAttempts) {
        setTimeout(checkGoogleMaps, 100);
      } else {
        console.error(
          "AddressAutocomplete: Google Maps failed to load after maximum attempts",
        );
      }
    };

    checkGoogleMaps();
  };

  const tryInit = () => {
    if (!inputRef.current) {
      console.log("AddressAutocomplete: Input ref not available");
      return;
    }

    if (!autocompleteRef.current) {
      console.log("AddressAutocomplete: Creating autocomplete instance");
      try {
        autocompleteRef.current = new window.google!.maps!.places!.Autocomplete(
          inputRef.current!,
          {
            types: ["address"],
            componentRestrictions: { country: "us" },
          },
        );

        console.log(
          "AddressAutocomplete: Autocomplete instance created:",
          autocompleteRef.current,
        );

        autocompleteRef.current.addListener("place_changed", () => {
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
        });

        console.log(
          "AddressAutocomplete: Autocomplete initialized successfully",
        );
      } catch (error) {
        console.error(
          "AddressAutocomplete: Error creating autocomplete:",
          error,
        );
      }
    } else {
      console.log("AddressAutocomplete: Autocomplete already initialized");
    }
  };

  useEffect(() => {
    console.log("AddressAutocomplete: scriptLoaded changed to:", scriptLoaded);
    if (scriptLoaded) {
      console.log(
        "AddressAutocomplete: Script loaded, waiting for Google Maps API...",
      );
      waitForGoogleMaps(() => {
        console.log(
          "AddressAutocomplete: Google Maps is ready, initializing autocomplete...",
        );
        tryInit();
      });
    }
  }, [scriptLoaded]);

  useEffect(() => {
    console.log(
      "AddressAutocomplete: Component mounted, API key:",
      !!GOOGLE_KEY,
    );
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
          }}
          onError={(e) => {
            console.error(
              "AddressAutocomplete: Failed to load Google Maps script:",
              e,
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
        className="mt-2 bg-white border-2 border-gray-200 hover:border-accent/30 focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:outline-none"
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

      {/* Debug info removed for production */}
    </>
  );
}
