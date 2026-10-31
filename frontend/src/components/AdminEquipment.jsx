
import { useEffect, useState } from 'react';

const API = 'https://university-lab-backend.vercel.app/api';

const styles = {
  card: {
    border: '1px solid #ddd',
    borderRadius: '10px',
    padding: '20px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    textAlign: 'left',
    boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
  },
  input: {
    display: 'block',
    width: '100%',
    padding: '10px',
    boxSizing: 'border-box',
    marginTop: '6px'
  },
  field: { marginBottom: '15px' },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '15px'
  },
  th: {
    borderBottom: '2px solid #ddd',
    padding: '12px 8px',
    textAlign: 'left',
    whiteSpace: 'nowrap'
  },
  td: {
    borderBottom: '1px solid #eee',
    padding: '12px 8px',
    verticalAlign: 'middle'
  },
  button: {
    padding: '7px 11px',
    borderRadius: '5px',
    border: '1px solid #ccc',
    cursor: 'pointer',
    margin: '3px'
  }
};

const getId = value =>
  String(value?._id || value || '');

const localDate = date => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const todayKey = () => localDate(new Date());

const emptyRepairForm = {
  startDate: '',
  endDate: '',
  notes: ''
};

const isActiveRepair = repair =>
  !repair.completedAt &&
  repair.startDate <= todayKey() &&
  repair.endDate >= todayKey();

const getDisplayStatus = item => {
  if (item.isRetired) return 'Retired';
  if (item.displayStatus) return item.displayStatus;
  if (item.status === 'Unavailable') return 'Unavailable';
  if (item.status === 'Under Repair') return 'Under Repair';

  return (item.repairPeriods || []).some(isActiveRepair)
    ? 'Under Repair'
    : 'Usable';
};

const formatDate = value => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '-'
    : date.toLocaleDateString('en-GB');
};

