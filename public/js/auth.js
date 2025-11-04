

function register(role) {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const data = { email, password };
  if (role === 'student') {
    data.prn = document.getElementById('prn').value;
    data.division = document.getElementById('division').value;
    data.roll_no = +document.getElementById('roll_no').value;
  } else {
    data.employee_id = document.getElementById('employee_id').value;
  }
  fetch(`/register/${role}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(r => r.json())
  .then(d => {
    alert(d.message || d.error);
    if (d.message) window.location.href = `/${role}-login`;
  });
}

function login(role) {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role })
  })
  .then(r => r.json())
  .then(d => {
    if (d.redirect) window.location.href = d.redirect;
    else alert(d.error);
  });
}