import { calculateFrameHeartRate } from "../core/algorithms/ecgFrameProcessor";
import type { FrameRawSamples, StreamFilterConfig } from "../core/algorithms/ecgFrameProcessor";

type BpmRequest = {
  id: number;
  raw: FrameRawSamples;
  config: StreamFilterConfig;
};

self.onmessage = (event: MessageEvent<BpmRequest>) => {
  const { id, raw, config } = event.data;
  const result = calculateFrameHeartRate(raw, config);
  self.postMessage({ id, ...result });
};
