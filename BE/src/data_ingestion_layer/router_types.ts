import { DataProviderType } from "./base_data_provider.js";

export interface CompanyMetadata {
  name: string;
  sector?: string;
  context?: string;
}

export interface RouteDecision {
  provider: DataProviderType;
  query: string;
  isAmbiguous: boolean;
}
