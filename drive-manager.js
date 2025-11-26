// Google Drive Manager for C/C++ Files
// Handles OAuth, file operations, and integration with the compiler editor

// Configuration
const DRIVE_CONFIG = {
    CLIENT_ID: '197129445780-ci0d4s2pbkk53784fuli7us95qhmm8ji.apps.googleusercontent.com', // User needs to set their Google OAuth Client ID
    API_KEY: 'AIzaSyAqH8AsRhlOw4vOQ6EmRUyBpVoOi0IoGCA', // User needs to set their Google API Key
    DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    SCOPES: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
    FOLDER_NAME: 'CompilerFiles',
    ALLOWED_EXTENSIONS: ['.c', '.cpp', '.h', '.hpp'],
    MIME_TYPES: {
        '.c': 'text/x-csrc',
        '.cpp': 'text/x-c++src',
        '.h': 'text/x-csrc',
        '.hpp': 'text/x-c++src'
    }
};

// State management
let driveState = {
    isSignedIn: false,
    currentUser: null,
    currentFile: null,
    files: [],
    folderId: null,
    gapiLoaded: false,
    gisLoaded: false,
    editor: null,
    hasUnsavedChanges: false
};

// Token client variable
let tokenClient = null;

// Initialize Google APIs
function initializeGoogleAPIs() {
    // Validate API key format
    if (!DRIVE_CONFIG.API_KEY || DRIVE_CONFIG.API_KEY.startsWith('GOCSPX-')) {
        console.error('Invalid API Key format. API Keys should start with "AIza..." not "GOCSPX-"');
        showNotification('Invalid API Key format. Please check your API Key in Google Cloud Console.', 'error');
        return;
    }

    // Load Google API
    gapi.load('client', async () => {
        try {
            await gapi.client.init({
                apiKey: DRIVE_CONFIG.API_KEY,
                discoveryDocs: DRIVE_CONFIG.DISCOVERY_DOCS,
            });
            driveState.gapiLoaded = true;
            console.log('Google API loaded successfully');
        } catch (error) {
            console.error('Error loading Google API:', error);
            let errorMessage = 'Failed to load Google Drive API';

            // Provide more specific error messages
            if (error.message && error.message.includes('API discovery response missing required fields')) {
                errorMessage = 'API Key issue: Check if Google Drive API is enabled and API Key is correct. See FIX_API_DISCOVERY_ERROR.md';
                console.error('Troubleshooting:');
                console.error('1. Verify API Key in localStorage:', localStorage.getItem('gdrive_api_key'));
                console.error('2. Check Google Cloud Console: APIs & Services > Library > Google Drive API (should be enabled)');
                console.error('3. Verify API Key restrictions allow Google Drive API');
            } else if (error.message && error.message.includes('403')) {
                errorMessage = 'API Key access denied. Check API Key restrictions in Google Cloud Console.';
            } else if (error.message && error.message.includes('400')) {
                errorMessage = 'Invalid API Key. Please verify your API Key is correct.';
            }

            showNotification(errorMessage, 'error');
        }
    });

    // Initialize Google Identity Services
    if (typeof google !== 'undefined' && google.accounts) {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: DRIVE_CONFIG.CLIENT_ID,
            scope: DRIVE_CONFIG.SCOPES,
            callback: handleTokenResponse,
        });
        driveState.gisLoaded = true;
        console.log('Token client initialized with scopes:', DRIVE_CONFIG.SCOPES);
    }
}

// Handle OAuth token response
function handleTokenResponse(response) {
    if (response.error) {
        showNotification('Failed to authenticate with Google Drive', 'error');
        console.error('OAuth error:', response.error);
        return;
    }

    // Set the access token on gapi client
    if (response.access_token) {
        gapi.client.setToken({
            access_token: response.access_token
        });
        console.log('OAuth token set on gapi client');
    }

    driveState.isSignedIn = true;
    getUserInfo();
    findOrCreateFolder();
    showNotification('Successfully connected to Google Drive', 'success');
}

