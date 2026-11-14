; Полная установка SoundSync для Windows (Inno Setup 6).
; Сборка: ISCC /DAppVersion=1.2.12 /DSourceDir=<папка с SoundSync.exe> /DOutputDir=<dist> soundsync.iss
#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#ifndef OutputDir
  #define OutputDir "..\..\dist"
#endif

[Setup]
AppId={{6F1C2D4E-8B3A-4E5F-9A7C-50D5C5A1B2E3}
AppName=SoundSync
AppVersion={#AppVersion}
AppVerName=SoundSync {#AppVersion}
AppPublisher=Genovide
AppPublisherURL=https://github.com/Genovide/SoundSync
AppSupportURL=https://github.com/Genovide/SoundSync/issues
AppUpdatesURL=https://github.com/Genovide/SoundSync/releases/latest
; Медиатека и настройки хранятся в папке Data рядом с программой, поэтому ставим в профиль
; пользователя: права администратора не нужны, а папка доступна для записи.
DefaultDirName={localappdata}\Programs\SoundSync
PrivilegesRequired=lowest
DisableProgramGroupPage=yes
DisableDirPage=auto
OutputDir={#OutputDir}
OutputBaseFilename=SoundSync-Setup-Windows-x64
SetupIconFile=..\..\app\icon.ico
UninstallDisplayIcon={app}\SoundSync.exe
UninstallDisplayName=SoundSync
WizardStyle=modern
WizardImageFile=wizard-big-164.bmp,wizard-big-328.bmp
WizardSmallImageFile=wizard-small-55.bmp,wizard-small-110.bmp
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
Compression=lzma2/fast
SolidCompression=no
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Excludes: "Data,Data\*"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{autoprograms}\SoundSync"; Filename: "{app}\SoundSync.exe"
Name: "{autodesktop}\SoundSync"; Filename: "{app}\SoundSync.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\SoundSync.exe"; Description: "{cm:LaunchProgram,SoundSync}"; Flags: nowait postinstall skipifsilent

; Папку Data (музыка, медиатека, настройки) при удалении не трогаем.
