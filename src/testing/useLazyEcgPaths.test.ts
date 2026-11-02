import { describe, it, expect } from "vitest";
import { useLazyEcgPaths } from "../application/hooks/useLazyEcgPaths";
import { renderHook } from "@testing-library/react";

describe("useLazyEcgPaths custom hook", () => {
  const mockSamples = Array.from({ length: 2500 }, (_, i) => Math.sin(i * 0.1));
  const mockCh2 = Array.from({ length: 2500 }, (_, i) => Math.cos(i * 0.1));
  const mockCh3 = Array.from({ length: 2500 }, () => 0);

  it("should return empty paths when samples are empty", () => {
    const { result } = renderHook(() => useLazyEcgPaths([], [], []));
    expect(result.current.I).toEqual([]);
    expect(result.current.II).toEqual([]);
  });

  it("should start each signal at origin without embedded calibration pulse", () => {
    const { result } = renderHook(() => useLazyEcgPaths(mockSamples, mockCh2, mockCh3, 10, 25));

    expect(result.current.I).toHaveLength(mockSamples.length);
    expect(result.current.II).toHaveLength(mockSamples.length);
    expect(result.current.III).toHaveLength(mockSamples.length);
    expect(result.current.aVR).toHaveLength(mockSamples.length);
    expect(result.current.aVL).toHaveLength(mockSamples.length);
    expect(result.current.aVF).toHaveLength(mockSamples.length);
    expect(result.current.V1).toHaveLength(mockSamples.length);
    expect(result.current.I[0]).toMatch(/^0,/);
  });

  it("should use paper speed for signal coordinate spacing", () => {
    const { result } = renderHook(() => useLazyEcgPaths(mockSamples, mockCh2, mockCh3, 10, 50));

    expect(result.current.I.at(-1)).toMatch(/^1999\.2,/);
  });
});
