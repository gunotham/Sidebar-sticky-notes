document.addEventListener("DOMContentLoaded", () => {
    const notesList = document.getElementById("notes-list");
    const searchInput = document.getElementById("search-input");
    const noteContent = document.getElementById("note-content");
    const newNoteBtn = document.getElementById("new-note");
    const confirmDialog = document.getElementById("confirm-dialog");
    const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
    const cancelDeleteBtn = document.getElementById("cancel-delete-btn");
    const settingsBtn = document.getElementById("settings-btn");
    const settingsDialog = document.getElementById("settings-dialog");
    const closeSettingsBtn = document.getElementById("close-settings-btn");
    const themeRadios = document.querySelectorAll("input[name='theme-mode']");
    const browserThemeOption = document.getElementById("browser-theme-option");
    const themePrompt = document.getElementById("theme-prompt");
    const useBrowserThemeBtn = document.getElementById("use-browser-theme-btn");
    const declineBrowserThemeBtn = document.getElementById("decline-browser-theme-btn");

    let notes = [];
    let searchQuery = "";
    let currentNoteId = null;
    let saveTimeout;
    let noteIdToDelete = null;

    // --- Helper Functions ---
    function getAutoTitle(content) {
        if (!content) return "New Note";
        const firstLine = content.split('\n')[0];
        const words = firstLine.trim().split(/\s+/).slice(0, 3).join(' ');
        return words || "New Note";
    }

    // --- Theme Logic ---
    // themeMode: 'system' | 'light' | 'dark' | 'browser'
    //   system  -> follow OS prefers-color-scheme (M3 palette)
    //   light/dark -> forced M3 palette
    //   browser -> colors pulled from the installed Firefox theme
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    let themeMode = 'system';
    let browserTheme = null; // last theme.getCurrent()/onUpdated value

    function hasThemeColors(theme) {
        const c = theme && theme.colors;
        return !!(c && (c.sidebar || c.frame || c.toolbar || c.ntp_background));
    }

    function applyMode(mode) {
        themeMode = mode;
        const base = (mode === 'light') ? 'light'
                   : (mode === 'dark')  ? 'dark'
                   : (prefersDark.matches ? 'dark' : 'light'); // system + browser fallback
        document.documentElement.setAttribute('data-theme', base);
        applyThemeColors(mode === 'browser' ? browserTheme : null);
    }

    async function saveThemeMode(mode) {
        applyMode(mode);
        syncSettingsUI();
        await browser.storage.local.set({ themeMode: mode, themeOnboarded: true });
    }

    function syncSettingsUI() {
        themeRadios.forEach(r => { r.checked = r.value === themeMode; });
        const available = hasThemeColors(browserTheme);
        browserThemeOption.classList.toggle('disabled', !available);
        const browserRadio = document.querySelector("input[name='theme-mode'][value='browser']");
        if (browserRadio) browserRadio.disabled = !available;
    }

    // Re-evaluate when the OS light/dark preference flips.
    prefersDark.addEventListener('change', () => {
        if (themeMode === 'system' || themeMode === 'browser') applyMode(themeMode);
    });

    // --- Browser Theme Integration ---
    // Map the installed Firefox theme's colors onto our CSS vars. Anything the
    // theme doesn't define falls back to the built-in M3 palette.
    const THEME_VAR_MAP = {
        '--bg-color':         c => c.sidebar || c.ntp_background || c.frame,
        '--note-list-bg':     c => c.sidebar || c.frame,
        '--textarea-bg':      c => c.sidebar || c.ntp_background || c.frame,
        '--header-bg':        c => c.frame || c.toolbar || c.sidebar,
        '--field-bg':         c => c.toolbar_field,
        '--text-color':       c => c.sidebar_text || c.toolbar_text || c.tab_background_text,
        '--text-muted':       c => c.icons || c.sidebar_text || c.toolbar_text,
        '--border-color':     c => c.sidebar_border || c.toolbar_field_border,
        '--primary':          c => c.sidebar_highlight || c.toolbar_field_focus,
        '--on-primary':       c => c.sidebar_highlight_text || c.toolbar_field_text,
        '--active-note-bg':   c => c.sidebar_highlight || c.toolbar_field,
        '--active-note-text': c => c.sidebar_highlight_text || c.sidebar_text,
        '--button-hover-color': c => c.sidebar_highlight || c.toolbar_field_focus,
    };

    function applyThemeColors(theme) {
        const root = document.documentElement.style;
        const colors = (theme && theme.colors) || null;
        for (const [varName, pick] of Object.entries(THEME_VAR_MAP)) {
            const value = colors ? pick(colors) : null;
            if (value) {
                root.setProperty(varName, value);
            } else {
                root.removeProperty(varName); // revert to stylesheet/M3 default
            }
        }
    }

    async function initTheme() {
        // Capture the installed theme and keep it live.
        if (browser.theme && browser.theme.getCurrent) {
            try {
                browserTheme = await browser.theme.getCurrent();
                if (browser.theme.onUpdated) {
                    browser.theme.onUpdated.addListener(({ theme }) => {
                        browserTheme = theme;
                        if (themeMode === 'browser') applyThemeColors(theme);
                        syncSettingsUI();
                    });
                }
            } catch (e) {
                browserTheme = null; // no permission / unsupported
            }
        }

        const data = await browser.storage.local.get(['themeMode', 'theme', 'themeOnboarded']);

        if (data.themeMode) {
            applyMode(data.themeMode);
        } else if (data.theme === 'light' || data.theme === 'dark') {
            // Migrate legacy stored theme; existing users skip onboarding.
            await browser.storage.local.set({ themeMode: data.theme, themeOnboarded: true });
            applyMode(data.theme);
        } else if (!data.themeOnboarded && hasThemeColors(browserTheme)) {
            // First run with a custom browser theme present — ask the user.
            applyMode('system');
            themePrompt.classList.remove('hidden');
        } else {
            await browser.storage.local.set({ themeMode: 'system', themeOnboarded: true });
            applyMode('system');
        }
        syncSettingsUI();
    }

    async function resolveThemePrompt(useBrowser) {
        themePrompt.classList.add('hidden');
        await saveThemeMode(useBrowser ? 'browser' : 'system');
    }

    // --- Data and Storage ---
    async function loadNotes() {
        const data = await browser.storage.local.get(["notes", "currentNoteId"]);
        
        let loadedNotes = (data.notes && data.notes.length > 0) 
            ? data.notes
            : [{ id: crypto.randomUUID(), title: "My first note", content: "This is your first note!", titleManuallySet: true }];

        notes = loadedNotes.map(note => ({
            id: note.id,
            title: note.title || getAutoTitle(note.content),
            content: note.content || "",
            titleManuallySet: note.titleManuallySet || false
        }));

        const storedId = data.currentNoteId;
        if (storedId && notes.some(note => note.id === storedId)) {
            currentNoteId = storedId;
        } else {
            currentNoteId = notes[0].id;
        }

        renderNotesList();
        displayNoteContent();
    }

    async function saveNotes() {
        await browser.storage.local.set({ notes, currentNoteId });
    }

    // --- UI Rendering ---
    function renderNotesList() {
        notesList.innerHTML = "";

        const q = searchQuery.trim().toLowerCase();
        const visibleNotes = q
            ? notes.filter(note =>
                note.title.toLowerCase().includes(q) ||
                note.content.toLowerCase().includes(q))
            : notes;

        if (visibleNotes.length === 0) {
            const empty = document.createElement("div");
            empty.classList.add("no-results");
            empty.textContent = "No matching notes";
            notesList.appendChild(empty);
            return;
        }

        visibleNotes.forEach(note => {
            const noteElement = document.createElement("div");
            noteElement.classList.add("note-item");
            if (note.id === currentNoteId) {
                noteElement.classList.add("active");
            }
            noteElement.dataset.noteId = note.id;

            const title = document.createElement("span");
            title.classList.add("note-title");
            title.textContent = note.title;

            const actionsContainer = document.createElement("div");
            actionsContainer.classList.add("note-actions");

            const editBtn = document.createElement("button");
            editBtn.classList.add("edit-note");
            editBtn.innerHTML = "&#9998;"; // Pencil icon
            editBtn.title = "Rename Note";
            editBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                editNoteTitle(note.id);
            });
            
            const deleteBtn = document.createElement("button");
            deleteBtn.classList.add("delete-note");
            deleteBtn.innerHTML = "&times;";
            deleteBtn.title = "Delete Note";
            deleteBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                deleteNote(note.id);
            });

            actionsContainer.appendChild(editBtn);
            actionsContainer.appendChild(deleteBtn);

            noteElement.appendChild(title);
            noteElement.appendChild(actionsContainer);

            noteElement.addEventListener("click", () => switchNote(note.id));

            notesList.appendChild(noteElement);
        });
    }

    function displayNoteContent() {
        const note = notes.find(n => n.id === currentNoteId);
        if (note) {
            noteContent.value = note.content;
        } else {
            noteContent.value = "";
        }
    }

    function editNoteTitle(id) {
        const noteElement = notesList.querySelector(`.note-item[data-note-id='${id}']`);
        if (noteElement.querySelector('input')) return;

        const titleSpan = noteElement.querySelector('.note-title');
        const currentTitle = titleSpan.textContent;

        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentTitle;
        
        titleSpan.replaceWith(input);
        input.focus();
        input.select();

        const saveEdit = () => {
            const newTitle = input.value.trim();
            const note = notes.find(n => n.id === id);

            if (note && newTitle) {
                let finalTitle = newTitle;
                let counter = 2;
                while (notes.some(n => n.id !== id && n.title === finalTitle)) {
                    finalTitle = `${newTitle} ${counter}`;
                    counter++;
                }
                note.title = finalTitle;
                note.titleManuallySet = true;
            }
            
            saveNotes();
            renderNotesList();
        };

        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            } else if (e.key === 'Escape') {
                input.removeEventListener('blur', saveEdit);
                renderNotesList();
            }
        });
    }

    // --- Core Logic ---
    function switchNote(id) {
        currentNoteId = id;
        renderNotesList();
        displayNoteContent();
        noteContent.focus();
        saveNotes();
    }

    function deleteNote(id) {
        noteIdToDelete = id;
        confirmDialog.classList.remove('hidden');
    }

    async function confirmDelete() {
        try {
            if (!noteIdToDelete) return;

            notes = notes.filter(note => note.id !== noteIdToDelete);
            
            if (notes.length === 0) {
                notes.push({ id: crypto.randomUUID(), title: "New Note", content: "", titleManuallySet: false });
            }

            if (currentNoteId === noteIdToDelete) {
                currentNoteId = notes[0].id;
            }
            
            await saveNotes();
            switchNote(currentNoteId);
        } finally {
            noteIdToDelete = null;
            confirmDialog.classList.add('hidden');
        }
    }

    function cancelDelete() {
        noteIdToDelete = null;
        confirmDialog.classList.add('hidden');
    }

    // --- Event Listeners ---
    settingsBtn.addEventListener("click", () => {
        syncSettingsUI();
        settingsDialog.classList.remove('hidden');
    });
    closeSettingsBtn.addEventListener("click", () => settingsDialog.classList.add('hidden'));
    settingsDialog.addEventListener("click", (e) => {
        if (e.target === settingsDialog) settingsDialog.classList.add('hidden');
    });
    themeRadios.forEach(radio => {
        radio.addEventListener('change', () => { if (radio.checked) saveThemeMode(radio.value); });
    });

    useBrowserThemeBtn.addEventListener("click", () => resolveThemePrompt(true));
    declineBrowserThemeBtn.addEventListener("click", () => resolveThemePrompt(false));

    newNoteBtn.addEventListener("click", async () => {
        const newNote = { id: crypto.randomUUID(), title: "New Note", content: "", titleManuallySet: false };
        searchQuery = "";
        searchInput.value = "";
        notes.unshift(newNote);
        await saveNotes();
        switchNote(newNote.id);
        editNoteTitle(newNote.id);
    });

    noteContent.addEventListener("input", () => {
        clearTimeout(saveTimeout);
        const note = notes.find(n => n.id === currentNoteId);
        if (note) {
            note.content = noteContent.value;
            
            if (!note.titleManuallySet) {
                note.title = getAutoTitle(note.content);
                const titleElement = notesList.querySelector(`.note-item.active .note-title`);
                if (titleElement) {
                    titleElement.textContent = note.title;
                }
            }
            
            saveTimeout = setTimeout(saveNotes, 300);
        }
    });

    searchInput.addEventListener("input", () => {
        searchQuery = searchInput.value;
        renderNotesList();
    });

    confirmDeleteBtn.addEventListener("click", confirmDelete);
    cancelDeleteBtn.addEventListener("click", cancelDelete);

    // --- Initial Load ---
    initTheme();
    loadNotes();

    // --- Resizer Logic ---
    const resizer = document.getElementById('resizer');
    const notesPane = document.getElementById('notes-pane');

    browser.storage.local.get('notesListWidth').then(data => {
        if (data.notesListWidth) {
            notesPane.style.width = data.notesListWidth;
        }
    });

    resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();

        const startX = e.clientX;
        const startWidth = notesPane.offsetWidth;

        const doDrag = (e) => {
            const newWidth = startWidth + e.clientX - startX;
            const minWidth = parseInt(getComputedStyle(notesPane).minWidth);
            const maxWidth = parseInt(getComputedStyle(notesPane).maxWidth);

            if (newWidth > minWidth && newWidth < maxWidth) {
                notesPane.style.width = newWidth + 'px';
            }
        };

        const stopDrag = () => {
            document.removeEventListener('mousemove', doDrag);
            document.removeEventListener('mouseup', stopDrag);
            browser.storage.local.set({ notesListWidth: notesPane.style.width });
        };

        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);
    });
});