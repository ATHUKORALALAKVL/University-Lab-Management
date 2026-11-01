
import { useEffect, useState } from 'react';

const API_URL = 'https://university-lab-backend.vercel.app';

// DATE AND TIME HELPERS

const getBookingDateString = (booking) => {
  if (!booking.bookingDate) return null;

  const date = new Date(booking.bookingDate);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
};

// Convert a booking's Sri Lankan local end time
// into an absolute timestamp.

const getSessionEnd = (booking) => {
  const dateString = getBookingDateString(booking);

  if (!dateString || !booking.endTime) {
    return null;
  }

  const match = String(booking.endTime).match(
    /^([01]\d|2[0-3]):([0-5]\d)$/
  );

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  const sessionEnd = new Date(
    `${dateString}T${String(hours).padStart(2, '0')}:` +
    `${String(minutes).padStart(2, '0')}:00+05:30`
  );

  if (Number.isNaN(sessionEnd.getTime())) {
    return null;
  }

  return sessionEnd;
};

const formatBookingDate = (booking) => {
  const dateString = getBookingDateString(booking);

  if (!dateString) return 'Invalid Date';

  return new Date(
    `${dateString}T00:00:00.000Z`
  ).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

// ADMIN REPORTS

function AdminReports() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [appliedRange, setAppliedRange] = useState(null);

  // LOAD ALL BOOKINGS

  useEffect(() => {
    const loadReports = async () => {
      try {
        const token = sessionStorage.getItem('token');

        const response = await fetch(
          `${API_URL}/api/admin/bookings`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        if (!response.ok) {
          throw new Error(
            'Failed to load booking history'
          );
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error(
            'Invalid booking history response'
          );
        }

        setBookings(data);
        setError('');
      } catch (err) {
        console.error('Reports error:', err);

        setError(
          'Unable to load laboratory session reports.'
        );
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, []);

  // COMPLETED LABORATORY SESSION LOGIC

  const now = new Date();

  const completedBookings = bookings
    .filter((booking) => {

      // 1. Only laboratory bookings.
      

      if (booking.bookingType === 'equipment') {
        return false;
      }

      // 2. Current status must still be Approved.
      

      if (booking.status !== 'Approved') {
        return false;
      }

      // 3. The booked laboratory session must

      const sessionEnd = getSessionEnd(booking);

      if (!sessionEnd || sessionEnd > now) {
        return false;
      }

      // 4. Apply optional report date range.
     

      if (appliedRange) {
        const dateString =
          getBookingDateString(booking);

        if (
          !dateString ||
          dateString < appliedRange.from ||
          dateString > appliedRange.to
        ) {
          return false;
        }
      }

      return true;
    })
    .sort(
      (a, b) =>
        getSessionEnd(b) - getSessionEnd(a)
    );

  // DATE FILTER HANDLERS

  const generateReport = () => {
    if (!fromDate || !toDate) {
      alert('Please select both dates.');
      return;
    }

    if (fromDate > toDate) {
      alert(
        'From Date cannot be later than To Date.'
      );
      return;
    }

    setAppliedRange({
      from: fromDate,
      to: toDate
    });
  };

  const clearFilter = () => {
    setFromDate('');
    setToDate('');
    setAppliedRange(null);
  };

  // ====================================================
  // REPORT PAGE
  // ====================================================

  return (
    <section className="laboratories-section">

      <h2>Completed Laboratory Sessions</h2>

      {/* DATE RANGE FILTER */}

      <div
        style={{
          display: 'flex',
          gap: '15px',
          flexWrap: 'wrap',
          alignItems: 'end',
          marginBottom: '25px'
        }}
      >
        <div>
          <label htmlFor="report-from-date">
            From Date
          </label>

          <br />

          <input
            id="report-from-date"
            type="date"
            value={fromDate}
            onChange={(e) =>
              setFromDate(e.target.value)
            }
            style={{ padding: '10px' }}
          />
        </div>

        <div>
          <label htmlFor="report-to-date">
            To Date
          </label>

          <br />

          <input
            id="report-to-date"
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) =>
              setToDate(e.target.value)
            }
            style={{ padding: '10px' }}
          />
        </div>

        <button
          type="button"
          onClick={generateReport}
        >
          Generate Report
        </button>

        <button
          type="button"
          onClick={clearFilter}
        >
          Clear Filter
        </button>
      </div>

      {/* ACTIVE DATE RANGE */}

      {appliedRange && (
        <p>
          Showing completed sessions from{' '}
          <strong>
            {appliedRange.from}
          </strong>{' '}
          to{' '}
          <strong>
            {appliedRange.to}
          </strong>
          {' — '}
          <strong>
            {completedBookings.length} sessions
          </strong>
        </p>
      )}

      {/* REPORT DESCRIPTION */}

      <p>
        Approved laboratory bookings whose scheduled
        end times have passed. Cancelled bookings,
        equipment-only bookings, and bookings that
        are not currently approved are excluded.
        Results are arranged from newest to oldest.
      </p>

      {/* LOADING AND ERRORS */}

      {loading ? (
        <p>
          Loading completed laboratory sessions...
        </p>
      ) : error ? (
        <p style={{ color: 'red' }}>
          {error}
        </p>
      ) : completedBookings.length === 0 ? (
        <p>
          No completed laboratory sessions found.
        </p>
      ) : (

        // REPORT TABLE

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
                  'Date',
                  'Laboratory',
                  'Booked By',
                  'Email',
                  'Start Time',
                  'End Time',
                  'Purpose',
                  'Equipment Used'
                ].map((heading) => (
                  <th
                    key={heading}
                    style={{
                      padding: '12px',
                      border: '1px solid #ddd',
                      textAlign: 'left',
                      backgroundColor: '#f5f7fa'
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {completedBookings.map((booking) => {

                

                const equipmentUsed =
                  booking.approvedEquipment?.length > 0
                    ? booking.approvedEquipment
                    : booking.equipment || [];

                return (
                  <tr key={booking._id}>

                    {/* BOOKING DATE */}

                    <td
                      style={{
                        padding: '10px',
                        border: '1px solid #ddd'
                      }}
                    >
                      {formatBookingDate(booking)}
                    </td>

                    {/* LABORATORY */}

                    <td
                      style={{
                        padding: '10px',
                        border: '1px solid #ddd'
                      }}
                    >
                      {booking.lab?.name ||
                        'Unknown Laboratory'}
                    </td>

                    {/* REQUESTER NAME */}

                    <td
                      style={{
                        padding: '10px',
                        border: '1px solid #ddd'
                      }}
                    >
                      {booking.studentName}
                    </td>

                    {/* REQUESTER EMAIL */}

                    <td
                      style={{
                        padding: '10px',
                        border: '1px solid #ddd'
                      }}
                    >
                      {booking.studentEmail}
                    </td>

                    {/* START TIME */}

                    <td
                      style={{
                        padding: '10px',
                        border: '1px solid #ddd'
                      }}
                    >
                      {booking.startTime}
                    </td>

                    {/* END TIME */}

                    <td
                      style={{
                        padding: '10px',
                        border: '1px solid #ddd'
                      }}
                    >
                      {booking.endTime}
                    </td>

                    {/* PURPOSE */}

                    <td
                      style={{
                        padding: '10px',
                        border: '1px solid #ddd'
                      }}
                    >
                      {booking.purpose}
                    </td>

                    {/* EQUIPMENT USED */}

                    <td
                      style={{
                        padding: '10px',
                        border: '1px solid #ddd'
                      }}
                    >
                      {equipmentUsed.filter(
                        item =>
                          Number(item.quantity) > 0
                      ).length > 0 ? (
                        <ul
                          style={{
                            paddingLeft: '18px'
                          }}
                        >
                          {equipmentUsed
                            .filter(
                              item =>
                                Number(item.quantity) > 0
                            )
                            .map((item, index) => (
                              <li
                                key={
                                  item._id || index
                                }
                              >
                                {item.equipmentId?.name ||
                                  'Unknown Equipment'}
                                {' - '}
                                {item.quantity}
                              </li>
                            ))}
                        </ul>
                      ) : (
                        'None'
                      )}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default AdminReports;
