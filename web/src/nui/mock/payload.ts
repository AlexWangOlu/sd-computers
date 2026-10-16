import type { OpenPayload, OsStyle } from '@/types';
import { withPhoneLink } from './phonelink';

/** What session.open returns for the MRPD front desk, as a police boss - the browser dev payload. */
export const mockPayload: OpenPayload = {
  computer: {
    id: 'mrpd_frontdesk',
    label: '米申罗警局前台',
    hostname: 'LSPD-MRPD-FD01',
    ip: '10.42.17.88',
    instance: 'mrpd_frontdesk',
    style: 'modern',
    requiresPin: true,
    lockedFor: 0,
    apps: [
      { id: 'mail', label: '邮件', w: 1060, h: 660 },
      { id: 'messages', label: '信息', w: 920, h: 620 },
      { id: 'notes', label: '备忘录', w: 860, h: 580 },
      { id: 'boss', label: '经营管理', w: 1100, h: 680 },
      { id: 'logs', label: '事件查看器', w: 1040, h: 620 },
      { id: 'cmd', label: '命令提示符', w: 900, h: 540 },
      { id: 'notepad', label: '记事本', w: 820, h: 560 },
      { id: 'calculator', label: '计算器', w: 340, h: 520 },
      { id: 'files', label: '文件', w: 1180, h: 740 },
      { id: 'browser', label: '浏览器', w: 1100, h: 700 },
      { id: 'bank', label: '银行', w: 940, h: 640 },
      { id: 'board', label: '公司公告板', w: 940, h: 620 },
      { id: 'cameras', label: '安防监控', w: 900, h: 600 },
      { id: 'photos', label: '照片', w: 980, h: 640 },
      { id: 'contacts', label: '通讯录', w: 860, h: 600 },
      { id: 'phonelink', label: '手机连接', w: 620, h: 700 },
      { id: 'games', label: '游戏', w: 860, h: 640 },
      { id: 'settings', label: '设置', w: 900, h: 600 },
    ],
    pinned: ['mail', 'messages', 'browser', 'files', 'boss', 'cmd', 'logs', 'notepad'],
    desktopIcons: ['mail', 'messages', 'notes', 'files', 'browser', 'bank', 'board', 'boss', 'cameras', 'photos', 'contacts', 'phonelink', 'logs', 'cmd', 'notepad', 'calculator', 'games', 'settings'],
  },
  user: { name: 'Jessica Hale', initials: 'JH', job: 'LSPD' },
  desktop: {
    style: 'modern',
    monitor: false,
    sounds: true,
    osName: 'SD OS Pro',
    osBuild: '4.2.2610',
    boot: true,
    clock24: false,
    wallpapers: [
      { id: 'petals-dark', label: '花瓣（深色）' },
      { id: 'petals-light', label: '花瓣（浅色）' },
      { id: 'nebula', label: '星云' },
      { id: 'dusk', label: '黄昏' },
      { id: 'currents', label: '洋流' },
      { id: 'solid', label: '纯色' },
    ],
    accents: ['#4cc2ff', '#60cdff', '#7a7dff', '#c239b3', '#e74856', '#ff8c00', '#16c60c', '#00b7c3'],
    defaultWallpaper: 'petals-dark',
    defaultTheme: 'dark',
  },
  settings: {},
  hacks: {
    practice: true,
    defaultDifficulty: 'medium',
    games: {
      maze: { program: 'net-maze.exe', label: '网络迷宫' },
      capture: { program: 'node-grab.exe', label: '节点占领' },
      cipher: { program: 'cipher-lock.exe', label: '密码破译' },
      snake: { program: 'data-worm.exe', label: '数据蠕虫' },
      firewall: { program: 'fw-defense.exe', label: '防火墙防御' },
      evasion: { program: 'highway-evade.exe', label: '高速公路规避' },
      typing: { program: 'code-inject.exe', label: '代码注入' },
      signal: { program: 'sig-replay.exe', label: '信号重放' },
      pipe: { program: 'pipe-route.exe', label: '数据包路由' },
      breakout: { program: 'ice-break.exe', label: 'ICE 突破' },
    },
  },
  mail: { domain: 'lsmail.com', maxRecipients: 20, maxSubject: 200, maxBody: 10000, minPassword: 6, maxDisplayName: 40 },
};

/** Each style's desktop block, mirroring configs/shared/desktop.lua Styles. */
const STYLE_DESKTOP: Record<OsStyle, Partial<OpenPayload['desktop']>> = {
  modern: {},
  retro: {
    osName: 'SD Desktop',
    osBuild: '3.11',
    wallpapers: [
      { id: 'retro-teal', label: '青绿' },
      { id: 'retro-weave', label: '编织' },
      { id: 'retro-bricks', label: '砖块' },
      { id: 'retro-starfield', label: '星空' },
      { id: 'retro-navy', label: '午夜' },
    ],
    defaultWallpaper: 'retro-teal',
    accents: ['#000080', '#008080', '#800000', '#008000', '#800080', '#404040'],
    defaultTheme: 'light',
    monitor: true,
    sounds: true,
  },
  mac: {
    osName: 'SD OS Harbor',
    osBuild: '2.6',
    wallpapers: [
      { id: 'harbor-dunes', label: '沙丘' },
      { id: 'harbor-tide', label: '潮汐' },
      { id: 'harbor-aurora', label: '极光' },
      { id: 'harbor-graphite', label: '石墨' },
    ],
    defaultWallpaper: 'harbor-dunes',
    accents: ['#0a84ff', '#bf5af2', '#ff375f', '#ff9f0a', '#ffd60a', '#30d158', '#8e8e93'],
    defaultTheme: 'light',
  },
};

/**
 * The dev payload in a given style (browser: ?style=retro / ?style=mac), with the phone's apps on
 * it or not as the Phone Link mock has the machine (?phonelink=new: not linked yet).
 */
export function mockPayloadFor(style: OsStyle): OpenPayload {
  return withPhoneLink({
    ...mockPayload,
    computer: { ...mockPayload.computer, style },
    desktop: { ...mockPayload.desktop, ...STYLE_DESKTOP[style], style },
  });
}

/** The mock PIN for the browser dev payload's requiresPin lock screen. */
export const MOCK_PIN = '1031';