// Get user information
async function getUserInfo() {
    try {
        // Check if token is set
        const token = gapi.client.getToken();
        if (!token || !token.access_token) {
            console.warn('No access token available. Waiting for token...');
            // Retry after a short delay
            setTimeout(() => getUserInfo(), 500);
            return;
        }

        // Try using direct fetch with Authorization header (more reliable)
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                'Authorization': `Bearer ${token.access_token}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const userData = await response.json();
        driveState.currentUser = userData;
        updateUserUI();
        loadFiles();
    } catch (error) {
        console.error('Error getting user info:', error);

        // If userinfo fails, try to get basic info from Drive API about endpoint
        if (error.status === 401 || error.message.includes('401')) {
            console.log('Userinfo endpoint failed, trying Drive API about endpoint...');
            try {
                const aboutResponse = await gapi.client.drive.about.get({
                    fields: 'user'
                });
                if (aboutResponse.result && aboutResponse.result.user) {
                    driveState.currentUser = {
                        email: aboutResponse.result.user.emailAddress,
                        name: aboutResponse.result.user.displayName,
                        picture: aboutResponse.result.user.photoLink || ''
                    };
                    updateUserUI();
                    loadFiles();
                    return;
                }
            } catch (driveError) {
                console.error('Drive about endpoint also failed:', driveError);
            }

            showNotification('Could not get user info. Drive features may still work.', 'error');
            // Don't reset sign-in state - Drive operations might still work
            // Just skip user info display
            loadFiles(); // Try to load files anyway
        } else {
            showNotification('Failed to get user information', 'error');
        }
    }
}

// Update user UI
function updateUserUI() {
    const userInfo = document.getElementById('driveUserInfo');
    const linkBtn = document.getElementById('linkDriveBtn');
    const fileManager = document.getElementById('driveFileManager');

    if (driveState.isSignedIn && driveState.currentUser) {
        document.getElementById('userName').textContent = driveState.currentUser.name || 'User';
        document.getElementById('userEmail').textContent = driveState.currentUser.email || '';
        document.getElementById('userAvatar').src = driveState.currentUser.picture || '';

        userInfo.style.display = 'flex';
        linkBtn.style.display = 'none';
        fileManager.style.display = 'block';
    } else {
        userInfo.style.display = 'none';
        linkBtn.style.display = 'flex';
        fileManager.style.display = 'none';
    }
}

// Find or create CompilerFiles folder
async function findOrCreateFolder() {
    try {
        // Search for existing folder
        const response = await gapi.client.drive.files.list({
            q: `name='${DRIVE_CONFIG.FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        if (response.result.files && response.result.files.length > 0) {
            driveState.folderId = response.result.files[0].id;
            console.log('Found existing folder:', driveState.folderId);
        } else {
            // Create new folder
            const createResponse = await gapi.client.drive.files.create({
                resource: {
                    name: DRIVE_CONFIG.FOLDER_NAME,
                    mimeType: 'application/vnd.google-apps.folder'
                },
                fields: 'id, name'
            });
            driveState.folderId = createResponse.result.id;
            console.log('Created new folder:', driveState.folderId);
            showNotification('Created CompilerFiles folder in your Drive', 'info');
        }
    } catch (error) {
        console.error('Error finding/creating folder:', error);
        showNotification('Failed to access Drive folder', 'error');
    }
}

// Load files from Google Drive
async function loadFiles() {
    if (!driveState.folderId) {
        await findOrCreateFolder();
    }

    try {
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = '<div class="file-list-empty">Loading files...</div>';

        // Build query to filter C/C++ files in the folder
        const extensionQuery = DRIVE_CONFIG.ALLOWED_EXTENSIONS
            .map(ext => `name contains '${ext}'`)
            .join(' or ');

        const response = await gapi.client.drive.files.list({
            q: `'${driveState.folderId}' in parents and (${extensionQuery}) and trashed=false`,
            fields: 'files(id, name, mimeType, modifiedTime, size)',
            orderBy: 'modifiedTime desc',
            spaces: 'drive'
        });

        driveState.files = response.result.files || [];
        displayFiles(driveState.files);
    } catch (error) {
        console.error('Error loading files:', error);
        showNotification('Failed to load files from Drive', 'error');
        document.getElementById('fileList').innerHTML = '<div class="file-list-empty">Error loading files</div>';
    }
}

