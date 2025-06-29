import { FileUploader } from "@/components/FileUploader";
import { DataProvider } from "@/context/DataContext";
import { DataGrid } from "@/components/DataGrid";
import { ValidationSummary } from "@/components/ValidationSummary";

export default function Home() {
  return (
    <DataProvider>
      <main className="container mx-auto py-8 space-y-6">
        <h1 className="text-3xl font-bold">Data Alchemist</h1>
        <FileUploader />
        <ValidationSummary />
        <section className="space-y-8">
          <DataGrid type="clients" />
          <DataGrid type="workers" />
          <DataGrid type="tasks" />
        </section>
      </main>
    </DataProvider>
  );
}
