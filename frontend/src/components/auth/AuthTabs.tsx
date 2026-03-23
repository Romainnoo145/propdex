import { useState } from 'react'
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
    <div className="w-full max-w-md rounded-[24px] border border-[#EAEFEF] bg-white p-6 shadow-lg">
      {/* Tab list */}
      <div
        role="tablist"
        className="mb-6 flex border-b border-[#EAEFEF]"
      >
        <button
          role="tab"
          aria-selected={activeTab === 'login'}
          aria-controls="login-panel"
          onClick={() => setActiveTab('login')}
          className={`flex-1 px-4 py-2.5 text-sm font-bold transition-colors ${
            activeTab === 'login'
              ? 'border-b-2 border-[#F9A826] text-[#F9A826]'
              : 'text-neutral-400 hover:text-aura-ink'
          }`}
        >
          Log in
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'register'}
          aria-controls="register-panel"
          onClick={() => setActiveTab('register')}
          className={`flex-1 px-4 py-2.5 text-sm font-bold transition-colors ${
            activeTab === 'register'
              ? 'border-b-2 border-[#F9A826] text-[#F9A826]'
              : 'text-neutral-400 hover:text-aura-ink'
          }`}
        >
          Register
        </button>
      </div>

      {/* Login tab panel */}
      {activeTab === 'login' && (
        <div role="tabpanel" id="login-panel" aria-labelledby="login-tab">
          <LoginForm onLogin={onLogin} onSuccess={onLoginSuccess} />

          {/* Or divider */}
          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-neutral-200"></div>
            <span className="px-3 text-sm text-neutral-600">
              or
            </span>
            <div className="flex-1 border-t border-neutral-200"></div>
          </div>

          <GoogleButton />
        </div>
      )}

      {/* Register tab panel */}
      {activeTab === 'register' && (
        <div role="tabpanel" id="register-panel" aria-labelledby="register-tab">
          <RegisterForm onRegister={onRegister} onSuccess={onRegisterSuccess} />

          {/* Or divider */}
          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-neutral-200"></div>
            <span className="px-3 text-sm text-neutral-600">
              or
            </span>
            <div className="flex-1 border-t border-neutral-200"></div>
          </div>

          <GoogleButton />
        </div>
      )}
    </div>
  )
}
