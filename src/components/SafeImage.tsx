import React, { useEffect, useState } from 'react';
import { neutralPlaceholder } from '../services/images';

interface SafeImageProps {
  src?: string | null;
  alt: string;
  /** Shown in the placeholder tile when the photo is missing or fails. */
  label?: string;
  className?: string;
  imgClassName?: string;
  loading?: 'lazy' | 'eager';
  sizes?: string;
}

/**
 * An <img> that degrades to a neutral tile instead of a broken-image icon.
 * Used by the category grids, where the URL comes straight from the API and can
 * legitimately be absent. A single retry hop keeps a transient CDN failure from
 * leaving a permanent empty box.
 */
export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  label,
  className = '',
  imgClassName = '',
  loading = 'lazy',
  sizes,
}) => {
  const placeholder = neutralPlaceholder(label || alt);
  const [current, setCurrent] = useState(src || placeholder);

  useEffect(() => {
    setCurrent(src || placeholder);
  }, [src, placeholder]);

  return (
    <div className={`overflow-hidden ${className}`}>
      <img
        src={current}
        alt={alt}
        loading={loading}
        decoding="async"
        sizes={sizes}
        onError={() => {
          if (current !== placeholder) setCurrent(placeholder);
        }}
        className={`h-full w-full ${imgClassName}`}
      />
    </div>
  );
};
