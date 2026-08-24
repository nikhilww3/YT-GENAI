// axios help to communicate to backend to frontend 
import axios from "axios";

/* there lot of repeat code so we can make a axios.create to remove repeat code */

const api = axios.create({
    baseURL: "http://localhost:3000",
    /* it's show that server should read the cookies which user has created */
    withCredentials: true
})

export async function register({username, email, password}){

    /* this code help to interact with backend to frontend */
    // Errors intentionally propagate here (unlike login/logout below) — the
    // caller (useAuth) needs the real backend message (e.g. "Account already
    // exists") to show the user, not a silently-undefined response.
    const response = await api.post('/api/auth/register',{
        username, email, password
    })

    return response.data
}

export async function login({email, password}){

    // Same reasoning as register above: let the caller see the real error
    // (e.g. "Invalid email or password") instead of swallowing it here.
    const response = await api.post("/api/auth/login",{
        email, password
    })

    return response.data
}

export async function logout(){

    try{

        const response = await api.get("/api/auth/logout")
        return response.data

    }catch (err){

        console.log(err)

    }
}

export async function getMe(){
    try{

        const response = await api.get("/api/auth/get-me")
        return response.data

    }catch (err){

        console.log(err)

    }
}
export async function checkUsername(username){

    // Uses the shared `api` instance so this hits the same backend origin as
    // every other auth call. It previously hardcoded its own URL and drifted
    // to the wrong port, which made every username look taken.
    const response = await api.get("/api/auth/check-username", {
        params: { username }
    })

    return response.data
}
