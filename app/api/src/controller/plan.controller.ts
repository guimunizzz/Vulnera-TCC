import { Request, Response } from "express";
import { PlanService } from "../service/plan.service";

export class PlanController {
  constructor(private readonly _service = new PlanService()) { }

  searchAll = async (req: Request, res: Response): Promise<void> => {
    try {
      const plans = await this._service.selecionarTodos();
      res.status(200).json({
        mensagem: "Planos listados com sucesso.",
        recurso: plans,
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({
        mensagem: "Erro interno do servidor.",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  searchById = async (req: Request<{ id: string }>,res: Response,): Promise<void> => {
    try {
      const { id } = req.params;
      const plan = await this._service.selecionarPorId(id);

      if (!plan) {
        res.status(404).json({
          mensagem: "Plano não encontrado.",
        });
        return;
      }

      res.status(200).json({
        mensagem: "Plano encontrado com sucesso.",
        recurso: plan,
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({
        mensagem: "Erro interno do servidor.",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  insertPlan = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, maxApplications, price } = req.body;
      const plan = await this._service.adicionarPlan(name, maxApplications, price );
      res.status(201).json({
        mensagem: "Plano criado com sucesso.",
        recurso: plan,
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({
        mensagem: "Erro interno do servidor.",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  updatePlan = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { name, maxApplications, price } = req.body;
      const plan = await this._service.atualizarPlan(id, name, maxApplications, price);
      res.status(200).json({
        mensagem: "Plano atualizado com sucesso.",
        recurso: plan,
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({
        mensagem: "Erro interno do servidor.",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  deletePlan = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      await this._service.excluirPlan(id);
      res.status(200).json({
        mensagem: "Plano deletado com sucesso.",
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({
        mensagem: "Erro interno do servidor.",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };
}