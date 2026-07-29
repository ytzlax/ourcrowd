import cors from "cors";
import express, { type Express } from "express";

import { DatabaseService } from "../db/database_service.js";
import { createCompaniesRouter } from "./companies_routes.js";
import { createDashboardRouter } from "./dashboard_routes.js";
import { errorHandler } from "./error_handler.js";

export interface CreateAppOptions {
  db?: DatabaseService;
  corsOrigin?: string | string[];
}

export interface GatewayApp {
  app: Express;
  db: DatabaseService;
  ownsDatabase: boolean;
}

export function createApp(options: CreateAppOptions = {}): GatewayApp {
  const ownsDatabase = options.db === undefined;
  const db = options.db ?? new DatabaseService();
  const corsOrigin = options.corsOrigin ?? "http://localhost:5173";

  const app = express();

  app.use(
    cors({
      origin: corsOrigin,
    }),
  );
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/dashboard", createDashboardRouter(db));
  app.use("/api/companies", createCompaniesRouter(db));

  app.use(errorHandler);

  return { app, db, ownsDatabase };
}
