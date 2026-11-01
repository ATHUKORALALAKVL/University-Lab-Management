import { useState } from 'react';

function Register() {
  const [role, setRole] = useState('student');
  const [registrationNo, setRegistrationNo] = useState('');
  const [batch, setBatch] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [telephoneNumber, setTelephoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Validate telephone number: exactly 10 digits starting with 0
    if (!/^0\d{9}$/.test(telephoneNumber)) {
      setError(
        'please enter a valid 10-digit telephone number starting with 0.'
      );
      return;
    }

    if (password !== confirmPassword) {
      setError('passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(
        'https://university-lab-backend.vercel.app/api/auth/register',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name,
            registrationNo: role === 'student' ? registrationNo : '',
            batch: role === 'student' ? batch : '',
            email,
            telephoneNumber,
            password,
            role
          })
        }
      );

      const data = await response.json();

      if (response.ok) {
        if (role === 'staff') {
          alert(
            'staff registration request submitted! Please wait for laboratory administrator verification.'
          );
        } else {
          alert('account created successfully! You can now login.');
        }

        setRole('student');
        setRegistrationNo('');
        setBatch('');
        setName('');
        setEmail('');
        setTelephoneNumber('');
        setPassword('');
        setConfirmPassword('');
        setError('');
      } else {
        setError(data.message || 'Registration failed.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError('Cannot connect to the server.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="register" className="laboratories-section">
      <h2>Create an Account</h2>

      <p>Register to access the University Lab Management System.</p>

      <form className="register-form" onSubmit={handleSubmit}>
        <label>Account Type</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="student">Student</option>
          <option value="staff">Lecturer / Instructor</option>
        </select>

        <label>Full Name</label>
        <input
          type="text"
          placeholder="enter your full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        {role === 'student' && (
          <>
            <label>University Registration Number</label>
            <input
              type="text"
              placeholder="eg/2023/XXXX"
              value={registrationNo}
              onChange={(e) => setRegistrationNo(e.target.value)}
              required
            />

            <label>Batch</label>
            <input
              type="text"
              placeholder="example: 2023"
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              required
            />
          </>
        )}

        <label>University Email</label>
        <input
          type="email"
          placeholder="enter your university email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label>Telephone Number</label>
        <input
          type="tel"
          placeholder="0771234567"
          value={telephoneNumber}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, '');
            setTelephoneNumber(value.slice(0, 10));
          }}
          maxLength={10}
          inputMode="numeric"
          autoComplete="tel"
          required
        />

        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          placeholder="at least 8 characters"
          required
        />

        <label>Confirm Password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={8}
          placeholder="re-enter your password"
          required
        />

        {error && (
          <p role="status" className="form-message">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="primary-btn"
          disabled={submitting}
        >
          {submitting
            ? 'Submitting...'
            : role === 'staff'
            ? 'Request Staff Account'
            : 'Create Account'}
        </button>
      </form>
    </section>
  );
}

export default Register;