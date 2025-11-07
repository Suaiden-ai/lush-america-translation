import './lib/i18n'; // Importar configuração do i18n PRIMEIRO
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './hooks/useAuth';
import { I18nProvider } from './contexts/I18nContext';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import './utils/diagnoseUserScript'; // Carregar funções de diagnóstico no console

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>
);
