import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/noto-sans-sc'; // 中文：简繁通用，unicode-range 分片按需加载
import './styles.css';
import './styles/retro.css';
import './styles/mac.css';
import './styles/sites.css';
import './styles/games.css';
import './styles/richdoc.css';
import './styles/paper.css';

// No <StrictMode>: its dev-only double mount would run HackRunner's "unmounted mid-game = fail"
// cleanup and void every hack run in the browser dev server. Production builds never double-mount.
createRoot(document.getElementById('root')!).render(<App />);
