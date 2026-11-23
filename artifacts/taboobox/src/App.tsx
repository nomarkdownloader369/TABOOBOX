import { useState } from "react";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";

function App() {
  const [router] = useState(() => getRouter());
  return <RouterProvider router={router} />;
}

export default App;
