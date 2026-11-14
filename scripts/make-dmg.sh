#!/bin/bash
# Полная сборка для Mac в виде DMG: фон SoundSync, приложение слева, «Программы» справа,
# стрелка «перетащи». Использование: scripts/make-dmg.sh <SoundSync.app> <out.dmg>
set -euo pipefail
APP="$1"
OUT="$2"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
VOLUME="SoundSync"
WORK="$(mktemp -d)"
trap 'hdiutil detach "$MOUNT" -quiet -force >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT
MOUNT=''
STAGE="$WORK/stage"
mkdir -p "$STAGE/.background"
ditto "$APP" "$STAGE/SoundSync.app"
ln -s /Applications "$STAGE/Applications"
cp "$HERE/build/installer/dmg-background.tiff" "$STAGE/.background/background.tiff"
SIZE=$(($(du -sm "$STAGE" | cut -f1) + 300))
hdiutil create -quiet -srcfolder "$STAGE" -volname "$VOLUME" -fs HFS+ -format UDRW -size "${SIZE}m" "$WORK/rw.dmg"
MOUNT="$(hdiutil attach -readwrite -noverify -noautoopen "$WORK/rw.dmg" | awk -F'\t' '/\/Volumes\// {print $NF}' | tail -1)"
echo "Mounted at $MOUNT"
# Иконка тома — иконка приложения.
if [ -f "$STAGE/SoundSync.app/Contents/Resources/electron.icns" ]; then
  cp "$STAGE/SoundSync.app/Contents/Resources/electron.icns" "$MOUNT/.VolumeIcon.icns"
  SetFile -c icnC "$MOUNT/.VolumeIcon.icns" 2>/dev/null || true
  SetFile -a C "$MOUNT" 2>/dev/null || true
fi
# Раскладка окна через Finder: размер под фон 660×400, иконки на местах стрелки.
DISK="$(basename "$MOUNT")"
if ! osascript <<APPLESCRIPT; then
tell application "Finder"
  tell disk "$DISK"
    open
    set current view of container window to icon view
    set toolbar visible of container window to false
    set statusbar visible of container window to false
    set the bounds of container window to {200, 120, 860, 548}
    set viewOptions to the icon view options of container window
    set arrangement of viewOptions to not arranged
    set icon size of viewOptions to 112
    set text size of viewOptions to 13
    set background picture of viewOptions to file ".background:background.tiff"
    set position of item "SoundSync.app" of container window to {165, 200}
    set position of item "Applications" of container window to {495, 200}
    close
    open
    update without registering applications
    delay 2
    close
  end tell
end tell
APPLESCRIPT
  echo 'Finder layout skipped: the DMG still works, without the background layout' >&2
fi
chmod -Rf go-w "$MOUNT" || true
sync
hdiutil detach "$MOUNT" -quiet || hdiutil detach "$MOUNT" -force -quiet
MOUNT=''
rm -f "$OUT"
hdiutil convert -quiet "$WORK/rw.dmg" -format UDZO -imagekey zlib-level=9 -o "$OUT"
echo "DMG: $OUT ($(du -h "$OUT" | cut -f1))"
