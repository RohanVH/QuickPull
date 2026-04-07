import {
  Disc3,
  Facebook,
  Globe,
  Instagram,
  MessageCircleMore,
  Music4,
  PinIcon,
  PlayCircle,
  Twitter
} from "lucide-react";

const iconMap = {
  Disc3,
  Facebook,
  Globe,
  Instagram,
  MessageCircleMore,
  Music4,
  PinIcon,
  PlayCircle,
  Twitter
};

export function PlatformIcon({
  name,
  className
}: {
  name: keyof typeof iconMap;
  className?: string;
}) {
  const Icon = iconMap[name] ?? Globe;
  return <Icon className={className} />;
}
