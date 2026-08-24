import React, {useState} from 'react';
import "../auth.form.scss";
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { ZeroFareMark, EyeIcon, EyeOffIcon } from '../../interview/components/icons.jsx';


const Login = () => {

    const {loading, error, handleLogin} = useAuth()
    const navigate = useNavigate()

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)


    const handleSumbit = async  (e) =>{
        e.preventDefault()
        const user = await handleLogin({email, password})
        if (user) navigate("/")

    }

    if(loading){
        return (
            <main className="depot depot--working">
                <div className="blind" aria-live="polite">
                    <p className="blind__rule">Checking your ticket</p>
                    <p className="blind__course">SIGNING IN</p>
                </div>
            </main>
        )
    }

  return (
    <main className="depot depot--gate">
        <div className="ticket">
            <div className="brandmark">
                <ZeroFareMark className="brandmark__icon" />
                <span className="brandmark__word">ZeroFare</span>
            </div>
            <div className="ticket__window">
                <span className="blind__code">ZFR 02</span>
                <h1 className="ticket__course">WELCOME BACK</h1>
            </div>
            <p className="ticket__note">Sign in to reach your saved reports.</p>

            <form className="ticket__form" onSubmit={handleSumbit}>
                <div className="ticket__field">
                    <label className="ticket__label" htmlFor="email">Email</label>
                    <input
                        className="ticket__input"
                        value={email}
                        onChange={(e) => {setEmail(e.target.value)}}
                        type="email" id="email" name='email' placeholder='Enter email address' required/>
                </div>
                <div className="ticket__field">
                    <label className="ticket__label" htmlFor="password">Password</label>
                    <div className="ticket__control">
                        <input
                            className="ticket__input ticket__input--secret"
                            value={password}
                            onChange={(e) => {setPassword(e.target.value)}}
                            type={showPassword ? "text" : "password"}
                            id="password" name='password' placeholder='Password' required/>
                        <button
                            type="button"
                            className="ticket__reveal"
                            onClick={() => setShowPassword((shown) => !shown)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            aria-pressed={showPassword}>
                            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                        </button>
                    </div>
                </div>

                {error && <p className="ticket__fault" role="alert">{error}</p>}

                <button type="submit" className="act act--lead ticket__submit">Sign in</button>
            </form>

            <p className="ticket__switch">Don't have an account? <Link to={"/register"}>Register</Link></p>
        </div>
    </main>
  )
}

export default Login
