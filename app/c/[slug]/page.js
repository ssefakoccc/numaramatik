import VehicleCardView from "@/components/scanner/VehicleCardView";

export default async function CardSlugPage({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || "arac";

  return <VehicleCardView slug={slug} />;
}
