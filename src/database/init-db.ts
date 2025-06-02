import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function initializeDatabase() {
  const client = new Client({
    host: 'dev.telehost.net',
    port: 5460,
    user: 'luis',
    password: 'Lam1414*$',
    database: 'backed',
    ssl: false
  });

  try {
    console.log('Conectando a la base de datos...');
    await client.connect();
    console.log('Conexión exitosa');

    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, 'init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Ejecutar el script SQL
    console.log('Ejecutando script SQL...');
    await client.query(sql);
    console.log('Script SQL ejecutado exitosamente');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

// Ejecutar la función
initializeDatabase(); 