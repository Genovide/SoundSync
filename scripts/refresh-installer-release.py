"""Refresh checksums and notes after replacing the published Windows installer."""
import json,os,pathlib,re,subprocess
root=pathlib.Path(__file__).resolve().parent.parent
version=json.loads((root/'app/package.json').read_text(encoding='utf-8'))['version']
repo=os.environ.get('GITHUB_REPOSITORY','Genovide/SoundSync')
tag='v'+version
release=json.loads(subprocess.check_output(['gh','api','repos/'+repo+'/releases/tags/'+tag],encoding='utf-8'))
names=[f'SoundSync-{version}-Update-Windows-x64.zip',f'SoundSync-{version}-Update-macOS-arm64.zip','SoundSync-Setup-Windows-x64.exe','SoundSync-macOS-arm64.dmg']
assets={a['name']:a for a in release['assets']}
lines=[]
for name in names:
    digest=assets[name]['digest'].removeprefix('sha256:')
    if not re.fullmatch('[a-f0-9]{64}',digest):raise ValueError('Missing release checksum: '+name)
    lines.append(digest+'  '+name+'\n')
sums=root/'dist/SHA256SUMS.txt'
sums.write_text(''.join(lines),encoding='utf-8',newline='\n')
subprocess.run(['gh','release','upload',tag,str(sums),'--repo',repo,'--clobber'],check=True)
body=release.get('body','')
marker='### Исправление установщика Windows'
if marker not in body:
    body=body.rstrip()+'\n\n'+marker+'\n\nИсправлена упаковка вложенных папок `data`: теперь исключается только корневая папка пользовательского профиля. В установленном приложении сохраняются все файлы PyTorch, включая `torch.utils.data`. Добавлен контроль компонентов после установки готового EXE.\n\nЕсли уже установлена '+version+', можно повторно запустить исправленный установщик или ZIP-апдейт Windows. Музыка и Data сохраняются. Версия не менялась.\n'
    commit=os.environ.get('GITHUB_SHA','')
    if re.fullmatch('[a-f0-9]{40}',commit):body+='\n[Исходники исправления](https://github.com/'+repo+'/commit/'+commit+').\n'
    notes=root/'dist/installer-release-notes.md'
    notes.write_text(body,encoding='utf-8')
    subprocess.run(['gh','release','edit',tag,'--repo',repo,'--notes-file',str(notes)],check=True)
print('Updated Windows installer, release checksums and repair notes')
