
(function () {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const role = document.getElementById('role').value;
      const totpCode = document.getElementById('totpCode') ? document.getElementById('totpCode').value : '';

      if (!username || !password || !role) {
        showMessage('Please fill in all fields');
        return;
      }

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ username, password, role, totpCode })
        });

        const data = await response.json();

        if (data.success) {
          window.location.href = '/dashboard.html';
        } else {
          showMessage(data.message || 'Login failed');
        }
      } catch (error) {
        console.error('Login error:', error);
        showMessage('Login failed. Please try again.');
      }
    });

    function showMessage(message) {
      const messageElement = document.getElementById('message');
      if (messageElement) {
        messageElement.textContent = message;
        messageElement.style.display = 'block';
      } else {
        alert(message);
      }
    }
  }
})();

async function checkAuth() {
  try {
    const response = await fetch('/api/auth/check', {
      credentials: 'include'
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Auth check error:', error);
    return { authenticated: false };
  }
}

async function logout() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
    window.location.href = '/login.html';
  } catch (error) {
    console.error('Logout error:', error);
    alert('Logout failed');
  }
}

window.__auth = {
  checkAuth: checkAuth,
  logout: logout
};