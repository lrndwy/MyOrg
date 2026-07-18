"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { financeCategoryResource } from "@/resources/finance-categories";

export default function FinanceCategoriesPage() {
  return <ResourcePage resource={financeCategoryResource} />;
}
