import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { plansApi } from "../lib/api/plans.api";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";

function formatPrice(price: number): string {
  if (price <= 0) return "Sob consulta";
  return price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PlansPage() {
  const { data: plans, isLoading, isError } = useQuery({
    queryKey: ["plans"],
    queryFn: plansApi.list,
  });

  // menor pra maior por capacidade — price sozinho não serve de rank porque
  // o plano Enterprise usa price=0 pra representar "sob consulta"
  const sorted = [...(plans ?? [])].sort((a, b) => a.maxApplications - b.maxApplications);

  return (
    <div className="min-h-screen bg-background px-4 py-16">
      <div className="mx-auto max-w-5xl text-center">
        <h1 className="text-3xl font-bold text-foreground">Planos Vulnera</h1>
        <p className="mt-2 text-muted">Escolha o plano ideal para a maturidade de segurança da sua empresa.</p>
      </div>

      {isLoading && <p className="mt-12 text-center text-muted">Carregando planos...</p>}
      {isError && (
        <p className="mt-12 text-center text-severity-critical">Não foi possível carregar os planos.</p>
      )}

      {!isLoading && !isError && (
        <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
          {sorted.map((plan) => (
            <Card key={plan.id} className="flex flex-col">
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>
                  {formatPrice(plan.price)}
                  {plan.price > 0 ? "/mês" : ""}
                </CardDescription>
              </CardHeader>

              <ul className="flex flex-1 flex-col gap-2 text-sm text-muted">
                <li>Até {plan.maxApplications} aplicações</li>
                <li>Até {plan.maxProjects} projetos simultâneos</li>
                <li>{plan.includesRemediation ? "Remediação incluída" : "Sem remediação incluída"}</li>
              </ul>

              <Button asChild className="mt-6">
                <Link to="/register">Começar</Link>
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
