import { notFound } from "next/navigation";
import VehicleCardView from "@/components/scanner/VehicleCardView";
import { isReservedSlug } from "@/lib/slug";

export default async function DynamicSlugPage({ params }) {
  const resolvedParams = await params;
  const rawSlug = resolvedParams?.slug;

  if (!rawSlug || isReservedSlug(rawSlug)) {
    notFound();
  }

  const slug = rawSlug.trim().toLowerCase();
  return <VehicleCardView slug={slug} />;
}
