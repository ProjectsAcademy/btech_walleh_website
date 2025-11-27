// Google Drive Manager for C/C++ Files
// Handles OAuth, file operations, and integration with the compiler editor

// Configuration - Credentials will be loaded from serverless function
const DRIVE_CONFIG = {
    CLIENT_ID: '', // Will be loaded from environment variables via serverless function
    API_KEY: '', // Will be loaded from environment variables via serverless function
    DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    // Scope options:
    // 'drive.file' - Only files created by this app (more secure, limited)
    // 'drive.readonly' - Read all files in Drive (read-only)
    // 'drive' - Full access to all Drive files (read + write)
    // Using 'drive' to see all files in the folder, including manually uploaded ones
    SCOPES: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
    FOLDER_NAME: 'CompilerFiles',
    ALLOWED_EXTENSIONS: ['.c', '.cpp', '.h', '.hpp'],
    MIME_TYPES: {
        '.c': 'text/x-csrc',
        '.cpp': 'text/x-c++src',
        '.h': 'text/x-csrc',
        '.hpp': 'text/x-c++src'
    }
};

// Flag to track if credentials are loaded
let credentialsLoaded = false;

// State management
let driveState = {
    isSignedIn: false,
    currentUser: null,
    currentFile: null,
    files: [],
    folderId: null, // Root CompilerFiles folder ID
    currentProjectId: null, // Current project folder ID
    currentProjectName: null, // Current project name
    projects: [], // List of available projects
    directories: [], // List of directories when viewing root
    viewingRoot: false, // Whether we're viewing root directories
    gapiLoaded: false,
    gisLoaded: false,
    editor: null,
    hasUnsavedChanges: false,
    operationInProgress: false, // Track if any operation is running
    folderOperationInProgress: false // Track folder creation specifically
};

// Token client variable
let tokenClient = null;

// Initialize Google APIs
function initializeGoogleAPIs() {
    // Wait for gapi to be available
    if (typeof gapi === 'undefined') {
        console.log('Waiting for Google API script to load...');
        setTimeout(initializeGoogleAPIs, 100);
        return;
    }

    // Validate API key format
    if (!DRIVE_CONFIG.API_KEY || DRIVE_CONFIG.API_KEY.startsWith('GOCSPX-')) {
        console.error('Invalid API Key format. API Keys should start with "AIza..." not "GOCSPX-"');
        showNotification('Invalid API Key format. Please check your API Key in Google Cloud Console.', 'error');
        return;
    }

    // Load Google API
    // Suppress polyfill.js errors (usually from browser extensions)
    const originalConsoleError = console.error;
    console.error = function (...args) {
        // Filter out polyfill.js connection errors (harmless browser extension errors)
        if (args[0] && typeof args[0] === 'string' && args[0].includes('polyfill.js') && args[0].includes('Receiving end does not exist')) {
            return; // Suppress this error
        }
        originalConsoleError.apply(console, args);
    };

    gapi.load('client', async () => {
        try {
            await gapi.client.init({
                apiKey: DRIVE_CONFIG.API_KEY,
                discoveryDocs: DRIVE_CONFIG.DISCOVERY_DOCS,
            });
            driveState.gapiLoaded = true;
            console.log('Google API loaded successfully');

            // Restore original console.error after successful load
            console.error = originalConsoleError;
        } catch (error) {
            // Restore original console.error on error
            console.error = originalConsoleError;

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

    // Initialize Google Identity Services (wait for it to load)
    const initGoogleIdentity = () => {
        if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
            try {
                tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: DRIVE_CONFIG.CLIENT_ID,
                    scope: DRIVE_CONFIG.SCOPES,
                    callback: handleTokenResponse,
                });
                driveState.gisLoaded = true;
                console.log('Token client initialized with scopes:', DRIVE_CONFIG.SCOPES);
            } catch (error) {
                console.error('Error initializing token client:', error);
                driveState.gisLoaded = false;
            }
        } else {
            // Google Identity Services not loaded yet, wait and retry
            setTimeout(initGoogleIdentity, 100);
        }
    };

    // Start initialization (will retry if not ready)
    initGoogleIdentity();
}

