import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import Lista from './pages/Lista';
import Factura from './pages/Factura';
import Verify from './pages/Verify';
import NuevaFactura from './pages/NuevaFactura';
import EditarFactura from './pages/EditarFactura';

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Lista />} />
          <Route path="/nueva" element={<NuevaFactura />} />
          <Route path="/factura/:id" element={<Factura />} />
          <Route path="/factura/:id/editar" element={<EditarFactura />} />
          <Route path="/verify/:codigo" element={<Verify />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
