
import { useState, useEffect, useCallback } from 'react';

const API_URL = 'https://university-lab-backend.vercel.app';

// ======================================================
// HELPERS
// ======================================================

const getId = value => {
  if (!value) return '';
  return String(value._id || value);
};

const isEquipmentOnly = booking =>
  booking.bookingType === 'equipment';

const getEquipmentName = item =>
  item?.equipmentId?.name || 'Unknown Equipment';

const getEquipmentCode = item =>
  item?.equipmentId?.code || '';

const extractArray = (data, key) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const formatDateTime = value => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString('en-GB', {
    timeZone: 'Asia/Colombo',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

const formatBookingDate = value => {
  if (!value) return 'Not recorded';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Not recorded';
  }

  return date.toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const getStatusColor = status => {
  if (status === 'Approved') return '#176b37';

  if (status === 'Rejected' || status === 'Cancelled') {
    return '#b42318';
  }

  return '#b36b00';
};

// ======================================================
// LABORATORY NAME RESOLUTION
// ======================================================

const getLabName = (
  item,
  equipmentList = [],
  labs = []
) => {
  const equipment = item?.equipmentId;

  if (!equipment) {
    return 'Laboratory not recorded';
  }

  // Find the complete equipment record from catalogue.
  const equipmentRecord = equipmentList.find(record =>
    getId(record) === getId(equipment)
  );

  // Prefer populated lab from booking.
  // Otherwise use catalogue lab.
  const lab =
    equipment?.lab ||
    equipmentRecord?.lab;

  if (!lab) {
    return 'Laboratory not recorded';
  }

  if (typeof lab === 'object' && lab.name) {
    return lab.name;
  }

  const labRecord = labs.find(record =>
    getId(record) === getId(lab)
  );

  return labRecord?.name || 'Laboratory not recorded';
};

const groupEquipmentByLab = (
  equipment,
  equipmentList,
  labs
) => {
  const groups = new Map();

  for (const item of equipment || []) {
    const labName = getLabName(
      item,
      equipmentList,
      labs
    );

    if (!groups.has(labName)) {
      groups.set(labName, []);
    }

    groups.get(labName).push(item);
  }

  return Array.from(groups.entries()).map(
    ([labName, items]) => ({
      labName,
      items
    })
  );
};

// ======================================================
// STYLES
// ======================================================

const timestampStyle = {
  fontSize: '12px',
  color: '#64748b',
  lineHeight: '1.6'
};

const sectionStyle = {
  marginTop: '15px',
  marginBottom: '15px',
  padding: '15px',
  backgroundColor: '#f5f9ff',
  border: '1px solid #d8e5f5',
  borderRadius: '8px'
};

const equipmentCardStyle = {
  backgroundColor: 'white',
  border: '1px solid #ddd',
  borderRadius: '6px',
  padding: '12px',
  marginBottom: '12px'
};

const labelStyle = {
  color: '#64748b',
  fontSize: '13px'
};

// ======================================================
// BOOKING TIMESTAMPS
// ======================================================

function BookingTimestamps({ booking }) {
  const requestedAt = formatDateTime(
    booking.createdAt
  );

  const changedAt = formatDateTime(
    booking.statusChangedAt
  );

  const statusLabels = {
    Approved: 'Approved',
    Rejected: 'Rejected',
    Cancelled: 'Cancelled',
    'Cancellation Requested': 'Cancellation Requested'
  };

  const changedLabel = statusLabels[booking.status];

  return (
    <div
      style={{
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: '1px solid #eee'
      }}
    >
      {requestedAt && (
        <div style={timestampStyle}>
          Requested: {requestedAt}
        </div>
      )}

      {changedAt && changedLabel && (
        <div style={timestampStyle}>
          {changedLabel}: {changedAt}
        </div>
      )}
    </div>
  );
}

// ======================================================
// REQUESTED EQUIPMENT
// ======================================================

function RequestedEquipment({
  booking,
  equipmentOnly,
  equipmentList,
  labs
}) {
  const requested = Array.isArray(booking.equipment)
    ? booking.equipment
    : [];

  if (requested.length === 0) {
    return (
      <div>
        <p>
          <strong>Requested Equipment:</strong>
        </p>
        <p>No equipment requested.</p>
      </div>
    );
  }

  // Preserve existing simple list for lab bookings.
  if (!equipmentOnly) {
    return (
      <div>
        <p>
          <strong>Requested Equipment:</strong>
        </p>

        <ul>
          {requested.map((item, index) => (
            <li key={item._id || index}>
              {getEquipmentName(item)}
              {' - Requested: '}
              {item.quantity}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Equipment-only bookings may use multiple labs.
  const groups = groupEquipmentByLab(
    requested,
    equipmentList,
    labs
  );

  return (
    <div style={sectionStyle}>
      <h4
        style={{
          marginTop: 0,
          color: '#172f52'
        }}
      >
        Requested Equipment
      </h4>

      <p
        style={{
          fontSize: '13px',
          color: '#64748b'
        }}
      >
        Equipment selected from the laboratories
        below. No laboratory space is reserved.
      </p>

      {groups.map(group => (
        <div
          key={group.labName}
          style={equipmentCardStyle}
        >
          <p
            style={{
              marginTop: 0,
              fontWeight: 'bold',
              color: '#172f52'
            }}
          >
            {group.labName}
          </p>

          {group.items.map((item, index) => (
            <div
              key={item._id || index}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '7px 0',
                borderTop:
                  index === 0
                    ? 'none'
                    : '1px solid #eee'
              }}
            >
              <span>
                {getEquipmentName(item)}

                {getEquipmentCode(item) && (
                  <span style={labelStyle}>
                    {' '}
                    ({getEquipmentCode(item)})
                  </span>
                )}
              </span>

              <strong style={{ whiteSpace: 'nowrap' }}>
                Qty: {item.quantity}
              </strong>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ======================================================
// APPROVED EQUIPMENT DETAILS
// ======================================================

function ApprovedEquipmentDetails({
  booking,
  equipmentOnly,
  equipmentList,
  labs
}) {
  // Cancelled bookings must NOT display
  // previously assigned equipment.
  if (booking.status === 'Cancelled') {
    return null;
  }

  // Only active approved allocations are shown.
  const isActive =
    booking.status === 'Approved' ||
    booking.status === 'Cancellation Requested';

  if (!isActive) {
    return null;
  }

  const approved = Array.isArray(
    booking.approvedEquipment
  )
    ? booking.approvedEquipment
    : [];

  const assignedUnits = Array.isArray(
    booking.issuedEquipmentItems
  )
    ? booking.issuedEquipmentItems.filter(
        unit =>
          unit &&
          typeof unit === 'object'
      )
    : [];

  if (
    approved.length === 0 &&
    assignedUnits.length === 0
  ) {
    return (
      <div style={sectionStyle}>
        <h4 style={{ marginTop: 0 }}>
          Approved Equipment Details
        </h4>

        <p>No separate equipment allocation recorded.</p>
      </div>
    );
  }

  const usedUnitIds = new Set();

  const allocations = approved.map((item, index) => {
    const equipmentTypeId = getId(
      item.equipmentId
    );

    const matchingUnits = assignedUnits.filter(unit => {
      const physicalId = getId(unit);

      if (usedUnitIds.has(physicalId)) {
        return false;
      }

      const unitEquipmentTypeId = getId(
        unit.equipment
      );

      if (
        !equipmentTypeId ||
        !unitEquipmentTypeId ||
        equipmentTypeId !== unitEquipmentTypeId
      ) {
        return false;
      }

      usedUnitIds.add(physicalId);
      return true;
    });

    return {
      key: item._id || index,
      item,
      matchingUnits
    };
  });

  // Keep unmatched IDs separate rather than
  // displaying them under the wrong equipment.
  const unmatchedUnits = assignedUnits.filter(
    unit => !usedUnitIds.has(getId(unit))
  );

  return (
    <div style={sectionStyle}>
      <h4
        style={{
          marginTop: 0,
          color: '#172f52'
        }}
      >
        Approved Equipment Details
      </h4>

      {allocations.map(allocation => {
        const { item, matchingUnits } = allocation;

        return (
          <div
            key={allocation.key}
            style={equipmentCardStyle}
          >
            <p style={{ marginTop: 0 }}>
              <strong>
                {getEquipmentName(item)}
              </strong>
            </p>

            {equipmentOnly && (
              <p style={labelStyle}>
                Source Lab:{' '}
                {getLabName(
                  item,
                  equipmentList,
                  labs
                )}
              </p>
            )}

            <p>
              <strong>Approved Quantity:</strong>{' '}
              {item.quantity}
            </p>

            <p>
              <strong>
                Assigned Individual IDs:
              </strong>
            </p>

            {matchingUnits.length > 0 ? (
              <ul>
                {matchingUnits.map(unit => (
                  <li
                    key={getId(unit)}
                    style={{
                      color: '#176b37',
                      fontWeight: 'bold',
                      padding: '4px 0'
                    }}
                  >
                    {unit.equipmentId ||
                      'ID not recorded'}
                  </li>
                ))}
              </ul>
            ) : Number(item.quantity) === 0 ? (
              <p>No units allocated.</p>
            ) : (
              <p style={{ color: '#b36b00' }}>
                Individual equipment IDs have
                not been recorded for this allocation.
              </p>
            )}
          </div>
        );
      })}

      {unmatchedUnits.length > 0 && (
        <div
          style={{
            ...equipmentCardStyle,
            borderColor: '#f0c36d',
            backgroundColor: '#fffbeb'
          }}
        >
          <p style={{ marginTop: 0 }}>
            <strong>
              Other Recorded Individual IDs
            </strong>
          </p>

          <p style={labelStyle}>
            These IDs could not be matched to an
            approved equipment type.
          </p>

          <ul>
            {unmatchedUnits.map(unit => (
              <li key={getId(unit)}>
                {unit.equipmentId ||
                  'ID not recorded'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ======================================================
// MY BOOKINGS
// ======================================================

function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [equipmentList, setEquipmentList] =
    useState([]);
  const [labs, setLabs] = useState([]);

  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] =
    useState(null);
  const [errorMessage, setErrorMessage] =
    useState('');

  // ====================================================
  // LOAD BOOKINGS, EQUIPMENT AND LABORATORIES
  // ====================================================

  const loadBookings = useCallback(async () => {
    try {
      const token = sessionStorage.getItem('token');

      const response = await fetch(
        `${API_URL}/api/bookings/my-bookings`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok || !Array.isArray(data)) {
        throw new Error(
          data.message || 'Unable to load bookings'
        );
      }

      setBookings(data);
      setErrorMessage('');
    } catch (error) {
      console.error('Load bookings error:', error);
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEquipmentAndLabs = useCallback(async () => {
    // These are read-only catalogue requests.
    // They do not modify equipment or bookings.

    const [equipmentResult, labsResult] =
      await Promise.allSettled([
        fetch(`${API_URL}/api/equipment`)
          .then(async response => {
            if (!response.ok) {
              throw new Error(
                'Could not load equipment catalogue'
              );
            }
            return response.json();
          }),

        fetch(`${API_URL}/api/labs`)
          .then(async response => {
            if (!response.ok) {
              throw new Error(
                'Could not load laboratories'
              );
            }
            return response.json();
          })
      ]);

    if (equipmentResult.status === 'fulfilled') {
      setEquipmentList(
        extractArray(
          equipmentResult.value,
          'equipment'
        )
      );
    } else {
      console.error(
        'Equipment catalogue error:',
        equipmentResult.reason
      );
    }

    if (labsResult.status === 'fulfilled') {
      setLabs(
        extractArray(labsResult.value, 'labs')
      );
    } else {
      console.error(
        'Laboratories error:',
        labsResult.reason
      );
    }
  }, []);

  useEffect(() => {
    loadBookings();
    loadEquipmentAndLabs();
  }, [loadBookings, loadEquipmentAndLabs]);

  // ====================================================
  // CANCEL BOOKING
  // ====================================================

  const cancelBooking = async bookingId => {
    if (
      !window.confirm(
        'Are you sure you want to cancel this booking? ' +
        'Any equipment assigned to this booking ' +
        'will be released.'
      )
    ) {
      return;
    }

    const reason = window.prompt(
      'Enter a cancellation reason (optional):',
      ''
    );

    if (reason === null) {
      return;
    }

    setCancellingId(bookingId);

    try {
      const token = sessionStorage.getItem('token');

      const response = await fetch(
        `${API_URL}/api/bookings/${bookingId}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            cancellationReason: reason.trim()
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          'Unable to cancel booking'
        );
      }

      alert(
        data.message ||
        'Booking cancelled successfully'
      );

      await loadBookings();
      await loadEquipmentAndLabs();
    } catch (error) {
      console.error('Cancel booking error:', error);
      alert(error.message);
    } finally {
      setCancellingId(null);
    }
  };

  // ====================================================
  // PAGE
  // ====================================================

  return (
    <section className="laboratories-section">
      <h2>My Bookings</h2>

      <p>
        View your laboratory and equipment-only
        bookings, requested and approved equipment,
        individual equipment IDs, administrator
        comments, and cancellation history.
      </p>

      {loading ? (
        <p>Loading your bookings...</p>
      ) : errorMessage ? (
        <p style={{ color: 'red' }}>
          {errorMessage}
        </p>
      ) : bookings.length === 0 ? (
        <p>No bookings to display.</p>
      ) : (
        <div>
          {bookings.map(booking => {
            const equipmentOnly =
              isEquipmentOnly(booking);

            const canCancel = [
              'Pending',
              'Approved'
            ].includes(booking.status);

            return (
              <div
                key={booking._id}
                className="my-booking-card"
              >
                <BookingTimestamps
                  booking={booking}
                />

                {/* BOOKING HEADING */}

                <h3>
                  {equipmentOnly
                    ? 'Equipment-Only Booking'
                    : booking.lab?.name ||
                      'Laboratory'}
                </h3>

                {equipmentOnly && (
                  <p
                    style={{
                      color: '#64748b',
                      fontSize: '13px',
                      marginTop: '-5px'
                    }}
                  >
                    Equipment reservation only.
                    No laboratory space reserved.
                  </p>
                )}

                {/* BOOKING DETAILS */}

                <p>
                  <strong>Date:</strong>{' '}
                  {formatBookingDate(
                    booking.bookingDate
                  )}
                </p>

                <p>
                  <strong>Time:</strong>{' '}
                  {booking.startTime} -{' '}
                  {booking.endTime}
                </p>

                <p>
                  <strong>Purpose:</strong>{' '}
                  {booking.purpose}
                </p>

                <p>
                  <strong>Status:</strong>{' '}
                  <span
                    style={{
                      color: getStatusColor(
                        booking.status
                      ),
                      fontWeight: 'bold'
                    }}
                  >
                    {booking.status}
                  </span>
                </p>

                {/* REQUESTED EQUIPMENT */}

                <RequestedEquipment
                  booking={booking}
                  equipmentOnly={equipmentOnly}
                  equipmentList={equipmentList}
                  labs={labs}
                />

                {/* APPROVED EQUIPMENT */}

                <ApprovedEquipmentDetails
                  booking={booking}
                  equipmentOnly={equipmentOnly}
                  equipmentList={equipmentList}
                  labs={labs}
                />

                {/* ADMIN COMMENT */}

                {booking.adminComment && (
                  <p
                    style={{
                      whiteSpace: 'pre-line'
                    }}
                  >
                    <strong>
                      Admin Comment:
                    </strong>{' '}
                    {booking.adminComment}
                  </p>
                )}

                {/* REJECTION REASON */}

                {booking.status === 'Rejected' &&
                  booking.rejectionReason && (
                    <p>
                      <strong>
                        Rejection Reason:
                      </strong>{' '}
                      {booking.rejectionReason}
                    </p>
                  )}

                {/* CANCELLATION REQUESTED */}

                {booking.status ===
                  'Cancellation Requested' && (
                    <p style={{ color: '#b36b00' }}>
                      <strong>
                        Cancellation Status:
                      </strong>{' '}
                      Awaiting administrator confirmation.
                    </p>
                  )}

                {/* CANCELLATION HISTORY */}

                {booking.status === 'Cancelled' && (
                  <div
                    style={{
                      backgroundColor: '#fff7f7',
                      border: '1px solid #f5d0d0',
                      borderRadius: '8px',
                      padding: '12px',
                      marginTop: '12px',
                      marginBottom: '12px'
                    }}
                  >
                    <p>
                      <strong>Cancelled By:</strong>{' '}
                      {booking.cancellationRequestedBy ||
                        'Not recorded'}
                    </p>

                    <p>
                      <strong>
                        Cancellation Reason:
                      </strong>{' '}
                      {booking.cancellationReason ||
                        'No reason provided'}
                    </p>

                    <p
                      style={{
                        color: '#64748b',
                        fontSize: '13px'
                      }}
                    >
                      This booking is cancelled.
                      Its equipment reservation
                      is no longer active.
                    </p>
                  </div>
                )}

                {/* CANCEL BUTTON */}

                {canCancel && (
                  <button
                    type="button"
                    className="primary-btn"
                    disabled={cancellingId !== null}
                    onClick={() =>
                      cancelBooking(booking._id)
                    }
                  >
                    {cancellingId === booking._id
                      ? 'Cancelling...'
                      : 'Cancel Booking'}
                  </button>
                )}

                <hr />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default MyBookings;
