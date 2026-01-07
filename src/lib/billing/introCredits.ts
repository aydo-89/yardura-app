export interface IntroCredit {
  amountCents: number;
  reason:
    | "initial-clean-full"
    | "initial-clean-half"
    | "follow-up-visits"
    | "custom";
  visits?: number;
  label: string;
}

export interface IntroCreditPlan {
  credits: IntroCredit[];
  totalCreditCents: number;
  descriptions: string[];
}

export interface IntroCreditSummary {
  summary: string | null;
  details: string[];
}

export function computeIntroCredits(options: {
  normalizedFrequency: string;
  initialCleanCents: number;
  perVisitCents: number;
}): IntroCreditPlan {
  const freq = options.normalizedFrequency.toLowerCase();
  const initialCleanCents = Math.max(0, Math.round(options.initialCleanCents || 0));
  const perVisitCents = Math.max(0, Math.round(options.perVisitCents || 0));

  const credits: IntroCredit[] = [];

  const pushCredit = (credit: IntroCredit) => {
    if (!Number.isFinite(credit.amountCents) || credit.amountCents <= 0) return;
    credits.push({ ...credit, amountCents: Math.round(credit.amountCents) });
  };

  if (freq === "monthly") {
    pushCredit({
      reason: "initial-clean-half",
      amountCents: Math.round(initialCleanCents / 2),
      label: "50% off initial clean",
    });
  } else {
    if (freq === "twice-weekly") {
      pushCredit({
        reason: "initial-clean-full",
        amountCents: initialCleanCents,
        label: "Initial clean covered",
      });
      pushCredit({
        reason: "follow-up-visits",
        amountCents: perVisitCents,
        visits: 1,
        label: "First follow-up visit covered",
      });
    } else if (freq === "daily") {
      pushCredit({
        reason: "initial-clean-full",
        amountCents: initialCleanCents,
        label: "Initial clean covered",
      });
      pushCredit({
        reason: "follow-up-visits",
        amountCents: perVisitCents * 4,
        visits: 4,
        label: "First week coverage (4 weekday visits)",
      });
    } else if (
      freq === "weekly" ||
      freq === "biweekly" ||
      freq === "bi-weekly" ||
      freq === "every-other-week"
    ) {
      pushCredit({
        reason: "initial-clean-full",
        amountCents: initialCleanCents,
        label: "Initial clean covered",
      });
    }
  }

  const totalCreditCents = credits.reduce((sum, credit) => sum + credit.amountCents, 0);
  const descriptions = credits.map(
    (credit) => `${credit.label} – $${(credit.amountCents / 100).toFixed(2)}`,
  );

  return {
    credits,
    totalCreditCents,
    descriptions,
  };
}

function detailForCredit(credit: IntroCredit): string {
  if (credit.reason === "initial-clean-full") {
    return "Initial clean is on us.";
  }

  if (credit.reason === "initial-clean-half") {
    return "Half off your initial clean applies automatically.";
  }

  if (credit.reason === "follow-up-visits") {
    const visits = credit.visits ?? 0;
    const label = credit.label.toLowerCase();

    if (visits > 1 || label.includes("week")) {
      if (label.includes("weekday")) {
        return "Your first week of weekday visits is covered.";
      }
      if (visits > 1) {
        return `We cover your first ${visits} visits after kickoff.`;
      }
      return "We cover your first week of visits after kickoff.";
    }

    return "Your first follow-up visit is covered.";
  }

  return `${credit.label} credit applies automatically.`;
}

export function summarizeIntroCredits(plan: IntroCreditPlan): IntroCreditSummary {
  if (!plan.credits.length) {
    return { summary: null, details: [] };
  }

  const details = Array.from(new Set(plan.credits.map(detailForCredit)));

  const hasInitialFull = plan.credits.some((credit) => credit.reason === "initial-clean-full");
  const hasInitialHalf = plan.credits.some((credit) => credit.reason === "initial-clean-half");
  const followUpCredit = plan.credits.find((credit) => credit.reason === "follow-up-visits");

  let summary: string | null = null;

  if (hasInitialFull && followUpCredit) {
    const visits = followUpCredit.visits ?? 0;
    const label = followUpCredit.label.toLowerCase();

    if (visits > 1 || label.includes("week")) {
      if (label.includes("weekday")) {
        summary = "Initial clean plus your first week of weekday visits are covered.";
      } else if (visits > 1) {
        summary = `Initial clean plus your first ${visits} visits are covered.`;
      } else {
        summary = "Initial clean plus your first week of visits are covered.";
      }
    } else {
      summary = "Initial clean and your first follow-up visit are covered.";
    }
  } else if (hasInitialFull) {
    summary = "Initial clean is on us.";
  } else if (hasInitialHalf) {
    summary = "Half off your initial clean applies automatically.";
  } else if (plan.credits.length) {
    summary = `${plan.credits[0].label} credit applies automatically.`;
  }

  return {
    summary,
    details,
  };
}
