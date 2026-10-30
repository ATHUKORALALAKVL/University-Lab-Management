
import { useEffect, useState } from 'react';

const API = 'http://localhost:5000/api/admin';

const panelStyle = {
  border: '1px solid #ddd',
  borderRadius: '8px',
  padding: '20px',
  marginBottom: '20px',
  backgroundColor: '#fff'
};

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px',
  border: '1px solid #ccc',
  borderRadius: '5px',
  marginBottom: '15px'
};

const buttonStyle = color => ({
  backgroundColor: color,
  color: 'white',
  padding: '10px 18px',
  border: 'none',
  borderRadius: '5px',
  cursor: 'pointer',
  margin: '4px'
});

const labelStyle = {
  display: 'block',
  fontWeight: 'bold',
  marginBottom: '6px'
};

const getId = value =>
  String(value?._id || value || '');

const sameId = (a, b) => getId(a) === getId(b);

const getBookingType = booking =>
  booking?.bookingType === 'equipment'
    ? 'equipment'
    : 'lab';

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
  if (!value) return 'Not specified';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return date.toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const statusColors = {
  Approved: '#217a43',
  Rejected: '#b73535',
  Cancelled: '#b73535',
  Pending: '#b36b00',
  'Cancellation Requested': '#b36b00'
};

// =====================================================
// BOOKING TIMESTAMPS
// =====================================================