// Display files in the list
function displayFiles(files) {
    const fileList = document.getElementById('fileList');

    if (files.length === 0) {
        fileList.innerHTML = '<div class="file-list-empty">No C/C++ files found. Create or upload a file to get started.</div>';
        return;
    }

    // Apply search filter
    const searchTerm = document.getElementById('fileSearch').value.toLowerCase();
    let filteredFiles = files.filter(file =>
        file.name.toLowerCase().includes(searchTerm)
    );

    // Apply sorting
    const sortBy = document.getElementById('fileSort').value;
    filteredFiles.sort((a, b) => {
        switch (sortBy) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'modified':
                return new Date(b.modifiedTime) - new Date(a.modifiedTime);
            case 'type':
                return a.name.split('.').pop().localeCompare(b.name.split('.').pop());
            default:
                return 0;
        }
    });

    fileList.innerHTML = filteredFiles.map(file => {
        const extension = '.' + file.name.split('.').pop();
        const modifiedDate = new Date(file.modifiedTime).toLocaleDateString();
        const isActive = driveState.currentFile && driveState.currentFile.id === file.id;

        return `
            <div class="file-item ${isActive ? 'active' : ''}" data-file-id="${file.id}">
                <div class="file-item-info" onclick="openFile('${file.id}')">
                    <svg class="file-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                    </svg>
                    <div class="file-details">
                        <div class="file-name">${escapeHtml(file.name)}</div>
                        <div class="file-meta">${extension.toUpperCase()} • Modified: ${modifiedDate}</div>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="file-action-btn" onclick="downloadFile('${file.id}', '${escapeHtml(file.name)}')" title="Download">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                        </svg>
                    </button>
                    <button class="file-action-btn" onclick="renameFilePrompt('${file.id}', '${escapeHtml(file.name)}')" title="Rename">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c.39-.39.39-1.02 0-1.41l-1.83-1.83c-.39-.39-1.02-.39-1.41 0l-1.83 1.83c-.39.39-.39 1.02 0 1.41l2.34 2.34c.39.39 1.02.39 1.41 0l1.83-1.83c.39-.39 1.02-.39 1.41 0z"/>
                        </svg>
                    </button>
                    <button class="file-action-btn delete" onclick="deleteFilePrompt('${file.id}', '${escapeHtml(file.name)}')" title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Open file from Drive
async function openFile(fileId) {
    try {
        // Check for unsaved changes
        if (driveState.hasUnsavedChanges && driveState.currentFile) {
            if (!confirm('You have unsaved changes. Do you want to discard them and open this file?')) {
                return;
            }
        }

        const file = driveState.files.find(f => f.id === fileId);
        if (!file) {
            showNotification('File not found', 'error');
            return;
        }

        // Get file content
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });

        // Update editor
        if (driveState.editor) {
            driveState.editor.setValue(response.body);
            driveState.currentFile = file;
            driveState.hasUnsavedChanges = false;
            updateFileInfo();
            updateActiveFile(fileId);
            showNotification(`Opened ${file.name}`, 'success');
        }
    } catch (error) {
        console.error('Error opening file:', error);
        showNotification('Failed to open file from Drive', 'error');
    }
}

// Save file to Drive
async function saveFile() {
    if (!driveState.isSignedIn) {
        showNotification('Please connect to Google Drive first', 'error');
        return;
    }

    if (!driveState.folderId) {
        await findOrCreateFolder();
    }

    const code = driveState.editor ? driveState.editor.getValue() : '';
    const language = document.getElementById('languageSelect').value;
    const extension = language === '50' ? '.c' : '.cpp';

    try {
        const token = gapi.client.getToken();
        if (!token) {
            showNotification('Not authenticated. Please reconnect to Google Drive.', 'error');
            return;
        }

        if (driveState.currentFile) {
            // Update existing file using resumable upload
            const boundary = '-------314159265358979323846';
            const delimiter = '\r\n--' + boundary + '\r\n';
            const closeDelim = '\r\n--' + boundary + '--';

            const metadata = {
                name: driveState.currentFile.name
            };

            const multipartRequestBody =
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: text/plain\r\n\r\n' +
                code +
                closeDelim;

            const response = await fetch(
                `https://www.googleapis.com/upload/drive/v3/files/${driveState.currentFile.id}?uploadType=multipart`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${token.access_token}`,
                        'Content-Type': `multipart/related; boundary="${boundary}"`
                    },
                    body: multipartRequestBody
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            driveState.currentFile = result;
            showNotification(`Saved ${driveState.currentFile.name}`, 'success');
        } else {
            // Create new file
            const fileName = prompt('Enter file name (without extension):', 'untitled');
            if (!fileName) return;

            const fullFileName = fileName + extension;
            if (!validateFileName(fullFileName)) {
                showNotification('Invalid file extension. Only .c, .cpp, .h, .hpp are allowed.', 'error');
                return;
            }

            const boundary = '-------314159265358979323846';
            const delimiter = '\r\n--' + boundary + '\r\n';
            const closeDelim = '\r\n--' + boundary + '--';

            const metadata = {
                name: fullFileName,
                parents: [driveState.folderId]
            };

            const multipartRequestBody =
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: text/plain\r\n\r\n' +
                code +
                closeDelim;

            const response = await fetch(
                'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token.access_token}`,
                        'Content-Type': `multipart/related; boundary="${boundary}"`
                    },
                    body: multipartRequestBody
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            driveState.currentFile = result;
            showNotification(`Created and saved ${fullFileName}`, 'success');
        }

        driveState.hasUnsavedChanges = false;
        updateFileInfo();
        await loadFiles();
    } catch (error) {
        console.error('Error saving file:', error);
        showNotification('Failed to save file to Drive', 'error');
    }
}

