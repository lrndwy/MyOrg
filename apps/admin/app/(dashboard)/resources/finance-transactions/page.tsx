"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { financeTransactionResource } from "@/resources/finance-transactions";

export default function FinanceTransactionsPage() {
  return <ResourcePage resource={financeTransactionResource} />;
}
