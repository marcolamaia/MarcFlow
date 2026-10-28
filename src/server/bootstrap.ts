import nextEnv from "@next/env";

// Load .env before importing modules that create database clients or schedulers.
nextEnv.loadEnvConfig(process.cwd());
await import("./index");
