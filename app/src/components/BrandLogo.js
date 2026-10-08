import Image from "next/image";

const assets = {
  wordmark: {
    src: "/branding/jmr-wordmark.webp",
    width: 504,
    height: 207,
    alt: "JMR Automação Industrial",
  },
  lockup: {
    src: "/branding/jmr-automacao-industrial.webp",
    width: 1536,
    height: 713,
    alt: "JMR Automação Industrial",
  },
  mark: {
    src: "/branding/jmr-symbol.webp",
    width: 128,
    height: 129,
    alt: "",
  },
};

export function BrandWordmark({ className, priority = false }) {
  const asset = assets.wordmark;

  return (
    <Image
      src={asset.src}
      alt={asset.alt}
      width={asset.width}
      height={asset.height}
      priority={priority}
      unoptimized
      className={className}
    />
  );
}

export function BrandLockup({ className, priority = false }) {
  const asset = assets.lockup;

  return (
    <Image
      src={asset.src}
      alt={asset.alt}
      width={asset.width}
      height={asset.height}
      priority={priority}
      unoptimized
      className={className}
    />
  );
}

export function BrandMark({ className, priority = false }) {
  const asset = assets.mark;

  return (
    <Image
      src={asset.src}
      alt={asset.alt}
      width={asset.width}
      height={asset.height}
      priority={priority}
      unoptimized
      aria-hidden="true"
      className={className}
    />
  );
}
