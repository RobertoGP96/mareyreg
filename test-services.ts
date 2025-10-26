import 'dotenv/config';
import { api } from './src/services/services';

async function testServices() {
  console.log('🔍 Probando servicios individuales con parámetros...\n');

  try {
    // Test getVehicle
    console.log('📊 Probando api.getVehicle(1)...');
    const vehicle = await api.getVehicle(1);
    console.log('✅ Vehículo obtenido:', vehicle);

    // Test getDriver
    console.log('\n👥 Probando api.getDriver(1)...');
    const driver = await api.getDriver(1);
    console.log('✅ Conductor obtenido:', driver);

    // Test getTrip
    console.log('\n🚚 Probando api.getTrip(1)...');
    const trip = await api.getTrip(1);
    console.log('✅ Viaje obtenido:', trip);

    console.log('\n🎉 ¡Todos los servicios funcionan correctamente con parámetros!');
  } catch (error) {
    console.error('❌ Error en los servicios:', error);
  }
}

testServices();