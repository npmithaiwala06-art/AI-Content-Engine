import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/global.css";
import "./styles/time-picker.css";
import "./styles/system-controls.css";
import "./styles/approval-media.css";
import "./styles/local-ai.css";
import "./styles/official-access.css";
import "./styles/readiness.css";
import "./styles/video-preview.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
