import React from 'react';

// ponytail: all devtools blocking removed for debugging (VPS "failed to fetch").
// Re-add on deploy if anti-tamper still needed — rewire SecurityContext + DevToolsBlocker.
export const DevToolsBlocker: React.FC = () => {
  return null;
};
