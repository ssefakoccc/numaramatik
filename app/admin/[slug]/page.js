import AdminCardView from "@/components/admin/AdminCardView";

export default async function AdminSlugPage({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || "arac";

  return <AdminCardView slug={slug} />;
}
