
import { useState, useEffect } from 'react';

const API = 'http://localhost:5000/api';

const UNDERGRADUATE_LAB_NAME = 'Undergraduate Project Lab';

const STAFF_START_TIME = '08:30';
const STAFF_END_TIME = '16:30';

const isUndergraduateLab = (lab) =>
  String(lab?.name || '').trim().toLowerCase() ===
  UNDERGRADUATE_LAB_NAME.toLowerCase();

function LabBooking({ user }) {
  const [labs, setLabs] = useState([]);
  const [selectedLab, setSelectedLab] = useState('');

  const [equipment, setEquipment] = useState([]);
  const [selectedEquipment, setSelectedEquipment] = useState({});

  const [bookingDate, setBookingDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [purpose, setPurpose] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [timeError, setTimeError] = useState('');

  const token = sessionStorage.getItem('token');

  // ======================================================
  // USER ROLES
  // ======================================================

  const isStaff = user?.role === 'staff';
  const isStudent = user?.role === 'student';

  // Students can book only the Undergraduate Project Lab.
  // Staff can book all available laboratories.

  const availableLabs = labs.filter((lab) => {
    if (!lab.isAvailable) {
      return false;
    }

    if (isStaff) {
      return true;
    }

    if (isStudent) {
      return isUndergraduateLab(lab);
    }

    return false;
  });

  const selectedLabRecord = availableLabs.find(
    (lab) => String(lab._id) === String(selectedLab)
  );

  // Only staff bookings for laboratories OTHER THAN
  // the Undergraduate Project Lab are time restricted.

  const hasStaffTimeRestriction =
    isStaff &&
    Boolean(selectedLabRecord) &&
    !isUndergraduateLab(selectedLabRecord);

  // ======================================================
  // EQUIPMENT FOR SELECTED LABORATORY
  // ======================================================

  const labEquipment = equipment.filter(
    (item) =>
      String(item.lab?._id || item.lab) ===
      String(selectedLab)
  );

  // ======================================================
  // TIME VALIDATION
  // ======================================================

  const validateBookingTimes = (start, end, restricted) => {
    if (!start || !end) {
      return '';
    }

    if (start >= end) {
      return 'End time must be later than start time.';
    }

    if (restricted) {
      if (
        start < STAFF_START_TIME ||
        start > STAFF_END_TIME
      ) {
        return (
          'Start time must be between 8:30 AM and 4:30 PM.'
        );
      }

      if (
        end < STAFF_START_TIME ||
        end > STAFF_END_TIME
      ) {
        return (
          'End time must be between 8:30 AM and 4:30 PM.'
        );
      }
    }

    return '';
  };

  // Revalidate whenever the lab or entered times change.

  useEffect(() => {
    setTimeError(
      validateBookingTimes(
        startTime,
        endTime,
        hasStaffTimeRestriction
      )
    );
  }, [startTime, endTime, hasStaffTimeRestriction]);

  // ======================================================
  // LOAD LABORATORIES AND EQUIPMENT
  // ======================================================

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setErrorMessage('');

        const [labsResponse, equipmentResponse] =
          await Promise.all([
            fetch(`${API}/labs`),
            fetch(`${API}/equipment`)
          ]);

        if (!labsResponse.ok || !equipmentResponse.ok) {
          throw new Error(
            'Unable to load laboratories or equipment.'
          );
        }

        const labsData = await labsResponse.json();
        const equipmentData = await equipmentResponse.json();

        setLabs(
          Array.isArray(labsData) ? labsData : []
        );

        setEquipment(
          Array.isArray(equipmentData)
            ? equipmentData
            : []
        );
      } catch (error) {
        console.error('Load booking data error:', error);
        setErrorMessage(error.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // ======================================================
  // SUBMIT BOOKING
  // ======================================================

  const handleBooking = async (e) => {
    e.preventDefault();

    if (!isStudent && !isStaff) {
      alert(
        'Your account is not authorized to request laboratory bookings.'
      );
      return;
    }

    const lab = availableLabs.find(
      (item) => String(item._id) === String(selectedLab)
    );

    if (!lab) {
      alert(
        'Please select a laboratory available to your account.'
      );
      return;
    }

    // Independently check the selected lab's restriction
    // before submitting the request.

    const restricted =
      isStaff && !isUndergraduateLab(lab);

    if (!bookingDate || !startTime || !endTime) {
      alert('Please select a booking date and time.');
      return;
    }

    const validationError = validateBookingTimes(
      startTime,
      endTime,
      restricted
    );

    if (validationError) {
      setTimeError(validationError);
      alert(validationError);
      return;
    }

    if (!purpose.trim()) {
      alert('Please enter the purpose of your booking.');
      return;
    }

    // Prepare selected equipment and quantities.

    const requestedEquipment = labEquipment
      .filter(
        (item) =>
          Number(selectedEquipment[item._id] || 0) > 0
      )
      .map((item) => ({
        equipmentId: item._id,
        quantity: Number(selectedEquipment[item._id])
      }));

    setSubmitting(true);

    try {
      const response = await fetch(`${API}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          lab: selectedLab,
          bookingDate,
          startTime,
          endTime,
          purpose: purpose.trim(),
          equipment: requestedEquipment
        })
      });

      const data = await response.json();

      if (response.ok) {
        alert('Booking request submitted successfully!');

        // Reset form after successful submission.

        setSelectedLab('');
        setSelectedEquipment({});
        setBookingDate('');
        setStartTime('');
        setEndTime('');
        setPurpose('');
        setTimeError('');
      } else {
        alert(data.message || 'Booking failed');
      }
    } catch (error) {
      console.error('Booking error:', error);
      alert('Cannot connect to the server');
    } finally {
      setSubmitting(false);
    }
  };

  // ======================================================
  // BOOKING FORM
  // ======================================================

  return (
    <section className="laboratories-section">
      <h2>Laboratory Booking Request</h2>

      <p>
        Request laboratory access for academic practical
        sessions, projects, and learning activities.
      </p>

      {/* STUDENT BOOKING INFORMATION */}

      {isStudent && (
        <p
          style={{
            padding: '12px',
            backgroundColor: '#f0f6ff',
            border: '1px solid #d5e5ff',
            borderRadius: '6px',
            color: '#172f52'
          }}
        >
          <strong>Student Booking Access:</strong>{' '}
          Students can request laboratory bookings only for
          the Undergraduate Project Lab.
          This laboratory is available for booking 24/7.
        </p>
      )}

      {/* STAFF BOOKING INFORMATION */}

     

      {loading ? (
        <p>Loading laboratories and equipment...</p>
      ) : errorMessage ? (
        <p style={{ color: 'red' }}>
          {errorMessage}
        </p>
      ) : !isStudent && !isStaff ? (
        <p style={{ color: 'red' }}>
          Your account is not authorized to request
          laboratory bookings. Please log in using
          a student or verified staff account.
        </p>
      ) : availableLabs.length === 0 ? (
        <p style={{ color: '#b36b00' }}>
          {isStudent
            ? 'The Undergraduate Project Lab is currently unavailable or could not be found.'
            : 'No laboratories are currently available for booking.'}
        </p>
      ) : (
        <form
          className="login-form"
          onSubmit={handleBooking}
        >
          {/* LABORATORY SELECTION */}

          <label htmlFor="booking-lab">
            Select Laboratory
          </label>

          <select
            id="booking-lab"
            value={selectedLab}
            onChange={(e) => {
              setSelectedLab(e.target.value);
              setSelectedEquipment({});
            }}
            required
          >
            <option value="">
              Choose a laboratory
            </option>

            {availableLabs.map((lab) => (
              <option
                key={lab._id}
                value={lab._id}
              >
                {lab.name}
              </option>
            ))}
          </select>


          {/* OPTIONAL EQUIPMENT SELECTION */}

          {selectedLab && (
            <div
              style={{
                marginTop: '20px',
                marginBottom: '20px'
              }}
            >
              <h3>
                Select Equipment and Quantity (Optional)
              </h3>

              {labEquipment.length === 0 ? (
                <p>
                  No equipment has been added to this
                  laboratory yet.
                </p>
              ) : (
                <div>
                  {labEquipment.map((item) => (
                    <div
                      key={item._id}
                      style={{
                        marginBottom: '15px'
                      }}
                    >
                      <label>
                        {item.name}{' '}
                        (Total: {item.totalQuantity})
                      </label>

                      <select
                        value={
                          selectedEquipment[item._id] || 0
                        }
                        onChange={(e) =>
                          setSelectedEquipment({
                            ...selectedEquipment,
                            [item._id]: Number(
                              e.target.value
                            )
                          })
                        }
                      >
                        {Array.from(
                          {
                            length:
                              Number(item.totalQuantity || 0) + 1
                          },
                          (_, index) => (
                            <option
                              key={index}
                              value={index}
                            >
                              {index}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  ))}
                </div>
              )}

              <p
                style={{
                  fontSize: '13px',
                  color: '#666'
                }}
              >
                Select 0 if you do not need an equipment
                item. Quantities shown are total inventory,
                not confirmed availability for your
                booking time.
              </p>
            </div>
          )}

          {/* BOOKING DATE */}

          <label htmlFor="booking-date">
            Booking Date
          </label>

          <input
            id="booking-date"
            type="date"
            value={bookingDate}
            onChange={(e) =>
              setBookingDate(e.target.value)
            }
            required
          />

          {/* START TIME */}

          <label htmlFor="booking-start-time">
            Start Time
          </label>

          <input
            id="booking-start-time"
            type="time"
            value={startTime}
            min={
              hasStaffTimeRestriction
                ? STAFF_START_TIME
                : undefined
            }
            max={
              hasStaffTimeRestriction
                ? STAFF_END_TIME
                : undefined
            }
            step="60"
            onChange={(e) =>
              setStartTime(e.target.value)
            }
            required
          />

          {/* END TIME */}

          <label htmlFor="booking-end-time">
            End Time
          </label>

          <input
            id="booking-end-time"
            type="time"
            value={endTime}
            min={
              hasStaffTimeRestriction
                ? STAFF_START_TIME
                : undefined
            }
            max={
              hasStaffTimeRestriction
                ? STAFF_END_TIME
                : undefined
            }
            step="60"
            onChange={(e) =>
              setEndTime(e.target.value)
            }
            required
          />

          {/* TIME VALIDATION MESSAGE */}

          {timeError && (
            <p
              role="alert"
              style={{
                color: '#b42318',
                backgroundColor: '#fff1f0',
                border: '1px solid #ffccc7',
                padding: '10px',
                borderRadius: '6px',
                marginTop: '8px'
              }}
            >
              {timeError}
            </p>
          )}

          {hasStaffTimeRestriction && !timeError && (
            <p
              style={{
                color: '#666',
                fontSize: '13px',
                marginTop: '8px'
              }}
            >
              Allowed booking period:
              8:30 AM to 4:30 PM.
              For example, 9:00 AM to 12:00 PM.
            </p>
          )}

          {/* PURPOSE */}

          <label htmlFor="booking-purpose">
            Purpose
          </label>

          <textarea
            id="booking-purpose"
            placeholder="Enter the purpose of your booking"
            value={purpose}
            onChange={(e) =>
              setPurpose(e.target.value)
            }
            required
          />

          {/* SUBMIT BUTTON */}

          <button
            type="submit"
            disabled={
              submitting ||
              Boolean(timeError)
            }
          >
            {submitting
              ? 'Submitting...'
              : 'Request Booking'}
          </button>
        </form>
      )}
    </section>
  );
}

export default LabBooking;
