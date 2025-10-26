import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import Layout from './components/Layout'
import { Button } from './components/ui/button'
import { DriverList, DriverDetails } from './components/driver'
import { VehicleList } from './components/vehicle'
import { TripList } from './components/trip'
import { Users, Truck, ClipboardList, RouteIcon } from 'lucide-react'
import { api } from './services/services'

const queryClient = new QueryClient()

function Home() {
  const { data: drivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: api.getDrivers,
  })

  const { data: vehicles } = useQuery({
    queryKey: ['vehicles'],
    queryFn: api.getVehicles,
  })

  const { data: trips } = useQuery({
    queryKey: ['trips'],
    queryFn: api.getTrips,
  })

  return (
    <div className="space-y-6">
      <div>
        <div className='w-full flex justify-center items-center'>
          <div>

          <div className='w-35 rounded-xl'>
            <img className='w-full h-auto' src="/truck.svg" alt="" />
          </div>
          <p className='roadway-font text-5xl font-bold'>MAREYreg</p>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Inicio</h1>
        <p className="text-gray-600 mt-2">Bienvenido al Registro de Viajes</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center flex-row gap-2">
            <div className='p-2 rounded-xl bg-gray-200'>
              <Users className="h-8 w-8 text-gray-600" />
            </div>
            <div className='flex flex-row justify-between w-full'>
              <h2 className="text-xl font-semibold text-gray-900">Conductores</h2>
              <p className="text-2xl font-bold text-gray-600">{drivers?.length || 0}</p>
            </div>
          </div>
          <p className="text-gray-600 mt-2">Conductores registrados</p>
          <Link to="/drivers">
            <Button className="mt-4 w-full">
              <ClipboardList className="h-4 w-4 mr-2" />
              Gestionar Conductores
            </Button>
          </Link>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center flex-row gap-2">
            <div className='p-2 rounded-xl bg-gray-200'>
              <RouteIcon className="h-8 w-8 text-gray-600 " />
            </div>
            <div className='flex flex-row justify-between w-full'>
              <h2 className="text-xl font-semibold text-gray-900">Viajes</h2>
              <p className="text-2xl font-bold text-gray-600">{trips?.length || 0}</p>
            </div>
          </div>
          <p className="text-gray-600 mt-2">Viajes registrados</p>
          <Link to="/trips">
            <Button className="mt-4 w-full">
              <ClipboardList className="h-4 w-4 mr-2" />
              Gestionar Viajes
            </Button>
          </Link>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center flex-row gap-2">
            <div className='p-2 rounded-xl bg-gray-200'>
              <Truck className="h-8 w-8 text-gray-600" />
            </div>
            <div className='flex flex-row justify-between w-full'>
              <h2 className="text-xl font-semibold text-gray-900">Vehículos</h2>
              <p className="text-2xl font-bold text-gray-600">{vehicles?.length || 0}</p>
            </div>
          </div>
          <p className="text-gray-600 mt-2">Vehículos en flota</p>
          <Link to="/vehicles">
            <Button className="mt-4 w-full">
              <ClipboardList className="h-4 w-4 mr-2" />
              Gestionar Vehículos
            </Button>
          </Link>
        </div>


      </div>
    </div>
  )
}

function About() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Acerca de</h1>
      <p className="text-gray-600">Esta es una aplicación para MareyReg.</p>
      <Button>Botón de Ejemplo</Button>
    </div>
  )
}

function Drivers() {
  return (
    <div className="space-y-6">
      <DriverList />
    </div>
  )
}

function DriverDetailsPage() {
  return (
    <div className="space-y-6">
      <DriverDetails />
    </div>
  )
}


function Vehicles() {
  return (
    <div className="space-y-6">

      <VehicleList />
    </div>
  )
}

function Trips() {
  return (
    <div className="space-y-6">

      <TripList />
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Layout>
        <AnimatedRoutes />
      </Layout>
    </QueryClientProvider>
  )
}

function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Home />
          </motion.div>
        } />
        <Route path="/about" element={
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <About />
          </motion.div>
        } />
        <Route path="/drivers" element={
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Drivers />
          </motion.div>
        } />
        <Route path="/drivers/:id" element={
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <DriverDetailsPage />
          </motion.div>
        } />
        <Route path="/vehicles" element={
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Vehicles />
          </motion.div>
        } />
        <Route path="/trips" element={
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Trips />
          </motion.div>
        } />
      </Routes>
    </AnimatePresence>
  )
}

export default App