// Handle OAuth token response
function handleTokenResponse(response) {
    if (response.error) {
        showNotification('Failed to authenticate with Google Drive', 'error');
        console.error('OAuth error:', response.error);
        driveState.operationInProgress = false;
        setButtonLoading('linkDriveBtn', false);
        return;
    }

    // Set loading state
    setButtonLoading('linkDriveBtn', true);

    // Set the access token on gapi client
    if (response.access_token) {
        gapi.client.setToken({
            access_token: response.access_token
        });
        console.log('OAuth token set on gapi client');
    }

    driveState.isSignedIn = true;

    // Run operations sequentially to prevent race conditions
    (async () => {
        try {
            await getUserInfo();
            await findOrCreateRootFolder();
            await loadProjects(); // Load projects but don't auto-select
            showNotification('Successfully connected to Google Drive', 'success');
        } catch (error) {
            console.error('Error during connection setup:', error);
        } finally {
            driveState.operationInProgress = false;
            setButtonLoading('linkDriveBtn', false);
        }
    })();
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
    const driveDescription = document.getElementById('driveDescription');

    if (driveState.isSignedIn && driveState.currentUser) {
        document.getElementById('userName').textContent = driveState.currentUser.name || 'User';
        document.getElementById('userEmail').textContent = driveState.currentUser.email || '';
        document.getElementById('userAvatar').src = driveState.currentUser.picture || '';

        userInfo.style.display = 'flex';
        linkBtn.style.display = 'none';
        fileManager.style.display = 'block';
        // Hide description when signed in to keep UI clean
        if (driveDescription) {
            driveDescription.style.display = 'none';
        }
    } else {
        userInfo.style.display = 'none';
        linkBtn.style.display = 'flex';
        fileManager.style.display = 'none';
        // Show description when not signed in
        if (driveDescription) {
            driveDescription.style.display = 'block';
        }
    }
}

