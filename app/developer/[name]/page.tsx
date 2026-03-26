"use client";

import { use } from "react";
import DeveloperProfile from "@/components/DeveloperProfile";

export default function DeveloperPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = use(params);
  return <DeveloperProfile devName={decodeURIComponent(name)} />;
}
