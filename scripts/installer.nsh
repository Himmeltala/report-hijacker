# NSIS 安装器定制：安装页展开详细信息面板，并在安装过程中输出步骤日志
#
# electron-builder 的应用包以 7z 整包解压（Nsis7z::Extract），没有逐文件输出，
# 因此日志只覆盖安装阶段与关键结果。
# 路径由 electron-builder.yml 的 nsis.include 指定，不放在 buildResources 目录。

# ShowInstDetails 只能在安装器脚本的全局位置设置；模板 common.nsh 里设的是 nevershow，
# 这里放在 customHeader（common.nsh 之后展开）才会覆盖成显示。
!macro customHeader
  ShowInstDetails show
!macroend

# 紧跟安装页声明之前设置 SHOW 回调，页面显示时先把安装信息写进日志面板
!macro customPageAfterChangeDir
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW ShowInstallDetails
!macroend

Function ShowInstallDetails
  DetailPrint "正在安装 ${PRODUCT_NAME} ${VERSION}..."
  DetailPrint "安装目录：$INSTDIR"
FunctionEnd

# 模板在安装页开始时关闭了明细输出，这里重新打开并输出安装阶段结果
!macro customInstall
  SetDetailsPrint both
  DetailPrint "应用文件解压完成"
  DetailPrint "已写入安装信息与卸载信息"
  DetailPrint "已创建桌面与开始菜单快捷方式"
  DetailPrint "安装完成"
!macroend
