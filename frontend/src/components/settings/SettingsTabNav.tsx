import { Link, useMatchRoute } from '@tanstack/react-router'
import { motion } from 'framer-motion'

export function SettingsTabNav() {
  const matchRoute = useMatchRoute()

  const isScoreActive = !!matchRoute({ to: '/instellingen/score' })
  const isAccountActive = !isScoreActive

  return (
    <nav className="flex gap-1 rounded-full bg-[#F2F6F3] p-1 w-fit">
      <Link
        to="/instellingen"
        className="relative px-5 py-2 rounded-full text-[12px] font-semibold transition-colors"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {isAccountActive && (
          <motion.div
            layoutId="settings-tab"
            className="absolute inset-0 rounded-full bg-[#0E1111]"
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          />
        )}
        <span className={`relative z-10 ${isAccountActive ? 'text-white' : 'text-slate-500'}`}>
          Account
        </span>
      </Link>
      <Link
        to="/instellingen/score"
        className="relative px-5 py-2 rounded-full text-[12px] font-semibold transition-colors"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {isScoreActive && (
          <motion.div
            layoutId="settings-tab"
            className="absolute inset-0 rounded-full bg-[#0E1111]"
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          />
        )}
        <span className={`relative z-10 ${isScoreActive ? 'text-white' : 'text-slate-500'}`}>
          Score profiel
        </span>
      </Link>
    </nav>
  )
}
