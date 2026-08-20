export interface Plan {
  id: string;
  name: string;
  maxApplications: number;
  maxProjects: number;
  includesRemediation: boolean;
  price: number;
  isActive: boolean;
  createdAt: string;
}
