import { useSignedUrl } from "@/hooks/useSignedUrl";
import { User } from "lucide-react";

type Props = {
  bucket: string;
  value: string | null | undefined;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  iconSize?: number;
  fallbackText?: string;
};

export function SignedImage({ bucket, value, alt, className, fallbackClassName, iconSize = 40, fallbackText }: Props) {
  const url = useSignedUrl(bucket, value);
  if (value && url) {
    return <img src={url} alt={alt} className={className} />;
  }
  return (
    <div className={fallbackClassName ?? "w-full h-full flex items-center justify-center"}>
      {fallbackText ? <span>{fallbackText}</span> : <User size={iconSize} className="text-muted-foreground/30" />}
    </div>
  );
}
