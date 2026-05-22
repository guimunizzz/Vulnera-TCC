import { Router } from 'express';
import { PlanController } from '../controller/plan.controller';
import { PlanService } from '../service/plan.service';

const planRouter = Router();
const planService = new PlanService();
const planController = new PlanController(planService);

planRouter.get('/', planController.searchAll);
planRouter.get('/:id', planController.searchById);
planRouter.post('/', planController.insertPlan);
planRouter.put('/:id', planController.updatePlan);
planRouter.delete('/:id', planController.deletePlan);

export default planRouter;
