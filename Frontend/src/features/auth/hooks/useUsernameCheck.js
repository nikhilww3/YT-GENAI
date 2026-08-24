import { useState, useEffect } from 'react'
import { checkUsername } from '../services/auth.api'

/*
 * `available` is deliberately three-state:
 *   null  -> unknown (nothing typed yet, still debouncing, or the request failed)
 *   true  -> confirmed free
 *   false -> confirmed taken
 * Callers must not treat null as "taken" — that turns a backend outage into a
 * permanent "Already taken" message on every username.
 */
export function useUsernameCheck(username) {
    const [available, setAvailable] = useState(null)
    const [suggestions, setSuggestions] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!username || username.trim().length === 0) {
            setAvailable(null)
            setSuggestions([])
            setError(null)
            setLoading(false)
            return
        }

        setLoading(true)
        setError(null)

        let cancelled = false

        const timer = setTimeout(async () => {
            try {
                const data = await checkUsername(username.trim())
                if (cancelled) return
                setAvailable(data.available)
                setSuggestions(data.suggestions || [])
            } catch (err) {
                if (cancelled) return
                console.error('Error checking username:', err)
                setAvailable(null)
                setSuggestions([])
                setError(
                    err?.response?.status === 429
                        ? 'Too many checks — try again in a moment'
                        : "Couldn't check availability"
                )
            } finally {
                if (!cancelled) setLoading(false)
            }
        }, 500)

        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [username])

    return { available, suggestions, loading, error }
}
