import {
  Baby,
  Bone,
  Brush,
  Bug,
  Car,
  Cog,
  Droplets,
  Flower2,
  Footprints,
  Gamepad2,
  Gem,
  HeartPulse,
  Home,
  Leaf,
  Lightbulb,
  PawPrint,
  Plug,
  Puzzle,
  Shirt,
  ShoppingBag,
  Sparkles,
  SprayCan,
  Sprout,
  Tractor,
  Utensils,
  Wind,
  Wrench,
} from "lucide-react";

export default function CategoryIcon({
  slug,
  className = "h-5 w-5",
}: {
  slug: string;
  className?: string;
}) {
  const s = slug.toLowerCase();
  if (s.includes("aksesoris")) return <Gem className={className} aria-hidden="true" />;
  if (s.includes("rumah tangga")) return <Home className={className} aria-hidden="true" />;
  if (s.includes("benih")) return <Sprout className={className} aria-hidden="true" />;
  if (s.includes("desinfektan")) return <SprayCan className={className} aria-hidden="true" />;
  if (s.includes("elektronik")) return <Plug className={className} aria-hidden="true" />;
  if (s.includes("perawatan sepatu")) return <Brush className={className} aria-hidden="true" />;
  if (s.includes("sepatu") || s.includes("sandal") || s.includes("flat"))
    return <Footprints className={className} aria-hidden="true" />;
  if (s.includes("fashion")) return <Shirt className={className} aria-hidden="true" />;
  if (s.includes("underwear")) return <Shirt className={className} aria-hidden="true" />;
  if (s.includes("selimut") || s.includes("bedong"))
    return <Baby className={className} aria-hidden="true" />;
  if (s.includes("herbal")) return <Leaf className={className} aria-hidden="true" />;
  if (s.includes("hobi")) return <Gamepad2 className={className} aria-hidden="true" />;
  if (s.includes("kecantikan") || s.includes("kosmetik") || s.includes("wewangian"))
    return <Sparkles className={className} aria-hidden="true" />;
  if (s.includes("kesehatan")) return <HeartPulse className={className} aria-hidden="true" />;
  if (s.includes("mainan peliharaan")) return <Bone className={className} aria-hidden="true" />;
  if (s.includes("mainan")) return <Puzzle className={className} aria-hidden="true" />;
  if (s.includes("makanan") || s.includes("minuman"))
    return <Utensils className={className} aria-hidden="true" />;
  if (s.includes("otomotif")) return <Car className={className} aria-hidden="true" />;
  if (s.includes("parfum")) return <Flower2 className={className} aria-hidden="true" />;
  if (s.includes("pembasmi") || s.includes("serangga"))
    return <Bug className={className} aria-hidden="true" />;
  if (s.includes("pencahayaan")) return <Lightbulb className={className} aria-hidden="true" />;
  if (s.includes("penghilang bau")) return <Wind className={className} aria-hidden="true" />;
  if (s.includes("hewan")) return <PawPrint className={className} aria-hidden="true" />;
  if (s.includes("peternakan")) return <Tractor className={className} aria-hidden="true" />;
  if (s.includes("pupuk")) return <Droplets className={className} aria-hidden="true" />;
  if (s.includes("reparasi")) return <Wrench className={className} aria-hidden="true" />;
  if (s.includes("sparepart")) return <Cog className={className} aria-hidden="true" />;
  return <ShoppingBag className={className} aria-hidden="true" />;
}
