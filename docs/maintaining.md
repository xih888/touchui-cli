# 维护指南

## 源码目录

| 路径 | 用途 |
| --- | --- |
| `bin/tui.js` | 命令入口、平台与 Node 检查，以及旧 Webpack 的运行兼容 |
| `cli.js` | 项目定位、开发、构建及产物管理 |
| `test/cli.test.js` | 参数、路径保护、接口覆盖和产物保留验证 |
| `test/integration/` | 无业务数据的项目及真实构建、热更新、代理验证 |
| `.github/workflows/verify.yml` | Windows、Intel Mac、Apple Silicon Mac 持续集成 |
| `package-lock.json` | 固定编译器及依赖版本 |
| `docs/` | 使用和维护说明 |

## 从源码运行

使用支持的平台，安装 Node.js >= 16.20.2 和 npm，推荐 Node.js 22 或 24 LTS：

```shell
git clone https://github.com/xih888/touchui-cli.git
cd touchui-cli
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run test:integration
node bin/tui.js --help
```

依赖统一从锁定文件恢复，无需 VSCode 插件、运行时下载脚本或项目编译配置。`encoding`、`node-releases` 的 overrides 保留旧编译器兼容；更新依赖时同步维护锁定文件。

## 跨平台兼容

CLI 使用宿主 Node.js。OpenSSL 3 环境会为本次命令的子进程启用旧 Webpack 所需的哈希算法，不写入系统环境变量或全局 Node 配置。开发服务器原有的 npm 版本检查在编译缓存中移除，编译过程不调用 npm。

CI 在 Windows x64 的 Node 16.20.2、22、24，以及 Intel Mac / Apple Silicon Mac 的 Node 22、24 上验证。测试包含生产构建、接口地址覆盖、静态资源、开发 HTTP、源码热更新及同源接口代理。Linux 与 Windows arm64 尚未列入支持范围。

## 发布新版本

1. 更新 `package.json` 和锁定文件中的版本，记录 `CHANGELOG.md`。已发布的同版本不能覆盖。
2. 运行单元和集成验证，并确认 GitHub 跨平台 CI 通过。
3. 检查 `npm pack --dry-run --json` 的清单，确认没有 ZIP、运行时、备份、凭据、业务源码或临时缓存。
4. 提交源码并推送到 GitHub，再从相同提交发布 npm 包。

```shell
npm login --auth-type=web --registry=https://registry.npmjs.org
npm publish . --access public --ignore-scripts --registry=https://registry.npmjs.org
npm view touchui-cli version bin repository --json --prefer-online --registry=https://registry.npmjs.org
```

维护发布建议使用当前 Node.js LTS 和 npm 10 或更高版本。npm 网页没有直接上传包的入口，网页登录与 CLI 认证分别进行。按终端提示完成 2FA 发布验证，不要把验证码或令牌写入源码。

npm 返回成功后可能仍在服务端处理，注册表能查询到正式版本和正确的 `latest` 标签后才表示可公开安装。

## 分发与反馈

`files` 限定自编文件，`bundleDependencies` 收入锁定的编译依赖。npm 包不再内置 Node/npm，不包含便携版入口、开发测试或源码仓库配置。生成归档应放在源码目录之外。

保持修改范围与问题直接相关，新增或修改方法补充中文用途注释。提交前检查测试与差异，反馈中隐藏业务接口凭据和个人敏感信息。自编代码采用 MIT 许可；分发时保留版权和许可声明，第三方依赖继续遵循各自许可证。
