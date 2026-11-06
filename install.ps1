# 将便携版命令目录加入当前用户 PATH，不修改系统 PATH。
$tuiDirectory = $PSScriptRoot
$tuiUserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (($tuiUserPath -split ';').TrimEnd('\') -notcontains $tuiDirectory.TrimEnd('\')) {
    [Environment]::SetEnvironmentVariable('Path', $tuiDirectory + ';' + $tuiUserPath, 'User')
}
$env:Path = $tuiDirectory + ';' + $env:Path
Write-Output 'tui 已安装到当前用户 PATH。其他终端请重新打开后使用。'
& (Join-Path $tuiDirectory 'tui.cmd') --version
