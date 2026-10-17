// The shell's own strings. The apps' strings stay in locales/cn.json; only the chrome around them
// lives here, in the same zh/en pair the ported shell was written with.

export type HarborLanguage = 'zh-CN' | 'en-US';

const zh = {
  menu: {
    aboutMac: '关于本机', settings: '系统设置...', forceQuitAll: '强制退出所有 App', sleep: '睡眠',
    restart: '重新启动...', lockScreen: '锁定屏幕', newLaunchpad: '打开启动台', closeWindow: '关闭窗口',
    minimize: '最小化', maximize: '缩放', maximizeDisabled: '缩放不可用', print: '打印...', undo: '撤销',
    redo: '重做', cut: '剪切', copy: '复制', paste: '粘贴', selectAll: '全选', showDesktop: '显示桌面',
    openSpotlight: '打开聚焦搜索', noWindows: '没有打开的窗口', minimizeAll: '全部最小化',
    computerHelp: '电脑使用手册', keyboardShortcuts: '键盘快捷键',
    aboutApp: (name: string) => `关于“${name}”`, hideApp: (name: string) => `隐藏“${name}”`,
    quitApp: (name: string) => `退出“${name}”`,
    file: '文件', edit: '编辑', view: '显示', window: '窗口', help: '帮助',
    devices: '设备', networks: '网络', bluetoothSettings: '蓝牙设置...', wifiSettings: '无线局域网设置...',
    batterySettings: '电池设置...', turnBluetoothOn: '打开蓝牙', turnBluetoothOff: '关闭蓝牙',
    turnWifiOn: '打开无线局域网', turnWifiOff: '关闭无线局域网', lowPowerMode: '低电量模式',
    battery: '电池', powerSource: '电源', powerAdapter: '电源适配器', controlCenter: '控制中心',
    offline: '离线', systemMenu: '系统菜单',
  },
  system: {
    computerUser: '电脑用户', trash: '废纸篓', application: '应用程序', app: 'App', note: '备忘录',
    bookmark: '书签', setting: '设置', noResults: (q: string) => `未找到“${q}”`, spotlightSearch: '聚焦搜索',
    apps: '应用程序', files: '文件', web: '网页', systemSettings: '系统设置',
    noNewNotifications: '没有新通知', notificationEmpty: '来自 App 的通知会显示在这里。',
    notifications: '通知', launchpad: '启动台', searchApps: '搜索应用',
  },
  lock: {
    clickToLogin: '点按以登录', back: '返回锁定屏幕', pinHint: '输入 PIN 码解锁', noPinHint: '按 Enter 登录',
    pin: 'PIN 码', unlock: '解锁', login: '登录', retry: (s: number) => `${s} 秒后再试`,
    locked: '尝试次数过多，请稍后再试。', failed: 'PIN 码不正确，请重试。',
  },
  controlCenter: {
    network: '电脑网络', contactsOnly: '仅联系人', focus: '专注模式', screen: '屏幕镜像',
    light: '浅色', dark: '深色', display: '显示器', sound: '声音', notPlaying: '未在播放',
    noMedia: '当前没有活跃的媒体 App',
  },
  common: {
    search: '搜索', on: '打开', off: '关闭', cancel: '取消', add: '添加', close: '关闭', delete: '删除',
    unavailable: '不可用', connected: '已连接', settings: '设置', manage: '管理', none: '无',
    online: '在线', disabled: '已停用', enabled: '已启用', loading: '正在载入...', clear: '清除',
  },
  settings: {
    search: '搜索', wifi: '无线局域网', bluetooth: '蓝牙', battery: '电池', notifications: '通知',
    sound: '声音', focus: '专注模式', general: '通用', appearance: '外观', privacy: '隐私与安全性',
    desktopDock: '桌面与程序坞', displays: '显示器', wallpaper: '墙纸', about: '关于本机',
    languageRegion: '语言与地区', light: '浅色', dark: '深色', reducedMotion: '减弱动态效果',
    dockMagnification: '放大', brightness: '亮度', autoHideDock: '自动隐藏和显示程序坞',
  },
  finder: { file: '文件', folder: '文件夹' },
  notes: { newNote: '新备忘录', noText: '无附加文本' },
  weather: {
    city: '洛圣都', sunny: '晴', clear: '晴朗', partlyCloudy: '局部多云', cloudy: '多云', foggy: '有雾',
    drizzle: '毛毛雨', rain: '有雨', snow: '下雪', showers: '阵雨', snowShowers: '阵雪', thunderstorm: '雷暴',
    high: '最高', low: '最低', sunset: '日落', sunrise: '日出',
  },
  help: {
    title: '电脑使用手册',
    body: '从程序坞或启动台打开应用。按 Ctrl+K 打开聚焦搜索；Esc 起立离开这台电脑；窗口右上角可以最小化、缩放或关闭。',
    shortcuts: '键盘快捷键',
    tip: '提示：Ctrl 与 ⌘（Command）在本机通用。',
    keys: {
      spotlight: '打开聚焦搜索', leave: '起立离开电脑', closeWindow: '关闭当前窗口', lock: '锁定屏幕',
    },
  },
};

