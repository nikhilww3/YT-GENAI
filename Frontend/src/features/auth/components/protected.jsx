import { useAuth } from "../hooks/useAuth";
import { Navigate } from "react-router";
import React from 'react'

const Protected = ({children}) => {
    const {loading, user} = useAuth()

    if(loading){
        return (
            <main className="depot depot--working">
                <div className="blind" aria-live="polite">
                    <p className="blind__rule">Checking your ticket</p>
                    <p className="blind__course">AT THE GATE</p>
                </div>
            </main>
        )
    }

    if(!user){
        return <Navigate to={'/login'} />
    }

  return children
}

export default Protected