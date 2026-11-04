import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const motionConfig = vi.hoisted(() => vi.fn());

vi.mock("framer-motion", async (importOriginal) => {
  const original = await importOriginal<typeof import("framer-motion")>();
  return {
    ...original,
    MotionConfig: (props: { reducedMotion?: string; children: React.ReactNode }) => {
      motionConfig(props.reducedMotion);
      return <>{props.children}</>;
    },
  };
});

import { MotionProvider } from "@/components/MotionProvider";

describe("MotionProvider", () => {
  it("follows the device's reduced-motion setting for every framer-motion animation under it", () => {
    render(
      <MotionProvider>
        <p>こんにちは</p>
      </MotionProvider>,
    );
    expect(screen.getByText("こんにちは")).toBeInTheDocument();
    expect(motionConfig).toHaveBeenCalledWith("user");
  });

  it("wraps every page: the root layout puts the whole app inside it", () => {
    const layout = readFileSync("app/layout.tsx", "utf8");
    expect(layout).toMatch(/import \{ MotionProvider \} from "@\/components\/MotionProvider"/);
    expect(layout).toMatch(/<MotionProvider>\s*\{children\}\s*<\/MotionProvider>/);
  });
});
