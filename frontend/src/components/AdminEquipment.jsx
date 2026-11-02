
import { useEffect, useRef, useState } from 'react';

const API = 'https://university-lab-backend.vercel.app/api';

// Shared styles and helpers
const s = {
  panel: {
    border: '1px solid #ddd', borderRadius: 10, padding: 20,
    background: '#fafafa', marginTop: 20
  },
  input: {
    display: 'block', width: '100%', padding: 10,
    boxSizing: 'border-box', marginTop: 6
  },
  field: { marginBottom: 15 },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: 15 },
  th: { borderBottom: '2px solid #ddd', padding: '12px 8px', textAlign: 'left' },
  td: { borderBottom: '1px solid #eee', padding: '12px 8px', verticalAlign: 'middle' },
  btn: {
    padding: '7px 11px', borderRadius: 5, border: '1px solid #ccc',
    cursor: 'pointer', margin: 3
  },
  danger: {
    padding: '7px 11px', borderRadius: 5, border: 0,
    background: '#b42318', color: '#fff', cursor: 'pointer', margin: 3
  },
  row: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', flexWrap: 'wrap', gap: 12
  },
  muted: { color: '#64748b', fontSize: 13 }
};

const idOf = value => String(value?._id || value || '');
const norm = value => String(value || '').trim().toLowerCase();
const dateKey = date => {
  const d = date || new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const emptyRepair = { startDate: '', endDate: '', notes: '' };
const activeRepair = r =>
  !r.completedAt && r.startDate <= dateKey() && r.endDate >= dateKey();

const displayStatus = item => {
  if (item.isRetired) return 'Retired';
  if (item.displayStatus) return item.displayStatus;
  if (['Unavailable', 'Under Repair'].includes(item.status)) return item.status;
  return (item.repairPeriods || []).some(activeRepair) ? 'Under Repair' : 'Usable';
};

const formatDate = value => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-GB');
};

const headers = (json = false) => ({
  ...(json ? { 'Content-Type': 'application/json' } : {}),
  Authorization: `Bearer ${sessionStorage.getItem('token')}`
});

