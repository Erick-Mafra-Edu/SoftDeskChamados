import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { loadChamadosWithFallback } from "@/lib/server/data-source";

export default async function HomePage() {
  const initialData = await loadChamadosWithFallback({
    cd_pasta: 1,
    cd_area: 0,
    cd_cliente: 0,
    cd_grupo_solucao: 0,
    tp_requisicao: "EM_ATENDIMENTO",
    tp_usuario: "ATE",
    start: 0,
    limit: 80,
  });

  return (
    <DashboardPage
      initialItems={initialData.items}
      initialSource={initialData.source}
      initialWarning={initialData.warning}
    />
  );
}
