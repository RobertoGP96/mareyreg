import { Link, useLocation } from 'react-router-dom'
import { Car, Users, Home, RouteIcon, Settings } from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()

  const navigation = [
    { name: 'Inicio', href: '/', icon: Home },
    { name: 'Conductores', href: '/drivers', icon: Users },
    { name: 'Viajes', href: '/trips', icon: RouteIcon },
    { name: 'Vehículos', href: '/vehicles', icon: Car },
    { name: 'Configuración', href: '/settings', icon: Settings },
  ]

  const isActive = (href: string) => location.pathname === href

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-black shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <img src="/truck-white.svg" alt="MareyReg Logo" className="h-8 w-8 mr-2" />
              <h1 className="text-2xl font-bold text-white roadway-font">MAREYreg</h1>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 hover:scale-105 ${isActive(item.href)
                    ? 'bg-white text-black'
                    : 'text-white hover:text-black hover:bg-gray-100'
                    }`}
                >
                  <item.icon className="h-4 w-4 mr-2" />
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="grow w-full sm:w-full md:w-4/5 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-black md:hidden z-50">
        <div className="flex justify-around items-center h-16">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center justify-center p-2 rounded-md text-sm font-medium transition-all duration-300 ${isActive(item.href)
                ? 'bg-white text-black'
                : 'text-white hover:text-black hover:bg-gray-100'
              }`}
            >
              <item.icon className="h-6 w-6" />
            </Link>
          ))}
        </div>
      </div>

      <footer className='p-3 flex justify-center items-center border-t border-gray-300'>
        <p className='text-sm'>
          MareyReg.2025
        </p>
      </footer>
    </div>
  )
}