// Create new file
function createFilePrompt() {
    const modal = document.getElementById('createFileModal');
    modal.style.display = 'flex';
    document.getElementById('newFileName').value = '';
    document.getElementById('newFileExtension').value = '.cpp';
}

// Create file with name and extension
async function createFile() {
    const fileName = document.getElementById('newFileName').value.trim();
    const extension = document.getElementById('newFileExtension').value;

    if (!fileName) {
        showNotification('Please enter a file name', 'error');
        return;
    }

    const fullFileName = fileName + extension;
    if (!validateFileName(fullFileName)) {
        showNotification('Invalid file extension. Only .c, .cpp, .h, .hpp are allowed.', 'error');
        return;
    }

    if (!driveState.folderId) {
        await findOrCreateFolder();
    }

    try {
        const token = gapi.client.getToken();
        if (!token) {
            showNotification('Not authenticated. Please reconnect to Google Drive.', 'error');
            return;
        }

        const boundary = '-------314159265358979323846';
        const delimiter = '\r\n--' + boundary + '\r\n';
        const closeDelim = '\r\n--' + boundary + '--';

        const metadata = {
            name: fullFileName,
            parents: [driveState.folderId]
        };

        const multipartRequestBody =
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            'Content-Type: text/plain\r\n\r\n' +
            closeDelim;

        const response = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token.access_token}`,
                    'Content-Type': `multipart/related; boundary="${boundary}"`
                },
                body: multipartRequestBody
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        // Open the new file in editor
        driveState.currentFile = result;
        if (driveState.editor) {
            driveState.editor.setValue('');
            driveState.hasUnsavedChanges = false;
            updateFileInfo();
        }

        document.getElementById('createFileModal').style.display = 'none';
        showNotification(`Created ${fullFileName}`, 'success');
        await loadFiles();
    } catch (error) {
        console.error('Error creating file:', error);
        showNotification('Failed to create file', 'error');
    }
}

// Upload file from computer
function uploadFile() {
    document.getElementById('fileUploadInput').click();
}

// Handle file upload
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!validateFileName(file.name)) {
        showNotification('Invalid file extension. Only .c, .cpp, .h, .hpp files are allowed.', 'error');
        return;
    }

    if (!driveState.folderId) {
        await findOrCreateFolder();
    }

    try {
        const token = gapi.client.getToken();
        if (!token) {
            showNotification('Not authenticated. Please reconnect to Google Drive.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target.result;

                const boundary = '-------314159265358979323846';
                const delimiter = '\r\n--' + boundary + '\r\n';
                const closeDelim = '\r\n--' + boundary + '--';

                const metadata = {
                    name: file.name,
                    parents: [driveState.folderId]
                };

                const multipartRequestBody =
                    delimiter +
                    'Content-Type: application/json\r\n\r\n' +
                    JSON.stringify(metadata) +
                    delimiter +
                    'Content-Type: text/plain\r\n\r\n' +
                    content +
                    closeDelim;

                const response = await fetch(
                    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token.access_token}`,
                            'Content-Type': `multipart/related; boundary="${boundary}"`
                        },
                        body: multipartRequestBody
                    }
                );

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();
                showNotification(`Uploaded ${file.name}`, 'success');
                await loadFiles();
            } catch (error) {
                console.error('Error uploading file:', error);
                showNotification('Failed to upload file', 'error');
            }
        };
        reader.readAsText(file);
    } catch (error) {
        console.error('Error uploading file:', error);
        showNotification('Failed to upload file', 'error');
    }

    // Reset input
    event.target.value = '';
}