type Dict = typeof zh;

const en: Dict = {
  menu: {
    aboutMac: 'About This Mac', settings: 'System Settings…', forceQuitAll: 'Force Quit All', sleep: 'Sleep',
    restart: 'Restart…', lockScreen: 'Lock Screen', newLaunchpad: 'Open Launchpad', closeWindow: 'Close Window',
    minimize: 'Minimize', maximize: 'Zoom', maximizeDisabled: 'Zoom unavailable', print: 'Print…', undo: 'Undo',
    redo: 'Redo', cut: 'Cut', copy: 'Copy', paste: 'Paste', selectAll: 'Select All', showDesktop: 'Show Desktop',
    openSpotlight: 'Open Spotlight', noWindows: 'No Windows', minimizeAll: 'Minimize All',
    computerHelp: 'Computer Help', keyboardShortcuts: 'Keyboard Shortcuts',
    aboutApp: (name: string) => `About ${name}`, hideApp: (name: string) => `Hide ${name}`,
    quitApp: (name: string) => `Quit ${name}`,
    file: 'File', edit: 'Edit', view: 'View', window: 'Window', help: 'Help',
    devices: 'Devices', networks: 'Networks', bluetoothSettings: 'Bluetooth Settings…',
    wifiSettings: 'Wi-Fi Settings…', batterySettings: 'Battery Settings…',
    turnBluetoothOn: 'Turn Bluetooth On', turnBluetoothOff: 'Turn Bluetooth Off',
    turnWifiOn: 'Turn Wi-Fi On', turnWifiOff: 'Turn Wi-Fi Off', lowPowerMode: 'Low Power Mode',
    battery: 'Battery', powerSource: 'Power Source', powerAdapter: 'Power Adapter',
    controlCenter: 'Control Center', offline: 'Offline', systemMenu: 'System Menu',
  },
  system: {
    computerUser: 'Computer User', trash: 'Trash', application: 'Application', app: 'App', note: 'Note',
    bookmark: 'Bookmark', setting: 'Setting', noResults: (q: string) => `No results for “${q}”`,
    spotlightSearch: 'Spotlight Search', apps: 'Apps', files: 'Files', web: 'Web',
    systemSettings: 'System Settings', noNewNotifications: 'No New Notifications',
    notificationEmpty: 'Notifications from your apps will show here.',
    notifications: 'Notifications', launchpad: 'Launchpad', searchApps: 'Search Apps',
  },
  lock: {
    clickToLogin: 'Click to log in', back: 'Back to lock screen', pinHint: 'Enter your PIN', noPinHint: 'Press Enter to sign in',
    pin: 'PIN', unlock: 'Unlock', login: 'Sign In', retry: (s: number) => `Try again in ${s}s`,
    locked: 'Too many attempts. Try again later.', failed: 'Incorrect PIN. Try again.',
  },
  controlCenter: {
    network: 'Computer Network', contactsOnly: 'Contacts Only', focus: 'Focus', screen: 'Screen Mirroring',
    light: 'Light', dark: 'Dark', display: 'Display', sound: 'Sound', notPlaying: 'Not Playing',
    noMedia: 'No active media app',
  },
  common: {
    search: 'Search', on: 'On', off: 'Off', cancel: 'Cancel', add: 'Add', close: 'Close', delete: 'Delete',
    unavailable: 'Unavailable', connected: 'Connected', settings: 'Settings', manage: 'Manage', none: 'None',
    online: 'Online', disabled: 'Disabled', enabled: 'Enabled', loading: 'Loading…', clear: 'Clear',
  },
  settings: {
    search: 'Search', wifi: 'Wi-Fi', bluetooth: 'Bluetooth', battery: 'Battery', notifications: 'Notifications',
    sound: 'Sound', focus: 'Focus', general: 'General', appearance: 'Appearance', privacy: 'Privacy & Security',
    desktopDock: 'Desktop & Dock', displays: 'Displays', wallpaper: 'Wallpaper', about: 'About',
    languageRegion: 'Language & Region', light: 'Light', dark: 'Dark', reducedMotion: 'Reduce Motion',
    dockMagnification: 'Magnification', brightness: 'Brightness', autoHideDock: 'Automatically hide and show the Dock',
  },
  finder: { file: 'File', folder: 'Folder' },
  notes: { newNote: 'New Note', noText: 'No additional text' },
  weather: {
    city: 'Los Santos', sunny: 'Sunny', clear: 'Clear', partlyCloudy: 'Partly Cloudy', cloudy: 'Cloudy',
    foggy: 'Foggy', drizzle: 'Drizzle', rain: 'Rain', snow: 'Snow', showers: 'Showers', snowShowers: 'Snow Showers',
    thunderstorm: 'Thunderstorm', high: 'H', low: 'L', sunset: 'Sunset', sunrise: 'Sunrise',
  },
  help: {
    title: 'Computer Help',
    body: 'Open apps from the Dock or Launchpad. Press Ctrl+K for Spotlight; Esc stands you up; the window buttons minimise, zoom or close.',
    shortcuts: 'Keyboard Shortcuts',
    tip: 'Tip: Ctrl and ⌘ (Command) work the same here.',
    keys: {
      spotlight: 'Open Spotlight', leave: 'Stand up and leave the computer', closeWindow: 'Close the focused window', lock: 'Lock Screen',
    },
  },
};

