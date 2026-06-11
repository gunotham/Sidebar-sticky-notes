document.addEventListener("DOMContentLoaded", () => {
    const notesList = document.getElementById("notes-list");
    const searchInput = document.getElementById("search-input");
    const noteContent = document.getElementById("note-content");
    const newNoteBtn = document.getElementById("new-note");
    const themeToggle = document.getElementById("theme-checkbox");
    const confirmDialog = document.getElementById("confirm-dialog");
    const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
    const cancelDeleteBtn = document.getElementById("cancel-delete-btn");

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
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        themeToggle.checked = theme === 'dark';
    }

    async function loadTheme() {
        const data = await browser.storage.local.get('theme');
        applyTheme(data.theme || 'light'); // Default to light theme
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
    themeToggle.addEventListener('change', () => {
        const newTheme = themeToggle.checked ? 'dark' : 'light';
        applyTheme(newTheme);
        browser.storage.local.set({ theme: newTheme });
    });

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
    loadTheme();
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