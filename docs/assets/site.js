// Smart Gurukul marketing site: mobile nav + demo / website-services request form. No dependencies.
(function () {
  var header = document.querySelector('.site-header');
  var menuBtn = document.querySelector('.menu-btn');
  if (header && menuBtn) {
    menuBtn.addEventListener('click', function () {
      var open = header.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(open));
    });
  }

  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  var form = document.getElementById('demo-form');
  if (!form) return;

  var API = 'https://api.smartgurukul.org/api/v1/leads';
  var hi = document.documentElement.lang === 'hi';
  // website-services.html reuses this form script, marked with data-request-type="WEBSITE_SERVICES".
  var requestType = form.getAttribute('data-request-type') || 'DEMO';
  var services = requestType === 'WEBSITE_SERVICES';
  var msg = {
    required: hi ? 'यह ज़रूरी है' : 'This is required',
    phone: hi ? '10 अंकों का मोबाइल नंबर डालें' : 'Enter a 10-digit Indian mobile number',
    email: hi ? 'सही ईमेल डालें' : 'Enter a valid email',
    sending: hi ? 'भेजा जा रहा है…' : 'Sending…',
    ok: hi
      ? 'धन्यवाद! हमारी टीम 1 कार्यदिवस में आपसे संपर्क करेगी।'
      : services
        ? 'Thank you! Our team will call you within 1 working day to discuss your website.'
        : 'Thank you! Our team will call you within 1 working day to set up your demo.',
    fail: hi
      ? 'अभी भेज नहीं पाए। कृपया sales@smartgurukul.org पर ईमेल करें।'
      : "We couldn't send that right now. Please email sales@smartgurukul.org and we'll reply the same day.",
    tooMany: hi
      ? 'बहुत सारे अनुरोध। कृपया थोड़ी देर बाद फिर कोशिश करें।'
      : 'Too many requests from this network. Please try again in a little while.'
  };
  var status = form.querySelector('.form-status');
  var submit = form.querySelector('button[type="submit"]');

  function setErr(input, text) {
    var box = document.getElementById(input.id + '-err');
    input.setAttribute('aria-invalid', text ? 'true' : 'false');
    if (box) box.textContent = text || '';
  }

  function validate() {
    var ok = true;
    ['name', 'schoolName', 'phone'].forEach(function (id) {
      var el = form.elements[id];
      var empty = !el.value.trim();
      setErr(el, empty ? msg.required : '');
      if (empty) ok = false;
    });
    var phone = form.elements.phone;
    var digits = phone.value.replace(/[\s-]/g, '').replace(/^(\+91|0)/, '');
    if (phone.value.trim() && !/^[6-9]\d{9}$/.test(digits)) { setErr(phone, msg.phone); ok = false; }
    var email = form.elements.email;
    if (email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { setErr(email, msg.email); ok = false; }
    else if (!email.value.trim()) setErr(email, '');
    return ok;
  }

  function show(kind, text) {
    status.className = 'form-status ' + kind;
    status.textContent = text;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) {
      var first = form.querySelector('[aria-invalid="true"]');
      if (first) first.focus();
      return;
    }
    var f = form.elements;
    // Not every form has every field (the website-services form has no state or student count).
    function val(name) { var el = f[name]; return el && el.value.trim() ? el.value.trim() : null; }
    var picked = [].slice.call(form.querySelectorAll('input[name="services"]:checked')).map(function (c) { return c.value; });
    var body = {
      requestType: requestType,
      name: f.name.value.trim(),
      schoolName: f.schoolName.value.trim(),
      role: val('role'),
      phone: f.phone.value.trim(),
      email: val('email'),
      city: val('city'),
      state: val('state'),
      studentCount: val('studentCount'),
      services: picked.length ? picked : null,
      budget: val('budget'),
      message: val('message'),
      sourcePage: location.pathname,
      website: f.website.value
    };
    submit.disabled = true;
    var label = submit.textContent;
    submit.textContent = msg.sending;
    status.className = 'form-status';

    fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (res) {
        if (res.ok) {
          form.reset();
          show('ok', msg.ok);
          if (window.gtag) window.gtag('event', 'generate_lead', { method: services ? 'website_services_form' : 'demo_form' });
        } else if (res.status === 429) {
          show('bad', msg.tooMany);
        } else {
          show('bad', msg.fail);
        }
      })
      .catch(function () { show('bad', msg.fail); })
      .then(function () { submit.disabled = false; submit.textContent = label; });
  });
})();
