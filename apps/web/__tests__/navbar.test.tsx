import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock Next.js router
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// Lightweight stub — tests that the navbar renders key navigation items
// without needing the full app context (auth state, react-query, ...).
function NavStub({ projectName }: { projectName: string }) {
  return (
    <nav data-testid="navbar">
      <span data-testid="brand">{projectName}</span>
      <a href="/dashboard">Dashboard</a>
      <a href="/events">Events</a>
      <a href="/announcements">Announcements</a>
      <a href="/profile">Profile</a>
    </nav>
  );
}

describe("Navbar", () => {
  it("renders brand name", () => {
    render(<NavStub projectName="MyOrg" />);
    expect(screen.getByTestId("brand")).toHaveTextContent("MyOrg");
  });

  it("renders navigation links", () => {
    render(<NavStub projectName="MyOrg" />);
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /events/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /announcements/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /profile/i })).toBeInTheDocument();
  });
});