// Find or create root CompilerFiles folder
async function findOrCreateRootFolder() {
    // Prevent multiple simultaneous folder operations
    if (driveState.folderOperationInProgress) {
        console.log('Folder operation already in progress, waiting...');
        // Wait for the current operation to complete
        while (driveState.folderOperationInProgress) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return; // Folder should be set by now
    }

    // If root folder already exists, return early
    if (driveState.folderId) {
        return;
    }

    driveState.folderOperationInProgress = true;

    try {
        // Search for existing root folder
        const response = await gapi.client.drive.files.list({
            q: `name='${DRIVE_CONFIG.FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false and 'root' in parents`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        if (response.result.files && response.result.files.length > 0) {
            driveState.folderId = response.result.files[0].id;
            console.log('Found existing root folder:', driveState.folderId);
        } else {
            // Create new root folder
            const createResponse = await gapi.client.drive.files.create({
                resource: {
                    name: DRIVE_CONFIG.FOLDER_NAME,
                    mimeType: 'application/vnd.google-apps.folder'
                },
                fields: 'id, name'
            });
            driveState.folderId = createResponse.result.id;
            console.log('Created new root folder:', driveState.folderId);
            showNotification('Created CompilerFiles folder in your Drive', 'info');
        }
    } catch (error) {
        console.error('Error finding/creating root folder:', error);
        showNotification('Failed to access Drive folder', 'error');
    } finally {
        driveState.folderOperationInProgress = false;
    }
}

// Find or create project folder
async function findOrCreateProjectFolder(projectName) {
    if (!driveState.folderId) {
        await findOrCreateRootFolder();
    }

    if (!projectName) {
        projectName = driveState.currentProjectName || 'Default Project';
    }

    try {
        // Search for existing project folder
        const response = await gapi.client.drive.files.list({
            q: `name='${projectName}' and mimeType='application/vnd.google-apps.folder' and trashed=false and '${driveState.folderId}' in parents`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        if (response.result.files && response.result.files.length > 0) {
            const projectId = response.result.files[0].id;
            driveState.currentProjectId = projectId;
            driveState.currentProjectName = projectName;
            return projectId;
        } else {
            // Create new project folder
            const createResponse = await gapi.client.drive.files.create({
                resource: {
                    name: projectName,
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: [driveState.folderId]
                },
                fields: 'id, name'
            });
            driveState.currentProjectId = createResponse.result.id;
            driveState.currentProjectName = projectName;
            console.log('Created new project folder:', projectName, createResponse.result.id);
            return createResponse.result.id;
        }
    } catch (error) {
        console.error('Error finding/creating project folder:', error);
        showNotification('Failed to create project folder', 'error');
        return null;
    }
}

// Load all projects (folders inside root folder)
async function loadProjects() {
    if (!driveState.folderId) {
        await findOrCreateRootFolder();
    }

    try {
        const response = await gapi.client.drive.files.list({
            q: `'${driveState.folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name, modifiedTime)',
            orderBy: 'modifiedTime desc',
            spaces: 'drive'
        });

        driveState.projects = response.result.files || [];
        // Don't auto-select any project - user must select manually
        updateProjectSelector();
        return driveState.projects;
    } catch (error) {
        console.error('Error loading projects:', error);
        showNotification('Failed to load projects', 'error');
        return [];
    }
}

// Update project selector UI
function updateProjectSelector() {
    const projectSelect = document.getElementById('projectSelect');
    if (!projectSelect) return;

    projectSelect.innerHTML = '';

    // Always add "Select Project" as first option
    const selectOption = document.createElement('option');
    selectOption.value = '';
    selectOption.textContent = 'Select Project';
    if (!driveState.currentProjectId && !driveState.viewingRoot) {
        selectOption.selected = true;
    }
    projectSelect.appendChild(selectOption);

    // Add "/root" option to view root directories
    const rootOption = document.createElement('option');
    rootOption.value = '/root';
    rootOption.textContent = '/root';
    if (driveState.viewingRoot) {
        rootOption.selected = true;
    }
    projectSelect.appendChild(rootOption);

    // Add all project folders
    driveState.projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        if (project.id === driveState.currentProjectId && !driveState.viewingRoot) {
            option.selected = true;
        }
        projectSelect.appendChild(option);
    });
}

// Create new project
async function createProject() {
    const projectName = prompt('Enter project name:', 'New Project');
    if (!projectName || !projectName.trim()) {
        return;
    }

    const trimmedName = projectName.trim();

    // Check if project with same name already exists
    const existingProject = driveState.projects.find(p => p.name.toLowerCase() === trimmedName.toLowerCase());
    if (existingProject) {
        showNotification('A project with this name already exists', 'error');
        return;
    }

    if (driveState.operationInProgress) {
        showNotification('Please wait for the current operation to complete', 'info');
        return;
    }

    driveState.operationInProgress = true;

    try {
        if (!driveState.folderId) {
            await findOrCreateRootFolder();
        }

        const projectId = await findOrCreateProjectFolder(trimmedName);
        if (projectId) {
            await loadProjects(); // Reload projects list
            driveState.currentProjectId = projectId;
            driveState.currentProjectName = trimmedName;
            updateProjectSelector();
            await loadFiles(); // Load files for new project
            showNotification(`Created project "${trimmedName}"`, 'success');
        }
    } catch (error) {
        console.error('Error creating project:', error);
        showNotification('Failed to create project', 'error');
    } finally {
        driveState.operationInProgress = false;
    }
}

// Load directories from root folder
async function loadRootDirectories() {
    if (!driveState.folderId) {
        await findOrCreateRootFolder();
    }

    try {
        const response = await gapi.client.drive.files.list({
            q: `'${driveState.folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name, modifiedTime)',
            orderBy: 'name',
            spaces: 'drive'
        });

        driveState.directories = response.result.files || [];
        return driveState.directories;
    } catch (error) {
        console.error('Error loading root directories:', error);
        showNotification('Failed to load directories', 'error');
        return [];
    }
}

// Switch to a different project or view root
async function switchProject(projectId) {
    // Handle empty selection (Select Project)
    if (!projectId || projectId === '') {
        driveState.currentProjectId = null;
        driveState.currentProjectName = null;
        driveState.viewingRoot = false;
        driveState.currentFile = null;
        driveState.hasUnsavedChanges = false;
        driveState.files = [];
        driveState.directories = [];

        // Clear editor
        if (driveState.editor) {
            const currentLanguage = document.getElementById('languageSelect')?.value || '54';
            let defaultCode;
            if (currentLanguage === '50') {
                defaultCode = `#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    printf("Welcome to B.Tech Walleh Online Compiler\\n");
    
    int num1 = 10, num2 = 20;
    int sum = num1 + num2;
    
    printf("Sum of %d and %d is: %d\\n", num1, num2, sum);
    
    return 0;
}`;
            } else {
                defaultCode = `#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    cout << "Welcome to B.Tech Walleh Online Compiler" << endl;
    
    int num1 = 10, num2 = 20;
    int sum = num1 + num2;
    
    cout << "Sum of " << num1 << " and " << num2 << " is: " << sum << endl;
    
    return 0;
}`;
            }
            driveState.editor.setValue(defaultCode);
        }

        document.getElementById('fileList').innerHTML = '<div class="file-list-empty">No project selected. Please select a project or /root.</div>';
        updateFileInfo();
        return;
    }

    // Handle /root option - show directories
    if (projectId === '/root') {
        // Check for unsaved changes
        if (driveState.hasUnsavedChanges && driveState.currentFile) {
            if (!confirm('You have unsaved changes. Do you want to discard them and view root?')) {
                updateProjectSelector();
                return;
            }
        }

        driveState.viewingRoot = true;
        driveState.currentProjectId = null;
        driveState.currentProjectName = null;
        driveState.currentFile = null;
        driveState.hasUnsavedChanges = false;

        // Clear editor
        if (driveState.editor) {
            const currentLanguage = document.getElementById('languageSelect')?.value || '54';
            let defaultCode;
            if (currentLanguage === '50') {
                defaultCode = `#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    printf("Welcome to B.Tech Walleh Online Compiler\\n");
    
    int num1 = 10, num2 = 20;
    int sum = num1 + num2;
    
    printf("Sum of %d and %d is: %d\\n", num1, num2, sum);
    
    return 0;
}`;
            } else {
                defaultCode = `#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    cout << "Welcome to B.Tech Walleh Online Compiler" << endl;
    
    int num1 = 10, num2 = 20;
    int sum = num1 + num2;
    
    cout << "Sum of " << num1 << " and " << num2 << " is: " << sum << endl;
    
    return 0;
}`;
            }
            driveState.editor.setValue(defaultCode);
        }

        await loadRootDirectories();
        displayDirectories(driveState.directories);
        updateFileInfo();
        return;
    }

    // Handle directory selection (when clicking on a directory from root view)
    // Check if this is a directory ID from the directories list
    const directory = driveState.directories.find(d => d.id === projectId);
    if (directory) {
        // Check for unsaved changes
        if (driveState.hasUnsavedChanges && driveState.currentFile) {
            if (!confirm('You have unsaved changes. Do you want to discard them and open this directory?')) {
                updateProjectSelector();
                return;
            }
        }

        driveState.viewingRoot = false;
        driveState.currentProjectId = projectId;
        driveState.currentProjectName = directory.name;
        driveState.currentFile = null;
        driveState.hasUnsavedChanges = false;

        // Clear editor
        if (driveState.editor) {
            const currentLanguage = document.getElementById('languageSelect')?.value || '54';
            let defaultCode;
            if (currentLanguage === '50') {
                defaultCode = `#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    printf("Welcome to B.Tech Walleh Online Compiler\\n");
    
    int num1 = 10, num2 = 20;
    int sum = num1 + num2;
    
    printf("Sum of %d and %d is: %d\\n", num1, num2, sum);
    
    return 0;
}`;
            } else {
                defaultCode = `#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    cout << "Welcome to B.Tech Walleh Online Compiler" << endl;
    
    int num1 = 10, num2 = 20;
    int sum = num1 + num2;
    
    cout << "Sum of " << num1 << " and " << num2 << " is: " << sum << endl;
    
    return 0;
}`;
            }
            driveState.editor.setValue(defaultCode);
        }

        updateProjectSelector();
        await loadFiles();
        showNotification(`Opened directory "${directory.name}"`, 'info');
        return;
    }

    // Handle regular project selection
    if (projectId === driveState.currentProjectId) {
        return;
    }

    // Check for unsaved changes
    if (driveState.hasUnsavedChanges && driveState.currentFile) {
        if (!confirm('You have unsaved changes. Do you want to discard them and switch project?')) {
            updateProjectSelector();
            return;
        }
    }

    const project = driveState.projects.find(p => p.id === projectId);
    if (!project) {
        showNotification('Project not found', 'error');
        updateProjectSelector();
        return;
    }

    driveState.viewingRoot = false;
    driveState.currentProjectId = projectId;
    driveState.currentProjectName = project.name;
    driveState.currentFile = null;
    driveState.hasUnsavedChanges = false;

    // Clear editor and reset to default code
    if (driveState.editor) {
        const currentLanguage = document.getElementById('languageSelect')?.value || '54';
        let defaultCode;
        if (currentLanguage === '50') {
            defaultCode = `#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    printf("Welcome to B.Tech Walleh Online Compiler\\n");
    
    int num1 = 10, num2 = 20;
    int sum = num1 + num2;
    
    printf("Sum of %d and %d is: %d\\n", num1, num2, sum);
    
    return 0;
}`;
        } else {
            defaultCode = `#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    cout << "Welcome to B.Tech Walleh Online Compiler" << endl;
    
    int num1 = 10, num2 = 20;
    int sum = num1 + num2;
    
    cout << "Sum of " << num1 << " and " << num2 << " is: " << sum << endl;
    
    return 0;
}`;
        }
        driveState.editor.setValue(defaultCode);
    }

    updateFileInfo();
    await loadFiles();
    showNotification(`Switched to project "${project.name}"`, 'info');
}

// Load files from current project folder or directory
async function loadFiles() {
    if (!driveState.folderId) {
        await findOrCreateRootFolder();
    }

    if (!driveState.currentProjectId) {
        document.getElementById('fileList').innerHTML = '<div class="file-list-empty">No project or directory selected.</div>';
        return;
    }

    try {
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = '<div class="file-list-empty">Loading files...</div>';

        // Build query to filter C/C++ files in the current project folder
        const extensionQuery = DRIVE_CONFIG.ALLOWED_EXTENSIONS
            .map(ext => `name contains '${ext}'`)
            .join(' or ');

        const response = await gapi.client.drive.files.list({
            q: `'${driveState.currentProjectId}' in parents and (${extensionQuery}) and trashed=false`,
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

// Display directories in the list (when viewing root)
function displayDirectories(directories) {
    const fileList = document.getElementById('fileList');

    if (directories.length === 0) {
        fileList.innerHTML = '<div class="file-list-empty">No directories found in root.</div>';
        return;
    }

    // Apply search filter
    const searchTerm = document.getElementById('fileSearch').value.toLowerCase();
    let filteredDirs = directories.filter(dir =>
        dir.name.toLowerCase().includes(searchTerm)
    );

    // Sort by name
    filteredDirs.sort((a, b) => a.name.localeCompare(b.name));

    fileList.innerHTML = filteredDirs.map(dir => {
        const modifiedDate = new Date(dir.modifiedTime).toLocaleDateString();

        return `
            <div class="file-item" data-file-id="${dir.id}" data-is-directory="true">
                <div class="file-item-info" onclick="openDirectory('${dir.id}')">
                    <svg class="file-icon" viewBox="0 0 24 24" fill="currentColor" style="color: #ffc107;">
                        <path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z"/>
                    </svg>
                    <div class="file-details">
                        <div class="file-name">${escapeHtml(dir.name)}</div>
                        <div class="file-meta">Directory • Modified: ${modifiedDate}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
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

// Open directory (when clicking on a directory from root view)
async function openDirectory(directoryId) {
    await switchProject(directoryId);
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

    // Prevent multiple simultaneous save operations
    if (driveState.operationInProgress) {
        showNotification('Please wait for the current operation to complete', 'info');
        return;
    }

    driveState.operationInProgress = true;
    const saveBtn = document.getElementById('saveFileBtn');
    if (saveBtn) {
        const originalText = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.style.opacity = '0.6';
        saveBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="animation:spin 0.8s linear infinite;"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg> Saving...';
        saveBtn.dataset.originalText = originalText;
    }

    try {
        if (!driveState.folderId) {
            await findOrCreateRootFolder();
            if (!driveState.currentProjectId) {
                await loadProjects();
            }
        }

        const code = driveState.editor ? driveState.editor.getValue() : '';
        const language = document.getElementById('languageSelect').value;
        const extension = language === '50' ? '.c' : '.cpp';
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

            // Check if a project/directory is selected
            if (!driveState.currentProjectId) {
                showNotification('Please select a project or directory first', 'error');
                return;
            }

            // Don't allow saving files when viewing root
            if (driveState.viewingRoot) {
                showNotification('Please select a project or directory to save files', 'error');
                return;
            }

            const projectFolderId = driveState.currentProjectId;

            const metadata = {
                name: fullFileName,
                parents: [projectFolderId]
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
    } finally {
        // Reset loading state
        driveState.operationInProgress = false;
        const saveBtn = document.getElementById('saveFileBtn');
        if (saveBtn && saveBtn.dataset.originalText) {
            saveBtn.disabled = false;
            saveBtn.style.opacity = '1';
            saveBtn.innerHTML = saveBtn.dataset.originalText;
            delete saveBtn.dataset.originalText;
        }
    }
}

// Create new file
function createFilePrompt() {
    const modal = document.getElementById('createFileModal');
    modal.style.display = 'flex';
    document.getElementById('newFileName').value = '';
    document.getElementById('newFileExtension').value = '.cpp';
}

// Helper function to set button loading state
function setButtonLoading(buttonId, isLoading) {
    const button = document.getElementById(buttonId);
    if (!button) return;

    if (isLoading) {
        button.disabled = true;
        button.style.opacity = '0.6';
        button.style.cursor = 'not-allowed';
        button.dataset.originalText = button.textContent || button.innerHTML;
        // Add loading indicator
        if (buttonId === 'createFileSubmitBtn') {
            button.innerHTML = '<span class="loading-spinner" style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.8s linear infinite;margin-right:8px;"></span>Creating...';
        } else if (buttonId === 'linkDriveBtn') {
            button.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="animation:spin 0.8s linear infinite;"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg> Connecting...';
        }
    } else {
        button.disabled = false;
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
        if (button.dataset.originalText) {
            button.innerHTML = button.dataset.originalText;
            delete button.dataset.originalText;
        }
    }
}

// Create file with name and extension
async function createFile() {
    // Prevent multiple simultaneous create operations
    if (driveState.operationInProgress) {
        showNotification('Please wait for the current operation to complete', 'info');
        return;
    }

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

    // Set loading state
    driveState.operationInProgress = true;
    setButtonLoading('createFileSubmitBtn', true);

    // Use try-finally to ensure flag is always reset
    try {
        if (!driveState.folderId) {
            await findOrCreateRootFolder();
        }

        // Check if a project/directory is selected
        if (!driveState.currentProjectId) {
            showNotification('Please select a project or directory first', 'error');
            return; // finally block will reset the flag
        }

        // Don't allow creating files when viewing root
        if (driveState.viewingRoot) {
            showNotification('Please select a project or directory to create files', 'error');
            return; // finally block will reset the flag
        }

        const token = gapi.client.getToken();
        if (!token) {
            showNotification('Not authenticated. Please reconnect to Google Drive.', 'error');
            return; // finally block will reset the flag
        }

        const boundary = '-------314159265358979323846';
        const delimiter = '\r\n--' + boundary + '\r\n';
        const closeDelim = '\r\n--' + boundary + '--';

        const metadata = {
            name: fullFileName,
            parents: [driveState.currentProjectId]
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
    } finally {
        // Reset loading state
        driveState.operationInProgress = false;
        setButtonLoading('createFileSubmitBtn', false);
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
        await findOrCreateRootFolder();
    }

    // Check if a project/directory is selected
    if (!driveState.currentProjectId) {
        showNotification('Please select a project or directory first', 'error');
        return;
    }

    // Don't allow uploading files when viewing root
    if (driveState.viewingRoot) {
        showNotification('Please select a project or directory to upload files', 'error');
        return;
    }

    const projectFolderId = driveState.currentProjectId;

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

                // Use current project folder
                const projectFolderId = driveState.currentProjectId;

                const metadata = {
                    name: file.name,
                    parents: [projectFolderId]
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
        try {
            // Revoke token if available
            if (gapi.client && gapi.client.getToken()) {
                const token = gapi.client.getToken();
                if (token && token.access_token) {
                    google.accounts.oauth2.revoke(token.access_token);
                }
                gapi.client.setToken('');
            }
        } catch (error) {
            console.error('Error revoking token:', error);
            // Continue with unlinking even if revocation fails
        }

        // Reset all state
        driveState.isSignedIn = false;
        driveState.currentUser = null;
        driveState.currentFile = null;
        driveState.files = [];
        driveState.folderId = null;
        driveState.currentProjectId = null;
        driveState.currentProjectName = null;
        driveState.projects = [];
        driveState.directories = [];
        driveState.viewingRoot = false;
        driveState.hasUnsavedChanges = false;
        driveState.operationInProgress = false;
        driveState.folderOperationInProgress = false;

        // Clear editor and reset to default code
        if (driveState.editor) {
            const currentLanguage = document.getElementById('languageSelect')?.value || '54';
            // Get default example code - use the same as compiler.js EXAMPLE_CODE
            let defaultCode;
            if (currentLanguage === '50') {
                // C code (matches compiler.js EXAMPLE_CODE['50'])
                defaultCode = `#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    printf("Welcome to B.Tech Walleh Online Compiler\\n");
    
    int num1 = 10, num2 = 20;
    int sum = num1 + num2;
    
    printf("Sum of %d and %d is: %d\\n", num1, num2, sum);
    
    return 0;
}`;
            } else {
                // C++ code (matches compiler.js EXAMPLE_CODE['54'])
                defaultCode = `#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    cout << "Welcome to B.Tech Walleh Online Compiler" << endl;
    
    int num1 = 10, num2 = 20;
    int sum = num1 + num2;
    
    cout << "Sum of " << num1 << " and " << num2 << " is: " << sum << endl;
    
    return 0;
}`;
            }
            driveState.editor.setValue(defaultCode);
            if (driveState.editor.clearHistory) {
                driveState.editor.clearHistory(); // Clear undo history if available
            }
        }

        // Clear file list
        const fileList = document.getElementById('fileList');
        if (fileList) {
            fileList.innerHTML = '<div class="file-list-empty">No files found. Connect to Google Drive to access files.</div>';
        }

        // Reset button loading state and restore original text
        const linkBtn = document.getElementById('linkDriveBtn');
        if (linkBtn) {
            // Reset loading state
            setButtonLoading('linkDriveBtn', false);

            // If originalText wasn't saved (button was in loading state when unlink happened)
            // or if button still shows "Connecting...", restore original HTML
            if (!linkBtn.dataset.originalText || linkBtn.innerHTML.includes('Connecting')) {
                linkBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7.71 13.12l-2.83 2.83 3.17 3.17L11 16.34l-3.29-3.22zm9.58-4.95l-2.83-2.83-3.17 3.17L12 7.66l3.29 3.22zM22 12c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2s10 4.48 10 10zm-2 0c0-4.42-3.58-8-8-8s-8 3.58-8 8 3.58 8 8 8 8-3.58 8-8z" />
                    </svg>
                    Link Google Drive
                `;
                linkBtn.disabled = false;
                linkBtn.style.opacity = '1';
                linkBtn.style.cursor = 'pointer';
            }
        }

        // Update UI
        updateUserUI();
        updateFileInfo();

        // Hide file manager
        const fileManager = document.getElementById('driveFileManager');
        if (fileManager) {
            fileManager.style.display = 'none';
        }

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

// Load credentials from serverless function
async function loadCredentials() {
    try {
        // Try to fetch from serverless function (production/Netlify)
        const response = await fetch('/.netlify/functions/get-credentials');

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.credentials) {
                DRIVE_CONFIG.CLIENT_ID = data.credentials.googleClientId;
                DRIVE_CONFIG.API_KEY = data.credentials.googleApiKey;
                credentialsLoaded = true;
                console.log('✓ Credentials loaded from serverless function');
                return true;
            }
        }

        // Fallback: Check localStorage (for local development)
        const savedClientId = localStorage.getItem('gdrive_client_id');
        const savedApiKey = localStorage.getItem('gdrive_api_key');

        if (savedClientId && savedApiKey) {
            DRIVE_CONFIG.CLIENT_ID = savedClientId;
            DRIVE_CONFIG.API_KEY = savedApiKey;
            credentialsLoaded = true;
            console.log('✓ Using credentials from localStorage (development mode)');
            return true;
        }

        // If neither works, show error
        console.error('Failed to load credentials from serverless function and no localStorage fallback');
        return false;
    } catch (error) {
        console.error('Error loading credentials:', error);

        // Fallback to localStorage for local development
        const savedClientId = localStorage.getItem('gdrive_client_id');
        const savedApiKey = localStorage.getItem('gdrive_api_key');

        if (savedClientId && savedApiKey) {
            DRIVE_CONFIG.CLIENT_ID = savedClientId;
            DRIVE_CONFIG.API_KEY = savedApiKey;
            credentialsLoaded = true;
            console.log('✓ Using credentials from localStorage (fallback mode)');
            return true;
        }

        return false;
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function () {
    // Load credentials first
    const credentialsReady = await loadCredentials();

    if (!credentialsReady) {
        console.error('Google Drive credentials not configured!');
        const banner = document.getElementById('driveSetupBanner');
        if (banner) {
            banner.style.display = 'block';
            banner.innerHTML = '<p><strong>Configuration Error:</strong> API credentials are not properly configured. Please contact the administrator.</p>';
        }
        return;
    }

    // Validate that credentials are set
    if (!DRIVE_CONFIG.CLIENT_ID || !DRIVE_CONFIG.API_KEY) {
        console.error('Google Drive credentials not configured!');
        const banner = document.getElementById('driveSetupBanner');
        if (banner) {
            banner.style.display = 'block';
            banner.innerHTML = '<p><strong>Configuration Error:</strong> API credentials are missing. Please contact the administrator.</p>';
        }
        return;
    }

    // Hide setup banner and initialize
    const banner = document.getElementById('driveSetupBanner');
    if (banner) {
        banner.style.display = 'none';
    }
    initializeGoogleAPIs();

    // Event listeners
    document.getElementById('linkDriveBtn').addEventListener('click', async () => {
        // Prevent multiple clicks
        if (driveState.operationInProgress) {
            showNotification('Please wait for the current operation to complete', 'info');
            return;
        }

        // Check if APIs are loaded
        if (!driveState.gapiLoaded) {
            showNotification('Google APIs are still loading. Please wait a moment and try again.', 'info');
            return;
        }

        // Wait for Google Identity Services to be ready (with timeout)
        if (!tokenClient || !driveState.gisLoaded) {
            showNotification('Initializing Google Drive connection...', 'info');

            // Wait up to 5 seconds for Google Identity Services to load
            let attempts = 0;
            while ((!tokenClient || !driveState.gisLoaded) && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;

                // Try to initialize if google.accounts is now available
                if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2 && !tokenClient) {
                    try {
                        tokenClient = google.accounts.oauth2.initTokenClient({
                            client_id: DRIVE_CONFIG.CLIENT_ID,
                            scope: DRIVE_CONFIG.SCOPES,
                            callback: handleTokenResponse,
                        });
                        driveState.gisLoaded = true;
                        break;
                    } catch (error) {
                        console.error('Error initializing token client:', error);
                    }
                }
            }

            if (!tokenClient || !driveState.gisLoaded) {
                showNotification('Google Drive connection failed to initialize. Please refresh the page and try again.', 'error');
                driveState.operationInProgress = false;
                return;
            }
        }

        driveState.operationInProgress = true;
        setButtonLoading('linkDriveBtn', true);

        try {
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } catch (error) {
            console.error('Error requesting access token:', error);
            showNotification('Failed to connect to Google Drive. Please try again.', 'error');
            driveState.operationInProgress = false;
            setButtonLoading('linkDriveBtn', false);
        }
    });

    document.getElementById('unlinkDriveBtn').addEventListener('click', unlinkDrive);
    document.getElementById('refreshFilesBtn').addEventListener('click', loadFiles);
    document.getElementById('createFileBtn').addEventListener('click', createFilePrompt);
    document.getElementById('uploadFileBtn').addEventListener('click', uploadFile);
    document.getElementById('fileUploadInput').addEventListener('change', handleFileUpload);
    document.getElementById('fileSearch').addEventListener('input', () => {
        if (driveState.viewingRoot) {
            displayDirectories(driveState.directories);
        } else {
            displayFiles(driveState.files);
        }
    });
    document.getElementById('fileSort').addEventListener('change', () => {
        if (driveState.viewingRoot) {
            displayDirectories(driveState.directories);
        } else {
            displayFiles(driveState.files);
        }
    });
    document.getElementById('saveFileBtn').addEventListener('click', saveFile);
    document.getElementById('createFileSubmitBtn').addEventListener('click', createFile);
    document.getElementById('createFileCancelBtn').addEventListener('click', () => {
        document.getElementById('createFileModal').style.display = 'none';
    });
    document.getElementById('createFileModalClose').addEventListener('click', () => {
        document.getElementById('createFileModal').style.display = 'none';
    });

    // Project management event listeners
    const projectSelect = document.getElementById('projectSelect');
    if (projectSelect) {
        projectSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                switchProject(e.target.value);
            }
        });
    }

    const createProjectBtn = document.getElementById('createProjectBtn');
    if (createProjectBtn) {
        createProjectBtn.addEventListener('click', createProject);
    }

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
window.openDirectory = openDirectory;
window.downloadFile = downloadFile;
window.renameFilePrompt = renameFilePrompt;
window.deleteFilePrompt = deleteFilePrompt;
window.saveFile = saveFile;
window.createFile = createFile;

