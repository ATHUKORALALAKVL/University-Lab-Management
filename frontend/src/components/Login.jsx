
import { useState } from 'react';

function Login({ onLoginSuccess }) {  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

const handleLogin = async (e) => {
  e.preventDefault();

  try {
    const response = await fetch('https://university-lab-backend.vercel.app/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    
if (response.ok) {
  sessionStorage.setItem('token', data.token);
  sessionStorage.setItem('user', JSON.stringify(data.user));

  onLoginSuccess(data.user);

  alert('Login successful! Welcome ' + data.user.name);
} else {
  alert(data.message || 'Login failed');
}

  } catch (error) {
    console.error('Login error:', error);
    alert('Cannot connect to the server');
  }
};

  return (

<section className="login-section">
      <h2>Login</h2>

      <p>
        Login to your account to request laboratory
        bookings and manage your reservations.
      </p>

      
<form className="login-form" onSubmit={handleLogin}>
        <div>
          <label htmlFor="login-email">Email Address</label>
          <input
            type="email"
            id="login-email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="login-password">Password</label>
          <input
            type="password"
            id="login-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit">
          Login
        </button>
      </form>
    </section>
  );
}

export default Login;
