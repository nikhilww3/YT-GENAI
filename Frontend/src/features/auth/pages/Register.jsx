import React, { useState } from 'react'
import "../auth.form.scss";
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../hooks/useAuth';


const Register = () => {

    const navigate = useNavigate()
    const [username, setUsername] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")


    const {loading, error, handleRegister} = useAuth()

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
    <main className="depot depot--gate">
        <div className="ticket">
            <div className="ticket__window">
                <span className="blind__code">TIX 02</span>
                <h1 className="ticket__course">NEW TRAVELLER</h1>
            </div>
            <p className="ticket__note">Register to start printing interviews.</p>

            <form className="ticket__form" onSubmit={handleSumbit}>
                <div className="ticket__field">
                    <label className="ticket__label" htmlFor="username">Username</label>
                    <input
                        className="ticket__input"
                        onChange={(e) => {setUsername(e.target.value)}}
                        type="text" id="username" name='username' placeholder='Enter username' required/>
                </div>
                <div className="ticket__field">
                    <label className="ticket__label" htmlFor="email">Email</label>
                    <input
                        className="ticket__input"
                        onChange={(e) => {setEmail(e.target.value)}}
                        type="email" id="email" name='email' placeholder='Enter email address' required/>
                </div>
                <div className="ticket__field">
                    <label className="ticket__label" htmlFor="password">Password</label>
                    <input
                        className="ticket__input"
                        onChange={(e) => {setPassword(e.target.value)}}
                        type="password" id="password" name='password' placeholder='Password' required/>
                </div>

                {error && <p className="ticket__fault" role="alert">{error}</p>}

                <button type="submit" className="act act--lead ticket__submit"> Register </button>
            </form>

            <p className="ticket__switch">Already have an account? <Link to={"/login"}>Login</Link></p>
        </div>
    </main>
  )
}

export default Register
