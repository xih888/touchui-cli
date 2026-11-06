const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const cli = require('../cli');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tui-tests-'));
const project = path.join(root, '中文 项目');
fs.mkdirSync(path.join(project, 'pages'), { recursive: true });
const appFile = path.join(project, 'app.ui');
const original = '<script>export default {config:{networkBaseUrl:"http://127.0.0.1:8190/home_api",pages:["pages/index"]}};</script>';
fs.writeFileSync(appFile, original);
fs.writeFileSync(path.join(project, 'main.js'), '');

try {
    assert.strictEqual(cli.findProject(path.join(project, 'pages')), fs.realpathSync(project));
    assert.throws(() => cli.parseArgs(['dev', '--port']), /缺少参数值/);
    assert.throws(() => cli.parseArgs(['dev', '--api-url', '--port', '9090']), /缺少参数值/);
    assert.throws(() => cli.parseArgs(['dev', '--port', '65536']), /65535/);
    assert.throws(() => cli.parseArgs(['build', '--port', '9090']), /仅用于 dev/);
    assert.throws(() => cli.parseArgs(['build', '--api-url', 'file:///tmp']), /HTTP/);
    assert.throws(() => cli.parseArgs(['build', 'dev']), /多余/);
    assert.throws(() => cli.resolveOutput(project, '.'), /输出目录/);
    assert.throws(() => cli.resolveOutput(project, '..'), /输出目录/);
    assert.throws(() => cli.resolveOutput(project, 'pages'), /项目内仅允许/);
    assert.throws(() => cli.resolveOutput(project, path.resolve(__dirname, '..')), /工具目录/);
    const alias = path.join(root, '源码连接');
    fs.symlinkSync(project, alias, 'junction');
    assert.throws(() => cli.resolveOutput(project, alias), /输出目录/);
    assert.strictEqual(cli.resolveOutput(project), path.join(project, 'dist'));

    const configRoot = path.join(root, '编译配置');
    fs.mkdirSync(path.join(configRoot, 'build'), { recursive: true });
    fs.mkdirSync(path.join(configRoot, 'src'));
    fs.copyFileSync(path.join(__dirname, '../node_modules/touchui-pack/build/config-util.js'), path.join(configRoot, 'build/config-util.js'));
    fs.copyFileSync(path.join(__dirname, '../node_modules/touchui-pack/build/ast-util.js'), path.join(configRoot, 'build/ast-util.js'));
    fs.symlinkSync(path.join(__dirname, '../node_modules'), path.join(configRoot, 'node_modules'), 'junction');
    const runtime = { runtimeRoot: configRoot };
    // 使用真实配置解析器，验证单行配置的接口覆盖和重新加载。
    const configUtil = require(path.join(configRoot, 'build/config-util'));
    const sourceFile = path.join(configRoot, 'src/app.ui');
    fs.writeFileSync(sourceFile, original);
    const url = 'https://example.com/api/$test?value=1';
    assert.strictEqual(cli.configureApi(runtime, { apiUrl: url }, false), url);
    assert.strictEqual(configUtil.getConfigObj(sourceFile).networkBaseUrl, url);
    fs.writeFileSync(appFile, original + '\n');
    fs.writeFileSync(sourceFile, original.replace('8190', '8191'));
    assert.strictEqual(configUtil.getConfigObj(sourceFile).networkBaseUrl, url);
    const otherFile = path.join(configRoot, 'src/其他页面.ui');
    fs.writeFileSync(otherFile, '<script>export default {config:{title:"测试页面"}};</script>');
    assert.strictEqual(configUtil.getConfigObj(otherFile).networkBaseUrl, undefined);
    assert.strictEqual(fs.readFileSync(appFile, 'utf8'), original + '\n');

    const built = path.join(root, '新产物');
    const output = path.join(project, 'dist');
    fs.mkdirSync(built);
    fs.mkdirSync(output);
    fs.writeFileSync(path.join(output, '旧文件.js'), '旧产物');
    fs.writeFileSync(path.join(built, 'index.html'), '新产物');
    cli.publishOutput(built, output);
    assert.strictEqual(fs.readFileSync(path.join(output, 'index.html'), 'utf8'), '新产物');
    assert.strictEqual(fs.existsSync(path.join(output, '旧文件.js')), false);
    assert.throws(() => cli.publishOutput(path.join(root, '不存在的产物'), output));
    assert.strictEqual(fs.readFileSync(path.join(output, 'index.html'), 'utf8'), '新产物');

    const bin = path.join(__dirname, '../bin/tui.js');
    const help = spawnSync(process.execPath, [bin], { encoding: 'utf8' });
    assert.strictEqual(help.status, 0, help.stderr);
    assert.match(help.stdout, /tui dev/);
    const invalid = spawnSync(process.execPath, [bin, 'build', '--api-url'], { encoding: 'utf8' });
    assert.strictEqual(invalid.status, 1);
    assert.match(invalid.stderr, /缺少参数值/);
    console.log('通过：项目定位、参数校验、源码路径保护、接口覆盖、产物替换和命令入口。');
} finally {
    fs.rmSync(root, { recursive: true, force: true });
}
