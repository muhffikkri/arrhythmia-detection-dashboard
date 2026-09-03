import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ECGCanvas } from "../presentation/components/canvas/ECGCanvas";
import { renderFrameFromRaw, FILTERS_ALL_OFF } from "../core/algorithms/ecgFrameProcessor";

const emptyPaths = { I: [], II: [], III: [], aVR: [], aVL: [], aVF: [], V1: [] };

describe("ECGCanvas unit", () => {
  it("merender path EKG pada SVG", () => {
    const { paths, rPeaks } = renderFrameFromRaw(
      {
        ch1: [0, 1, 0],
        ch2: [0, 1.2, 0],
        ch3: [0, 0.5, 0],
      },
      FILTERS_ALL_OFF,
    );

    render(<ECGCanvas paths={paths} rPeaks={rPeaks} paperSpeed={25} scale={1} />);
    const svg = document.querySelector('[data-testid="ecg-svg"]');
    expect(svg).toBeTruthy();
    const leadI = document.querySelector('[data-testid="ecg-path-I"]');
    expect(leadI?.getAttribute("d")).toContain("M");
    expect(document.getElementById("ecg-scroll-container")).toBeInTheDocument();
  });

  it("menyesuaikan lebar kertas dengan paper speed", () => {
    const { rerender } = render(<ECGCanvas paths={emptyPaths} rPeaks={[]} paperSpeed={25} />);
    expect(document.querySelector('[data-testid="ecg-svg"]')?.getAttribute("width")).toBe("2000");

    rerender(<ECGCanvas paths={emptyPaths} rPeaks={[]} paperSpeed={50} />);
    expect(document.querySelector('[data-testid="ecg-svg"]')?.getAttribute("width")).toBe("2000");
    expect(document.querySelector('[data-testid="ecg-path-I"]')?.parentElement?.getAttribute("transform")).toContain("scale(0.25, 1)");

    rerender(<ECGCanvas paths={emptyPaths} rPeaks={[]} paperSpeed={12.5} />);
    expect(document.querySelector('[data-testid="ecg-svg"]')?.getAttribute("width")).toBe("8000");
    expect(document.querySelector('[data-testid="ecg-path-I"]')?.parentElement?.getAttribute("transform")).toContain("scale(4, 1)");
  });

  it("menerapkan gain melalui scale/zoom", () => {
    render(<ECGCanvas paths={emptyPaths} rPeaks={[]} scale={2} />);
    const zoomed = document.querySelector("#ecg-scroll-container > div") as HTMLElement;
    expect(zoomed.style.zoom).toBe("2");
  });
});
