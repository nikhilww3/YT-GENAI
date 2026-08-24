import React, { useState } from 'react'
import "../auth.form.scss";
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { useUsernameCheck } from '../hooks/useUsernameCheck';
import { usePasswordStrength } from '../hooks/usePasswordStrength';
import { ZeroFareMark, EyeIcon, EyeOffIcon } from '../../interview/components/icons.jsx';

const STRENGTH_LABEL = { weak: 'Weak', fair: 'Fair', strong: 'Strong' }

/* Backend gate (auth.controller registerUserController): >= 10 chars AND
 * zxcvbn score >= 3. Both sides score with the same dictionaries, so what this
 * meter shows is exactly what the server will accept — no "looks strong, got
 * rejected" surprise on submit. */
const MIN_PASSWORD_LENGTH = 10

const Register = () => {

    const navigate = useNavigate()
    const [username, setUsername] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)

    const { available, suggestions, loading: checkingUsername, error: usernameError } = useUsernameCheck(username)
    const { score, feedback, strength, isValid: passwordIsValid } = usePasswordStrength(password, [username, email])
    const {loading, error, handleRegister} = useAuth()

    const tooShort = password.length < MIN_PASSWORD_LENGTH
    const strengthNote = tooShort
        ? `At least ${MIN_PASSWORD_LENGTH} characters (${password.length}/${MIN_PASSWORD_LENGTH})`
        : passwordIsValid
            ? 'Strong enough to register'
            : feedback || 'Too easy to guess — try less common words'

    /* `available === false` only. `null` means the check is unknown (still
     * debouncing, or the request failed) and must never block submission —
     * treating it as "taken" would lock everyone out during a backend blip. */
    const submitBlocked = available === false || (password.length > 0 && !passwordIsValid)

    const handleSumbit = async (e) =>{
        e.preventDefault()
        const user = await handleRegister({username, email, password})
        if (user) navigate("/")
    }

    if(loading){
        return (
            <main className="depot depot--working">
                <div className="blind" aria-live="polite">
                    <p className="blind__rule">Punching a new ticket</p>
                    <p className="blind__course">REGISTERING</p>
                </div>
            </main>
        )
    }

  return (
    <main className="depot depot--gate depot--cinematic">
        <div className="backdrop">
            <div className="backdrop__layer backdrop__layer--base"></div>
            <div className="backdrop__layer backdrop__layer--weave"></div>
            <div className="backdrop__layer backdrop__layer--glow"></div>
        </div>
        <div className="accent accent--left"></div>
        <div className="accent accent--right"></div>
        <div className="ticket">
            <div className="brandmark">
                <ZeroFareMark className="brandmark__icon" />
                <span className="brandmark__word">ZeroFare</span>
            </div>
            <div className="ticket__window animate-code-slide">
                <span className="blind__code">ZFR 01</span>
                <h1 className="ticket__course animate-title-draw">NEW TRAVELLER</h1>
            </div>
            <p className="ticket__note animate-tagline-fade">Every job deserves a tailored resume — print yours free.</p>

            <form className="ticket__form" onSubmit={handleSumbit}>
                <div className="ticket__field animate-field-fade" style={{animationDelay: '0.8s'}}>
                    <label className="ticket__label" htmlFor="username">Username</label>
                    {/* `value` is required, not optional: the suggestion buttons below
                        call setUsername(), and without it React never writes that back
                        into the field. The input kept the typed name while the checker
                        (which reads state) reported on the suggestion — "already taken"
                        and "available" for the same visible text — and submit sent the
                        invisible state value. */}
                    <input
                        className="ticket__input"
                        value={username}
                        onChange={(e) => {setUsername(e.target.value)}}
                        type="text" id="username" name='username' placeholder='Enter username' required/>
                    {username && (
                        <div className={`username-status ${available === false ? 'taken' : 'available'}`}>
                            {checkingUsername ? (
                                <span className="status-text">Checking...</span>
                            ) : usernameError ? (
                                <span className="status-text">{usernameError}</span>
                            ) : available === null ? null : available ? (
                                <span className="status-text status-available">✓ Available</span>
                            ) : (
                                <div className="status-taken">
                                    <span className="status-text">Already taken</span>
                                    {suggestions.length > 0 && (
                                        <div className="suggestions-list animate-suggestions">
                                            {suggestions.map((suggestion, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    className="suggestion-item"
                                                    style={{animationDelay: `${idx * 0.1}s`}}
                                                    onClick={() => setUsername(suggestion)}
                                                >
                                                    {suggestion}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="ticket__field animate-field-fade" style={{animationDelay: '0.9s'}}>
                    <label className="ticket__label" htmlFor="email">Email</label>
                    <input
                        className="ticket__input"
                        value={email}
                        onChange={(e) => {setEmail(e.target.value)}}
                        type="email" id="email" name='email' placeholder='Enter email address' required/>
                </div>
                <div className="ticket__field animate-field-fade" style={{animationDelay: '1.0s'}}>
                    <label className="ticket__label" htmlFor="password">Password</label>
                    <div className="ticket__control">
                        <input
                            className="ticket__input ticket__input--secret"
                            value={password}
                            onChange={(e) => {setPassword(e.target.value)}}
                            type={showPassword ? "text" : "password"}
                            id="password" name='password'
                            placeholder='Password (min 10 chars, strong)' required/>
                        <button
                            type="button"
                            className="ticket__reveal"
                            onClick={() => setShowPassword((shown) => !shown)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            aria-pressed={showPassword}>
                            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                        </button>
                    </div>
                    {password && (
                        <div className={`strength strength--${strength}`}>
                            <div className="strength__meter" aria-hidden="true">
                                {[0, 1, 2, 3].map((i) => (
                                    <span
                                        key={i}
                                        className={`strength__segment${i < Math.max(score, 1) ? ' is-lit' : ''}`}
                                    />
                                ))}
                            </div>
                            <p className="strength__note" aria-live="polite">
                                <span className="strength__label">{STRENGTH_LABEL[strength]}</span>
                                {' — '}{strengthNote}
                            </p>
                        </div>
                    )}
                </div>

                {error && <p className="ticket__fault" role="alert">{error}</p>}

                <button
                    type="submit"
                    className="act act--lead ticket__submit animate-button-fade"
                    disabled={submitBlocked}> Register </button>
            </form>

            <p className="ticket__switch animate-footer-fade">Already have an account? <Link to={"/login"}>Login</Link></p>
        </div>
    </main>
  )
}

export default Register
