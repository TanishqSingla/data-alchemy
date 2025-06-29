import { FileUploader } from "@/components/FileUploader";
import { DataProvider } from "@/context/DataContext";
import { BusinessRulesProvider } from "@/context/BusinessRulesContext";
import { DataGrid } from "@/components/DataGrid";
import { ValidationSummary } from "@/components/ValidationSummary";
import { BusinessRules } from "@/components/BusinessRules";

export default function Home() {
  return (
    <BusinessRulesProvider>
      <DataProvider>
        <main className="container mx-auto py-8 space-y-6">
          <h1 className="text-3xl font-bold">Data Alchemist</h1>
          <FileUploader />
          <BusinessRules />
          <ValidationSummary />
          <section className="space-y-8">
            <DataGrid type="clients" />
            <DataGrid type="workers" />
            <DataGrid type="tasks" />
          </section>
        </main>
      </DataProvider>
    </BusinessRulesProvider>
  );
}
