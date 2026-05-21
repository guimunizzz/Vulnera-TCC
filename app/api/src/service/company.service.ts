import { Company } from "../model/company.model"; //ficou sem usar
import { CompanyRepository } from "../repository/company.repository";

export class CompanyService {
  constructor(private readonly _repository = new CompanyRepository()) {}

  async selecionarTodos() {
    return await this._repository.selectAll();
  }

  async selecionarPorId(id: string) {
    return await this._repository.selectById(id);
  }

  async adicionarCompany(name: string, planId: string) {
    return await this._repository.insert({
      name,
      planId,
    });
  }

  async atualizarCompany(id: string, name: string, planId: string) {
    return await this._repository.update(id, {
      name,
      planId,
    });
  }

  async excluirCompany(id: string) {
    return await this._repository.delete(id);
  }
}