export const tFor = (language: HarborLanguage): Dict => (language === 'en-US' ? en : zh);

export const languageOf = (isChinese: boolean): HarborLanguage => (isChinese ? 'zh-CN' : 'en-US');

/** App names the shell itself knows (the apps' own labels arrive already localized). */
const APP_NAMES: Record<string, { zh: string; en: string }> = {
  finder: { zh: '访达', en: 'Finder' },
  launchpad: { zh: '启动台', en: 'Launchpad' },
  appstore: { zh: 'App Store', en: 'App Store' },
  mail: { zh: '邮件', en: 'Mail' },
  files: { zh: '文件', en: 'Files' },
  browser: { zh: '浏览器', en: 'Browser' },
  notes: { zh: '备忘录', en: 'Notes' },
  settings: { zh: '设置', en: 'Settings' },
  calculator: { zh: '计算器', en: 'Calculator' },
  cmd: { zh: '命令提示符', en: 'Command Prompt' },
  notepad: { zh: '记事本', en: 'Notepad' },
};

export const translateAppName = (id: string, language: HarborLanguage, fallback: string): string => {
  const known = APP_NAMES[id];
  if (!known) return fallback;
  return language === 'en-US' ? known.en : known.zh;
};

export const formatSystemDate = (d: Date, language: HarborLanguage, opts: Intl.DateTimeFormatOptions): string =>
  d.toLocaleDateString(language, opts);

export const formatSystemTime = (d: Date, language: HarborLanguage, opts: Intl.DateTimeFormatOptions = {}): string =>
  d.toLocaleTimeString(language, { hour: 'numeric', minute: '2-digit', ...opts });
