import { useState } from 'react'
import { supabase } from '../utils/supabase'

export default function AuthModal({ onClose, onAuth }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        setMessage('Check your email for a confirmation link!')
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        onAuth(data.user)
        onClose()
      }
    }

    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="modal-title">
          {mode === 'login' ? '👻 Sign in to GhostCrowd' : '👻 Create account'}
        </div>

        {message ? (
          <div className="modal-message">{message}</div>
        ) : (
          <form onSubmit={handleSubmit} className="modal-form">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="modal-input"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="modal-input"
            />
            {error && <div className="modal-error">{error}</div>}
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Loading...' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        )}

        <div className="modal-switch">
          {mode === 'login' ? (
            <>Don't have an account? <button onClick={() => { setMode('signup'); setError(null) }}>Sign up</button></>
          ) : (
            <>Already have an account? <button onClick={() => { setMode('login'); setError(null) }}>Sign in</button></>
          )}
        </div>
      </div>
    </div>
  )
}
