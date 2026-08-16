// axios help to communicate to backend to frontend 
import axios from "axios";

/* there lot of repeat code so we can make a axios.create to remove repeat code */

const api = axios.create({
    baseURL: "http://localhost:3000",
    /* it's show that server should read the cookies which user has created */
    withCredentials: true
})

export async function register({username, email, password}){

    try{
        /* this code help to interact with backend to frontend */
        const response = await api.post('/api/auth/register',{
            username, email, password
        })

        return response.data

    } catch (err){

        console.log(err);

    }
}

export async function login({email, password}){

    try{

        const response = await api.post("/api/auth/login",{
            email, password
        })

        return response.data

    }catch (err){

        console.log(err)

    }
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