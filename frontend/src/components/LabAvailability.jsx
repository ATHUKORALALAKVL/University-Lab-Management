
import { useEffect, useState } from 'react';
import LabScheduleCalendar from './LabScheduleCalendar';

function LabAvailability() {
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Currently selected laboratory for viewing its schedule.
  const [scheduleLab, setScheduleLab] = useState(null);

  // ======================================================
  // LOAD LABORATORIES
  // ======================================================

  useEffect(() => {
    const controller = new AbortController();

    async function fetchLabs() {
      try {
        const response = await fetch(
          'https://university-lab-backend.vercel.app/api/labs',
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(
            'Failed to fetch laboratories'
          );
        }

        const data = await response.json();

        setLabs(
          Array.isArray(data) ? data : []
        );
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(
            'Unable to load laboratory information.'
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchLabs();

    return () => controller.abort();
  }, []);

  // ======================================================
  // VIEW / CLOSE LABORATORY SCHEDULE
  // ======================================================

  const handleViewSchedule = (lab) => {
    setScheduleLab(lab);
  };

  const handleCloseSchedule = () => {
    setScheduleLab(null);
  };

  // ======================================================
  // PAGE
  // ======================================================

  return (
    <section className="laboratories-section">
      <h2>Laboratory Availability & Booking</h2>

      <p>
        View laboratory capacity, availability,
        and booking information here.
      </p>

      {loading && (
        <p>Loading laboratories...</p>
      )}

      {error && (
        <p role="alert">{error}</p>
      )}

      {!loading && !error && labs.length === 0 && (
        <p>No laboratories found.</p>
      )}

      {!loading && !error && (
        <div className="labs-grid">
          {labs.map((lab) => (
            <div
              className="lab-card"
              key={lab._id}
            >
              <div className="lab-card-body">
                <h3>{lab.name}</h3>

                <p>
                  <strong>Location:</strong>{' '}
                  {lab.location}
                </p>

                <p>
                  <strong>Capacity:</strong>{' '}
                  {lab.capacity}
                </p>

                <p>
                  <strong>Availability:</strong>{' '}
                  {lab.isAvailable
                    ? 'Available'
                    : 'Unavailable'}
                </p>

                {/* VIEW SCHEDULE BUTTON */}

                <button
                  type="button"
                  onClick={() =>
                    handleViewSchedule(lab)
                  }
                  style={{
                    marginTop: '15px',
                    padding: '10px 16px',
                    backgroundColor: '#17345c',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    width: '100%'
                  }}
                >
                  View Schedule
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MONTHLY LABORATORY SCHEDULE */}

      {scheduleLab && (
        <LabScheduleCalendar
          key={scheduleLab._id}
          lab={scheduleLab}
          onClose={handleCloseSchedule}
        />
      )}
    </section>
  );
}

export default LabAvailability;
