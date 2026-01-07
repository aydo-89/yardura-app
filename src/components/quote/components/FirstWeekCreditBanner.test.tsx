import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { FirstWeekCreditBanner } from "./FirstWeekCreditBanner";

describe("FirstWeekCreditBanner", () => {
  it("renders with default props", () => {
    render(<FirstWeekCreditBanner amount="$204.30" />);

    expect(screen.getByText("First-week coverage")).toBeInTheDocument();
    expect(screen.getByText("FREE")).toBeInTheDocument();
    expect(screen.getByText("$204.30")).toBeInTheDocument();
    expect(screen.getByText(/Submit your quote now/i)).toBeInTheDocument();
  });

  it("supports hiding the amount", () => {
    render(
      <FirstWeekCreditBanner
        amount="$204.30"
        showAmount={false}
        descriptor="Per visit"
        subtext="Example"
      />,
    );

    expect(screen.queryByText("$204.30")).not.toBeInTheDocument();
    expect(screen.getByText("Per visit")).toBeInTheDocument();
    expect(screen.getByText("Example")).toBeInTheDocument();
  });

  it("applies dark tone classes", () => {
    const { container } = render(
      <FirstWeekCreditBanner
        amount="$204.30"
        tone="dark"
        variant="week"
        descriptor="Per visit"
        subtext="Example"
      />,
    );

    expect(container.firstChild).toHaveClass("bg-[#102f24]");
    const amountEl = screen.getByText("$204.30");
    expect(amountEl.parentElement).toHaveClass("text-emerald-200");
  });

  it("renders custom badge text", () => {
    render(
      <FirstWeekCreditBanner
        amount="$204.30"
        badgeText="LOCKED"
        descriptor="Per visit"
        subtext="Example"
      />,
    );

    expect(screen.getByText("LOCKED")).toBeInTheDocument();
  });
});
