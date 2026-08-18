/* if we login in our page then reload we back to initial so to handle this problem  we use useEffect function and use the user imformation for getMe */
import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../auth.context";
import { login, register, logout, getMe } from "../services/auth.api";


export const useAuth = () => {
    const context = useContext(AuthContext)
    const {user, setUser, loading, setLoading} = context
    // Local to the hook, not the shared context — same reasoning as
    // useInterview's `error`: this reports the outcome of one login/register
    // attempt, not app-wide state the whole tree needs to react to.
    const [error, setError] = useState(null)

    const handleLogin = async ({email, password}) =>{
        // the loading state show code we type in hook layer
        setLoading(true)
        setError(null)
        // the login function will call api in auth.api.js file and which return data in response.data
        try{
            const data = await login({email, password})
            // in the data we also share the user in backend when we call login api
            setUser(data.user)
            return data.user
        }catch (err){
            setError(err.response?.data?.message || "Could not sign in. Check your connection and try again.")
            return null
        }finally{
            setLoading(false)
        }
    }

    const handleRegister = async ({username, email, password}) =>{
        setLoading(true)
        setError(null)
        // get the data with function call to api
        try{
            const data = await register({username, email, password})
            setUser(data.user)
            return data.user
        }catch (err){
            setError(err.response?.data?.message || "Could not register. Check your connection and try again.")
            return null
        }finally{
            setLoading(false)
        }
    }

    const handleLogout = async () =>{
        setLoading(true)
        try{
            const data = await logout()
            setUser(null)
        }catch (err){

        }finally{
            setLoading(false)
        }
    }

    useEffect(()=> {
        // now if we reload if we login then it's show homepage
        let holdTimeoutId
        const start = Date.now()
        // On localhost this check resolves in a few ms, so the "AT THE GATE"
        // loading screen (protected.jsx) would only flash for a frame and
        // read as a glitch rather than a designed moment. Holding it for at
        // least this long makes it register as intentional either way.
        const MIN_LOADING_MS = 800

        const getAndSetUser = async ()=>{
            try{
                const data = await getMe()
                // getMe returns undefined when the request fails, like a 401 when we are logged out
                setUser(data?.user ?? null)
            }catch (err){
                setUser(null)
            }finally{
                // this must always run, otherwise the app is stuck on the loading screen forever
                const remaining = MIN_LOADING_MS - (Date.now() - start)
                if (remaining > 0) {
                    holdTimeoutId = setTimeout(() => setLoading(false), remaining)
                } else {
                    setLoading(false)
                }
            }
        }

        getAndSetUser()

        return () => clearTimeout(holdTimeoutId)
    },[])

    return {user, loading, error, handleLogin, handleRegister, handleLogout}
}