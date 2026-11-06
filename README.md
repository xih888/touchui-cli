# touchui-cli

[![npm 版本](https://img.shields.io/npm/v/touchui-cli.svg)](https://www.npmjs.com/package/touchui-cli)
[![支持平台](https://img.shields.io/badge/platform-Windows%20x64-blue)](https://github.com/xih888/touchui-cli#环境要求)

TouchUI 网页/H5 项目的独立开发与构建工具。安装一次，在项目中执行 `tui dev` 开发、`tui build` 打包。

[npm](https://www.npmjs.com/package/touchui-cli) · [使用指南](https://github.com/xih888/touchui-cli/blob/main/docs/usage.md) · [问题反馈](https://github.com/xih888/touchui-cli/issues) · [源码维护](https://github.com/xih888/touchui-cli/blob/main/docs/maintaining.md)

## 安装

```powershell
npm install -g touchui-cli --ignore-scripts
```

验证安装：

```powershell
tui --version
tui --help
```

## 快速开始

进入现有 TouchUI 源码目录，其中应有 `app.ui`、`main.js` 及项目原有页面和资源：

```powershell
cd D:\projects\my-app
tui dev
```

打开终端输出的本机地址，修改源码后自动重新编译；按 Ctrl+C 停止。

生成网页生产包：

```powershell
tui build --api-url https://example.com/api/home_api
```

默认产物位于项目 `dist`。检查页面、接口和登录后，通过现有流程部署到 HTTP/HTTPS 服务。

## 功能

- **独立运行**：不依赖 VSCode 或 TouchUI 插件，每台电脑安装一次，同类项目共用。
- **项目零编译配置**：沿用现有 `app.ui`，无需新增 CLI 配置文件或安装项目级编译依赖。
- **本地开发**：自动重新编译，通过同源代理访问 HTTP/HTTPS 后端。
- **生产构建**：可临时指定接口地址；编译失败保留上次成功产物，成功后替换输出目录。

## 环境要求

| 项目 | 要求 |
| --- | --- |
| 操作系统 | Windows x64 |
| npm 安装环境 | Node.js 16 或以上版本及 npm |
| 项目类型 | 与 `touchui-pack@1.9.37` 兼容的现有 TouchUI 项目 |
| 输出类型 | 网页/H5，不生成 Android APK 或 iOS IPA |

包内提供 Node.js 16.20.2、npm 8.19.4 和锁定的编译依赖，用于兼容现有工具链。执行时自动使用内置运行时，不改变其他项目的 Node 版本；切换 nvm 环境后可能需要重新安装全局工具。

## 常用命令

```powershell
tui dev --port 9091
tui dev --api-url http://127.0.0.1:8190/home_api
tui build --output-dir D:\release\my-app
tui build --project-dir D:\projects\my-app
```

接口覆盖仅本次生效，不修改源码；后端需独立运行。CAS/SSO 等独立登录地址按业务配置检查。输出目录会在构建成功后被替换，请使用专用目录。完整参数、输出限制、缓存、离线安装及 WindTerm 用法见[使用指南](https://github.com/xih888/touchui-cli/blob/main/docs/usage.md)。

## 分发内容

npm 包只包含命令入口、CLI 源码、内置运行时、编译依赖和本说明。便携版 ZIP、便携版安装脚本、开发测试、依赖锁定文件及维护文档不包含在 npm 包中。包体较大主要来自运行时和旧编译器的完整依赖。

GitHub 仓库保存源码、测试、依赖锁定和运行时准备脚本；运行时二进制、`node_modules`、业务项目与生成归档不提交到源码仓库。

## 问题反馈与参与维护

提交 [Issue](https://github.com/xih888/touchui-cli/issues) 时，请附操作系统、`tui --version`、执行命令和脱敏后的错误信息。参与开发、验证和发布请阅读[维护指南](https://github.com/xih888/touchui-cli/blob/main/docs/maintaining.md)。

## 许可

当前自编代码的许可标记为 `UNLICENSED`，尚未授予开源许可。第三方编译器及依赖保留各自许可证；内置 Node.js 的许可证随运行时分发。