function BookingTimestamps({ booking }) {
  const requestedAt = formatDateTime(booking.createdAt);
  const changedAt = formatDateTime(booking.statusChangedAt);

  const statusLabels = {
    Approved: 'Approved',
    Rejected: 'Rejected',
    Cancelled: 'Cancelled',
    'Cancellation Requested': 'Cancellation requested'
  };

  return (
    <div
      style={{
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: '1px solid #eee',
        fontSize: '12px',
        color: '#64748b',
        lineHeight: '1.6'
      }}
    >
      {requestedAt && (
        <div>Requested: {requestedAt}</div>
      )}

      {changedAt && statusLabels[booking.status] && (
        <div>
          {statusLabels[booking.status]}: {changedAt}
        </div>
      )}
    </div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

function AdminBookingRequests() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [processingId, setProcessingId] = useState(null);
  const [checkingId, setCheckingId] = useState(null);

  const [availability, setAvailability] = useState({});
  const [allocations, setAllocations] = useState({});
  const [equipmentUnits, setEquipmentUnits] = useState({});
  const [selectedUnitIds, setSelectedUnitIds] = useState({});

  const [comments, setComments] = useState({});
  const [rejectionReasons, setRejectionReasons] = useState({});
  const [cancellationReasons, setCancellationReasons] = useState({});

  const [assigningBookingId, setAssigningBookingId] = useState(null);

  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');

  // NEW: RETIRED EQUIPMENT REASSIGNMENT

  const [replacementOptions, setReplacementOptions] = useState({});
  const [selectedReplacements, setSelectedReplacements] = useState({});
  const [replacementLoading, setReplacementLoading] = useState(null);

  // =====================================================
  // API HELPERS
  // =====================================================

  const getHeaders = (json = false) => ({
    Authorization: `Bearer ${sessionStorage.getItem('token')}`,
    ...(json
      ? { 'Content-Type': 'application/json' }
      : {})
  });

  const request = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...getHeaders(Boolean(options.body)),
        ...(options.headers || {})
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return data;
  };

  // =====================================================
  // LOAD BOOKINGS
  // =====================================================

  const loadBookings = async () => {
    try {
      const data = await request(`${API}/bookings`);

      if (!Array.isArray(data)) {
        throw new Error('Invalid booking response');
      }

      setBookings(data);
      setErrorMessage('');
    } catch (error) {
      console.error('Load bookings error:', error);
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  // =====================================================
  // CLEAR EQUIPMENT SELECTION
  // =====================================================

  const clearSelection = bookingId => {
    const removeKey = setter => {
      setter(previous => {
        const next = { ...previous };
        delete next[bookingId];
        return next;
      });
    };

    removeKey(setAvailability);
    removeKey(setEquipmentUnits);
    removeKey(setAllocations);
    removeKey(setSelectedUnitIds);
  };

  // =====================================================
  // EQUIPMENT GROUP HELPERS
  // =====================================================

  const getGroup = (bookingId, equipmentId) =>
    (equipmentUnits[bookingId] || []).find(entry =>
      sameId(entry.equipmentId, equipmentId)
    );

  const getEligibleUnits = (bookingId, equipmentId) => {
    const group = getGroup(bookingId, equipmentId);

    return Array.isArray(group?.items)
      ? group.items
      : [];
  };

  const getLabName = (bookingId, item) => {
    const group = getGroup(
      bookingId,
      item.equipmentId
    );

    return (
      item.equipmentId?.lab?.name ||
      group?.lab?.name ||
      null
    );
  };

  // =====================================================
  // CHECK AVAILABILITY
  // =====================================================

  const checkAvailability = async (
    bookingId,
    existingApproved = false
  ) => {
    setCheckingId(bookingId);

    try {
      const booking = bookings.find(
        item => item._id === bookingId
      );

      if (!booking) {
        throw new Error('Booking not found');
      }

      const unitsData = await request(
        `${API}/bookings/${bookingId}/equipment-items`
      );

      if (!Array.isArray(unitsData)) {
        throw new Error(
          'Invalid equipment response. Expected an array of equipment groups.'
        );
      }

      let availabilityData;

      if (existingApproved) {
        const approved = booking.approvedEquipment?.length
          ? booking.approvedEquipment
          : booking.equipment || [];

        availabilityData = {
          bookingType: getBookingType(booking),
          labAvailable: true,
          equipment: approved.map(item => {
            const equipmentId = getId(
              item.equipmentId
            );

            const group = unitsData.find(entry =>
              sameId(entry.equipmentId, equipmentId)
            );

            return {
              equipmentId,
              name:
                item.equipmentId?.name ||
                group?.name ||
                'Equipment',
              lab: group?.lab || null,
              requested: Number(item.quantity) || 0,
              maximumAllocation:
                Number(item.quantity) || 0
            };
          })
        };
      } else {
        availabilityData = await request(
          `${API}/bookings/${bookingId}/availability`
        );
      }

      const initialAllocations = {};

      for (const item of availabilityData.equipment || []) {
        const equipmentId = getId(item.equipmentId);

        const group = unitsData.find(entry =>
          sameId(entry.equipmentId, equipmentId)
        );

        const eligibleCount = Array.isArray(group?.items)
          ? group.items.length
          : 0;

        initialAllocations[equipmentId] = existingApproved
          ? Number(item.requested) || 0
          : Math.min(
              Number(item.maximumAllocation) || 0,
              eligibleCount
            );
      }

      setAvailability(previous => ({
        ...previous,
        [bookingId]: availabilityData
      }));

      setEquipmentUnits(previous => ({
        ...previous,
        [bookingId]: unitsData
      }));

      setAllocations(previous => ({
        ...previous,
        [bookingId]: initialAllocations
      }));

      setSelectedUnitIds(previous => ({
        ...previous,
        [bookingId]: {}
      }));

      if (existingApproved) {
        setAssigningBookingId(bookingId);
      }
    } catch (error) {
      console.error('Check availability error:', error);
      clearSelection(bookingId);
      alert(error.message);
    } finally {
      setCheckingId(null);
    }
  };

  // =====================================================
  // CHANGE APPROVED QUANTITY
  // =====================================================

  const changeAllocation = (
    bookingId,
    equipmentId,
    quantity
  ) => {
    setAllocations(previous => ({
      ...previous,
      [bookingId]: {
        ...previous[bookingId],
        [equipmentId]: quantity
      }
    }));

    setSelectedUnitIds(previous => ({
      ...previous,
      [bookingId]: {
        ...previous[bookingId],
        [equipmentId]: (
          previous[bookingId]?.[equipmentId] || []
        ).slice(0, quantity)
      }
    }));
  };

  // =====================================================
  // SELECT INDIVIDUAL EQUIPMENT IDS
  // =====================================================

  const toggleUnit = (
    bookingId,
    equipmentId,
    unitId
  ) => {
    const current =
      selectedUnitIds[bookingId]?.[equipmentId] || [];

    const limit =
      allocations[bookingId]?.[equipmentId] ?? 0;

    if (
      !current.includes(unitId) &&
      current.length >= limit
    ) {
      alert(
        `You can select only ${limit} equipment IDs.`
      );
      return;
    }

    const updated = current.includes(unitId)
      ? current.filter(id => id !== unitId)
      : [...current, unitId];

    setSelectedUnitIds(previous => ({
      ...previous,
      [bookingId]: {
        ...previous[bookingId],
        [equipmentId]: updated
      }
    }));
  };

  // =====================================================
  // VALIDATE SELECTED UNITS
  // =====================================================

  const validateSelectedUnits = bookingId => {
    const result = availability[bookingId];

    if (!result) {
      alert('Please check availability first.');
      return false;
    }

    const allChosen = [];

    for (const item of result.equipment || []) {
      const equipmentId = getId(item.equipmentId);

      const quantity =
        allocations[bookingId]?.[equipmentId] ?? 0;

      const selected =
        selectedUnitIds[bookingId]?.[equipmentId] || [];

      if (selected.length !== quantity) {
        alert(
          `For ${item.name}, select exactly ${quantity} ` +
          `individual equipment ID(s). ` +
          `Currently selected: ${selected.length}.`
        );
        return false;
      }

      const eligibleIds = new Set(
        getEligibleUnits(bookingId, equipmentId)
          .map(unit => getId(unit))
      );

      if (
        selected.some(id => !eligibleIds.has(id))
      ) {
        alert(
          `Some selected IDs for ${item.name} are no longer eligible. ` +
          'Check availability again.'
        );
        return false;
      }

      allChosen.push(...selected);
    }

    if (
      new Set(allChosen).size !== allChosen.length
    ) {
      alert(
        'An individual equipment ID was selected twice.'
      );
      return false;
    }

    return true;
  };

  const getChosenIds = bookingId =>
    Object.values(
      selectedUnitIds[bookingId] || {}
    ).flat();

  // =====================================================
  // APPROVE / REJECT BOOKING
  // =====================================================

  const handleDecision = async (
    bookingId,
    action
  ) => {
    const booking = bookings.find(
      item => item._id === bookingId
    );

    if (!booking) {
      alert('Booking not found.');
      return;
    }

    const equipmentOnly =
      getBookingType(booking) === 'equipment';

    if (action === 'approve') {
      if (!availability[bookingId]) {
        alert(
          'Please check availability before approving.'
        );
        return;
      }

      if (
        !equipmentOnly &&
        !availability[bookingId].labAvailable
      ) {
        alert(
          'This laboratory is booked for that time.'
        );
        return;
      }

      if (!validateSelectedUnits(bookingId)) {
        return;
      }

      const totalAllocated = (
        availability[bookingId].equipment || []
      ).reduce(
        (sum, item) =>
          sum +
          (
            allocations[bookingId]?.[
              getId(item.equipmentId)
            ] ?? 0
          ),
        0
      );

      if (
        equipmentOnly &&
        totalAllocated === 0
      ) {
        alert(
          'Allocate at least one equipment unit before approving.'
        );
        return;
      }
    }

    if (
      action === 'reject' &&
      !rejectionReasons[bookingId]?.trim()
    ) {
      alert('Please enter a rejection reason.');
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to ${action} this booking?`
      )
    ) {
      return;
    }

    setProcessingId(bookingId);

    try {
      const approvedEquipment =
        action === 'approve'
          ? (
              availability[bookingId]?.equipment || []
            ).map(item => ({
              equipmentId: getId(item.equipmentId),
              quantity:
                allocations[bookingId]?.[
                  getId(item.equipmentId)
                ] ?? 0
            }))
          : [];

      const data = await request(
        `${API}/bookings/${bookingId}/${action}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            adminComment: comments[bookingId] || '',
            approvedEquipment,
            issuedEquipmentItems:
              action === 'approve'
                ? getChosenIds(bookingId)
                : [],
            rejectionReason:
              rejectionReasons[bookingId]?.trim() || ''
          })
        }
      );

      alert(
        data.message ||
        'Booking updated successfully.'
      );

      clearSelection(bookingId);
      await loadBookings();
    } catch (error) {
      console.error(
        'Booking decision error:',
        error
      );

      alert(error.message);
    } finally {
      setProcessingId(null);
    }
  };

  // =====================================================
  // ASSIGN IDS TO OLDER APPROVED BOOKINGS
  // =====================================================

  const handleAssignEquipmentIds = async bookingId => {
    if (!validateSelectedUnits(bookingId)) {
      return;
    }

    const chosenIds = getChosenIds(bookingId);

    if (
      !window.confirm(
        `Assign ${chosenIds.length} individual equipment ID(s) ` +
        'to this approved booking?'
      )
    ) {
      return;
    }

    setProcessingId(bookingId);

    try {
      const data = await request(
        `${API}/bookings/${bookingId}/assign-equipment-items`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            issuedEquipmentItems: chosenIds
          })
        }
      );

      alert(
        data.message ||
        'Individual equipment IDs assigned successfully.'
      );

      clearSelection(bookingId);
      setAssigningBookingId(null);

      await loadBookings();
    } catch (error) {
      console.error(
        'Assign equipment IDs error:',
        error
      );

      alert(error.message);
    } finally {
      setProcessingId(null);
    }
  };

  // =====================================================
  // ADMIN CANCELLATION
  // =====================================================

  const handleAdminCancellation = async bookingId => {
    const booking = bookings.find(
      item => item._id === bookingId
    );

    if (!booking) return;

    const reason =
      cancellationReasons[bookingId]?.trim();

    if (!reason) {
      alert(
        'Please enter a cancellation reason.'
      );
      return;
    }

    const confirmation =
      getBookingType(booking) === 'equipment'
        ? 'Cancel this equipment-only booking and release its equipment reservations?'
        : 'Cancel this laboratory booking and release its laboratory and equipment reservations?';

    if (!window.confirm(confirmation)) {
      return;
    }

    setProcessingId(bookingId);

    try {
      const data = await request(
        `${API}/bookings/${bookingId}/cancel`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            cancellationReason: reason
          })
        }
      );

      alert(
        data.message ||
        'Booking cancelled successfully.'
      );

      clearSelection(bookingId);
      setAssigningBookingId(null);

      await loadBookings();
    } catch (error) {
      console.error(
        'Cancellation error:',
        error
      );

      alert(error.message);
    } finally {
      setProcessingId(null);
    }
  };

  // =====================================================
  // NEW: RETIRED EQUIPMENT HELPERS
  // =====================================================

  const getAffectedUnits = booking => {
    if (booking.status !== 'Approved') {
      return [];
    }

    const affectedIds = new Set(
      (booking.affectedEquipmentItems || [])
        .map(getId)
    );

    return (
      booking.issuedEquipmentItems || []
    ).filter(unit =>
      unit &&
      (
        unit.isRetired === true ||
        affectedIds.has(getId(unit))
      )
    );
  };

  const clearReplacementSelection = key => {
    setReplacementOptions(previous => {
      const next = { ...previous };
      delete next[key];
      return next;
    });

    setSelectedReplacements(previous => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  // =====================================================
  // LOAD ELIGIBLE REPLACEMENTS
  // =====================================================

  const loadReplacementOptions = async (
    bookingId,
    unitId
  ) => {
    const key = `${bookingId}:${unitId}`;

    setReplacementLoading(key);

    try {
      const data = await request(
        `${API}/bookings/${bookingId}/replacement-options/${unitId}`
      );

      setReplacementOptions(previous => ({
        ...previous,
        [key]: data
      }));

      setSelectedReplacements(previous => ({
        ...previous,
        [key]: ''
      }));
    } catch (error) {
      console.error(
        'Load replacement options error:',
        error
      );

      alert(error.message);
    } finally {
      setReplacementLoading(null);
    }
  };

  // =====================================================
  // CONFIRM MANUAL REASSIGNMENT
  // =====================================================

  const handleReassignment = async (
    bookingId,
    retiredItemId
  ) => {
    const key =
      `${bookingId}:${retiredItemId}`;

    const replacementItemId =
      selectedReplacements[key];

    if (!replacementItemId) {
      alert(
        'Please select a replacement equipment ID.'
      );
      return;
    }

    if (
      !window.confirm(
        'Confirm equipment reassignment?'
      )
    ) {
      return;
    }

    setProcessingId(bookingId);

    try {
      const data = await request(
        `${API}/bookings/${bookingId}/reassign-equipment`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            retiredItemId,
            replacementItemId
          })
        }
      );

      clearReplacementSelection(key);

      // Discard any old replacement options for this
      // booking after a successful reassignment.
      setReplacementOptions(previous =>
        Object.fromEntries(
          Object.entries(previous).filter(
            ([entryKey]) =>
              !entryKey.startsWith(`${bookingId}:`)
          )
        )
      );

      setSelectedReplacements(previous =>
        Object.fromEntries(
          Object.entries(previous).filter(
            ([entryKey]) =>
              !entryKey.startsWith(`${bookingId}:`)
          )
        )
      );

      await loadBookings();

      alert(
        data.message ||
        'Equipment reassigned successfully.'
      );
    } catch (error) {
      console.error(
        'Reassign equipment error:',
        error
      );

      alert(error.message);
    } finally {
      setProcessingId(null);
    }
  };

  // =====================================================
  // RENDER RETIRED EQUIPMENT WARNING
  // =====================================================

  const renderRetiredEquipmentWarning = booking => {
    if (booking.status !== 'Approved') {
      return null;
    }

    const affectedUnits =
      getAffectedUnits(booking);

    if (
      !booking.equipmentNeedsAttention &&
      affectedUnits.length === 0
    ) {
      return null;
    }

    const bookingId = booking._id;

    return (
      <div
        style={{
          marginTop: '18px',
          marginBottom: '18px',
          padding: '16px',
          border: '1px solid #e9ba64',
          borderRadius: '8px',
          backgroundColor: '#fff8e8'
        }}
      >
        <h4
          style={{
            marginTop: 0,
            marginBottom: '10px',
            color: '#92400e'
          }}
        >
          ⚠ Needs Attention — Retired Equipment
        </h4>

        {affectedUnits.length === 0 ? (
          <p style={{ marginBottom: 0 }}>
            This booking requires equipment review.
            Refresh the booking list if its assigned
            equipment IDs have recently changed.
          </p>
        ) : (
          affectedUnits.map(unit => {
            const unitId = getId(unit);

            const key =
              `${bookingId}:${unitId}`;

            const options =
              replacementOptions[key];

            const replacements =
              options?.replacements || [];

            const isLoading =
              replacementLoading === key;

            const isProcessing =
              processingId === bookingId;

            return (
              <div
                key={unitId}
                style={{
                  padding: '12px',
                  marginTop: '12px',
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px'
                }}
              >
                <p style={{ marginTop: 0 }}>
                  <strong>
                    Retired Equipment ID:
                  </strong>{' '}
                  {unit.equipmentId || 'Unknown ID'}
                </p>

                {!options ? (
                  <button
                    type="button"
                    disabled={
                      processingId !== null ||
                      replacementLoading !== null
                    }
                    onClick={() =>
                      loadReplacementOptions(
                        bookingId,
                        unitId
                      )
                    }
                    style={buttonStyle('#172f52')}
                  >
                    {isLoading
                      ? 'Loading Replacements...'
                      : 'Reassign Equipment'}
                  </button>
                ) : (
                  <div>
                    <p>
                      <strong>
                        Equipment Type:
                      </strong>{' '}
                      {options.equipment?.name ||
                        'Unavailable'}
                    </p>

                    {replacements.length === 0 ? (
                      <p
                        style={{
                          color: '#b42318'
                        }}
                      >
                        No replacement equipment is
                        available for this booking period.
                      </p>
                    ) : (
                      <>
                        <label
                          htmlFor={`replacement-${key}`}
                          style={labelStyle}
                        >
                          Select Replacement Equipment ID
                        </label>

                        <select
                          id={`replacement-${key}`}
                          value={
                            selectedReplacements[key] || ''
                          }
                          disabled={isProcessing}
                          onChange={event =>
                            setSelectedReplacements(
                              previous => ({
                                ...previous,
                                [key]: event.target.value
                              })
                            )
                          }
                          style={inputStyle}
                        >
                          <option value="">
                            -- Select Equipment ID --
                          </option>

                          {replacements.map(
                            replacement => (
                              <option
                                key={replacement._id}
                                value={replacement._id}
                              >
                                {replacement.equipmentId}
                              </option>
                            )
                          )}
                        </select>

                        <button
                          type="button"
                          disabled={
                            processingId !== null ||
                            !selectedReplacements[key]
                          }
                          onClick={() =>
                            handleReassignment(
                              bookingId,
                              unitId
                            )
                          }
                          style={buttonStyle('#217a43')}
                        >
                          {isProcessing
                            ? 'Reassigning...'
                            : 'Confirm Reassignment'}
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      disabled={
                        processingId !== null ||
                        replacementLoading !== null
                      }
                      onClick={() =>
                        loadReplacementOptions(
                          bookingId,
                          unitId
                        )
                      }
                      style={buttonStyle('#172f52')}
                    >
                      Refresh Options
                    </button>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() =>
                        clearReplacementSelection(key)
                      }
                      style={buttonStyle('#777')}
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  };

  // =====================================================
  // EQUIPMENT SELECTOR
  // =====================================================

  const renderEquipmentSelector = (
    bookingId,
    existingApproved = false
  ) => {
    const result = availability[bookingId];

    if (!result) return null;

    const booking = bookings.find(
      item => item._id === bookingId
    );

    const equipmentOnly =
      getBookingType(booking) === 'equipment';

    return (
      <div
        style={{
          backgroundColor: '#f5f7fa',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '15px'
        }}
      >
        <h4>
          {existingApproved
            ? 'Assign Individual Equipment IDs'
            : 'Availability Results'}
        </h4>

        <p>
          <strong>Booking Period:</strong>{' '}
          {formatBookingDate(booking?.bookingDate)}
          {' | '}
          {booking?.startTime} - {booking?.endTime}
        </p>

        {!existingApproved && !equipmentOnly && (
          <p>
            <strong>Laboratory:</strong>{' '}
            <span
              style={{
                color: result.labAvailable
                  ? 'green'
                  : 'red'
              }}
            >
              {result.labAvailable
                ? 'Available'
                : 'Already Booked'}
            </span>
          </p>
        )}

        {equipmentOnly && (
          <p style={{ color: '#2563eb' }}>
            Equipment-only booking. No laboratory
            space is reserved.
          </p>
        )}

        <p
          style={{
            fontSize: '13px',
            color: '#475569'
          }}
        >
          The equipment IDs below must be checked
          against repair schedules and other approved
          bookings for this exact booking period.
        </p>

        {(result.equipment || []).length === 0 && (
          <p>No equipment requested.</p>
        )}

        {(result.equipment || []).map(item => {
          const equipmentId =
            getId(item.equipmentId);

          const eligibleUnits =
            getEligibleUnits(
              bookingId,
              equipmentId
            );

          const maximum = existingApproved
            ? Number(item.requested) || 0
            : Math.min(
                Number(item.maximumAllocation) || 0,
                eligibleUnits.length
              );

          const quantity =
            allocations[bookingId]?.[equipmentId] ?? 0;

          const selected =
            selectedUnitIds[bookingId]?.[equipmentId] || [];

          const labName =
            getLabName(bookingId, item);

          return (
            <div
              key={equipmentId}
              style={{
                borderBottom: '1px solid #ddd',
                padding: '12px 0'
              }}
            >
              <p>
                <strong>{item.name}</strong>
              </p>

              {labName && (
                <p
                  style={{
                    color: '#64748b',
                    fontSize: '13px'
                  }}
                >
                  Laboratory: {labName}
                </p>
              )}

              <p>
                {existingApproved
                  ? 'Approved'
                  : 'Requested'}:
                {' '}
                {item.requested}
                {' | '}
                Eligible physical units:{' '}
                {eligibleUnits.length}
              </p>

              {!existingApproved && (
                <div
                  style={{
                    marginBottom: '12px'
                  }}
                >
                  <label
                    htmlFor={
                      `allocation-${bookingId}-${equipmentId}`
                    }
                  >
                    Quantity to approve:{' '}
                  </label>

                  <select
                    id={
                      `allocation-${bookingId}-${equipmentId}`
                    }
                    value={Math.min(quantity, maximum)}
                    onChange={event =>
                      changeAllocation(
                        bookingId,
                        equipmentId,
                        Number(event.target.value)
                      )
                    }
                    style={{
                      padding: '8px',
                      borderRadius: '5px',
                      border: '1px solid #ccc'
                    }}
                  >
                    {Array.from(
                      { length: maximum + 1 },
                      (_, number) => (
                        <option
                          key={number}
                          value={number}
                        >
                          {number}
                        </option>
                      )
                    )}
                  </select>
                </div>
              )}

              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#fff',
                  border: '1px solid #ddd',
                  borderRadius: '6px'
                }}
              >
                <p>
                  <strong>
                    Select Individual Equipment IDs:
                  </strong>
                </p>

                {eligibleUnits.length === 0 ? (
                  <p style={{ color: '#b42318' }}>
                    No eligible equipment IDs for
                    this booking period.
                  </p>
                ) : (
                  eligibleUnits.map(unit => {
                    const unitId = getId(unit);

                    const checked =
                      selected.includes(unitId);

                    return (
                      <label
                        key={unitId}
                        style={{
                          display: 'block',
                          padding: '6px 0',
                          cursor: 'pointer'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={
                            quantity === 0 ||
                            (
                              !checked &&
                              selected.length >= quantity
                            )
                          }
                          onChange={() =>
                            toggleUnit(
                              bookingId,
                              equipmentId,
                              unitId
                            )
                          }
                          style={{
                            marginRight: '10px'
                          }}
                        />

                        {unit.equipmentId} — Eligible
                      </label>
                    );
                  })
                )}

                <p
                  style={{
                    fontWeight: 'bold',
                    color:
                      selected.length === quantity
                        ? 'green'
                        : '#b36b00'
                  }}
                >
                  Selected: {selected.length} / {quantity}
                </p>

                {existingApproved &&
                  eligibleUnits.length < quantity && (
                    <p style={{ color: '#b42318' }}>
                      Not enough eligible physical units.
                      Required: {quantity}. Eligible:{' '}
                      {eligibleUnits.length}.
                    </p>
                  )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // =====================================================
  // FILTER AND SORT
  // =====================================================

  const filteredBookings = [...bookings]
    .filter(booking =>
      statusFilter === 'All' ||
      booking.status === statusFilter
    )
    .filter(booking =>
      typeFilter === 'All' ||
      getBookingType(booking) === typeFilter
    )
    .sort((a, b) => {
      const dateA = new Date(
        a.createdAt || 0
      ).getTime();

      const dateB = new Date(
        b.createdAt || 0
      ).getTime();

      if (dateA !== dateB) {
        return dateB - dateA;
      }

      return String(b._id).localeCompare(
        String(a._id)
      );
    });

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <section className="laboratories-section">
      <h2>Booking Requests</h2>

      <p>
        Review laboratory and equipment-only bookings
        from newest to oldest.
      </p>

      {/* FILTERS */}

      <div
        style={{
          margin: '20px 0',
          padding: '15px',
          backgroundColor: '#f5f7fa',
          border: '1px solid #ddd',
          borderRadius: '8px'
        }}
      >
        <label
          htmlFor="booking-status-filter"
          style={labelStyle}
        >
          Filter Booking Requests
        </label>

        <select
          id="booking-status-filter"
          value={statusFilter}
          onChange={event =>
            setStatusFilter(event.target.value)
          }
          style={{
            ...inputStyle,
            maxWidth: '300px'
          }}
        >
          <option value="All">
            All Requests
          </option>
          <option value="Pending">
            Pending Requests
          </option>
          <option value="Approved">
            Approved Requests
          </option>
          <option value="Cancelled">
            Cancelled Requests
          </option>
          <option value="Rejected">
            Rejected Requests
          </option>
          <option value="Cancellation Requested">
            Cancellation Requested
          </option>
        </select>

        <label
          htmlFor="booking-type-filter"
          style={labelStyle}
        >
          Booking Type
        </label>

        <select
          id="booking-type-filter"
          value={typeFilter}
          onChange={event =>
            setTypeFilter(event.target.value)
          }
          style={{
            ...inputStyle,
            maxWidth: '300px'
          }}
        >
          <option value="All">
            All Booking Types
          </option>
          <option value="lab">
            Laboratory Bookings
          </option>
          <option value="equipment">
            Equipment-Only Bookings
          </option>
        </select>

        <p
          style={{
            marginBottom: 0,
            color: '#555'
          }}
        >
          Showing {filteredBookings.length} of{' '}
          {bookings.length} requests
        </p>
      </div>

      {/* BOOKING LIST */}

      {loading ? (
        <p>Loading booking requests...</p>
      ) : errorMessage ? (
        <p style={{ color: 'red' }}>
          {errorMessage}
        </p>
      ) : filteredBookings.length === 0 ? (
        <p>
          No booking requests match the selected filters.
        </p>
      ) : (
        <div>
          {filteredBookings.map(booking => {
            const bookingId = booking._id;

            const equipmentOnly =
              getBookingType(booking) === 'equipment';

            const hasAssignedIds =
              (
                booking.issuedEquipmentItems || []
              ).length > 0;

            const requestedGroups =
              booking.equipment || [];

            return (
              <div
                key={bookingId}
                style={panelStyle}
              >
                <BookingTimestamps
                  booking={booking}
                />

                {/* BOOKING TYPE */}

                <div
                  style={{
                    display: 'inline-block',
                    padding: '6px 12px',
                    backgroundColor: equipmentOnly
                      ? '#ede9fe'
                      : '#dbeafe',
                    color: equipmentOnly
                      ? '#6d28d9'
                      : '#1d4ed8',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    marginBottom: '10px'
                  }}
                >
                  {equipmentOnly
                    ? 'Equipment-Only Booking'
                    : 'Laboratory Booking'}
                </div>

                <h3>
                  {equipmentOnly
                    ? 'Equipment Request'
                    : booking.lab?.name ||
                      'Unknown Laboratory'}
                </h3>

                {equipmentOnly && (
                  <p style={{ color: '#64748b' }}>
                    Equipment may come from multiple
                    laboratories. No laboratory space
                    is reserved.
                  </p>
                )}

                {/* REQUESTER DETAILS */}

                <p>
                  <strong>Name:</strong>{' '}
                  {booking.studentName}
                </p>

                <p>
                  <strong>Email:</strong>{' '}
                  {booking.studentEmail}
                </p>

                {booking.requesterRole === 'student' && (
                  <p>
                    <strong>
                      University Registration No:
                    </strong>{' '}
                    {booking.registrationNo ||
                      'Not provided'}
                  </p>
                )}

                <p>
                  <strong>User Type:</strong>{' '}
                  <span
                    style={{
                      color:
                        booking.requesterRole === 'staff'
                          ? '#7c3aed'
                          : booking.requesterRole === 'student'
                            ? '#2563eb'
                            : '#666',
                      fontWeight: 'bold'
                    }}
                  >
                    {booking.requesterType ||
                      'Unknown'}
                  </span>
                </p>

                <p>
                  <strong>Date:</strong>{' '}
                  {formatBookingDate(
                    booking.bookingDate
                  )}
                </p>

                <p>
                  <strong>Time:</strong>{' '}
                  {booking.startTime} - {booking.endTime}
                </p>

                <p>
                  <strong>Purpose:</strong>{' '}
                  {booking.purpose}
                </p>

                {/* REQUESTED EQUIPMENT */}

                <p>
                  <strong>
                    Requested Equipment:
                  </strong>
                </p>

                {requestedGroups.length ? (
                  <ul>
                    {requestedGroups.map(
                      (item, index) => {
                        const labName =
                          getLabName(
                            bookingId,
                            item
                          );

                        return (
                          <li
                            key={item._id || index}
                            style={{
                              marginBottom: '8px'
                            }}
                          >
                            <strong>
                              {item.equipmentId?.name ||
                                'Unknown Equipment'}
                            </strong>

                            {' - Requested: '}
                            {item.quantity}

                            {labName && (
                              <div
                                style={{
                                  fontSize: '12px',
                                  color: '#64748b'
                                }}
                              >
                                Laboratory: {labName}
                              </div>
                            )}
                          </li>
                        );
                      }
                    )}
                  </ul>
                ) : (
                  <p>No equipment requested.</p>
                )}

                {/* BOOKING STATUS */}

                <p>
                  <strong>Status:</strong>{' '}
                  <span
                    style={{
                      fontWeight: 'bold',
                      color:
                        statusColors[booking.status] ||
                        '#666'
                    }}
                  >
                    {booking.status}
                  </span>
                </p>

                {/* NEW: RETIRED EQUIPMENT WARNING */}

                {renderRetiredEquipmentWarning(booking)}

                {/* APPROVED BOOKING DETAILS */}

                {booking.status === 'Approved' && (
                  <div>
                    <p>
                      <strong>
                        Approved Equipment:
                      </strong>
                    </p>

                    {booking.approvedEquipment?.length ? (
                      <ul>
                        {booking.approvedEquipment.map(
                          (item, index) => (
                            <li
                              key={item._id || index}
                            >
                              {item.equipmentId?.name ||
                                'Unknown Equipment'}

                              {' - Allocated: '}
                              {item.quantity}
                            </li>
                          )
                        )}
                      </ul>
                    ) : (
                      <p>
                        No separate allocation recorded.
                        Older bookings may use requested
                        quantities.
                      </p>
                    )}

                    {/* INDIVIDUAL EQUIPMENT IDS */}

                    <p>
                      <strong>
                        Individual Equipment IDs:
                      </strong>
                    </p>

                    {hasAssignedIds ? (
                      <ul>
                        {booking.issuedEquipmentItems.map(
                          (unit, index) => {
                            const isRetired =
                              unit?.isRetired === true ||
                              (
                                booking.affectedEquipmentItems ||
                                []
                              ).some(
                                affected =>
                                  sameId(
                                    affected,
                                    unit
                                  )
                              );

                            return (
                              <li
                                key={
                                  unit?._id ||
                                  index
                                }
                                style={{
                                  color: isRetired
                                    ? '#b42318'
                                    : 'inherit',
                                  fontWeight: isRetired
                                    ? 'bold'
                                    : 'normal',
                                  marginBottom: '6px'
                                }}
                              >
                                {unit?.equipmentId ||
                                  'Unknown ID'}

                                {isRetired && (
                                  <span>
                                    {' '}— Retired
                                  </span>
                                )}
                              </li>
                            );
                          }
                        )}
                      </ul>
                    ) : (
                      <p
                        style={{
                          color: '#b36b00'
                        }}
                      >
                        No individual equipment IDs
                        recorded.
                      </p>
                    )}

                    {/* OLDER APPROVED BOOKINGS */}

                    {!hasAssignedIds && (
                      <div
                        style={{
                          marginTop: '18px',
                          padding: '15px',
                          border: '1px solid #d7e4f5',
                          borderRadius: '8px',
                          backgroundColor: '#f5f9ff'
                        }}
                      >
                        <h4>
                          Assign Equipment IDs
                        </h4>

                        <p>
                          This booking is approved,
                          but its individual equipment
                          IDs were not recorded.
                        </p>

                        {assigningBookingId !== bookingId ? (
                          <button
                            type="button"
                            disabled={
                              checkingId !== null ||
                              processingId !== null
                            }
                            onClick={() =>
                              checkAvailability(
                                bookingId,
                                true
                              )
                            }
                            style={buttonStyle('#172f52')}
                          >
                            {checkingId === bookingId
                              ? 'Loading Equipment IDs...'
                              : 'Assign Equipment IDs'}
                          </button>
                        ) : (
                          <div>
                            {renderEquipmentSelector(
                              bookingId,
                              true
                            )}

                            <button
                              type="button"
                              disabled={
                                processingId !== null
                              }
                              onClick={() =>
                                handleAssignEquipmentIds(
                                  bookingId
                                )
                              }
                              style={buttonStyle('#217a43')}
                            >
                              {processingId === bookingId
                                ? 'Saving...'
                                : 'Save Assigned Equipment IDs'}
                            </button>

                            <button
                              type="button"
                              disabled={
                                processingId !== null
                              }
                              onClick={() => {
                                clearSelection(bookingId);
                                setAssigningBookingId(null);
                              }}
                              style={buttonStyle('#777')}
                            >
                              Close
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

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

                {/* REJECTION HISTORY */}

                {booking.status === 'Rejected' &&
                  booking.rejectionReason && (
                    <div style={panelStyle}>
                      <strong>
                        Rejection Reason:
                      </strong>{' '}
                      {booking.rejectionReason}
                    </div>
                  )}

                {/* CANCELLATION HISTORY */}

                {booking.status === 'Cancelled' && (
                  <div style={panelStyle}>
                    <p>
                      <strong>
                        Cancelled By:
                      </strong>{' '}
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
                  </div>
                )}

                {/* PENDING BOOKING ACTIONS */}

                {booking.status === 'Pending' && (
                  <div>
                    <button
                      type="button"
                      disabled={
                        checkingId !== null ||
                        processingId !== null
                      }
                      onClick={() =>
                        checkAvailability(
                          bookingId,
                          false
                        )
                      }
                      style={{
                        ...buttonStyle('#172f52'),
                        marginBottom: '15px'
                      }}
                    >
                      {checkingId === bookingId
                        ? 'Checking...'
                        : 'Check Availability'}
                    </button>

                    {renderEquipmentSelector(
                      bookingId,
                      false
                    )}

                    <label
                      htmlFor={`comment-${bookingId}`}
                      style={labelStyle}
                    >
                      Admin Comment (optional)
                    </label>

                    <textarea
                      id={`comment-${bookingId}`}
                      rows={3}
                      placeholder="Enter an optional admin comment"
                      value={
                        comments[bookingId] || ''
                      }
                      onChange={event =>
                        setComments(previous => ({
                          ...previous,
                          [bookingId]:
                            event.target.value
                        }))
                      }
                      style={inputStyle}
                    />

                    <label
                      htmlFor={`rejection-${bookingId}`}
                      style={labelStyle}
                    >
                      Rejection Reason
                      (required when rejecting)
                    </label>

                    <textarea
                      id={`rejection-${bookingId}`}
                      rows={3}
                      placeholder="Enter the reason for rejecting"
                      value={
                        rejectionReasons[bookingId] ||
                        ''
                      }
                      onChange={event =>
                        setRejectionReasons(
                          previous => ({
                            ...previous,
                            [bookingId]:
                              event.target.value
                          })
                        )
                      }
                      style={inputStyle}
                    />

                    <div
                      style={{
                        display: 'flex',
                        gap: '12px',
                        flexWrap: 'wrap'
                      }}
                    >
                      <button
                        type="button"
                        disabled={
                          processingId !== null ||
                          checkingId !== null
                        }
                        onClick={() =>
                          handleDecision(
                            bookingId,
                            'approve'
                          )
                        }
                        style={buttonStyle('#217a43')}
                      >
                        {processingId === bookingId
                          ? 'Processing...'
                          : 'Approve'}
                      </button>

                      <button
                        type="button"
                        disabled={
                          processingId !== null ||
                          checkingId !== null
                        }
                        onClick={() =>
                          handleDecision(
                            bookingId,
                            'reject'
                          )
                        }
                        style={buttonStyle('#b73535')}
                      >
                        {processingId === bookingId
                          ? 'Processing...'
                          : 'Reject'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ADMIN CANCELLATION */}

                {booking.status === 'Approved' && (
                  <div
                    style={{
                      ...panelStyle,
                      marginTop: '18px',
                      borderColor: '#f0cccc'
                    }}
                  >
                    <h4>
                      Cancel Approved Booking
                    </h4>

                    <p>
                      Cancelling releases the booking's
                      laboratory reservation, if any,
                      and its equipment allocations.
                    </p>

                    <label
                      htmlFor={
                        `cancel-reason-${bookingId}`
                      }
                      style={labelStyle}
                    >
                      Cancellation Reason (required)
                    </label>

                    <textarea
                      id={
                        `cancel-reason-${bookingId}`
                      }
                      rows={3}
                      placeholder="Enter cancellation reason"
                      value={
                        cancellationReasons[bookingId] ||
                        ''
                      }
                      onChange={event =>
                        setCancellationReasons(
                          previous => ({
                            ...previous,
                            [bookingId]:
                              event.target.value
                          })
                        )
                      }
                      style={inputStyle}
                    />

                    <button
                      type="button"
                      disabled={
                        processingId !== null ||
                        checkingId !== null
                      }
                      onClick={() =>
                        handleAdminCancellation(
                          bookingId
                        )
                      }
                      style={buttonStyle('#b73535')}
                    >
                      {processingId === bookingId
                        ? 'Cancelling...'
                        : 'Cancel Booking'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default AdminBookingRequests;
