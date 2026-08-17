import { RouterProvider } from "react-router";
import { router } from "./app.routes"; // if there is any error show then attach the .jsx in the end of routes
import { AuthProvider } from "./features/auth/auth.context";
import {InterviewProvider} from "./features/interview/interview.context"

function App() {
  

  return (
    /* we have wrap whole application in AuthProvider */
    <AuthProvider>
      <InterviewProvider>
        <RouterProvider router={router} />
      </InterviewProvider>
    </AuthProvider>
  )
}

export default App
