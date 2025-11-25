# Fix: Receiving Emails on Wrong Address

## The Problem

You're receiving emails on your EmailJS account email instead of `vivekcoder18@gmail.com` because the EmailJS template needs to be configured to use the `to_email` parameter.

## Solution: Configure EmailJS Template

### Step 1: Go to EmailJS Dashboard

1. Log in to https://www.emailjs.com/
2. Go to **Email Templates**
3. Click on your template `template_oqprrp8`

### Step 2: Configure the "To Email" Field

In your template settings, find the **"To Email"** field and change it from:

```
your-emailjs-account@gmail.com
```

to:

```
{{to_email}}
```

This tells EmailJS to use the `to_email` variable from your code instead of a fixed email address.

### Step 3: Update Template Content (Optional but Recommended)

Make sure your email template includes all the form data:

**Subject:**

```
New Callback Request from B.Tech Walleh
```

**Email Body:**

```
You have received a new callback request:

Name: {{name}}
Email: {{email}}
Phone: {{phone}}
Topic of Interest: {{topic}}

Please contact them as soon as possible.
```

### Step 4: Save and Test

1. Click **Save** on your template
2. Test the form on your website
3. You should now receive emails at `vivekcoder18@gmail.com`

## Alternative: Use Fixed Email Address

If you always want to send to the same email, you can:

1. **Option A:** Set `to_email` directly in the template settings (not in code)

   - In EmailJS template, set "To Email" to: `vivekcoder18@gmail.com`
   - Remove `to_email` from the code

2. **Option B:** Keep using `{{to_email}}` in template and pass it in code (current setup - more flexible)

## Current Code Setup

Your code is correctly sending:

```javascript
emailjs.send("service_37lu4a5", "template_oqprrp8", {
  topic: formData.topic,
  name: formData.name,
  email: formData.email,
  phone: formData.phone,
  to_email: "vivekcoder18@gmail.com",
});
```

The only thing missing is configuring the template to use `{{to_email}}` in the "To Email" field.

## Still Not Working?

If you're still receiving emails on the wrong address:

1. **Check Email Service Settings:**

   - Go to **Email Services** → Your service
   - Make sure it's connected to the correct Gmail account
   - The service email is just for sending, not receiving

2. **Verify Template Settings:**

   - Make sure "To Email" field uses `{{to_email}}`
   - Check that all variables match: `{{name}}`, `{{email}}`, `{{phone}}`, `{{topic}}`, `{{to_email}}`

3. **Test Again:**
   - Submit the form
   - Check `vivekcoder18@gmail.com` inbox
   - Also check spam folder
