
function AdminDashboard({ user, onNavigate }) {
  return (
    <section className="laboratories-section">
      <h2>Laboratory Administrator Dashboard</h2>

      <p>Welcome, {user.name}!</p>

      <div className="dashboard-grid">

        <div className="my-booking-card">
          <h3>Booking Requests</h3>
          <p>
            Review laboratory bookings with equipment
            and equipment-only requests.
          </p>
          <button onClick={() => onNavigate('admin-bookings')}>
            Manage Requests
          </button>
        </div>

        <div className="my-booking-card">
          <h3>Staff Verification</h3>
          <p>Verify instructor and staff accounts.</p>
          <button onClick={() => onNavigate('admin-staff')}>
            Verify Staff
          </button>
        </div>

        <div className="my-booking-card">
          <h3>Laboratory Management</h3>
          <p>Manage laboratories and their availability.</p>
          <button onClick={() => onNavigate('admin-labs')}>
            Manage Laboratories
          </button>
        </div>

        <div className="my-booking-card">
          <h3>Equipment Management</h3>
          <p>Manage equipment, quantities and returns.</p>
          <button onClick={() => onNavigate('admin-equipment')}>
            Manage Equipment
          </button>
        </div>

        <div className="my-booking-card">
          <h3>User Management</h3>
          <p>View registered students and instructors.</p>
          <button onClick={() => onNavigate('admin-users')}>
            View Users
          </button>
        </div>

        <div className="my-booking-card">
          <h3>Reports</h3>
          <p>View booking history and resource usage.</p>
          <button onClick={() => onNavigate('admin-reports')}>
            View Reports
          </button>
        </div>

      </div>
    </section>
  );
}

export default AdminDashboard;
