import { NeonService } from './src/services/neon-service';

async function addProductoColumn() {
  const neonService = new NeonService();
  try {
    await neonService.executeDelete('ALTER TABLE trips ADD COLUMN IF NOT EXISTS producto TEXT;');
    console.log('Columna producto agregada exitosamente');
  } catch (error) {
    console.error('Error al agregar la columna:', error);
  }
}

addProductoColumn();