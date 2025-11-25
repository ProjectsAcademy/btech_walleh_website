// Floating Contact Icon and Popup Handler
const floatingIcon = document.getElementById('floatingContactIcon');
const contactPopup = document.getElementById('contactPopup');
const closePopupBtn = document.getElementById('closePopup');
const openCallbackFromPopup = document.getElementById('openCallbackFromPopup');

// Open popup when floating icon is clicked
if (floatingIcon) {
    floatingIcon.addEventListener('click', function (e) {
        e.stopPropagation();
        contactPopup.style.display = 'block';
    });
}

// Close popup when X button is clicked
if (closePopupBtn) {
    closePopupBtn.addEventListener('click', function () {
        contactPopup.style.display = 'none';
    });
}

// Close popup when clicking outside
document.addEventListener('click', function (e) {
    if (contactPopup &&
        !contactPopup.contains(e.target) &&
        !floatingIcon.contains(e.target) &&
        contactPopup.style.display === 'block') {
        contactPopup.style.display = 'none';
    }
});

// Open callback modal when "Request a Call" button is clicked
if (openCallbackFromPopup) {
    openCallbackFromPopup.addEventListener('click', function () {
        // Close the popup first
        contactPopup.style.display = 'none';

        // Open the callback modal
        const callbackModal = document.getElementById('callbackModal');
        if (callbackModal) {
            callbackModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    });
}

// Close popup with Escape key
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && contactPopup && contactPopup.style.display === 'block') {
        contactPopup.style.display = 'none';
    }
});

