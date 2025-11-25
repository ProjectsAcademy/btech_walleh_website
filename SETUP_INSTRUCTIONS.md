# Callback Form Setup Instructions

The callback form currently shows a success message but doesn't actually send emails. Here are three options to make it work:

## Option 1: EmailJS (Recommended - Easiest, No Backend Needed)

EmailJS allows you to send emails directly from the frontend without a backend server.

### Setup Steps:

1. **Create a free EmailJS account:**

   - Go to https://www.emailjs.com/
   - Sign up for a free account (100 emails/month free)

2. **Create an Email Service:**

   - Go to Email Services → Add New Service
   - Choose your email provider (Gmail, Outlook, etc.)
   - Follow the setup instructions

3. **Create an Email Template:**

   - Go to Email Templates → Create New Template
   - Use this template:

   ```
   Subject: New Callback Request from B.Tech Walleh

   You have received a new callback request:

   Name: {{name}}
   Email: {{email}}
   Phone: {{phone}}
   Topic of Interest: {{topic}}

   Please contact them as soon as possible.
   ```

4. **Get your credentials:**

   - Go to Account → General
   - Copy your Public Key
   - Copy your Service ID and Template ID

5. **Update the code:**

   - Open `index.html` and add this before the closing `</body>` tag:

   ```html
   <script
     type="text/javascript"
     src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"
   ></script>
   <script type="text/javascript">
     (function () {
       emailjs.init("YOUR_PUBLIC_KEY");
     })();
   </script>
   ```

   - Replace `YOUR_PUBLIC_KEY` with your actual public key

   - Open `callback-modal.js` and uncomment the EmailJS code block (Option 1)
   - Replace `YOUR_SERVICE_ID` and `YOUR_TEMPLATE_ID` with your actual IDs
   - Replace `your-email@example.com` with your email address

## Option 2: Formspree (Alternative - No Backend Needed)

Formspree is another service that handles form submissions.

### Setup Steps:

1. **Create a Formspree account:**

   - Go to https://formspree.io/
   - Sign up for a free account (50 submissions/month free)

2. **Create a new form:**

   - Click "New Form"
   - Copy the form endpoint URL (looks like: `https://formspree.io/f/YOUR_FORM_ID`)

3. **Update the code:**
   - Open `callback-modal.js` and uncomment the Formspree code block (Option 2)
   - Replace `YOUR_FORM_ID` with your actual form ID

## Option 3: Your Own Backend API

If you have a backend server, you can send the form data there.

### Setup Steps:

1. **Create an API endpoint** on your backend that accepts POST requests
2. **Update the code:**
   - Open `callback-modal.js` and uncomment the backend API code block (Option 3)
   - Replace `https://your-backend-api.com/api/callback` with your actual API endpoint
3. **Handle the data** on your backend (save to database, send email, etc.)

## Testing

After setting up any of the options above:

1. Open your website
2. Click "REQUEST CALLBACK"
3. Fill out the form
4. Submit it
5. Check your email (for EmailJS/Formspree) or your backend logs

## Important Notes:

- **EmailJS**: Free tier allows 100 emails/month
- **Formspree**: Free tier allows 50 submissions/month
- For production use, consider upgrading to a paid plan
- Always test the form after setup to ensure it's working

## Need Help?

If you need help setting up any of these options, let me know which one you'd like to use and I can provide more detailed instructions.
