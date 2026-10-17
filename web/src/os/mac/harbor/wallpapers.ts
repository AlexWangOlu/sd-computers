import starry from './assets/wallpapers/mojave-starry.jpg';
import desertNight from './assets/wallpapers/mojave-desert-night.jpg';
import multicolor from './assets/wallpapers/mojave-multicolor.jpg';
import purpleFlow from './assets/wallpapers/mojave-purple-flow.jpg';
import purpleGlass from './assets/wallpapers/mojave-purple-glass.jpg';
import chroma from './assets/wallpapers/mojave-chroma.jpg';
import sonoma from './assets/wallpapers/sonoma.jpg';

// The mac style's photographic wallpapers (compressed to 2560px for the resource). Wallpaper ids
// still come from configs/shared/desktop.lua, so the Settings app keeps listing what the server
// offers; an id with no image here falls back to sd's own drawn wallpaper.
export const HARBOR_WALLPAPERS = [
  { id: 'mojave-starry', label: '星空', src: starry },
  { id: 'mojave-desert-night', label: '沙漠之夜', src: desertNight },
  { id: 'mojave-multicolor', label: '多彩', src: multicolor },
  { id: 'mojave-purple-flow', label: '紫色流光', src: purpleFlow },
  { id: 'mojave-purple-glass', label: '紫晶', src: purpleGlass },
  { id: 'mojave-chroma', label: '霓虹', src: chroma },
  { id: 'sonoma', label: '索诺玛', src: sonoma },
] as const;

const BY_ID: Record<string, string> = Object.fromEntries(HARBOR_WALLPAPERS.map(w => [w.id, w.src]));

export const resolveWallpaper = (id: string | undefined): string | undefined => (id ? BY_ID[id] : undefined);
