import { PlanRepository } from "../repository/plan.repository";
import { Plan } from "../model/plan.model";

export class PlanService {
  constructor(private readonly _repository = new PlanRepository()) {}

  async selecionarTodos() {
    return await this._repository.selectAll();
  }

  async selecionarPorId(id: string) {
    return await this._repository.selectById(id);
  }

  async adicionarPlan(name: string, maxApplications: number, price: number) {
    const plan = new Plan(name, maxApplications, price);

    return await this._repository.insert({
      name: plan.Name,
      maxApplications: plan.MaxApplications,
      price: plan.Price,
    });
  }
}