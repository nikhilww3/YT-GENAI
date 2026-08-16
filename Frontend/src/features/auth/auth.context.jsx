/* this is a Global State Management in React using Context API,
the useState to manage local state inside provider,
if we login in our page then reload we back to initial so to handle this problem  we use useEffect function and use the user imformation for getMe, we can also use in useAuth function
*/

import { createContext, useState } from "react";
import { getMe } from "./services/auth.api";


// AuthContext use to create golbal state
export const AuthContext = createContext()

// the children is whatever components you what to warp 
export const AuthProvider = ({ children }) =>{
    
    const [user, setUser] = useState(null)
    // we initial use loading true to slove reload problem
    const [loading, setLoading] = useState(true)



    return (
        // this is where you share data golbally 
        <AuthContext.Provider value={{user, setUser, loading, setLoading}}>
            {children}
        </AuthContext.Provider>
    )
}