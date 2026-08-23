import { Facebook, Instagram, Twitter, Youtube } from "lucide-react";

const platformMap = {
  Instagram: { Icon: Instagram, className: "platform-instagram" },
  Facebook: { Icon: Facebook, className: "platform-facebook" },
  Twitter: { Icon: Twitter, className: "platform-twitter" },
  YouTube: { Icon: Youtube, className: "platform-youtube" },
};

export function PlatformBadge({ platform }: { platform: keyof typeof platformMap }) {
  const { Icon, className } = platformMap[platform];
  return (
    <span className={`platform-badge ${className}`} title={platform}>
      <Icon size={14} strokeWidth={2.2} />
    </span>
  );
}
