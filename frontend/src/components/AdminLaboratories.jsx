
import { useEffect, useState } from 'react';

const API_URL = 'http://localhost:5000/api/labs';

const emptyForm = {
  name: '',
  description: '',
  location: '',
  capacity: '0',
  isAvailable: true
};

function AdminLaboratories() {
  const [labs, setLabs] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${sessionStorage.getItem('token')}`
  });

  const loadLabs = async () => {
    try {
      setError('');
      const response = await fetch(API_URL);

      if (!response.ok) {
        throw new Error('Failed to load laboratories');
      }

      const data = await response.json();
      setLabs(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLabs();
  }, []);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError('Please enter a laboratory name.');
      return;
    }

    if (
      form.capacity === '' ||
      !Number.isInteger(Number(form.capacity)) ||
      Number(form.capacity) < 0
    ) {
      setError('Capacity must be a non-negative whole number.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');

      const response = await fetch(
        editingId ? `${API_URL}/${editingId}` : API_URL,
        {
          method: editingId ? 'PUT' : 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            ...form,
            capacity: Number(form.capacity)
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save laboratory');
      }

      setMessage(
        editingId
          ? 'Laboratory updated successfully.'
          : 'Laboratory added successfully.'
      );

      resetForm();
      await loadLabs();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (lab) => {
    setEditingId(lab._id);
    setForm({
      name: lab.name || '',
      description: lab.description || '',
      location: lab.location || '',
      capacity: String(lab.capacity ?? 0),
      isAvailable: lab.isAvailable !== false
    });

    setError('');
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const changeAvailability = async (lab) => {
    const nextAvailability = !lab.isAvailable;

    const confirmed = window.confirm(
      `Are you sure you want to ${
        nextAvailability ? 'enable' : 'disable'
      } ${lab.name}?`
    );

    if (!confirmed) return;

    try {
      setError('');
      setMessage('');

      const response = await fetch(
        `${API_URL}/${lab._id}/availability`,
        {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({
            isAvailable: nextAvailability
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Failed to change laboratory availability'
        );
      }

      setMessage(
        `Laboratory ${nextAvailability ? 'enabled' : 'disabled'} successfully.`
      );

      await loadLabs();
    } catch (err) {
      setError(err.message);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px',
    border: '1px solid #ccc',
    borderRadius: '6px',
    boxSizing: 'border-box'
  };

  const cellStyle = {
    padding: '10px',
    border: '1px solid #ddd',
    textAlign: 'left'
  };

  return (
    <section className="laboratories-section">
      <h2>Laboratory Management</h2>
      <p>Add, edit, enable, and disable university laboratories.</p>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {message && <p style={{ color: 'green' }}>{message}</p>}

      <div className="my-booking-card" style={{ marginBottom: '25px' }}>
        <h3>{editingId ? 'Edit Laboratory' : 'Add New Laboratory'}</h3>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <label htmlFor="lab-name">Laboratory Name</label>
              <input
                id="lab-name"
                name="name"
                value={form.name}
                onChange={handleChange}
                style={inputStyle}
                required
              />
            </div>

            <div>
              <label htmlFor="lab-location">Location</label>
              <input
                id="lab-location"
                name="location"
                value={form.location}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>

            <div>
              <label htmlFor="lab-capacity">Capacity</label>
              <input
                id="lab-capacity"
                name="capacity"
                type="number"
                min="0"
                step="1"
                value={form.capacity}
                onChange={handleChange}
                style={inputStyle}
                required
              />
            </div>

            <div>
              <label htmlFor="lab-description">Description</label>
              <textarea
                id="lab-description"
                name="description"
                value={form.description}
                onChange={handleChange}
                rows="3"
                style={inputStyle}
              />
            </div>

            <label>
              <input
                type="checkbox"
                name="isAvailable"
                checked={form.isAvailable}
                onChange={handleChange}
              />{' '}
              Laboratory is available
            </label>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" disabled={saving}>
                {saving
                  ? 'Saving...'
                  : editingId
                    ? 'Update Laboratory'
                    : 'Add Laboratory'}
              </button>

              {editingId && (
                <button type="button" onClick={resetForm}>
                  Cancel Editing
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      <h3>Registered Laboratories</h3>

      {loading ? (
        <p>Loading laboratories...</p>
      ) : labs.length === 0 ? (
        <p>No laboratories found.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[
                  'Name',
                  'Location',
                  'Capacity',
                  'Description',
                  'Availability',
                  'Actions'
                ].map((heading) => (
                  <th key={heading} style={cellStyle}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {labs.map((lab) => (
                <tr key={lab._id}>
                  <td style={cellStyle}>{lab.name}</td>
                  <td style={cellStyle}>{lab.location || '-'}</td>
                  <td style={cellStyle}>{lab.capacity}</td>
                  <td style={cellStyle}>{lab.description || '-'}</td>
                  <td style={cellStyle}>
                    {lab.isAvailable ? 'Available' : 'Unavailable'}
                  </td>
                  <td style={cellStyle}>
                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        flexWrap: 'wrap'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => startEditing(lab)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => changeAvailability(lab)}
                      >
                        {lab.isAvailable ? 'Disable' : 'Enable'}
                      </button>
                    </div>
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

export default AdminLaboratories;
