import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './app/globals.css';
import { TradingApp } from './components/trading/trading-app';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TradingApp />
  </StrictMode>,
);
