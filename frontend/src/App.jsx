import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Lista from './pages/Lista';
import Factura from './pages/Factura';
import Verify from './pages/Verify';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Lista />} />
        <Route path="/factura/:id" element={<Factura />} />
        <Route path="/verify/:codigo" element={<Verify />} />
      </Routes>
    </BrowserRouter>
  );
}
