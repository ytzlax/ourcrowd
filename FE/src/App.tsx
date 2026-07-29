import { useState } from "react";

import { CompanyTable } from "@/components/companies/CompanyTable";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MentionsDrawer } from "@/components/mentions/MentionsDrawer";
import { SummaryCards } from "@/components/summary/SummaryCards";
import type { CompanyWithStats } from "@/types";

function App() {
  const [selectedCompany, setSelectedCompany] =
    useState<CompanyWithStats | null>(null);

  return (
    <DashboardLayout>
      <div className="space-y-10">
        <section aria-labelledby="summary-heading" className="space-y-4">
          <div>
            <h2
              id="summary-heading"
              className="text-sm font-semibold tracking-wide text-foreground uppercase"
            >
              Overview
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Live metrics from the monitoring pipeline
            </p>
          </div>
          <SummaryCards />
        </section>

        <section aria-labelledby="portfolio-heading" className="space-y-4">
          <div>
            <h2
              id="portfolio-heading"
              className="text-sm font-semibold tracking-wide text-foreground uppercase"
            >
              Portfolio mention status
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Search and filter tracked companies. Select a row to inspect
              quarterly coverage.
            </p>
          </div>
          <CompanyTable
            selectedCompanyId={selectedCompany?.id ?? null}
            onSelectCompany={setSelectedCompany}
          />
        </section>
      </div>

      <MentionsDrawer
        company={selectedCompany}
        onClose={() => setSelectedCompany(null)}
      />
    </DashboardLayout>
  );
}

export default App;
