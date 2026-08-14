const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { Client } = require("pg");
const db = require("./db");

dotenv.config({ path: path.join(__dirname, ".env") });

function getConfig() {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString) {
    return {
      connectionString,
      ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false
    };
  }

  return {
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD || "",
    ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false
  };
}

async function main() {
  const schemaPath = path.join(__dirname, "schema.sql");
  const studentSeedPath = path.join(__dirname, "seed_students.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  const studentSeedSql = fs.readFileSync(studentSeedPath, "utf8");
  const client = new Client(getConfig());

  await client.connect();

  try {
    await client.query(schemaSql);
    await db.seedDefaults();
    await client.query(studentSeedSql);
    console.log("Schema reset completed successfully.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Schema reset failed:", error.message);
  process.exitCode = 1;
});
