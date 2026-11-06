# 使用指南

## 开发

进入现有 TouchUI 源码目录，该目录应包含 `app.ui`、`main.js` 及项目原有页面、组件和资源：

```powershell
cd D:\projects\my-app
tui dev
```

默认仅监听本机 `127.0.0.1`，从 9090 开始选择可用端口，以终端输出为准。源码修改后自动重新编译，按 Ctrl+C 停止。

```powershell
tui dev --port 9091
tui dev --api-url http://127.0.0.1:8190/home_api
```

默认读取 `app.ui` 中的 `networkBaseUrl`，通过 `/__api` 同源代理转发 HTTP/HTTPS 接口；后端服务需单独启动。`--api-url` 仅覆盖本次运行且持续作用于重新编译，不修改源码。修改默认接口地址后需重启命令。

命令从当前目录向上查找最近的项目，不会自动进入下级 `app_code`；可显式指定：

```powershell
tui dev --project-dir D:\projects\my-app
```

## 构建

```powershell
tui build
tui build --api-url https://example.com/api/home_api
tui build --output-dir D:\release\my-app
```

默认输出到项目 `dist`。相对路径以项目目录为基准；项目内部只允许输出到 `dist`，其他输出需使用项目外专用目录。禁止输出到源码、工具目录及其上级，禁止使用符号链接或目录连接作为输出路径。

编译成功后替换输出目录，清除旧产物；失败返回非零退出码并保留上次成功产物。输出目录不要混放其他文件。

产物为网页/H5，需通过 HTTP/HTTPS 服务访问，不生成 APK/IPA，不自动部署。生产包使用实际接口地址，不携带开发代理；`--api-url` 不修改业务代码中的 CAS/SSO 登录跳转等独立地址。

## 参数

| 参数 | 适用命令 | 用途 |
| --- | --- | --- |
| `--project-dir <目录>` | dev、build | 项目查找起点，默认当前目录 |
| `--api-url <地址>` | dev、build | 本次使用的完整 HTTP/HTTPS 接口地址 |
| `--port <端口>` | dev | 1～65535，默认从 9090 选择可用端口 |
| `--output-dir <目录>` | build | 默认项目 dist，或项目外专用产物目录 |
| `--help`、`-h` | 所有 | 显示帮助，无参数时也显示帮助 |
| `--version`、`-v` | 所有 | 显示版本 |

## 离线使用

已有 npm 的电脑可从下载好的归档安装：

```powershell
npm install -g .\touchui-cli-1.0.1.tgz --offline --ignore-scripts --no-audit --no-fund
```

完整便携版 ZIP 解压到固定目录后，执行该目录的 `install.ps1`，将工具加入当前用户 PATH，再重新打开终端。便携版无需预装 Node/npm；也可直接调用目录内的 `tui.cmd`。本地归档和便携 ZIP 由维护者另外分发，npm 安装不需要它们。

## 常见问题

| 现象 | 处理 |
| --- | --- |
| 找不到 `tui` | 重新打开终端，检查全局 npm 路径或便携目录是否在 PATH |
| PowerShell 拒绝执行 `tui.ps1` | 使用 `tui.cmd dev` 或 `tui.cmd build` |
| 找不到项目 | 进入源码目录，或指定 `--project-dir` |
| 找不到运行时、编译器或编译依赖 | 重新安装完整工具包 |
| 页面能打开但接口失败 | 检查后端服务与接口地址 |
| 部署后仍请求本机接口 | 指定目标环境 `--api-url` 重新构建，并检查独立登录地址 |

编译缓存位于 `%TEMP%\touchui-cli\<项目路径摘要>\<本次运行目录>`，正常退出及 Ctrl+C 后清理。本工具不使用项目 `.touchui`；强制结束进程可能留下临时缓存，停止全部 `tui` 进程后可清理。

## WindTerm

使用 Shell/CMD 会话，工作目录填写 TouchUI 源码目录，例如 `D:\projects\my-app`；启动后执行命令填写 `tui.cmd dev\r`，末尾 `\r` 表示模拟回车。无需设置 VSCode 插件路径或 `TOUCHUI_PACK_DIR`。
