"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { divisionResource } from "@/resources/divisions";

export default function DivisionsPage() {
  return <ResourcePage resource={divisionResource} />;
}