// Download file
async function downloadFile(fileId, fileName) {
    try {
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });

        const blob = new Blob([response.body], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showNotification(`Downloaded ${fileName}`, 'success');
    } catch (error) {
        console.error('Error downloading file:', error);
        showNotification('Failed to download file', 'error');
    }
}

// Rename file
function renameFilePrompt(fileId, currentName) {
    const newName = prompt('Enter new file name:', currentName);
    if (!newName || newName === currentName) return;

    if (!validateFileName(newName)) {
        showNotification('Invalid file extension. Only .c, .cpp, .h, .hpp are allowed.', 'error');
        return;
    }

    renameFile(fileId, newName);
}

// Rename file in Drive
async function renameFile(fileId, newName) {
    try {
        await gapi.client.drive.files.update({
            fileId: fileId,
            resource: {
                name: newName
            }
        });

        if (driveState.currentFile && driveState.currentFile.id === fileId) {
            driveState.currentFile.name = newName;
            updateFileInfo();
        }

        showNotification(`Renamed to ${newName}`, 'success');
        await loadFiles();
    } catch (error) {
        console.error('Error renaming file:', error);
        showNotification('Failed to rename file', 'error');
    }
}

// Delete file
function deleteFilePrompt(fileId, fileName) {
    if (confirm(`Are you sure you want to delete "${fileName}"? This will move it to trash.`)) {
        deleteFile(fileId);
    }
}

// Delete file from Drive
async function deleteFile(fileId) {
    try {
        await gapi.client.drive.files.update({
            fileId: fileId,
            resource: {
                trashed: true
            }
        });

        if (driveState.currentFile && driveState.currentFile.id === fileId) {
            driveState.currentFile = null;
            driveState.hasUnsavedChanges = false;
            updateFileInfo();
        }

        showNotification('File moved to trash', 'success');
        await loadFiles();
    } catch (error) {
        console.error('Error deleting file:', error);
        showNotification('Failed to delete file', 'error');
    }
}

// Validate file name
function validateFileName(fileName) {
    const extension = '.' + fileName.split('.').pop().toLowerCase();
    return DRIVE_CONFIG.ALLOWED_EXTENSIONS.includes(extension);
}

// Update file info display
function updateFileInfo() {
    const fileInfo = document.getElementById('fileInfo');
    const currentFileName = document.getElementById('currentFileName');
    const unsavedIndicator = document.getElementById('unsavedIndicator');
    const saveBtn = document.getElementById('saveFileBtn');

    if (driveState.currentFile) {
        currentFileName.textContent = driveState.currentFile.name;
        fileInfo.style.display = 'flex';
        saveBtn.style.display = 'flex';
        unsavedIndicator.style.display = driveState.hasUnsavedChanges ? 'inline' : 'none';
    } else {
        fileInfo.style.display = 'none';
        saveBtn.style.display = 'none';
    }
}

