import { createBrowserRouter } from "react-router";
import Login from "./features/auth/pages/login";
import Register from "./features/auth/pages/Register";
import Protected from "./features/auth/components/protected";
import Home from "../src/features/interview/pages/Home"
import Interview from "./features/interview/pages/interview";



export const router = createBrowserRouter([
    {
        path: "/login",
        element: <Login/>
    },
    {
        path: "/register",
        element: <Register/>
    },{
        path: "/",
        // protected is ensure the user is login then it's show homepage
        element: <Protected><Home/></Protected>
    },{
        path:"/interview/:interviewId",
        element: <Protected><Interview/></Protected>
    }
])