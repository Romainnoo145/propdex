import { useState } from 'react'
import { AMBER, GREEN, RED, OBSIDIAN, SLATE_MUTED } from '@/lib/tokens'
import { motion } from 'framer-motion'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'
import { GoogleButton } from './GoogleButton'
import type { RegisterData } from '../../lib/auth/types'

type TabType = 'login' | 'register'

interface AuthTabsProps {
  onLogin: (email: string, password: string) => Promise<void>
  onRegister: (data: RegisterData) => Promise<void>
  onLoginSuccess: () => void
  onRegisterSuccess: () => void
}

export function AuthTabs({
  onLogin,
  onRegister,
  onLoginSuccess,
  onRegisterSuccess,
}: AuthTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('login')

  return (
    <div className="space-y-6">
      {/* Pill tab switcher — matches GemeenteCategoryTabs pattern */}
      <div className="flex w-full h-[44px] rounded-full p-1 bg-[#F2F6F3]">
        {(['login', 'register'] as const).map((tab) => {
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab)}
              className="relative flex-1 h-full rounded-full flex items-center justify-center transition-colors"
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: '13px',
                fontWeight: isActive ? 700 : 600,
                color: isActive ? undefined : SLATE_MUTED,
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="auth-tab"
                  className="absolute inset-0 rounded-full"
                  style={{ background: OBSIDIAN }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className={`relative z-10 ${isActive ? 'text-white' : ''}`}>
                {tab === 'login' ? 'Log in' : 'Register'}
              </span>
            </button>
          )
        })}
      </div>

      {/* Form */}
      {activeTab === 'login' && (
        <LoginForm onLogin={onLogin} onSuccess={onLoginSuccess} />
      )}
      {activeTab === 'register' && (
        <RegisterForm onRegister={onRegister} onSuccess={onRegisterSuccess} />
      )}

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-neutral-200" />
        <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">of</span>
        <div className="flex-1 h-px bg-neutral-200" />
      </div>

      {/* Google */}
      <GoogleButton />
    </div>
  )
}
