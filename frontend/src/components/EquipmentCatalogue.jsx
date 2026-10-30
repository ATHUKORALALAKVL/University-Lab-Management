
import { useEffect, useState } from 'react';

function EquipmentCatalogue() {
  const [labs, setLabs] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [selectedLab, setSelectedLab] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load laboratories and equipment from the backend
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError('');

        const [labsResponse, equipmentResponse] =
          await Promise.all([
            fetch('http://localhost:5000/api/labs'),
            fetch('http://localhost:5000/api/equipment')
          ]);

        if (!labsResponse.ok || !equipmentResponse.ok) {
          throw new Error('Failed to load equipment catalogue');
        }

        const labsData = await labsResponse.json();
        const equipmentData = await equipmentResponse.json();

        setLabs(labsData);
        setEquipment(equipmentData);
      } catch (err) {
        console.error('Equipment catalogue error:', err);
        setError('Unable to load equipment. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Filter equipment belonging to the selected laboratory
  const filteredEquipment = selectedLab
    ? equipment.filter(
        (item) =>
          String(item.lab?._id) === String(selectedLab._id)
      )
    : [];

  const getEquipmentCount = (labId) =>
    equipment.filter(
      (item) => String(item.lab?._id) === String(labId)
    ).length;

  const styles = {
    container: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '30px 20px'
    },

    cards: {
      display: 'grid',
      gridTemplateColumns:
        'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '20px',
      marginTop: '25px'
    },

    card: {
      padding: '25px',
      borderRadius: '12px',
      border: '1px solid #ddd',
      backgroundColor: '#fff',
      textAlign: 'left',
      cursor: 'pointer',
      boxShadow: '0 3px 10px rgba(0,0,0,0.06)'
    },

    table: {
      width: '100%',
      borderCollapse: 'collapse',
      marginTop: '20px'
    },

    th: {
      padding: '14px 12px',
      textAlign: 'left',
      backgroundColor: '#f1f5f9',
      borderBottom: '2px solid #ddd'
    },

    td: {
      padding: '14px 12px',
      borderBottom: '1px solid #e5e7eb'
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <h2>Equipment Catalogue</h2>
        <p>Loading laboratories and equipment...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <h2>Equipment Catalogue</h2>
        <p style={{ color: '#c0392b' }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2>Equipment Catalogue</h2>

      <p>
        Explore equipment available in the laboratories of the
        Department of Electrical and Information Engineering,
        University of Ruhuna.
      </p>

      {!selectedLab ? (
        <>
          <h3 style={{ marginTop: '30px' }}>
            Select a Laboratory
          </h3>

          {labs.length === 0 ? (
            <p>No laboratories found.</p>
          ) : (
            <div style={styles.cards}>
              {labs.map((lab) => (
                <button
                  key={lab._id}
                  type="button"
                  style={styles.card}
                  onClick={() => setSelectedLab(lab)}
                >
                  <div
                    style={{
                      fontSize: '19px',
                      fontWeight: 'bold',
                      marginBottom: '12px',
                      color: '#1e3a8a'
                    }}
                  >
                    {lab.name}
                  </div>

                 

                  <p
                    style={{
                      marginTop: '15px',
                      marginBottom: 0,
                      color: '#2563eb',
                      fontWeight: 'bold'
                    }}
                  >
                    View Equipment
                  </p>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setSelectedLab(null)}
            style={{
              marginTop: '25px',
              padding: '10px 16px',
              border: '1px solid #ccc',
              borderRadius: '6px',
              backgroundColor: '#fff',
              cursor: 'pointer'
            }}
          >
            ← Back to Laboratories
          </button>

          <h3 style={{ marginTop: '30px' }}>
            {selectedLab.name} — Equipment Inventory
          </h3>

          {filteredEquipment.length === 0 ? (
            <p>
              No equipment has been added to this laboratory yet.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Equipment Name</th>
                    <th style={styles.th}>Code</th>
                    <th style={styles.th}>Total Quantity</th>
                    <th style={styles.th}>Usable Quantity</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredEquipment.map((item) => (
                    <tr key={item._id}>
                      <td style={styles.td}>
                        <strong>{item.name}</strong>

                        {item.description && (
                          <div
                            style={{
                              fontSize: '13px',
                              color: '#666',
                              marginTop: '5px'
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
                        {item.totalQuantity ?? 0}
                      </td>

                      <td style={styles.td}>
                        <strong>
                         {item.usableQuantity ?? 0}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p
            style={{
              marginTop: '20px',
              color: '#666',
              fontSize: '13px'
            }}
          >
            Usable quantity represents equipment units that are operational
          </p>
        </>
      )}
    </div>
  );
}

export default EquipmentCatalogue;
