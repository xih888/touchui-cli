#!/usr/bin/env node
const { spawnSync } = require('child_process');
const nodeVersion = process.versions.node.split('.').map(Number);
const supportedPlatform = (process.platform === 'win32' && process.arch === 'x64') ||
    (process.platform === 'darwin' && ['x64', 'arm64'].includes(process.arch));

// 使用当前电脑的 Node；兼容旧 Webpack 的哈希算法，设置仅作用于本次命令进程。
if (!supportedPlatform) {
    console.error('tui：当前版本支持 Windows x64、macOS Intel 和 Apple Silicon。');
    process.exitCode = 1;
} else if (nodeVersion[0] < 16 || (nodeVersion[0] === 16 &&
    (nodeVersion[1] < 20 || (nodeVersion[1] === 20 && nodeVersion[2] < 2)))) {
    console.error('tui：请使用 Node.js 16.20.2 或更高版本，推荐 Node.js 22 或 24 LTS。');
    process.exitCode = 1;
} else if (Number(process.versions.openssl.split('.')[0]) >= 3 &&
    !process.execArgv.includes('--openssl-legacy-provider')) {
    const result = spawnSync(process.execPath, ['--openssl-legacy-provider', __filename, ...process.argv.slice(2)], {
        stdio: 'inherit'
    });
    if (result.error) console.error('tui：启动失败，' + result.error.message);
    process.exitCode = result.status === null ? 1 : result.status;
} else {
    require('../cli').main();
}
