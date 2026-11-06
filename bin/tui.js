#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

// 使用随包提供的运行时，不改变电脑上其他项目的 Node 版本。
const runtime = path.join(__dirname, '../runtime');
const node = path.join(runtime, 'node.exe');
if (process.platform !== 'win32' || process.arch !== 'x64') {
    console.error('tui：当前版本仅支持 Windows x64。');
    process.exitCode = 1;
} else if (!fs.existsSync(node)) {
    console.error('tui：缺少内置 Node.js 运行时，请重新安装完整工具包。');
    process.exitCode = 1;
} else if (path.resolve(process.execPath).toLowerCase() !== node.toLowerCase()) {
    const result = spawnSync(node, [__filename, ...process.argv.slice(2)], {
        stdio: 'inherit',
        env: { ...process.env, PATH: runtime + path.delimiter + process.env.PATH }
    });
    if (result.error) console.error('tui：运行时启动失败，' + result.error.message);
    process.exitCode = result.status === null ? 1 : result.status;
} else {
    process.env.PATH = runtime + path.delimiter + process.env.PATH;
    require('../cli').main();
}
