// EmailJS Configuration
const EMAILJS_PUBLIC_KEY = "fZKfQIJBNvusGG0Iv"; 
const EMAILJS_SERVICE_ID = "service_ua0m05o"; 
const EMAILJS_WAITLIST_TEMPLATE_ID = "template_oz7a8gv"; 
const EMAILJS_SUPPORT_TEMPLATE_ID = "template_mosll1g";   

// Initialize EmailJS
(function() {
    if (typeof emailjs !== 'undefined') {
        emailjs.init(EMAILJS_PUBLIC_KEY);
    }
})();

/**
 * Handles Waitlist and "Notify Me" submissions
 */
function submitWaitlist(event) {
    event.preventDefault();
    
    const form = document.getElementById('waitlist-form');
    const btn = form.querySelector('button');
    const successMsg = document.getElementById('success-message');
    
    // Ensure these keys match your EmailJS template variables
    const templateParams = {
        from_name: document.getElementById('waitlist-name').value,
        from_email: document.getElementById('waitlist-email').value,
        reply_to: document.getElementById('waitlist-email').value,
        context: typeof currentContext !== 'undefined' ? currentContext : 'Waitlist',
        message: `User wants to ${typeof currentContext !== 'undefined' && currentContext === 'Waitlist' ? 'join the waitlist' : 'be notified at launch'}.`
    };

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<svg class="animate-spin h-5 w-5 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0110 10" stroke-opacity="0.75"/></svg>';
    }

    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_WAITLIST_TEMPLATE_ID, templateParams)
        .then(function() {
            form.classList.add('hidden');
            successMsg.classList.remove('hidden');
            setTimeout(() => {
                if (typeof closeWaitlistModal === 'function') closeWaitlistModal();
                form.classList.remove('hidden');
                successMsg.classList.add('hidden');
                form.reset();
            }, 3000);
        }, function(error) {
            console.error('EmailJS Error:', error);
            alert("Something went wrong. Please try again later.");
        })
        .finally(() => {
            if (btn) {
                btn.disabled = false;
                btn.textContent = typeof currentContext !== 'undefined' && currentContext === "Waitlist" ? "Join Waitlist" : "Notify Me";
            }
        });
}

/**
 * Handles Support Ticket submissions
 */
function submitSupportTicket(event) {
    event.preventDefault();

    const submitBtn = document.getElementById('support-submit-btn');
    const formContainer = document.getElementById('support-form-container');
    const successMessage = document.getElementById('support-success-message');
    const form = event.target;

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<svg class="animate-spin h-5 w-5 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0110 10" stroke-opacity="0.75"/></svg>';
    }

    const templateParams = {
        from_name: document.getElementById('support-name').value,
        from_email: document.getElementById('support-email').value,
        reply_to: document.getElementById('support-email').value,
        category: document.getElementById('support-category').value,
        subject: document.getElementById('support-subject').value,
        message: document.getElementById('support-message').value,
        ticket_number: 'TKT-' + Math.random().toString(36).substring(2, 8).toUpperCase()
    };

    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_SUPPORT_TEMPLATE_ID, templateParams)
        .then(function() {
            if (formContainer && successMessage) {
                formContainer.classList.add('hidden');
                successMessage.classList.remove('hidden');
            }
            form.reset();
        }, function(error) {
            console.error('EmailJS Error:', error);
            alert("Error sending message. Please check your configuration.");
        })
        .finally(() => {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg><span>Submit Ticket</span>';
            }
        });
}
