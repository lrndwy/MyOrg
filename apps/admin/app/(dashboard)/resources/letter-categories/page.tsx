"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { letterCategoryResource } from "@/resources/letter-categories";

export default function LetterCategoriesPage() {
  return <ResourcePage resource={letterCategoryResource} />;
}
