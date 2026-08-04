export interface Application {
  id: string;
  name: string;
  url: string | null;
  environment: string;
  techStack: string | null;
  description: string | null;
  companyId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApplicationInput {
  name: string;
  url?: string;
  environment?: string;
  techStack?: string;
  description?: string;
}