// Update active file in list
function updateActiveFile(fileId) {
    document.querySelectorAll('.file-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.fileId === fileId) {
            item.classList.add('active');
        }
    });
}

// Unlink Google Drive
function unlinkDrive() {
    if (confirm('Are you sure you want to unlink Google Drive? You will need to reconnect to access your files.')) {
        if (gapi.client.getToken()) {
            google.accounts.oauth2.revoke(gapi.client.getToken().access_token);
            gapi.client.setToken('');
        }

        driveState.isSignedIn = false;
        driveState.currentUser = null;
        driveState.currentFile = null;
        driveState.files = [];
        driveState.folderId = null;
        driveState.hasUnsavedChanges = false;

        updateUserUI();
        updateFileInfo();
        showNotification('Disconnected from Google Drive', 'info');
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    const icons = {
        success: '✓',
        error: '✕',
        info: 'ℹ'
    };

    notification.innerHTML = `
        <span class="notification-icon">${icons[type] || icons.info}</span>
        <div class="notification-content">
            <div class="notification-message">${escapeHtml(message)}</div>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    // Use hardcoded credentials by default (for production)
    // localStorage values are optional (for development/testing only)
    const savedClientId = localStorage.getItem('gdrive_client_id');
    const savedApiKey = localStorage.getItem('gdrive_api_key');

    // Override with localStorage values if they exist (for development)
    if (savedClientId) {
        DRIVE_CONFIG.CLIENT_ID = savedClientId;
        console.log('Using Client ID from localStorage (development mode)');
    }
    if (savedApiKey) {
        DRIVE_CONFIG.API_KEY = savedApiKey;
        console.log('Using API Key from localStorage (development mode)');
    }

    // Validate that credentials are set
    if (!DRIVE_CONFIG.CLIENT_ID || !DRIVE_CONFIG.API_KEY) {
        console.error('Google Drive credentials not configured!');
        document.getElementById('driveSetupBanner').style.display = 'block';
        return;
    }

    // Hide setup banner and initialize
    document.getElementById('driveSetupBanner').style.display = 'none';
    initializeGoogleAPIs();

    // Event listeners
    document.getElementById('linkDriveBtn').addEventListener('click', () => {
        if (!tokenClient) {
            showNotification('Google APIs not loaded. Please check your API credentials.', 'error');
            return;
        }
        tokenClient.requestAccessToken({ prompt: 'consent' });
    });

    document.getElementById('unlinkDriveBtn').addEventListener('click', unlinkDrive);
    document.getElementById('refreshFilesBtn').addEventListener('click', loadFiles);
    document.getElementById('createFileBtn').addEventListener('click', createFilePrompt);
    document.getElementById('uploadFileBtn').addEventListener('click', uploadFile);
    document.getElementById('fileUploadInput').addEventListener('change', handleFileUpload);
    document.getElementById('fileSearch').addEventListener('input', () => displayFiles(driveState.files));
    document.getElementById('fileSort').addEventListener('change', () => displayFiles(driveState.files));
    document.getElementById('saveFileBtn').addEventListener('click', saveFile);
    document.getElementById('createFileSubmitBtn').addEventListener('click', createFile);
    document.getElementById('createFileCancelBtn').addEventListener('click', () => {
        document.getElementById('createFileModal').style.display = 'none';
    });
    document.getElementById('createFileModalClose').addEventListener('click', () => {
        document.getElementById('createFileModal').style.display = 'none';
    });

    // Track editor changes - wait for editor to be available
    const checkEditor = setInterval(() => {
        if (window.editor) {
            driveState.editor = window.editor;
            window.editor.on('change', () => {
                if (driveState.currentFile) {
                    driveState.hasUnsavedChanges = true;
                    updateFileInfo();
                }
            });
            clearInterval(checkEditor);
        }
    }, 100);

    // Stop checking after 5 seconds
    setTimeout(() => clearInterval(checkEditor), 5000);
});

// Export functions for global access
window.openFile = openFile;
window.downloadFile = downloadFile;
window.renameFilePrompt = renameFilePrompt;
window.deleteFilePrompt = deleteFilePrompt;
window.saveFile = saveFile;
window.createFile = createFile;

