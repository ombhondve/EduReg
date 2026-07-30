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
      return 0;
    }

    const { passedCount } = evaluateRules(pw);
    const level = strengthLevels.find(l => l.max === passedCount) || strengthLevels[strengthLevels.length - 1];

    strengthFill.style.width = level.pct + '%';
    strengthFill.style.background = level.color;
    strengthLabel.textContent = level.label;
    strengthLabel.style.color = level.color;

    return passedCount;
  }

  function updateRequirementList(pw) {
    const { results } = evaluateRules(pw);
    const items = requirementList.querySelectorAll('li');
    items.forEach(item => {
      const rule = item.getAttribute('data-rule');
      if (results[rule]) {
        item.classList.add('met');
      } else {
        item.classList.remove('met');
      }
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
    } else {
      matchHint.textContent = 'Passwords do not match';
      matchHint.className = 'match-hint bad';
      return false;
    }
  }

  function refreshSubmitState() {
    const pw = newPasswordInput.value;
    const results = updateRequirementList(pw);
    updateStrengthMeter(pw);
    const matches = updateMatchHint();
    submitBtn.disabled = !(allRulesMet(results) && matches);
  }

  function attachVisibilityToggles() {
    const toggles = document.querySelectorAll('.visibility-toggle');
    toggles.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const input = document.getElementById(targetId);
        const isHidden = input.type === 'password';
        input.type = isHidden ? 'text' : 'password';
        btn.classList.toggle('active', isHidden);
      });
    });
  }

  newPasswordInput.addEventListener('input', refreshSubmitState);
  confirmPasswordInput.addEventListener('input', refreshSubmitState);
  attachVisibilityToggles();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (submitBtn.disabled) return;

    formStatus.textContent = 'Password set successfully.';
    formStatus.style.color = '#22a06b';
    submitBtn.disabled = true;
    form.reset();
    strengthFill.style.width = '0%';
    strengthFill.style.background = '#e6e8ec';
    strengthLabel.textContent = 'Password strength';
    matchHint.textContent = '';
    requirementList.querySelectorAll('li').forEach(item => item.classList.remove('met'));
  });
})();
