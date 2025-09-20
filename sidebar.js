document.addEventListener("DOMContentLoaded", () => {
    const notesList = document.getElementById("notes-list");
    const noteContent = document.getElementById("note-content");
    const newNoteBtn = document.getElementById("new-note");
    const themeToggle = document.getElementById("theme-checkbox");

    let notes = [];
    let currentNoteId = null;
    let saveTimeout;

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
            : [{ id: Date.now(), title: "My first note", content: "This is your first note!", titleManuallySet: true }];

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
        notes.forEach(note => {
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
            noteContent.focus();
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
        saveNotes();
    }

    async function deleteNote(id) {
        notes = notes.filter(note => note.id !== id);
        
        if (notes.length === 0) {
            notes.push({ id: Date.now(), title: "New Note", content: "", titleManuallySet: false });
        }

        if (currentNoteId === id) {
            currentNoteId = notes[0].id;
        }
        
        await saveNotes();
        switchNote(currentNoteId);
    }

    // --- Event Listeners ---
    themeToggle.addEventListener('change', () => {
        const newTheme = themeToggle.checked ? 'dark' : 'light';
        applyTheme(newTheme);
        browser.storage.local.set({ theme: newTheme });
    });

    newNoteBtn.addEventListener("click", async () => {
        const newNote = { id: Date.now(), title: "New Note", content: "", titleManuallySet: false };
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

    // --- Initial Load ---
    loadTheme();
    loadNotes();
});
