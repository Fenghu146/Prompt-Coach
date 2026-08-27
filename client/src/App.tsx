import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout.tsx";
import { NewPrompt } from "./pages/NewPrompt.tsx";
import { CaseDetail } from "./pages/CaseDetail.tsx";
import { Library } from "./pages/Library.tsx";
import { Generate } from "./pages/Generate.tsx";
import { Settings } from "./pages/Settings.tsx";

export default function App(){
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<NewPrompt/>} />
          <Route path="/cases/:id" element={<CaseDetail/>} />
          <Route path="/library" element={<Library/>} />
          <Route path="/generate" element={<Generate/>} />
          <Route path="/settings" element={<Settings/>} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
