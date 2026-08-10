export function PexelsCredit({
  photographer,
  photographerUrl,
  className,
}: {
  photographer: string;
  photographerUrl: string;
  className?: string;
}) {
  return (
    <p className={`text-[11px] text-muted ${className ?? ""}`}>
      Photo by{" "}
      <a href={photographerUrl} target="_blank" rel="noreferrer" className="underline">
        {photographer}
      </a>{" "}
      on{" "}
      <a href="https://www.pexels.com" target="_blank" rel="noreferrer" className="underline">
        Pexels
      </a>
    </p>
  );
}
