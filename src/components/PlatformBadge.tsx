import { Facebook, Instagram, Linkedin, Youtube } from "lucide-react";

const platformMap = {
  Instagram: { Icon: Instagram, className: "platform-instagram" },
  Facebook: { Icon: Facebook, className: "platform-facebook" },
  LinkedIn: { Icon: Linkedin, className: "platform-linkedin" },
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

