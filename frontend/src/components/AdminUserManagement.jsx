import { useEffect, useState } from 'react';

function AdminUserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const token = sessionStorage.getItem('token');

        const response = await fetch(
          'http://localhost:5000/api/admin/users',
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        if (!response.ok) {
          throw new Error('Failed to load users');
        }

        const data = await response.json();
        setUsers(data);
      } catch (err) {
        console.error(err);
        setError('Unable to load registered users.');
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, []);

  // ======================================================
  // FILTER USERS
  // ======================================================

  const filteredUsers = users.filter((user) => {
    // Hide accounts with rejected staff verification.
    if (user.staffVerificationStatus === 'rejected') {
      return false;
    }

    const keyword = search.trim().toLowerCase();

    return (
      (user.name || '').toLowerCase().includes(keyword) ||
      (user.email || '').toLowerCase().includes(keyword) ||
      (user.registrationNo || '').toLowerCase().includes(keyword) ||
      (user.telephoneNumber || '').toLowerCase().includes(keyword)
    );
  });

  return (
    <section className="laboratories-section">
      <h2>User Management</h2>

      <p>View and search registered students and instructors.</p>

      <input
        type="text"
        placeholder="Search by name, email, registration number, or telephone number"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        style={{
          width: '100%',
          padding: '12px',
          marginBottom: '20px',
          border: '1px solid #ccc',
          borderRadius: '6px',
          boxSizing: 'border-box'
        }}
      />

      {loading ? (
        <p>Loading users...</p>
      ) : error ? (
        <p style={{ color: 'red' }}>{error}</p>
      ) : filteredUsers.length === 0 ? (
        <p>No users found.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}
          >
            <thead>
              <tr>
                {[
                  'Name',
                  'Email',
                  'Telephone Number',
                  'Registration No.',
                  'Batch',
                  'Role'
                ].map((heading) => (
                  <th
                    key={heading}
                    style={{
                      padding: '12px',
                      border: '1px solid #ddd',
                      textAlign: 'left'
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user._id}>
                  <td
                    style={{
                      padding: '10px',
                      border: '1px solid #ddd'
                    }}
                  >
                    {user.name}
                  </td>

                  <td
                    style={{
                      padding: '10px',
                      border: '1px solid #ddd'
                    }}
                  >
                    {user.email}
                  </td>

                  {/* TELEPHONE NUMBER */}
                  <td
                    style={{
                      padding: '10px',
                      border: '1px solid #ddd'
                    }}
                  >
                    {user.telephoneNumber || 'Not provided'}
                  </td>

                  <td
                    style={{
                      padding: '10px',
                      border: '1px solid #ddd'
                    }}
                  >
                    {user.registrationNo || '-'}
                  </td>

                  <td
                    style={{
                      padding: '10px',
                      border: '1px solid #ddd'
                    }}
                  >
                    {user.batch || '-'}
                  </td>

                  <td
                    style={{
                      padding: '10px',
                      border: '1px solid #ddd'
                    }}
                  >
                    {user.role}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default AdminUserManagement;