import { DataProviderType } from "../data_layer/base_data_provider.js";
import { CompanyType, MediaPresence } from "../db/types.js";

export interface CompanyMetadata {
  name: string;
  domain?: string;
  sector?: string;
  companyType: CompanyType;
  mediaPresence: MediaPresence;
}

export interface RouteDecision {
  provider: DataProviderType;
  query: string;
  isAmbiguous: boolean;
}
