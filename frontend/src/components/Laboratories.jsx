


import { useEffect, useState } from 'react';

import DOMPurify from 'dompurify';

import labs from '../data/labs';


function Laboratories() {
  const [selectedLab, setSelectedLab] = useState(null);

const [officialDetails, setOfficialDetails] = useState(null);
const [detailsLoading, setDetailsLoading] = useState(false);
const [detailsError, setDetailsError] = useState('');

useEffect(() => {
  if (!selectedLab) {
    setOfficialDetails(null);
    setDetailsError('');
    return;
  }

  const controller = new AbortController();

  async function fetchLabDetails() {
    setDetailsLoading(true);
    setDetailsError('');
    setOfficialDetails(null);

    try {
      const response = await fetch(
        `https://university-lab-backend.vercel.app/api/lab-details/${selectedLab.id}`,
        { signal: controller.signal }
      );

      if (!response.ok) {
        throw new Error('Failed to load laboratory details');
      }

      const data = await response.json();
      setOfficialDetails(data);

    } catch (error) {
      if (error.name !== 'AbortError') {
        setDetailsError('Unable to load official laboratory details.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setDetailsLoading(false);
      }
    }
  }

  fetchLabDetails();

  return () => controller.abort();
}, [selectedLab]);

  if (selectedLab) {
    return (
      <section className="laboratories-section">
        <button
          className="lab-details-btn"
          onClick={() => setSelectedLab(null)}
        >
          ← Back to Laboratories
        </button>

        

<h2>{officialDetails?.name || selectedLab.name}</h2>

{detailsLoading && (
  <p>Loading official laboratory information...</p>
)}

{detailsError && (
  <p role="alert">{detailsError}</p>
)}

{officialDetails && (
  <div
    className="official-lab-details"
    dangerouslySetInnerHTML={{
      __html: DOMPurify.sanitize(officialDetails.html)
    }}
  />
)}


      </section>
    );
  }

  return (
    <section id="laboratories" className="laboratories-section">
      <h2>Our Laboratories</h2>
      <p>
        Explore the laboratories available in the
        Department of Electrical and Information Engineering.
      </p>

      <div className="labs-grid">
        {labs.map((lab) => (
          <div className="lab-card" key={lab.id}>
            <div className="lab-card-header">
              <span className="lab-number">
                LAB {String(lab.id).padStart(2, '0')}
              </span>
            </div>

            <div className="lab-card-body">
              <h3>{lab.name}</h3>
              <p>{lab.description}</p>

              <button
                className="lab-details-btn"
                onClick={() => setSelectedLab(lab)}
              >
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default Laboratories;
