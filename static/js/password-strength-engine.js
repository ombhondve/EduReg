(function () {
  const newPasswordInput = document.getElementById('newPassword');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const strengthFill = document.getElementById('strengthFill');
  const strengthLabel = document.getElementById('strengthLabel');
  const requirementList = document.getElementById('requirementList');
  const matchHint = document.getElementById('matchHint');
  const submitBtn = document.getElementById('submitBtn');
  const formStatus = document.getElementById('formStatus');
  const form = document.getElementById('setPasswordForm');
  const formContainer = document.getElementById('formContainer');
  const successContainer = document.getElementById('successContainer');
  const loginBtn = document.getElementById('loginBtn');

  const rules = {
    length: (pw) => pw.length >= 8,
    upper: (pw) => /[A-Z]/.test(pw),
    lower: (pw) => /[a-z]/.test(pw),
    number: (pw) => /[0-9]/.test(pw),
    special: (pw) => /[^A-Za-z0-9]/.test(pw)
  };

  const strengthLevels = [
    { max: 1, label: 'Very weak', color: '#e0395a', pct: 15 },
    { max: 2, label: 'Weak', color: '#e2a13a', pct: 35 },
    { max: 3, label: 'Fair', color: '#e2a13a', pct: 55 },
    { max: 4, label: 'Good', color: '#3aa0e2', pct: 78 },
    { max: 5, label: 'Strong', color: '#22a06b', pct: 100 }
  ];

  function evaluateRules(pw) {
    const results = {};
    let passedCount = 0;

    for (const key in rules) {
      const passed = rules[key](pw);
      results[key] = passed;
      if (passed) passedCount++;
    }

    return { results, passedCount };
  }

  function updateStrengthMeter(pw) {
    if (pw.length === 0) {
      strengthFill.style.width = '0%';
      strengthFill.style.background = '#e6e8ec';
      strengthLabel.textContent = 'Password strength';
      return;
    }

    const { passedCount } = evaluateRules(pw);
    const level =
      strengthLevels.find((l) => l.max === passedCount) ||
      strengthLevels[strengthLevels.length - 1];

    strengthFill.style.width = level.pct + '%';
    strengthFill.style.background = level.color;
    strengthLabel.textContent = level.label;
    strengthLabel.style.color = level.color;
  }

  function updateRequirementList(pw) {
    const { results } = evaluateRules(pw);
    const items = requirementList.querySelectorAll('li');

    items.forEach((item) => {
      const rule = item.dataset.rule;
      item.classList.toggle('met', !!results[rule]);
    });

    return results;
  }

  function allRulesMet(results) {
    return Object.values(results).every(Boolean);
  }

  function updateMatchHint() {
    const pw = newPasswordInput.value;
    const confirm = confirmPasswordInput.value;

    if (confirm.length === 0) {
      matchHint.textContent = '';
      matchHint.className = 'match-hint';
      return false;
    }

    if (pw === confirm) {
      matchHint.textContent = 'Passwords match';
      matchHint.className = 'match-hint ok';
      return true;
    }

    matchHint.textContent = 'Passwords do not match';
    matchHint.className = 'match-hint bad';
    return false;
  }

  function refreshSubmitState() {
    const pw = newPasswordInput.value;
    const results = updateRequirementList(pw);
    updateStrengthMeter(pw);
    const matches = updateMatchHint();
    submitBtn.disabled = !(allRulesMet(results) && matches);
  }

  function attachVisibilityToggles() {
    document.querySelectorAll('.visibility-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target);
        input.type = input.type === 'password' ? 'text' : 'password';
        btn.classList.toggle('active');
      });
    });
  }

  function resetFormVisuals() {
    form.reset();
    strengthFill.style.width = '0%';
    strengthFill.style.background = '#e6e8ec';
    strengthLabel.textContent = 'Password strength';
    matchHint.textContent = '';
    matchHint.className = 'match-hint';
    requirementList.querySelectorAll('li').forEach((item) => item.classList.remove('met'));
  }

  // Swaps the form out for the animated success screen. The CSS class
  // .success-container no longer hardcodes display:none, so setting
  // display:flex here + clearing the hidden attribute is what actually
  // reveals it (previously the CSS override made this impossible).
  function showSuccessScreen() {
    resetFormVisuals();
    formStatus.textContent = '';

    formContainer.hidden = true;
    successContainer.hidden = false;
    successContainer.style.display = 'flex';
  }

  newPasswordInput.addEventListener('input', refreshSubmitState);
  confirmPasswordInput.addEventListener('input', refreshSubmitState);
  attachVisibilityToggles();

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (submitBtn.disabled) return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      formStatus.style.color = 'red';
      formStatus.textContent = 'This link is missing or invalid. Please use the link from your email.';
      return;
    }

    submitBtn.disabled = true;
    formStatus.style.color = '#555';
    formStatus.textContent = 'Please wait...';

    const password = newPasswordInput.value;

    try {
      const response = await fetch('http://127.0.0.1:5000/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });

      let result = {};
      try {
        result = await response.json();
      } catch (_) {
        // backend returned no/invalid JSON body
      }

      if (response.ok && result.success) {
        showSuccessScreen();
      } else {
        formStatus.style.color = 'red';
        formStatus.textContent = result.message || 'Failed to set password';
        submitBtn.disabled = false;
      }
    } catch (error) {
      console.error(error);
      formStatus.style.color = 'red';
      formStatus.textContent = 'Unable to connect to server.';
      submitBtn.disabled = false;
    }
  });

  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      window.location.href = '/login.html'; // adjust to your real login page path
    });
  }
})();
