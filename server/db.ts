// Database blueprint integration
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

// Initialize database sequences and required schema objects
export async function initializeDatabaseSequences(): Promise<void> {
  try {
    // Create ticket number sequence if it doesn't exist
    // This ensures atomic, race-condition safe ticket number generation
    await db.execute(sql`
      CREATE SEQUENCE IF NOT EXISTS ticket_number_seq 
      START WITH 1 
      INCREMENT BY 1
    `);
    console.log('Database sequences initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database sequences:', error);
    // Don't throw - the sequence might already exist or there might be permission issues
    // The application can still function, and errors will be caught when trying to create tickets
  }
}
