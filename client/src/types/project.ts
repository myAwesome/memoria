export interface Project {
  id: number;
  name?: string;
  data?: string;
}

export type CreateProjectInput = {
  name: string;
  data: string;
};
