import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/noto-sans-sc';
import App from './App';
import './styles.css';

// The /computeradmin panel: its own page (admin.html), held in an iframe by the OS page
// (src/AdminFrame.tsx) so this stylesheet and the OS's never meet. Built from sd-bombs' admin UI
// (itself sd-scooters'): same shell, same components, same placement HUD.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
