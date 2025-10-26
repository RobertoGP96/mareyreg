import 'dotenv/config';

console.log('Variables de entorno disponibles:');
console.log('VITE_DATABASE_URL:', process.env.VITE_DATABASE_URL);
console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('Todas las variables que contienen DATABASE:', Object.keys(process.env).filter(key => key.includes('DATABASE')));