import { FileText, FolderOpen, PanelLeftClose } from 'lucide-react';
import { getShortcutLabel, runCommand } from '@/app/commands';
import { openFileDialog } from '@/features/documents/actions';
import { openFolderDialog } from '@/features/folder/actions';
import { AppMark } from '@/components/ui/AppMark';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Tooltip } from '@/components/ui/Tooltip';

export function SidebarHeader() {
  return (
    <div className="shrink-0">
      <div className="flex h-9 items-center gap-2 pr-1.5 pl-3">
        <AppMark className="size-[18px]" />
        <span className="text-ui min-w-0 flex-1 truncate font-semibold tracking-[-0.01em]">
          Markdown Viewer
        </span>
        <IconButton
          label="Hide sidebar"
          shortcut={getShortcutLabel('view.toggleSidebar')}
          icon={<PanelLeftClose />}
          onClick={() => void runCommand('view.toggleSidebar')}
        />
      </div>
      <div className="grid grid-cols-2 gap-1.5 px-3 pt-1 pb-3">
        <Tooltip
          label="Open a Markdown file"
          shortcut={getShortcutLabel('file.open')}
          className="flex"
        >
          <Button
            size="sm"
            className="w-full"
            icon={<FileText aria-hidden />}
            onClick={() => void openFileDialog()}
          >
            Open File
          </Button>
        </Tooltip>
        <Tooltip
          label="Open a folder"
          shortcut={getShortcutLabel('file.openFolder')}
          className="flex"
        >
          <Button
            size="sm"
            className="w-full"
            icon={<FolderOpen aria-hidden />}
            onClick={() => void openFolderDialog()}
          >
            Open Folder
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
