//! Native application menu. Item ids are the frontend `CommandId`s; clicks are
//! forwarded as `menu-action` events and handled by the frontend.

use tauri::menu::{Menu, MenuBuilder, MenuEvent, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Runtime};

pub const MENU_ACTION_EVENT: &str = "menu-action";

/// `(id, label, accelerator)` entries; `None` marks a separator.
type Entry = Option<(&'static str, &'static str, Option<&'static str>)>;

const FILE_MENU: &[Entry] = &[
    Some(("file.open", "&Open File…", Some("CmdOrCtrl+O"))),
    Some(("file.openFolder", "Open &Folder…", Some("CmdOrCtrl+Shift+O"))),
    Some(("file.quickOpen", "&Quick Open…", Some("CmdOrCtrl+P"))),
    None,
    Some(("file.reload", "&Reload", Some("CmdOrCtrl+R"))),
    Some(("file.closeFolder", "Close Fol&der", None)),
    None,
    Some(("tab.close", "&Close Tab", Some("CmdOrCtrl+W"))),
    Some(("tab.closeOthers", "Close &Other Tabs", None)),
    Some(("tab.closeAll", "Close &All Tabs", Some("CmdOrCtrl+Shift+W"))),
    Some(("tab.reopenClosed", "Reopen Closed &Tab", Some("CmdOrCtrl+Shift+T"))),
    None,
    Some(("app.settings", "&Settings…", Some("CmdOrCtrl+,"))),
    None,
    Some(("app.quit", "&Quit", Some("CmdOrCtrl+Q"))),
];

const VIEW_MENU: &[Entry] = &[
    Some(("view.toggleSidebar", "Toggle &Sidebar", Some("CmdOrCtrl+B"))),
    Some(("view.readingMode", "&Reading Mode", Some("CmdOrCtrl+Shift+R"))),
    Some(("view.toggleTheme", "Toggle &Theme", Some("CmdOrCtrl+Shift+D"))),
    None,
    Some(("view.find", "&Find in Document", Some("CmdOrCtrl+F"))),
    None,
    Some(("view.zoomIn", "Zoom &In", Some("CmdOrCtrl+="))),
    Some(("view.zoomOut", "Zoom &Out", Some("CmdOrCtrl+-"))),
    Some(("view.zoomReset", "&Actual Size", Some("CmdOrCtrl+0"))),
    None,
    Some(("tab.next", "&Next Tab", Some("CmdOrCtrl+Tab"))),
    Some(("tab.previous", "&Previous Tab", Some("CmdOrCtrl+Shift+Tab"))),
    None,
    Some(("view.fullscreen", "F&ull Screen", Some("F11"))),
];

const HELP_MENU: &[Entry] = &[
    Some(("app.shortcuts", "&Keyboard Shortcuts", Some("CmdOrCtrl+/"))),
    None,
    Some(("app.about", "&About Markdown Viewer", None)),
];

fn submenu<R: Runtime>(
    app: &AppHandle<R>,
    title: &str,
    entries: &[Entry],
) -> tauri::Result<tauri::menu::Submenu<R>> {
    let mut builder = SubmenuBuilder::new(app, title);
    for entry in entries {
        builder = match entry {
            Some((id, label, accelerator)) => {
                let mut item = MenuItemBuilder::with_id(*id, *label);
                if let Some(accelerator) = accelerator {
                    item = item.accelerator(*accelerator);
                }
                builder.item(&item.build(app)?)
            }
            None => builder.separator(),
        };
    }
    builder.build()
}

pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let file = submenu(app, "&File", FILE_MENU)?;
    let edit = SubmenuBuilder::new(app, "&Edit").copy().separator().select_all().build()?;
    let view = submenu(app, "&View", VIEW_MENU)?;
    let help = submenu(app, "&Help", HELP_MENU)?;
    MenuBuilder::new(app).items(&[&file, &edit, &view, &help]).build()
}

pub fn on_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    let id = event.id().as_ref();
    let known = [FILE_MENU, VIEW_MENU, HELP_MENU]
        .iter()
        .flat_map(|entries| entries.iter().flatten())
        .any(|(entry_id, _, _)| *entry_id == id);
    if !known {
        // Predefined items (copy, select all) are handled natively.
        return;
    }
    if let Err(err) = app.emit(MENU_ACTION_EVENT, id) {
        log::error!("failed to emit {MENU_ACTION_EVENT}: {err}");
    }
}
