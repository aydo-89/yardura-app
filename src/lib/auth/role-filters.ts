import { Prisma, UserRole } from "@prisma/client";

type RoleFilterOptions = {
  includeProfileFallback?: boolean;
};

export function buildUserRoleFilter(
  roles: UserRole[],
  options: RoleFilterOptions = {},
): Prisma.UserWhereInput {
  const fallback: Prisma.UserWhereInput[] = [
    { role: { in: roles } },
  ];

  if (options.includeProfileFallback) {
    fallback.push({ scooperProfile: { isNot: null } });
  }

  return {
    OR: [
      { roles: { hasSome: roles } },
      {
        roles: { equals: [] },
        OR: fallback,
      },
    ],
  };
}
