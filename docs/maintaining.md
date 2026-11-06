# 维护指南

## 源码目录

| 路径 | 用途 |
| --- | --- |
| `bin/tui.js` | 命令入口与兼容运行时引导 |
| `cli.js` | 项目定位、开发、构建及产物管理 |
| `test/` | CLI 回归测试 |
| `scripts/prepare-runtime.ps1` | 下载并校验固定版本运行时 |
| `package-lock.json` | 固定编译器及依赖版本 |
| `docs/` | 使用和维护说明 |
| `install.ps1`、`tui.cmd` | 便携版入口，不收入 npm 包 |

`runtime/` 和 `node_modules/` 为本机运行所需目录，由准备脚本和 npm 生成；源码仓库仅保留运行时许可证。

## 从源码运行

使用 Windows x64。维护与发布建议使用当前 Node.js LTS 和 npm 10 或更高版本；工具运行时由独立脚本准备。

```powershell
git clone https://github.com/xih888/touchui-cli.git
cd touchui-cli
npm ci --ignore-scripts --no-audit --no-fund
npm run runtime:prepare
npm test
node bin/tui.js --help
```

运行时脚本从 Node.js 官方站点下载 `node-v16.20.2-win-x64.zip`，核对官方 SHA256 清单后提取运行所需文件，不读取 VSCode 插件。网络受限时需允许访问 Node.js 官方站点和依赖锁定文件中的包注册表。

`encoding`、`node-releases` 的 overrides 用于旧编译器与 Node 16 兼容。更新依赖后维护锁定文件，并验证现有 TouchUI 项目的开发与生产构建。

## 发布新版本

1. 更新 `package.json` 和锁定文件中的版本，记录 `CHANGELOG.md`。已发布的同版本不能覆盖。
2. 运行 `npm test`；检查 `npm pack --dry-run --json` 的文件清单，确认没有 ZIP、备份、凭据、业务源码或临时缓存。
3. 在真实 TouchUI 项目上验证开发和生产构建，确认接口覆盖和产物保留行为。
4. 提交源码并推送到 GitHub，再从相同提交发布 npm 包。

```powershell
npm login --auth-type=web --registry=https://registry.npmjs.org
npm publish . --access public --ignore-scripts --registry=https://registry.npmjs.org
npm view touchui-cli version bin repository --json --prefer-online --registry=https://registry.npmjs.org
```

npm 网页没有直接上传包的入口，网页登录与 CLI 认证分别进行。账号需要符合 npm 的 2FA 要求；按终端提示在浏览器完成本次发布验证，不要把验证码或令牌写入源码。

npm 返回成功后可能仍在服务端处理，只有注册表能查询到正式版本和正确的 `latest` 标签后才表示可公开安装。

## 分发范围

`package.json` 的 `files` 限定自编文件，`bundleDependencies` 收入编译依赖；npm 自动收入包元数据。npm 分发包含运行必需的内置 Node/npm，避免目标电脑再次寻找插件或下载编译依赖。

便携 ZIP 应单独放在工具源码目录之外，包含运行文件和便携入口，由维护者另行分发。不要把生成归档、缓存或完整依赖副本提交到 GitHub。

## 提交与反馈

保持修改范围与问题直接相关，新增或修改方法补充中文用途注释。提交前运行测试并检查差异；问题反馈中隐藏业务接口凭据和个人敏感信息。许可继续沿用 `UNLICENSED`，更改许可需由维护者明确决定。
