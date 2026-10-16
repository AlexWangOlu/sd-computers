# sd-computers 简体中文汉化：术语表 + 硬规则

本文件是所有翻译单元的唯一权威。凡与本表冲突的直觉译法，以本表为准。

## 一、绝对规则

1. **只翻译"值"，绝不改键名、结构、缩进、键顺序**。输出的 JSON 必须与输入 JSON 的键集合逐字一致。
2. **占位符原样保留**：`%s` `%d` `%%` `${...}`。数量、顺序都不能变（`%s` 的位置决定了参数插入点）。
3. **转义原样保留**：`\n`（真换行）留在原处，不要替换为空格；不要引入新的转义。
4. **不翻译下列内容（照抄）**：
   - 品牌/产品名：`FiveM` `SD OS Pro` `SD OS Harbor` `SD Desktop` `sd-phone` `sd-tablet` `sd-banking` `Renewed-Banking` `Qbox` `QBCore` `ESX` `ox_lib` `ox_target` `ox_inventory` `oxmysql`
   - GTA 内品牌：`Weazel News`(可作"威泽尔新闻")、`Fleeca`、`Maze Bank`、`LSPD`、`MRPD`、`LSIA`
   - 命令/路径/主机名/文件名/邮箱地址/域名/URL/键盘键名：`cmd.exe` `C:\` `/home` `LSPD-MRPD-FD01` `user@mail.ls` `Backspace` `Enter` `Esc` `Tab` `Ctrl` `Alt` `Shift` `SPACE` `F5` `WASD`
   - 代码类字面量、`true/false/nil`、颜色值、单位符号 `%` `$` `MB` `GB` `ms` `MHz`
   - 表情/图形符号：`·` `–` `…` `×` `⏻` `▲▼◀▶` 等保持
5. **中文标点**：正文用全角 `，。：？！、`；短标签、按钮、菜单项、标题**不加句末句号**；完整句子句末加 `。`
6. **人称**：对玩家一律用「你」，不用「您」。
7. **简洁**：按钮/标签优先 2-4 字。不要出现"进行…操作"这类冗词。中文尽量不超过原文视觉宽度。
8. **不加英文原文**，不加括号注释。

## 二、OS 与界面术语（统一用词）

| 英文 | 中文 |
|---|---|
| desktop | 桌面 |
| taskbar | 任务栏 |
| dock | 程序坞 |
| menu bar | 菜单栏 |
| window | 窗口 |
| title bar | 标题栏 |
| minimize / maximize / zoom | 最小化 / 最大化 / 缩放 |
| restore | 还原 |
| lock screen | 锁屏 |
| sign in / log on | 登录 |
| sign out / log off | 注销 |
| shut down | 关机 |
| restart | 重启 |
| sleep | 睡眠 |
| wallpaper | 壁纸 |
| accent | 强调色 |
| theme (light/dark) | 主题（浅色/深色） |
| appearance | 外观 |
| notification | 通知 |
| toast | 提示条 |
| settings / preferences | 设置 / 偏好设置 |
| shortcut | 快捷键 |
| clipboard | 剪贴板 |
| account | 账户 |
| password | 密码 |
| PIN | PIN |
| username | 用户名 |
| hostname | 主机名 |
| workgroup | 工作组 |
| boot / boot sequence | 启动 / 启动序列 |
| session | 会话 |
| app / application | 应用 / 应用程序 |
| launch / open / quit / close | 启动 / 打开 / 退出 / 关闭 |
| on duty / off duty | 在岗 / 下班 |
| volume / mute | 音量 / 静音 |
| battery | 电池 |
| Wi-Fi | Wi-Fi |
| recycle bin / trash | 回收站（Windows 风格）/ 废纸篓（macOS 风格） |
| keyboard shortcuts | 键盘快捷键 |
| About This Computer | 关于本机 |
| Show Desktop | 显示桌面 |
| Select All | 全选 |
| Undo / Redo | 撤销 / 重做 |
| Cut / Copy / Paste | 剪切 / 拷贝 / 粘贴 |

## 三、App 名（三个皮肤共用的应用注册名，config 与 locale 都用这一套）

风格取向：`mac` 皮肤跟 macOS 中文命名，`retro`/`modern` 用大众习惯的 Windows 中文命名；两者冲突时取「更短、更通用」的那个，并在同一节内保持一致。

| 英文 | 中文 |
|---|---|
| Mail | 邮件 |
| Event Viewer | 事件查看器 |
| Command Prompt | 命令提示符 |
| Business Manager | 经营管理 |
| Notepad | 记事本 |
| Calculator | 计算器 |
| Settings | 设置 |
| Files | 文件 |
| Browser | 浏览器 |
| Bank | 银行 |
| Games | 游戏 |
| Company Board | 公司公告板 |
| Security Cameras | 安防监控 |
| Photos | 照片 |
| Messages | 信息 |
| Notes | 备忘录 |
| Contacts | 通讯录 |
| Phone Link | 手机连接 |
| Finder | 访达 |
| Safari | Safari |
| Terminal | 终端 |
| App Store | App Store |
| System Settings | 系统设置 |
| Launchpad | 启动台 |
| Spotlight / Search | 聚焦搜索 / 搜索 |
| Trash | 废纸篓 |

## 四、业务术语（脚本玩法）

| 英文 | 中文 |
|---|---|
| computer | 电脑 |
| printer | 打印机 |
| printout | 打印件 |
| paper / sheet | 纸张 / 单页 |
| tray | 纸盘 |
| print spooler | 打印后台处理程序 |
| A4 | A4 |
| sign a page | 签批（在纸上签名） |
| camera / security camera | 摄像头 / 安防监控 |
| camera feed | 监控画面 |
| mailbox | 邮箱 |
| address | 地址 |
| compose | 写邮件 |
| recipient | 收件人 |
| subject | 主题 |
| inbox / sent / drafts / trash | 收件箱 / 已发送 / 草稿 / 废纸篓 |
| attachment | 附件 |
| unread | 未读 |
| balance | 余额 |
| statement | 对账单 |
| transaction | 交易 |
| deposit / withdraw | 存入 / 支取 |
| account number | 账号 |
| job / grade | 职业 / 职级 |
| employees | 员工 |
| hire / fire | 雇佣 / 解雇 |
| boss | 老板 |
| society funds | 公司资金 |
| announcement | 公告 |
| notice board | 公告板 |
| on duty | 在岗 |
| hack / breach | 入侵 |
| hack target | 入侵目标 |
| minigame | 迷你游戏 |
| firewall | 防火墙 |
| cipher | 密码破译 |
| payload | 载荷 |
| inject | 注入 |
| trace | 追踪 |
| signature / evidence (proof of hack) | 痕迹 / 证据 |
| terminal | 终端 |
| command | 命令 |
| directory / folder | 目录 / 文件夹 |
| file | 文件 |
| document | 文档 |
| audit log / System Logs | 审核日志 / 系统日志 |
| retention | 保留时间 |
| rate limit | 频率限制 |
| lockout | 锁定 |
| admin panel | 管理面板 |
| prop | 道具 |
| placement | 放置 |
| gizmo | 操作器 |
| style (modern/retro/mac) | 外观（现代/复古/mac 保持键值不翻） |
| PIN protected | PIN 保护 |

## 五、GTA 地名（用 GTA5 官方中文译名）

| 英文 | 中文 |
|---|---|
| Los Santos | 洛圣都 |
| San Andreas | 圣安地列斯 |
| Mission Row | 米申罗 |
| Legion Square | 军团广场 |
| Vespucci | 维斯普奇 |
| Vinewood | 好麦坞 |
| Paleto Bay | 佩里托湾 |
| Sandy Shores | 沙丘海岸 |
| Grapeseed | 葡萄籽 |
| Mirror Park | 镜湖公园 |
| Del Perro | 德尔佩罗 |
| Rockford Hills | 罗克福德山 |
| La Mesa | 拉梅萨 |
| Strawberry | 斯卓贝里 |
| Downtown | 市中心 |
| Little Seoul | 小首尔 |
| Morningwood | 晨林 |
| Rockford | 罗克福德 |
| Hawick | 霍威克 |
| Alta | 阿尔塔 |
| Burton | 伯顿 |
| Richman | 里奇曼 |
| Chumash | 楚马什 |
| Zancudo | 赞库多 |
| Harmony | 哈莫尼 |
| LSIA | 洛圣都国际机场 |
| MRPD | 米申罗警局 |

## 六、输出与自检

1. 输入：`_zh_work/src/<unit>.json`（英文，嵌套）；输出：`_zh_work/out/<unit>.json`（同结构中文）。
2. 用 Write 工具直接写文件（不要用 shell 的 echo/heredoc，反斜杠会被吞）。
3. 写完必须自检并在回复里贴出结果：

```
cd /d/FIVEMDEV/sd-computers && py -c "
import json,sys,re
src=json.load(open('_zh_work/src/<unit>.json',encoding='utf-8'))
out=json.load(open('_zh_work/out/<unit>.json',encoding='utf-8'))
def walk(d,p=''):
    for k,v in d.items():
        q=f'{p}.{k}' if p else k
        yield (q,v) if not isinstance(v,dict) else from walk
"
```
（自检至少覆盖：键集合完全一致、无空值、占位符集合一致、值里没有残留的整句英文）
