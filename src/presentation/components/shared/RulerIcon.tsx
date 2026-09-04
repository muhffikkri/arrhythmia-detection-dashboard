import React from "react";

interface RulerIconProps {
  size?: number;
  className?: string;
}

export const RulerIcon: React.FC<RulerIconProps> = ({ size = 18, className = "" }) => (
  <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 17.5L17.5 4L20 6.5L6.5 20L4 17.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M7.2 14.3L9.1 16.2M9.9 11.6L11.8 13.5M12.6 8.9L14.5 10.8M15.3 6.2L17.2 8.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
