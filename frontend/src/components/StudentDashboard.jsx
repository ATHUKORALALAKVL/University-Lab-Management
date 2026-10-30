
function StudentDashboard({ user, onNavigate }) {
  // Identify the logged-in user's account type
  const isStaff = user?.role === 'staff';

  // Display the correct dashboard heading
  const dashboardTitle = isStaff
    ? 'Staff Dashboard'
    : 'Student Dashboard';

  return (
    <section className="student-dashboard">
      <h2>{dashboardTitle}</h2>

      <p>Welcome, {user?.name}!</p>

      <div className="dashboard-options">
        <button onClick={() => onNavigate('booking')}>
          Book a Lab
        </button>

        {/* Equipment-only bookings are for verified staff */}
        {isStaff && (
          <button
            onClick={() => onNavigate('equipment-booking')}
          >
            Book Equipment
          </button>
        )}

        <button onClick={() => onNavigate('my-bookings')}>
          My Bookings
        </button>

        <button onClick={() => onNavigate('profile')}>
          My Profile
        </button>
      </div>
    </section>
  );
}

export default StudentDashboard;
