// Lightweight Gen-Z Meme System for Compiler Errors
// Safe, accessible, and toggleable

// Meme database - Gen-Z styled, safe memes
const MEME_DATABASE = [
    // Compilation errors
    {
        type: 'compilation',
        text: '💀 bro forgot the semicolon',
        emoji: '💀',
        safe: true
    },
    {
        type: 'compilation',
        text: 'skill issue fr',
        emoji: '😭',
        safe: true
    },
    {
        type: 'compilation',
        text: 'that code is NOT slaying',
        emoji: '💅',
        safe: true
    },
    {
        type: 'compilation',
        text: 'syntax error? more like syntax ERROR 💀',
        emoji: '💀',
        safe: true
    },
    {
        type: 'compilation',
        text: 'your code said: "no cap" but the compiler said: "cap"',
        emoji: '🧢',
        safe: true
    },
    {
        type: 'compilation',
        text: 'compiler said "ain\'t no way"',
        emoji: '😤',
        safe: true
    },
    {
        type: 'compilation',
        text: 'that\'s not it chief',
        emoji: '👎',
        safe: true
    },
    {
        type: 'compilation',
        text: 'L + ratio + compilation error',
        emoji: '📉',
        safe: true
    },
    {
        type: 'compilation',
        text: 'the compiler is NOT having it',
        emoji: '🚫',
        safe: true
    },
    {
        type: 'compilation',
        text: 'your code: 🔥 the compiler: ❄️',
        emoji: '❄️',
        safe: true
    },
    // Runtime errors
    {
        type: 'runtime',
        text: 'segmentation fault? more like segmentation FAIL',
        emoji: '💥',
        safe: true
    },
    {
        type: 'runtime',
        text: 'your program said "it\'s giving error"',
        emoji: '💀',
        safe: true
    },
    {
        type: 'runtime',
        text: 'runtime error? that\'s a whole L',
        emoji: '📉',
        safe: true
    },
    {
        type: 'runtime',
        text: 'the program crashed harder than my grades',
        emoji: '📉',
        safe: true
    },
    {
        type: 'runtime',
        text: 'segfault? we don\'t know her',
        emoji: '👋',
        safe: true
    },
    // Wrong answer
    {
        type: 'wrong_answer',
        text: 'wrong answer? that\'s cap',
        emoji: '🧢',
        safe: true
    },
    {
        type: 'wrong_answer',
        text: 'the output said "no"',
        emoji: '❌',
        safe: true
    },
    {
        type: 'wrong_answer',
        text: 'close but no cigar (or correct answer)',
        emoji: '🚬',
        safe: true
    },
    // Time limit
    {
        type: 'timeout',
        text: 'your code took longer than my attention span',
        emoji: '⏰',
        safe: true
    },
    {
        type: 'timeout',
        text: 'time limit exceeded? that\'s a whole mood',
        emoji: '😴',
        safe: true
    },
    // Generic errors
    {
        type: 'generic',
        text: 'error? we don\'t know her',
        emoji: '👋',
        safe: true
    },
    {
        type: 'generic',
        text: 'that\'s not very slay of you',
        emoji: '💅',
        safe: true
    },
    {
        type: 'generic',
        text: 'error detected: skill issue',
        emoji: '😭',
        safe: true
    },
    {
        type: 'generic',
        text: 'the compiler is NOT vibing',
        emoji: '🚫',
        safe: true
    },
    {
        type: 'generic',
        text: 'error? more like ERROR 💀',
        emoji: '💀',
        safe: true
    }
];

// Content filter - basic keyword filtering for safety
const UNSAFE_KEYWORDS = [
    'nsfw', 'explicit', 'adult', 'inappropriate',
    'offensive', 'violent', 'hate', 'discriminatory'
];

// Check if meme is safe
function isMemeSafe(meme) {
    if (!meme || !meme.safe) return false;

    const text = meme.text.toLowerCase();
    for (const keyword of UNSAFE_KEYWORDS) {
        if (text.includes(keyword)) {
            return false;
        }
    }
    return true;
}

// Get meme based on error type
function getMemeForError(errorType) {
    // Filter safe memes for this error type
    const filteredMemes = MEME_DATABASE.filter(meme => {
        if (meme.type === errorType) {
            return isMemeSafe(meme);
        }
        // Also allow generic memes as fallback
        if (meme.type === 'generic') {
            return isMemeSafe(meme);
        }
        return false;
    });

    // If no specific memes found, use generic safe memes
    const availableMemes = filteredMemes.length > 0
        ? filteredMemes
        : MEME_DATABASE.filter(m => m.type === 'generic' && isMemeSafe(m));

    if (availableMemes.length === 0) {
        // Ultimate fallback - safe default
        return {
            text: 'Error detected! 💀',
            emoji: '💀',
            safe: true
        };
    }

    // Random selection
    const randomIndex = Math.floor(Math.random() * availableMemes.length);
    return availableMemes[randomIndex];
}

// Map Judge0 status to meme type
function getErrorTypeFromStatus(statusId) {
    const statusMap = {
        4: 'wrong_answer',
        5: 'timeout',
        6: 'compilation',
        7: 'runtime',
        8: 'runtime',
        9: 'runtime',
        10: 'runtime',
        11: 'runtime',
        12: 'runtime',
        13: 'generic',
        14: 'generic'
    };
    return statusMap[statusId] || 'generic';
}

// Display meme card
function displayMemeCard(errorType, meme) {
    if (!meme || !isMemeSafe(meme)) {
        return ''; // Don't display unsafe memes
    }

    const memeType = getErrorTypeFromStatus(errorType);
    const selectedMeme = meme || getMemeForError(memeType);

    return `
        <div class="meme-card" role="alert" aria-live="polite">
            <div class="meme-emoji">${selectedMeme.emoji}</div>
            <div class="meme-text">${escapeHtml(selectedMeme.text)}</div>
        </div>
    `;
}

// Escape HTML helper
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Check if memes are enabled
function areMemesEnabled() {
    const saved = localStorage.getItem('compiler_memes_enabled');
    return saved !== null ? saved === 'true' : true; // Default: enabled
}

// Toggle memes
function toggleMemes() {
    const current = areMemesEnabled();
    const newValue = !current;
    localStorage.setItem('compiler_memes_enabled', newValue.toString());
    return newValue;
}

// Export functions
if (typeof window !== 'undefined') {
    window.getMemeForError = getMemeForError;
    window.displayMemeCard = displayMemeCard;
    window.areMemesEnabled = areMemesEnabled;
    window.toggleMemes = toggleMemes;
    window.getErrorTypeFromStatus = getErrorTypeFromStatus;

    // Initialize button state immediately when script loads
    function initButtonState() {
        const memeToggleBtn = document.getElementById('memeToggleBtn');
        if (memeToggleBtn) {
            // Ensure button is enabled
            memeToggleBtn.disabled = false;
            memeToggleBtn.removeAttribute('disabled');
            memeToggleBtn.style.opacity = '';
            memeToggleBtn.style.cursor = '';

            // Set initial state
            const memesEnabled = areMemesEnabled();
            if (memesEnabled) {
                memeToggleBtn.classList.add('active');
                memeToggleBtn.setAttribute('aria-pressed', 'true');
            } else {
                memeToggleBtn.classList.remove('active');
                memeToggleBtn.setAttribute('aria-pressed', 'false');
            }
        }
    }

    // Try to initialize immediately, or wait for DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initButtonState);
    } else {
        // DOM already loaded, try immediately
        setTimeout(initButtonState, 0);
    }
}

