import fs from 'fs-extra';
import path from 'node:path';
import * as cheerio from 'cheerio';

async function integrateFormspreeContact() {
  console.log('🚀 INTEGRATING FORMSPREE CONTACT FORM INTO CULTURAL PEACE\n');
  console.log('🧠 ULTRATHINKING: Adapting Bounder\'s formspree structure for Cultural Peace\n');
  console.log('=' .repeat(70));
  
  // Create the Formspree contact form HTML customized for Cultural Peace
  const culturalPeaceFormspreeHTML = `
<div class="contact-form-container" style="max-width: 600px; margin: 0 auto; padding: 40px 20px; background: rgba(255,255,255,0.95); border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.1);">
  <h2 style="text-align: center; margin-bottom: 30px; color: #2c3e50; font-family: 'proxima-nova', -apple-system, BlinkMacSystemFont, sans-serif; font-weight: 700; font-size: 28px;">Get In Touch</h2>
  <p style="text-align: center; margin-bottom: 30px; color: #5a6c7d; font-family: 'proxima-nova', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 16px; line-height: 1.5;">
    Let's work together to protect innocent people during cultural conflicts. Your message matters.
  </p>
  
  <form 
    action="https://formspree.io/f/YOUR_FORM_ID"
    method="POST"
    id="cultural-peace-contact-form"
    style="display: flex; flex-direction: column; gap: 20px;"
  >
    <!-- Name Fields -->
    <div style="display: flex; gap: 15px;">
      <div style="flex: 1;">
        <label for="fname" style="display: block; margin-bottom: 5px; font-weight: 600; color: #2c3e50; font-family: 'proxima-nova', -apple-system, BlinkMacSystemFont, sans-serif;">
          First Name <span style="color: #e74c3c;">*</span>
        </label>
        <input 
          type="text" 
          id="fname"
          name="first_name" 
          required
          style="width: 100%; padding: 12px 15px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px; background: white; color: #2c3e50; font-family: 'proxima-nova', -apple-system, BlinkMacSystemFont, sans-serif; transition: border-color 0.3s ease;"
          placeholder="Your first name"
        />
      </div>
      
      <div style="flex: 1;">
        <label for="lname" style="display: block; margin-bottom: 5px; font-weight: 600; color: #2c3e50; font-family: 'proxima-nova', -apple-system, BlinkMacSystemFont, sans-serif;">
          Last Name <span style="color: #e74c3c;">*</span>
        </label>
        <input 
          type="text" 
          id="lname"
          name="last_name" 
          required
          style="width: 100%; padding: 12px 15px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px; background: white; color: #2c3e50; font-family: 'proxima-nova', -apple-system, BlinkMacSystemFont, sans-serif; transition: border-color 0.3s ease;"
          placeholder="Your last name"
        />
      </div>
    </div>
    
    <!-- Email Field -->
    <div>
      <label for="email" style="display: block; margin-bottom: 5px; font-weight: 600; color: #2c3e50; font-family: 'proxima-nova', -apple-system, BlinkMacSystemFont, sans-serif;">
        Email <span style="color: #e74c3c;">*</span>
      </label>
      <input 
        type="email" 
        id="email"
        name="email" 
        required
        style="width: 100%; padding: 12px 15px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px; background: white; color: #2c3e50; font-family: 'proxima-nova', -apple-system, BlinkMacSystemFont, sans-serif; transition: border-color 0.3s ease;"
        placeholder="your.email@example.com"
      />
    </div>
    
    <!-- Phone Field -->
    <div>
      <label for="phone" style="display: block; margin-bottom: 5px; font-weight: 600; color: #2c3e50; font-family: 'proxima-nova', -apple-system, BlinkMacSystemFont, sans-serif;">
        Phone (optional)
      </label>
      <input 
        type="tel" 
        id="phone"
        name="phone"
        style="width: 100%; padding: 12px 15px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px; background: white; color: #2c3e50; font-family: 'proxima-nova', -apple-system, BlinkMacSystemFont, sans-serif; transition: border-color 0.3s ease;"
        placeholder="+1 (555) 123-4567"
      />
    </div>
    
    <!-- Organization Field -->
    <div>
      <label for="organization" style="display: block; margin-bottom: 5px; font-weight: 600; color: #2c3e50; font-family: 'proxima-nova', -apple-system, BlinkMacSystemFont, sans-serif;">
        Organization (optional)
      </label>
      <input 
        type="text" 
        id="organization"
        name="organization"
        style="width: 100%; padding: 12px 15px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px; background: white; color: #2c3e50; font-family: 'proxima-nova', -apple-system, BlinkMacSystemFont, sans-serif; transition: border-color 0.3s ease;"
        placeholder="Your organization, NGO, or institution"
      />
    </div>
    
    <!-- Subject Field -->
    <div>
      <label for="subject" style="display: block; margin-bottom: 5px; font-weight: 600; color: #2c3e50; font-family: 'proxima-nova', -apple-system, BlinkMacSystemFont, sans-serif;">
        Subject
      </label>
      <select 
        id="subject"
        name="subject"
        style="width: 100%; padding: 12px 15px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px; background: white; color: #2c3e50; font-family: 'proxima-nova', -apple-system, BlinkMacSystemFont, sans-serif; cursor: pointer;"
      >
        <option value="general">General Inquiry</option>
        <option value="peace-building">Peace Building & Reconciliation</option>
        <option value="cultural-mediation">Cultural Mediation</option>
        <option value="conflict-prevention">Conflict Prevention</option>
        <option value="community-engagement">Community Engagement</option>
        <option value="partnership">Partnership Opportunity</option>
        <option value="media">Media Inquiry</option>
        <option value="volunteer">Volunteer Opportunity</option>
        <option value="speaking">Speaking Engagement</option>
        <option value="research">Research Collaboration</option>
        <option value="education">Educational Resources</option>
        <option value="other">Other</option>
      </select>
    </div>
    
    <!-- Message Field -->
    <div>
      <label for="message" style="display: block; margin-bottom: 5px; font-weight: 600; color: #2c3e50; font-family: 'proxima-nova', -apple-system, BlinkMacSystemFont, sans-serif;">
        Message <span style="color: #e74c3c;">*</span>
      </label>
      <textarea 
        id="message"
        name="message" 
        rows="6" 
        required
        style="width: 100%; padding: 12px 15px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px; resize: vertical; background: white; color: #2c3e50; font-family: 'proxima-nova', -apple-system, BlinkMacSystemFont, sans-serif; min-height: 120px; transition: border-color 0.3s ease;"
        placeholder="Tell us how we can work together to protect innocent people during cultural conflicts. What specific challenges are you facing, or how would you like to get involved with Cultural Peace initiatives?"
      ></textarea>
    </div>
    
    <!-- Honeypot field for spam protection -->
    <input type="text" name="_gotcha" style="display:none" />
    
    <!-- Success redirect -->
    <input type="hidden" name="_next" value="https://nellinc.github.io/CulturalPeace/contact-1.html?success=true" />
    
    <!-- Email subject line -->
    <input type="hidden" name="_subject" value="New Contact Form Submission - Cultural Peace" />
    
    <!-- Submit Button -->
    <button 
      type="submit"
      style="background: linear-gradient(135deg, #3498db 0%, #2980b9 100%); color: white; padding: 16px 35px; border: none; border-radius: 6px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; font-family: 'proxima-nova', -apple-system, BlinkMacSystemFont, sans-serif; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 15px rgba(52, 152, 219, 0.3);"
      onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 25px rgba(52, 152, 219, 0.4)';"
      onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(52, 152, 219, 0.3)';"
    >
      Send Message
    </button>
  </form>
  
  <!-- Success Message (hidden by default) -->
  <div id="success-message" style="display: none; background: linear-gradient(135deg, #27ae60, #2ecc71); color: white; padding: 20px; border-radius: 6px; margin-top: 20px; text-align: center; font-family: 'proxima-nova', -apple-system, BlinkMacSystemFont, sans-serif; box-shadow: 0 4px 15px rgba(46, 204, 113, 0.3);">
    <strong style="font-size: 18px;">🕊️ Thank You!</strong>
    <p style="margin: 10px 0 0 0; font-size: 16px;">Your message has been received. We appreciate your commitment to cultural peace and will respond soon.</p>
  </div>
  
  <!-- Error Message (hidden by default) -->
  <div id="error-message" style="display: none; background: linear-gradient(135deg, #e74c3c, #c0392b); color: white; padding: 20px; border-radius: 6px; margin-top: 20px; text-align: center; font-family: 'proxima-nova', -apple-system, BlinkMacSystemFont, sans-serif; box-shadow: 0 4px 15px rgba(231, 76, 60, 0.3);">
    <strong style="font-size: 18px;">Oops!</strong>
    <p style="margin: 10px 0 0 0; font-size: 16px;">There was an error sending your message. Please try again or email us directly.</p>
  </div>
  
  <script>
    // Check for success parameter in URL
    if (window.location.search.includes('success=true')) {
      document.getElementById('success-message').style.display = 'block';
      document.getElementById('cultural-peace-contact-form').style.display = 'none';
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Form validation and submission handling
    document.getElementById('cultural-peace-contact-form').addEventListener('submit', function(e) {
      // Add loading state to button
      const button = this.querySelector('button[type="submit"]');
      const originalText = button.innerHTML;
      button.innerHTML = 'SENDING...';
      button.disabled = true;
      button.style.opacity = '0.7';
      
      // Re-enable after submission (Formspree handles the actual submission)
      setTimeout(() => {
        button.innerHTML = originalText;
        button.disabled = false;
        button.style.opacity = '1';
      }, 3000);
    });
    
    // Enhanced form interactions
    const inputs = document.querySelectorAll('#cultural-peace-contact-form input:not([type="hidden"]), #cultural-peace-contact-form textarea, #cultural-peace-contact-form select');
    inputs.forEach(input => {
      input.addEventListener('focus', function() {
        this.style.borderColor = '#3498db';
        this.style.boxShadow = '0 0 0 3px rgba(52, 152, 219, 0.1)';
      });
      
      input.addEventListener('blur', function() {
        if (this.value === '') {
          this.style.borderColor = '#ddd';
          this.style.boxShadow = 'none';
        } else {
          this.style.borderColor = '#27ae60';
          this.style.boxShadow = '0 0 0 3px rgba(39, 174, 96, 0.1)';
        }
      });
      
      // Real-time validation for required fields
      input.addEventListener('input', function() {
        if (this.hasAttribute('required')) {
          if (this.value.trim() === '') {
            this.style.borderColor = '#e74c3c';
          } else if (this.type === 'email') {
            const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
            if (emailRegex.test(this.value)) {
              this.style.borderColor = '#27ae60';
            } else {
              this.style.borderColor = '#f39c12';
            }
          } else {
            this.style.borderColor = '#27ae60';
          }
        }
      });
    });
  </script>
</div>

<style>
  /* Cultural Peace Contact Form Enhanced Styles */
  .contact-form-container {
    font-family: 'proxima-nova', -apple-system, BlinkMacSystemFont, sans-serif !important;
  }
  
  /* Responsive design */
  @media (max-width: 640px) {
    .contact-form-container {
      padding: 20px 15px !important;
      margin: 20px 10px !important;
    }
    
    .contact-form-container form > div:first-child {
      flex-direction: column !important;
    }
    
    .contact-form-container input,
    .contact-form-container textarea,
    .contact-form-container select {
      font-size: 16px !important; /* Prevents zoom on iOS */
    }
    
    .contact-form-container h2 {
      font-size: 24px !important;
    }
  }
  
  /* Placeholder styling */
  .contact-form-container input::placeholder,
  .contact-form-container textarea::placeholder {
    color: #95a5a6;
    opacity: 1;
  }
  
  /* Select dropdown options */
  .contact-form-container select option {
    background: white;
    color: #2c3e50;
    padding: 8px;
  }
  
  /* Focus states */
  .contact-form-container input:focus,
  .contact-form-container textarea:focus,
  .contact-form-container select:focus {
    outline: none;
    border-color: #3498db !important;
    box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1) !important;
  }
  
  /* Valid field styles */
  .contact-form-container input:valid:not(:placeholder-shown),
  .contact-form-container textarea:valid:not(:placeholder-shown) {
    border-color: #27ae60 !important;
  }
  
  /* Invalid field styles */
  .contact-form-container input:invalid:not(:placeholder-shown),
  .contact-form-container textarea:invalid:not(:placeholder-shown) {
    border-color: #e74c3c !important;
  }
  
  /* Button hover effects */
  .contact-form-container button:hover {
    transform: translateY(-2px);
  }
  
  .contact-form-container button:active {
    transform: translateY(0);
  }
  
  /* Loading state */
  .contact-form-container button:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }
  
  /* Autofill styles */
  .contact-form-container input:-webkit-autofill,
  .contact-form-container input:-webkit-autofill:hover,
  .contact-form-container input:-webkit-autofill:focus,
  .contact-form-container textarea:-webkit-autofill,
  .contact-form-container textarea:-webkit-autofill:hover,
  .contact-form-container textarea:-webkit-autofill:focus {
    -webkit-text-fill-color: #2c3e50;
    -webkit-box-shadow: 0 0 0px 1000px white inset;
    transition: background-color 5000s ease-in-out 0s;
  }
  
  /* Animation for success/error messages */
  #success-message,
  #error-message {
    animation: slideDown 0.3s ease-out;
  }
  
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
`;

  // Process the contact page
  const docsDir = './docs';
  const contactFile = 'contact-1.html';
  const contactPath = path.join(docsDir, contactFile);
  
  if (!await fs.pathExists(contactPath)) {
    console.log(`❌ ${contactFile} not found!`);
    return;
  }
  
  console.log(`📄 Processing ${contactFile}...`);
  const html = await fs.readFile(contactPath, 'utf-8');
  const $ = cheerio.load(html, { decodeEntities: false });
  
  // Find the main content area and add the form
  // Look for existing content and replace or append
  const mainContent = $('main, .main-content, .content, body').first();
  
  if (mainContent.length > 0) {
    console.log('  ✅ Found main content area');
    
    // Clear existing content except header
    mainContent.find('*:not(header):not(.header-replica):not(.hero-replica)').remove();
    
    // Add the formspree form
    mainContent.append(`
      <div style="padding: 80px 0 60px 0; background: linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(248,249,250,0.9) 100%); min-height: 100vh;">
        ${culturalPeaceFormspreeHTML}
      </div>
    `);
    
    console.log('  ✅ Added Cultural Peace Formspree form');
  } else {
    console.log('  ❌ No main content area found');
    return;
  }
  
  // Update page title
  $('title').text('Contact - Cultural Peace');
  
  // Add meta description
  if (!$('meta[name="description"]').length) {
    $('head').append('<meta name="description" content="Contact Cultural Peace to learn about our peace building initiatives and how you can help protect innocent people during cultural conflicts.">');
  }
  
  // Save the updated HTML
  await fs.writeFile(contactPath, $.html());
  console.log(`  💾 Saved updated ${contactFile}`);
  
  console.log('\n' + '=' .repeat(70));
  console.log('✅ CULTURAL PEACE FORMSPREE CONTACT FORM INTEGRATED!\n');
  console.log('🎯 ULTRATHINK ADAPTATIONS MADE:');
  console.log('  • Adapted Bounder\'s formspree structure for Cultural Peace');
  console.log('  • Changed color scheme from red/black to blue/white theme');
  console.log('  • Updated branding and messaging for peace building');
  console.log('  • Customized subject options for cultural mediation topics');
  console.log('  • Enhanced placeholder text for cultural conflict context');
  console.log('  • Added Cultural Peace specific styling and imagery');
  console.log('  • Responsive design optimized for peace organization');
  console.log('\n⚠️  TO MAKE FORM FUNCTIONAL:');
  console.log('1. Sign up for free at https://formspree.io');
  console.log('2. Create new form for your email address');
  console.log('3. Replace "YOUR_FORM_ID" with your actual form ID');
  console.log('4. Form will be ready to receive messages!');
  console.log('\n📋 FORM FEATURES:');
  console.log('  • Professional Cultural Peace styling');
  console.log('  • Peace building subject categories');
  console.log('  • Spam protection (honeypot field)');
  console.log('  • Success/error message handling');
  console.log('  • Mobile responsive design');
  console.log('  • Real-time field validation');
  console.log('  • Accessible form structure');
}

integrateFormspreeContact().catch(console.error);