async function request(url, options = {}) {
  const response = await fetch(`${API}${url}`, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

// Reusable interface elements
function Field({ id, label, hint, children }) {
  return (
    <div style={s.field}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <small style={{ display: 'block', marginTop: 6 }}>{hint}</small>}
    </div>
  );
}

function ActionButton({ children, danger, ...props }) {
  return (
    <button type="button" style={danger ? s.danger : s.btn} {...props}>
      {children}
    </button>
  );
}

function RepairHistory({ item, updating, onComplete }) {
  const repairs = item.repairPeriods || [];
  if (!repairs.length) return null;

  return (
    <div style={{ marginTop: 10, fontSize: 13 }}>
      <strong>Repair History</strong>
      {repairs.map(repair => {
        const completed = Boolean(repair.completedAt);
        const status = completed ? 'Completed'
          : activeRepair(repair) ? 'Currently Under Repair'
          : repair.startDate > dateKey() ? 'Scheduled' : 'Repair Period Ended';

        return (
          <div key={repair._id} style={{ ...s.panel, background: '#fff', padding: 10, marginTop: 8 }}>
            <strong>{repair.startDate} to {repair.endDate}</strong>
            <div style={{ marginTop: 5 }}>{status}</div>
            {repair.notes && <p style={{ margin: '6px 0' }}>Notes: {repair.notes}</p>}
            {!item.isRetired && !completed && repair.endDate >= dateKey() && (
              <ActionButton disabled={updating} onClick={() => onComplete(item, repair)}>
                {updating ? 'Updating...' : 'Mark Repaired'}
              </ActionButton>
            )}
          </div>
        );
      })}
    </div>
  );
}

function IndividualTable({
  items, updatingId, savingRepair, savingRetirement,
  onRepair, onRetire, onComplete, onClearLegacy
}) {
  if (!items.length) return <p>No individual equipment IDs found.</p>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={s.table}>
        <thead>
          <tr>
            {['Equipment ID', 'Status', 'Actions / Repair History'].map(h => (
              <th key={h} style={s.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            const status = displayStatus(item);
            const retired = item.isRetired === true;
            const unavailable = item.status === 'Unavailable';
            const updating = updatingId === item._id;
            const repairs = item.repairPeriods || [];
            const disabled = updating || savingRepair || savingRetirement;

            return (
              <tr key={item._id}>
                <td style={s.td}><strong>{item.equipmentId}</strong></td>
                <td style={s.td}>
                  <strong style={{
                    color: retired || status === 'Under Repair' ? '#b42318'
                      : unavailable ? '#64748b' : '#176b37'
                  }}>{status}</strong>
                  {retired && (
                    <div style={s.muted}>
                      <div>Retired: {formatDate(item.retiredAt)}</div>
                      {item.retirementReason && <div>Reason: {item.retirementReason}</div>}
                    </div>
                  )}
                </td>
                <td style={s.td}>
                  {retired ? (
                    <strong style={{ color: '#b42318' }}>Permanently Retired</strong>
                  ) : (
                    <>
                      {!unavailable && (
                        <ActionButton disabled={disabled} onClick={() => onRepair(item)}>
                          Schedule Repair
                        </ActionButton>
                      )}
                      <ActionButton danger disabled={disabled} onClick={() => onRetire(item)}>
                        Retire Equipment
                      </ActionButton>
                      {item.status === 'Under Repair' && repairs.length === 0 && (
                        <ActionButton disabled={updating} onClick={() => onClearLegacy(item)}>
                          Clear Old Repair Status
                        </ActionButton>
                      )}
                    </>
                  )}
                  {unavailable && !retired && <p style={s.muted}>Requires review</p>}
                  <RepairHistory item={item} updating={updating} onComplete={onComplete} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AdminEquipment() {
  // Inventory and laboratory selection
  const [equipment, setEquipment] = useState([]);
  const [labs, setLabs] = useState([]);
  const [selectedLab, setSelectedLab] = useState('');

  // Equipment form
  const [form, setForm] = useState({
    name: '', code: '', description: '', lab: '', totalQuantity: ''
  });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [savingEquipment, setSavingEquipment] = useState(false);

  // Physical equipment
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [focusedId, setFocusedId] = useState('');
  const individualSection = useRef(null);

  // Top search
  const [searchLab, setSearchLab] = useState('');
  const [searchId, setSearchId] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  // Repair and retirement
  const [repairItem, setRepairItem] = useState(null);
  const [repairForm, setRepairForm] = useState(emptyRepair);
  const [savingRepair, setSavingRepair] = useState(false);
  const [retiringItem, setRetiringItem] = useState(null);
  const [retirementReason, setRetirementReason] = useState('');
  const [savingRetirement, setSavingRetirement] = useState(false);

  const changeForm = (key, value) =>
    setForm(previous => ({ ...previous, [key]: value }));

  const resetForm = () => {
    setForm({ name: '', code: '', description: '', lab: selectedLab, totalQuantity: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const clearSearch = () => {
    setSearchLab('');
    setSearchId('');
    setResults([]);
    setSearched(false);
  };

  const loadEquipment = async () => {
    try {
      const data = await request('/equipment');
      setEquipment(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Load equipment error:', error);
      alert(error.message);
    }
  };

  const loadLabs = async () => {
    try {
      const data = await request('/labs');
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

  const fetchItems = async equipmentId => {
    const data = await request(`/equipment/${equipmentId}/items`, {
      headers: headers()
    });
    return Array.isArray(data.items) ? data.items : [];
  };

  const loadItems = async equipmentId => {
    setLoadingItems(true);
    try {
      setItems(await fetchItems(equipmentId));
    } catch (error) {
      console.error('Load equipment IDs error:', error);
      alert(error.message);
    } finally {
      setLoadingItems(false);
    }
  };

  // Search within selected laboratory
  const handleSearch = async event => {
    event.preventDefault();

    if (!searchLab) {
      alert('Please select a laboratory.');
      return;
    }
    if (!searchId.trim()) {
      alert('Please enter an individual equipment ID.');
      return;
    }

    setSearching(true);
    setSearched(false);
    setResults([]);

    try {
      const types = equipment.filter(type => idOf(type.lab) === searchLab);
      const matches = [];

      for (const type of types) {
        const physicalItems = await fetchItems(type._id);
        physicalItems
          .filter(item => norm(item.equipmentId) === norm(searchId))
          .forEach(item => matches.push({ type, item }));
      }

      setResults(matches);
      setSearched(true);
    } catch (error) {
      console.error('Search equipment error:', error);
      alert(error.message);
    } finally {
      setSearching(false);
    }
  };

  const selectLab = labId => {
    setSelectedLab(labId);
    setForm({ name: '', code: '', description: '', lab: labId, totalQuantity: '' });
    setShowForm(false);
    setEditingId(null);
    setSelectedEquipment(null);
    setItems([]);
    setFocusedId('');
    setRepairItem(null);
    setRetiringItem(null);
    setRetirementReason('');
  };

  const viewItems = async (type, focus = '') => {
    setSelectedLab(idOf(type.lab));
    setSelectedEquipment(type);
    setItems([]);
    setFocusedId(focus);
    setRepairItem(null);
    setRetiringItem(null);
    setShowForm(false);
    await loadItems(type._id);
    if (focus) {
      requestAnimationFrame(() =>
        individualSection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      );
    }
  };

  const refreshInventory = async equipmentId => {
    await Promise.all([loadItems(equipmentId), loadEquipment()]);
    setResults([]);
    setSearched(false);
  };

  // Add, edit and delete equipment types
  const handleSaveEquipment = async event => {
    event.preventDefault();
    const code = form.code.trim().toUpperCase();
    const quantity = Number(form.totalQuantity);

    if (!form.name.trim()) return alert('Please enter the equipment name.');
    if (!/^[A-Z]{2,6}$/.test(code)) return alert('Equipment code must contain 2 to 6 letters.');
    if (!Number.isInteger(quantity) || quantity < 1) return alert('Quantity must be greater than zero.');
    if (!form.lab) return alert('Please select a laboratory.');

    setSavingEquipment(true);
    try {
      const editing = Boolean(editingId);
      const data = await request(editing ? `/equipment/${editingId}` : '/equipment', {
        method: editing ? 'PUT' : 'POST',
        headers: headers(true),
        body: JSON.stringify({
          name: form.name.trim(), code, description: form.description.trim(),
          lab: form.lab, totalQuantity: quantity
        })
      });

      alert(data.message || (editing ? 'Equipment updated successfully.' : 'Equipment added successfully.'));
      if (editing && selectedEquipment?._id === editingId) {
        setSelectedEquipment(previous => ({
          ...previous, name: form.name.trim(), code,
          description: form.description.trim(), totalQuantity: quantity
        }));
      }
      resetForm();
      clearSearch();
      await loadEquipment();
    } catch (error) {
      console.error('Save equipment error:', error);
      alert(error.message);
    } finally {
      setSavingEquipment(false);
    }
  };

  const handleDelete = async type => {
    if (!window.confirm(
      `Delete ${type.name} and its unused physical equipment IDs? This action cannot be undone.`
    )) return;

    try {
      const data = await request(`/equipment/${type._id}`, {
        method: 'DELETE', headers: headers()
      });
      alert(data.message || 'Equipment deleted successfully.');
      if (selectedEquipment?._id === type._id) {
        setSelectedEquipment(null);
        setItems([]);
        setRepairItem(null);
        setRetiringItem(null);
      }
      if (editingId === type._id) resetForm();
      clearSearch();
      await loadEquipment();
    } catch (error) {
      console.error('Delete equipment error:', error);
      alert(error.message);
    }
  };

  // Repair and retirement actions
  const openRepair = item => {
    if (item.isRetired || item.status === 'Unavailable') {
      alert('This equipment cannot be scheduled for repair.');
      return;
    }
    setRetiringItem(null);
    setRepairItem(item);
    setRepairForm({ startDate: dateKey(), endDate: dateKey(), notes: '' });
  };

  const openRetirement = item => {
    if (item.isRetired) return;
    setRepairItem(null);
    setRetiringItem(item);
    setRetirementReason('');
  };

  const scheduleRepair = async event => {
    event.preventDefault();
    if (!selectedEquipment || !repairItem) return;
    const { startDate, endDate, notes } = repairForm;

    if (!startDate || !endDate) return alert('Please enter both repair dates.');
    if (endDate < startDate) return alert('Repair end date cannot be before start date.');
    if (!window.confirm(
      `Schedule ${repairItem.equipmentId} for repair from ${startDate} to ${endDate}?`
    )) return;

    setSavingRepair(true);
    try {
      const data = await request(
        `/equipment/${selectedEquipment._id}/items/${repairItem._id}/repairs`,
        {
          method: 'POST', headers: headers(true),
          body: JSON.stringify({ startDate, endDate, notes: notes.trim() })
        }
      );
      alert(data.message || 'Repair scheduled successfully.');
      setRepairItem(null);
      setRepairForm(emptyRepair);
      await refreshInventory(selectedEquipment._id);
    } catch (error) {
      console.error('Schedule repair error:', error);
      alert(error.message);
    } finally {
      setSavingRepair(false);
    }
  };

  const retireEquipment = async event => {
    event.preventDefault();
    if (!selectedEquipment || !retiringItem) return;
    const reason = retirementReason.trim();

    if (!reason) return alert('Please provide a retirement reason.');
    if (!window.confirm(
      `Permanently retire ${retiringItem.equipmentId}? This equipment ID cannot be returned to service.`
    )) return;

    setSavingRetirement(true);
    try {
      const data = await request(
        `/equipment/${selectedEquipment._id}/items/${retiringItem._id}/retire`,
        {
          method: 'PATCH', headers: headers(true),
          body: JSON.stringify({ reason })
        }
      );
      alert(data.message || 'Equipment retired successfully.');
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

  const updatePhysicalItem = async (item, path, body, message) => {
    setUpdatingId(item._id);
    try {
      const data = await request(
        `/equipment/${selectedEquipment._id}/items/${item._id}/${path}`,
        {
          method: 'PATCH',
          headers: headers(Boolean(body)),
          ...(body ? { body: JSON.stringify(body) } : {})
        }
      );
      alert(data.message || message);
      await refreshInventory(selectedEquipment._id);
    } catch (error) {
      console.error('Update equipment error:', error);
      alert(error.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const completeRepair = (item, repair) => {
    if (!selectedEquipment || repair.completedAt || item.isRetired) return;
    if (!window.confirm(
      `Mark the repair of ${item.equipmentId} as completed? This will end its repair restriction immediately.`
    )) return;
    updatePhysicalItem(item, `repairs/${repair._id}/complete`, null, 'Repair marked completed.');
  };

  const clearLegacyRepair = item => {
    if (!selectedEquipment || item.isRetired) return;
    if (!window.confirm(
      `Clear the old undated repair status of ${item.equipmentId}?`
    )) return;
    updatePhysicalItem(item, 'status', { status: 'Available' }, 'Old repair status cleared.');
  };

  // Derived values
  const labName = labId =>
    labs.find(l => idOf(l) === idOf(labId))?.name || 'Unknown Laboratory';

  const visibleEquipment = equipment.filter(type => idOf(type.lab) === selectedLab);
  const visibleItems = focusedId
    ? items.filter(item => norm(item.equipmentId) === norm(focusedId))
    : items;

  return (
    <div style={{ padding: 30, maxWidth: 1250, margin: 'auto' }}>
      <h2>Equipment Management</h2>
      <p>
        Select a laboratory to manage equipment inventory,
        individual equipment IDs, repairs and retirement.
      </p>

      {/* Search above laboratory cards */}
      <section style={{ ...s.panel, background: '#fff', marginBottom: 30 }}>
        <h3 style={{ marginTop: 0 }}>Search Individual Equipment</h3>

        <form onSubmit={handleSearch}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 15
          }}>
            <Field id="search-lab" label="Laboratory Name">
              <select
                id="search-lab"
                value={searchLab}
                onChange={e => setSearchLab(e.target.value)}
                required
                style={s.input}
              >
                <option value="">-- Select Laboratory --</option>
                {labs.map(l => (
                  <option key={l._id} value={l._id}>{l.name}</option>
                ))}
              </select>
            </Field>

            <Field id="search-id" label="Individual Equipment ID">
              <input
                id="search-id"
                type="text"
                value={searchId}
                onChange={e => setSearchId(e.target.value.toUpperCase())}
                placeholder="Example: AOSC-001"
                required
                style={s.input}
              />
            </Field>
          </div>

          <button type="submit" className="primary-btn" disabled={searching}>
            {searching ? 'Searching...' : 'Search Equipment'}
          </button>
          <ActionButton disabled={searching} onClick={clearSearch}>
            Clear Search
          </ActionButton>
        </form>

        {searched && (
          <div style={{ marginTop: 20 }}>
            <h4>Search Results ({results.length})</h4>
            {!results.length ? (
              <p>No matching equipment found.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['Laboratory', 'Equipment', 'Equipment ID', 'Status', 'Action'].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(({ type, item }) => (
                      <tr key={item._id}>
                        <td style={s.td}>{labName(type.lab)}</td>
                        <td style={s.td}>{type.name}</td>
                        <td style={s.td}><strong>{item.equipmentId}</strong></td>
                        <td style={s.td}>{displayStatus(item)}</td>
                        <td style={s.td}>
                          <ActionButton onClick={() => viewItems(type, item.equipmentId)}>
                            View Record / Repairs
                          </ActionButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Laboratory cards */}
      <h3>Laboratories</h3>
      {!labs.length ? <p>No laboratories found.</p> : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16, marginBottom: 30
        }}>
          {labs.map(l => {
            const active = selectedLab === idOf(l);
            const count = equipment.filter(type => idOf(type.lab) === idOf(l)).length;

            return (
              <button
                key={l._id}
                type="button"
                onClick={() => selectLab(l._id)}
                style={{
                  border: active ? '2px solid #2563eb' : '1px solid #ddd',
                  borderRadius: 10, padding: 20, background: active ? '#eff6ff' : '#fff',
                  textAlign: 'left', cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
                  {l.name}
                </div>
                <div style={{ color: '#555' }}>{count} equipment types</div>
                {active && <div style={{ marginTop: 10, color: '#2563eb', fontWeight: 'bold' }}>Selected</div>}
              </button>
            );
          })}
        </div>
      )}

      {selectedLab && (
        <>
          {/* Inventory header */}
          <div style={s.row}>
            <h3>{labName(selectedLab)} — Equipment Inventory</h3>
            <button type="button" className="primary-btn" onClick={() => {
              resetForm();
              setShowForm(true);
            }}>
              + Add Equipment
            </button>
          </div>

          {/* Add and edit form */}
          {showForm && (
            <section style={s.panel}>
              <h3>{editingId ? 'Edit Equipment' : 'Add Equipment'}</h3>
              <form onSubmit={handleSaveEquipment}>
                <Field id="equipment-name" label="Equipment Name">
                  <input id="equipment-name" value={form.name}
                    onChange={e => changeForm('name', e.target.value)}
                    placeholder="Example: Digital Oscilloscope" required style={s.input} />
                </Field>

                <Field id="equipment-code" label="Equipment Code"
                  hint={editingId
                    ? 'Existing codes may be locked by the backend.'
                    : 'Enter 2 to 6 letters. Example: OSC, DMM, PSU.'}>
                  <input id="equipment-code" value={form.code}
                    onChange={e => changeForm('code', e.target.value.toUpperCase())}
                    maxLength={6} pattern="[A-Za-z]{2,6}" required style={s.input} />
                </Field>

                <Field id="equipment-description" label="Description">
                  <input id="equipment-description" value={form.description}
                    onChange={e => changeForm('description', e.target.value)}
                    placeholder="Optional description" style={s.input} />
                </Field>

                <Field id="equipment-lab" label="Laboratory">
                  <select id="equipment-lab" value={form.lab}
                    onChange={e => changeForm('lab', e.target.value)}
                    required style={s.input}>
                    <option value="">-- Select Laboratory --</option>
                    {labs.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
                  </select>
                </Field>

                <Field id="equipment-quantity" label="Total Quantity"
                  hint={editingId
                    ? 'Reducing quantity may be restricted when physical equipment IDs already exist.'
                    : 'If the code already exists in this laboratory, this quantity will be added to its inventory.'}>
                  <input id="equipment-quantity" type="number" min="1" step="1"
                    value={form.totalQuantity}
                    onChange={e => changeForm('totalQuantity', e.target.value)}
                    required style={s.input} />
                </Field>

                <button type="submit" className="primary-btn" disabled={savingEquipment}>
                  {savingEquipment ? 'Saving...' : editingId ? 'Save Changes' : 'Add Equipment'}
                </button>
                <ActionButton disabled={savingEquipment} onClick={resetForm}>Cancel</ActionButton>
              </form>
            </section>
          )}

          {/* Inventory table */}
          {!visibleEquipment.length ? (
            <p>No equipment added to this laboratory yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['Equipment', 'Code', 'Total', 'Usable', 'Under Repair', 'Actions'].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleEquipment.map(type => (
                    <tr key={type._id}>
                      <td style={s.td}>
                        <strong>{type.name}</strong>
                        {type.description && <div style={s.muted}>{type.description}</div>}
                      </td>
                      <td style={s.td}>{type.code || '-'}</td>
                      <td style={s.td}>{type.totalQuantity}</td>
                      <td style={s.td}>{type.usableQuantity ?? 0}</td>
                      <td style={s.td}>{type.underRepairQuantity ?? 0}</td>
                      <td style={{ ...s.td, minWidth: 240 }}>
                        <ActionButton onClick={() => viewItems(type)}>View IDs / Repairs</ActionButton>
                        <ActionButton onClick={() => {
                          setEditingId(type._id);
                          setForm({
                            name: type.name || '', code: type.code || '',
                            description: type.description || '', lab: idOf(type.lab),
                            totalQuantity: String(type.totalQuantity ?? '')
                          });
                          setShowForm(true);
                        }}>Edit</ActionButton>
                        <ActionButton danger onClick={() => handleDelete(type)}>Delete</ActionButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Individual physical equipment */}
          {selectedEquipment && (
            <section ref={individualSection} style={{ ...s.panel, marginTop: 30, scrollMarginTop: 20 }}>
              <div style={s.row}>
                <div>
                  <h3 style={{ marginBottom: 5 }}>Individual Equipment IDs</h3>
                  <p>{selectedEquipment.name} ({selectedEquipment.code})</p>
                </div>
                <div>
                  <ActionButton disabled={loadingItems} onClick={() => loadItems(selectedEquipment._id)}>
                    {loadingItems ? 'Refreshing...' : 'Refresh'}
                  </ActionButton>
                  {focusedId && (
                    <ActionButton onClick={() => setFocusedId('')}>Show All IDs</ActionButton>
                  )}
                  <ActionButton onClick={() => {
                    setSelectedEquipment(null);
                    setItems([]);
                    setFocusedId('');
                    setRepairItem(null);
                    setRetiringItem(null);
                  }}>Close</ActionButton>
                </div>
              </div>

              <p style={s.muted}>
                Repair schedules are checked against approved booking dates.
                Retired equipment cannot be assigned to future bookings.
              </p>
              {focusedId && <p>Showing equipment ID: <strong>{focusedId}</strong></p>}

              {loadingItems ? <p>Loading individual equipment IDs...</p> : (
                <IndividualTable
                  items={visibleItems}
                  updatingId={updatingId}
                  savingRepair={savingRepair}
                  savingRetirement={savingRetirement}
                  onRepair={openRepair}
                  onRetire={openRetirement}
                  onComplete={completeRepair}
                  onClearLegacy={clearLegacyRepair}
                />
              )}

              {/* Permanent retirement */}
              {retiringItem && (
                <section style={{ ...s.panel, borderColor: '#f0b7b7', background: '#fff7f7' }}>
                  <h3>Retire Equipment — {retiringItem.equipmentId}</h3>
                  <p>This will permanently remove this physical equipment unit from future allocations.</p>
                  <form onSubmit={retireEquipment}>
                    <Field id="retirement-reason" label="Retirement Reason">
                      <textarea id="retirement-reason" rows={3} required
                        value={retirementReason}
                        onChange={e => setRetirementReason(e.target.value)}
                        placeholder="Example: Equipment permanently damaged"
                        style={s.input} />
                    </Field>
                    <button type="submit" style={s.danger} disabled={savingRetirement}>
                      {savingRetirement ? 'Retiring...' : 'Confirm Retirement'}
                    </button>
                    <ActionButton disabled={savingRetirement} onClick={() => {
                      setRetiringItem(null);
                      setRetirementReason('');
                    }}>Cancel</ActionButton>
                  </form>
                </section>
              )}

              {/* Repair scheduling */}
              {repairItem && (
                <section style={{ ...s.panel, borderColor: '#93c5fd', background: '#eff6ff' }}>
                  <h3>Schedule Repair — {repairItem.equipmentId}</h3>
                  <p>Choose the dates when this equipment must not be assigned to bookings.</p>
                  <form onSubmit={scheduleRepair}>
                    <Field id="repair-start" label="Repair Start Date">
                      <input id="repair-start" type="date" required
                        value={repairForm.startDate}
                        onChange={e => setRepairForm(p => ({ ...p, startDate: e.target.value }))}
                        style={s.input} />
                    </Field>
                    <Field id="repair-end" label="Repair End Date">
                      <input id="repair-end" type="date" required
                        min={repairForm.startDate || undefined}
                        value={repairForm.endDate}
                        onChange={e => setRepairForm(p => ({ ...p, endDate: e.target.value }))}
                        style={s.input} />
                    </Field>
                    <Field id="repair-notes" label="Repair Notes (Optional)">
                      <textarea id="repair-notes" rows={3} value={repairForm.notes}
                        onChange={e => setRepairForm(p => ({ ...p, notes: e.target.value }))}
                        placeholder="Example: Oscilloscope calibration or maintenance"
                        style={s.input} />
                    </Field>
                    <p style={s.muted}>
                      Both start and end dates are included. The backend checks
                      repair overlaps and booking conflicts.
                    </p>
                    <button type="submit" className="primary-btn" disabled={savingRepair}>
                      {savingRepair ? 'Saving Repair...' : 'Save Repair Schedule'}
                    </button>
                    <ActionButton disabled={savingRepair} onClick={() => {
                      setRepairItem(null);
                      setRepairForm(emptyRepair);
                    }}>Cancel</ActionButton>
                  </form>
                </section>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default AdminEquipment;
