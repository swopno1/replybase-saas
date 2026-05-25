import { env } from "./lib/env";
console.log("DATABASE_URL present:", !!env.DATABASE_URL);
console.log("REDIS_URL present:", !!process.env.REDIS_URL);
console.log("NODE_ENV:", process.env.NODE_ENV);
