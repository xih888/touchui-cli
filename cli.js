const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { version } = require('./package.json');

const toolchain = path.join(__dirname, 'node_modules/touchui-pack');
const cacheRoot = path.join(os.tmpdir(), 'touchui-cli');

/** 显示当前版本和实际支持的命令参数。 */
function printHelp() {
    console.log(`TouchUI CLI ${version}（编译器 1.9.37）

用法：
  tui dev [选项]           启动本地开发服务
  tui build [选项]         生成网页/H5 生产包

选项：
  --project-dir <目录>     从指定目录向上查找 app.ui 和 main.js
  --api-url <地址>         临时覆盖 HTTP/HTTPS 接口地址
  --port <端口>            开发服务起始端口，默认 9090
  --output-dir <目录>      输出到项目 dist 或项目外目录
  --help, -h              显示帮助
  --version, -v           显示版本

默认从当前目录查找项目，不需要项目级配置文件。`);
}

/** 校验命令和参数，缺少参数值时直接给出可读错误。 */
function parseArgs(argv) {
    const options = {};
    const names = { '--project-dir': 'projectDir', '--api-url': 'apiUrl', '--port': 'port', '--output-dir': 'outputDir' };
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--help' || arg === '-h') options.help = true;
        else if (arg === '--version' || arg === '-v') options.version = true;
        else if (names[arg]) {
            const value = argv[++index];
            if (!value || value.startsWith('-')) throw new Error(arg + ' 缺少参数值。');
            options[names[arg]] = value;
        } else if (arg.startsWith('-')) throw new Error('未知选项：' + arg);
        else if (!options.command) options.command = arg;
        else throw new Error('多余的命令参数：' + arg);
    }
    if (options.help || options.version || !options.command) return options;
    if (!['dev', 'build'].includes(options.command)) throw new Error('未知命令：' + options.command + '，可用命令为 dev、build。');
    if (options.port && (options.command !== 'dev' || !/^\d+$/.test(options.port) || +options.port < 1 || +options.port > 65535)) {
        throw new Error('--port 仅用于 dev，且必须是 1 到 65535 的整数。');
    }
    if (options.outputDir && options.command !== 'build') throw new Error('--output-dir 仅用于 build。');
    if (options.apiUrl) {
        let url;
        try { url = new URL(options.apiUrl); } catch (_) { throw new Error('--api-url 必须是完整的 HTTP/HTTPS 地址。'); }
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('--api-url 必须使用 HTTP 或 HTTPS。');
    }
    return options;
}

/** 从当前目录或父目录定位项目，不自动进入其他子项目。 */
function findProject(start) {
    let current = path.resolve(start);
    while (true) {
        if (fs.existsSync(path.join(current, 'app.ui')) && fs.existsSync(path.join(current, 'main.js'))) return fs.realpathSync(current);
        const parent = path.dirname(current);
        if (parent === current) throw new Error('未找到 TouchUI 项目，请进入包含 app.ui 和 main.js 的源码目录。');
        current = parent;
    }
}

/** 解析真实输出路径，拒绝覆盖项目源码、工具目录或其上级目录。 */
function resolveOutput(projectRoot, outputDir) {
    const requested = path.resolve(projectRoot, outputDir || 'dist');
    let existing = requested;
    while (!fs.existsSync(existing)) existing = path.dirname(existing);
    const output = path.resolve(fs.realpathSync(existing), path.relative(existing, requested));
    if (process.platform === 'win32' ? output.toLowerCase() !== requested.toLowerCase() : output !== requested) throw new Error('输出目录不能包含符号链接或目录连接。');
    const cliRoot = fs.realpathSync(__dirname);
    for (const source of [projectRoot, cliRoot]) {
        const fromOutput = path.relative(output, source);
        if (!fromOutput || (!fromOutput.startsWith('..' + path.sep) && fromOutput !== '..' && !path.isAbsolute(fromOutput))) {
            throw new Error('输出目录不能是项目或工具目录及其上级目录。');
        }
        const fromSource = path.relative(source, output);
        const insideSource = !fromSource.startsWith('..' + path.sep) && fromSource !== '..' && !path.isAbsolute(fromSource);
        if (insideSource && (source !== projectRoot || output !== path.join(projectRoot, 'dist'))) {
            throw new Error('项目内仅允许输出到 dist，其他输出请指定项目外目录。');
        }
    }
    if (fs.existsSync(output) && !fs.statSync(output).isDirectory()) throw new Error('输出路径已被文件占用。');
    return output;
}

