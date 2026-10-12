import type { ComponentType } from 'react';
import type { Win, WinApp } from '@/store/os';
import Mail from './mail';
import EventViewer from './logs';
import CommandPrompt from './cmd';
import BusinessManager from './boss';
import Notepad from './notepad';
import Calculator from './calculator';
import Settings from './settings';
import Messages from './messages';
import Notes from './notes';
import HackWindow from './hack/HackWindow';

/** Props every app component receives: its own window (id, title, size, props...). */
export interface AppProps {
  win: Win;
}

/**
 * App id -> component. The ids are configs/shared/desktop.lua's Apps keys (plus 'hack', the
 * window Command Prompt spawns for a minigame). A new app needs an entry here AND in that config.
 * 'messages' and 'notes' only ever appear while the sd-phone link is live (the server installs them).
 */
export const APPS: Record<WinApp, ComponentType<AppProps>> = {
  mail: Mail,
  logs: EventViewer,
  cmd: CommandPrompt,
  boss: BusinessManager,
  notepad: Notepad,
  calculator: Calculator,
  settings: Settings,
  messages: Messages,
  notes: Notes,
  hack: HackWindow,
};
