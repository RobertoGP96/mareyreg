import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, Car, Users, Home, RouteIcon } from 'lucide-react'
import { Button } from './ui/button'
import { motion, AnimatePresence } from 'framer-motion'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()

  const navigation = [
    { name: 'Inicio', href: '/', icon: Home },
    { name: 'Conductores', href: '/drivers', icon: Users },
    { name: 'Viajes', href: '/trips', icon: RouteIcon },
    { name: 'Vehículos', href: '/vehicles', icon: Car },
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

            {/* Mobile menu button */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-white"
              >
                {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="md:hidden bg-white border-t overflow-hidden"
            >
              <div className="px-2 pt-2 pb-3 space-y-1">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center px-3 py-2 rounded-md text-base font-medium transition-all duration-300 hover:scale-105 ${isActive(item.href)
                      ? 'bg-gray-200 text-gray-700'
                      : 'text-gray-700 hover:text-gray-600 hover:bg-gray-100'
                      }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <item.icon className="h-5 w-5 mr-3" />
                    {item.name}
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content */}
      <main className="grow w-full sm:w-full md:w-4/5 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className='p-3 flex justify-center items-center border-t border-gray-300'>
        <p className='text-sm'>
          MareyReg.2025
        </p>
      </footer>
    </div>
  )
}