/** 排除依赖、旧工具脚本和产物；其余业务资源保持原始字节。 */
function isSource(projectRoot, file) {
    const parts = path.relative(projectRoot, file).split(path.sep);
    return !parts.some(name => name.startsWith('.') || name === 'node_modules') &&
        !['dist', 'tooling', 'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'README.md'].includes(parts[0]);
}

/** 同步业务源码；单文件使用复制接口兼容中文路径，静态目录同时提供开发资源。 */
function syncSource(projectRoot, runtimeRoot, file) {
    const relative = path.relative(projectRoot, file);
    const targets = [path.join(runtimeRoot, 'src', relative)];
    if (relative === 'static' || relative.startsWith('static' + path.sep)) targets.push(path.join(runtimeRoot, relative));
    targets.forEach(target => {
        if (fs.existsSync(file)) {
            fs.mkdirSync(path.dirname(target), { recursive: true });
            if (fs.statSync(file).isDirectory()) {
                fs.cpSync(file, target, { recursive: true, filter: source => isSource(projectRoot, source) });
            } else fs.copyFileSync(file, target);
        } else fs.rmSync(target, { recursive: true, force: true });
    });
}

/** 隔离每次编译缓存，兼容旧加载器路径；运行版本由 CLI 入口检查。 */
function prepareRuntime(projectRoot, mode) {
    const dependencies = path.dirname(toolchain);
    const key = crypto.createHash('sha256').update(projectRoot).digest('hex').slice(0, 12);
    const projectCache = path.join(cacheRoot, key);
    fs.mkdirSync(projectCache, { recursive: true });
    const runRoot = fs.mkdtempSync(path.join(projectCache, mode + '-'));
    const runtimeRoot = path.join(runRoot, 'work/touchui-pack');
    fs.mkdirSync(runtimeRoot, { recursive: true });
    /** 只删除本次创建的缓存，先离开目录以释放 Windows 占用。 */
    function cleanup() {
        process.chdir(projectRoot);
        fs.rmSync(runRoot, { recursive: true, force: true });
    }
    process.once('exit', cleanup);
    fs.symlinkSync(dependencies, path.join(runRoot, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    // 显式过滤器兼容 Windows 上的中文安装路径。
    ['touchui-loader', 'touchui-pre-loader'].forEach(name => {
        fs.cpSync(path.join(dependencies, name), path.join(runRoot, 'work/node_modules', name), { recursive: true, filter: () => true });
    });
    ['build', 'config', 'utils', 'i18n', 'index.html', 'package.json', '.babelrc'].forEach(name => {
        fs.cpSync(path.join(toolchain, name), path.join(runtimeRoot, name), { recursive: true, filter: () => true });
    });
    fs.appendFileSync(path.join(runtimeRoot, 'build/webpack.base.conf.js'), '\nmodule.exports.resolve.symlinks = false;\n');
    // 固定本机监听；依赖已随 CLI 安装，开发服务器无需另外调用 npm 检查版本。
    const serverFile = path.join(runtimeRoot, 'build/dev-server.js');
    fs.writeFileSync(serverFile, fs.readFileSync(serverFile, 'utf8')
        .replace("require('./check-versions')()", "// CLI 入口已检查 Node 版本。")
        .replace('app.listen(port)', "app.listen(port, '127.0.0.1')"));
    fs.mkdirSync(path.join(runtimeRoot, 'src'), { recursive: true });
    fs.readdirSync(projectRoot).filter(name => isSource(projectRoot, path.join(projectRoot, name)))
        .forEach(name => syncSource(projectRoot, runtimeRoot, path.join(projectRoot, name)));
    return { dependencies, runtimeRoot };
}

/** 在编译器读取配置时覆盖接口，源码变化后仍保持本次命令指定的地址。 */
function configureApi(runtime, options, isDev) {
    const configUtil = require(path.join(runtime.runtimeRoot, 'build/config-util'));
    const getConfigObj = configUtil.getConfigObj.bind(configUtil);
    const appFile = path.join(runtime.runtimeRoot, 'src/app.ui');
    const apiUrl = options.apiUrl || getConfigObj(appFile).networkBaseUrl;
    const useProxy = isDev && /^https?:\/\//.test(apiUrl);
    if (useProxy) {
        const config = require(path.join(runtime.runtimeRoot, 'config'));
        config.dev.proxyTable['/__api'] = { target: apiUrl, changeOrigin: true, pathRewrite: { '^/__api': '' } };
    }
    /** 仅覆盖 app.ui 的网络配置，不影响其他页面配置。 */
    configUtil.getConfigObj = function (file) {
        const result = getConfigObj(file);
        if (path.resolve(file) === appFile && (options.apiUrl || useProxy)) result.networkBaseUrl = useProxy ? '/__api' : apiUrl;
        return result;
    };
    return apiUrl;
}

/** 编译成功后替换输出目录，替换失败时还原原有目录。 */
function publishOutput(built, output) {
    const parent = path.dirname(output);
    fs.mkdirSync(parent, { recursive: true });
    const staging = fs.mkdtempSync(path.join(parent, '.tui-output-'));
    const previous = staging + '-previous';
    try {
        // 显式过滤器使用兼容复制路径，避免 Windows Node 22 原生复制中文目录时崩溃。
        fs.cpSync(built, staging, { recursive: true, filter: () => true });
        if (fs.existsSync(output)) fs.renameSync(output, previous);
        try { fs.renameSync(staging, output); }
        catch (error) {
            if (fs.existsSync(previous)) fs.renameSync(previous, output);
            throw error;
        }
    } finally {
        fs.rmSync(staging, { recursive: true, force: true });
    }
    fs.rmSync(previous, { recursive: true, force: true });
}

/** 启动开发服务，并在正常退出或 Ctrl+C 时清理本次缓存。 */
function runDev(projectRoot, options) {
    process.env.NODE_ENV = 'development';
    const runtime = prepareRuntime(projectRoot, 'dev');
    const apiUrl = configureApi(runtime, options, true);
    process.env.PORT = options.port || '9090';
    const chokidar = require(path.join(runtime.dependencies, 'chokidar'));
    const watcher = chokidar.watch(projectRoot, { ignored: file => !isSource(projectRoot, file), ignoreInitial: true });
    watcher.on('all', (event, file) => syncSource(projectRoot, runtime.runtimeRoot, file));
    /** 结束当前开发进程，退出事件会清理对应缓存。 */
    function stop() { process.exit(0); }
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    process.chdir(runtime.runtimeRoot);
    console.log('项目：' + projectRoot + '\n接口：' + apiUrl + '\n编译器：' + toolchain + '\n按 Ctrl+C 停止。');
    require(path.join(runtime.runtimeRoot, 'build/dev-server.js'));
}

/** 先在缓存中编译，错误时返回非零退出码并保留上次成功产物。 */
function runBuild(projectRoot, options) {
    const output = resolveOutput(projectRoot, options.outputDir);
    process.env.NODE_ENV = 'production';
    const runtime = prepareRuntime(projectRoot, 'build');
    const apiUrl = configureApi(runtime, options, false);
    process.chdir(runtime.runtimeRoot);
    const webpack = require(path.join(runtime.dependencies, 'webpack'));
    const config = require(path.join(runtime.runtimeRoot, 'build/webpack.prod.conf'));
    console.log('项目：' + projectRoot + '\n接口：' + apiUrl + '\n编译器：' + toolchain);
    webpack(config, (error, stats) => {
        try {
            if (error || stats.hasErrors()) throw new Error(error ? error.message : stats.toString({ all: false, errors: true }));
            const staticDir = path.join(runtime.runtimeRoot, 'static');
            if (fs.existsSync(staticDir)) fs.cpSync(staticDir, path.join(config.output.path, 'static'), { recursive: true });
            publishOutput(config.output.path, output);
            console.log('网页打包完成：' + output);
        } catch (failure) {
            console.error('打包失败：' + failure.message);
            process.exitCode = 1;
        }
    });
}

/** 命令入口统一输出中文错误，帮助和版本查询不要求位于项目中。 */
function main(argv = process.argv.slice(2)) {
    try {
        const options = parseArgs(argv);
        if (options.version) console.log(version);
        else if (options.help || !options.command) printHelp();
        else {
            const projectRoot = findProject(options.projectDir || process.cwd());
            if (options.command === 'dev') runDev(projectRoot, options);
            else runBuild(projectRoot, options);
        }
    } catch (error) {
        console.error('tui：' + error.message);
        process.exitCode = 1;
    }
}

module.exports = { main, parseArgs, findProject, resolveOutput, publishOutput, configureApi };
