import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from "./App";
import Landing from "./Landing";
import "./style.css";
const url = import.meta.env.VITE_CONVEX_URL;
const isLanding = window.location.pathname !== "/app";
const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    {isLanding ? (
      <Landing />
    ) : url ? (
      <ConvexAuthProvider client={new ConvexReactClient(url)}>
        <App connected />
      </ConvexAuthProvider>
    ) : (
      <App connected={false} />
    )}
  </React.StrictMode>,
);
