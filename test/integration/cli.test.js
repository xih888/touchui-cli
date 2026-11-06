const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tui-integration-')));
const project = path.join(root, '中文项目');
const bin = path.resolve(__dirname, '../../bin/tui.js');
// 使用兼容复制路径，验证项目名称包含中文的真实场景。
fs.cpSync(path.join(__dirname, 'fixture'), project, { recursive: true, filter: () => true });

/** 在本机分配测试端口，避免占用固定的用户服务端口。 */
function listen(server) {
    return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

/** 通过真实 HTTP 请求验证开发页面、编译资源和接口代理。 */
function request(port, pathname) {
    return new Promise((resolve, reject) => {
        const req = http.get({ hostname: '127.0.0.1', port, path: pathname }, res => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', data => { body += data; });
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.setTimeout(5000, () => req.destroy(new Error('开发服务响应超时')));
        req.on('error', reject);
    });
}

/** 等待开发编译或热更新完成；被测进程提前退出时立即报告退出状态。 */
async function waitFor(check, child) {
    const deadline = Date.now() + 120000;
    let failure;
    while (Date.now() < deadline) {
        if (child && (child.exitCode !== null || child.signalCode !== null)) {
            throw new Error('开发进程提前退出：' + (child.exitCode ?? child.signalCode));
        }
        try { return await check(); } catch (error) { failure = error; }
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    throw failure;
}

/** 终止测试启动的开发进程；Windows 额外清理子进程以避免 CI 悬挂。 */
async function stop(child) {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const exited = new Promise(resolve => child.once('exit', resolve));
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F']);
    else child.kill('SIGINT');
    await exited;
}

/** 使用无业务数据的完整项目验证生产构建、接口覆盖、热更新和代理。 */
async function main() {
    let child;
    let backend;
    let logs = '';
    try {
        const apiUrl = 'https://example.invalid/tui-api';
        const built = spawnSync(process.execPath, [bin, 'build', '--project-dir', project, '--api-url', apiUrl], {
            encoding: 'utf8', timeout: 120000
        });
        assert.strictEqual(built.status, 0, built.stdout + built.stderr);
        const dist = path.join(project, 'dist');
        const files = fs.readdirSync(path.join(dist, 'static/js')).filter(name => name.endsWith('.js'));
        const code = files.map(name => fs.readFileSync(path.join(dist, 'static/js', name), 'utf8')).join('\n');
        assert(code.includes(apiUrl), '生产包必须使用本次指定的接口地址');
        assert(!code.includes('webpack-hot-middleware/client'), '生产包不能包含开发热更新客户端');
        assert(fs.existsSync(path.join(dist, 'index.html')));
        assert(fs.existsSync(path.join(dist, 'static/marker.txt')));

        backend = http.createServer((req, res) => res.end(JSON.stringify({ path: req.url })));
        const apiPort = await listen(backend);
        const probe = http.createServer();
        const devPort = await listen(probe);
        await new Promise(resolve => probe.close(resolve));
        const flags = Number(process.versions.openssl.split('.')[0]) >= 3 ? ['--openssl-legacy-provider'] : [];
        child = spawn(process.execPath, [...flags, bin, 'dev', '--project-dir', project,
            '--port', String(devPort), '--api-url', 'http://127.0.0.1:' + apiPort], { stdio: ['ignore', 'pipe', 'pipe'] });
        child.stdout.on('data', data => { logs += data; });
        child.stderr.on('data', data => { logs += data; });
        await waitFor(async () => {
            assert.strictEqual(child.exitCode, null, logs);
            const page = await request(devPort, '/');
            assert.strictEqual(page.status, 200);
            assert((await request(devPort, '/app.js')).body.includes('tui-before'));
        }, child);
        assert.deepStrictEqual(JSON.parse((await request(devPort, '/__api/health')).body), { path: '/health' });
        const mainFile = path.join(project, 'main.js');
        fs.writeFileSync(mainFile, fs.readFileSync(mainFile, 'utf8').replace('tui-before', 'tui-after'));
        await waitFor(async () => assert((await request(devPort, '/app.js')).body.includes('tui-after')), child);
        assert.deepStrictEqual(JSON.parse((await request(devPort, '/__api/health')).body), { path: '/health' });
        console.log('通过：生产构建、接口覆盖、静态资源、开发 HTTP、热更新和接口代理。');
    } catch (error) {
        if (logs) console.error('开发服务日志：\n' + logs);
        throw error;
    } finally {
        await stop(child);
        if (backend) await new Promise(resolve => backend.close(resolve));
        fs.rmSync(root, { recursive: true, force: true });
        // Windows 强制终止可能遗留测试缓存，只清理本测试项目对应的目录。
        const key = require('crypto').createHash('sha256').update(project).digest('hex').slice(0, 12);
        fs.rmSync(path.join(os.tmpdir(), 'touchui-cli', key), { recursive: true, force: true });
    }
}

main().catch(error => { console.error('集成验证失败：', error); process.exitCode = 1; });
