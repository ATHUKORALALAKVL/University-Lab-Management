
import { useEffect, useState } from 'react';

const API = 'https://university-lab-backend.vercel.app/api';

function LabScheduleCalendar({ lab, onClose }) {
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date().getMonth()
  );

  const [currentYear, setCurrentYear] = useState(
    () => new Date().getFullYear()
  );

  const [selectedDay, setSelectedDay] = useState(
    () => new Date().getDate()
  );

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const monthName = new Date(
    currentYear,
    currentMonth,
    1
  ).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  const daysInMonth = new Date(
    currentYear,
    currentMonth + 1,
    0
  ).getDate();

  const firstDayOfWeek = new Date(
    currentYear,
    currentMonth,
    1
  ).getDay();

  const formatDate = (year, month, day) => {
    return (
      `${year}-` +
      `${String(month + 1).padStart(2, '0')}-` +
      `${String(day).padStart(2, '0')}`
    );
  };

  const formatTime = (time) => {
    if (!time) return '';

    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;

    return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  // ======================================================
  // LOAD APPROVED BOOKINGS FOR SELECTED MONTH
  // ======================================================

  useEffect(() => {
    if (!lab?._id) return;

    const controller = new AbortController();

    const loadSchedule = async () => {
      setLoading(true);
      setError('');

      try {
        const month = String(currentMonth + 1).padStart(2, '0');

        const response = await fetch(
          `${API}/labs/${lab._id}/schedule?month=${currentYear}-${month}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error('Unable to load laboratory schedule.');
        }

        const data = await response.json();

        setBookings(
          Array.isArray(data) ? data : []
        );
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message);
          setBookings([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadSchedule();

    return () => controller.abort();
  }, [lab?._id, currentMonth, currentYear]);

  // ======================================================
  // MONTH NAVIGATION
  // ======================================================

  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((year) => year - 1);
    } else {
      setCurrentMonth((month) => month - 1);
    }

    setSelectedDay(null);
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((year) => year + 1);
    } else {
      setCurrentMonth((month) => month + 1);
    }

    setSelectedDay(null);
  };

  // ======================================================
  // BOOKINGS FOR A PARTICULAR DATE
  // ======================================================

  const getBookingsForDay = (day) => {
    const date = formatDate(
      currentYear,
      currentMonth,
      day
    );

    return bookings
      .filter((booking) => booking.bookingDate === date)
      .sort((a, b) =>
        a.startTime.localeCompare(b.startTime)
      );
  };

  const selectedBookings = selectedDay
    ? getBookingsForDay(selectedDay)
    : [];

  // ======================================================
  // CALENDAR DISPLAY
  // ======================================================

  const calendarDays = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from(
      { length: daysInMonth },
      (_, index) => index + 1
    )
  ];

  return (
    <div
      style={{
        marginTop: '30px',
        padding: '20px',
        backgroundColor: '#fff',
        border: '1px solid #dce3eb',
        borderRadius: '10px'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}
      >
        <h3>{lab.name} — Booking Schedule</h3>

        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          margin: '20px 0'
        }}
      >
        <button
          type="button"
          onClick={goToPreviousMonth}
        >
          Previous
        </button>

        <h3>{monthName}</h3>

        <button
          type="button"
          onClick={goToNextMonth}
        >
          Next
        </button>
      </div>

      {loading && <p>Loading approved bookings...</p>}

      {error && (
        <p role="alert" style={{ color: 'red' }}>
          {error}
        </p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: '6px'
        }}
      >
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
          (day) => (
            <div
              key={day}
              style={{
                textAlign: 'center',
                fontWeight: 'bold',
                padding: '8px 0'
              }}
            >
              {day}
            </div>
          )
        )}

        {calendarDays.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} />;
          }

          const dayBookings = getBookingsForDay(day);
          const hasBookings = dayBookings.length > 0;
          const isSelected = selectedDay === day;

          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              style={{
                minHeight: '58px',
                padding: '5px',
                borderRadius: '6px',
                border: isSelected
                  ? '2px solid #17345c'
                  : '1px solid #dce3eb',
                backgroundColor: isSelected
                  ? '#eaf1fb'
                  : '#fff',
                cursor: 'pointer',
                fontWeight: isSelected ? 'bold' : 'normal'
              }}
            >
              <div>{day}</div>

              {hasBookings && (
                <div
                  style={{
                    marginTop: '4px',
                    fontSize: '10px',
                    color: '#1d6a45'
                  }}
                >
                  {dayBookings.length} booked
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <div
          style={{
            marginTop: '24px',
            padding: '16px',
            backgroundColor: '#f5f8fc',
            borderRadius: '8px'
          }}
        >
          <h4>
            Approved Bookings —{' '}
            {formatDate(
              currentYear,
              currentMonth,
              selectedDay
            )}
          </h4>

          {!loading && !error && selectedBookings.length === 0 && (
            <p>No approved bookings for this date.</p>
          )}

          {!loading && !error && selectedBookings.map(
            (booking) => (
              <div
                key={booking._id}
                style={{
                  marginBottom: '10px',
                  padding: '12px',
                  backgroundColor: '#fff',
                  border: '1px solid #dce3eb',
                  borderRadius: '6px'
                }}
              >
                <strong>
                  {formatTime(booking.startTime)}
                  {' – '}
                  {formatTime(booking.endTime)}
                </strong>

               <p
  style={{
    margin: '8px 0 0',
    color: '#444',
    overflowWrap: 'anywhere'
  }}
>
  <strong>Purpose:</strong>{' '}
  {booking.purpose || 'Not specified'}
</p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default LabScheduleCalendar;
