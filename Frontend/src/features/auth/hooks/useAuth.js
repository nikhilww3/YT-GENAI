/* if we login in our page then reload we back to initial so to handle this problem  we use useEffect function and use the user imformation for getMe */
import { useContext, useEffect } from "react";
import { AuthContext } from "../auth.context";
import { login, register, logout, getMe } from "../services/auth.api";


export const useAuth = () => {
    const context = useContext(AuthContext)
    const {user, setUser, loading, setLoading} = context

    const handleLogin = async ({email, password}) =>{
        // the loading state show code we type in hook layer
        setLoading(true)
        // the login function will call api in auth.api.js file and which return data in response.data
        try{
            const data = await login({email, password})
            // in the data we also share the user in backend when we call login api
            setUser(data.user)
        }catch (err){

        }finally{
            setLoading(false)
        }
    }

    const handleRegister = async ({username, email, password}) =>{
        setLoading(true)
        // get the data with function call to api
        try{
            const data = await register({username, email, password})
            setUser(data.user)
        }catch (err){
            
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
        const getAndSetUser = async ()=>{
            try{
                const data = await getMe()
                // getMe returns undefined when the request fails, like a 401 when we are logged out
                setUser(data?.user ?? null)
            }catch (err){
                setUser(null)
            }finally{
                // this must always run, otherwise the app is stuck on the loading screen forever
                setLoading(false)
            }
        }

        getAndSetUser()

    },[])

    return {user, loading, handleLogin, handleRegister, handleLogout}
}