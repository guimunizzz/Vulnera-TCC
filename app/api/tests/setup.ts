import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.test") });

// `prisma migrate deploy` contra o banco vulnera_test fica pendente até
// Docker/MySQL local estarem disponíveis (ver PRD_VIVO.md, Estado parcial).
