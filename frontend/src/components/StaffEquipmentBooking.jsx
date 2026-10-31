
import { useEffect, useMemo, useState } from 'react';

const API_BASE = 'https://university-lab-backend.vercel.app/api';

const styles = {
  page: {
    maxWidth: '1000px',
    margin: '35px auto',
    padding: '0 20px 50px',
    fontFamily: 'inherit'
  },
  card: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '20px',
    boxShadow: '0 3px 12px rgba(0,0,0,0.04)'
  },
  label: {
    display: 'block',
    fontWeight: 600,
    marginBottom: '8px',
    color: '#26354a'
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '11px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '7px',
    fontSize: '14px',
    background: '#fff'
  },
  button: {
    border: 'none',
    borderRadius: '7px',
    padding: '11px 18px',
    cursor: 'pointer',
    fontWeight: 600
  },
  row: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(230px, 1fr))',
    gap: '16px',
    marginBottom: '18px'
  }
};

const getId = value =>
  String(value?._id || value || '');

const getToday = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map(part => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
};

const createRow = () => ({
  key: `${Date.now()}-${Math.random()}`,
  labId: '',
  equipmentId: '',
  quantity: 1
});

function StaffEquipmentBooking({
  user,
  onNavigate
}) {
  const [labs, setLabs] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [rows, setRows] = useState([createRow()]);

  const [bookingDate, setBookingDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [purpose, setPurpose] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const token =
    sessionStorage.getItem('token') ||
    localStorage.getItem('token');

  // =====================================================
  // LOAD LABORATORIES AND EQUIPMENT
  // =====================================================

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError('');

        const [labsResponse, equipmentResponse] =
          await Promise.all([
            fetch(`${API_BASE}/labs`),
            fetch(`${API_BASE}/equipment`)
          ]);

        if (
          !labsResponse.ok ||
          !equipmentResponse.ok
        ) {
          throw new Error(
            'Unable to load laboratories or equipment.'
          );
        }

        const labsData = await labsResponse.json();
        const equipmentData =
          await equipmentResponse.json();

        if (!active) return;

        const loadedLabs = Array.isArray(labsData)
          ? labsData
          : Array.isArray(labsData.labs)
            ? labsData.labs
            : [];

        const loadedEquipment =
          Array.isArray(equipmentData)
            ? equipmentData
            : Array.isArray(equipmentData.equipment)
              ? equipmentData.equipment
              : [];

        setLabs(loadedLabs);
        setEquipment(loadedEquipment);
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, []);

  // =====================================================
  // FILTER EQUIPMENT BY LABORATORY
  // =====================================================

  const getLabEquipment = labId =>
    equipment.filter(item =>
      getId(item.lab) === String(labId)
    );

  const selectedEquipmentIds = useMemo(
    () =>
      rows
        .map(row => row.equipmentId)
        .filter(Boolean),
    [rows]
  );

  const updateRow = (key, field, value) => {
    setError('');
    setSuccess('');

    setRows(previous =>
      previous.map(row => {
        if (row.key !== key) {
          return row;
        }

        if (field === 'labId') {
          return {
            ...row,
            labId: value,
            equipmentId: '',
            quantity: 1
          };
        }

        if (field === 'equipmentId') {
          return {
            ...row,
            equipmentId: value,
            quantity: 1
          };
        }

        return {
          ...row,
          [field]: value
        };
      })
    );
  };

  const addRow = () => {
    setRows(previous => [
      ...previous,
      createRow()
    ]);

    setError('');
    setSuccess('');
  };

  const removeRow = key => {
    setRows(previous =>
      previous.length > 1
        ? previous.filter(row => row.key !== key)
        : previous
    );
  };

  // =====================================================
  // BOOKING SUMMARY
  // =====================================================

  const summary = rows
    .filter(row => row.equipmentId)
    .map(row => {
      const lab = labs.find(
        item => getId(item) === row.labId
      );

      const item = equipment.find(
        entry =>
          getId(entry) === row.equipmentId
      );

      return {
        key: row.key,
        labName: lab?.name || 'Unknown Laboratory',
        equipmentName:
          item?.name || 'Unknown Equipment',
        quantity: Number(row.quantity)
      };
    });

  const totalUnits = summary.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  // =====================================================
  // SUBMIT BOOKING
  // =====================================================

  const handleSubmit = async event => {
    event.preventDefault();

    setError('');
    setSuccess('');

    if (user?.role !== 'staff') {
      setError(
        'Only verified staff members can submit equipment-only bookings.'
      );
      return;
    }

    if (!token) {
      setError(
        'Your login session was not found. Please log in again.'
      );
      return;
    }

    if (
      rows.some(
        row =>
          !row.labId ||
          !row.equipmentId ||
          !Number.isInteger(Number(row.quantity)) ||
          Number(row.quantity) < 1
      )
    ) {
      setError(
        'Please select a laboratory, equipment and valid quantity for every row.'
      );
      return;
    }

    if (
      selectedEquipmentIds.length !==
      new Set(selectedEquipmentIds).size
    ) {
      setError(
        'The same equipment type was selected more than once. Please combine the quantities into one row.'
      );
      return;
    }

    for (const row of rows) {
      const item = equipment.find(
        entry =>
          getId(entry) === row.equipmentId
      );

      if (
        !item ||
        getId(item.lab) !== row.labId
      ) {
        setError(
          'One or more equipment selections do not match their laboratories.'
        );
        return;
      }

      const usable = Number(
        item.usableQuantity ?? item.totalQuantity ?? 0
      );

      if (Number(row.quantity) > usable) {
        setError(
          `Requested quantity for ${item.name} exceeds its usable quantity (${usable}).`
        );
        return;
      }
    }

    if (
      !bookingDate ||
      !startTime ||
      !endTime ||
      !purpose.trim()
    ) {
      setError(
        'Please complete the date, time and purpose fields.'
      );
      return;
    }

    if (bookingDate < getToday()) {
      setError(
        'Please choose today or a future date.'
      );
      return;
    }

    if (startTime >= endTime) {
      setError(
        'End time must be later than start time.'
      );
      return;
    }

    const payload = {
      bookingType: 'equipment',
      lab: null,
      bookingDate,
      startTime,
      endTime,
      purpose: purpose.trim(),
      equipment: rows.map(row => ({
        equipmentId: row.equipmentId,
        quantity: Number(row.quantity)
      }))
    };

    try {
      setSubmitting(true);

      const response = await fetch(
        `${API_BASE}/bookings`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          'Unable to submit equipment booking.'
        );
      }

      setSuccess(
        'Your equipment booking request was submitted successfully. It is now pending administrator approval.'
      );

      setRows([createRow()]);
      setBookingDate('');
      setStartTime('');
      setEndTime('');
      setPurpose('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // =====================================================
  // STAFF ACCESS
  // =====================================================

  if (user?.role !== 'staff') {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h2>Equipment Booking</h2>

          <p style={{ color: '#b91c1c' }}>
            This feature is available only to verified
            staff members.
          </p>

          {onNavigate && (
            <button
              type="button"
              style={{
                ...styles.button,
                background: '#17365d',
                color: '#fff'
              }}
              onClick={() =>
                onNavigate('dashboard')
              }
            >
              Back to Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={{ marginBottom: '25px' }}>
        <h2>Book Equipment</h2>

        <p style={{ color: '#64748b' }}>
          Request equipment from one or more laboratories
          without reserving laboratory space.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            ...styles.card,
            background: '#fef2f2',
            borderColor: '#fecaca',
            color: '#991b1b'
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          style={{
            ...styles.card,
            background: '#f0fdf4',
            borderColor: '#bbf7d0',
            color: '#166534'
          }}
        >
          <strong>{success}</strong>

          <div style={{ marginTop: '15px' }}>
            {onNavigate && (
              <button
                type="button"
                style={{
                  ...styles.button,
                  background: '#166534',
                  color: '#fff'
                }}
                onClick={() =>
                  onNavigate('my-bookings')
                }
              >
                View My Bookings
              </button>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* STAFF INFORMATION */}

        <div style={styles.card}>
          <h3>Staff Information</h3>

          <div style={styles.row}>
            <div>
              <label style={styles.label}>
                Staff Name
              </label>

              <input
                style={{
                  ...styles.input,
                  background: '#f1f5f9'
                }}
                value={user?.name || ''}
                readOnly
              />
            </div>

            <div>
              <label style={styles.label}>
                Email Address
              </label>

              <input
                style={{
                  ...styles.input,
                  background: '#f1f5f9'
                }}
                value={user?.email || ''}
                readOnly
              />
            </div>
          </div>

          <p
            style={{
              color: '#64748b',
              fontSize: '13px'
            }}
          >
            Staff information is taken from your
            logged-in account.
          </p>
        </div>

        {/* EQUIPMENT SELECTION */}

        <div style={styles.card}>
          <h3>Equipment Selection</h3>

          <p style={{ color: '#64748b' }}>
            Select the laboratory that owns each equipment
            type. You can add equipment from different
            laboratories in the same request.
          </p>

          {loading ? (
            <p>Loading laboratories and equipment...</p>
          ) : (
            <>
              {rows.map((row, index) => {
                const availableEquipment =
                  getLabEquipment(row.labId);

                const selectedEquipment =
                  equipment.find(
                    item =>
                      getId(item) ===
                      row.equipmentId
                  );

                const usableQuantity = Number(
                  selectedEquipment?.usableQuantity ??
                  selectedEquipment?.totalQuantity ??
                  0
                );

                return (
                  <div
                    key={row.key}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '9px',
                      padding: '18px',
                      marginBottom: '15px',
                      background: '#f8fafc'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent:
                          'space-between',
                        alignItems: 'center',
                        marginBottom: '15px'
                      }}
                    >
                      <strong>
                        Equipment {index + 1}
                      </strong>

                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            removeRow(row.key)
                          }
                          style={{
                            ...styles.button,
                            background: '#fee2e2',
                            color: '#b91c1c'
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div style={styles.row}>
                      <div>
                        <label style={styles.label}>
                          Laboratory *
                        </label>

                        <select
                          style={styles.input}
                          value={row.labId}
                          onChange={event =>
                            updateRow(
                              row.key,
                              'labId',
                              event.target.value
                            )
                          }
                          required
                        >
                          <option value="">
                            Select Laboratory
                          </option>

                          {labs.map(lab => (
                            <option
                              key={getId(lab)}
                              value={getId(lab)}
                            >
                              {lab.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={styles.label}>
                          Equipment *
                        </label>

                        <select
                          style={styles.input}
                          value={row.equipmentId}
                          onChange={event =>
                            updateRow(
                              row.key,
                              'equipmentId',
                              event.target.value
                            )
                          }
                          disabled={!row.labId}
                          required
                        >
                          <option value="">
                            Select Equipment
                          </option>

                          {availableEquipment
                            .filter(item => {
                              const id = getId(item);

                              return (
                                id === row.equipmentId ||
                                !selectedEquipmentIds.includes(
                                  id
                                )
                              );
                            })
                            .map(item => (
                              <option
                                key={getId(item)}
                                value={getId(item)}
                                disabled={
                                  item.isAvailable === false ||
                                  Number(
                                    item.usableQuantity ??
                                    item.totalQuantity ??
                                    0
                                  ) < 1
                                }
                              >
                                {item.name} ({item.code})
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    <div style={styles.row}>
                      <div>
                        <label style={styles.label}>
                          Requested Quantity *
                        </label>

                        <input
                          type="number"
                          min="1"
                          max={
                            selectedEquipment
                              ? usableQuantity
                              : undefined
                          }
                          step="1"
                          style={styles.input}
                          value={row.quantity}
                          onChange={event =>
                            updateRow(
                              row.key,
                              'quantity',
                              event.target.value
                            )
                          }
                          disabled={
                            !row.equipmentId
                          }
                          required
                        />
                      </div>

                      <div>
                        <label style={styles.label}>
                          Usable Quantity
                        </label>

                        <input
                          style={{
                            ...styles.input,
                            background: '#f1f5f9'
                          }}
                          value={
                            selectedEquipment
                              ? usableQuantity
                              : '—'
                          }
                          readOnly
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={addRow}
                style={{
                  ...styles.button,
                  background: '#e0ecff',
                  color: '#17365d'
                }}
              >
                + Add Another Equipment
              </button>
            </>
          )}
        </div>

        {/* BOOKING DATE AND TIME */}

        <div style={styles.card}>
          <h3>Booking Date and Time</h3>

          <div style={styles.row}>
            <div>
              <label style={styles.label}>
                Booking Date *
              </label>

              <input
                type="date"
                min={getToday()}
                style={styles.input}
                value={bookingDate}
                onChange={event =>
                  setBookingDate(event.target.value)
                }
                required
              />
            </div>

            <div>
              <label style={styles.label}>
                Start Time *
              </label>

              <input
                type="time"
                style={styles.input}
                value={startTime}
                onChange={event =>
                  setStartTime(event.target.value)
                }
                required
              />
            </div>

            <div>
              <label style={styles.label}>
                End Time *
              </label>

              <input
                type="time"
                style={styles.input}
                value={endTime}
                onChange={event =>
                  setEndTime(event.target.value)
                }
                required
              />
            </div>
          </div>
        </div>

        {/* PURPOSE */}

        <div style={styles.card}>
          <h3>Purpose of Booking</h3>

          <label style={styles.label}>
            Reason for Request *
          </label>

          <textarea
            style={{
              ...styles.input,
              resize: 'vertical',
              minHeight: '110px'
            }}
            value={purpose}
            onChange={event =>
              setPurpose(event.target.value)
            }
            placeholder="Explain why you need this equipment..."
            required
          />
        </div>

        {/* SUMMARY */}

        <div style={styles.card}>
          <h3>Booking Summary</h3>

          <p>
            <strong>Booking Type:</strong>{' '}
            Equipment Only
          </p>

          <p>
            <strong>Laboratory Space:</strong>{' '}
            Not Reserved
          </p>

          <p>
            <strong>Approval Status:</strong>{' '}
            Pending after submission
          </p>

          {summary.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  marginTop: '15px'
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: '#f1f5f9'
                    }}
                  >
                    <th style={{ padding: '12px' }}>
                      Laboratory
                    </th>
                    <th style={{ padding: '12px' }}>
                      Equipment
                    </th>
                    <th style={{ padding: '12px' }}>
                      Quantity
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {summary.map(item => (
                    <tr key={item.key}>
                      <td
                        style={{
                          padding: '12px',
                          borderBottom:
                            '1px solid #e2e8f0'
                        }}
                      >
                        {item.labName}
                      </td>

                      <td
                        style={{
                          padding: '12px',
                          borderBottom:
                            '1px solid #e2e8f0'
                        }}
                      >
                        {item.equipmentName}
                      </td>

                      <td
                        style={{
                          padding: '12px',
                          borderBottom:
                            '1px solid #e2e8f0'
                        }}
                      >
                        {item.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p>
            <strong>Total Equipment Types:</strong>{' '}
            {summary.length}
          </p>

          <p>
            <strong>Total Units Requested:</strong>{' '}
            {totalUnits}
          </p>

          <p
            style={{
              fontSize: '13px',
              color: '#64748b'
            }}
          >
            Quantities shown are current usable inventory,
            not guaranteed availability for the selected
            booking period. The administrator will verify
            availability and assign individual equipment
            IDs during approval.
          </p>
        </div>

        {/* FORM BUTTONS */}

        <div
          style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          <button
            type="submit"
            disabled={
              submitting ||
              loading ||
              equipment.length === 0
            }
            style={{
              ...styles.button,
              background: '#17365d',
              color: '#fff',
              opacity: submitting ? 0.6 : 1
            }}
          >
            {submitting
              ? 'Submitting Request...'
              : 'Submit Equipment Booking Request'}
          </button>

          {onNavigate && (
            <button
              type="button"
              onClick={() =>
                onNavigate('dashboard')
              }
              style={{
                ...styles.button,
                background: '#e2e8f0',
                color: '#334155'
              }}
            >
              Back to Dashboard
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export default StaffEquipmentBooking;
