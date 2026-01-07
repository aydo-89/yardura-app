import { ServiceTileStatus } from "@prisma/client";
import { getTileRepository } from "@/lib/tiles/repository";

export const CITY_TILE_MAP: Record<string, string[]> = {
  minneapolis: [
    "minneapolis-central",
    "minneapolis-south",
    "minneapolis-lakes-southwest",
    "minneapolis-north",
  ],
  bloomington: ["bloomington-east", "bloomington-west"],
  "brooklyn park": ["brooklyn-park-south", "brooklyn-park-north"],
  "maple grove": ["maple-grove-arbor", "maple-grove-northwest"],
  edina: ["edina-north", "edina-south"],
  richfield: ["richfield-core"],
  "eden prairie": ["eden-prairie-north", "eden-prairie-south"],
  plymouth: ["plymouth-east", "plymouth-west"],
  minnetonka: ["minnetonka-east", "minnetonka-west"],
  "brooklyn center": ["brooklyn-center-core"],
  champlin: ["champlin-mississippi"],
  crystal: ["crystal-central"],
  hopkins: ["hopkins-downtown"],
  "st. louis park": ["st-louis-park-core"],
  "st louis park": ["st-louis-park-core"],
  "st. anthony": ["st-anthony-northeast"],
  "st anthony": ["st-anthony-northeast"],
  mound: ["mound-westonka"],
  wayzata: ["wayzata-downtown"],
  orono: ["orono-northshore"],
  shorewood: ["shorewood-south"],
  "tonka bay": ["tonka-bay-marina"],
  excelsior: ["excelsior-downtown"],
  deephaven: ["deephaven-lakeside"],
  greenfield: ["greenfield-rural"],
  corcoran: ["corcoran-pioneer"],
  medina: ["medina-hamel"],
  rogers: ["rogers-gateway"],
  hanover: ["hanover-southfork"],
  dayton: ["dayton-river"],
  loretto: ["loretto-hamlet"],
  "maple plain": ["maple-plain-trail"],
  independence: ["independence-pioneer"],
  minnetrista: ["minnetrista-northshore"],
  woodland: ["woodland-peninsula"],
};

async function findTileBySlug(orgId: string, slug: string) {
  const repository = getTileRepository();
  const tile = await repository.getTileBySlug(orgId, slug, { metricsLimit: 1 });
  if (!tile) return null;
  return { id: tile.tile.id, slug: tile.tile.slug };
}

async function findFallbackTile(orgId: string) {
  const repository = getTileRepository();
  const tiles = await repository.listTiles(orgId, { metricsLimit: 1 });
  const live = tiles.find((entry) => entry.tile.status === ServiceTileStatus.LIVE);
  const target = live ?? tiles[0] ?? null;
  return target ? { id: target.tile.id, slug: target.tile.slug } : null;
}

export async function resolveTileByZipCode(
  orgId: string,
  zipCode?: string | null,
): Promise<{ id: string; slug: string; status: ServiceTileStatus } | null> {
  if (!zipCode?.trim()) {
    return null;
  }

  const repository = getTileRepository();
  try {
    const tileForZip = await repository.findTileByZip(orgId, zipCode.trim(), {
      metricsLimit: 1,
    });
    if (tileForZip) {
      return {
        id: tileForZip.tile.id,
        slug: tileForZip.tile.slug,
        status: tileForZip.tile.status,
      };
    }
  } catch (error) {
    console.warn("Failed to resolve tile by ZIP code", { orgId, zipCode, error });
  }

  return null;
}

export async function resolveTileSlugForCity(
  orgId: string,
  city?: string | null,
): Promise<{ id: string; slug: string } | null> {
  const normalizedCity = city?.trim().toLowerCase() ?? "";
  const prioritySlugs = CITY_TILE_MAP[normalizedCity] ?? [];

  for (const slug of prioritySlugs) {
    const tile = await findTileBySlug(orgId, slug);
    if (tile) return tile;
  }

  return findFallbackTile(orgId);
}
