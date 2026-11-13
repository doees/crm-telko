import { notFound } from "next/navigation";
import { navigation } from "@/lib/navigation";
import { ModulePage } from "@/modules/crm/pages";
export const dynamicParams = false;
export function generateStaticParams() {
  return navigation
    .filter((item) => item.href !== "/dashboard")
    .map((item) => ({ module: item.href.slice(1) }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  if (
    !navigation.some(
      (item) => item.href === `/${module}` && item.href !== "/dashboard",
    )
  )
    notFound();
  return <ModulePage module={module} />;
}
