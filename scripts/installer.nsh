# NSIS 安装器定制：安装页展开详细信息面板，输出步骤日志，并把升级安装的关闭与卸载改成不会卡死的做法
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
# 卸载器编译（BUILD_UNINSTALLER）不会展开安装页，函数留在里面会触发未引用告警
!ifndef BUILD_UNINSTALLER
  !macro customPageAfterChangeDir
    !define MUI_PAGE_CUSTOMFUNCTION_SHOW ShowInstallDetails
  !macroend

  Function ShowInstallDetails
    DetailPrint "正在安装 ${PRODUCT_NAME} ${VERSION}..."
    DetailPrint "安装目录：$INSTDIR"
  FunctionEnd
!endif

# 模板在安装页开始时关闭了明细输出，这里重新打开并输出安装阶段结果
!macro customInstall
  SetDetailsPrint both
  DetailPrint "应用文件解压完成"
  DetailPrint "已写入安装信息与卸载信息"
  DetailPrint "已创建桌面与开始菜单快捷方式"
  DetailPrint "安装完成"
!macroend

# 安装或卸载前直接强杀正在运行的程序，取代模板的「先正常关闭、再强杀」流程。
# 模板在 PowerShell 被组策略限制时只会发正常关闭请求，程序卡在弹窗或挂起状态时关不掉，
# 会一直弹「无法关闭」，这里用 taskkill /F /T 结束整个进程树来兜底。
!macro customCheckAppRunning
  Push $R9
  nsExec::Exec `taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}"`
  Pop $R9
  DetailPrint "结束正在运行的 ${PRODUCT_NAME}（taskkill 退出码 $R9）"
  Pop $R9
!macroend

# 升级安装时模板会先把整个安装目录 Rename 到 %TEMP%\old-install 再删，跨盘等于复制两百多 MB，
# 空间不够或任一文件被占用就 Abort，旧卸载器返回 2，安装包随即中止。这里直接删目录。
!macro customRemoveFiles
  SetOutPath $TEMP
  RMDir /r $INSTDIR
!macroend

# 旧版本卸载器返回非 0 时只记日志、继续安装，不再中止。
# 旧版卸载器里的跨盘改名逻辑装在新版本之前就已经编进去了，改不动它，只能容忍它失败；
# 它失败后会把文件还原回去，随后由新版本的安装覆盖。
!macro customUnInstallCheck
  DetailPrint "旧版本卸载器退出码 $R0，已忽略并继续安装"
!macroend

!macro customUnInstallCheckCurrentUser
  DetailPrint "旧版本卸载器（当前用户）退出码 $R0，已忽略并继续安装"
!macroend

