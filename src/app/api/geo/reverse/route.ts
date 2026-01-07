import { NextRequest, NextResponse } from "next/server";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/reverse";
const DEFAULT_USER_AGENT =
  "Yardura Reverse Geocoder/1.0 (support@yardura.com)";

const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ||
  (process.env.NOMINATIM_EMAIL
    ? `Yardura (${process.env.NOMINATIM_EMAIL})`
    : DEFAULT_USER_AGENT);

const streetFields = [
  "road",
  "residential",
  "pedestrian",
  "path",
  "cycleway",
  "footway",
  "highway",
  "street",
  "street_name",
];

const STREET_HINT_REGEX = /\b(ave|avenue|st|street|rd|road|dr|drive|ln|lane|ct|court|blvd|boulevard|pl|place|way|pkwy|parkway|trail|trl|loop|cir|circle|terrace|ter|hwy|highway|pike|pass|row|walk|alley|pkwy|driveway)\b/i;

const buildAddressPayload = (data: any) => {
  const address = data?.address ?? {};

  const houseNumber = address.house_number || address.houseNumber || null;
  const road =
    address.road ||
    address.residential ||
    address.pedestrian ||
    address.path ||
    address.cycleway ||
    address.footway ||
    address.highway ||
    null;

  const line1 = [houseNumber, road].filter(Boolean).join(" ").trim();

  const disallowed = new Set(
    [address.neighbourhood, address.suburb, address.city, address.county]
      .filter((value) => typeof value === "string")
      .map((value) => value.trim().toLowerCase()),
  );

  const rawStreetCandidates = streetFields
    .map((field) => address[field])
    .filter((value): value is string => Boolean(value && typeof value === "string"))
    .map((value) => value.trim())
    .filter(Boolean);

  const uniqueCandidates = Array.from(new Set(rawStreetCandidates));

  const filteredCandidates = uniqueCandidates.filter((candidate) => {
    const lower = candidate.toLowerCase();
    if (disallowed.has(lower)) return false;
    if (STREET_HINT_REGEX.test(candidate)) return true;
    return candidate.includes(" ");
  });

  const streetCandidates = filteredCandidates.length
    ? filteredCandidates
    : uniqueCandidates.filter((candidate) => !disallowed.has(candidate.toLowerCase()));

  const city =
    address.city ||
    address.town ||
    address.village ||
    address.hamlet ||
    address.suburb ||
    null;

  const state = address.state_code || address.state || null;
  const county = address.county || null;
  const postalCode =
    address.postalcode || address.postcode || address.postalCode || null;

  return {
    line1: line1 || null,
    city,
    state,
    stateCode: address.state_code || null,
    county,
    postalCode,
    streetCandidates,
  };
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const latParam = searchParams.get("lat");
    const lngParam = searchParams.get("lng");

    const latitude = latParam ? Number.parseFloat(latParam) : NaN;
    const longitude = lngParam ? Number.parseFloat(lngParam) : NaN;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json(
        { ok: false, error: "Latitude and longitude are required" },
        { status: 400 },
      );
    }

    const reverseUrl = `${NOMINATIM_BASE}?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1`;

    const response = await fetch(reverseUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Reverse geocoding failed with status ${response.status}`,
        },
        { status: response.status },
      );
    }

    const json = await response.json();
    const address = buildAddressPayload(json);

    return NextResponse.json({
      ok: true,
      data: {
        address,
      },
    });
  } catch (error) {
    console.error("Reverse geocoding error", error);
    return NextResponse.json(
      { ok: false, error: "Reverse geocoding request failed" },
      { status: 500 },
    );
  }
}
