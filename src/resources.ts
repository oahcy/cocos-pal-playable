import path from 'node:path';

export interface PackagingResources { templates: string; runtime: string }
export const defaultResources: PackagingResources = {
  templates: path.join(__dirname, '../static/templates'),
  runtime: path.join(__dirname, '../dist'),
};
