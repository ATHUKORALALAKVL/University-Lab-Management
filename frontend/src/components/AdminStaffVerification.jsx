
import { useEffect, useState } from 'react';

function AdminStaffVerification() {
  const [pendingStaff, setPendingStaff] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPendingStaff = async () => {
      try {
        const token = sessionStorage.getItem('token');

        const response = await fetch(
          'https://university-lab-backend.vercel.app/api/admin/pending-staff',
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        const data = await response.json();

        if (!response.ok) {
          setError(data.message || 'Failed to load staff requests');
          return;
        }

        setPendingStaff(data);
      } catch (error) {
        setError('Cannot connect to the server');
      } finally {
        setLoading(false);
      }
    };

    loadPendingStaff();
  }, []);

  // Approve instructor account
  const approveStaff = async (staffId) => {
    const confirmed = window.confirm(
      'Are you sure you want to approve this staff member?'
    );

    if (!confirmed) return;

    try {
      const token = sessionStorage.getItem('token');

      const response = await fetch(
        `https://university-lab-backend.vercel.app/api/admin/approve-staff/${staffId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || 'Failed to approve instructor');
        return;
      }

      alert('Instructor account approved successfully!');

      setPendingStaff((previous) =>
        previous.filter((staff) => staff._id !== staffId)
      );
    } catch (error) {
      alert('Cannot connect to the server');
    }
  };

  // Reject instructor account
  const rejectStaff = async (staffId) => {
    const confirmed = window.confirm(
      'Are you sure you want to reject this staff request?'
    );

    if (!confirmed) return;

    try {
      const token = sessionStorage.getItem('token');

      const response = await fetch(
        `https://university-lab-backend.vercel.app/api/admin/reject-staff/${staffId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || 'Failed to reject staff request');
        return;
      }

      alert('Staff request rejected successfully!');

      setPendingStaff((previous) =>
        previous.filter((staff) => staff._id !== staffId)
      );
    } catch (error) {
      alert('Cannot connect to the server');
    }
  };

  return (
    <section className="laboratories-section">
      <h2>Staff Verification</h2>

      <p>Review instructor accounts waiting for approval.</p>

      {loading && <p>Loading staff requests...</p>}

      {error && (
        <p style={{ color: 'red' }}>{error}</p>
      )}

      {!loading && !error && pendingStaff.length === 0 && (
        <p>No pending staff requests.</p>
      )}

      {!loading && !error && pendingStaff.map((staff) => (
       <div className="my-booking-card" key={staff._id}>

  {/* Staff registration date */}
  {staff.createdAt && (
    <p
      style={{
        textAlign: 'right',
        fontSize: '11px',
        color: '#888',
        margin: '0 0 8px 0'
      }}
    >
      Registered: {new Date(staff.createdAt).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}
    </p>
  )}

  <h3>{staff.name}</h3>

          <p>
            <strong>Email:</strong> {staff.email}
          </p>

          <p>
            <strong>Status:</strong> Pending Verification
          </p>

          <button
            onClick={() => approveStaff(staff._id)}
          >
            Approve Instructor
          </button>

          {' '}

          <button
            onClick={() => rejectStaff(staff._id)}
            style={{
              backgroundColor: '#c0392b',
              color: 'white'
            }}
          >
            Reject Instructor
          </button>
        </div>
      ))}
    </section>
  );
}

export default AdminStaffVerification;
