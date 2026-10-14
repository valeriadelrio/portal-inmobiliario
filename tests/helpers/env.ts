// Los servicios usan el cliente global (DATABASE_URL). En tests apunta SIEMPRE a la base de pruebas local.
import { TEST_DATABASE_URL, assertLocal } from "./db";

assertLocal(TEST_DATABASE_URL);
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.STORAGE_DRIVER = "memory";
