import { prisma } from "@/lib/prisma";
import {
  BackgroundCheckStatus,
  CertificationStatus,
  CertificationType,
  ScooperStatus,
} from "@prisma/client";

import type { ScooperComplianceSummary } from "./types";

const ECO_CERTIFICATIONS: CertificationType[] = [
  CertificationType.ECO_DIVERT_100,
];

function collectComplianceIssues(
  profileStatus: ScooperStatus,
  backgroundCheckStatus: BackgroundCheckStatus,
  vehicleVerified: boolean,
  insuranceOnFile: boolean,
  activeCertifications: CertificationType[],
) {
  const issues: string[] = [];

  if (profileStatus !== ScooperStatus.CERTIFIED) {
    issues.push("Scooper is not fully certified");
  }

  if (backgroundCheckStatus !== BackgroundCheckStatus.PASSED) {
    issues.push("Background check incomplete");
  }

  if (!vehicleVerified) {
    issues.push("Vehicle verification missing");
  }

  if (!insuranceOnFile) {
    issues.push("Insurance proof not uploaded");
  }

  if (!activeCertifications.includes(CertificationType.BIN_DROP)) {
    issues.push("Bin-drop certification missing");
  }

  return issues;
}

export async function getScooperComplianceSummary(
  userId: string,
): Promise<ScooperComplianceSummary | null> {
  const profile = await prisma.scooperProfile.findUnique({
    where: { userId },
    include: {
      certifications: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!profile) return null;

  const insuranceOnFile = Boolean(profile.insuranceProofUrl);
  const activeCertifications = profile.certifications
    .filter((cert) => cert.status === CertificationStatus.ACTIVE)
    .map((cert) => cert.type);

  const inactiveCertifications = profile.certifications
    .filter((cert) => cert.status !== CertificationStatus.ACTIVE)
    .map((cert) => ({
      type: cert.type,
      status: cert.status,
      expiresAt: cert.expiresAt,
    }));

  const complianceIssues = collectComplianceIssues(
    profile.status,
    profile.backgroundCheckStatus,
    profile.vehicleVerified,
    insuranceOnFile,
    activeCertifications,
  );

  const canClaimHaulAway = activeCertifications.includes(
    CertificationType.HAUL_AWAY,
  );
  const canClaimEcoDiversion = ECO_CERTIFICATIONS.some((cert) =>
    activeCertifications.includes(cert),
  );

  return {
    profileStatus: profile.status,
    backgroundCheckStatus: profile.backgroundCheckStatus,
    vehicleVerified: profile.vehicleVerified,
    insuranceOnFile,
    activeCertifications,
    inactiveCertifications,
    canClaimHaulAway,
    canClaimEcoDiversion,
    complianceIssues,
  };
}

export function scooperMeetsCertificationRequirements(
  summary: ScooperComplianceSummary,
  required: CertificationType[] = [],
) {
  if (!required.length) return true;
  const { activeCertifications } = summary;
  return required.every((cert) => activeCertifications.includes(cert));
}
