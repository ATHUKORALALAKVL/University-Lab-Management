function MyProfile({ user }) {
  // Identify the logged-in user's account type.
  const isStaff = user?.role === 'staff';
  const isAdmin = user?.role === 'admin';

  const accountType = isAdmin
    ? 'Admin'
    : isStaff
    ? 'Staff'
    : 'Student';

  return (
    <section className="laboratories-section">
      <h2>My Profile</h2>

      <p>
        View your {accountType.toLowerCase()} information.
      </p>

      <div className="my-booking-card">
        <h3>{accountType} Details</h3>

        <p>
          <strong>{accountType} Name:</strong>{' '}
          {user?.name || 'Not provided'}
        </p>

        {/* Student-specific information */}
        {!isStaff && !isAdmin && (
          <>
            <p>
              <strong>University Registration No:</strong>{' '}
              {user?.registrationNo || 'Not provided'}
            </p>

            <p>
              <strong>Batch:</strong>{' '}
              {user?.batch || 'Not provided'}
            </p>
          </>
        )}

        {/* Staff-specific information */}
        {isStaff && (
          <p>
            <strong>Account Type:</strong> Staff
          </p>
        )}

        {/* Admin-specific information */}
        {isAdmin && (
          <p>
            <strong>Account Type:</strong> Administrator
          </p>
        )}

        <p>
          <strong>Email:</strong>{' '}
          {user?.email || 'Not provided'}
        </p>

        {/* Telephone number for students and staff */}
        <p>
          <strong>Telephone Number:</strong>{' '}
          {user?.telephoneNumber || 'Not provided'}
        </p>
      </div>
    </section>
  );
}

export default MyProfile;