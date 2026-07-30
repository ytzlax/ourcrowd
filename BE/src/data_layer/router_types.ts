import { DataProviderType } from "./base_data_provider.js";
import { CompanyType, MediaPresence } from "../db/types.js";

export interface CompanyMetadata {
  name: string;
  sector?: string;
  companyType: CompanyType;
  mediaPresence: MediaPresence;
}

export interface RouteDecision {
  provider: DataProviderType;
  query: string;
  isAmbiguous: boolean;
}