function AdminEquipment() {
  const [equipment, setEquipment] = useState([]);
  const [labs, setLabs] = useState([]);
  const [selectedLab, setSelectedLab] = useState('');

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [lab, setLab] = useState('');
  const [totalQuantity, setTotalQuantity] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingEquipmentId, setEditingEquipmentId] = useState(null);

  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [individualItems, setIndividualItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [savingEquipment, setSavingEquipment] = useState(false);

  const [repairItem, setRepairItem] = useState(null);
  const [repairForm, setRepairForm] = useState(emptyRepairForm);
  const [savingRepair, setSavingRepair] = useState(false);

  const [retiringItem, setRetiringItem] = useState(null);
  const [retirementReason, setRetirementReason] = useState('');
  const [savingRetirement, setSavingRetirement] = useState(false);

  const authHeaders = () => ({
    Authorization: `Bearer ${sessionStorage.getItem('token')}`
  });

  const jsonHeaders = () => ({
    'Content-Type': 'application/json',
    ...authHeaders()
  });

  const readResponse = async response => {
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return data;
  };

  // =====================================================
  // LOAD DATA
  // =====================================================

  const loadEquipment = async () => {
    try {
      const response = await fetch(`${API}/equipment`);
      const data = await readResponse(response);
      setEquipment(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Load equipment error:', error);
      alert(error.message);
    }
  };

  const loadLabs = async () => {
    try {
      const response = await fetch(`${API}/labs`);
      const data = await readResponse(response);
      setLabs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Load laboratories error:', error);
      alert(error.message);
    }
  };

  useEffect(() => {
    loadEquipment();
    loadLabs();
  }, []);

  // =====================================================
  // LABORATORY SELECTION
  // =====================================================

  const handleSelectLab = labId => {
    setSelectedLab(labId);
    setLab(labId);

    setName('');
    setCode('');
    setDescription('');
    setTotalQuantity('');
    setShowForm(false);
    setEditingEquipmentId(null);

    setSelectedEquipment(null);
    setIndividualItems([]);
    setRepairItem(null);
    setRetiringItem(null);
    setRetirementReason('');
  };

  // =====================================================
  // ADD / EDIT EQUIPMENT
  // =====================================================

  const resetForm = () => {
    setName('');
    setCode('');
    setDescription('');
    setLab(selectedLab);
    setTotalQuantity('');
    setShowForm(false);
    setEditingEquipmentId(null);
  };

  const handleAddNew = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = item => {
    setEditingEquipmentId(item._id);
    setName(item.name || '');
    setCode(item.code || '');
    setDescription(item.description || '');
    setLab(getId(item.lab));
    setTotalQuantity(String(item.totalQuantity ?? ''));
    setShowForm(true);
  };

  const handleSubmit = async event => {
    event.preventDefault();

    const cleanCode = code.trim().toUpperCase();
    const quantity = Number(totalQuantity);

    if (!name.trim()) {
      alert('Please enter the equipment name.');
      return;
    }

    if (!/^[A-Z]{2,6}$/.test(cleanCode)) {
      alert('Equipment code must contain 2 to 6 letters.');
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      alert('Quantity must be greater than zero.');
      return;
    }

    if (!lab) {
      alert('Please select a laboratory.');
      return;
    }

    setSavingEquipment(true);

    try {
      const isEditing = Boolean(editingEquipmentId);

      const url = isEditing
        ? `${API}/equipment/${editingEquipmentId}`
        : `${API}/equipment`;

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          name: name.trim(),
          code: cleanCode,
          description: description.trim(),
          lab,
          totalQuantity: quantity
        })
      });

      const data = await readResponse(response);

      alert(
        data.message ||
        (isEditing
          ? 'Equipment updated successfully.'
          : 'Equipment added successfully.')
      );

      resetForm();
      await loadEquipment();

      if (
        isEditing &&
        selectedEquipment?._id === editingEquipmentId
      ) {
        setSelectedEquipment(previous => ({
          ...previous,
          name: name.trim(),
          code: cleanCode,
          description: description.trim(),
          totalQuantity: quantity
        }));
      }
    } catch (error) {
      console.error('Save equipment error:', error);
      alert(error.message);
    } finally {
      setSavingEquipment(false);
    }
  };

  // =====================================================
  // DELETE EQUIPMENT TYPE
  // =====================================================

  const handleDelete = async item => {
    if (
      !window.confirm(
        `Delete ${item.name} and its unused physical equipment IDs? ` +
        'This action cannot be undone.'
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `${API}/equipment/${item._id}`,
        {
          method: 'DELETE',
          headers: authHeaders()
        }
      );

      const data = await readResponse(response);

      alert(data.message || 'Equipment deleted successfully.');

      if (selectedEquipment?._id === item._id) {
        setSelectedEquipment(null);
        setIndividualItems([]);
        setRepairItem(null);
        setRetiringItem(null);
      }

      if (editingEquipmentId === item._id) {
        resetForm();
      }

      await loadEquipment();
    } catch (error) {
      console.error('Delete equipment error:', error);
      alert(error.message);
    }
  };

  // =====================================================
  // LOAD INDIVIDUAL EQUIPMENT IDS
  // =====================================================

  const loadIndividualItems = async equipmentId => {
    setLoadingItems(true);

    try {
      const response = await fetch(
        `${API}/equipment/${equipmentId}/items`,
        {
          headers: authHeaders()
        }
      );

      const data = await readResponse(response);

      setIndividualItems(
        Array.isArray(data.items) ? data.items : []
      );
    } catch (error) {
      console.error('Load equipment IDs error:', error);
      alert(error.message);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleViewItems = async item => {
    setSelectedEquipment(item);
    setIndividualItems([]);
    setRepairItem(null);
    setRetiringItem(null);
    await loadIndividualItems(item._id);
  };

  const refreshInventory = async equipmentId => {
    await Promise.all([
      loadIndividualItems(equipmentId),
      loadEquipment()
    ]);
  };

  // =====================================================
  // PERMANENT EQUIPMENT RETIREMENT
  // =====================================================

  const openRetirementForm = item => {
    if (item.isRetired) return;

    setRepairItem(null);
    setRetiringItem(item);
    setRetirementReason('');
  };

  const closeRetirementForm = () => {
    if (savingRetirement) return;

    setRetiringItem(null);
    setRetirementReason('');
  };

  const handleRetireEquipment = async event => {
    event.preventDefault();

    if (!selectedEquipment || !retiringItem) return;

    const reason = retirementReason.trim();

    if (!reason) {
      alert('Please provide a retirement reason.');
      return;
    }

    if (
      !window.confirm(
        `Permanently retire ${retiringItem.equipmentId}? ` +
        'This equipment ID cannot be returned to service.'
      )
    ) {
      return;
    }

    setSavingRetirement(true);

    try {
      const response = await fetch(
        `${API}/equipment/${selectedEquipment._id}` +
        `/items/${retiringItem._id}/retire`,
        {
          method: 'PATCH',
          headers: jsonHeaders(),
          body: JSON.stringify({
            reason
          })
        }
      );

      const data = await readResponse(response);

      alert(
        data.message || 'Equipment retired successfully.'
      );

      setRetiringItem(null);
      setRetirementReason('');

      await refreshInventory(selectedEquipment._id);
    } catch (error) {
      console.error('Retire equipment error:', error);
      alert(error.message);
    } finally {
      setSavingRetirement(false);
    }
  };

  // =====================================================
  // SCHEDULE REPAIR
  // =====================================================

  const openRepairForm = item => {
    if (item.isRetired || item.status === 'Unavailable') {
      alert('This equipment cannot be scheduled for repair.');
      return;
    }

    setRetiringItem(null);
    setRepairItem(item);
    setRepairForm({
      startDate: todayKey(),
      endDate: todayKey(),
      notes: ''
    });
  };

  const closeRepairForm = () => {
    if (savingRepair) return;

    setRepairItem(null);
    setRepairForm(emptyRepairForm);
  };

  const handleScheduleRepair = async event => {
    event.preventDefault();

    if (!selectedEquipment || !repairItem) return;

    const { startDate, endDate, notes } = repairForm;

    if (!startDate || !endDate) {
      alert('Please enter both repair dates.');
      return;
    }

    if (endDate < startDate) {
      alert('Repair end date cannot be before start date.');
      return;
    }

    if (
      !window.confirm(
        `Schedule ${repairItem.equipmentId} for repair ` +
        `from ${startDate} to ${endDate}?`
      )
    ) {
      return;
    }

    setSavingRepair(true);

    try {
      const response = await fetch(
        `${API}/equipment/${selectedEquipment._id}` +
        `/items/${repairItem._id}/repairs`,
        {
          method: 'POST',
          headers: jsonHeaders(),
          body: JSON.stringify({
            startDate,
            endDate,
            notes: notes.trim()
          })
        }
      );

      const data = await readResponse(response);

      alert(data.message || 'Repair scheduled successfully.');

      setRepairItem(null);
      setRepairForm(emptyRepairForm);

      await refreshInventory(selectedEquipment._id);
    } catch (error) {
      console.error('Schedule repair error:', error);
      alert(error.message);
    } finally {
      setSavingRepair(false);
    }
  };

  // =====================================================
  // COMPLETE REPAIR
  // =====================================================

  const handleCompleteRepair = async (item, repair) => {
    if (
      !selectedEquipment ||
      repair.completedAt ||
      item.isRetired
    ) {
      return;
    }

    if (
      !window.confirm(
        `Mark the repair of ${item.equipmentId} as completed? ` +
        'This will end its repair restriction immediately.'
      )
    ) {
      return;
    }

    setUpdatingItemId(item._id);

    try {
      const response = await fetch(
        `${API}/equipment/${selectedEquipment._id}` +
        `/items/${item._id}/repairs/${repair._id}/complete`,
        {
          method: 'PATCH',
          headers: jsonHeaders()
        }
      );

      const data = await readResponse(response);

      alert(data.message || 'Repair marked completed.');

      await refreshInventory(selectedEquipment._id);
    } catch (error) {
      console.error('Complete repair error:', error);
      alert(error.message);
    } finally {
      setUpdatingItemId(null);
    }
  };

  // =====================================================
  // CLEAR LEGACY REPAIR STATUS
  // =====================================================

  const handleClearLegacyRepair = async item => {
    if (!selectedEquipment || item.isRetired) return;

    if (
      !window.confirm(
        `Clear the old undated repair status of ${item.equipmentId}?`
      )
    ) {
      return;
    }

    setUpdatingItemId(item._id);

    try {
      const response = await fetch(
        `${API}/equipment/${selectedEquipment._id}` +
        `/items/${item._id}/status`,
        {
          method: 'PATCH',
          headers: jsonHeaders(),
          body: JSON.stringify({
            status: 'Available'
          })
        }
      );

      const data = await readResponse(response);

      alert(data.message || 'Old repair status cleared.');

      await refreshInventory(selectedEquipment._id);
    } catch (error) {
      console.error('Clear old repair error:', error);
      alert(error.message);
    } finally {
      setUpdatingItemId(null);
    }
  };

  // =====================================================
  // FILTER EQUIPMENT
  // =====================================================

  const filteredEquipment = equipment.filter(
    item => getId(item.lab) === getId(selectedLab)
  );

  const selectedLabName =
    labs.find(
      item => getId(item) === getId(selectedLab)
    )?.name || '';

  const countForLab = labId =>
    equipment.filter(
      item => getId(item.lab) === getId(labId)
    ).length;

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <div
      style={{
        padding: '30px',
        maxWidth: '1250px',
        margin: 'auto'
      }}
    >
      <h2>Equipment Management</h2>

      <p>
        Select a laboratory to manage equipment inventory,
        individual equipment IDs, repairs and retirement.
      </p>

      <h3>Laboratories</h3>

      {labs.length === 0 ? (
        <p>No laboratories found.</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
            marginBottom: '30px'
          }}
        >
          {labs.map(item => {
            const active =
              getId(selectedLab) === getId(item);

            return (
              <button
                key={item._id}
                type="button"
                onClick={() => handleSelectLab(item._id)}
                style={{
                  ...styles.card,
                  border: active
                    ? '2px solid #2563eb'
                    : '1px solid #ddd',
                  backgroundColor: active
                    ? '#eff6ff'
                    : '#fff'
                }}
              >
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    marginBottom: '8px'
                  }}
                >
                  {item.name}
                </div>

                <div style={{ color: '#555' }}>
                  {countForLab(item._id)} equipment types
                </div>

                {active && (
                  <div
                    style={{
                      marginTop: '10px',
                      color: '#2563eb',
                      fontWeight: 'bold'
                    }}
                  >
                    Selected
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {selectedLab && (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <h3>
              {selectedLabName} — Equipment Inventory
            </h3>

            <button
              type="button"
              className="primary-btn"
              onClick={handleAddNew}
            >
              + Add Equipment
            </button>
          </div>

          {/* ADD / EDIT EQUIPMENT FORM */}

          {showForm && (
            <div
              style={{
                border: '1px solid #ddd',
                borderRadius: '10px',
                padding: '20px',
                marginBottom: '25px',
                backgroundColor: '#fafafa'
              }}
            >
              <h3>
                {editingEquipmentId
                  ? 'Edit Equipment'
                  : 'Add Equipment'}
              </h3>

              <form onSubmit={handleSubmit}>
                <div style={styles.field}>
                  <label htmlFor="equipment-name">
                    Equipment Name
                  </label>

                  <input
                    id="equipment-name"
                    type="text"
                    value={name}
                    onChange={event =>
                      setName(event.target.value)
                    }
                    placeholder="Example: Digital Oscilloscope"
                    required
                    style={styles.input}
                  />
                </div>

                <div style={styles.field}>
                  <label htmlFor="equipment-code">
                    Equipment Code
                  </label>

                  <input
                    id="equipment-code"
                    type="text"
                    value={code}
                    onChange={event =>
                      setCode(event.target.value.toUpperCase())
                    }
                    placeholder="Example: OSC"
                    maxLength={6}
                    pattern="[A-Za-z]{2,6}"
                    title="Enter 2 to 6 letters"
                    required
                    style={styles.input}
                  />

                  <small>
                    Enter 2 to 6 letters.
                    Example: OSC, DMM, PSU.
                    {editingEquipmentId &&
                      ' Existing codes may be locked by the backend.'}
                  </small>
                </div>

                <div style={styles.field}>
                  <label htmlFor="equipment-description">
                    Description
                  </label>

                  <input
                    id="equipment-description"
                    type="text"
                    value={description}
                    onChange={event =>
                      setDescription(event.target.value)
                    }
                    placeholder="Optional description"
                    style={styles.input}
                  />
                </div>

                <div style={styles.field}>
                  <label htmlFor="equipment-lab">
                    Laboratory
                  </label>

                  <select
                    id="equipment-lab"
                    value={lab}
                    onChange={event =>
                      setLab(event.target.value)
                    }
                    required
                    style={styles.input}
                  >
                    <option value="">
                      -- Select Laboratory --
                    </option>

                    {labs.map(item => (
                      <option
                        key={item._id}
                        value={item._id}
                      >
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.field}>
                  <label htmlFor="equipment-quantity">
                    Total Quantity
                  </label>

                  <input
                    id="equipment-quantity"
                    type="number"
                    min="1"
                    step="1"
                    value={totalQuantity}
                    onChange={event =>
                      setTotalQuantity(event.target.value)
                    }
                    required
                    style={styles.input}
                  />

                  <small>
                    {editingEquipmentId
                      ? 'Reducing quantity may be restricted when physical equipment IDs already exist.'
                      : 'If the code already exists in this laboratory, this quantity will be added to its inventory.'}
                  </small>
                </div>

                <button
                  type="submit"
                  className="primary-btn"
                  disabled={savingEquipment}
                >
                  {savingEquipment
                    ? 'Saving...'
                    : editingEquipmentId
                      ? 'Save Changes'
                      : 'Add Equipment'}
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  disabled={savingEquipment}
                  style={{
                    ...styles.button,
                    marginLeft: '10px'
                  }}
                >
                  Cancel
                </button>
              </form>
            </div>
          )}

          {/* INVENTORY TABLE */}

          {filteredEquipment.length === 0 ? (
            <p>
              No equipment added to this laboratory yet.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {[
                      'Equipment',
                      'Code',
                      'Total',
                      'Usable',
                      'Under Repair',
                      'Actions'
                    ].map(heading => (
                      <th
                        key={heading}
                        style={styles.th}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filteredEquipment.map(item => (
                    <tr key={item._id}>
                      <td style={styles.td}>
                        <strong>{item.name}</strong>

                        {item.description && (
                          <div
                            style={{
                              fontSize: '12px',
                              color: '#666',
                              marginTop: '4px'
                            }}
                          >
                            {item.description}
                          </div>
                        )}
                      </td>

                      <td style={styles.td}>
                        {item.code || '-'}
                      </td>

                      <td style={styles.td}>
                        {item.totalQuantity}
                      </td>

                      <td style={styles.td}>
                        {item.usableQuantity ?? 0}
                      </td>

                      <td style={styles.td}>
                        {item.underRepairQuantity ?? 0}
                      </td>

                      <td
                        style={{
                          ...styles.td,
                          minWidth: '240px'
                        }}
                      >
                        <button
                          type="button"
                          style={styles.button}
                          onClick={() =>
                            handleViewItems(item)
                          }
                        >
                          View IDs / Repairs
                        </button>

                        <button
                          type="button"
                          style={{
                            ...styles.button,
                            backgroundColor: '#2563eb',
                            color: '#fff',
                            border: 'none'
                          }}
                          onClick={() => handleEdit(item)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleDelete(item)
                          }
                          style={{
                            ...styles.button,
                            backgroundColor: '#c0392b',
                            color: '#fff',
                            border: 'none'
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* INDIVIDUAL EQUIPMENT IDS */}

          {selectedEquipment && (
            <div
              style={{
                marginTop: '30px',
                padding: '20px',
                border: '1px solid #ddd',
                borderRadius: '10px',
                backgroundColor: '#fafafa'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}
              >
                <div>
                  <h3 style={{ marginBottom: '5px' }}>
                    Individual Equipment IDs
                  </h3>

                  <p>
                    {selectedEquipment.name} (
                    {selectedEquipment.code})
                  </p>
                </div>

                <div>
                  <button
                    type="button"
                    style={styles.button}
                    disabled={loadingItems}
                    onClick={() =>
                      loadIndividualItems(
                        selectedEquipment._id
                      )
                    }
                  >
                    {loadingItems
                      ? 'Refreshing...'
                      : 'Refresh'}
                  </button>

                  <button
                    type="button"
                    style={styles.button}
                    onClick={() => {
                      setSelectedEquipment(null);
                      setIndividualItems([]);
                      setRepairItem(null);
                      setRetiringItem(null);
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>

              <p
                style={{
                  color: '#64748b',
                  fontSize: '13px'
                }}
              >
                Repair schedules are checked against
                approved booking dates. Retired equipment
                cannot be assigned to future bookings.
              </p>

              {loadingItems ? (
                <p>Loading individual equipment IDs...</p>
              ) : individualItems.length === 0 ? (
                <p>No individual equipment IDs found.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>
                          Equipment ID
                        </th>
                        <th style={styles.th}>
                          Status
                        </th>
                        <th style={styles.th}>
                          Actions / Repair History
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {individualItems.map(item => {
                        const displayStatus =
                          getDisplayStatus(item);

                        const isRetired =
                          item.isRetired === true;

                        const isUnavailable =
                          item.status === 'Unavailable';

                        const isUpdating =
                          updatingItemId === item._id;

                        const repairs =
                          item.repairPeriods || [];

                        const hasLegacyRepair =
                          item.status === 'Under Repair';

                        return (
                          <tr key={item._id}>
                            <td style={styles.td}>
                              <strong>
                                {item.equipmentId}
                              </strong>
                            </td>

                            <td style={styles.td}>
                              <span
                                style={{
                                  color: isRetired
                                    ? '#b42318'
                                    : displayStatus ===
                                        'Under Repair'
                                      ? '#b42318'
                                      : isUnavailable
                                        ? '#64748b'
                                        : '#176b37',
                                  fontWeight: 'bold'
                                }}
                              >
                                {displayStatus}
                              </span>

                              {isRetired && (
                                <div
                                  style={{
                                    marginTop: '8px',
                                    fontSize: '12px',
                                    color: '#64748b'
                                  }}
                                >
                                  <div>
                                    Retired:{' '}
                                    {formatDate(item.retiredAt)}
                                  </div>

                                  {item.retirementReason && (
                                    <div>
                                      Reason:{' '}
                                      {item.retirementReason}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>

                            <td style={styles.td}>
                              {isRetired ? (
                                <span
                                  style={{
                                    color: '#b42318',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  Permanently Retired
                                </span>
                              ) : (
                                <>
                                  {!isUnavailable && (
                                    <button
                                      type="button"
                                      style={styles.button}
                                      disabled={
                                        isUpdating ||
                                        savingRepair ||
                                        savingRetirement
                                      }
                                      onClick={() =>
                                        openRepairForm(item)
                                      }
                                    >
                                      Schedule Repair
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    disabled={
                                      isUpdating ||
                                      savingRepair ||
                                      savingRetirement
                                    }
                                    onClick={() =>
                                      openRetirementForm(item)
                                    }
                                    style={{
                                      ...styles.button,
                                      backgroundColor: '#b42318',
                                      color: '#fff',
                                      border: 'none'
                                    }}
                                  >
                                    Retire Equipment
                                  </button>

                                  {hasLegacyRepair &&
                                    repairs.length === 0 && (
                                      <button
                                        type="button"
                                        style={styles.button}
                                        disabled={isUpdating}
                                        onClick={() =>
                                          handleClearLegacyRepair(item)
                                        }
                                      >
                                        Clear Old Repair Status
                                      </button>
                                    )}
                                </>
                              )}

                              {isUnavailable && !isRetired && (
                                <p
                                  style={{
                                    fontSize: '12px',
                                    color: '#64748b'
                                  }}
                                >
                                  Requires review
                                </p>
                              )}

                              {repairs.length > 0 && (
                                <div
                                  style={{
                                    marginTop: '10px',
                                    fontSize: '13px'
                                  }}
                                >
                                  <strong>
                                    Repair History
                                  </strong>

                                  {repairs.map(repair => {
                                    const active =
                                      isActiveRepair(repair);

                                    const completed =
                                      Boolean(
                                        repair.completedAt
                                      );

                                    const upcoming =
                                      !completed &&
                                      repair.startDate >
                                        todayKey();

                                    return (
                                      <div
                                        key={repair._id}
                                        style={{
                                          border: '1px solid #ddd',
                                          backgroundColor: '#fff',
                                          borderRadius: '6px',
                                          padding: '10px',
                                          marginTop: '8px'
                                        }}
                                      >
                                        <div>
                                          <strong>
                                            {repair.startDate}
                                            {' to '}
                                            {repair.endDate}
                                          </strong>
                                        </div>

                                        <div
                                          style={{
                                            marginTop: '5px'
                                          }}
                                        >
                                          {completed
                                            ? 'Completed'
                                            : active
                                              ? 'Currently Under Repair'
                                              : upcoming
                                                ? 'Scheduled'
                                                : 'Repair Period Ended'}
                                        </div>

                                        {repair.notes && (
                                          <p
                                            style={{
                                              margin: '6px 0'
                                            }}
                                          >
                                            Notes: {repair.notes}
                                          </p>
                                        )}

                                        {!isRetired &&
                                          !completed &&
                                          repair.endDate >=
                                            todayKey() && (
                                            <button
                                              type="button"
                                              style={styles.button}
                                              disabled={isUpdating}
                                              onClick={() =>
                                                handleCompleteRepair(
                                                  item,
                                                  repair
                                                )
                                              }
                                            >
                                              {isUpdating
                                                ? 'Updating...'
                                                : 'Mark Repaired'}
                                            </button>
                                          )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* PERMANENT RETIREMENT FORM */}

              {retiringItem && (
                <div
                  style={{
                    marginTop: '25px',
                    border: '1px solid #f0b7b7',
                    borderRadius: '10px',
                    padding: '20px',
                    backgroundColor: '#fff7f7'
                  }}
                >
                  <h3>
                    Retire Equipment —{' '}
                    {retiringItem.equipmentId}
                  </h3>

                  <p>
                    This will permanently remove this
                    physical equipment unit from future
                    allocations.
                  </p>

                  <form onSubmit={handleRetireEquipment}>
                    <div style={styles.field}>
                      <label htmlFor="retirement-reason">
                        Retirement Reason
                      </label>

                      <textarea
                        id="retirement-reason"
                        rows={3}
                        required
                        value={retirementReason}
                        onChange={event =>
                          setRetirementReason(
                            event.target.value
                          )
                        }
                        placeholder="Example: Equipment permanently damaged"
                        style={styles.input}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={savingRetirement}
                      style={{
                        ...styles.button,
                        backgroundColor: '#b42318',
                        color: '#fff',
                        border: 'none'
                      }}
                    >
                      {savingRetirement
                        ? 'Retiring...'
                        : 'Confirm Retirement'}
                    </button>

                    <button
                      type="button"
                      disabled={savingRetirement}
                      onClick={closeRetirementForm}
                      style={styles.button}
                    >
                      Cancel
                    </button>
                  </form>
                </div>
              )}

              {/* SCHEDULE REPAIR FORM */}

              {repairItem && (
                <div
                  style={{
                    marginTop: '25px',
                    border: '1px solid #93c5fd',
                    borderRadius: '10px',
                    padding: '20px',
                    backgroundColor: '#eff6ff'
                  }}
                >
                  <h3>
                    Schedule Repair —{' '}
                    {repairItem.equipmentId}
                  </h3>

                  <p>
                    Choose the dates when this equipment
                    must not be assigned to bookings.
                  </p>

                  <form onSubmit={handleScheduleRepair}>
                    <div style={styles.field}>
                      <label htmlFor="repair-start-date">
                        Repair Start Date
                      </label>

                      <input
                        id="repair-start-date"
                        type="date"
                        required
                        value={repairForm.startDate}
                        onChange={event =>
                          setRepairForm(previous => ({
                            ...previous,
                            startDate: event.target.value
                          }))
                        }
                        style={styles.input}
                      />
                    </div>

                    <div style={styles.field}>
                      <label htmlFor="repair-end-date">
                        Repair End Date
                      </label>

                      <input
                        id="repair-end-date"
                        type="date"
                        required
                        min={
                          repairForm.startDate ||
                          undefined
                        }
                        value={repairForm.endDate}
                        onChange={event =>
                          setRepairForm(previous => ({
                            ...previous,
                            endDate: event.target.value
                          }))
                        }
                        style={styles.input}
                      />
                    </div>

                    <div style={styles.field}>
                      <label htmlFor="repair-notes">
                        Repair Notes (Optional)
                      </label>

                      <textarea
                        id="repair-notes"
                        rows={3}
                        value={repairForm.notes}
                        onChange={event =>
                          setRepairForm(previous => ({
                            ...previous,
                            notes: event.target.value
                          }))
                        }
                        placeholder="Example: Oscilloscope calibration or maintenance"
                        style={styles.input}
                      />
                    </div>

                    <p
                      style={{
                        fontSize: '13px',
                        color: '#475569'
                      }}
                    >
                      Both start and end dates are
                      included. The backend checks
                      repair overlaps and booking conflicts.
                    </p>

                    <button
                      type="submit"
                      className="primary-btn"
                      disabled={savingRepair}
                    >
                      {savingRepair
                        ? 'Saving Repair...'
                        : 'Save Repair Schedule'}
                    </button>

                    <button
                      type="button"
                      style={styles.button}
                      disabled={savingRepair}
                      onClick={closeRepairForm}
                    >
                      Cancel
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default AdminEquipment;
