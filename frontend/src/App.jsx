
import { useState } from 'react';
import './App.css';

import Laboratories from './components/Laboratories';
import LabAvailability from './components/LabAvailability';
import LabBooking from './components/LabBooking';
import Register from './components/Register';
import Login from './components/Login';
import StudentDashboard from './components/StudentDashboard';
import MyBookings from './components/MyBookings';
import MyProfile from './components/MyProfile';
import StaffPending from './components/StaffPending';
import StaffRejected from './components/StaffRejected';
import AdminDashboard from './components/AdminDashboard';
import AdminStaffVerification from './components/AdminStaffVerification';
import AdminEquipment from './components/AdminEquipment';
import AdminBookingRequests from './components/AdminBookingRequests';
import AdminReports from './components/AdminReports';
import AdminUserManagement from './components/AdminUserManagement';
import AdminLaboratories from './components/AdminLaboratories';
import EquipmentCatalogue from './components/EquipmentCatalogue';

// NEW: Staff equipment-only booking form
import StaffEquipmentBooking from './components/StaffEquipmentBooking';

function App() {
  const [currentPage, setCurrentPage] = useState('home');

  const [loggedInUser, setLoggedInUser] = useState(() => {
    const savedUser = sessionStorage.getItem('user');

    if (!savedUser) {
      return null;
    }

    try {
      return JSON.parse(savedUser);
    } catch (error) {
      console.error('Invalid saved user:', error);
      return null;
    }
  });

  // =====================================================
  // STAFF VERIFICATION HELPERS
  // =====================================================

  const isStaffPending = (user) => {
    if (!user) return false;

    return (
      user.staffVerificationStatus === 'pending' ||
      (
        user.staffRequested &&
        user.role !== 'staff'
      )
    );
  };

  const isStaffRejected = (user) => {
    if (!user) return false;

    return user.staffVerificationStatus === 'rejected';
  };

  const isVerifiedStaff = (user) => {
    if (!user) return false;

    return (
      user.role === 'staff' &&
      !isStaffPending(user) &&
      !isStaffRejected(user)
    );
  };

  // =====================================================
  // DASHBOARD NAVIGATION
  // =====================================================

  const goToDashboard = () => {
    if (!loggedInUser) {
      setCurrentPage('login');
    } else if (isStaffRejected(loggedInUser)) {
      setCurrentPage('staff-rejected');
    } else if (isStaffPending(loggedInUser)) {
      setCurrentPage('staff-pending');
    } else {
      setCurrentPage('dashboard');
    }
  };

  // =====================================================
  // SAFE PAGE NAVIGATION
  // =====================================================

  const navigateTo = (page) => {
    if (page === 'equipment-booking') {
      if (!loggedInUser) {
        setCurrentPage('login');
        return;
      }

      if (isStaffRejected(loggedInUser)) {
        setCurrentPage('staff-rejected');
        return;
      }

      if (isStaffPending(loggedInUser)) {
        setCurrentPage('staff-pending');
        return;
      }

      if (!isVerifiedStaff(loggedInUser)) {
        setCurrentPage('dashboard');
        return;
      }
    }

    setCurrentPage(page);
  };

  // =====================================================
  // LOGOUT
  // =====================================================

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');

    setLoggedInUser(null);
    setCurrentPage('home');
  };

  // =====================================================
  // LOGIN SUCCESS
  // =====================================================

  const handleLoginSuccess = (user) => {
    setLoggedInUser(user);

    if (isStaffRejected(user)) {
      setCurrentPage('staff-rejected');
    } else if (isStaffPending(user)) {
      setCurrentPage('staff-pending');
    } else {
      setCurrentPage('dashboard');
    }
  };

  // =====================================================
  // MAIN APPLICATION
  // =====================================================

  return (
    <div>
      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="logo">
          <img
            src="/uor-logo.png"
            alt="University of Ruhuna Logo"
            className="university-logo"
          />

          <div className="logo-text">
            <h2>UOR Lab Management</h2>
            <p>
              Department of Electrical and Information Engineering
            </p>
          </div>
        </div>

        <div className="nav-links">
          <a
            href="#home"
            onClick={() => setCurrentPage('home')}
          >
            Home
          </a>

          <a
            href="#lab-availability"
            onClick={() =>
              setCurrentPage('lab-availability')
            }
          >
            Laboratories
          </a>

          <a
            href="#equipment"
            onClick={() =>
              setCurrentPage('equipment')
            }
          >
            Equipment
          </a>

          {loggedInUser ? (
            <>
              <a
                href="#dashboard"
                onClick={(e) => {
                  e.preventDefault();
                  goToDashboard();
                }}
              >
                Dashboard
              </a>

              <a
                href="#logout"
                onClick={(e) => {
                  e.preventDefault();
                  handleLogout();
                }}
              >
                Logout
              </a>
            </>
          ) : (
            <a
              href="#login"
              onClick={() =>
                setCurrentPage('login')
              }
            >
              Login
            </a>
          )}

          <a
            href="#register"
            className="register-btn"
            onClick={() =>
              setCurrentPage('register')
            }
          >
            Register
          </a>
        </div>
      </nav>

      {/* =================================================
          HOMEPAGE
      ================================================= */}

      {currentPage === 'home' && (
        <main id="home">
          <section className="hero">
            <div className="hero-content">
              <p className="hero-label">
                FACULTY OF ENGINEERING | UNIVERSITY OF RUHUNA
              </p>

              <h1>
                Laboratory Booking &
                <br />
                Equipment Management System
              </h1>

              <p className="hero-description">
                A centralized platform for students and staff of the
                Department of Electrical and Information Engineering
                to view laboratories, request lab bookings, and
                access equipment information.
              </p>

              <div className="hero-buttons">
                <button
                  className="primary-btn"
                  onClick={() =>
                    setCurrentPage('laboratories')
                  }
                >
                  Explore Laboratories
                </button>

                <button
                  className="secondary-btn"
                  onClick={() => {
                    if (loggedInUser) {
                      if (isStaffRejected(loggedInUser)) {
                        setCurrentPage('staff-rejected');
                      } else if (
                        isStaffPending(loggedInUser)
                      ) {
                        setCurrentPage('staff-pending');
                      } else {
                        setCurrentPage('booking');
                      }
                    } else {
                      setCurrentPage('login');
                    }
                  }}
                >
                  Book a Lab
                </button>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* =================================================
          PUBLIC LABORATORY PAGES
      ================================================= */}

      {currentPage === 'laboratories' && (
        <Laboratories />
      )}

      {currentPage === 'lab-availability' && (
        <LabAvailability />
      )}

      {/* =================================================
          PUBLIC EQUIPMENT CATALOGUE
      ================================================= */}

      {currentPage === 'equipment' && (
        <EquipmentCatalogue />
      )}

      {/* =================================================
          REGISTER
      ================================================= */}

      {currentPage === 'register' && (
        <Register />
      )}

      {/* =================================================
          LOGIN
      ================================================= */}

      {currentPage === 'login' && (
        <Login
          onLoginSuccess={handleLoginSuccess}
        />
      )}

      {/* =================================================
          DASHBOARD
      ================================================= */}

      {currentPage === 'dashboard' &&
        loggedInUser &&
        !isStaffRejected(loggedInUser) &&
        !isStaffPending(loggedInUser) &&
        (
          loggedInUser.role === 'admin' ? (
            <AdminDashboard
              user={loggedInUser}
              onNavigate={navigateTo}
            />
          ) : (
            <StudentDashboard
              user={loggedInUser}
              onNavigate={navigateTo}
            />
          )
        )}

      {/* =================================================
          MY BOOKINGS
      ================================================= */}

      {currentPage === 'my-bookings' &&
        loggedInUser && (
          <MyBookings />
        )}

      {/* =================================================
          MY PROFILE
      ================================================= */}

      {currentPage === 'profile' &&
        loggedInUser && (
          <MyProfile user={loggedInUser} />
        )}

      {/* =================================================
          STAFF VERIFICATION PAGES
      ================================================= */}

      {currentPage === 'staff-pending' &&
        loggedInUser && (
          <StaffPending />
        )}

      {currentPage === 'staff-rejected' &&
        isStaffRejected(loggedInUser) && (
          <StaffRejected />
        )}

      {/* =================================================
          ADMIN STAFF VERIFICATION
      ================================================= */}

      {currentPage === 'admin-staff' &&
        loggedInUser?.role === 'admin' && (
          <AdminStaffVerification />
        )}

      {/* =================================================
          ADMIN EQUIPMENT MANAGEMENT
      ================================================= */}

      {currentPage === 'admin-equipment' &&
        loggedInUser?.role === 'admin' && (
          <AdminEquipment />
        )}

      {/* =================================================
          ADMIN BOOKING REQUESTS
      ================================================= */}

      {currentPage === 'admin-bookings' &&
        loggedInUser?.role === 'admin' && (
          <AdminBookingRequests />
        )}

      {/* =================================================
          ADMIN USER MANAGEMENT
      ================================================= */}

      {currentPage === 'admin-users' &&
        loggedInUser?.role === 'admin' && (
          <AdminUserManagement />
        )}

      {/* =================================================
          ADMIN LABORATORY MANAGEMENT
      ================================================= */}

      {currentPage === 'admin-labs' &&
        loggedInUser?.role === 'admin' && (
          <AdminLaboratories />
        )}

      {/* =================================================
          ADMIN REPORTS
      ================================================= */}

      {currentPage === 'admin-reports' &&
        loggedInUser?.role === 'admin' && (
          <AdminReports />
        )}

      {/* =================================================
          LABORATORY BOOKING
          Existing feature remains unchanged
      ================================================= */}

      {currentPage === 'booking' &&
        loggedInUser &&
        !isStaffPending(loggedInUser) &&
        !isStaffRejected(loggedInUser) && (
          <LabBooking user={loggedInUser} />
        )}

      {/* =================================================
          NEW: STAFF EQUIPMENT-ONLY BOOKING
          Staff members only
          Multiple laboratories supported
          No laboratory space reservation
      ================================================= */}

      {currentPage === 'equipment-booking' &&
        isVerifiedStaff(loggedInUser) && (
          <StaffEquipmentBooking
            user={loggedInUser}
            onNavigate={navigateTo}
          />
        )}
    </div>
  );
}

export default App;
