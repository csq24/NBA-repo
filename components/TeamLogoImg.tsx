"use client";

import { useState } from "react";

type TeamLogoImgProps = {
  src: string | null;
  alt: string;
  className?: string;
};

/** Plain `<img>` so unknown ESPN/CDN hosts never crash the page via `next/image`. */
export function TeamLogoImg({ src, alt, className }: TeamLogoImgProps) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className={`flex items-center justify-center text-xs text-zinc-500 ${className ?? ""}`}>—</span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
