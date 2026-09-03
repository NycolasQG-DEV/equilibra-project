/**
 * Script de inicialização e teste de conexão do banco de dados MySQL.
 * Execute com: node setup-db.mjs
 */
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";

// Carregar variáveis do .env manualmente
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...values] = trimmed.split("=");
      const val = values.join("=").trim();
      process.env[key.trim()] = val;
    }
  });
}

const dbHost = process.env.DB_HOST || "localhost";
const dbPort = parseInt(process.env.DB_PORT || "3306", 10);
const dbUser = process.env.DB_USER || "root";
const dbPassword = process.env.DB_PASSWORD || "";
const dbName = process.env.DB_NAME || "equilibra_db";

console.log("🔧 Testando conexão com o MySQL local...");
console.log(`📌 Host: ${dbHost}:${dbPort}`);
console.log(`📌 Banco: ${dbName}`);
console.log(`📌 Usuário: ${dbUser}`);

async function run() {
  try {
    // 1. Conectar ao MySQL Server
    const conn = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      multipleStatements: true,
    });
    console.log("✅ Conexão com o servidor MySQL estabelecida com sucesso!");

    // 2. Criar Database se não existir
    console.log(`📦 Criando/verificando banco de dados "${dbName}"...`);
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await conn.query(`USE \`${dbName}\`;`);

    // 3. Aplicar Schema Relacional
    const schemaPath = path.join(process.cwd(), "lib", "db", "schema.sql");
    if (fs.existsSync(schemaPath)) {
      console.log("📦 Aplicando tabelas, chaves e índices (schema.sql)...");
      const sql = fs.readFileSync(schemaPath, "utf-8");
      await conn.query(sql);
      console.log("✅ Tabelas e índices verificados e sincronizados com sucesso!");
    }

    // 4. Listar tabelas criadas
    const [tables] = await conn.query(`SHOW TABLES;`);
    console.log("\n📋 Tabelas ativas no MySQL:");
    tables.forEach((row) => {
      const tableName = Object.values(row)[0];
      console.log(`   - ${tableName}`);
    });

    await conn.end();
    console.log("\n🎉 Banco de dados MySQL pronto e operacional!");
  } catch (err) {
    console.error("\n❌ Erro ao conectar ao MySQL:", err.message);
    console.log("\n💡 Dica: Verifique se o seu serviço MySQL local está ativo e se a senha no arquivo .env (DB_PASSWORD) está correta.");
  }
}

run();
