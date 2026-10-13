import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './styles.css';
import './styles/retro.css';
import './styles/mac.css';
import './styles/sites.css';

// No <StrictMode>: its dev-only double mount would run HackRunner's "unmounted mid-game = fail"
// cleanup and void every hack run in the browser dev server. Production builds never double-mount.
createRoot(document.getElementById('root')!).render(<App />);
