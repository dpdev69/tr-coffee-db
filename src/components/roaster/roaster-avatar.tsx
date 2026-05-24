'use client';

import { useState } from 'react';

type RoasterAvatarProps = {
  name: string;
  logoUrl: string | null;
  size?: 'md' | 'lg';
};

const sizeClasses = {
  md: 'h-14 w-14 text-xl',
  lg: 'h-16 w-16 text-2xl',
};

export function RoasterAvatar({
  name,
  logoUrl,
  size = 'md',
}: RoasterAvatarProps) {
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const initial = name.trim().charAt(0).toLocaleUpperCase('tr-TR') || '?';
  const showLogo = logoUrl && failedLogoUrl !== logoUrl;

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#1f1d1b]/10 bg-white text-center font-bold text-[#1f1d1b] ${sizeClasses[size]}`}
      aria-hidden="true"
    >
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className="h-full w-full object-contain p-2"
          onError={() => setFailedLogoUrl(logoUrl)}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-[#ecff64]">
          {initial}
        </span>
      )}
    </div>
  );
}
