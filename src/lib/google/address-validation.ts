import { config } from "@/lib/env";

interface PostalAddressInput {
  address: string;
  city: string;
  state: string;
  zip: string;
  countryCode?: string;
}

export interface AddressValidationVerdict {
  addressComplete?: boolean;
  hasReplacedComponents?: boolean;
  hasUnconfirmedComponents?: boolean;
  hasInferredComponents?: boolean;
  hasUnverifiedComponents?: boolean;
  granularity?: string;
}

export interface AddressValidationSuggestion {
  name: string;
  componentType?: string;
  confirmationLevel?: string;
  replaced?: string;
  spellCorrected?: boolean;
}

export interface AddressValidationResult {
  formattedAddress?: string | null;
  postalAddress?: Record<string, unknown> | null;
  verdict: AddressValidationVerdict;
  location?: { lat: number; lng: number } | null;
  suggestions: AddressValidationSuggestion[];
  raw?: any;
}

const ADDRESS_VALIDATION_ENDPOINT = "https://addressvalidation.googleapis.com/v1:validateAddress";

function getServerKey(): string {
  const key = config.googleMapsServerApiKey ?? config.googleMapsApiKey;
  if (!key) {
    throw new Error("Google Maps server API key is not configured for Address Validation");
  }
  return key;
}

function mapSuggestions(components: any[] | undefined): AddressValidationSuggestion[] {
  if (!components?.length) {
    return [];
  }

  return components
    .filter((component) => component?.replaced || component?.spellCorrected)
    .map((component) => ({
      name: component?.componentName ?? component?.componentType ?? "component",
      componentType: component?.componentType,
      confirmationLevel: component?.confirmationLevel,
      replaced: component?.replaced ?? undefined,
      spellCorrected: Boolean(component?.spellCorrected),
    }));
}

export async function validateAddress(
  input: PostalAddressInput,
  options?: { enableUspsCass?: boolean; regionCode?: string },
): Promise<AddressValidationResult> {
  const apiKey = getServerKey();
  const regionCode = options?.regionCode ?? input.countryCode ?? "US";

  const requestBody = {
    address: {
      regionCode,
      postalCode: input.zip,
      administrativeArea: input.state,
      locality: input.city,
      addressLines: [input.address],
    },
    enableUspsCass: options?.enableUspsCass ?? true,
  };

  const response = await fetch(`${ADDRESS_VALIDATION_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorPayload = await response.text();
    throw new Error(`Address validation failed: ${response.status} ${errorPayload}`);
  }

  const payload = (await response.json()) as any;
  const result = payload?.result ?? {};
  const verdict: AddressValidationVerdict = result?.verdict ?? {};

  const location = result?.geocode?.location
    ? {
        lat: Number(result.geocode.location.latitude ?? 0),
        lng: Number(result.geocode.location.longitude ?? 0),
      }
    : null;

  return {
    formattedAddress: result?.address?.formattedAddress ?? null,
    postalAddress: result?.address?.postalAddress ?? null,
    verdict,
    location,
    suggestions: mapSuggestions(result?.address?.addressComponents),
    raw: result,
  };
}
