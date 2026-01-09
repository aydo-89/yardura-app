export type AddressParts = {
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

const STATE_ZIP_REGEX = /\b([A-Za-z]{2})\b\s*(\d{5}(?:-\d{4})?)?$/;

export function normalizeAddressParts(input: AddressParts): AddressParts {
  const addressLine1 = input.addressLine1?.trim() || null;
  const city = input.city?.trim() || null;
  const state = input.state?.trim() || null;
  const zip = input.zip?.trim() || null;

  if (!addressLine1) {
    return { addressLine1, city, state, zip };
  }

  const parts = addressLine1.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) {
    return { addressLine1, city, state, zip };
  }

  const last = parts[parts.length - 1];
  const match = last.match(STATE_ZIP_REGEX);
  if (!match) {
    return { addressLine1, city, state, zip };
  }

  let nextCity = city;
  if (!nextCity) {
    if (parts.length >= 3) {
      nextCity = parts[1];
    } else {
      const cityCandidate = last.replace(match[0], '').replace(/,+$/, '').trim();
      if (cityCandidate) {
        nextCity = cityCandidate;
      }
    }
  }

  const nextState = state ?? (match[1] ? match[1].toUpperCase() : null);
  const nextZip = zip ?? (match[2] ?? null);

  return {
    addressLine1: parts[0] ?? addressLine1,
    city: nextCity,
    state: nextState,
    zip: nextZip,
  };
}
