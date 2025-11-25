// Get modal elements
const modal = document.getElementById('callbackModal');
const openModalBtn = document.getElementById('openCallbackModal');
const closeModalBtn = document.getElementById('closeModal');
const callbackForm = document.getElementById('callbackForm');

// Open modal when "REQUEST CALLBACK" is clicked (only if button exists - on home page)
if (openModalBtn && modal) {
    openModalBtn.addEventListener('click', function (e) {
        e.preventDefault();
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    });
}

// Close modal when X button is clicked
if (closeModalBtn && modal) {
    closeModalBtn.addEventListener('click', function () {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Restore scrolling
    });
}

// Close modal when clicking outside the modal content
if (modal) {
    modal.addEventListener('click', function (e) {
        if (e.target === modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });
}

// Close modal with Escape key
if (modal) {
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });
}

// Handle form submission
if (callbackForm) {
    callbackForm.addEventListener('submit', function (e) {
        e.preventDefault();

        // Get form values
        const formData = {
            topic: document.getElementById('topic').value,
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('countryCode').value + ' ' + document.getElementById('phone').value
        };

        // Disable submit button to prevent multiple submissions
        const submitBtn = callbackForm.querySelector('.btn-submit');
        const originalBtnText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        // Option 1: Using EmailJS (Recommended - No backend needed)
        // Uncomment and configure after setting up EmailJS account

        emailjs.send('service_37lu4a5', 'template_oqprrp8', {
            topic: formData.topic,
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            to_email: 'vivekcoder18@gmail.com' // Your email where you want to receive notifications
        })
            .then(function (response) {
                console.log('SUCCESS!', response.status, response.text);
                showSuccessMessage('Thank you! We will contact you soon.');
                callbackForm.reset();
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
            })
            .catch(function (error) {
                console.error('FAILED...', error);
                showErrorMessage('Something went wrong. Please try again or call us directly.');
            })
            .finally(function () {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            });


        // Option 2: Using Formspree (Alternative - No backend needed)
        // Uncomment and configure after setting up Formspree account
        /*
        fetch('https://formspree.io/f/YOUR_FORM_ID', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                topic: formData.topic,
                name: formData.name,
                email: formData.email,
                phone: formData.phone
            })
        })
        .then(response => response.json())
        .then(data => {
            showSuccessMessage('Thank you! We will contact you soon.');
            callbackForm.reset();
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        })
        .catch(error => {
            console.error('Error:', error);
            showErrorMessage('Something went wrong. Please try again or call us directly.');
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        });
        */

        // Option 3: Send to your own backend API
        // Uncomment and configure with your backend endpoint
        /*
        fetch('https://your-backend-api.com/api/callback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        })
        .then(response => response.json())
        .then(data => {
            showSuccessMessage('Thank you! We will contact you soon.');
            callbackForm.reset();
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        })
        .catch(error => {
            console.error('Error:', error);
            showErrorMessage('Something went wrong. Please try again or call us directly.');
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        });
        */

        // EmailJS is handling the submission above
    });
}

// Helper function to show success message
function showSuccessMessage(message) {
    // You can replace this with a better notification system
    alert(message);
    // Or use a toast notification library like Toastr, SweetAlert, etc.
}

// Helper function to show error message
function showErrorMessage(message) {
    alert(message);
    // Or use a toast notification library
}

